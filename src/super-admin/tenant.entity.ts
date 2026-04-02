import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subdomain!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status!: string;

  @CreateDateColumn({ type: 'timestamp without time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp without time zone' })
  updated_at!: Date;
}
