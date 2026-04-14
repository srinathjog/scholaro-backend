import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeeDto {
  @IsUUID()
  enrollment_id!: string;

  @IsOptional()
  @IsUUID()
  fee_structure_id?: string;

  @IsString()
  @MaxLength(150)
  description!: string;

  @IsNumber()
  @Type(() => Number)
  total_amount!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discount_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  discount_reason?: string;

  @IsDateString()
  due_date!: string;
}
