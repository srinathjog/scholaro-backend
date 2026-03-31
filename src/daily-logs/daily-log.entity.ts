import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Enrollment } from '../enrollments/enrollment.entity';
import { User } from '../users/user.entity';

@Entity('daily_logs')
@Index(['tenant_id'])
export class DailyLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenant_id!: string;

  @Column('uuid')
  enrollment_id!: string;

  @ManyToOne(() => Enrollment, { eager: false, nullable: false })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment!: Enrollment;

  @Column({ type: 'varchar', length: 20 })
  category!: 'meal' | 'nap' | 'potty' | 'mood' | 'health';

  @Column({ type: 'varchar', length: 100 })
  log_value!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column('uuid')
  logged_by!: string;

  @ManyToOne(() => User, { eager: false, nullable: false })
  @JoinColumn({ name: 'logged_by' })
  user!: User;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
