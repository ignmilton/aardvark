import { Module, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { redisStore } from "cache-manager-redis-yet";

/**
 * Global cache module with Redis support.
 * Falls back to in-memory cache if Redis is not configured.
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>("REDIS_HOST");
        const redisPort = configService.get<number>("REDIS_PORT", 6379);

        // Use Redis if configured, otherwise use in-memory cache
        if (redisHost) {
          return {
            store: await redisStore({
              socket: {
                host: redisHost,
                port: redisPort,
              },
              password: configService.get<string>("REDIS_PASSWORD"),
              ttl: 60 * 1000, // Default TTL: 60 seconds
            }),
          };
        }

        // Fallback to in-memory cache for development
        return {
          ttl: 60 * 1000,
        };
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
