import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
export class OnboardingDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() employeeId!: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(150, { each: true })
  extraTasks?: string[];
}
export class OffboardingDto extends OnboardingDto {
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  resignationDate!: string;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  lastWorkingDate!: string;
}
export class TaskDto {
  @ApiProperty() @IsBoolean() completed!: boolean;
}
