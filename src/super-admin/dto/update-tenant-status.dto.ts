import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateTenantStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['active', 'inactive', 'suspended'])
  status!: string;
}
