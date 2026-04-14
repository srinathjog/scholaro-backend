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
@Index(['tenant_id', 'date'])
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
  status!: 'present' | 'absent' | 'late' | 'leave';

  @Column('uuid')
  marked_by!: string;

  @Column({ type: 'timestamptz', nullable: true })
  check_in_time?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  check_out_time?: Date;


  @Column({ type: 'varchar', length: 200, nullable: true })
  pickup_by_name?: string;

  @Column({ type: 'text', nullable: true })
  pickup_by_photo_url?: string;

  @Column({ type: 'text', nullable: true })
  pickup_notes?: string;

  @Column({ type: 'uuid', nullable: true })
  checkout_by?: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
