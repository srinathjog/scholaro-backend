import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ActivityMedia } from './activity-media.entity';
import { Class } from '../classes/class.entity';

@Entity('activities')
@Index('idx_activities_tenant_id', ['tenant_id'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: false })
  class_id!: string;

  @ManyToOne(() => Class, { eager: false })
  @JoinColumn({ name: 'class_id' })
  assignedClass!: Class;

  @Column({ type: 'uuid', nullable: true })
  section_id!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 50 })
  activity_type!: string;

  @Column({ type: 'uuid', nullable: false })
  created_by!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  // Many activities can be created by one user
  @ManyToOne(() => User, (user) => user.activities, { nullable: false })
  user!: User;

  // One activity can have many media
  @OneToMany(() => ActivityMedia, (media) => media.activity)
  media!: ActivityMedia[];
}
