import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega a `agent_assignments` la columna `weekly_schedule` (jsonb, nullable)
 * que guarda la matriz 5x7 (LUN-VIE × 1ª-7ª hora) del Horario de Clase del
 * docente para esa plaza.
 *
 * Idempotente: usa IF NOT EXISTS.
 */
export class AddWeeklyScheduleToAssignments1777500000000
  implements MigrationInterface
{
  name = 'AddWeeklyScheduleToAssignments1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_assignments"
        ADD COLUMN IF NOT EXISTS "weekly_schedule" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_assignments"
        DROP COLUMN IF EXISTS "weekly_schedule"
    `);
  }
}
