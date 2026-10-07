'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { getErrorMessage } from '@/lib/api/client';
import type { PayrollAction } from '@/lib/api/payroll';
import type { PayrollEntry, PayrollStatus } from '@/lib/api/types';
import { formatMoney, monthLabel } from '@/lib/money';
import { useToast } from '@/providers/toast-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import {
  EmptyState,
  ErrorState,
  MetricCard,
  Skeleton,
  StatusBadge,
} from '@/components/common/states';
import { useDepartments } from '@/features/organization/hooks';
import { PayBreakdownView } from './pay-breakdown';
import { usePayrollAction, usePayrollEntries, usePayrollPeriod } from './hooks';
import { PAYROLL_STATUS } from './periods-page';

const NEXT: Partial<
  Record<PayrollStatus, { action: PayrollAction; label: string; title: string; text: string }>
> = {
  DRAFT: {
    action: 'submit',
    label: 'Submit for review',
    title: 'Submit payroll for review',
    text: 'The run moves to review. Nothing is published to employees yet.',
  },
  IN_REVIEW: {
    action: 'approve',
    label: 'Approve payroll',
    title: 'Approve payroll',
    text: 'Approving publishes each employee’s payslip and notifies them. This can’t be undone.',
  },
  APPROVED: {
    action: 'lock',
    label: 'Lock payroll',
    title: 'Lock payroll',
    text: 'Locking makes this run read-only. This can’t be undone.',
  },
};

export function PayrollPeriodDetail({ id }: { id: string }) {
  const [f, setF] = useState({ search: '', departmentId: '', page: 1 });
  const set = (patch: Partial<typeof f>) => setF((c) => ({ ...c, page: 1, ...patch }));
  const [review, setReview] = useState<PayrollEntry | null>(null);
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();
  const period = usePayrollPeriod(id);
  const entries = usePayrollEntries(id, { ...f, pageSize: 10 });
  const act = usePayrollAction(id);
  const departments = useDepartments().data ?? [];

  if (period.isLoading)
    return (
      <div role="status" aria-label="Loading payroll run" className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  if (period.isError || !period.data) {
    if (axios.isAxiosError(period.error) && period.error.response?.status === 404)
      return (
        <EmptyState
          title="Payroll run not found"
          action={
            <Link href="/payroll" className={buttonVariants({ variant: 'outline' })}>
              Back to payroll
            </Link>
          }
        />
      );
    return (
      <ErrorState message={getErrorMessage(period.error)} onRetry={() => void period.refetch()} />
    );
  }
  const p = period.data;
  const next = NEXT[p.status];

  const columns: Column<PayrollEntry>[] = [
    {
      key: 'emp',
      header: 'Employee',
      cell: (e) => (
        <div>
          <p className="font-medium">{e.employeeName}</p>
          <p className="text-xs text-muted">
            {e.employeeCode} · {e.departmentName}
          </p>
        </div>
      ),
    },
    {
      key: 'basic',
      header: 'Basic',
      cell: (e) => formatMoney(e.basic),
      className: 'text-right tabular-nums',
    },
    {
      key: 'gross',
      header: 'Gross',
      cell: (e) => formatMoney(e.gross),
      className: 'text-right tabular-nums',
    },
    {
      key: 'lop',
      header: 'LOP days',
      cell: (e) => e.lopDays,
      className: 'text-right tabular-nums',
    },
    {
      key: 'ded',
      header: 'Deductions',
      cell: (e) => formatMoney(e.totalDeductions),
      className: 'text-right tabular-nums',
    },
    {
      key: 'net',
      header: 'Net pay',
      cell: (e) => formatMoney(e.net),
      className: 'text-right font-medium tabular-nums',
    },
    {
      key: 'act',
      header: 'Actions',
      cell: (e) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Review payroll for ${e.employeeName}`}
          onClick={() => setReview(e)}
        >
          Review
        </Button>
      ),
    },
  ];
  const card = (e: PayrollEntry) => (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{e.employeeName}</p>
          <p className="text-xs text-muted">{e.employeeCode}</p>
        </div>
        <p className="font-semibold tabular-nums">{formatMoney(e.net)}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => setReview(e)}>
        Review
      </Button>
    </div>
  );

  return (
    <>
      <Link
        href="/payroll"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        All payroll runs
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payroll for {monthLabel(p.month)}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge
              label={PAYROLL_STATUS[p.status].label}
              tone={PAYROLL_STATUS[p.status].tone}
            />
            {p.status === 'LOCKED' && (
              <span className="text-sm text-muted">Locked and read-only.</span>
            )}
          </div>
        </div>
        {next && <Button onClick={() => setConfirming(true)}>{next.label}</Button>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Employees" value={p.employeeCount} />
        <MetricCard label="Gross pay" value={formatMoney(p.totalGross)} />
        <MetricCard label="Deductions" value={formatMoney(p.totalDeductions)} />
        <MetricCard label="Net pay" value={formatMoney(p.totalNet)} />
      </div>

      <section
        aria-label="Department summary"
        className="mb-6 rounded-lg border border-line bg-surface p-4"
      >
        <h2 className="mb-2 font-semibold">Net pay by department</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th scope="col" className="py-1.5 font-medium">
                Department
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Employees
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Net pay
              </th>
            </tr>
          </thead>
          <tbody>
            {p.departmentSummary.map((d) => (
              <tr key={d.department} className="border-t border-line">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {d.department}
                </th>
                <td className="py-1.5 text-right tabular-nums">{d.employees}</td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(d.totalNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="mb-3 text-lg font-semibold">Employees</h2>
      <div
        role="search"
        aria-label="Payroll filters"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
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
      </div>
      {entries.isLoading ? (
        <div role="status" aria-label="Loading payroll entries" className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : entries.isError || !entries.data ? (
        <ErrorState
          message={getErrorMessage(entries.error)}
          onRetry={() => void entries.refetch()}
        />
      ) : entries.data.data.length === 0 ? (
        <EmptyState
          title="No employees match"
          description="Try a different search or department."
        />
      ) : (
        <div
          aria-busy={entries.isFetching}
          className={entries.isFetching ? 'opacity-70' : undefined}
        >
          <DataTable
            caption="Payroll entries"
            columns={columns}
            rows={entries.data.data}
            getRowId={(e) => e.id}
            renderCard={card}
          />
          <Pagination
            {...entries.data.meta}
            onPageChange={(pg) => setF((c) => ({ ...c, page: pg }))}
          />
        </div>
      )}

      {review && (
        <Modal
          open
          onOpenChange={(o) => !o && setReview(null)}
          title={`${review.employeeName} · ${monthLabel(p.month)}`}
          description={`${review.employeeCode} · ${review.designationName}, ${review.departmentName}`}
        >
          <PayBreakdownView b={review} />
        </Modal>
      )}
      {confirming && next && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={next.title}
          description={`${monthLabel(p.month)}: ${next.text}`}
          confirmLabel={next.label}
          onConfirm={async () => {
            await act.mutateAsync(next.action);
            toast(`${next.label}: done`);
          }}
        />
      )}
    </>
  );
}
