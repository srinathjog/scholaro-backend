import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Activity } from './activity.entity';

@Entity('activity_media')
@Index('idx_activity_media_tenant_id', ['tenant_id'])
export class ActivityMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 255 })
  media_url!: string;

  @Column({ type: 'varchar', length: 50, default: 'image' })
  media_type!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @ManyToOne(() => Activity, (activity) => activity.media, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  activity!: Activity;
}
