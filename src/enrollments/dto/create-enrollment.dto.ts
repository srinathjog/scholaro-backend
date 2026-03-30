import { IsUUID, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  @IsNotEmpty()
  student_id!: string;

  @IsUUID()
  @IsNotEmpty()
  class_id!: string;

  @IsUUID()
  @IsOptional()
  section_id?: string;

  @IsUUID()
  @IsNotEmpty()
  academic_year_id!: string;

  @IsString()
  @IsOptional()
  roll_number?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
