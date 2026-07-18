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
import { Establecimiento } from '../../establecimientos/entities/establecimiento.entity';
import { Orientacion } from '../../orientaciones/entities/orientacion.entity';

/**
 * `anio` es texto (no int) porque la data real de POF incluye valores como
 * "Grupo Único" además de "1º".."6º".
 */
@Entity('cursos')
@Index('UQ_cursos_establecimiento_nivel_anio_division', [
  'establecimiento_id',
  'nivel',
  'anio',
  'division',
], { unique: true })
export class Curso {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  nivel!: string;

  @Column({ type: 'varchar' })
  anio!: string;

  @Column({ type: 'varchar', nullable: true })
  division!: string | null;

  @Column({ type: 'int', nullable: true })
  orientacion_id!: number | null;

  @ManyToOne(() => Orientacion, (orientacion) => orientacion.cursos, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'orientacion_id' })
  orientacion!: Orientacion | null;

  @Column({ type: 'int' })
  establecimiento_id!: number;

  @ManyToOne(() => Establecimiento, (establecimiento) => establecimiento.cursos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'establecimiento_id' })
  establecimiento!: Establecimiento;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
