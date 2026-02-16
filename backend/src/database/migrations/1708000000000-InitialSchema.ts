import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Initial database migration — creates the complete schema from entity definitions.
 *
 * This migration bootstraps the database by synchronizing the schema from TypeORM
 * entity metadata. It is safe to run against an empty database.
 *
 * All subsequent schema changes MUST use generated migrations:
 *   npx typeorm migration:generate src/database/migrations/MigrationName -d src/database/data-source.ts
 */
export class InitialSchema1708000000000 implements MigrationInterface {
  name = "InitialSchema1708000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Synchronize schema from entity metadata.
    // This creates all tables, columns, indexes, foreign keys, and enum types
    // based on the currently loaded TypeORM entity definitions.
    await queryRunner.connection.synchronize(false);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all application tables (reverse dependency order handled by CASCADE)
    const tables = await queryRunner.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('typeorm_migrations', 'query_result_cache')`,
    );

    // Disable FK checks for clean teardown
    await queryRunner.query("SET session_replication_role = replica");

    for (const { tablename } of tables) {
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${tablename}" CASCADE`,
      );
    }

    await queryRunner.query("SET session_replication_role = DEFAULT");

    // Drop all custom enum types created by TypeORM
    const enums = await queryRunner.query(
      `SELECT DISTINCT t.typname FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid`,
    );

    for (const { typname } of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${typname}" CASCADE`);
    }
  }
}
