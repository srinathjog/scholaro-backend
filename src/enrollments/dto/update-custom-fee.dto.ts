import { IsOptional, IsNumberString } from 'class-validator';

export class UpdateCustomFeeDto {
  @IsOptional()
  @IsNumberString()
  custom_fee_amount?: string | null;
}
