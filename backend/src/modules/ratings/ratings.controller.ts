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
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { RatingsService } from "./ratings.service";
import { CreateRatingDto, UpdateRatingDto, RatingQueryDto } from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";

@ApiTags("ratings")
@Controller("ratings")
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new rating/review" })
  @ApiResponse({ status: 201, description: "Rating created" })
  @ApiResponse({ status: 404, description: "Story not found" })
  @ApiResponse({ status: 409, description: "Already rated this story" })
  async create(@Body() createDto: CreateRatingDto, @Request() req: AuthenticatedRequest) {
    return this.ratingsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Get ratings with pagination" })
  @ApiResponse({ status: 200, description: "List of ratings" })
  async findAll(@Query() query: RatingQueryDto) {
    return this.ratingsService.findAll(query);
  }

  @Get("story/:storyId/distribution")
  @ApiOperation({ summary: "Get rating distribution for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Rating distribution" })
  async getRatingDistribution(@Param("storyId") storyId: string) {
    return this.ratingsService.getRatingDistribution(storyId);
  }

  @Get("story/:storyId/featured")
  @ApiOperation({ summary: "Get featured reviews for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Featured reviews" })
  async getFeaturedReviews(
    @Param("storyId") storyId: string,
    @Query("limit") limit = 3,
  ) {
    return this.ratingsService.getFeaturedReviews(storyId, +limit);
  }

  @Get("story/:storyId/my-rating")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user rating for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "User rating or null" })
  async getUserRating(@Param("storyId") storyId: string, @Request() req: AuthenticatedRequest) {
    const rating = await this.ratingsService.getUserRating(
      storyId,
      req.user.id,
    );
    return { rating };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get rating by ID" })
  @ApiParam({ name: "id", description: "Rating ID" })
  @ApiResponse({ status: 200, description: "Rating details" })
  @ApiResponse({ status: 404, description: "Rating not found" })
  async findById(@Param("id") id: string) {
    return this.ratingsService.findById(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a rating" })
  @ApiParam({ name: "id", description: "Rating ID" })
  @ApiResponse({ status: 200, description: "Rating updated" })
  @ApiResponse({ status: 403, description: "Not authorized to edit" })
  @ApiResponse({ status: 404, description: "Rating not found" })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateRatingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ratingsService.update(id, updateDto, req.user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a rating" })
  @ApiParam({ name: "id", description: "Rating ID" })
  @ApiResponse({ status: 204, description: "Rating deleted" })
  @ApiResponse({ status: 403, description: "Not authorized to delete" })
  @ApiResponse({ status: 404, description: "Rating not found" })
  async delete(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.ratingsService.delete(id, req.user.id);
  }

  @Post(":id/helpful")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a review as helpful" })
  @ApiParam({ name: "id", description: "Rating ID" })
  @ApiResponse({ status: 200, description: "Marked as helpful" })
  async markHelpful(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.ratingsService.markHelpful(id, req.user.id);
    return { message: "Marked as helpful" };
  }
}
