'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { getErrorMessage } from '@/lib/api/client';
import type { PayrollPeriod, PayrollStatus } from '@/lib/api/types';
import { formatMoney, monthLabel } from '@/lib/money';
import { useToast } from '@/providers/toast-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/common/data-table';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  type Tone,
} from '@/components/common/states';
import { useCreateRun, usePayrollPeriods } from './hooks';

export const PAYROLL_STATUS: Record<PayrollStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  IN_REVIEW: { label: 'In review', tone: 'warn' },
  APPROVED: { label: 'Approved', tone: 'ok' },
  LOCKED: { label: 'Locked', tone: 'info' },
};

function StartRunDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateRun();
  const toast = useToast();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async () => {
    setError(null);
    if (!month) return setError('Choose a month');
    setPending(true);
    try {
      await create.mutateAsync(month);
      toast(`Payroll run for ${monthLabel(month)} created`);
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
      setPending(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      title="Start payroll run"
      description="The server calculates every figure for the month you choose."
    >
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Field id="run-month" label="Month" required>
        <Input
          type="month"
          {...fieldProps('run-month')}
          max={format(new Date(), 'yyyy-MM')}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={pending}>
          {pending ? 'Starting…' : 'Start run'}
        </Button>
      </div>
    </Modal>
  );
}

export function PayrollPeriodsPage() {
  const { data, isLoading, isError, error, refetch } = usePayrollPeriods();
  const [starting, setStarting] = useState(false);
  const columns: Column<PayrollPeriod>[] = [
    {
      key: 'm',
      header: 'Month',
      cell: (p) => (
        <Link href={`/payroll/${p.id}`} className="font-medium hover:underline">
          {monthLabel(p.month)}
        </Link>
      ),
    },
    {
      key: 's',
      header: 'Status',
      cell: (p) => (
        <StatusBadge label={PAYROLL_STATUS[p.status].label} tone={PAYROLL_STATUS[p.status].tone} />
      ),
    },
    { key: 'e', header: 'Employees', cell: (p) => p.employeeCount },
    {
      key: 'g',
      header: 'Gross',
      cell: (p) => formatMoney(p.totalGross),
      className: 'text-right tabular-nums',
    },
    {
      key: 'd',
      header: 'Deductions',
      cell: (p) => formatMoney(p.totalDeductions),
      className: 'text-right tabular-nums',
    },
    {
      key: 'n',
      header: 'Net pay',
      cell: (p) => formatMoney(p.totalNet),
      className: 'text-right tabular-nums',
    },
    {
      key: 'a',
      header: 'Actions',
      cell: (p) => (
        <Link
          href={`/payroll/${p.id}`}
          aria-label={`Open ${monthLabel(p.month)}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Open
        </Link>
      ),
    },
  ];
  const card = (p: PayrollPeriod) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Link href={`/payroll/${p.id}`} className="font-medium">
          {monthLabel(p.month)}
        </Link>
        <StatusBadge label={PAYROLL_STATUS[p.status].label} tone={PAYROLL_STATUS[p.status].tone} />
      </div>
      <p className="text-sm text-muted">
        {p.employeeCount} employees · Net {formatMoney(p.totalNet)}
      </p>
    </div>
  );
  const start = (
    <Button onClick={() => setStarting(true)}>
      <Plus aria-hidden className="h-4 w-4" />
      Start payroll run
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Payroll"
        description="Payroll runs by month. Figures are calculated by the payroll service."
        actions={start}
      />
      {isLoading ? (
        <div role="status" aria-label="Loading payroll periods" className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No payroll runs yet"
          description="Start the first run to see it here."
          action={start}
        />
      ) : (
        <DataTable
          caption="Payroll periods"
          columns={columns}
          rows={data}
          getRowId={(p) => p.id}
          renderCard={card}
        />
      )}
      {starting && <StartRunDialog onClose={() => setStarting(false)} />}
    </>
  );
}
