import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, MoreThanOrEqual } from "typeorm";
import {
  Transaction,
  User,
  Story,
  CreditBundle,
  AuthorEarning,
  StoryUnlock,
} from "@/database/entities";
import {
  TransactionType,
  EarningType,
  DEFAULT_CREDIT_CONFIG,
  PLATFORM_FEE_PERCENTAGE,
} from "@aardvark/shared";
import {
  UnlockStoryDto,
  TipAuthorDto,
  AdWatchRewardDto,
  TransactionHistoryQueryDto,
} from "./dto";

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(CreditBundle)
    private readonly bundleRepository: Repository<CreditBundle>,
    @InjectRepository(AuthorEarning)
    private readonly earningRepository: Repository<AuthorEarning>,
    @InjectRepository(StoryUnlock)
    private readonly storyUnlockRepository: Repository<StoryUnlock>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<{
    balance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Calculate lifetime stats
    const [earnedResult, spentResult] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder("tx")
        .select("COALESCE(SUM(tx.amount), 0)", "total")
        .where("tx.userId = :userId", { userId })
        .andWhere("tx.amount > 0")
        .getRawOne(),
      this.transactionRepository
        .createQueryBuilder("tx")
        .select("COALESCE(SUM(ABS(tx.amount)), 0)", "total")
        .where("tx.userId = :userId", { userId })
        .andWhere("tx.amount < 0")
        .getRawOne(),
    ]);

    return {
      balance: user.creditsBalance,
      lifetimeEarned: parseInt(earnedResult?.total || "0", 10),
      lifetimeSpent: parseInt(spentResult?.total || "0", 10),
    };
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: string,
    query: TransactionHistoryQueryDto,
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit: rawLimit = 20, type } = query;
    // Cap limit to prevent resource exhaustion
    const limit = Math.min(Math.max(1, rawLimit), 100);

    const queryBuilder = this.transactionRepository
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId });

    if (type) {
      queryBuilder.andWhere("tx.type = :type", { type });
    }

    queryBuilder
      .orderBy("tx.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [transactions, total] = await queryBuilder.getManyAndCount();

    return { transactions, total, page, limit };
  }

  /**
   * Add credits from a bundle purchase
   */
  async addCreditsFromPurchase(
    userId: string,
    bundleId: string,
    stripePaymentId: string,
  ): Promise<Transaction> {
    const bundle = await this.bundleRepository.findOne({
      where: { id: bundleId },
    });
    if (!bundle) {
      throw new NotFoundException("Bundle not found");
    }

    const totalCredits = bundle.credits + bundle.bonusCredits;

    return this.addCredits(
      userId,
      totalCredits,
      TransactionType.CREDIT_PURCHASE,
      `Purchased ${bundle.name}`,
      stripePaymentId,
      "stripe_payment",
      { bundleId, bonusCredits: bundle.bonusCredits },
    );
  }

  /**
   * Add credits to user's balance
   */
  async addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceId?: string,
    referenceType?: string,
    metadata: Record<string, unknown> = {},
  ): Promise<Transaction> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const txRepo = manager.getRepository(Transaction);

      // Lock user row for update
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      // Update balance
      const newBalance = user.creditsBalance + amount;
      await userRepo.update(userId, { creditsBalance: newBalance });

      // Create transaction record
      const transaction = txRepo.create({
        userId,
        type,
        amount,
        balance: newBalance,
        description,
        referenceId: referenceId || null,
        referenceType: referenceType || null,
        metadata,
      });

      return txRepo.save(transaction);
    });
  }

  /**
   * Unlock a premium story
   */
  async unlockStory(userId: string, dto: UnlockStoryDto): Promise<Transaction> {
    const story = await this.storyRepository.findOne({
      where: { id: dto.storyId },
      relations: ["author"],
    });

    if (!story) {
      throw new NotFoundException("Story not found");
    }

    if (!story.isPremium) {
      throw new BadRequestException("Story is not premium");
    }

    if (story.authorId === userId) {
      throw new BadRequestException("You cannot unlock your own story");
    }

    // Check if already unlocked
    const existingUnlock = await this.storyUnlockRepository.findOne({
      where: { userId, storyId: dto.storyId },
    });
    if (existingUnlock) {
      throw new BadRequestException("Story already unlocked");
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const txRepo = manager.getRepository(Transaction);
      const earningRepo = manager.getRepository(AuthorEarning);
      const unlockRepo = manager.getRepository(StoryUnlock);

      // Lock user row
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      if (user.creditsBalance < story.creditCost) {
        throw new BadRequestException("Insufficient credits");
      }

      // Deduct credits
      const newBalance = user.creditsBalance - story.creditCost;
      await userRepo.update(userId, { creditsBalance: newBalance });

      // Create transaction
      const transaction = txRepo.create({
        userId,
        type: TransactionType.STORY_UNLOCK,
        amount: -story.creditCost,
        balance: newBalance,
        description: `Unlocked "${story.title}"`,
        referenceId: story.id,
        referenceType: "story",
      });

      const savedTx = await txRepo.save(transaction);

      // Create author earning (derive author share from total minus fee to avoid rounding loss)
      const platformFee = Math.floor(
        story.creditCost * PLATFORM_FEE_PERCENTAGE,
      );
      const authorEarning = story.creditCost - platformFee;

      const earning = earningRepo.create({
        authorId: story.authorId,
        storyId: story.id,
        type: EarningType.STORY_UNLOCK,
        grossAmount: story.creditCost,
        platformFee,
        netAmount: authorEarning,
        readerUserId: userId,
        transactionId: savedTx.id,
      });

      await earningRepo.save(earning);

      // Record the unlock
      const unlock = unlockRepo.create({
        userId,
        storyId: story.id,
        transactionId: savedTx.id,
        creditCost: story.creditCost,
      });
      await unlockRepo.save(unlock);

      return savedTx;
    });
  }

  /**
   * Tip an author
   */
  async tipAuthor(userId: string, dto: TipAuthorDto): Promise<Transaction> {
    if (dto.authorId === userId) {
      throw new BadRequestException("You cannot tip yourself");
    }

    const author = await this.userRepository.findOne({
      where: { id: dto.authorId },
    });
    if (!author) {
      throw new NotFoundException("Author not found");
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const txRepo = manager.getRepository(Transaction);
      const earningRepo = manager.getRepository(AuthorEarning);

      // Lock user row
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      if (user.creditsBalance < dto.amount) {
        throw new BadRequestException("Insufficient credits");
      }

      // Deduct credits
      const newBalance = user.creditsBalance - dto.amount;
      await userRepo.update(userId, { creditsBalance: newBalance });

      // Create transaction
      const transaction = txRepo.create({
        userId,
        type: TransactionType.AUTHOR_TIP,
        amount: -dto.amount,
        balance: newBalance,
        description: `Tip to ${author.displayName || author.username}`,
        referenceId: dto.authorId,
        referenceType: "user",
        metadata: { message: dto.message, storyId: dto.storyId },
      });

      const savedTx = await txRepo.save(transaction);

      // Create author earning (tips have lower platform fee)
      const platformFee = Math.floor(dto.amount * 0.1); // 10% on tips
      const authorEarning = dto.amount - platformFee;

      const earning = earningRepo.create({
        authorId: dto.authorId,
        storyId: dto.storyId || null,
        type: EarningType.TIP,
        grossAmount: dto.amount,
        platformFee,
        netAmount: authorEarning,
        readerUserId: userId,
        transactionId: savedTx.id,
      });

      await earningRepo.save(earning);

      return savedTx;
    });
  }

  /**
   * Claim daily bonus credits
   */
  async claimDailyBonus(userId: string): Promise<Transaction> {
    // Check if already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingClaim = await this.transactionRepository.findOne({
      where: {
        userId,
        type: TransactionType.DAILY_BONUS,
      },
      order: { createdAt: "DESC" },
    });

    if (existingClaim && existingClaim.createdAt >= today) {
      throw new BadRequestException("Daily bonus already claimed today");
    }

    return this.addCredits(
      userId,
      DEFAULT_CREDIT_CONFIG.dailyBonusCredits,
      TransactionType.DAILY_BONUS,
      "Daily login bonus",
    );
  }

  /**
   * Award credits for watching an ad
   * Premium users cannot claim ad rewards (they have ad-free experience)
   */
  async rewardAdWatch(
    userId: string,
    dto: AdWatchRewardDto,
  ): Promise<Transaction | null> {
    if (!dto.completed) {
      return null;
    }

    // Check if user is premium - premium users cannot claim ad rewards
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isPremium) {
      throw new ForbiddenException(
        "Premium subscribers have ad-free access and cannot claim ad rewards.",
      );
    }

    // Check cooldown
    const lastAdWatch = await this.transactionRepository.findOne({
      where: {
        userId,
        type: TransactionType.AD_WATCH,
      },
      order: { createdAt: "DESC" },
    });

    if (lastAdWatch) {
      const cooldownEnd = new Date(
        lastAdWatch.createdAt.getTime() +
          DEFAULT_CREDIT_CONFIG.adWatchCooldown * 1000,
      );
      if (new Date() < cooldownEnd) {
        throw new BadRequestException("Ad watch cooldown not elapsed");
      }
    }

    return this.addCredits(
      userId,
      DEFAULT_CREDIT_CONFIG.adWatchCredits,
      TransactionType.AD_WATCH,
      "Watched rewarded ad",
      dto.adUnitId,
      "ad",
      { adType: dto.adType, duration: dto.duration },
    );
  }

  /**
   * Award credits for completing a story
   */
  async rewardStoryCompletion(
    userId: string,
    storyId: string,
  ): Promise<Transaction> {
    // Check if already rewarded for this story
    const existingReward = await this.transactionRepository.findOne({
      where: {
        userId,
        type: TransactionType.STORY_COMPLETION,
        referenceId: storyId,
      },
    });

    if (existingReward) {
      throw new BadRequestException("Already rewarded for this story");
    }

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) {
      throw new NotFoundException("Story not found");
    }

    return this.addCredits(
      userId,
      DEFAULT_CREDIT_CONFIG.storyCompletionCredits,
      TransactionType.STORY_COMPLETION,
      `Completed "${story.title}"`,
      storyId,
      "story",
    );
  }

  /**
   * Check if user has unlocked a story
   */
  async isStoryUnlocked(userId: string, storyId: string): Promise<boolean> {
    const unlock = await this.storyUnlockRepository.findOne({
      where: { userId, storyId },
    });
    return !!unlock;
  }

  /**
   * Get all unlocked story IDs for a user
   */
  async getUnlockedStoryIds(userId: string): Promise<string[]> {
    const unlocks = await this.storyUnlockRepository.find({
      where: { userId },
      select: ["storyId"],
    });
    return unlocks.map((u) => u.storyId);
  }

  /**
   * Get available credit bundles
   */
  async getBundles(): Promise<CreditBundle[]> {
    return this.bundleRepository.find({
      where: { isActive: true },
      order: { priceInCents: "ASC" },
    });
  }

  /**
   * Get the count of ad watches by a user today
   * Used for enforcing daily ad limits
   */
  async getTodayAdWatchCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await this.transactionRepository.count({
      where: {
        userId,
        type: TransactionType.AD_WATCH,
        createdAt: MoreThanOrEqual(today),
      },
    });

    return count;
  }
}
