import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Message, Conversation, UserBlock } from '@/database/entities';
import { SendMessageDto, ConversationQueryDto, MessageQueryDto, BlockUserDto } from './dto';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(UserBlock)
    private readonly userBlockRepository: Repository<UserBlock>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get user's conversations with pagination
   */
  async getConversations(userId: string, query: ConversationQueryDto) {
    const { page = 1, limit: rawLimit = 20, archived = false } = query;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participant1', 'participant1')
      .leftJoinAndSelect('conversation.participant2', 'participant2')
      .where('(conversation.participant1Id = :userId OR conversation.participant2Id = :userId)', { userId });

    // Filter by archived status
    queryBuilder.andWhere(
      '(conversation.participant1Id = :userId AND conversation.isArchived1 = :archived) OR (conversation.participant2Id = :userId AND conversation.isArchived2 = :archived)',
      { userId, archived },
    );

    // Order by most recent message
    queryBuilder.orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST');

    const skip = (page - 1) * limit;
    const [conversations, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Sanitize conversations
    const sanitizedConversations = conversations.map((conv) => this.sanitizeConversation(conv, userId));

    return {
      data: sanitizedConversations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get or create conversation between two users
   */
  async getOrCreateConversation(userId: string, recipientId: string): Promise<Conversation> {
    if (userId === recipientId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    // Check if users have blocked each other
    const isBlocked = await this.isBlocked(userId, recipientId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot create conversation with this user');
    }

    // Try to find existing conversation (order doesn't matter)
    let conversation = await this.conversationRepository
      .createQueryBuilder('conversation')
      .where(
        '(conversation.participant1Id = :userId AND conversation.participant2Id = :recipientId) OR (conversation.participant1Id = :recipientId AND conversation.participant2Id = :userId)',
        { userId, recipientId },
      )
      .getOne();

    if (!conversation) {
      // Create new conversation
      conversation = this.conversationRepository.create({
        participant1Id: userId,
        participant2Id: recipientId,
      });
      conversation = await this.conversationRepository.save(conversation);
    }

    // Load participants
    return this.conversationRepository.findOne({
      where: { id: conversation.id },
      relations: ['participant1', 'participant2'],
    }) as Promise<Conversation>;
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getMessages(userId: string, conversationId: string, query: MessageQueryDto) {
    const { page = 1, limit: rawLimit = 50, before } = query;
    const limit = Math.min(Math.max(1, rawLimit), 100);

    // Verify user is part of conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.isDeleted = :isDeleted', { isDeleted: false });

    if (before) {
      queryBuilder.andWhere('message.createdAt < :before', { before: new Date(before) });
    }

    const skip = (page - 1) * limit;
    const [messages, total] = await queryBuilder
      .orderBy('message.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Reverse to show oldest first
    const sanitizedMessages = messages.reverse().map((msg) => this.sanitizeMessage(msg));

    return {
      data: sanitizedMessages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Send a message
   */
  async sendMessage(userId: string, dto: SendMessageDto): Promise<Message> {
    const { recipientId, content } = dto;

    if (userId === recipientId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    // Check if users have blocked each other
    const isBlocked = await this.isBlocked(userId, recipientId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot send message to this user');
    }

    // Use transaction to ensure consistency
    return this.dataSource.transaction(async (entityManager) => {
      // Get or create conversation
      let conversation = await entityManager
        .getRepository(Conversation)
        .createQueryBuilder('conversation')
        .where(
          '(conversation.participant1Id = :userId AND conversation.participant2Id = :recipientId) OR (conversation.participant1Id = :recipientId AND conversation.participant2Id = :userId)',
          { userId, recipientId },
        )
        .getOne();

      if (!conversation) {
        conversation = entityManager.getRepository(Conversation).create({
          participant1Id: userId,
          participant2Id: recipientId,
        });
        conversation = await entityManager.getRepository(Conversation).save(conversation);
      }

      // Create message
      const message = entityManager.getRepository(Message).create({
        senderId: userId,
        recipientId,
        conversationId: conversation.id,
        content,
      });

      const savedMessage = await entityManager.getRepository(Message).save(message);

      // Update conversation metadata
      conversation.lastMessagePreview = content.substring(0, 100);
      conversation.lastMessageAt = new Date();

      // Increment unread count for recipient
      if (conversation.participant1Id === recipientId) {
        conversation.unreadCount1 += 1;
      } else {
        conversation.unreadCount2 += 1;
      }

      // Unarchive conversation for both users if archived
      conversation.isArchived1 = false;
      conversation.isArchived2 = false;

      await entityManager.getRepository(Conversation).save(conversation);

      // Load sender relation for response
      return entityManager.getRepository(Message).findOne({
        where: { id: savedMessage.id },
        relations: ['sender'],
      }) as Promise<Message>;
    });
  }

  /**
   * Mark messages as read in a conversation
   */
  async markAsRead(userId: string, conversationId: string): Promise<void> {
    // Verify user is part of conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    await this.dataSource.transaction(async (entityManager) => {
      // Mark all unread messages as read
      await entityManager
        .getRepository(Message)
        .createQueryBuilder()
        .update(Message)
        .set({ isRead: true, readAt: new Date() })
        .where('conversationId = :conversationId', { conversationId })
        .andWhere('recipientId = :userId', { userId })
        .andWhere('isRead = :isRead', { isRead: false })
        .execute();

      // Reset unread count for the user
      if (conversation.participant1Id === userId) {
        conversation.unreadCount1 = 0;
      } else {
        conversation.unreadCount2 = 0;
      }

      await entityManager.getRepository(Conversation).save(conversation);
    });
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Message is already deleted');
    }

    // Soft delete
    message.isDeleted = true;
    message.content = '[deleted]';
    await this.messageRepository.save(message);
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    // Archive for the current user
    if (conversation.participant1Id === userId) {
      conversation.isArchived1 = true;
    } else {
      conversation.isArchived2 = true;
    }

    await this.conversationRepository.save(conversation);
  }

  /**
   * Block a user
   */
  async blockUser(userId: string, dto: BlockUserDto): Promise<void> {
    const { userId: blockedId, reason } = dto;

    if (userId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    // Check if already blocked
    const existingBlock = await this.userBlockRepository.findOne({
      where: { blockerId: userId, blockedId },
    });

    if (existingBlock) {
      throw new BadRequestException('User is already blocked');
    }

    // Create block
    const block = this.userBlockRepository.create({
      blockerId: userId,
      blockedId,
      reason: reason || null,
    });

    await this.userBlockRepository.save(block);

    // Mark all conversations with this user as blocked
    await this.conversationRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({ isBlocked1: true })
      .where('participant1Id = :userId AND participant2Id = :blockedId', { userId, blockedId })
      .execute();

    await this.conversationRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({ isBlocked2: true })
      .where('participant2Id = :userId AND participant1Id = :blockedId', { userId, blockedId })
      .execute();
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string, blockedId: string): Promise<void> {
    if (userId === blockedId) {
      throw new BadRequestException('Invalid operation');
    }

    const block = await this.userBlockRepository.findOne({
      where: { blockerId: userId, blockedId },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    await this.userBlockRepository.remove(block);

    // Unmark conversations with this user as blocked
    await this.conversationRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({ isBlocked1: false })
      .where('participant1Id = :userId AND participant2Id = :blockedId', { userId, blockedId })
      .execute();

    await this.conversationRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({ isBlocked2: false })
      .where('participant2Id = :userId AND participant1Id = :blockedId', { userId, blockedId })
      .execute();
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(userId: string) {
    const blocks = await this.userBlockRepository.find({
      where: { blockerId: userId },
      relations: ['blocked'],
      order: { createdAt: 'DESC' },
    });

    return blocks.map((block) => ({
      id: block.id,
      blockedUser: {
        id: block.blocked.id,
        username: block.blocked.username,
        displayName: block.blocked.displayName,
        avatarUrl: block.blocked.avatarUrl,
      },
      reason: block.reason,
      createdAt: block.createdAt,
    }));
  }

  /**
   * Check if users have blocked each other
   */
  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.userBlockRepository
      .createQueryBuilder('block')
      .where(
        '(block.blockerId = :userId1 AND block.blockedId = :userId2) OR (block.blockerId = :userId2 AND block.blockedId = :userId1)',
        { userId1, userId2 },
      )
      .getOne();

    return !!block;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private sanitizeConversation(conversation: Conversation, currentUserId: string) {
    // Determine the other participant
    const otherParticipant =
      conversation.participant1Id === currentUserId
        ? conversation.participant2
        : conversation.participant1;

    // Get unread count for current user
    const unreadCount =
      conversation.participant1Id === currentUserId
        ? conversation.unreadCount1
        : conversation.unreadCount2;

    // Check if blocked
    const isBlocked =
      conversation.participant1Id === currentUserId
        ? conversation.isBlocked1
        : conversation.isBlocked2;

    return {
      id: conversation.id,
      otherParticipant: {
        id: otherParticipant.id,
        username: otherParticipant.username,
        displayName: otherParticipant.displayName,
        avatarUrl: otherParticipant.avatarUrl,
      },
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      isBlocked,
      createdAt: conversation.createdAt,
    };
  }

  private sanitizeMessage(message: Message) {
    return {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      conversationId: message.conversationId,
      content: message.content,
      isRead: message.isRead,
      readAt: message.readAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            username: message.sender.username,
            displayName: message.sender.displayName,
            avatarUrl: message.sender.avatarUrl,
          }
        : undefined,
      createdAt: message.createdAt,
    };
  }
}
