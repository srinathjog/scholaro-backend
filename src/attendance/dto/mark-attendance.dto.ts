import { IsUUID, IsDateString, IsIn } from 'class-validator';

export class MarkAttendanceDto {
  @IsUUID()
  enrollment_id!: string;

  @IsDateString()
  date!: string;

  @IsIn(['present', 'absent', 'late', 'leave'])
  status!: 'present' | 'absent' | 'late' | 'leave';
}
