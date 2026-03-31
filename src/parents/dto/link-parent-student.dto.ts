import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class LinkParentStudentDto {
  @IsUUID()
  parent_user_id!: string;

  @IsUUID()
  student_id!: string;

  @IsString()
  @IsNotEmpty()
  relationship!: string; // e.g., 'father', 'mother', etc.
}
