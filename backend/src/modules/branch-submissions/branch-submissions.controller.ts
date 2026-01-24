import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { BranchSubmissionsService } from './branch-submissions.service';
import {
  CreateBranchSubmissionDto,
  ReviewBranchSubmissionDto,
  UpdateBranchSubmissionDto,
  QueryBranchSubmissionsDto,
} from './dto';

/**
 * Controller for managing branch submissions in collaborative stories.
 * Handles submission creation, review process, and listing.
 */
@Controller('branch-submissions')
@UseGuards(JwtAuthGuard)
export class BranchSubmissionsController {
  constructor(private readonly submissionsService: BranchSubmissionsService) {}

  /**
   * Submit a new branch for a collaborative story
   * POST /branch-submissions
   */
  @Post()
  async create(
    @Req() req: any,
    @Body() dto: CreateBranchSubmissionDto,
  ) {
    const userId = req.user.id;
    const submission = await this.submissionsService.create(userId, dto);
    return {
      success: true,
      data: submission,
    };
  }

  /**
   * Get a specific submission by ID
   * GET /branch-submissions/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const submission = await this.submissionsService.findOne(id);
    return {
      success: true,
      data: submission,
    };
  }

  /**
   * List submissions with filters
   * GET /branch-submissions
   */
  @Get()
  async findAll(@Query() query: QueryBranchSubmissionsDto) {
    const result = await this.submissionsService.findAll(query);
    return {
      success: true,
      data: result.submissions,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  /**
   * Get pending submissions for a story (for authors/moderators)
   * GET /branch-submissions/story/:storyId/pending
   */
  @Get('story/:storyId/pending')
  async findPendingForStory(@Param('storyId', ParseUUIDPipe) storyId: string) {
    const submissions = await this.submissionsService.findPendingForStory(storyId);
    return {
      success: true,
      data: submissions,
    };
  }

  /**
   * Get submissions by current user
   * GET /branch-submissions/my-submissions
   */
  @Get('my-submissions')
  async findMySubmissions(@Req() req: any) {
    const userId = req.user.id;
    const submissions = await this.submissionsService.findByUser(userId);
    return {
      success: true,
      data: submissions,
    };
  }

  /**
   * Get submission statistics for a story
   * GET /branch-submissions/story/:storyId/stats
   */
  @Get('story/:storyId/stats')
  async getStoryStats(@Param('storyId', ParseUUIDPipe) storyId: string) {
    const stats = await this.submissionsService.getStoryStats(storyId);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Update a submission (by submitter only)
   * PUT /branch-submissions/:id
   */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateBranchSubmissionDto,
  ) {
    const userId = req.user.id;
    const submission = await this.submissionsService.update(id, userId, dto);
    return {
      success: true,
      data: submission,
    };
  }

  /**
   * Review a submission (approve/reject/request revision)
   * POST /branch-submissions/:id/review
   */
  @Post(':id/review')
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: ReviewBranchSubmissionDto,
  ) {
    const reviewerId = req.user.id;
    const submission = await this.submissionsService.review(id, reviewerId, dto);
    return {
      success: true,
      data: submission,
    };
  }

  /**
   * Delete a submission (by submitter only, only if pending)
   * DELETE /branch-submissions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    await this.submissionsService.delete(id, userId);
  }
}
