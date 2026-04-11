import { IsString, MinLength, MaxLength } from 'class-validator';

export class ResetAdminPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
