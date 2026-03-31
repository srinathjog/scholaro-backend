import { IsUUID, IsOptional } from 'class-validator';

export class CreateTeacherAssignmentDto {
  @IsUUID()
  teacher_id!: string;

  @IsUUID()
  class_id!: string;

  @IsUUID()
  @IsOptional()
  section_id?: string;

  @IsUUID()
  academic_year_id!: string;
}
