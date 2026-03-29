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
  id: number;

  @Column({ nullable: true })
  last_name: string;

  @Column({ nullable: true })
  first_name: string;

  @Column()
  full_name: string;

  @Column({ unique: true })
  dni: string;

  @Column({ type: 'date', nullable: true })
  birth_date: Date;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  mobile: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  teaching_file_number: string;

  @Column({ nullable: true })
  board_file_number: string;

  @Column({ nullable: true })
  secondary_board_number: string;

  @Column({ type: 'date', nullable: true })
  school_entry_date: Date;

  @Column({ type: 'date', nullable: true })
  teaching_entry_date: Date;

  @Column({ type: 'text', nullable: true })
  titles: string;

  @Column({ nullable: true })
  identity_card_number: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => AgentAssignment, (assignment) => assignment.agent)
  assignments: AgentAssignment[];

  @OneToMany(() => AttendanceRecord, (attendance) => attendance.agent)
  attendance_records: AttendanceRecord[];

  @OneToMany(() => RevistaRecord, (revista) => revista.agent)
  revista_records: RevistaRecord[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  legal_norm_type: string; // DECRETO | RESOLUCION_MINISTERIAL | DISPOSICION | RI

  @Column({ nullable: true })
  legal_norm_number: string;

  @Column({ nullable: true })
  character_type: string; // TITULAR | INTERINO | SUPLENTE
}
