import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../super-admin/tenant.entity';

@Entity('tenant_settings')
export class TenantSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url!: string | null;

  @Column({ type: 'varchar', length: 20, default: '#3B82F6' })
  primary_color!: string;

  @Column({ type: 'varchar', length: 20, default: '#10B981' })
  secondary_color!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  school_motto!: string | null;

  @Column({ type: 'varchar', length: 20 })
  contact_phone!: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;
}
