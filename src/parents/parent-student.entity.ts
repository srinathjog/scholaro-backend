import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('parent_students')
@Unique(['parent_user_id', 'student_id'])
export class ParentStudent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  tenant_id!: string;

  @Index()
  @Column('uuid')
  parent_user_id!: string;

  @Index()
  @Column('uuid')
  student_id!: string;

  @Column({ type: 'varchar', length: 32 })
  relationship!: string; // e.g., 'father', 'mother', etc.

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
