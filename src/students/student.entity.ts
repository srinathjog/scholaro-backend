import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string | undefined;

  @Column({ type: 'varchar', length: 255 })
  first_name: string | undefined;

  @Column({ type: 'varchar', length: 255 })
  last_name: string | undefined;

  @Column({ type: 'date' })
  date_of_birth: Date | undefined;

  @Column({ type: 'varchar', length: 50 })
  gender: string | undefined;

  @Column({ type: 'date' })
  admission_date: Date | undefined;

  @Column({ type: 'varchar', length: 100 })
  status: string | undefined;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date | undefined;
}
