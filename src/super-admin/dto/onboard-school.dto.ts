import { IsEmail, IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class OnboardSchoolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  schoolName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'subdomain must be lowercase alphanumeric with hyphens only',
  })
  subdomain!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/, {
    message:
      'tenantCode must be uppercase alphanumeric only (e.g. HEARTS, SUNSHINE)',
  })
  tenantCode!: string;

  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  adminName!: string;
}
