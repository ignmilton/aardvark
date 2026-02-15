import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * TypeORM CLI DataSource configuration.
 * Used for generating and running migrations via:
 *   npm run migration:generate -- -n MigrationName
 *   npm run migration:run
 *   npm run migration:revert
 */
export default new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "aardvark",
  password: process.env.DATABASE_PASSWORD || "aardvark_dev_password",
  database: process.env.DATABASE_NAME || "aardvark",

  // Load all entities from the entities directory
  entities: ["src/database/entities/*.entity.ts"],

  // Migrations configuration
  migrations: ["src/database/migrations/*.ts"],
  migrationsTableName: "typeorm_migrations",

  // Logging for debugging migrations
  logging: ["error", "warn", "migration"],

  // SSL configuration for production
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
          ca: process.env.DB_SSL_CA || undefined,
        }
      : false,
});
