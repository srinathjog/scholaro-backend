import { IsUUID, IsDateString, IsIn } from 'class-validator';

export class CreateAttendanceDto {
  @IsUUID()
  enrollment_id!: string;

  @IsDateString()
  date!: string;

  @IsIn(['present', 'absent', 'late', 'leave'])
  status!: 'present' | 'absent' | 'late' | 'leave';

  @IsUUID()
  marked_by!: string;
}
