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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChoicesService } from './choices.service';
import { CreateChoiceDto, UpdateChoiceDto, ReorderChoicesDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@ApiTags('choices')
@Controller('choices')
export class ChoicesController {
  constructor(private readonly choicesService: ChoicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new choice' })
  @ApiResponse({ status: 201, description: 'Choice created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or would create cycle' })
  @ApiResponse({ status: 403, description: 'Not allowed to create choice' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async create(@Body() createDto: CreateChoiceDto, @Request() req: any) {
    return this.choicesService.create(createDto, req.user.id);
  }

  @Get('segment/:segmentId')
  @ApiOperation({ summary: 'Get all choices for a segment' })
  @ApiParam({ name: 'segmentId', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'List of choices' })
  async findBySegment(@Param('segmentId') segmentId: string) {
    return this.choicesService.findBySegment(segmentId);
  }

  @Get('segment/:segmentId/available')
  @ApiOperation({ summary: 'Get available choices based on reader state' })
  @ApiParam({ name: 'segmentId', description: 'Segment ID' })
  @ApiQuery({ name: 'state', required: false, description: 'JSON string of reader state' })
  @ApiQuery({ name: 'visited', required: false, description: 'Comma-separated visited segment IDs' })
  @ApiResponse({ status: 200, description: 'Available choices for reader' })
  async getAvailableChoices(
    @Param('segmentId') segmentId: string,
    @Query('state') stateJson?: string,
    @Query('visited') visitedStr?: string,
  ) {
    let state: Record<string, any> = {};
    if (stateJson) {
      try {
        state = JSON.parse(stateJson);
      } catch {
        // Invalid JSON, use empty state
      }
    }
    const visited = visitedStr ? visitedStr.split(',') : [];
    return this.choicesService.getAvailableChoices(segmentId, state, visited);
  }

  @Get('segment/:segmentId/stats')
  @ApiOperation({ summary: 'Get choice statistics for a segment' })
  @ApiParam({ name: 'segmentId', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Choice statistics' })
  async getChoiceStats(@Param('segmentId') segmentId: string) {
    return this.choicesService.getChoiceStats(segmentId);
  }

  @Put('segment/:segmentId/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder choices within a segment' })
  @ApiParam({ name: 'segmentId', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Choices reordered' })
  async reorderChoices(
    @Param('segmentId') segmentId: string,
    @Body() dto: ReorderChoicesDto,
    @Request() req: any,
  ) {
    return this.choicesService.reorderChoices(segmentId, dto, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get choice by ID' })
  @ApiParam({ name: 'id', description: 'Choice ID' })
  @ApiResponse({ status: 200, description: 'Choice details' })
  @ApiResponse({ status: 404, description: 'Choice not found' })
  async findById(@Param('id') id: string) {
    return this.choicesService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a choice' })
  @ApiParam({ name: 'id', description: 'Choice ID' })
  @ApiResponse({ status: 200, description: 'Choice updated' })
  @ApiResponse({ status: 400, description: 'Invalid update' })
  @ApiResponse({ status: 403, description: 'Not allowed to edit' })
  @ApiResponse({ status: 404, description: 'Choice not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateChoiceDto,
    @Request() req: any,
  ) {
    return this.choicesService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a choice' })
  @ApiParam({ name: 'id', description: 'Choice ID' })
  @ApiResponse({ status: 204, description: 'Choice deleted' })
  @ApiResponse({ status: 403, description: 'Not allowed to delete' })
  @ApiResponse({ status: 404, description: 'Choice not found' })
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.choicesService.delete(id, req.user.id);
  }

  @Post(':id/chosen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record that a choice was selected' })
  @ApiParam({ name: 'id', description: 'Choice ID' })
  @ApiResponse({ status: 200, description: 'Choice recorded' })
  async recordChoice(@Param('id') id: string) {
    await this.choicesService.incrementTimesChosen(id);
    return { message: 'Choice recorded' };
  }
}
