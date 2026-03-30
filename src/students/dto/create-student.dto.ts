import { IsString, IsDateString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsDateString()
  @IsNotEmpty()
  date_of_birth: string;

  @IsString()
  @IsIn(['male', 'female', 'other'])
  gender: string;

  @IsDateString()
  @IsNotEmpty()
  admission_date: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}
