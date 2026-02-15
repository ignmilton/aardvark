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
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/modules/auth/guards/roles.guard";
import { Roles } from "@/modules/auth/decorators/roles.decorator";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { UserRole } from "@aardvark/shared";
import { FeaturedService } from "./featured.service";
import {
  CreateFeaturedContentDto,
  UpdateFeaturedContentDto,
  FeaturedQueryDto,
} from "./dto";
import { FeaturedPlacement } from "@/database/entities/featured-content.entity";

/**
 * Controller for managing featured/editorial content.
 * Public endpoints for fetching active featured content.
 * Admin endpoints for CRUD operations.
 */
@ApiTags("featured")
@Controller("featured")
export class FeaturedController {
  constructor(private readonly featuredService: FeaturedService) {}

  /**
   * Get currently active featured content (public)
   */
  @Get()
  @Public()
  @ApiOperation({ summary: "Get active featured content" })
  @ApiQuery({ name: "placement", required: false, enum: FeaturedPlacement })
  @ApiResponse({ status: 200, description: "Featured content retrieved" })
  async getActive(@Query("placement") placement?: FeaturedPlacement) {
    return this.featuredService.getActive(placement);
  }

  /**
   * Get featured content for homepage hero
   */
  @Get("hero")
  @Public()
  @ApiOperation({ summary: "Get homepage hero featured content" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Hero content retrieved" })
  async getHero(@Query("limit") limit?: number) {
    return this.featuredService.getByPlacement(
      FeaturedPlacement.HOMEPAGE_HERO,
      limit || 1,
    );
  }

  /**
   * Get featured content for carousel
   */
  @Get("carousel")
  @Public()
  @ApiOperation({ summary: "Get homepage carousel featured content" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Carousel content retrieved" })
  async getCarousel(@Query("limit") limit?: number) {
    return this.featuredService.getByPlacement(
      FeaturedPlacement.HOMEPAGE_CAROUSEL,
      limit || 10,
    );
  }

  /**
   * Get all featured content (admin)
   */
  @Get("all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all featured content (admin)" })
  @ApiResponse({ status: 200, description: "All featured content retrieved" })
  async findAll(@Query() query: FeaturedQueryDto) {
    return this.featuredService.findAll(query);
  }

  /**
   * Get featured content by ID (admin)
   */
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get featured content by ID (admin)" })
  @ApiParam({ name: "id", description: "Featured content ID" })
  @ApiResponse({ status: 200, description: "Featured content retrieved" })
  @ApiResponse({ status: 404, description: "Not found" })
  async findOne(@Param("id") id: string) {
    return this.featuredService.findOne(id);
  }

  /**
   * Create new featured content (admin)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create featured content (admin)" })
  @ApiResponse({ status: 201, description: "Featured content created" })
  @ApiResponse({ status: 400, description: "Invalid input" })
  async create(@Request() req: any, @Body() dto: CreateFeaturedContentDto) {
    return this.featuredService.create(req.user.id, dto);
  }

  /**
   * Update featured content (admin)
   */
  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update featured content (admin)" })
  @ApiParam({ name: "id", description: "Featured content ID" })
  @ApiResponse({ status: 200, description: "Featured content updated" })
  @ApiResponse({ status: 404, description: "Not found" })
  async update(@Param("id") id: string, @Body() dto: UpdateFeaturedContentDto) {
    return this.featuredService.update(id, dto);
  }

  /**
   * Delete featured content (admin)
   */
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete featured content (admin only)" })
  @ApiParam({ name: "id", description: "Featured content ID" })
  @ApiResponse({ status: 204, description: "Featured content deleted" })
  @ApiResponse({ status: 404, description: "Not found" })
  async delete(@Param("id") id: string) {
    await this.featuredService.delete(id);
  }

  /**
   * Toggle active status (admin)
   */
  @Post(":id/toggle")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Toggle featured content active status (admin)" })
  @ApiParam({ name: "id", description: "Featured content ID" })
  @ApiResponse({ status: 200, description: "Status toggled" })
  @ApiResponse({ status: 404, description: "Not found" })
  async toggleActive(@Param("id") id: string) {
    return this.featuredService.toggleActive(id);
  }
}
