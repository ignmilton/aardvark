import { Injectable } from '@nestjs/common';

/**
 * Service to track blacklisted JWT tokens.
 * Tokens are stored in memory with automatic cleanup based on expiry.
 * In a multi-instance production deployment, this should use Redis instead.
 */
@Injectable()
export class TokenBlacklistService {
  private readonly blacklist = new Map<string, number>(); // token -> expiryTimestamp
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Add a token to the blacklist.
   * @param token - The JWT token string
   * @param expiresInSeconds - Seconds until the token expires naturally
   */
  blacklist_token(token: string, expiresInSeconds: number): void {
    const expiryTimestamp = Date.now() + expiresInSeconds * 1000;
    this.blacklist.set(token, expiryTimestamp);
  }

  /**
   * Check if a token is blacklisted.
   */
  isBlacklisted(token: string): boolean {
    const expiry = this.blacklist.get(token);
    if (!expiry) return false;

    // If token has expired naturally, remove from blacklist
    if (Date.now() > expiry) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Remove expired entries from the blacklist.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [token, expiry] of this.blacklist.entries()) {
      if (now > expiry) {
        this.blacklist.delete(token);
      }
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
