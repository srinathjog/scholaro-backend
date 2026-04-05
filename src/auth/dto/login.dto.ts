import { IsEmail, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(100)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  school_code?: string;
}
