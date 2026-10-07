import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class PageQuery {
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ default: 'createdAt' }) @IsOptional() @IsString() @MaxLength(40) sortBy =
    'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'] }) @IsEnum({ asc: 'asc', desc: 'desc' }) sortOrder:
    'asc' | 'desc' = 'desc';
}
export class RangeQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() employeeId?: string;
}
export class ReviewDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum({ APPROVED: 'APPROVED', REJECTED: 'REJECTED' })
  decision!: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export const pageArgs = (q: PageQuery) => ({ skip: (q.page - 1) * q.limit, take: q.limit });
export const paged = <T>(items: T[], total: number, q: PageQuery) => ({
  items,
  meta: { total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) },
});
