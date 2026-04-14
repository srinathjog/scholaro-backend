import { IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCustomFeeDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  custom_fee_amount?: number | null;
}
