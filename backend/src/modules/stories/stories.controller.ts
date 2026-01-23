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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { StoriesService } from './stories.service';
import { RecommendationService } from './recommendation.service';
import { CreateStoryDto, UpdateStoryDto, StoryQueryParams, UserRole } from '@aardvark/shared';

/**
 * Controller for story CRUD operations and queries.
 */
@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly recommendationService: RecommendationService,
  ) {}

  /**
   * Create a new story
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new story' })
  create(
    @Request() req: { user: { userId: string } },
    @Body() createDto: CreateStoryDto,
  ) {
    return this.storiesService.create(req.user.userId, createDto);
  }

  /**
   * Get all stories with filtering and pagination
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get stories with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  findAll(@Query() query: StoryQueryParams) {
    return this.storiesService.findAll(query);
  }

  /**
   * Get featured stories
   */
  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Get featured stories' })
  findFeatured(@Query('limit') limit?: number) {
    return this.storiesService.findFeatured(limit);
  }

  /**
   * Get trending stories
   */
  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Get trending stories' })
  findTrending(@Query('limit') limit?: number) {
    return this.storiesService.findTrending(limit);
  }

  /**
   * Get popular stories (all-time)
   */
  @Get('popular')
  @Public()
  @ApiOperation({ summary: 'Get popular stories' })
  findPopular(@Query('limit') limit?: number) {
    return this.recommendationService.getPopularStories(limit || 10);
  }

  /**
   * Get personalized recommendations for authenticated user
   */
  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get personalized story recommendations' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecommendations(
    @Request() req: { user: { userId: string } },
    @Query('limit') limit?: number,
  ) {
    return this.recommendationService.getRecommendations(req.user.userId, limit || 10);
  }

  /**
   * Get stories from followed authors
   */
  @Get('following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get stories from followed authors' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFollowingStories(
    @Request() req: { user: { userId: string } },
    @Query('limit') limit?: number,
  ) {
    return this.recommendationService.getStoriesFromFollowedAuthors(req.user.userId, limit || 10);
  }

  /**
   * Get similar stories to a given story
   */
  @Get(':id/similar')
  @Public()
  @ApiOperation({ summary: 'Get similar stories' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSimilarStories(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.recommendationService.getSimilarStories(id, limit || 5);
  }

  /**
   * Record a user interaction for recommendation refinement
   */
  @Post(':id/interact')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Record story interaction for recommendations' })
  async recordInteraction(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() body: { type: 'view' | 'read' | 'rate' | 'bookmark' },
  ) {
    await this.recommendationService.recordInteraction(req.user.userId, id, body.type);
    return { success: true };
  }

  /**
   * Get a single story by ID
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get story by ID' })
  findOne(@Param('id') id: string) {
    return this.storiesService.findOne(id);
  }

  /**
   * Update a story
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a story' })
  update(
    @Param('id') id: string,
    @Request() req: { user: { userId: string; role: UserRole } },
    @Body() updateDto: UpdateStoryDto,
  ) {
    return this.storiesService.update(
      id,
      req.user.userId,
      req.user.role,
      updateDto,
    );
  }

  /**
   * Delete a story
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a story' })
  remove(
    @Param('id') id: string,
    @Request() req: { user: { userId: string; role: UserRole } },
  ) {
    return this.storiesService.remove(id, req.user.userId, req.user.role);
  }

  /**
   * Publish a story
   */
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Publish a story' })
  publish(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.storiesService.publish(id, req.user.userId);
  }

  /**
   * Get published story slugs for sitemap generation
   */
  @Get('sitemap')
  @Public()
  @ApiOperation({ summary: 'Get story slugs for sitemap' })
  async getSitemapData() {
    return this.storiesService.getSitemapData();
  }
}
