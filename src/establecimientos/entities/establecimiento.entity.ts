import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Curso } from '../../cursos/entities/curso.entity';

@Entity('establecimientos')
export class Establecimiento {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  nombre!: string;

  @Column({ type: 'varchar', unique: true })
  cue!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @OneToMany(() => Curso, (curso) => curso.establecimiento)
  cursos!: Curso[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
