import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ComponentKind, RuleMethod } from '../generated/prisma/enums.js';
export class ComponentDto {
  @ApiProperty({ example: 'BASIC' }) @Matches(/^[A-Z][A-Z0-9_]{1,29}$/) code!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty({ enum: ComponentKind }) @IsEnum(ComponentKind) kind!: ComponentKind;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() statutory?: boolean;
}
export class SalaryRuleDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() componentId!: string;
  @ApiProperty({ enum: RuleMethod }) @IsEnum(RuleMethod) method!: RuleMethod;
  @ApiProperty({
    type: String,
    example: '25000.00',
    description: 'Decimal string; rate is a percentage for percent methods',
  })
  @Matches(/^\d{1,9}(\.\d{1,4})?$/)
  value!: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  wageCap?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  eligibilityGrossMax?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() prorate?: boolean;
}
export class StructureDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10000) version!: number;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveFrom!: string;
  @ApiProperty({ type: [SalaryRuleDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SalaryRuleDto)
  rules!: SalaryRuleDto[];
}
export class SalaryAssignmentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() employeeId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() structureId!: string;
  @ApiProperty({ format: 'date', description: 'First day of month, or employment joining date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveFrom!: string;
}
