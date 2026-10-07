'use client';

import { useState } from 'react';
import { getErrorMessage } from '@/lib/api/client';
import type { DocumentStatus, DocumentType, EmployeeDocument } from '@/lib/api/types';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DecisionDialog } from '@/components/common/decision-dialog';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import { DOC_TYPES, DocumentTable } from './document-table';
import {
  useDecideDocument,
  useDeleteDocument,
  useDocuments,
  useEmployeeDocuments,
  useMyDocuments,
} from './hooks';
import { UploadPanel } from './upload-panel';

const Loading = () => (
  <div role="status" aria-label="Loading documents" className="space-y-2">
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={i} className="h-14 w-full" />
    ))}
  </div>
);

export function MyDocumentsPage() {
  const { data, isLoading, isError, error, refetch } = useMyDocuments();
  const remove = useDeleteDocument();
  const toast = useToast();
  const [deleting, setDeleting] = useState<EmployeeDocument | null>(null);
  return (
    <>
      <PageHeader
        title="My documents"
        description="Upload documents HR asks for and track their review."
      />
      <UploadPanel />
      <h2 className="mb-3 text-lg font-semibold">Uploaded documents</h2>
      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Documents you upload will be listed here."
        />
      ) : (
        <DocumentTable
          caption="My documents"
          docs={data}
          actions={(d) =>
            d.status !== 'VERIFIED' ? (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${d.fileName}`}
                onClick={() => setDeleting(d)}
              >
                Delete
              </Button>
            ) : null
          }
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Delete document"
          confirmLabel="Delete"
          description={`Delete “${deleting.fileName}”? This can’t be undone.`}
          onConfirm={async () => {
            await remove.mutateAsync(deleting.id);
            toast('Document deleted');
          }}
        />
      )}
    </>
  );
}

export function HrDocumentsPage() {
  const [f, setF] = useState({
    search: '',
    status: 'PENDING' as DocumentStatus | '',
    documentType: '' as DocumentType | '',
    page: 1,
  });
  const set = (patch: Partial<typeof f>) => setF((c) => ({ ...c, page: 1, ...patch }));
  const { data, isLoading, isError, error, refetch, isFetching } = useDocuments({
    ...f,
    pageSize: 10,
  });
  const decide = useDecideDocument();
  const toast = useToast();
  const [active, setActive] = useState<{
    d: EmployeeDocument;
    decision: 'verify' | 'reject';
  } | null>(null);
  return (
    <>
      <PageHeader
        title="Documents"
        description="Employee documents waiting for review, and everything already on file."
      />
      <div
        role="search"
        aria-label="Document filters"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SearchInput
          initialValue=""
          onSearch={(v) => set({ search: v })}
          label="Search documents"
          placeholder="Search employee or file"
        />
        <Select
          aria-label="Review status"
          value={f.status}
          onChange={(e) => set({ status: e.target.value as DocumentStatus | '' })}
        >
          <option value="PENDING">Pending review</option>
          <option value="">All statuses</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <Select
          aria-label="Document type"
          value={f.documentType}
          onChange={(e) => set({ documentType: e.target.value as DocumentType | '' })}
        >
          <option value="">All types</option>
          {(Object.keys(DOC_TYPES) as DocumentType[]).map((t) => (
            <option key={t} value={t}>
              {DOC_TYPES[t]}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title={f.status === 'PENDING' ? 'Nothing waiting for review' : 'No documents found'}
        />
      ) : (
        <div aria-busy={isFetching} className={isFetching ? 'opacity-70' : undefined}>
          <DocumentTable
            caption="Employee documents"
            showEmployee
            docs={data.data}
            actions={(d) =>
              d.status === 'PENDING' ? (
                <>
                  <Button
                    size="sm"
                    aria-label={`Verify ${d.fileName}`}
                    onClick={() => setActive({ d, decision: 'verify' })}
                  >
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Reject ${d.fileName}`}
                    onClick={() => setActive({ d, decision: 'reject' })}
                  >
                    Reject
                  </Button>
                </>
              ) : null
            }
          />
          <Pagination {...data.meta} onPageChange={(p) => setF((c) => ({ ...c, page: p }))} />
        </div>
      )}
      {active && (
        <DecisionDialog
          decision={active.decision === 'verify' ? 'approve' : 'reject'}
          confirmLabel={active.decision === 'verify' ? 'Verify document' : 'Reject document'}
          title={active.decision === 'verify' ? 'Verify document' : 'Reject document'}
          onClose={() => setActive(null)}
          summary={
            <p>
              {active.decision === 'verify' ? 'Verify' : 'Reject'}{' '}
              <strong>{active.d.fileName}</strong> from {active.d.employeeName}? They will be
              notified.
            </p>
          }
          onConfirm={async (comment) => {
            await decide.mutateAsync({ id: active.d.id, decision: active.decision, comment });
            toast(active.decision === 'verify' ? 'Document verified' : 'Document rejected');
          }}
        />
      )}
    </>
  );
}

export function EmployeeDocuments({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError, error, refetch } = useEmployeeDocuments(employeeId);
  if (isLoading) return <Loading />;
  if (isError || !data)
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  if (data.length === 0) return <EmptyState title="No documents on file" />;
  return <DocumentTable caption="Employee documents" docs={data} />;
}
