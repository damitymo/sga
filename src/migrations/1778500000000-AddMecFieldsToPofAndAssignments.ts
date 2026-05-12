import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega los campos faltantes del JSON oficial del MEC a `pof_positions`
 * y `agent_assignments` para que la POF del SGA refleje exactamente lo
 * que muestra Gestión Educativa (ge.mec.gob.ar/Pof) y la Revista Actual
 * de cada docente tenga el detalle completo de su prestación.
 *
 * Campos nuevos en pof_positions:
 *   - sub_organizacion             (NC / SE / PR / SEREDU)
 *   - tipo_plaza_estado            (Normal / Vacante / Desafectada / Recurso Legal / etc.)
 *   - fecha_creacion               (plazaFechaCreacion)
 *   - fecha_vacante                (cuándo quedó vacante)
 *   - motivo_vacante               (texto del motivo)
 *   - fecha_ultimo_movimiento      (plazaFechaUltimoMovimiento)
 *
 * Campos nuevos en agent_assignments:
 *   - escalafon                    (DOCENTE / ADMIN / etc.)
 *   - categoria                    (DOCENTES - CARGOS / DOCENTES - HC / etc.)
 *   - cargo_codigo                 (e.g. "05-109")
 *   - cargo_descripcion            (e.g. "RECTOR DE 1RA")
 *   - motivo_ingreso               (texto)
 *   - motivo_egreso                (texto)
 *   - puesto_laboral               (número entero o null)
 *
 * Todas las columnas son nullable. Idempotente.
 */
export class AddMecFieldsToPofAndAssignments1778500000000
  implements MigrationInterface
{
  name = 'AddMecFieldsToPofAndAssignments1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pof_positions
    await queryRunner.query(`
      ALTER TABLE "pof_positions"
        ADD COLUMN IF NOT EXISTS "sub_organizacion" varchar,
        ADD COLUMN IF NOT EXISTS "tipo_plaza_estado" varchar,
        ADD COLUMN IF NOT EXISTS "fecha_creacion" date,
        ADD COLUMN IF NOT EXISTS "fecha_vacante" date,
        ADD COLUMN IF NOT EXISTS "motivo_vacante" varchar,
        ADD COLUMN IF NOT EXISTS "fecha_ultimo_movimiento" date
    `);

    // agent_assignments
    await queryRunner.query(`
      ALTER TABLE "agent_assignments"
        ADD COLUMN IF NOT EXISTS "escalafon" varchar,
        ADD COLUMN IF NOT EXISTS "categoria" varchar,
        ADD COLUMN IF NOT EXISTS "cargo_codigo" varchar,
        ADD COLUMN IF NOT EXISTS "cargo_descripcion" varchar,
        ADD COLUMN IF NOT EXISTS "motivo_ingreso" varchar,
        ADD COLUMN IF NOT EXISTS "motivo_egreso" varchar,
        ADD COLUMN IF NOT EXISTS "puesto_laboral" int
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_assignments"
        DROP COLUMN IF EXISTS "escalafon",
        DROP COLUMN IF EXISTS "categoria",
        DROP COLUMN IF EXISTS "cargo_codigo",
        DROP COLUMN IF EXISTS "cargo_descripcion",
        DROP COLUMN IF EXISTS "motivo_ingreso",
        DROP COLUMN IF EXISTS "motivo_egreso",
        DROP COLUMN IF EXISTS "puesto_laboral"
    `);
    await queryRunner.query(`
      ALTER TABLE "pof_positions"
        DROP COLUMN IF EXISTS "sub_organizacion",
        DROP COLUMN IF EXISTS "tipo_plaza_estado",
        DROP COLUMN IF EXISTS "fecha_creacion",
        DROP COLUMN IF EXISTS "fecha_vacante",
        DROP COLUMN IF EXISTS "motivo_vacante",
        DROP COLUMN IF EXISTS "fecha_ultimo_movimiento"
    `);
  }
}
