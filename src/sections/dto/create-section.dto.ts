import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class CreateSectionDto {
  @IsUUID()
  class_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}
