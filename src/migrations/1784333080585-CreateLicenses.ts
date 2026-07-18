import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea el módulo de Licencias: `license_types` (catálogo de artículos del
 * estatuto docente, soft-delete vía `is_active`) y `licenses` (registro de
 * licencias tomadas por cada agente, con FK a ambas).
 *
 * Nota: el `migration:generate` automático también detectó drift cosmético
 * preexistente entre las entities y la DB de Render (nombres de índices y
 * constraints con casing distinto, columnas de `attendance_records`
 * redefinidas sin cambio real de tipo). Ese drift ya está documentado como
 * "no tocar" en docs/base-de-datos-v1.md, así que se descartó del diff y
 * esta migration solo contiene las tablas nuevas.
 *
 * Idempotente.
 */
export class CreateLicenses1784333080585 implements MigrationInterface {
  name = 'CreateLicenses1784333080585';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "license_types" (
        "id" SERIAL NOT NULL,
        "article" character varying NOT NULL,
        "description" text NOT NULL,
        "applicable_to" character varying,
        "paid" boolean NOT NULL DEFAULT true,
        "affects_presentismo" boolean NOT NULL DEFAULT false,
        "max_days_per_year" integer,
        "max_days_per_month" integer,
        "max_days_continuous" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_license_types" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "licenses" (
        "id" SERIAL NOT NULL,
        "agent_id" integer NOT NULL,
        "license_type_id" integer NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "days_count" integer NOT NULL,
        "observations" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_licenses" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_licenses_agent_start_date"
        ON "licenses" ("agent_id", "start_date")
    `);

    await queryRunner.query(`
      ALTER TABLE "licenses"
        ADD CONSTRAINT "FK_licenses_agent"
        FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "licenses"
        ADD CONSTRAINT "FK_licenses_license_type"
        FOREIGN KEY ("license_type_id") REFERENCES "license_types"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "licenses" DROP CONSTRAINT IF EXISTS "FK_licenses_license_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licenses" DROP CONSTRAINT IF EXISTS "FK_licenses_agent"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_licenses_agent_start_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "licenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "license_types"`);
  }
}
