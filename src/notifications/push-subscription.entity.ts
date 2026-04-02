import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('push_subscriptions')
@Index(['user_id', 'tenant_id'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenant_id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'text' })
  endpoint!: string;

  @Column({ type: 'varchar', length: 500 })
  p256dh!: string;

  @Column({ type: 'varchar', length: 500 })
  auth!: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
