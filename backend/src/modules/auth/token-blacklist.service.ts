import { Injectable, Inject, Logger } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

/**
 * Service to track blacklisted JWT tokens.
 * Uses the application cache (Redis when configured, in-memory fallback)
 * so token invalidation works across multiple server instances.
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private static readonly PREFIX = "token_blacklist:";

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Add a token to the blacklist.
   * @param token - The JWT token string
   * @param expiresInSeconds - Seconds until the token expires naturally
   */
  async blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
    const key = TokenBlacklistService.PREFIX + this.hashToken(token);
    const ttlMs = expiresInSeconds * 1000;
    await this.cacheManager.set(key, 1, ttlMs);
  }

  /**
   * Check if a token is blacklisted.
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const key = TokenBlacklistService.PREFIX + this.hashToken(token);
    const value = await this.cacheManager.get(key);
    return value !== null && value !== undefined;
  }

  /**
   * Hash a token to avoid storing raw JWTs in cache keys.
   * Uses a simple hash; the full token is never stored.
   */
  private hashToken(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    // Also include last 16 chars for uniqueness
    return `${hash.toString(36)}_${token.slice(-16)}`;
  }
}
