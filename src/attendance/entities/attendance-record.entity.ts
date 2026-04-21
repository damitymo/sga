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

  // Relación lazy: attendance_records puede tener miles de filas por agente.
  // Traer el Agent en cada fila (como hacía el eager: true) inflaba la payload
  // y complicaba los listados. Pedir explícitamente con `relations: { agent: true }`
  // cuando se necesite (típicamente en el listado admin general).
  @ManyToOne(() => Agent, (agent) => agent.attendance_records, {
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

  // status/condition_type/shift se guardan como varchar en la DB productiva.
  // Mantenemos los enums de TS para validar/normalizar a nivel aplicación,
  // pero no usamos el enum de Postgres (costoso de alterar y no aporta
  // seguridad adicional respecto al ValidationPipe + normalización del service).
  @Column({ type: 'varchar' })
  status!: AttendanceStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  raw_code!: string | null;

  @Column({ type: 'varchar', nullable: true })
  condition_type!: AttendanceConditionType | null;

  @Column({ type: 'varchar', nullable: true })
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
