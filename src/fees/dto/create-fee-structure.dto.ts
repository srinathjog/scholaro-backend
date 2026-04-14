import {
  IsUUID,
  IsDateString,
  IsDecimal,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFeeStructureDto {
  @IsUUID()
  academic_year_id!: string;

  @IsUUID()
  class_id!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDecimal({ decimal_digits: '0,2' })
  amount!: string; // received as string from JSON, parsed in service

  @IsDateString()
  due_date!: string;

  @IsOptional()
  @IsIn(['one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly'])
  frequency?: 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
}
