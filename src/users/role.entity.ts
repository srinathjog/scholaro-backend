import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('roles')
@Unique(['name'])
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  name!: string;
}
