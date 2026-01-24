import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * WebSocket gateway for real-time notifications
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userConnections: Map<string, Set<string>> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Handle new client connections
   */
  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub || payload.id;

      if (!userId) {
        this.logger.warn(`Client ${client.id} has invalid token payload`);
        client.disconnect();
        return;
      }

      // Store user ID in client data
      client.data.userId = userId;

      // Track connection
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(client.id);

      this.logger.log(
        `User ${userId} connected with socket ${client.id} (${this.userConnections.get(userId)!.size} active connections)`,
      );

      // Join user to their personal room
      client.join(`user:${userId}`);

      // Send connection confirmation
      client.emit('connected', { userId, socketId: client.id });
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      // Remove connection tracking
      const userSockets = this.userConnections.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userConnections.delete(userId);
          this.logger.log(`User ${userId} has no more active connections`);
        } else {
          this.logger.log(
            `User ${userId} disconnected socket ${client.id} (${userSockets.size} remaining)`,
          );
        }
      }
    }

    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: string, event: string, data: any): void {
    const userSockets = this.userConnections.get(userId);

    if (!userSockets || userSockets.size === 0) {
      this.logger.debug(`User ${userId} has no active connections, skipping real-time notification`);
      return;
    }

    // Send to user's room
    this.server.to(`user:${userId}`).emit(event, data);

    this.logger.debug(
      `Sent ${event} to user ${userId} (${userSockets.size} active connections)`,
    );
  }

  /**
   * Handle ping/pong for connection health check
   */
  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    return 'pong';
  }

  /**
   * Get active connection count for a user
   */
  getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size || 0;
  }

  /**
   * Get total active connections
   */
  getTotalConnections(): number {
    let total = 0;
    for (const sockets of this.userConnections.values()) {
      total += sockets.size;
    }
    return total;
  }
}
