import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  full_name: string;

  @Column({ unique: true })
  username: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column()
  password_hash: string;

  @Column({ default: 'ADMINISTRATIVO' })
  role: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'int', nullable: true })
  agent_id: number | null;

  @ManyToOne(() => Agent, { nullable: true, eager: true })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
