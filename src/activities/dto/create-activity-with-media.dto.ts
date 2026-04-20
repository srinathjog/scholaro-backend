import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateActivityWithMediaDto {
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsUUID()
  class_id!: string;

  @IsOptional()
  @IsUUID()
  section_id?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  activity_type!: string;

  @IsOptional()
  @IsUUID()
  created_by?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[];

  @IsOptional()
  @IsUUID()
  student_id?: string;
}
