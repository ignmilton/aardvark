import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

/**
 * TypeORM database configuration factory.
 * Configures connection pooling, logging, and entity loading.
 */
export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get("NODE_ENV") === "production";

  return {
    type: "postgres",
    host: configService.get("database.host"),
    port: configService.get("database.port"),
    username: configService.get("database.username"),
    password: configService.get("database.password"),
    database: configService.get("database.database"),

    // Entity loading - auto-load all entities from modules
    autoLoadEntities: true,

    // Schema synchronization - disabled due to TypeORM sync bug
    synchronize: false,

    // Logging configuration
    logging: isProduction ? ["error", "warn"] : ["error", "warn", "query"],
    logger: "advanced-console",

    // Connection pool settings
    extra: {
      min: configService.get("database.poolMin", 2),
      max: configService.get("database.poolMax", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },

    // SSL configuration for production
    ssl: isProduction
      ? {
          rejectUnauthorized:
            configService.get("DB_SSL_REJECT_UNAUTHORIZED", "true") !== "false",
          ca: configService.get("DB_SSL_CA") || undefined,
        }
      : false,

    // Retry configuration
    retryAttempts: 3,
    retryDelay: 1000,

    // Cache configuration (TypeORM query cache)
    // Uses Redis when available for better performance; falls back to database cache.
    cache: configService.get("redis.host")
      ? {
          type: "ioredis",
          options: {
            host: configService.get("redis.host"),
            port: configService.get<number>("redis.port", 6379),
            password: configService.get("redis.password") || undefined,
            db: 1, // Separate Redis DB from app cache (DB 0)
          },
          duration: 30000, // 30 seconds
        }
      : {
          type: "database" as const,
          tableName: "query_result_cache",
          duration: 30000,
        },
  };
};
