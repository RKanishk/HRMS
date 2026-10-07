'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/api/client';
import type { LeaveRequest } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable, type Column } from '@/components/common/data-table';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/common/states';
import { REQUEST_LABEL, REQUEST_TONE } from '@/features/attendance/regularization-list';
import { useCancelLeave, useLeaveBalances, useMyLeave } from './hooks';

const range = (l: LeaveRequest) =>
  l.fromDate === l.toDate
    ? formatDate(l.fromDate)
    : `${formatDate(l.fromDate)} – ${formatDate(l.toDate)}`;

export function MyLeave() {
  const balances = useLeaveBalances();
  const history = useMyLeave();
  const cancel = useCancelLeave();
  const toast = useToast();
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);

  const columns: Column<LeaveRequest>[] = [
    { key: 'type', header: 'Leave type', cell: (l) => l.leaveTypeName },
    { key: 'dates', header: 'Dates', cell: range, className: 'whitespace-nowrap' },
    { key: 'days', header: 'Days', cell: (l) => l.days },
    { key: 'reason', header: 'Reason', cell: (l) => l.reason },
    {
      key: 'status',
      header: 'Status',
      cell: (l) => <StatusBadge label={REQUEST_LABEL[l.status]} tone={REQUEST_TONE[l.status]} />,
    },
    { key: 'note', header: 'Reviewer note', cell: (l) => l.reviewerComment ?? '—' },
    {
      key: 'act',
      header: 'Actions',
      cell: (l) =>
        l.status === 'PENDING' ? (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Cancel ${l.leaveTypeName} request`}
            onClick={() => setCancelling(l)}
          >
            Cancel
          </Button>
        ) : null,
    },
  ];
  const card = (l: LeaveRequest) => (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {l.leaveTypeName} · {l.days} day{l.days === 1 ? '' : 's'}
          </p>
          <p className="text-sm text-muted">{range(l)}</p>
        </div>
        <StatusBadge label={REQUEST_LABEL[l.status]} tone={REQUEST_TONE[l.status]} />
      </div>
      <p className="text-sm">{l.reason}</p>
      {l.reviewerComment && <p className="text-xs text-muted">Reviewer: {l.reviewerComment}</p>}
      {l.status === 'PENDING' && (
        <Button size="sm" variant="outline" onClick={() => setCancelling(l)}>
          Cancel request
        </Button>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="My leave"
        description="Your balances and requests."
        actions={
          <Link href="/me/leave/apply" className={buttonVariants()}>
            Apply for leave
          </Link>
        }
      />
      <section aria-label="Leave balances" className="mb-8">
        {balances.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : balances.isError ? (
          <ErrorState
            message={getErrorMessage(balances.error)}
            onRetry={() => void balances.refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.data?.map((b) => (
              <div key={b.leaveTypeId} className="rounded-lg border border-line bg-surface p-4">
                <p className="text-sm text-muted">{b.leaveTypeName}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {b.available}
                  <span className="ml-1 text-sm font-normal text-muted">days available</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {b.used} used · {b.pending} pending · {b.entitled} per year
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      <h2 className="mb-3 text-lg font-semibold">Leave history</h2>
      {history.isLoading ? (
        <div role="status" aria-label="Loading leave history" className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : history.isError || !history.data ? (
        <ErrorState
          message={getErrorMessage(history.error)}
          onRetry={() => void history.refetch()}
        />
      ) : history.data.length === 0 ? (
        <EmptyState
          title="No leave requests yet"
          description="Apply for leave and it will show up here."
          action={
            <Link href="/me/leave/apply" className={buttonVariants()}>
              Apply for leave
            </Link>
          }
        />
      ) : (
        <DataTable
          caption="My leave requests"
          columns={columns}
          rows={history.data}
          getRowId={(l) => l.id}
          renderCard={card}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setCancelling(null)}
          title="Cancel leave request"
          confirmLabel="Cancel request"
          description={`Cancel your ${cancelling.leaveTypeName} request for ${range(cancelling)}?`}
          onConfirm={async () => {
            await cancel.mutateAsync(cancelling.id);
            toast('Leave request cancelled');
          }}
        />
      )}
    </>
  );
}
