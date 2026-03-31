import { IsUUID, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  tenant_id!: string;

  @IsUUID()
  sender_id!: string;

  @IsUUID()
  receiver_id!: string;

  @IsString()
  message_text!: string;

  @IsBoolean()
  @IsOptional()
  is_read?: boolean;

  @IsUUID()
  @IsOptional()
  parent_student_id?: string;
}
