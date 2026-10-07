import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class ShiftDto {
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiProperty({ minimum: 0, maximum: 1439, description: 'Minutes after local midnight' })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;
  @ApiProperty({ minimum: 0, maximum: 1439, description: 'End <= start indicates overnight shift' })
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinute!: number;
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  graceMinutes?: number;
  @ApiPropertyOptional({ default: 240 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  halfDayMinutes?: number;
  @ApiPropertyOptional({ default: 480 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  fullDayMinutes?: number;
  @ApiPropertyOptional({
    type: [Number],
    example: [7],
    description: 'ISO weekdays, Monday=1, Sunday=7',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weeklyOff?: number[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class ShiftUpdateDto extends PartialType(ShiftDto) {}
