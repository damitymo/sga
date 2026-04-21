import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Alinea el schema real con las entities, corrigiendo el drift documentado
 * en docs/base-de-datos-v1.md:
 *
 *  1) `attendance_records.status` / `condition_type` / `shift`:
 *     en Render son `varchar`, en local (vía baseline) son `enum`. Las entities
 *     ahora declaran `varchar` — esta migration normaliza a `varchar` en
 *     cualquier DB que todavía tenga el tipo enum.
 *
 *  2) `users.agent_id` FK: en Render es `ON DELETE SET NULL`, la baseline creó
 *     `NO ACTION`. Las entities ahora declaran `SET NULL`.
 *
 * La migration es **idempotente**: en una DB ya alineada (producción) es no-op.
 * En local aplica los cambios sin perder data (usa `ALTER ... USING`).
 */
export class AlignDriftWithProd1776744000000 implements MigrationInterface {
  name = 'AlignDriftWithProd1776744000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) attendance_records.status: enum -> varchar
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'attendance_records'
            AND column_name = 'status'
            AND udt_name = 'attendance_records_status_enum'
        ) THEN
          ALTER TABLE "attendance_records"
            ALTER COLUMN "status" TYPE varchar USING "status"::text;
        END IF;
      END $$;
    `);

    // 2) attendance_records.condition_type: enum -> varchar
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'attendance_records'
            AND column_name = 'condition_type'
            AND udt_name = 'attendance_records_condition_type_enum'
        ) THEN
          ALTER TABLE "attendance_records"
            ALTER COLUMN "condition_type" TYPE varchar USING "condition_type"::text;
        END IF;
      END $$;
    `);

    // 3) attendance_records.shift: enum -> varchar
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'attendance_records'
            AND column_name = 'shift'
            AND udt_name = 'attendance_records_shift_enum'
        ) THEN
          ALTER TABLE "attendance_records"
            ALTER COLUMN "shift" TYPE varchar USING "shift"::text;
        END IF;
      END $$;
    `);

    // 4) Dropear los tipos enum huérfanos. DROP TYPE IF EXISTS es seguro:
    //    si el tipo no existe (caso prod), no hace nada; si existe y no hay
    //    columnas que lo usen (caso local post-ALTER), lo dropea.
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."attendance_records_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."attendance_records_condition_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."attendance_records_shift_enum"`,
    );

    // 5) users.agent_id FK -> ON DELETE SET NULL.
    //    Preservamos el nombre actual del constraint (puede diferir entre
    //    local y prod por el drift en naming).
    await queryRunner.query(`
      DO $$
      DECLARE
        current_rule text;
        fk_name text;
      BEGIN
        SELECT rc.delete_rule, tc.constraint_name
          INTO current_rule, fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.referential_constraints rc
          ON rc.constraint_name = tc.constraint_name
         AND rc.constraint_schema = tc.constraint_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'users'
          AND kcu.column_name = 'agent_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;

        IF fk_name IS NOT NULL AND current_rule <> 'SET NULL' THEN
          EXECUTE format('ALTER TABLE "users" DROP CONSTRAINT %I', fk_name);
          EXECUTE format(
            'ALTER TABLE "users" ADD CONSTRAINT %I FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
            fk_name
          );
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Intencionalmente no revertimos. El propósito de esta migration es
    // alinear el schema real con las entities; revertir volvería a introducir
    // drift entre local y producción. Si necesitás rehacer el baseline,
    // restaurá desde backup.
  }
}
