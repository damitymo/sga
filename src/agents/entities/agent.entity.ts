import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AgentAssignment } from '../../assignments/entities/agent-assignment.entity';
import { AttendanceRecord } from '../../attendance/entities/attendance-record.entity';
import { RevistaRecord } from '../../revista/entities/revista-record.entity';

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  last_name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  first_name!: string | null;

  @Column({ type: 'varchar' })
  full_name!: string;

  @Column({ type: 'varchar', unique: true })
  dni!: string;

  @Column({ type: 'date', nullable: true })
  birth_date!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  mobile!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  teaching_file_number!: string | null;

  @Column({ type: 'varchar', nullable: true })
  board_file_number!: string | null;

  @Column({ type: 'varchar', nullable: true })
  secondary_board_number!: string | null;

  @Column({ type: 'date', nullable: true })
  school_entry_date!: Date | null;

  @Column({ type: 'date', nullable: true })
  teaching_entry_date!: Date | null;

  @Column({ type: 'text', nullable: true })
  titles!: string | null;

  @Column({ type: 'varchar', nullable: true })
  identity_card_number!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @OneToMany(() => AgentAssignment, (assignment) => assignment.agent)
  assignments!: AgentAssignment[];

  @OneToMany(() => AttendanceRecord, (attendance) => attendance.agent)
  attendance_records!: AttendanceRecord[];

  @OneToMany(() => RevistaRecord, (revista) => revista.agent)
  revista_records!: RevistaRecord[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;

  @Column({ type: 'varchar', nullable: true })
  legal_norm_type!: string | null;

  @Column({ type: 'varchar', nullable: true })
  legal_norm_number!: string | null;

  @Column({ type: 'varchar', nullable: true })
  character_type!: string | null;
}
