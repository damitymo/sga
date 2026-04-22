import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suma al entity `agents` los 4 campos del legajo que antes faltaban:
 * sex, marital_status, birth_place, nationality. Son todos nullable y
 * opcionales: la idea es que se completen a mano desde la vista de legajo.
 *
 * Es idempotente: si las columnas ya existen (ej: re-running la migration
 * sobre una base que ya las tiene), no hace nada.
 */
export class AddLegajoFieldsToAgents1777000000000
  implements MigrationInterface
{
  name = 'AddLegajoFieldsToAgents1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
        ADD COLUMN IF NOT EXISTS "sex" varchar(20),
        ADD COLUMN IF NOT EXISTS "marital_status" varchar(40),
        ADD COLUMN IF NOT EXISTS "birth_place" varchar,
        ADD COLUMN IF NOT EXISTS "nationality" varchar(60)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
        DROP COLUMN IF EXISTS "sex",
        DROP COLUMN IF EXISTS "marital_status",
        DROP COLUMN IF EXISTS "birth_place",
        DROP COLUMN IF EXISTS "nationality"
    `);
  }
}
