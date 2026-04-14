import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid')
  user_id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', nullable: true })
  qualification: string | null;

  @Column({ type: 'int', nullable: true })
  experience_years: number | null;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  created_at: Date;
}
