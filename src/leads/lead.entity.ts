import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  VISITED = 'visited',
  ENROLLED = 'enrolled',
  CLOSED = 'closed',
}

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string | undefined;

  @Column({ type: 'varchar', length: 255 })
  parent_name: string | undefined;

  @Column({ type: 'varchar', length: 50 })
  parent_phone: string | undefined;

  @Column({ type: 'varchar', length: 255, nullable: true })
  parent_email: string | undefined;

  @Column({ type: 'varchar', length: 255 })
  child_name: string | undefined;

  @Column({ type: 'varchar', length: 20, nullable: true })
  child_dob: string | undefined;

  @Column({ type: 'varchar', length: 100, nullable: true })
  expected_class: string | undefined;

  @Column({
    type: 'varchar',
    length: 20,
    default: LeadStatus.NEW,
  })
  status: LeadStatus | undefined;

  @Column({ type: 'text', nullable: true })
  notes: string | undefined;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date | undefined;
}
