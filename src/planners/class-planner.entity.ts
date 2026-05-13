import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('class_planners')
@Index(['tenant_id', 'class_id', 'month', 'year'])
export class ClassPlanner {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string | undefined;

  @Column({ type: 'uuid' })
  class_id: string | undefined;

  @Column({ type: 'uuid', nullable: true })
  section_id: string | undefined;

  @Column({ type: 'text' })
  file_url: string | undefined;

  /** 'pdf' | 'image' */
  @Column({ type: 'varchar', length: 20 })
  file_type: string | undefined;

  /** e.g. 'May', 'June' */
  @Column({ type: 'varchar', length: 20 })
  month: string | undefined;

  @Column({ type: 'int' })
  year: number | undefined;

  /** teacher user UUID who uploaded this */
  @Column({ type: 'uuid' })
  uploaded_by: string | undefined;

  @CreateDateColumn()
  created_at: Date | undefined;
}
