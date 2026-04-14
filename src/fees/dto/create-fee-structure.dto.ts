import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsDateString()
  due_date!: string;

  @IsOptional()
  @IsIn(['one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly'])
  frequency?: 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
}
