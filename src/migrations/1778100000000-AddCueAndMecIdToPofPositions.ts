import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega a `pof_positions` los campos `establecimiento_cue` y
 * `plaza_mec_id` para soportar múltiples CUEs (sede principal + anexos).
 *
 * Motivo: el `plaza_number` (ej. "50-001") NO es único entre CUEs — cada
 * establecimiento tiene su propia numeración. Para poder mezclar plazas de
 * la sede principal (1800697-00) y la extensión áulica (1800697-03) sin
 * que colisionen, identificamos cada plaza por:
 *   - `plaza_mec_id` (el `plazaId` interno del MEC, único globalmente)
 *   - o por la combinación (`plaza_number`, `establecimiento_cue`).
 *
 * Idempotente.
 */
export class AddCueAndMecIdToPofPositions1778100000000
  implements MigrationInterface
{
  name = 'AddCueAndMecIdToPofPositions1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pof_positions"
        ADD COLUMN IF NOT EXISTS "establecimiento_cue" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "pof_positions"
        ADD COLUMN IF NOT EXISTS "plaza_mec_id" int
    `);
    // Default: las plazas que ya existen son del CUE principal.
    await queryRunner.query(`
      UPDATE "pof_positions"
        SET "establecimiento_cue" = '1800697-00'
        WHERE "establecimiento_cue" IS NULL
    `);
    // Índice único parcial: cuando plaza_mec_id NO es null, debe ser único.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_pof_positions_plaza_mec_id"
        ON "pof_positions" ("plaza_mec_id")
        WHERE "plaza_mec_id" IS NOT NULL
    `);
    // Índice para matching por (plaza_number, establecimiento_cue)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_pof_positions_plaza_cue"
        ON "pof_positions" ("plaza_number", "establecimiento_cue")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ix_pof_positions_plaza_cue"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_pof_positions_plaza_mec_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pof_positions" DROP COLUMN IF EXISTS "plaza_mec_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pof_positions" DROP COLUMN IF EXISTS "establecimiento_cue"`,
    );
  }
}
