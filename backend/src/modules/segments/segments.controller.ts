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
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { SegmentsService } from "./segments.service";
import {
  CreateSegmentDto,
  UpdateSegmentDto,
  BulkUpdatePositionsDto,
} from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "@/modules/auth/guards/optional-jwt-auth.guard";

@ApiTags("segments")
@Controller("segments")
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new story segment" })
  @ApiResponse({ status: 201, description: "Segment created successfully" })
  @ApiResponse({ status: 403, description: "Not allowed to create segment" })
  @ApiResponse({ status: 404, description: "Story not found" })
  async create(@Body() createDto: CreateSegmentDto, @Request() req: any) {
    return this.segmentsService.create(createDto, req.user.id);
  }

  @Get("story/:storyId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all segments for a story (editor)" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "List of segments" })
  async findByStory(
    @Param("storyId") storyId: string,
    @Query("includeUnapproved") includeUnapproved?: boolean,
  ) {
    return this.segmentsService.findByStory(storyId, includeUnapproved);
  }

  @Get("story/:storyId/structure")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get full story structure for visual editor" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({
    status: 200,
    description: "Story structure with segments and choices",
  })
  async getStoryStructure(@Param("storyId") storyId: string) {
    return this.segmentsService.getStoryStructure(storyId);
  }

  @Get("story/:storyId/pending")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get pending segments for review" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "List of pending segments" })
  async getPendingSegments(@Param("storyId") storyId: string) {
    return this.segmentsService.getPendingSegments(storyId);
  }

  @Put("story/:storyId/positions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bulk update segment positions (visual editor)" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Positions updated" })
  async bulkUpdatePositions(
    @Param("storyId") storyId: string,
    @Body() dto: BulkUpdatePositionsDto,
    @Request() req: any,
  ) {
    await this.segmentsService.bulkUpdatePositions(storyId, dto, req.user.id);
    return { message: "Positions updated successfully" };
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get segment by ID" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiResponse({ status: 200, description: "Segment details" })
  @ApiResponse({
    status: 403,
    description: "Registration required to continue reading",
  })
  @ApiResponse({ status: 404, description: "Segment not found" })
  async findById(@Param("id") id: string, @Request() req: any) {
    const segment = await this.segmentsService.findById(id);

    // Guest users can only read the root segment (first chapter)
    if (!req.user && !segment.isRootSegment) {
      throw new ForbiddenException(
        "Please register or log in to continue reading beyond the first chapter.",
      );
    }

    return segment;
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a segment" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiResponse({ status: 200, description: "Segment updated" })
  @ApiResponse({ status: 403, description: "Not allowed to edit segment" })
  @ApiResponse({ status: 404, description: "Segment not found" })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateSegmentDto,
    @Request() req: any,
  ) {
    return this.segmentsService.update(id, updateDto, req.user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a segment" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiResponse({ status: 204, description: "Segment deleted" })
  @ApiResponse({ status: 403, description: "Not allowed to delete segment" })
  @ApiResponse({ status: 404, description: "Segment not found" })
  async delete(@Param("id") id: string, @Request() req: any) {
    await this.segmentsService.delete(id, req.user.id);
  }

  @Post(":id/parents/:parentId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add a parent connection to a segment" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiParam({ name: "parentId", description: "Parent segment ID" })
  @ApiResponse({ status: 200, description: "Connection added" })
  @ApiResponse({ status: 400, description: "Would create cycle" })
  async addParentConnection(
    @Param("id") id: string,
    @Param("parentId") parentId: string,
    @Request() req: any,
  ) {
    return this.segmentsService.addParentConnection(id, parentId, req.user.id);
  }

  @Delete(":id/parents/:parentId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove a parent connection from a segment" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiParam({ name: "parentId", description: "Parent segment ID" })
  @ApiResponse({ status: 200, description: "Connection removed" })
  async removeParentConnection(
    @Param("id") id: string,
    @Param("parentId") parentId: string,
    @Request() req: any,
  ) {
    return this.segmentsService.removeParentConnection(
      id,
      parentId,
      req.user.id,
    );
  }

  @Post(":id/approve")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve a pending segment" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiResponse({ status: 200, description: "Segment approved" })
  @ApiResponse({ status: 403, description: "Not authorized to approve" })
  async approveSegment(@Param("id") id: string, @Request() req: any) {
    return this.segmentsService.approveSegment(id, req.user.id);
  }

  @Post(":id/reject")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject a pending segment" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiResponse({ status: 200, description: "Segment rejected" })
  @ApiResponse({ status: 403, description: "Not authorized to reject" })
  async rejectSegment(
    @Param("id") id: string,
    @Body("reason") reason: string,
    @Request() req: any,
  ) {
    return this.segmentsService.rejectSegment(id, req.user.id, reason);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Increment segment read count" })
  @ApiParam({ name: "id", description: "Segment ID" })
  @ApiResponse({ status: 200, description: "Read count incremented" })
  async incrementReadCount(@Param("id") id: string) {
    await this.segmentsService.incrementReadCount(id);
    return { message: "Read count incremented" };
  }
}
