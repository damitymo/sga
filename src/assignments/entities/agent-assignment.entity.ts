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
  id: number;

  @Column()
  agent_id: number;

  @Column()
  pof_position_id: number;

  @ManyToOne(() => Agent, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @ManyToOne(() => PofPosition, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pof_position_id' })
  pof_position: PofPosition;

  @Column()
  movement_type: string; // DESIGNACION | BAJA

  @Column({ nullable: true })
  resolution_number: string;

  @Column({ nullable: true })
  legal_norm: string;

  @Column({ nullable: true })
  legal_norm_type: string; // DECRETO | RESOLUCION_MINISTERIAL | DISPOSICION | RI

  @Column({ nullable: true })
  legal_norm_number: string;

  @Column({ nullable: true })
  character_type: string; // TITULAR | INTERINO | SUPLENTE

  @Column({ type: 'date', nullable: true })
  assignment_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date;

  @Column({ default: 'ACTIVA' })
  status: string; // ACTIVA | FINALIZADA

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
