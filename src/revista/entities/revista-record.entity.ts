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
import { AgentAssignment } from '../../assignments/entities/agent-assignment.entity';

@Entity('revista_records')
export class RevistaRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  agent_id!: number;

  @Column({ type: 'int', nullable: true })
  pof_position_id!: number | null;

  @Column({ type: 'int', nullable: true })
  assignment_id!: number | null;

  // eager: true intencional. El frontend muestra la situación de revista
  // (actual e histórica) con agente + plaza + designación origen en la misma
  // vista. Sacar el eager requeriría agregar `relations` en cada find del
  // service y no trae beneficio inmediato porque los volúmenes son acotados
  // (una revista_record por cambio de situación, no por día).
  @ManyToOne(() => Agent, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @ManyToOne(() => PofPosition, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pof_position_id' })
  pof_position!: PofPosition | null;

  @ManyToOne(() => AgentAssignment, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: AgentAssignment | null;

  @Column({ type: 'varchar', nullable: true })
  revista_type!: string | null;

  @Column({ type: 'varchar', nullable: true })
  character_type!: string | null;

  @Column({ type: 'date', nullable: true })
  start_date!: Date | null;

  @Column({ type: 'date', nullable: true })
  end_date!: Date | null;

  @Column({ type: 'boolean', default: false })
  is_current!: boolean;

  @Column({ type: 'varchar', nullable: true })
  legal_norm!: string | null;

  @Column({ type: 'varchar', nullable: true })
  resolution_number!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
