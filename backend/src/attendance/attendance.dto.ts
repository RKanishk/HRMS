import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RangeQuery } from '../common/dto.js';
import { AttendanceStatus } from '../generated/prisma/enums.js';
export class PunchDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'HR import only; otherwise inferred from authenticated employee',
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
  @ApiProperty({ enum: ['IN', 'OUT'] }) @IsEnum({ IN: 'IN', OUT: 'OUT' }) direction!: 'IN' | 'OUT';
  @ApiPropertyOptional({ description: 'HR only; ISO timestamp with timezone' })
  @IsOptional()
  @IsDateString({ strict: true })
  occurredAt?: string;
  @ApiProperty({ description: 'Unique client event ID; retry safely', format: 'uuid' })
  @IsUUID()
  externalId!: string;
}
export class CalculateDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() employeeId!: string;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from!: string;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to!: string;
}
export class RegularizationDto {
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString({ strict: true }) checkIn!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString({ strict: true }) checkOut!: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
export class AttendanceQuery extends RangeQuery {
  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}
