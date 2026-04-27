import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EventType {
  HOLIDAY = 'holiday',
  EVENT = 'event',
  EXAM = 'exam',
  PTM = 'ptm',
}

@Entity('events_calendar')
export class EventsCalendar {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string | undefined;

  @Column({ type: 'varchar', length: 255 })
  title: string | undefined;

  @Column({ type: 'text', nullable: true })
  description: string | undefined;

  @Column({ type: 'date' })
  event_date: string | undefined;

  @Column({
    type: 'enum',
    enum: EventType,
  })
  type: EventType | undefined;

  @Column({ type: 'boolean', default: false })
  is_school_closed: boolean | undefined;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date | undefined;
}
