'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/api/client';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageHeader,
  Skeleton,
} from '@/components/common/states';
import { useBranches, useDepartments } from '@/features/organization/hooks';
import { AttendanceStatusBadge, ATTENDANCE_META, STATUS_ORDER, formatWorked } from './status';
import { useDailyAttendance, type Scope } from './hooks';

const columns: Column<AttendanceRecord>[] = [
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
  { key: 'dept', header: 'Department', cell: (r) => r.departmentName },
  { key: 'branch', header: 'Branch', cell: (r) => r.branchName },
  { key: 'status', header: 'Status', cell: (r) => <AttendanceStatusBadge status={r.status} /> },
  { key: 'in', header: 'Check-in', cell: (r) => r.checkIn ?? '—' },
  { key: 'out', header: 'Check-out', cell: (r) => r.checkOut ?? '—' },
  { key: 'hrs', header: 'Hours worked', cell: (r) => formatWorked(r.workedMinutes) },
];
const card = (r: AttendanceRecord) => (
  <div className="space-y-1">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-medium">{r.employeeName}</p>
        <p className="text-xs text-muted">
          {r.employeeCode} · {r.departmentName}
        </p>
      </div>
      <AttendanceStatusBadge status={r.status} />
    </div>
    <p className="text-sm text-muted">
      In {r.checkIn ?? '—'} · Out {r.checkOut ?? '—'} · {formatWorked(r.workedMinutes)}
    </p>
  </div>
);

export function DailyAttendance({ scope }: { scope: Scope }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [f, setF] = useState({
    date: today,
    departmentId: '',
    branchId: '',
    status: '' as '' | AttendanceStatus,
    search: '',
    page: 1,
  });
  const [resetKey, setResetKey] = useState(0);
  const set = (patch: Partial<typeof f>) => setF((c) => ({ ...c, page: 1, ...patch }));
  const departments = useDepartments().data ?? [];
  const branches = useBranches().data ?? [];
  const { data, isLoading, isError, error, refetch, isFetching } = useDailyAttendance(scope, {
    ...f,
    pageSize: 10,
  });
  const filtered = !!(f.departmentId || f.branchId || f.status || f.search);
  const clear = () => {
    setF((c) => ({ ...c, departmentId: '', branchId: '', status: '', search: '', page: 1 }));
    setResetKey((k) => k + 1);
  };

  return (
    <>
      <PageHeader
        title={scope === 'team' ? 'Team attendance' : 'Attendance'}
        description={
          scope === 'team'
            ? 'How your direct reports are doing on a given day.'
            : 'Daily attendance register for the company.'
        }
      />
      <div
        role="search"
        aria-label="Attendance filters"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Input
          type="date"
          aria-label="Date"
          max={today}
          value={f.date}
          onChange={(e) => e.target.value && set({ date: e.target.value })}
        />
        <SearchInput
          key={resetKey}
          initialValue={f.search}
          onSearch={(v) => set({ search: v })}
          label="Search employees"
          placeholder="Search name or code"
        />
        {scope === 'all' && (
          <>
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
            <Select
              aria-label="Branch"
              value={f.branchId}
              onChange={(e) => set({ branchId: e.target.value })}
            >
              <option value="">All branches</option>
              {branches.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </>
        )}
        <Select
          aria-label="Attendance status"
          value={f.status}
          onChange={(e) => set({ status: e.target.value as '' | AttendanceStatus })}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {ATTENDANCE_META[s].label}
            </option>
          ))}
        </Select>
      </div>
      {filtered && (
        <Button variant="ghost" size="sm" className="mb-3" onClick={clear}>
          Clear filters
        </Button>
      )}

      {isLoading ? (
        <div role="status" aria-label="Loading attendance" className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <div
          aria-busy={isFetching}
          className={isFetching ? 'opacity-70 transition-opacity' : undefined}
        >
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STATUS_ORDER.map((s) => (
              <MetricCard key={s} label={ATTENDANCE_META[s].label} value={data.summary[s]} />
            ))}
          </div>
          {data.data.length === 0 ? (
            <EmptyState
              title="No attendance records"
              description={
                filtered
                  ? 'No one matches these filters on this date.'
                  : 'There are no attendance records for this date.'
              }
              action={
                filtered ? (
                  <Button variant="outline" onClick={clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <DataTable
                caption={`Attendance on ${f.date}`}
                columns={columns}
                rows={data.data}
                getRowId={(r) => r.employeeId}
                renderCard={card}
              />
              <Pagination {...data.meta} onPageChange={(p) => setF((c) => ({ ...c, page: p }))} />
            </>
          )}
        </div>
      )}
    </>
  );
}
