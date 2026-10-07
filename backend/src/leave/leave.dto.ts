import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class LeaveTypeDto {
  @ApiProperty() @Matches(/^[A-Z0-9_]{2,20}$/) code!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty() @IsBoolean() paid!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class LeaveTypeUpdateDto extends PartialType(LeaveTypeDto) {}
export class LeavePolicyDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() leaveTypeId!: string;
  @ApiProperty() @IsInt() @Min(2020) @Max(2100) year!: number;
  @ApiProperty({ type: String, example: '12.00' })
  @Matches(/^\d{1,3}(\.\d{1,2})?$/)
  annualEntitlement!: string;
  @ApiPropertyOptional({ type: String, example: '0' })
  @IsOptional()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/)
  carryForwardLimit?: string;
}
export class AllocateLeaveDto {
  @ApiProperty() @IsInt() @Min(2020) @Max(2100) year!: number;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() employeeId?: string;
}
export class LeaveRequestDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() leaveTypeId!: string;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
