import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Enrollment } from '../enrollments/enrollment.entity';

@Entity('attendance')
@Unique(['enrollment_id', 'date'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenant_id!: string;

  @Column('uuid')
  enrollment_id!: string;

  @ManyToOne(() => Enrollment)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment!: Enrollment;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: 'present' | 'absent' | 'leave';

  @Column('uuid')
  marked_by!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
