import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  parent_name!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  parent_phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  parent_email?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  child_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  child_dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  expected_class?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
