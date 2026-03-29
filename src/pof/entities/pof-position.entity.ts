import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AgentAssignment } from '../../assignments/entities/agent-assignment.entity';
import { RevistaRecord } from '../../revista/entities/revista-record.entity';

@Entity('pof_positions')
export class PofPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  plaza_number: string;

  @Column({ nullable: true })
  subject_name: string;

  @Column({ type: 'int', nullable: true })
  hours_count: number;

  @Column({ nullable: true })
  course: string;

  @Column({ nullable: true })
  division: string;

  @Column({ nullable: true })
  shift: string;

  @Column({ type: 'date', nullable: true })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date;

  @Column({ nullable: true })
  revista_status: string;

  @Column({ nullable: true })
  legal_norm: string;

  @Column({ nullable: true })
  vacancy_status: string;

  @Column({ nullable: true })
  modality: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => AgentAssignment, (assignment) => assignment.pof_position)
  assignments: AgentAssignment[];

  @OneToMany(() => RevistaRecord, (revista) => revista.pof_position)
  revista_records: RevistaRecord[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
