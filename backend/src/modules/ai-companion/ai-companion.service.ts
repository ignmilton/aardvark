import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, MoreThanOrEqual } from "typeorm";
import OpenAI from "openai";
import { User, Transaction } from "@/database/entities";
import { TransactionType } from "@aardvark/shared";
import {
  AIContinueStoryResponse,
  AISuggestBranchesResponse,
  AIImproveWritingResponse,
  AIGenerateCharacterResponse,
  AIGenerateDialogueResponse,
  AISummarizeStoryResponse,
  AIGeneratePlotIdeasResponse,
  AICreditsResponse,
  AIOperationType,
  AI_RATE_LIMITS,
} from "./ai-companion.types";

/**
 * AI Companion Service
 * Provides AI-powered writing assistance using OpenAI GPT models
 */
@Injectable()
export class AICompanionService {
  private readonly logger = new Logger(AICompanionService.name);
  private openai: OpenAI;
  private readonly MAX_INPUT_LENGTH = 50000; // ~12,500 tokens max input
  private readonly MAX_PROMPT_LENGTH = 2000;
  private readonly creditsPerOperation = {
    [AIOperationType.CONTINUE_STORY]: 10,
    [AIOperationType.SUGGEST_BRANCHES]: 8,
    [AIOperationType.IMPROVE_WRITING]: 5,
    [AIOperationType.GENERATE_CHARACTER]: 7,
    [AIOperationType.GENERATE_DIALOGUE]: 6,
    [AIOperationType.SUMMARIZE_STORY]: 5,
    [AIOperationType.CHECK_PLAGIARISM]: 15,
    [AIOperationType.GENERATE_PLOT_IDEAS]: 8,
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Validate input lengths to prevent excessive token usage
   */
  private validateInputLength(
    inputs: Record<string, string | undefined>,
  ): void {
    for (const [name, value] of Object.entries(inputs)) {
      if (!value) continue;
      const maxLength =
        name.includes("prompt") ||
        name.includes("role") ||
        name.includes("situation")
          ? this.MAX_PROMPT_LENGTH
          : this.MAX_INPUT_LENGTH;
      if (value.length > maxLength) {
        throw new BadRequestException(
          `Input "${name}" exceeds maximum length of ${maxLength} characters (received ${value.length})`,
        );
      }
    }
  }

  /**
   * Continue story with AI generation
   */
  async continueStory(
    userId: string,
    storyContext: string,
    prompt: string,
    style?: string,
    length: number = 300,
  ): Promise<AIContinueStoryResponse> {
    this.validateInputLength({ storyContext, prompt, style });

    // Check credits
    await this.checkCredits(userId, AIOperationType.CONTINUE_STORY);

    try {
      const systemPrompt = `You are a creative fiction writer helping to continue an interactive story.
${style ? `Write in the following style: ${style}.` : ""}
The continuation should be approximately ${length} words and maintain narrative consistency.`;

      const userPrompt = `Story context:\n${storyContext}\n\nWriter's prompt: ${prompt}\n\nPlease continue the story:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: Math.ceil(length * 1.5),
        temperature: 0.8,
      });

      const continuation = completion.choices[0]?.message?.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      const creditsUsed =
        this.creditsPerOperation[AIOperationType.CONTINUE_STORY];

      // Don't charge credits for empty responses
      if (!continuation.trim()) {
        await this.logUsage(
          userId,
          AIOperationType.CONTINUE_STORY,
          tokenCount,
          0,
          false,
          "Empty response from AI",
        );
        throw new InternalServerErrorException(
          "AI returned an empty response. No credits were charged.",
        );
      }

      // Log usage and deduct credits
      await this.logUsage(
        userId,
        AIOperationType.CONTINUE_STORY,
        tokenCount,
        creditsUsed,
        true,
      );
      await this.deductCredits(
        userId,
        AIOperationType.CONTINUE_STORY,
        tokenCount,
      );

      return {
        continuation,
        tokenCount,
        creditsUsed,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      await this.logUsage(
        userId,
        AIOperationType.CONTINUE_STORY,
        0,
        0,
        false,
        error.message,
      );
      throw new InternalServerErrorException(
        "Failed to generate story continuation",
      );
    }
  }

  /**
   * Suggest story branches with AI
   */
  async suggestBranches(
    userId: string,
    storyContext: string,
    currentSegment: string,
    numBranches: number = 3,
  ): Promise<AISuggestBranchesResponse> {
    this.validateInputLength({ storyContext, currentSegment });
    await this.checkCredits(userId, AIOperationType.SUGGEST_BRANCHES);

    try {
      const systemPrompt = `You are a creative writing assistant helping authors design branching narratives for interactive fiction.
Generate ${numBranches} distinct and compelling story branches that readers could choose from.
Each branch should lead to a different narrative direction.`;

      const userPrompt = `Story context:\n${storyContext}\n\nCurrent segment:\n${currentSegment}\n\nSuggest ${numBranches} branching options:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.9,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      const creditsUsed =
        this.creditsPerOperation[AIOperationType.SUGGEST_BRANCHES];

      if (!rawContent.trim()) {
        await this.logUsage(
          userId,
          AIOperationType.SUGGEST_BRANCHES,
          tokenCount,
          0,
          false,
          "Empty response from AI",
        );
        throw new InternalServerErrorException(
          "AI returned an empty response. No credits were charged.",
        );
      }

      const response = JSON.parse(rawContent);

      // Ensure branches have the correct format
      const branches = (response.branches || []).map((b: any) => ({
        text: b.text || b.choice || "",
        description: b.description || b.summary || "",
      }));

      await this.logUsage(
        userId,
        AIOperationType.SUGGEST_BRANCHES,
        tokenCount,
        creditsUsed,
        true,
      );
      await this.deductCredits(
        userId,
        AIOperationType.SUGGEST_BRANCHES,
        tokenCount,
      );

      return {
        branches,
        tokenCount,
        creditsUsed,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      await this.logUsage(
        userId,
        AIOperationType.SUGGEST_BRANCHES,
        0,
        0,
        false,
        error.message,
      );
      throw new InternalServerErrorException("Failed to suggest branches");
    }
  }

  /**
   * Improve writing with AI suggestions
   */
  async improveWriting(
    userId: string,
    text: string,
    focus: "grammar" | "style" | "both" = "both",
  ): Promise<AIImproveWritingResponse> {
    this.validateInputLength({ text });
    await this.checkCredits(userId, AIOperationType.IMPROVE_WRITING);

    try {
      const focusInstructions = {
        grammar:
          "Focus on correcting grammar, spelling, and punctuation errors.",
        style: "Focus on improving writing style, flow, and narrative quality.",
        both: "Improve both grammar and writing style.",
      };

      const systemPrompt = `You are a professional editor helping improve creative writing.
${focusInstructions[focus]}
Return a JSON object with: { "improved": "...", "suggestions": ["...", "..."] }`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      const creditsUsed =
        this.creditsPerOperation[AIOperationType.IMPROVE_WRITING];

      if (!rawContent.trim()) {
        await this.logUsage(
          userId,
          AIOperationType.IMPROVE_WRITING,
          tokenCount,
          0,
          false,
          "Empty response from AI",
        );
        throw new InternalServerErrorException(
          "AI returned an empty response. No credits were charged.",
        );
      }

      const response = JSON.parse(rawContent);

      await this.logUsage(
        userId,
        AIOperationType.IMPROVE_WRITING,
        tokenCount,
        creditsUsed,
        true,
      );
      await this.deductCredits(
        userId,
        AIOperationType.IMPROVE_WRITING,
        tokenCount,
      );

      return {
        original: text,
        improved: response.improved || text,
        suggestions: response.suggestions || [],
        tokenCount,
        creditsUsed,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      await this.logUsage(
        userId,
        AIOperationType.IMPROVE_WRITING,
        0,
        0,
        false,
        error.message,
      );
      throw new InternalServerErrorException("Failed to improve writing");
    }
  }

  /**
   * Generate character profile with AI
   */
  async generateCharacter(
    userId: string,
    role: string,
    genre?: string,
    traits?: string[],
  ): Promise<AIGenerateCharacterResponse> {
    this.validateInputLength({ role, genre });
    await this.checkCredits(userId, AIOperationType.GENERATE_CHARACTER);

    try {
      const systemPrompt = `You are a character designer for interactive fiction.
Create a detailed, compelling character profile.
Return JSON: { "name": "...", "description": "...", "traits": ["...", "..."], "backstory": "..." }`;

      let userPrompt = `Create a character for the role: ${role}`;
      if (genre) userPrompt += `\nGenre: ${genre}`;
      if (traits && traits.length > 0)
        userPrompt += `\nDesired traits: ${traits.join(", ")}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      const creditsUsed =
        this.creditsPerOperation[AIOperationType.GENERATE_CHARACTER];

      if (!rawContent.trim()) {
        await this.logUsage(
          userId,
          AIOperationType.GENERATE_CHARACTER,
          tokenCount,
          0,
          false,
          "Empty response from AI",
        );
        throw new InternalServerErrorException(
          "AI returned an empty response. No credits were charged.",
        );
      }

      const response = JSON.parse(rawContent);

      await this.logUsage(
        userId,
        AIOperationType.GENERATE_CHARACTER,
        tokenCount,
        creditsUsed,
        true,
      );
      await this.deductCredits(
        userId,
        AIOperationType.GENERATE_CHARACTER,
        tokenCount,
      );

      return {
        name: response.name || "Unknown Character",
        description: response.description || "",
        traits: response.traits || [],
        backstory: response.backstory || "",
        tokenCount,
        creditsUsed,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      await this.logUsage(
        userId,
        AIOperationType.GENERATE_CHARACTER,
        0,
        0,
        false,
        error.message,
      );
      throw new InternalServerErrorException("Failed to generate character");
    }
  }

  /**
   * Generate dialogue options with AI
   */
  async generateDialogue(
    userId: string,
    characters: string[],
    situation: string,
    tone?: string,
  ): Promise<AIGenerateDialogueResponse> {
    this.validateInputLength({ situation, tone });
    await this.checkCredits(userId, AIOperationType.GENERATE_DIALOGUE);

    try {
      const systemPrompt = `You are a dialogue writer for interactive fiction.
Create natural, character-appropriate dialogue options.
${tone ? `Tone: ${tone}` : ""}
Return JSON: { "dialogueOptions": [{ "character": "...", "dialogue": "...", "tone": "..." }, ...] }`;

      const userPrompt = `Characters: ${characters.join(", ")}\nSituation: ${situation}\n\nGenerate dialogue options:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      const creditsUsed =
        this.creditsPerOperation[AIOperationType.GENERATE_DIALOGUE];

      if (!rawContent.trim()) {
        await this.logUsage(
          userId,
          AIOperationType.GENERATE_DIALOGUE,
          tokenCount,
          0,
          false,
          "Empty response from AI",
        );
        throw new InternalServerErrorException(
          "AI returned an empty response. No credits were charged.",
        );
      }

      const response = JSON.parse(rawContent);

      await this.logUsage(
        userId,
        AIOperationType.GENERATE_DIALOGUE,
        tokenCount,
        creditsUsed,
        true,
      );
      await this.deductCredits(
        userId,
        AIOperationType.GENERATE_DIALOGUE,
        tokenCount,
      );

      return {
        dialogueOptions: response.dialogueOptions || [],
        tokenCount,
        creditsUsed,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      await this.logUsage(
        userId,
        AIOperationType.GENERATE_DIALOGUE,
        0,
        0,
        false,
        error.message,
      );
      throw new InternalServerErrorException("Failed to generate dialogue");
    }
  }

  /**
   * Summarize story content with AI
   */
  async summarizeStory(
    userId: string,
    storyContent: string,
    maxWords: number = 200,
  ): Promise<AISummarizeStoryResponse> {
    this.validateInputLength({ storyContent });
    await this.checkCredits(userId, AIOperationType.SUMMARIZE_STORY);

    try {
      const systemPrompt = `You are a story analyst. Create a concise summary and list key plot points.
Maximum summary length: ${maxWords} words.
Return JSON: { "summary": "...", "keyPoints": ["...", "..."] }`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: storyContent },
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      const creditsUsed =
        this.creditsPerOperation[AIOperationType.SUMMARIZE_STORY];

      if (!rawContent.trim()) {
        await this.logUsage(
          userId,
          AIOperationType.SUMMARIZE_STORY,
          tokenCount,
          0,
          false,
          "Empty response from AI",
        );
        throw new InternalServerErrorException(
          "AI returned an empty response. No credits were charged.",
        );
      }

      const response = JSON.parse(rawContent);

      await this.logUsage(
        userId,
        AIOperationType.SUMMARIZE_STORY,
        tokenCount,
        creditsUsed,
        true,
      );
      await this.deductCredits(
        userId,
        AIOperationType.SUMMARIZE_STORY,
        tokenCount,
      );

      return {
        summary: response.summary || "",
        keyPoints: response.keyPoints || [],
        wordCount: response.summary?.split(/\s+/).length || 0,
        tokenCount,
        creditsUsed,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      await this.logUsage(
        userId,
        AIOperationType.SUMMARIZE_STORY,
        0,
        0,
        false,
        error.message,
      );
      throw new InternalServerErrorException("Failed to summarize story");
    }
  }

  /**
   * Check if user has sufficient credits and is within rate limits
   */
  async checkCredits(
    userId: string,
    operation: AIOperationType,
  ): Promise<AICreditsResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const creditsRequired = this.creditsPerOperation[operation];
    const isPremium = user.isPremium;

    // Check rate limit for premium users (50 requests/day)
    if (isPremium) {
      const dailyUsage = await this.getDailyUsageCount(userId);
      if (dailyUsage >= AI_RATE_LIMITS.PREMIUM_DAILY_LIMIT) {
        throw new BadRequestException(
          `Daily AI request limit reached (${AI_RATE_LIMITS.PREMIUM_DAILY_LIMIT}/day). Limit resets at midnight UTC.`,
        );
      }
    } else {
      // Non-premium users pay credits
      if (user.creditsBalance < creditsRequired) {
        throw new BadRequestException(
          `Insufficient credits. Required: ${creditsRequired}, Available: ${user.creditsBalance}`,
        );
      }
    }

    return {
      remainingCredits: user.creditsBalance,
      isPremium,
      unlimitedAccess: isPremium,
      creditsPerRequest: isPremium ? 0 : creditsRequired,
    };
  }

  /**
   * Get the count of AI requests made by user today
   */
  private async getDailyUsageCount(userId: string): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const count = await this.transactionRepository.count({
      where: {
        userId,
        type: TransactionType.AI_COMPANION,
        createdAt: MoreThanOrEqual(today),
      },
    });

    return count;
  }

  /**
   * Generate plot ideas for a story
   */
  async generatePlotIdeas(
    userId: string,
    genre: string,
    themes?: string[],
    numIdeas: number = 3,
  ): Promise<AIGeneratePlotIdeasResponse> {
    this.validateInputLength({ genre });
    await this.checkCredits(userId, AIOperationType.GENERATE_PLOT_IDEAS);

    try {
      const systemPrompt = `You are a creative writing consultant specializing in interactive fiction.
Generate ${numIdeas} unique and compelling story plot ideas.
Each idea should be suitable for a branching narrative with multiple paths.
Return JSON: { "ideas": [{ "title": "...", "synopsis": "...", "themes": ["...", "..."], "conflictType": "..." }, ...] }`;

      let userPrompt = `Generate ${numIdeas} plot ideas for the genre: ${genre}`;
      if (themes && themes.length > 0) {
        userPrompt += `\nIncorporate these themes: ${themes.join(", ")}`;
      }
      userPrompt +=
        "\n\nProvide creative, engaging plot ideas with branching potential.";

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.9,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      const creditsUsed =
        this.creditsPerOperation[AIOperationType.GENERATE_PLOT_IDEAS];

      if (!rawContent.trim()) {
        await this.logUsage(
          userId,
          AIOperationType.GENERATE_PLOT_IDEAS,
          tokenCount,
          0,
          false,
          "Empty response from AI",
        );
        throw new InternalServerErrorException(
          "AI returned an empty response. No credits were charged.",
        );
      }

      const response = JSON.parse(rawContent);

      await this.logUsage(
        userId,
        AIOperationType.GENERATE_PLOT_IDEAS,
        tokenCount,
        creditsUsed,
        true,
      );
      await this.deductCredits(
        userId,
        AIOperationType.GENERATE_PLOT_IDEAS,
        tokenCount,
      );

      return {
        ideas: response.ideas || [],
        tokenCount,
        creditsUsed,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      await this.logUsage(
        userId,
        AIOperationType.GENERATE_PLOT_IDEAS,
        0,
        0,
        false,
        error.message,
      );
      throw new InternalServerErrorException("Failed to generate plot ideas");
    }
  }

  /**
   * Deduct credits after successful AI operation
   */
  private async deductCredits(
    userId: string,
    operation: AIOperationType,
    tokensUsed: number,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Premium users don't pay credits
    if (user.isPremium) {
      return;
    }

    const creditsToDeduct = this.creditsPerOperation[operation];

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const txRepo = manager.getRepository(Transaction);

      // Lock user row for update
      const lockedUser = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!lockedUser) {
        throw new NotFoundException("User not found");
      }

      // Update balance
      const newBalance = lockedUser.creditsBalance - creditsToDeduct;
      await userRepo.update(userId, { creditsBalance: newBalance });

      // Create transaction record
      const transaction = txRepo.create({
        userId,
        type: TransactionType.AI_COMPANION,
        amount: -creditsToDeduct,
        balance: newBalance,
        description: `AI ${operation.replace(/_/g, " ")}`,
        referenceId: null,
        referenceType: "ai_operation",
        metadata: {
          operation,
          tokensUsed,
        },
      });

      await txRepo.save(transaction);
    });
  }

  /**
   * Log AI usage for analytics
   */
  private async logUsage(
    userId: string,
    operation: AIOperationType,
    tokensUsed: number,
    creditsCharged: number,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    // Log to transaction metadata for now
    // In the future, this could be expanded to a separate AI usage tracking table
    try {
      await this.transactionRepository.save({
        userId,
        type: TransactionType.AI_COMPANION,
        amount: 0, // Log only, no credit change
        balance: 0, // Will be updated if credits are deducted
        description: `AI ${operation} ${success ? "success" : "failed"}`,
        referenceId: null,
        referenceType: "ai_usage_log",
        metadata: {
          operation,
          tokensUsed,
          creditsCharged,
          success,
          errorMessage: errorMessage || null,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Don't throw on logging errors
      this.logger.warn(
        "Failed to log AI usage",
        error instanceof Error ? error.message : error,
      );
    }
  }
}
