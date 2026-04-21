import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialBaseline1776711747878 implements MigrationInterface {
    name = 'InitialBaseline1776711747878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "revista_records" ("id" SERIAL NOT NULL, "agent_id" integer NOT NULL, "pof_position_id" integer, "assignment_id" integer, "revista_type" character varying, "character_type" character varying, "start_date" date, "end_date" date, "is_current" boolean NOT NULL DEFAULT false, "legal_norm" character varying, "resolution_number" character varying, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_71f10a5dae6d9cf9b3170ad9302" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pof_positions" ("id" SERIAL NOT NULL, "plaza_number" character varying NOT NULL, "subject_name" character varying, "hours_count" integer, "course" character varying, "division" character varying, "shift" character varying, "start_date" date, "end_date" date, "revista_status" character varying, "legal_norm" character varying, "vacancy_status" character varying, "modality" character varying, "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e9e18f5c5521d04355bd24ee9d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "agent_assignments" ("id" SERIAL NOT NULL, "agent_id" integer NOT NULL, "pof_position_id" integer NOT NULL, "movement_type" character varying NOT NULL, "resolution_number" character varying, "legal_norm" character varying, "legal_norm_type" character varying, "legal_norm_number" character varying, "character_type" character varying, "assignment_date" date, "end_date" date, "status" character varying NOT NULL DEFAULT 'ACTIVA', "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b6e27b10541d99d93d8f9ec560a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_status_enum" AS ENUM('PRESENTE', 'AUSENTE_INJUSTIFICADO', 'LICENCIA')`);
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_condition_type_enum" AS ENUM('TITULAR', 'INTERINO', 'SUPLENTE', 'OTRO')`);
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_shift_enum" AS ENUM('MANANA', 'TARDE', 'NOCHE', 'OTRO')`);
        await queryRunner.query(`CREATE TABLE "attendance_records" ("id" SERIAL NOT NULL, "agent_id" integer NOT NULL, "attendance_date" date NOT NULL, "year" integer NOT NULL, "month" integer NOT NULL, "day" integer NOT NULL, "status" "public"."attendance_records_status_enum" NOT NULL, "raw_code" character varying(20), "condition_type" "public"."attendance_records_condition_type_enum", "shift" "public"."attendance_records_shift_enum", "source_sheet_name" character varying(255), "source_agent_name" character varying(255), "source_dni" character varying(30), "observation" text, "import_batch_id" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_946920332f5bc9efad3f3023b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_attendance_agent_date_sheet" ON "attendance_records" ("agent_id", "attendance_date", "source_sheet_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_attendance_agent_date" ON "attendance_records" ("agent_id", "attendance_date") `);
        await queryRunner.query(`CREATE TABLE "agents" ("id" SERIAL NOT NULL, "last_name" character varying, "first_name" character varying, "full_name" character varying NOT NULL, "dni" character varying NOT NULL, "birth_date" date, "address" character varying, "phone" character varying, "mobile" character varying, "email" character varying, "teaching_file_number" character varying, "board_file_number" character varying, "secondary_board_number" character varying, "school_entry_date" date, "teaching_entry_date" date, "titles" text, "identity_card_number" character varying, "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "legal_norm_type" character varying, "legal_norm_number" character varying, "character_type" character varying, CONSTRAINT "UQ_a464545f9292d9f804a9d5b4c1b" UNIQUE ("dni"), CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "full_name" character varying NOT NULL, "username" character varying NOT NULL, "email" character varying, "password_hash" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'ADMINISTRATIVO', "is_active" boolean NOT NULL DEFAULT true, "must_change_password" boolean NOT NULL DEFAULT true, "agent_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pof_history" ("id" SERIAL NOT NULL, "pof_position_id" integer NOT NULL, "field_name" character varying NOT NULL, "old_value" text, "new_value" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d3095579e3ecefca3066e21a995" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "revista_records" ADD CONSTRAINT "FK_75eaeb5a2785ad2fa54a22c80a7" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "revista_records" ADD CONSTRAINT "FK_f81e93af815505edfe094b14523" FOREIGN KEY ("pof_position_id") REFERENCES "pof_positions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "revista_records" ADD CONSTRAINT "FK_64eab91ec7d78ef1fba6e56eaf5" FOREIGN KEY ("assignment_id") REFERENCES "agent_assignments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_assignments" ADD CONSTRAINT "FK_57bd00cd38a5e073c0a3f66cae3" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_assignments" ADD CONSTRAINT "FK_54bfae550e59a07d42061add32b" FOREIGN KEY ("pof_position_id") REFERENCES "pof_positions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_32886af02988791820c00b3eef0" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_fb0e04581f7c7e4dfb92f47965d" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_fb0e04581f7c7e4dfb92f47965d"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_32886af02988791820c00b3eef0"`);
        await queryRunner.query(`ALTER TABLE "agent_assignments" DROP CONSTRAINT "FK_54bfae550e59a07d42061add32b"`);
        await queryRunner.query(`ALTER TABLE "agent_assignments" DROP CONSTRAINT "FK_57bd00cd38a5e073c0a3f66cae3"`);
        await queryRunner.query(`ALTER TABLE "revista_records" DROP CONSTRAINT "FK_64eab91ec7d78ef1fba6e56eaf5"`);
        await queryRunner.query(`ALTER TABLE "revista_records" DROP CONSTRAINT "FK_f81e93af815505edfe094b14523"`);
        await queryRunner.query(`ALTER TABLE "revista_records" DROP CONSTRAINT "FK_75eaeb5a2785ad2fa54a22c80a7"`);
        await queryRunner.query(`DROP TABLE "pof_history"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "agents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attendance_agent_date"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_attendance_agent_date_sheet"`);
        await queryRunner.query(`DROP TABLE "attendance_records"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_shift_enum"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_condition_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_status_enum"`);
        await queryRunner.query(`DROP TABLE "agent_assignments"`);
        await queryRunner.query(`DROP TABLE "pof_positions"`);
        await queryRunner.query(`DROP TABLE "revista_records"`);
    }

}
