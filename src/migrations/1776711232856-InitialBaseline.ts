import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialBaseline1776711232856 implements MigrationInterface {
    name = 'InitialBaseline1776711232856'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_agent_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "fk_users_agent"`);
        await queryRunner.query(`DROP INDEX "public"."uq_attendance_agent_date_sheet"`);
        await queryRunner.query(`DROP INDEX "public"."idx_attendance_agent_date"`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "attendance_records_id_seq" OWNED BY "attendance_records"."id"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ALTER COLUMN "id" SET DEFAULT nextval('"attendance_records_id_seq"')`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_status_enum" AS ENUM('PRESENTE', 'AUSENTE_INJUSTIFICADO', 'LICENCIA')`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "status" "public"."attendance_records_status_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "condition_type"`);
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_condition_type_enum" AS ENUM('TITULAR', 'INTERINO', 'SUPLENTE', 'OTRO')`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "condition_type" "public"."attendance_records_condition_type_enum"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "shift"`);
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_shift_enum" AS ENUM('MANANA', 'TARDE', 'NOCHE', 'OTRO')`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "shift" "public"."attendance_records_shift_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "must_change_password" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_attendance_agent_date_sheet" ON "attendance_records" ("agent_id", "attendance_date", "source_sheet_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_attendance_agent_date" ON "attendance_records" ("agent_id", "attendance_date") `);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_32886af02988791820c00b3eef0" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_fb0e04581f7c7e4dfb92f47965d" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_fb0e04581f7c7e4dfb92f47965d"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_32886af02988791820c00b3eef0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attendance_agent_date"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_attendance_agent_date_sheet"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "must_change_password" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "shift"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_shift_enum"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "shift" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "condition_type"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_condition_type_enum"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "condition_type" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_status_enum"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD "status" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ALTER COLUMN "id" SET DEFAULT nextval('attendance_records_id_seq1')`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE "attendance_records_id_seq"`);
        await queryRunner.query(`CREATE INDEX "idx_attendance_agent_date" ON "attendance_records" ("agent_id", "attendance_date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_attendance_agent_date_sheet" ON "attendance_records" ("agent_id", "attendance_date", "source_sheet_name") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "fk_users_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
