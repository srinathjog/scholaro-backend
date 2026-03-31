import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('messages')
@Index(['tenant_id'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  tenant_id!: string;

  @ManyToOne(() => User, { eager: false })
  sender!: User;

  @Column('uuid')
  sender_id!: string;

  @ManyToOne(() => User, { eager: false })
  receiver!: User;

  @Column('uuid')
  receiver_id!: string;

  @Column('text')
  message_text!: string;

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @Column('uuid', { nullable: true })
  parent_student_id?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
