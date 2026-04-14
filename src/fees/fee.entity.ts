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
import { Enrollment } from '../enrollments/enrollment.entity';

/**
 * FeeStructure — template that defines what a school charges
 * (e.g. "Term 1 Tuition", "Annual Activity Fee").
 * One per tenant per fee type per academic year.
 */
@Entity('fee_structures')
@Index(['tenant_id', 'academic_year_id'])
export class FeeStructure {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenant_id!: string;

  @Column({ type: 'uuid' })
  academic_year_id!: string;

  @Column({ type: 'uuid' })
  class_id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string; // e.g. "Term 1 Tuition", "Annual Activity Fee"

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number; // base amount before any discount

  @Column({ type: 'date' })
  due_date!: string;

  @Column({ type: 'varchar', length: 20, default: 'one_time' })
  frequency!: 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}

/**
 * Fee — an actual fee record charged to a specific enrollment.
 * Supports discounts (sibling, staff, scholarship, etc.)
 * with a clear audit trail of total → discount → final.
 */
@Entity('fees')
@Index(['tenant_id', 'status'])
@Index(['tenant_id', 'due_date'])
export class Fee {
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

  @Column({ type: 'uuid', nullable: true })
  fee_structure_id?: string;

  @ManyToOne(() => FeeStructure, { nullable: true })
  @JoinColumn({ name: 'fee_structure_id' })
  feeStructure?: FeeStructure;

  @Column({ type: 'varchar', length: 150 })
  description!: string; // e.g. "Term 1 Tuition – LKG"

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  discount_reason?: string; // e.g. "Sibling discount", "Staff discount"

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  final_amount!: number; // total_amount - discount_amount

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  paid_amount!: number;

  @Column({ type: 'date' })
  due_date!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'partially_paid' | 'paid' | 'overdue';

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_reminder_sent?: Date;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
