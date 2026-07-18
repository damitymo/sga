import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea el Organigrama institucional: `establecimientos` (Sede Central /
 * Extensión Áulica, con CUE), `orientaciones` (catálogo libre de tipos de
 * bachillerato) y `cursos` (nivel + año/división + orientación +
 * establecimiento), más `pof_positions.curso_id` (FK opcional y aditiva —
 * `course`/`division`/`establecimiento_cue` siguen siendo la fuente de
 * verdad para el resto de la UI, `curso_id` solo agrupa por curso real en
 * /organigrama y /cursos).
 *
 * El `migration:generate` automático también trajo drift cosmético
 * preexistente (mismo caso que `CreateLicenses`), descartado del diff.
 *
 * Idempotente.
 */
export class CreateOrganigrama1784337854849 implements MigrationInterface {
  name = 'CreateOrganigrama1784337854849';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "establecimientos" (
        "id" SERIAL NOT NULL,
        "nombre" character varying NOT NULL,
        "cue" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_establecimientos_cue" UNIQUE ("cue"),
        CONSTRAINT "PK_establecimientos" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orientaciones" (
        "id" SERIAL NOT NULL,
        "nombre" character varying NOT NULL,
        "nivel" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orientaciones" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cursos" (
        "id" SERIAL NOT NULL,
        "nivel" character varying NOT NULL,
        "anio" character varying NOT NULL,
        "division" character varying,
        "orientacion_id" integer,
        "establecimiento_id" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cursos" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cursos_establecimiento_nivel_anio_division"
        ON "cursos" ("establecimiento_id", "nivel", "anio", "division")
    `);

    await queryRunner.query(`
      ALTER TABLE "pof_positions"
        ADD COLUMN IF NOT EXISTS "curso_id" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "cursos"
        ADD CONSTRAINT "FK_cursos_orientacion"
        FOREIGN KEY ("orientacion_id") REFERENCES "orientaciones"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "cursos"
        ADD CONSTRAINT "FK_cursos_establecimiento"
        FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "pof_positions"
        ADD CONSTRAINT "FK_pof_positions_curso"
        FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pof_positions" DROP CONSTRAINT IF EXISTS "FK_pof_positions_curso"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cursos" DROP CONSTRAINT IF EXISTS "FK_cursos_establecimiento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cursos" DROP CONSTRAINT IF EXISTS "FK_cursos_orientacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pof_positions" DROP COLUMN IF EXISTS "curso_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cursos_establecimiento_nivel_anio_division"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cursos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orientaciones"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "establecimientos"`);
  }
}
