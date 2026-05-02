import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSchoolDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;
}
