import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';

@Entity('attendance_records')
export class AttendanceRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  agent_id: number;

  @ManyToOne(() => Agent, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column()
  record_type: string; // LICENCIA | AUSENTE | CAPACITACION | CONSTANCIA | PARO

  @Column({ nullable: true, type: 'date' })
  start_date: Date;

  @Column({ nullable: true, type: 'date' })
  end_date: Date;

  @Column({ nullable: true })
  quantity_days: number;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true })
  document_number: string;

  @Column({ nullable: true })
  attachment_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
