import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';
import { PofPosition } from '../../pof/entities/pof-position.entity';

@Entity('agent_assignments')
export class AgentAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  agent_id!: number;

  // Nullable: el endpoint /api/Designacion del MEC trae formularios FD
  // (designaciones legales) sin la plaza específica vinculada. Para no
  // perder el historial del docente, permitimos guardar la designación
  // sin pof_position_id y se enriquece después si conseguimos la plaza.
  @Column({ type: 'int', nullable: true })
  pof_position_id!: number | null;

  // eager: true intencional. Los listados de designaciones prácticamente
  // siempre muestran docente + plaza en la misma tabla (frontend los consume
  // así). Si en algún momento un listado muy grande se vuelve hot path,
  // conviene sacar el eager y pasar a `relations` explícitas.
  @ManyToOne(() => Agent, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @ManyToOne(() => PofPosition, { eager: true, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'pof_position_id' })
  pof_position!: PofPosition | null;

  @Column({ type: 'varchar' })
  movement_type!: string;

  @Column({ type: 'varchar', nullable: true })
  resolution_number!: string | null;

  @Column({ type: 'varchar', nullable: true })
  legal_norm!: string | null;

  @Column({ type: 'varchar', nullable: true })
  legal_norm_type!: string | null;

  @Column({ type: 'varchar', nullable: true })
  legal_norm_number!: string | null;

  @Column({ type: 'varchar', nullable: true })
  character_type!: string | null;

  @Column({ type: 'date', nullable: true })
  assignment_date!: Date | null;

  @Column({ type: 'date', nullable: true })
  end_date!: Date | null;

  @Column({ type: 'varchar', default: 'ACTIVA' })
  status!: string;

  // Campos espejo del MEC para enriquecer la situación de revista del docente
  // con los mismos datos que muestra el modal "Detalle Plaza" de Gestión.

  @Column({ type: 'varchar', nullable: true })
  escalafon!: string | null;

  @Column({ type: 'varchar', nullable: true })
  categoria!: string | null;

  @Column({ type: 'varchar', nullable: true })
  cargo_codigo!: string | null;

  @Column({ type: 'varchar', nullable: true })
  cargo_descripcion!: string | null;

  @Column({ type: 'varchar', nullable: true })
  motivo_ingreso!: string | null;

  @Column({ type: 'varchar', nullable: true })
  motivo_egreso!: string | null;

  @Column({ type: 'int', nullable: true })
  puesto_laboral!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /**
   * Horario semanal de dictado: matriz 5x7 (LUN-VIE × 1ª-7ª hora) de booleanos.
   * Persistido como jsonb para que sea fácil de levantar/escribir desde el
   * ClassScheduleEditor. Null = todavía no se cargó el horario para esta plaza.
   */
  @Column({ type: 'jsonb', nullable: true })
  weekly_schedule!: boolean[][] | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
