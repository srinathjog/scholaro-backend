import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Class } from '../classes/class.entity';
import { Section } from '../sections/section.entity';

@Entity('teacher_assignments')
@Unique(['teacher_id', 'class_id', 'section_id', 'academic_year_id'])
export class TeacherAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  tenant_id!: string;

  @Column('uuid')
  teacher_id!: string;

  @Column('uuid')
  class_id!: string;

  @Column('uuid', { nullable: true })
  section_id!: string | null;

  @Column('uuid')
  academic_year_id!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @ManyToOne(() => Class, { eager: false })
  @JoinColumn({ name: 'class_id' })
  assignedClass!: Class;

  @ManyToOne(() => Section, { eager: false, nullable: true })
  @JoinColumn({ name: 'section_id' })
  section!: Section | null;
}
