import {
  Controller,
  Get,
  Post,
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
import { MessagingService } from "./messaging.service";
import {
  SendMessageDto,
  ConversationQueryDto,
  MessageQueryDto,
  BlockUserDto,
} from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";

@ApiTags("messages")
@Controller("messages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get("conversations")
  @ApiOperation({ summary: "Get user conversations with pagination" })
  @ApiResponse({ status: 200, description: "List of conversations" })
  async getConversations(
    @Query() query: ConversationQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingService.getConversations(req.user.id, query);
  }

  @Get("conversations/:id")
  @ApiOperation({ summary: "Get conversation with messages" })
  @ApiParam({ name: "id", description: "Conversation ID" })
  @ApiResponse({ status: 200, description: "Conversation messages" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({
    status: 403,
    description: "Not authorized to access this conversation",
  })
  async getConversationMessages(
    @Param("id") conversationId: string,
    @Query() query: MessageQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingService.getMessages(
      req.user.id,
      conversationId,
      query,
    );
  }

  @Post("send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a message to a user" })
  @ApiResponse({ status: 200, description: "Message sent successfully" })
  @ApiResponse({ status: 400, description: "Invalid request" })
  @ApiResponse({ status: 403, description: "Cannot send message to this user" })
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingService.sendMessage(req.user.id, sendMessageDto);
  }

  @Post("conversations/:id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all messages in a conversation as read" })
  @ApiParam({ name: "id", description: "Conversation ID" })
  @ApiResponse({ status: 200, description: "Messages marked as read" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  async markAsRead(@Param("id") conversationId: string, @Request() req: AuthenticatedRequest) {
    await this.messagingService.markAsRead(req.user.id, conversationId);
    return { message: "Messages marked as read" };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a message" })
  @ApiParam({ name: "id", description: "Message ID" })
  @ApiResponse({ status: 204, description: "Message deleted" })
  @ApiResponse({ status: 404, description: "Message not found" })
  @ApiResponse({
    status: 403,
    description: "Not authorized to delete this message",
  })
  async deleteMessage(@Param("id") messageId: string, @Request() req: AuthenticatedRequest) {
    await this.messagingService.deleteMessage(req.user.id, messageId);
  }

  @Post("conversations/:id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a conversation" })
  @ApiParam({ name: "id", description: "Conversation ID" })
  @ApiResponse({ status: 200, description: "Conversation archived" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  async archiveConversation(
    @Param("id") conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.messagingService.archiveConversation(
      req.user.id,
      conversationId,
    );
    return { message: "Conversation archived" };
  }

  @Post("block")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Block a user" })
  @ApiResponse({ status: 200, description: "User blocked" })
  @ApiResponse({ status: 400, description: "User already blocked" })
  async blockUser(@Body() blockUserDto: BlockUserDto, @Request() req: AuthenticatedRequest) {
    await this.messagingService.blockUser(req.user.id, blockUserDto);
    return { message: "User blocked successfully" };
  }

  @Delete("block/:userId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unblock a user" })
  @ApiParam({ name: "userId", description: "Blocked user ID" })
  @ApiResponse({ status: 200, description: "User unblocked" })
  @ApiResponse({ status: 404, description: "Block not found" })
  async unblockUser(@Param("userId") blockedId: string, @Request() req: AuthenticatedRequest) {
    await this.messagingService.unblockUser(req.user.id, blockedId);
    return { message: "User unblocked successfully" };
  }

  @Get("blocked")
  @ApiOperation({ summary: "Get list of blocked users" })
  @ApiResponse({ status: 200, description: "List of blocked users" })
  async getBlockedUsers(@Request() req: AuthenticatedRequest) {
    return this.messagingService.getBlockedUsers(req.user.id);
  }
}
