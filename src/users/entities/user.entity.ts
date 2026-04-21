import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  full_name!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email!: string | null;

  @Column()
  password_hash!: string;

  @Column({ default: 'ADMINISTRATIVO' })
  role!: string;

  @Column({ default: true })
  is_active!: boolean;

  @Column({ default: true })
  must_change_password!: boolean;

  @Column({ type: 'int', nullable: true })
  agent_id!: number | null;

  // Relación lazy: si algún endpoint necesita el Agent completo, pedir
  // explícitamente con `relations: { agent: true }` en el findOne/find.
  // Internamente el dominio sólo usa user.agent_id.
  // onDelete: 'SET NULL' refleja el comportamiento real en Render: si se borra
  // el agente, el user queda sin vínculo pero no cae en cascada.
  @ManyToOne(() => Agent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
