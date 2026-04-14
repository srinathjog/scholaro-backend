import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Student } from '../students/student.entity';
// import { Class } from '../classes/class.entity';
// import { Section } from '../sections/section.entity';
// import { AcademicYear } from '../academic-years/academic-year.entity';

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  student_id!: string;

  @Column({ type: 'uuid' })
  class_id!: string;

  @Column({ type: 'uuid', nullable: true })
  section_id!: string | null;

  @Column({ type: 'uuid' })
  academic_year_id!: string;

  @Column({ type: 'varchar', length: 50 })
  roll_number!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  custom_fee_amount!: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @ManyToOne(() => Student, { eager: true })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  // Uncomment and implement these entities when available
  // @ManyToOne(() => Class, { eager: true })
  // @JoinColumn({ name: 'class_id' })
  // class: Class;

  // @ManyToOne(() => Section, { eager: true, nullable: true })
  // @JoinColumn({ name: 'section_id' })
  // section: Section;

  // @ManyToOne(() => AcademicYear, { eager: true })
  // @JoinColumn({ name: 'academic_year_id' })
  // academicYear: AcademicYear;
}
