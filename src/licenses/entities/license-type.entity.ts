import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { License } from './license.entity';

/**
 * Catálogo de tipos de licencia (artículos del estatuto docente). Se dan
 * de baja con soft-delete (`is_active = false`), igual que `pof_positions`,
 * para no romper el historial de `licenses.license_type_id`.
 */
@Entity('license_types')
export class LicenseType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  article!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', nullable: true })
  applicable_to!: string | null;

  @Column({ type: 'boolean', default: true })
  paid!: boolean;

  @Column({ type: 'boolean', default: false })
  affects_presentismo!: boolean;

  @Column({ type: 'int', nullable: true })
  max_days_per_year!: number | null;

  @Column({ type: 'int', nullable: true })
  max_days_per_month!: number | null;

  @Column({ type: 'int', nullable: true })
  max_days_continuous!: number | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @OneToMany(() => License, (license) => license.license_type)
  licenses!: License[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
