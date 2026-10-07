import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsStrongPassword,
  IsUUID,
  MaxLength,
} from 'class-validator';
export const ROLE_NAMES = ['SUPER_ADMIN', 'HR_ADMIN', 'HR_EXECUTIVE', 'MANAGER', 'EMPLOYEE'];
export class RolesDto {
  @ApiProperty({ isArray: true, enum: ROLE_NAMES })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsIn(ROLE_NAMES, { each: true })
  roles!: string[];
}
export class CreateUserDto extends RolesDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ format: 'password', minLength: 12 })
  @IsStrongPassword({ minLength: 12 })
  @MaxLength(72)
  password!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() employeeId?: string;
}
export class ActiveDto {
  @ApiProperty() @IsBoolean() active!: boolean;
}
