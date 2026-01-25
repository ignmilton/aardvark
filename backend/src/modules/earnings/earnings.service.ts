import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, DataSource } from 'typeorm';
import {
  AuthorEarning,
  AuthorPayoutAccount,
  Payout,
  User,
} from '@/database/entities';
import {
  EarningType,
  MIN_PAYOUT_AMOUNT,
} from '@aardvark/shared';
import { PaymentsService } from '@/modules/payments/payments.service';
import { EarningsQueryDto } from './dto';

@Injectable()
export class EarningsService {
  constructor(
    @InjectRepository(AuthorEarning)
    private readonly earningRepository: Repository<AuthorEarning>,
    @InjectRepository(AuthorPayoutAccount)
    private readonly accountRepository: Repository<AuthorPayoutAccount>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get author's earnings summary
   */
  async getSummary(
    authorId: string,
    period: 'day' | 'week' | 'month' | 'year' | 'all_time' = 'month',
  ): Promise<{
    totalGross: number;
    totalFees: number;
    totalNet: number;
    pendingBalance: number;
    lifetimePaidOut: number;
    earningsByType: Record<string, number>;
  }> {
    const dateRange = this.getDateRange(period);

    // Get earnings in period
    const earnings = await this.earningRepository.find({
      where: {
        authorId,
        ...(dateRange && { createdAt: Between(dateRange.start, dateRange.end) }),
      },
    });

    const totalGross = earnings.reduce((sum, e) => sum + e.grossAmount, 0);
    const totalFees = earnings.reduce((sum, e) => sum + e.platformFee, 0);
    const totalNet = earnings.reduce((sum, e) => sum + e.netAmount, 0);

    // Group by type
    const earningsByType: Record<string, number> = {};
    for (const earning of earnings) {
      earningsByType[earning.type] = (earningsByType[earning.type] || 0) + earning.netAmount;
    }

    // Get pending balance (all net earnings not yet paid out)
    const pendingBalance = await this.getPendingBalance(authorId);

    // Get lifetime paid out
    const paidOut = await this.payoutRepository
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'total')
      .where('payout.authorId = :authorId', { authorId })
      .andWhere('payout.status = :status', { status: 'completed' })
      .getRawOne();

    return {
      totalGross,
      totalFees,
      totalNet,
      pendingBalance,
      lifetimePaidOut: parseInt(paidOut?.total || '0', 10),
      earningsByType,
    };
  }

  /**
   * Get pending balance (unpaid earnings)
   */
  async getPendingBalance(authorId: string): Promise<number> {
    // Sum all net earnings
    const totalEarned = await this.earningRepository
      .createQueryBuilder('earning')
      .select('COALESCE(SUM(earning.netAmount), 0)', 'total')
      .where('earning.authorId = :authorId', { authorId })
      .getRawOne();

    // Sum all completed payouts
    const totalPaidOut = await this.payoutRepository
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'total')
      .where('payout.authorId = :authorId', { authorId })
      .andWhere('payout.status = :status', { status: 'completed' })
      .getRawOne();

    const earned = parseInt(totalEarned?.total || '0', 10);
    const paidOut = parseInt(totalPaidOut?.total || '0', 10);

