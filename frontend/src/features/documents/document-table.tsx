'use client';

import { useState, type ReactNode } from 'react';
import { Download, Eye } from 'lucide-react';
import { getErrorMessage } from '@/lib/api/client';
import { documentsApi } from '@/lib/api/documents';
import { openFile, saveFile } from '@/lib/api/download';
import type { DocumentStatus, DocumentType, EmployeeDocument } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/common/data-table';
import { StatusBadge, type Tone } from '@/components/common/states';

export const DOC_TYPES: Record<DocumentType, string> = {
  ID_PROOF: 'ID proof',
  ADDRESS_PROOF: 'Address proof',
  EDUCATION: 'Education certificate',
  EXPERIENCE: 'Experience letter',
  OFFER_LETTER: 'Offer letter',
  OTHER: 'Other',
};
export const DOC_STATUS: Record<DocumentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending review', tone: 'warn' },
  VERIFIED: { label: 'Verified', tone: 'ok' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};
export const formatBytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;

export function FileActions({ doc }: { doc: EmployeeDocument }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'view' | 'download' | null>(null);
  const run = async (mode: 'view' | 'download') => {
    setBusy(mode);
    const win = mode === 'view' ? window.open('about:blank', '_blank') : null; // opened first so pop-up blockers allow it
    try {
      const file = await documentsApi.file(doc.id, doc.fileName);
      if (mode === 'view') openFile(file, win);
      else saveFile(file);
    } catch (e) {
      win?.close();
      toast(getErrorMessage(e, 'Could not open the file.'), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`View ${doc.fileName}`}
        disabled={busy !== null}
        onClick={() => void run('view')}
      >
        <Eye aria-hidden className="h-4 w-4" />
        View
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Download ${doc.fileName}`}
        disabled={busy !== null}
        onClick={() => void run('download')}
      >
        <Download aria-hidden className="h-4 w-4" />
        Download
      </Button>
    </>
  );
}

export function DocumentTable({
  docs,
  showEmployee = false,
  actions,
  caption,
}: {
  docs: EmployeeDocument[];
  showEmployee?: boolean;
  actions?: (d: EmployeeDocument) => ReactNode;
  caption: string;
}) {
  const statusCell = (d: EmployeeDocument) => (
    <div>
      <StatusBadge label={DOC_STATUS[d.status].label} tone={DOC_STATUS[d.status].tone} />
      {d.reviewerComment && <p className="mt-1 max-w-xs text-xs text-muted">{d.reviewerComment}</p>}
    </div>
  );
  const columns: Column<EmployeeDocument>[] = [
    ...(showEmployee
      ? [
          {
            key: 'emp',
            header: 'Employee',
            cell: (d: EmployeeDocument) => (
              <div>
                <p className="font-medium">{d.employeeName}</p>
                <p className="text-xs text-muted">{d.employeeCode}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'file',
      header: 'Document',
      cell: (d) => (
        <div>
          <p className="font-medium">{d.fileName}</p>
          <p className="text-xs text-muted">{formatBytes(d.sizeBytes)}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', cell: (d) => DOC_TYPES[d.documentType] },
    {
      key: 'date',
      header: 'Uploaded',
      cell: (d) => formatDate(d.uploadedAt),
      className: 'whitespace-nowrap',
    },
    { key: 'status', header: 'Status', cell: statusCell },
    {
      key: 'act',
      header: 'Actions',
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          <FileActions doc={d} />
          {actions?.(d)}
        </div>
      ),
    },
  ];
  const card = (d: EmployeeDocument) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{d.fileName}</p>
          <p className="text-xs text-muted">
            {showEmployee && `${d.employeeName} · `}
            {DOC_TYPES[d.documentType]} · {formatDate(d.uploadedAt)}
          </p>
        </div>
      </div>
      {statusCell(d)}
      <div className="flex flex-wrap gap-1">
        <FileActions doc={d} />
        {actions?.(d)}
      </div>
    </div>
  );
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={docs}
      getRowId={(d) => d.id}
      renderCard={card}
    />
  );
}
