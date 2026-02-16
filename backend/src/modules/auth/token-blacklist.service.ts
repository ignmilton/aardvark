import { Injectable, Inject, Logger } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { createHash } from "crypto";

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
   * Uses SHA-256 to prevent collisions and avoid leaking token data.
   */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
