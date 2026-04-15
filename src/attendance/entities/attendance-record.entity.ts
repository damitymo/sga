import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';

export enum AttendanceStatus {
  PRESENTE = 'PRESENTE',
  AUSENTE_INJUSTIFICADO = 'AUSENTE_INJUSTIFICADO',
  LICENCIA = 'LICENCIA',
}

export enum AttendanceConditionType {
  TITULAR = 'TITULAR',
  INTERINO = 'INTERINO',
  SUPLENTE = 'SUPLENTE',
  OTRO = 'OTRO',
}

export enum AttendanceShift {
  MANANA = 'MANANA',
  TARDE = 'TARDE',
  NOCHE = 'NOCHE',
  OTRO = 'OTRO',
}

@Entity('attendance_records')
@Index('IDX_attendance_agent_date', ['agent_id', 'attendance_date'])
@Index(
  'UQ_attendance_agent_date_sheet',
  ['agent_id', 'attendance_date', 'source_sheet_name'],
  {
    unique: true,
  },
)
export class AttendanceRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  agent_id!: number;

  @ManyToOne(() => Agent, (agent) => agent.attendance_records, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @Column({ type: 'date' })
  attendance_date!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int' })
  month!: number;

  @Column({ type: 'int' })
  day!: number;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
  })
  status!: AttendanceStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  raw_code!: string | null;

  @Column({
    type: 'enum',
    enum: AttendanceConditionType,
    nullable: true,
  })
  condition_type!: AttendanceConditionType | null;

  @Column({
    type: 'enum',
    enum: AttendanceShift,
    nullable: true,
  })
  shift!: AttendanceShift | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source_sheet_name!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source_agent_name!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  source_dni!: string | null;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  import_batch_id!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
