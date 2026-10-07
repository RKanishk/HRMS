'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import axios from 'axios';
import { getErrorMessage } from '@/lib/api/client';
import { saveFile } from '@/lib/api/download';
import { payrollApi } from '@/lib/api/payroll';
import { formatDate } from '@/lib/format';
import { formatMoney, monthLabel } from '@/lib/money';
import { useToast } from '@/providers/toast-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import { PayBreakdownView } from './pay-breakdown';
import { usePayslip, usePayslips } from './hooks';

export function PayslipsPage() {
  const { data, isLoading, isError, error, refetch } = usePayslips();
  return (
    <>
      <PageHeader
        title="My payslips"
        description="Payslips appear here once payroll is approved."
      />
      {isLoading ? (
        <div
          role="status"
          aria-label="Loading payslips"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No payslips yet"
          description="Your first payslip will show up after payroll is approved."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <li key={p.id}>
              <Link
                href={`/me/payslips/${p.id}`}
                className="block rounded-lg border border-line bg-surface p-4 hover:border-ink"
              >
                <p className="font-medium">{monthLabel(p.month)}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(p.net)}</p>
                <p className="text-xs text-muted">
                  Net pay · Gross {formatMoney(p.gross)} · Published {formatDate(p.publishedOn)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function PayslipDetail({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = usePayslip(id);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (isLoading)
    return (
      <div role="status" aria-label="Loading payslip" className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (isError || !data) {
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return (
        <EmptyState
          title="Payslip not found"
          action={
            <Link href="/me/payslips" className={buttonVariants({ variant: 'outline' })}>
              Back to payslips
            </Link>
          }
        />
      );
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  }
  const download = async () => {
    setBusy(true);
    try {
      saveFile(await payrollApi.downloadPayslip(data.id, data.month));
    } catch (e) {
      toast(getErrorMessage(e, 'Could not download the payslip.'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link
        href="/me/payslips"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink print:hidden"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        All payslips
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payslip for {monthLabel(data.month)}
          </h1>
          <p className="text-sm text-muted">
            {data.employeeName} · {data.employeeCode} · {data.designationName},{' '}
            {data.departmentName}
          </p>
          <p className="text-xs text-muted">Published {formatDate(data.publishedOn)}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={() => void download()} disabled={busy}>
            <Download aria-hidden className="h-4 w-4" />
            {busy ? 'Preparing…' : 'Download'}
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <PayBreakdownView b={data} />
      </div>
    </>
  );
}
