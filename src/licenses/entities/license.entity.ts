import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';
import { LicenseType } from './license-type.entity';

/**
 * Registro de una licencia efectivamente tomada por un docente. `days_count`
 * se calcula en el service a partir de `start_date`/`end_date` (no se
 * confía en lo que mande el cliente).
 */
@Entity('licenses')
@Index('IDX_licenses_agent_start_date', ['agent_id', 'start_date'])
export class License {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  agent_id!: number;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @Column({ type: 'int' })
  license_type_id!: number;

  @ManyToOne(() => LicenseType, (licenseType) => licenseType.licenses, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'license_type_id' })
  license_type!: LicenseType;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date' })
  end_date!: string;

  @Column({ type: 'int' })
  days_count!: number;

  @Column({ type: 'text', nullable: true })
  observations!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
