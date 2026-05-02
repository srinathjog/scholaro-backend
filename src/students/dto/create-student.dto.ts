import { IsString, IsDateString, IsNotEmpty, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  last_name!: string;

  @IsDateString()
  @IsNotEmpty()
  date_of_birth!: string;

  @IsString()
  @IsIn(['male', 'female', 'other'])
  gender!: string;

  @IsDateString()
  @IsNotEmpty()
  admission_date!: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @IsUUID()
  class_id?: string;

  @IsOptional()
  @IsUUID()
  academic_year_id?: string;

  @IsOptional()
  @IsUUID()
  section_id?: string;
}
