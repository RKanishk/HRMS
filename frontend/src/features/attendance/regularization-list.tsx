'use client';

import { useState } from 'react';
import { getErrorMessage } from '@/lib/api/client';
import type { Regularization, RequestStatus } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/common/data-table';
import { DecisionDialog } from '@/components/common/decision-dialog';
import {
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  type Tone,
} from '@/components/common/states';
import { useDecideRegularization, useRegularizations, type Scope } from './hooks';

export const REQUEST_TONE: Record<RequestStatus, Tone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};
export const REQUEST_LABEL: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function RegularizationList({ scope }: { scope: Scope }) {
  const [status, setStatus] = useState<RequestStatus | ''>('PENDING');
  const { data, isLoading, isError, error, refetch } = useRegularizations(scope, status);
  const decide = useDecideRegularization();
  const toast = useToast();
  const [active, setActive] = useState<{
    r: Regularization;
    decision: 'approve' | 'reject';
  } | null>(null);

  const columns: Column<Regularization>[] = [
    {
      key: 'emp',
      header: 'Employee',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.employeeName}</p>
          <p className="text-xs text-muted">{r.employeeCode}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      cell: (r) => formatDate(r.date),
      className: 'whitespace-nowrap',
    },
    {
      key: 'times',
      header: 'Requested times',
      cell: (r) => `${r.requestedCheckIn} – ${r.requestedCheckOut}`,
      className: 'whitespace-nowrap',
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (r) => <span className="line-clamp-2 max-w-xs">{r.reason}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge label={REQUEST_LABEL[r.status]} tone={REQUEST_TONE[r.status]} />,
    },
    {
      key: 'act',
      header: 'Actions',
      cell: (r) =>
        r.status === 'PENDING' ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              aria-label={`Approve request from ${r.employeeName}`}
              onClick={() => setActive({ r, decision: 'approve' })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Reject request from ${r.employeeName}`}
              onClick={() => setActive({ r, decision: 'reject' })}
            >
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted">{r.reviewerComment ?? '—'}</span>
        ),
    },
  ];
  const card = (r: Regularization) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{r.employeeName}</p>
          <p className="text-xs text-muted">
            {formatDate(r.date)} · {r.requestedCheckIn} – {r.requestedCheckOut}
          </p>
        </div>
        <StatusBadge label={REQUEST_LABEL[r.status]} tone={REQUEST_TONE[r.status]} />
      </div>
      <p className="text-sm">{r.reason}</p>
      {r.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setActive({ r, decision: 'approve' })}>
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setActive({ r, decision: 'reject' })}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div role="group" aria-label="Filter by status" className="mb-4 flex gap-2">
        {(['PENDING', ''] as const).map((s) => (
          <Button
            key={s || 'all'}
            variant={status === s ? 'primary' : 'outline'}
            size="sm"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
          >
            {s ? 'Pending' : 'All requests'}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <div role="status" aria-label="Loading requests" className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title={status ? 'Nothing waiting for review' : 'No regularization requests'}
          description={
            status ? 'New attendance regularization requests will show up here.' : undefined
          }
        />
      ) : (
        <DataTable
          caption="Attendance regularization requests"
          columns={columns}
          rows={data}
          getRowId={(r) => r.id}
          renderCard={card}
        />
      )}
      {active && (
        <DecisionDialog
          decision={active.decision}
          title={active.decision === 'approve' ? 'Approve regularization' : 'Reject regularization'}
          onClose={() => setActive(null)}
          summary={
            <p>
              {active.decision === 'approve' ? 'Approve' : 'Reject'} the request from{' '}
              <strong>{active.r.employeeName}</strong> for {formatDate(active.r.date)} (
              {active.r.requestedCheckIn} – {active.r.requestedCheckOut})?{' '}
              {active.decision === 'approve' && 'Their attendance for that day will be updated.'}
            </p>
          }
          onConfirm={async (comment) => {
            await decide.mutateAsync({ id: active.r.id, decision: active.decision, comment });
            toast(
              active.decision === 'approve' ? 'Regularization approved' : 'Regularization rejected',
            );
          }}
        />
      )}
    </>
  );
}
