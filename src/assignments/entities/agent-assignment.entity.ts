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

  @Column({ type: 'int' })
  pof_position_id!: number;

  // eager: true intencional. Los listados de designaciones prácticamente
  // siempre muestran docente + plaza en la misma tabla (frontend los consume
  // así). Si en algún momento un listado muy grande se vuelve hot path,
  // conviene sacar el eager y pasar a `relations` explícitas.
  @ManyToOne(() => Agent, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @ManyToOne(() => PofPosition, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pof_position_id' })
  pof_position!: PofPosition;

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

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
