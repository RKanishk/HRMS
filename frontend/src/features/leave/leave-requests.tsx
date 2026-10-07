'use client';

import { useState } from 'react';
import { getErrorMessage } from '@/lib/api/client';
import type { LeaveRequest, RequestStatus } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/common/data-table';
import { DecisionDialog } from '@/components/common/decision-dialog';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '@/components/common/states';
import type { Scope } from '@/features/attendance/hooks';
import { REQUEST_LABEL, REQUEST_TONE } from '@/features/attendance/regularization-list';
import { useDepartments } from '@/features/organization/hooks';
import { useDecideLeave, useLeaveRequests } from './hooks';

const range = (l: LeaveRequest) =>
  l.fromDate === l.toDate
    ? formatDate(l.fromDate)
    : `${formatDate(l.fromDate)} – ${formatDate(l.toDate)}`;

export function LeaveRequests({
  scope,
  defaultStatus = 'PENDING',
}: {
  scope: Scope;
  defaultStatus?: RequestStatus | '';
}) {
  const [f, setF] = useState({ status: defaultStatus, departmentId: '', search: '', page: 1 });
  const set = (patch: Partial<typeof f>) => setF((c) => ({ ...c, page: 1, ...patch }));
  const departments = useDepartments().data ?? [];
  const { data, isLoading, isError, error, refetch, isFetching } = useLeaveRequests(scope, {
    ...f,
    pageSize: 10,
  });
  const decide = useDecideLeave();
  const toast = useToast();
  const [active, setActive] = useState<{ l: LeaveRequest; decision: 'approve' | 'reject' } | null>(
    null,
  );

  const actions = (l: LeaveRequest) =>
    l.status === 'PENDING' ? (
      <div className="flex gap-1">
        <Button
          size="sm"
          aria-label={`Approve leave for ${l.employeeName}`}
          onClick={() => setActive({ l, decision: 'approve' })}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Reject leave for ${l.employeeName}`}
          onClick={() => setActive({ l, decision: 'reject' })}
        >
          Reject
        </Button>
      </div>
    ) : (
      <span className="text-xs text-muted">{l.reviewerComment ?? '—'}</span>
    );
  const columns: Column<LeaveRequest>[] = [
    {
      key: 'emp',
      header: 'Employee',
      cell: (l) => (
        <div>
          <p className="font-medium">{l.employeeName}</p>
          <p className="text-xs text-muted">
            {l.employeeCode} · {l.departmentName}
          </p>
        </div>
      ),
    },
    { key: 'type', header: 'Leave type', cell: (l) => l.leaveTypeName },
    { key: 'dates', header: 'Dates', cell: range, className: 'whitespace-nowrap' },
    { key: 'days', header: 'Days', cell: (l) => l.days },
    {
      key: 'bal',
      header: 'Balance',
      cell: (l) => (l.availableBalance === null ? 'Unpaid' : `${l.availableBalance} available`),
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (l) => <StatusBadge label={REQUEST_LABEL[l.status]} tone={REQUEST_TONE[l.status]} />,
    },
    { key: 'act', header: 'Actions', cell: actions },
  ];
  const card = (l: LeaveRequest) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{l.employeeName}</p>
          <p className="text-xs text-muted">
            {l.leaveTypeName} · {l.days} day{l.days === 1 ? '' : 's'}
          </p>
        </div>
        <StatusBadge label={REQUEST_LABEL[l.status]} tone={REQUEST_TONE[l.status]} />
      </div>
      <p className="text-sm">{range(l)}</p>
      <p className="text-sm text-muted">{l.reason}</p>
      {l.availableBalance !== null && l.status === 'PENDING' && (
        <p className="text-xs text-muted">Balance: {l.availableBalance} available</p>
      )}
      {l.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setActive({ l, decision: 'approve' })}>
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setActive({ l, decision: 'reject' })}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        role="search"
        aria-label="Leave request filters"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SearchInput
          initialValue=""
          onSearch={(v) => set({ search: v })}
          label="Search employees"
          placeholder="Search name or code"
        />
        <Select
          aria-label="Request status"
          value={f.status}
          onChange={(e) => set({ status: e.target.value as RequestStatus | '' })}
        >
          <option value="PENDING">Pending</option>
          <option value="">All requests</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        {scope === 'all' && (
          <Select
            aria-label="Department"
            value={f.departmentId}
            onChange={(e) => set({ departmentId: e.target.value })}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {isLoading ? (
        <div role="status" aria-label="Loading leave requests" className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title={
            f.status === 'PENDING' ? 'Nothing waiting for approval' : 'No leave requests found'
          }
          description="New leave requests will show up here."
        />
      ) : (
        <div aria-busy={isFetching} className={isFetching ? 'opacity-70' : undefined}>
          <DataTable
            caption="Leave requests"
            columns={columns}
            rows={data.data}
            getRowId={(l) => l.id}
            renderCard={card}
          />
          <Pagination {...data.meta} onPageChange={(p) => setF((c) => ({ ...c, page: p }))} />
        </div>
      )}
      {active && (
        <DecisionDialog
          decision={active.decision}
          title={active.decision === 'approve' ? 'Approve leave' : 'Reject leave'}
          onClose={() => setActive(null)}
          summary={
            <div className="space-y-1">
              <p>
                {active.decision === 'approve' ? 'Approve' : 'Reject'}{' '}
                <strong>{active.l.leaveTypeName}</strong> for{' '}
                <strong>{active.l.employeeName}</strong>?
              </p>
              <p className="text-muted">
                {range(active.l)} · {active.l.days} day{active.l.days === 1 ? '' : 's'}
                {active.l.availableBalance !== null &&
                  ` · ${active.l.availableBalance} available before this request`}
              </p>
              <p className="text-muted">“{active.l.reason}”</p>
            </div>
          }
          onConfirm={async (comment) => {
            await decide.mutateAsync({ id: active.l.id, decision: active.decision, comment });
            toast(active.decision === 'approve' ? 'Leave approved' : 'Leave rejected');
          }}
        />
      )}
    </>
  );
}
