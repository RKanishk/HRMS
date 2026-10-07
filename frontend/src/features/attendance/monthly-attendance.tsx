'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import { useBranches, useDepartments } from '@/features/organization/hooks';
import { ATTENDANCE_META, STATUS_ORDER } from './status';
import { useMonthlyAttendance } from './hooks';

export function MonthlyAttendance() {
  const [f, setF] = useState({
    month: format(new Date(), 'yyyy-MM'),
    departmentId: '',
    branchId: '',
    search: '',
    page: 1,
  });
  const set = (patch: Partial<typeof f>) => setF((c) => ({ ...c, page: 1, ...patch }));
  const departments = useDepartments().data ?? [];
  const branches = useBranches().data ?? [];
  const { data, isLoading, isError, error, refetch, isFetching } = useMonthlyAttendance({
    ...f,
    pageSize: 15,
  });

  return (
    <>
      <PageHeader
        title="Monthly attendance"
        description="One row per employee, one column per day."
      />
      <div
        role="search"
        aria-label="Monthly attendance filters"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          type="month"
          aria-label="Month"
          value={f.month}
          onChange={(e) => e.target.value && set({ month: e.target.value })}
        />
        <SearchInput
          initialValue=""
          onSearch={(v) => set({ search: v })}
          label="Search employees"
          placeholder="Search name or code"
        />
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
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading monthly attendance" className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState title="No employees match" description="Try a different search or filter." />
      ) : (
        <div aria-busy={isFetching} className={isFetching ? 'opacity-70' : undefined}>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="border-collapse text-center text-xs">
              <caption className="sr-only">Attendance for {data.month}</caption>
              <thead>
                <tr className="bg-bg text-muted">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-44 bg-bg px-3 py-2 text-left text-sm font-medium"
                  >
                    Employee
                  </th>
                  {Array.from({ length: data.daysInMonth }, (_, i) => (
                    <th key={i} scope="col" className="min-w-8 px-1 py-2 font-medium">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.employeeId} className="border-t border-line">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-sm font-normal"
                    >
                      <span className="font-medium">{row.employeeName}</span>
                      <span className="block text-xs text-muted">{row.employeeCode}</span>
                    </th>
                    {row.days.map((s, i) => (
                      <td key={i} className="p-0.5">
                        {s ? (
                          <span
                            title={ATTENDANCE_META[s].label}
                            aria-label={ATTENDANCE_META[s].label}
                            className={`flex h-7 items-center justify-center rounded font-semibold ${ATTENDANCE_META[s].cell}`}
                          >
                            {ATTENDANCE_META[s].code}
                          </span>
                        ) : (
                          <span
                            aria-label="No record"
                            className="flex h-7 items-center justify-center text-muted"
                          >
                            ·
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul
            aria-label="Legend"
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"
          >
            {STATUS_ORDER.map((s) => (
              <li key={s}>
                <span
                  className={`mr-1 inline-flex h-5 min-w-6 items-center justify-center rounded px-1 font-semibold ${ATTENDANCE_META[s].cell}`}
                >
                  {ATTENDANCE_META[s].code}
                </span>
                {ATTENDANCE_META[s].label}
              </li>
            ))}
            <li>· No record</li>
          </ul>
          <Pagination {...data.meta} onPageChange={(p) => setF((c) => ({ ...c, page: p }))} />
        </div>
      )}
    </>
  );
}
