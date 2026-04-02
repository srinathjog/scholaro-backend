import {
  IsUUID,
  IsDateString,
  IsDecimal,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFeeDto {
  @IsUUID()
  enrollment_id!: string;

  @IsOptional()
  @IsUUID()
  fee_structure_id?: string;

  @IsString()
  @MaxLength(150)
  description!: string;

  @IsDecimal({ decimal_digits: '0,2' })
  total_amount!: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  discount_amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  discount_reason?: string;

  @IsDateString()
  due_date!: string;
}
