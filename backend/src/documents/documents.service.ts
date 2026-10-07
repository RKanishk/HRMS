import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService, isHR } from '../common/scope.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.types.js';
import { ObjectStorage } from './storage.js';
import { DocumentQuery, DocumentUploadDto } from './documents.dto.js';
import { pageArgs, paged } from '../common/dto.js';
const select = {
  id: true,
  employeeId: true,
  category: true,
  originalName: true,
  mimeType: true,
  size: true,
  sha256: true,
  uploadedBy: true,
  createdAt: true,
};
export function documentMime(data: Buffer) {
  if (data.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return null;
}
@Injectable()
export class DocumentsService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private storage: ObjectStorage,
  ) {}
  async list(u: Principal, q: DocumentQuery) {
    if (q.employeeId) await this.scope.employee(u, q.employeeId, true);
    const where = {
      employeeId: isHR(u) ? q.employeeId : (u.employeeId ?? '00000000-0000-0000-0000-000000000000'),
      deletedAt: null,
    };
    const [items, total] = await this.db.$transaction([
      this.db.employeeDocument.findMany({
        where,
        select,
        ...pageArgs(q),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.employeeDocument.count({ where }),
    ]);
    return paged(items, total, q);
  }
  async upload(u: Principal, d: DocumentUploadDto, file: Express.Multer.File) {
    await this.scope.employee(u, d.employeeId, true);
    if (!file || file.size === 0 || file.size > 5 * 1024 * 1024)
      throw new BadRequestException('Upload a PDF, PNG or JPEG, maximum 5 MiB');
    const mime = documentMime(file.buffer);
    if (!mime || mime !== file.mimetype)
      throw new BadRequestException('File content and allowed MIME type must match');
    const originalName = basename(file.originalname.replaceAll('\\', '/'))
      .replace(/[\x00-\x1f\x7f]/g, '')
      .slice(0, 180);
    if (!originalName) throw new BadRequestException('Invalid filename');
    const key = `${randomUUID()}.enc`;
    await this.storage.put(key, file.buffer);
    try {
      return await this.db.atomic(async (tx) => {
        await this.scope.employee(u, d.employeeId, true, tx);
        const row = await tx.employeeDocument.create({
          data: {
            ...d,
            originalName,
            mimeType: mime,
            size: file.size,
            storageKey: key,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            uploadedBy: u.id,
          },
          select,
        });
        await this.audit.write(
          tx,
          u.id,
          'document.uploaded',
          'EmployeeDocument',
          row.id,
          undefined,
          { employeeId: d.employeeId, category: d.category, size: file.size },
        );
        return row;
      });
    } catch (e) {
      await this.storage.remove(key);
      throw e;
    }
  }
  async download(u: Principal, id: string) {
    const row = await this.db.employeeDocument.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException('Document not found');
    await this.scope.employee(u, row.employeeId, true);
    const bytes = await this.storage.get(row.storageKey);
    if (createHash('sha256').update(bytes).digest('hex') !== row.sha256)
      throw new Error('Document integrity check failed');
    await this.db.atomic((tx) =>
      this.audit.write(tx, u.id, 'document.downloaded', 'EmployeeDocument', id, undefined, {
        employeeId: row.employeeId,
      }),
    );
    return { bytes, mime: row.mimeType, name: row.originalName };
  }
  remove(u: Principal, id: string) {
    return this.db.atomic(async (tx) => {
      const row = await tx.employeeDocument.findUniqueOrThrow({ where: { id } });
      await this.scope.employee(u, row.employeeId, true, tx);
      await tx.employeeDocument.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.write(tx, u.id, 'document.archived', 'EmployeeDocument', id, undefined, {
        employeeId: row.employeeId,
      });
      return { message: 'Document archived; retained for audit' };
    });
  }
}
