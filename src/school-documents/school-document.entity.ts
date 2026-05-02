import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('school_documents')
export class SchoolDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string | undefined;

  @Column({ type: 'varchar', length: 255 })
  title: string | undefined;

  @Column({ type: 'text' })
  file_url: string | undefined;

  /** 'pdf' | 'image' */
  @Column({ type: 'varchar', length: 20 })
  file_type: string | undefined;

  @CreateDateColumn()
  created_at: Date | undefined;
}
