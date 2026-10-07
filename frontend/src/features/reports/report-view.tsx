'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/api/client';
import { saveFile } from '@/lib/api/download';
import { reportsApi, type ReportParams } from '@/lib/api/reports';
import type { ReportKind } from '@/lib/api/types';
import { formatMoney, monthLabel } from '@/lib/money';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import { useBranches, useDepartments } from '@/features/organization/hooks';
import { useLeaveTypes } from '@/features/leave/hooks';
import { usePayrollPeriods } from '@/features/payroll/hooks';
import { cn } from '@/lib/utils';

const META: Record<ReportKind, { title: string; description: string }> = {
  headcount: { title: 'Headcount report', description: 'Employees by department and status.' },
  attendance: {
    title: 'Attendance report',
    description: 'Attendance days by department for a date range.',
  },
  leave: { title: 'Leave report', description: 'Leave requests and days by leave type.' },
  payroll: {
    title: 'Payroll report',
    description: 'Payroll totals by department for a payroll run.',
  },
};

export function ReportView({ kind }: { kind: ReportKind }) {
  const toast = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [f, setF] = useState<ReportParams>({ from: `${today.slice(0, 7)}-01`, to: today });
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const departments = useDepartments().data ?? [];
  const branches = useBranches().data ?? [];
  const leaveTypes = useLeaveTypes().data ?? [];
  const periods = usePayrollPeriods().data ?? [];
  const set = (patch: ReportParams) => setF((c) => ({ ...c, ...patch }));
  const dateOrderBad =
    !!f.from && !!f.to && f.to < f.from && (kind === 'attendance' || kind === 'leave');
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reports', kind, f],
    queryFn: () => reportsApi.get(kind, f),
    enabled: !dateOrderBad,
  });

  const doExport = async (format: 'csv' | 'xlsx') => {
    setExporting(format);
    try {
      saveFile(await reportsApi.export(kind, format, f));
    } catch (e) {
      toast(getErrorMessage(e, 'Could not export the report.'), 'error');
    } finally {
      setExporting(null);
    }
  };
  const cell = (v: string | number | undefined, money?: boolean) =>
    typeof v === 'number' ? (money ? formatMoney(v) : v.toLocaleString('en-IN')) : (v ?? '—');

  return (
    <>
      <PageHeader
        title={META[kind].title}
        description={META[kind].description}
        actions={
          <>
            <Button
              variant="outline"
              disabled={exporting !== null || !data}
              onClick={() => void doExport('csv')}
            >
              <Download aria-hidden className="h-4 w-4" />
              {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button
              variant="outline"
              disabled={exporting !== null || !data}
              onClick={() => void doExport('xlsx')}
            >
              <Download aria-hidden className="h-4 w-4" />
              {exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}
            </Button>
          </>
        }
      />
      <div
        role="search"
        aria-label="Report filters"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {(kind === 'attendance' || kind === 'leave') && (
          <>
            <Field id="rep-from" label="From">
              <Input
                type="date"
                {...fieldProps('rep-from')}
                value={f.from ?? ''}
                max={today}
                onChange={(e) => set({ from: e.target.value })}
              />
            </Field>
            <Field
              id="rep-to"
              label="To"
              error={dateOrderBad ? 'The end date must be on or after the start date' : undefined}
            >
              <Input
                type="date"
                {...fieldProps('rep-to', dateOrderBad ? 'x' : undefined)}
                value={f.to ?? ''}
                max={today}
                onChange={(e) => set({ to: e.target.value })}
              />
            </Field>
          </>
        )}
        {
          <Field id="rep-dept" label="Department">
            <Select
              {...fieldProps('rep-dept')}
              value={f.departmentId ?? ''}
              onChange={(e) => set({ departmentId: e.target.value })}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        }
        {kind === 'headcount' && (
          <Field id="rep-branch" label="Branch">
            <Select
              {...fieldProps('rep-branch')}
              value={f.branchId ?? ''}
              onChange={(e) => set({ branchId: e.target.value })}
            >
              <option value="">All branches</option>
              {branches.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === 'leave' && (
          <Field id="rep-type" label="Leave type">
            <Select
              {...fieldProps('rep-type')}
              value={f.leaveTypeId ?? ''}
              onChange={(e) => set({ leaveTypeId: e.target.value })}
            >
              <option value="">All leave types</option>
              {leaveTypes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === 'payroll' && (
          <Field id="rep-period" label="Payroll run">
            <Select
              {...fieldProps('rep-period')}
              value={f.periodId ?? ''}
              onChange={(e) => set({ periodId: e.target.value })}
            >
              <option value="">Latest run</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {monthLabel(p.month)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {dateOrderBad ? (
        <EmptyState
          title="Check the dates"
          description="Choose an end date on or after the start date."
        />
      ) : isLoading ? (
        <div role="status" aria-label="Loading report" className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.rows.length === 0 ? (
        <EmptyState title="No data for these filters" />
      ) : (
        <div
          aria-busy={isFetching}
          className={cn(
            'overflow-x-auto rounded-lg border border-line bg-surface',
            isFetching && 'opacity-70',
          )}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">{META[kind].title}</caption>
            <thead className="border-b border-line bg-bg text-muted">
              <tr>
                {data.columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-3 font-medium',
                      c.numeric ? 'text-right' : 'text-left',
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {data.columns.map((c) =>
                    c.key === data.columns[0].key ? (
                      <th key={c.key} scope="row" className="px-4 py-3 text-left font-normal">
                        {r[c.key]}
                      </th>
                    ) : (
                      <td
                        key={c.key}
                        className={cn('px-4 py-3 tabular-nums', c.numeric && 'text-right')}
                      >
                        {cell(r[c.key], c.money)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
            {data.totals && (
              <tfoot className="border-t-2 border-line font-semibold">
                <tr>
                  {data.columns.map((c) =>
                    c.key === data.columns[0].key ? (
                      <th key={c.key} scope="row" className="px-4 py-3 text-left">
                        {data.totals![c.key]}
                      </th>
                    ) : (
                      <td
                        key={c.key}
                        className={cn('px-4 py-3 tabular-nums', c.numeric && 'text-right')}
                      >
                        {cell(data.totals![c.key], c.money)}
                      </td>
                    ),
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}
