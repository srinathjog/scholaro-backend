import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateActivityWithMediaDto {
  @IsUUID()
  tenant_id!: string;

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

  @IsUUID()
  created_by!: string;

  @IsArray()
  @IsString({ each: true })
  media_urls!: string[];
}
