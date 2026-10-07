import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ComponentKind } from '../generated/prisma/enums.js';
export class PeriodDto {
  @ApiProperty() @IsInt() @Min(2020) @Max(2100) year!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(12) month!: number;
}
export class PayrollInputDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() employeeId!: string;
  @ApiProperty({
    example: 'OVERTIME',
    description: 'Distinct variable code, e.g. BONUS, OVERTIME, REIMBURSEMENT or ADJUSTMENT',
  })
  @Matches(/^[A-Z][A-Z0-9_]{1,29}$/)
  code!: string;
  @ApiProperty({ enum: ComponentKind }) @IsEnum(ComponentKind) kind!: ComponentKind;
  @ApiProperty({ type: String, example: '1250.50' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  amount!: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) note!: string;
}
