import { IsDecimal, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordPaymentDto {
  @IsDecimal({ decimal_digits: '0,2' })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  payment_method?: string; // e.g. "cash", "upi", "bank_transfer", "cheque"

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string; // UPI ref / cheque no / transaction ID
}
