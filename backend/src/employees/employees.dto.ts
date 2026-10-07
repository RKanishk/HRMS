import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsEmail,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EmployeeStatus } from '../generated/prisma/enums.js';
import { PageQuery } from '../common/dto.js';
export class EmployeeCreateDto {
  @ApiProperty({ example: 'CIPL0021' }) @Matches(/^[A-Z0-9_-]{3,30}$/) employeeCode!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9 -]{7,20}$/) phone?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() departmentId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() designationId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() branchId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() shiftId!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() managerId?: string;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  joiningDate!: string;
  @ApiPropertyOptional({ enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] })
  @IsOptional()
  @IsEnum({
    FULL_TIME: 'FULL_TIME',
    PART_TIME: 'PART_TIME',
    CONTRACT: 'CONTRACT',
    INTERN: 'INTERN',
  })
  employmentType?: string;
}
export class EmployeeUpdateDto extends PartialType(EmployeeCreateDto) {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  confirmationDate?: string;
}
export class EmployeeStatusDto {
  @ApiProperty({ enum: EmployeeStatus }) @IsEnum(EmployeeStatus) status!: EmployeeStatus;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  resignationDate?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  lastWorkingDate?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) note!: string;
}
export class EmployeeQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() designationId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() managerId?: string;
  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}
export class PersonalDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5) bloodGroup?: string;
}
export class BankDto {
  @ApiProperty() @Matches(/^[0-9]{6,24}$/) accountNumber!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) accountHolder!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) bankName!: string;
  @ApiProperty() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/) ifsc!: string;
}
export class AddressDto {
  @ApiProperty({ enum: ['CURRENT', 'PERMANENT'] })
  @IsEnum({ CURRENT: 'CURRENT', PERMANENT: 'PERMANENT' })
  type!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) line1!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) city!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) state!: string;
  @ApiProperty() @Matches(/^[A-Z0-9 -]{3,12}$/) postalCode!: string;
  @ApiPropertyOptional({ default: 'IN' }) @IsOptional() @Matches(/^[A-Z]{2}$/) country?: string;
}
export class EmergencyDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) relationship!: string;
  @ApiProperty() @Matches(/^\+?[0-9 -]{7,20}$/) phone!: string;
}
export class EducationDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) institution!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) qualification!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1950) @Max(2100) completionYear!: number;
}
export class ExperienceDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(150) employer!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) title!: string;
  @ApiProperty({ format: 'date' }) @IsDateString({ strict: true }) startDate!: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;
}
