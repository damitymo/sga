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
  id!: number;

  @Column({ type: 'varchar' })
  plaza_number!: string;

  @Column({ type: 'varchar', nullable: true })
  subject_name!: string | null;

  @Column({ type: 'int', nullable: true })
  hours_count!: number | null;

  @Column({ type: 'varchar', nullable: true })
  course!: string | null;

  @Column({ type: 'varchar', nullable: true })
  division!: string | null;

  @Column({ type: 'varchar', nullable: true })
  shift!: string | null;

  @Column({ type: 'date', nullable: true })
  start_date!: Date | null;

  @Column({ type: 'date', nullable: true })
  end_date!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  revista_status!: string | null;

  @Column({ type: 'varchar', nullable: true })
  legal_norm!: string | null;

  @Column({ type: 'varchar', nullable: true })
  vacancy_status!: string | null;

  @Column({ type: 'varchar', nullable: true })
  modality!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @OneToMany(() => AgentAssignment, (assignment) => assignment.pof_position)
  assignments!: AgentAssignment[];

  @OneToMany(() => RevistaRecord, (revista) => revista.pof_position)
  revista_records!: RevistaRecord[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
