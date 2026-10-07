import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { DocumentQuery, DocumentUploadDto, DOCUMENT_CATEGORIES } from './documents.dto.js';
import { DocumentsService } from './documents.service.js';
@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private service: DocumentsService) {}
  @Get()
  @Permissions('documents.view')
  @Api('Document metadata; self or HR only', 'EmployeeDocument', 200, true)
  list(@CurrentUser() u: Principal, @Query() q: DocumentQuery) {
    return this.service.list(u, q);
  }
  @Post()
  @Permissions('documents.upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['employeeId', 'category', 'file'],
      properties: {
        employeeId: { type: 'string', format: 'uuid' },
        category: { type: 'string', enum: Object.values(DOCUMENT_CATEGORIES) },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @Api('Upload validated PDF/PNG/JPEG to private encrypted storage', 'EmployeeDocument', 201)
  upload(
    @CurrentUser() u: Principal,
    @Body() d: DocumentUploadDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(u, d, file);
  }
  @Get(':id/download')
  @Permissions('documents.view')
  @ApiProduces('application/octet-stream')
  @Api('Authorized document download; audited', 'BinaryDocument')
  async download(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.service.download(u, id);
    res.attachment(file.name).type(file.mime).send(file.bytes);
  }
  @Delete(':id') @Permissions('documents.manage') @Api('Soft archive document') remove(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(u, id);
  }
}
