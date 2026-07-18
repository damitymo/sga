import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Curso } from '../../cursos/entities/curso.entity';

@Entity('orientaciones')
export class Orientacion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  nombre!: string;

  @Column({ type: 'varchar', nullable: true })
  nivel!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @OneToMany(() => Curso, (curso) => curso.orientacion)
  cursos!: Curso[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
