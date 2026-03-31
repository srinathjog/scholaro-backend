import { IsUUID, IsDateString, IsIn } from 'class-validator';

export class CreateAttendanceDto {
  @IsUUID()
  enrollment_id!: string;

  @IsDateString()
  date!: string;

  @IsIn(['present', 'absent', 'leave'])
  status!: 'present' | 'absent' | 'leave';

  @IsUUID()
  marked_by!: string;
}
