import {
  Controller,
  Get,
  Put,
  Post,
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
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UserQueryDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search users' })
  @ApiResponse({ status: 200, description: 'List of users with pagination' })
  async searchUsers(@Query() query: UserQueryDto) {
    return this.usersService.searchUsers(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  async getCurrentUser(@Request() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Updated user data' })
  async updateCurrentUser(@Request() req: any, @Body() updateDto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.id, updateDto);
  }

  @Get('me/followers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user followers' })
  @ApiResponse({ status: 200, description: 'List of followers' })
  async getMyFollowers(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getFollowers(req.user.id, +page, +limit);
  }

  @Get('me/following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get users current user is following' })
  @ApiResponse({ status: 200, description: 'List of following users' })
  async getMyFollowing(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getFollowing(req.user.id, +page, +limit);
  }

  @Get('me/stories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user stories' })
  @ApiResponse({ status: 200, description: 'List of user stories' })
  async getMyStories(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sortBy') sortBy: 'createdAt' | 'updatedAt' | 'viewCount' = 'updatedAt',
    @Query('status') status?: 'draft' | 'published',
  ) {
    return this.usersService.getUserStories(req.user.id, +page, +limit, sortBy, status);
  }

  @Post('me/upgrade-to-author')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade current user to author role' })
  @ApiResponse({ status: 200, description: 'User upgraded to author' })
  async upgradeToAuthor(@Request() req: any) {
    return this.usersService.upgradeToAuthor(req.user.id);
  }

  @Get('me/data-export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'GDPR: Export all personal data' })
  @ApiResponse({ status: 200, description: 'Complete user data export in JSON format' })
  async exportData(@Request() req: any) {
    return this.usersService.exportUserData(req.user.userId);
  }

  @Delete('me/account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'GDPR: Delete account and all associated data' })
  @ApiResponse({ status: 204, description: 'Account deleted successfully' })
  async deleteAccount(@Request() req: any) {
    await this.usersService.deleteAccount(req.user.userId);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get user profile by username' })
  @ApiParam({ name: 'username', description: 'Username' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Param('username') username: string, @Request() req: any) {
    const currentUserId = req.user?.id;
    return this.usersService.getProfile(username, currentUserId);
  }

  @Get(':username/followers')
  @ApiOperation({ summary: 'Get user followers' })
  @ApiParam({ name: 'username', description: 'Username' })
  @ApiResponse({ status: 200, description: 'List of followers' })
  async getFollowers(
    @Param('username') username: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const user = await this.usersService.findByUsername(username);
    return this.usersService.getFollowers(user.id, +page, +limit);
  }

  @Get(':username/following')
  @ApiOperation({ summary: 'Get users that a user is following' })
  @ApiParam({ name: 'username', description: 'Username' })
  @ApiResponse({ status: 200, description: 'List of following users' })
  async getFollowing(
    @Param('username') username: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const user = await this.usersService.findByUsername(username);
    return this.usersService.getFollowing(user.id, +page, +limit);
  }

  @Post(':username/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  @ApiParam({ name: 'username', description: 'Username to follow' })
  @ApiResponse({ status: 200, description: 'Successfully followed user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Already following this user' })
  async followUser(@Param('username') username: string, @Request() req: any) {
    const targetUser = await this.usersService.findByUsername(username);
    await this.usersService.followUser(req.user.id, targetUser.id);
    return { message: 'Successfully followed user' };
  }

  @Delete(':username/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiParam({ name: 'username', description: 'Username to unfollow' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed user' })
  @ApiResponse({ status: 404, description: 'Not following this user' })
  async unfollowUser(@Param('username') username: string, @Request() req: any) {
    const targetUser = await this.usersService.findByUsername(username);
    await this.usersService.unfollowUser(req.user.id, targetUser.id);
    return { message: 'Successfully unfollowed user' };
  }

  @Get(':username/is-following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user is following a user' })
  @ApiParam({ name: 'username', description: 'Username to check' })
  @ApiResponse({ status: 200, description: 'Following status' })
  async isFollowing(@Param('username') username: string, @Request() req: any) {
    const targetUser = await this.usersService.findByUsername(username);
    const isFollowing = await this.usersService.isFollowing(req.user.id, targetUser.id);
    return { isFollowing };
  }
}
