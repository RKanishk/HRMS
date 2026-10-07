import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageQuery } from '../common/dto.js';
export const DOCUMENT_CATEGORIES = {
  OFFER: 'OFFER',
  APPOINTMENT: 'APPOINTMENT',
  RESUME: 'RESUME',
  CERTIFICATE: 'CERTIFICATE',
  IDENTITY: 'IDENTITY',
  EXPERIENCE: 'EXPERIENCE',
  OTHER: 'OTHER',
};
export class DocumentUploadDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() employeeId!: string;
  @ApiProperty({ enum: Object.values(DOCUMENT_CATEGORIES) })
  @IsEnum(DOCUMENT_CATEGORIES)
  category!: string;
}
export class DocumentQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() employeeId?: string;
}
