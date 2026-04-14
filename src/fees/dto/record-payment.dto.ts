import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordPaymentDto {
  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  payment_method?: string; // e.g. "cash", "upi", "bank_transfer", "cheque"

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string; // UPI ref / cheque no / transaction ID
}
