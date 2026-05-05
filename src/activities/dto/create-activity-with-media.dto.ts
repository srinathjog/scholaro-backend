import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
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
  @ArrayMaxSize(40)
  @IsString({ each: true })
  media_urls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  media_types?: string[];

  /** @deprecated use student_ids */
  @IsOptional()
  @IsUUID()
  student_id?: string;

  /** Target specific students. Empty array or omitted = class-wide post. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  student_ids?: string[];
}
