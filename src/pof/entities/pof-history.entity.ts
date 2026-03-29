import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('pof_history')
export class PofHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pof_position_id: number;

  @Column()
  field_name: string;

  @Column({ type: 'text', nullable: true })
  old_value: string | null;

  @Column({ type: 'text', nullable: true })
  new_value: string | null;

  @CreateDateColumn()
  created_at: Date;
}
