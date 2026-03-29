import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';
import { PofPosition } from '../../pof/entities/pof-position.entity';
import { AgentAssignment } from '../../assignments/entities/agent-assignment.entity';

@Entity('revista_records')
export class RevistaRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  agent_id: number;

  @Column({ nullable: true })
  pof_position_id: number;

  @Column({ nullable: true })
  assignment_id: number;

  @ManyToOne(() => Agent, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @ManyToOne(() => PofPosition, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pof_position_id' })
  pof_position: PofPosition;

  @ManyToOne(() => AgentAssignment, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: AgentAssignment;

  @Column({ nullable: true })
  revista_type: string;

  @Column({ nullable: true })
  character_type: string;

  @Column({ nullable: true, type: 'date' })
  start_date: Date;

  @Column({ nullable: true, type: 'date' })
  end_date: Date;

  @Column({ default: false })
  is_current: boolean;

  @Column({ nullable: true })
  legal_norm: string;

  @Column({ nullable: true })
  resolution_number: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
