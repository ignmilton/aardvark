import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AICompanionService } from "./ai-companion.service";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";
import {
  ContinueStoryDto,
  SuggestBranchesDto,
  ImproveWritingDto,
  GenerateCharacterDto,
  GenerateDialogueDto,
  SummarizeStoryDto,
  GeneratePlotIdeasDto,
} from "./dto";

/**
 * AI Companion Controller
 * Provides REST endpoints for AI-powered writing assistance
 */
@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AICompanionController {
  constructor(private readonly aiCompanionService: AICompanionService) {}

  /**
   * Continue story with AI generation
   * POST /ai/continue-story
   */
  @Post("continue-story")
  @HttpCode(HttpStatus.OK)
  async continueStory(@Req() req: AuthenticatedRequest, @Body() dto: ContinueStoryDto) {
    const userId = req.user.id;
    const result = await this.aiCompanionService.continueStory(
      userId,
      dto.context,
      dto.prompt,
      dto.style,
      dto.length,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Suggest story branches with AI
   * POST /ai/suggest-branches
   */
  @Post("suggest-branches")
  @HttpCode(HttpStatus.OK)
  async suggestBranches(@Req() req: AuthenticatedRequest, @Body() dto: SuggestBranchesDto) {
    const userId = req.user.id;
    const result = await this.aiCompanionService.suggestBranches(
      userId,
      dto.currentText,
      dto.currentText,
      dto.numBranches,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Improve writing with AI suggestions
   * POST /ai/improve-writing
   */
  @Post("improve-writing")
  @HttpCode(HttpStatus.OK)
  async improveWriting(@Req() req: AuthenticatedRequest, @Body() dto: ImproveWritingDto) {
    const userId = req.user.id;
    const result = await this.aiCompanionService.improveWriting(
      userId,
      dto.text,
      dto.focus,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Generate character profile with AI
   * POST /ai/generate-character
   */
  @Post("generate-character")
  @HttpCode(HttpStatus.OK)
  async generateCharacter(@Req() req: AuthenticatedRequest, @Body() dto: GenerateCharacterDto) {
    const userId = req.user.id;
    const result = await this.aiCompanionService.generateCharacter(
      userId,
      dto.role,
      dto.genre,
      dto.traits,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Generate dialogue options with AI
   * POST /ai/generate-dialogue
   */
  @Post("generate-dialogue")
  @HttpCode(HttpStatus.OK)
  async generateDialogue(@Req() req: AuthenticatedRequest, @Body() dto: GenerateDialogueDto) {
    const userId = req.user.id;
    const result = await this.aiCompanionService.generateDialogue(
      userId,
      dto.characters,
      dto.context,
      dto.tone,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Summarize story content with AI
   * POST /ai/summarize
   */
  @Post("summarize")
  @HttpCode(HttpStatus.OK)
  async summarizeStory(@Req() req: AuthenticatedRequest, @Body() dto: SummarizeStoryDto) {
    const userId = req.user.id;
    const result = await this.aiCompanionService.summarizeStory(
      userId,
      dto.content,
      dto.maxWords,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Generate plot ideas with AI
   * POST /ai/generate-plot-ideas
   */
  @Post("generate-plot-ideas")
  @HttpCode(HttpStatus.OK)
  async generatePlotIdeas(@Req() req: AuthenticatedRequest, @Body() dto: GeneratePlotIdeasDto) {
    const userId = req.user.id;
    const result = await this.aiCompanionService.generatePlotIdeas(
      userId,
      dto.genre,
      dto.themes,
      dto.numIdeas,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Check remaining AI credits
   * GET /ai/credits
   */
  @Get("credits")
  async getCredits(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    // Use a default operation to check credits
    const result = await this.aiCompanionService.checkCredits(
      userId,
      "continue_story" as any,
    );

    return {
      success: true,
      data: result,
    };
  }
}
