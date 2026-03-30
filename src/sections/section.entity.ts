import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Class } from '../classes/class.entity';

@Entity('sections')
@Unique(['tenant_id', 'class_id', 'name'])
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenant_id!: string;

  @Column('uuid')
  class_id!: string;

  @ManyToOne(() => Class)
  @JoinColumn({ name: 'class_id' })
  class!: Class;

  @Column({ type: 'varchar', length: 10 })
  name!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
