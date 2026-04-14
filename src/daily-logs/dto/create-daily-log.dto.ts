import { IsUUID, IsString, IsOptional, IsIn } from 'class-validator';

export class CreateDailyLogDto {
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsUUID()
  enrollment_id!: string;

  @IsString()
  @IsIn(['meal', 'nap', 'potty', 'mood', 'health'])
  category!: 'meal' | 'nap' | 'potty' | 'mood' | 'health';

  @IsString()
  log_value!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  @IsUUID()
  logged_by?: string;
}
