import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo_url?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primary_color must be a valid hex color (e.g. #3B82F6)' })
  primary_color?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondary_color must be a valid hex color (e.g. #10B981)' })
  secondary_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  school_motto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact_phone?: string;
}