    return earned - paidOut;
  }

  /**
   * Get detailed earnings history
   */
  async getEarnings(
    authorId: string,
    query: EarningsQueryDto,
  ): Promise<{
    earnings: AuthorEarning[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { period = 'month', page = 1, limit = 20 } = query;
    const dateRange = this.getDateRange(period);

    const queryBuilder = this.earningRepository
      .createQueryBuilder('earning')
      .leftJoinAndSelect('earning.story', 'story')
      .leftJoinAndSelect('earning.reader', 'reader')
      .where('earning.authorId = :authorId', { authorId });

    if (dateRange) {
      queryBuilder.andWhere('earning.createdAt BETWEEN :start AND :end', {
        start: dateRange.start,
        end: dateRange.end,
      });
    }

    queryBuilder
      .orderBy('earning.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [earnings, total] = await queryBuilder.getManyAndCount();

    return { earnings, total, page, limit };
  }

  /**
   * Get earnings by story
   */
  async getEarningsByStory(
    authorId: string,
    period: 'day' | 'week' | 'month' | 'year' | 'all_time' = 'month',
  ): Promise<{ storyId: string; title: string; amount: number }[]> {
    const dateRange = this.getDateRange(period);

    const queryBuilder = this.earningRepository
      .createQueryBuilder('earning')
      .leftJoin('earning.story', 'story')
      .select('earning.storyId', 'storyId')
      .addSelect('story.title', 'title')
      .addSelect('SUM(earning.netAmount)', 'amount')
      .where('earning.authorId = :authorId', { authorId })
      .andWhere('earning.storyId IS NOT NULL');

    if (dateRange) {
      queryBuilder.andWhere('earning.createdAt BETWEEN :start AND :end', {
        start: dateRange.start,
        end: dateRange.end,
      });
    }

    queryBuilder
      .groupBy('earning.storyId')
      .addGroupBy('story.title')
      .orderBy('amount', 'DESC');

    const results = await queryBuilder.getRawMany();

    return results.map((r) => ({
      storyId: r.storyId,
      title: r.title || 'Unknown Story',
      amount: parseInt(r.amount || '0', 10),
    }));
  }

  // ============================================================================
  // Payout Account Management
  // ============================================================================

  /**
   * Get author's payout account
   */
  async getPayoutAccount(authorId: string): Promise<AuthorPayoutAccount | null> {
    return this.accountRepository.findOne({ where: { authorId } });
  }

  /**
   * Create or get onboarding link for payout account
   */
  async setupPayoutAccount(
    authorId: string,
    country: string,
    businessType: 'individual' | 'company',
    returnUrl: string,
    refreshUrl: string,
  ): Promise<{ accountId: string; onboardingUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: authorId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let account = await this.accountRepository.findOne({ where: { authorId } });

    if (!account) {
      // Create new Stripe Connect account
      const stripeAccount = await this.paymentsService.createConnectAccount(
        authorId,
        user.email,
        country,
        businessType,
      );

      account = this.accountRepository.create({
        authorId,
        stripeConnectAccountId: stripeAccount.id,
        accountStatus: 'pending',
        country,
        currency: 'usd',
      });

      await this.accountRepository.save(account);
    }

    // Create onboarding link
    const accountLink = await this.paymentsService.createConnectAccountLink(
      account.stripeConnectAccountId!,
      refreshUrl,
      returnUrl,
    );

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  }

  /**
   * Update payout account status from Stripe
   */
  async updateAccountStatus(stripeAccountId: string): Promise<void> {
    const account = await this.accountRepository.findOne({
      where: { stripeConnectAccountId: stripeAccountId },
    });

    if (!account) return;

    const stripeAccount = await this.paymentsService.getConnectAccount(stripeAccountId);

    account.chargesEnabled = stripeAccount.charges_enabled || false;
    account.payoutsEnabled = stripeAccount.payouts_enabled || false;
    account.accountStatus = this.determineAccountStatus(stripeAccount);
    account.updatedAt = new Date();

    await this.accountRepository.save(account);
  }

  // ============================================================================
  // Payout Processing
  // ============================================================================

  /**
   * Request a payout
   * Uses database transaction with pessimistic locking to prevent race conditions
   */
  async requestPayout(authorId: string, amount?: number): Promise<Payout> {
    return this.dataSource.transaction(async (manager) => {
      const accountRepo = manager.getRepository(AuthorPayoutAccount);
      const payoutRepo = manager.getRepository(Payout);
      const earningRepo = manager.getRepository(AuthorEarning);

      // Lock the account row to prevent concurrent payout requests
      const account = await accountRepo.findOne({
        where: { authorId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account || !account.payoutsEnabled) {
        throw new BadRequestException('Payout account not set up or not verified');
      }

      // Check for pending payouts within the transaction (with lock)
      const pendingPayout = await payoutRepo.findOne({
        where: {
          authorId,
          status: 'pending',
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (pendingPayout) {
        throw new BadRequestException('You already have a pending payout request');
      }

      // Calculate pending balance within transaction
      const totalEarned = await earningRepo
        .createQueryBuilder('earning')
        .select('COALESCE(SUM(earning.netAmount), 0)', 'total')
        .where('earning.authorId = :authorId', { authorId })
        .getRawOne();

      const totalPaidOut = await payoutRepo
        .createQueryBuilder('payout')
        .select('COALESCE(SUM(payout.amount), 0)', 'total')
        .where('payout.authorId = :authorId', { authorId })
        .andWhere('payout.status = :status', { status: 'completed' })
        .getRawOne();

      const earned = parseInt(totalEarned?.total || '0', 10);
      const paidOut = parseInt(totalPaidOut?.total || '0', 10);
      const pendingBalance = earned - paidOut;

      // Use specified amount or full balance
      const payoutAmount = amount || pendingBalance;

      if (payoutAmount < MIN_PAYOUT_AMOUNT) {
        throw new BadRequestException(
          `Minimum payout amount is $${MIN_PAYOUT_AMOUNT / 100}`,
        );
      }

      if (payoutAmount > pendingBalance) {
        throw new BadRequestException('Insufficient balance');
      }

      // Create payout record
      const payout = payoutRepo.create({
        authorId,
        amount: payoutAmount,
        currency: account.currency,
        status: 'pending',
      });

      return payoutRepo.save(payout);
    });
  }

  /**
   * Process a pending payout
   */
  async processPayout(payoutId: string): Promise<Payout> {
    const payout = await this.payoutRepository.findOne({
      where: { id: payoutId },
    });

    if (!payout || payout.status !== 'pending') {
      throw new BadRequestException('Payout not found or not pending');
    }

    const account = await this.accountRepository.findOne({
      where: { authorId: payout.authorId },
    });

    if (!account) {
      throw new BadRequestException('Payout account not found');
    }

    try {
      payout.status = 'processing';
      payout.processedAt = new Date();
      await this.payoutRepository.save(payout);

      // Create Stripe transfer
      const transfer = await this.paymentsService.createTransfer(
        payout.amount,
        account.stripeConnectAccountId!,
        `Aardvark author payout`,
        { payoutId: payout.id, authorId: payout.authorId },
      );

      payout.stripeTransferId = transfer.id;
      payout.status = 'completed';
      payout.completedAt = new Date();

      return this.payoutRepository.save(payout);
    } catch (error) {
      payout.status = 'failed';
      payout.failureReason = error.message;
      await this.payoutRepository.save(payout);
      throw error;
    }
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(authorId: string): Promise<Payout[]> {
    return this.payoutRepository.find({
      where: { authorId },
      order: { requestedAt: 'DESC' },
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getDateRange(
    period: 'day' | 'week' | 'month' | 'year' | 'all_time',
  ): { start: Date; end: Date } | null {
    if (period === 'all_time') return null;

    const now = new Date();
    const start = new Date();

    switch (period) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }

    return { start, end: now };
  }

  private determineAccountStatus(
    stripeAccount: any,
  ): 'pending' | 'active' | 'restricted' | 'disabled' {
    if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
      return 'active';
    }
    if (stripeAccount.requirements?.disabled_reason) {
      return 'disabled';
    }
    if (stripeAccount.requirements?.currently_due?.length > 0) {
      return 'restricted';
    }
    return 'pending';
  }
}
