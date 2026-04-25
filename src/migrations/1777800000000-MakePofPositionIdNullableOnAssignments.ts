import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hace que `pof_position_id` sea NULLABLE en `agent_assignments`.
 *
 * Motivo: el MEC tiene un endpoint /api/Designacion/listadoPorEstablecimiento
 * que devuelve formularios FD (designaciones legales) sin la plaza específica
 * vinculada — solo trae al agente, fecha de toma de posesión y NLD. Para
 * poder importar esos movimientos al historial del docente sin perder la
 * relación, permitimos que la assignment exista sin pof_position_id.
 *
 * Idempotente.
 */
export class MakePofPositionIdNullableOnAssignments1777800000000
  implements MigrationInterface
{
  name = 'MakePofPositionIdNullableOnAssignments1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_assignments"
        ALTER COLUMN "pof_position_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Solo revertimos si no hay filas con NULL (sino la migration falla,
    // que es el comportamiento correcto: no podés volver a NOT NULL si ya
    // hay datos sin plaza).
    await queryRunner.query(`
      ALTER TABLE "agent_assignments"
        ALTER COLUMN "pof_position_id" SET NOT NULL
    `);
  }
}
