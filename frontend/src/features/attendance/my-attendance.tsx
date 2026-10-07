'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/api/client';
import type { Regularization } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type Column } from '@/components/common/data-table';
import { MonthCalendar } from '@/components/common/month-calendar';
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/common/states';
import { ATTENDANCE_META, STATUS_ORDER } from './status';
import { useMyAttendance, useMyRegularizations, useRequestRegularization } from './hooks';
import { REQUEST_LABEL, REQUEST_TONE } from './regularization-list';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time like 09:30');
const schema = z
  .object({
    date: z
      .string()
      .min(1, 'Select the date')
      .refine((v) => v <= format(new Date(), 'yyyy-MM-dd'), 'Choose today or an earlier date'),
    requestedCheckIn: time,
    requestedCheckOut: time,
    reason: z.string().trim().min(5, 'Give a short reason (at least 5 characters)'),
  })
  .refine((v) => v.requestedCheckOut > v.requestedCheckIn, {
    path: ['requestedCheckOut'],
    message: 'Check-out must be after check-in',
  });
type Values = z.infer<typeof schema>;

function RegularizationDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const toast = useToast();
  const save = useRequestRegularization();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { date, requestedCheckIn: '09:30', requestedCheckOut: '18:30', reason: '' },
  });
  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await save.mutateAsync(v);
      toast('Regularization request sent');
      onClose();
    } catch (e) {
      setServerError(
        getErrorMessage(e, 'Could not send the request. Your entries are still here.'),
      );
    }
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Request attendance regularization"
      description="Your manager will review the times you enter."
    >
      <form onSubmit={submit} noValidate aria-busy={isSubmitting} className="space-y-4">
        {serverError && (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {serverError}
          </p>
        )}
        <Field id="reg-date" label="Date" required error={errors.date?.message}>
          <Input
            type="date"
            max={format(new Date(), 'yyyy-MM-dd')}
            {...fieldProps('reg-date', errors.date?.message)}
            {...register('date')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="reg-in" label="Check-in" required error={errors.requestedCheckIn?.message}>
            <Input
              type="time"
              {...fieldProps('reg-in', errors.requestedCheckIn?.message)}
              {...register('requestedCheckIn')}
            />
          </Field>
          <Field id="reg-out" label="Check-out" required error={errors.requestedCheckOut?.message}>
            <Input
              type="time"
              {...fieldProps('reg-out', errors.requestedCheckOut?.message)}
              {...register('requestedCheckOut')}
            />
          </Field>
        </div>
        <Field id="reg-reason" label="Reason" required error={errors.reason?.message}>
          <Textarea {...fieldProps('reg-reason', errors.reason?.message)} {...register('reason')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function MyAttendance() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, isLoading, isError, error, refetch } = useMyAttendance(month);
  const regs = useMyRegularizations();
  const byDate = new Map((data?.days ?? []).map((d) => [d.date, d]));

  const cols: Column<Regularization>[] = [
    { key: 'date', header: 'Date', cell: (r) => formatDate(r.date) },
    {
      key: 'times',
      header: 'Requested times',
      cell: (r) => `${r.requestedCheckIn} – ${r.requestedCheckOut}`,
    },
    { key: 'reason', header: 'Reason', cell: (r) => r.reason },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge label={REQUEST_LABEL[r.status]} tone={REQUEST_TONE[r.status]} />,
    },
    { key: 'note', header: 'Reviewer note', cell: (r) => r.reviewerComment ?? '—' },
  ];
  const card = (r: Regularization) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="font-medium">{formatDate(r.date)}</p>
        <StatusBadge label={REQUEST_LABEL[r.status]} tone={REQUEST_TONE[r.status]} />
      </div>
      <p className="text-sm text-muted">
        {r.requestedCheckIn} – {r.requestedCheckOut}
      </p>
      <p className="text-sm">{r.reason}</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title="My attendance"
        description="Your month at a glance. Tap a working day to ask for a correction."
        actions={<Button onClick={() => setDialogDate(today)}>Request regularization</Button>}
      />
      <div className="mb-4 max-w-xs">
        <Input
          type="month"
          aria-label="Month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STATUS_ORDER.map((s) => (
              <MetricCard key={s} label={ATTENDANCE_META[s].label} value={data.summary[s]} />
            ))}
          </div>
          <MonthCalendar
            month={month}
            caption={`Attendance for ${month}`}
            renderDay={(date, day) => {
              const d = byDate.get(date);
              const meta = d?.status ? ATTENDANCE_META[d.status] : null;
              const canFix =
                d?.status === 'PRESENT' || d?.status === 'ABSENT' || d?.status === 'HALF_DAY';
              const inner = (
                <>
                  <span className="text-xs font-medium text-muted">{day}</span>
                  {meta && (
                    <span
                      className={`mt-1 block rounded px-1.5 py-0.5 text-xs font-semibold ${meta.cell}`}
                    >
                      {meta.label}
                    </span>
                  )}
                  {d?.checkIn && (
                    <span className="mt-1 block text-[11px] text-muted">
                      {d.checkIn}
                      {d.checkOut ? ` – ${d.checkOut}` : ''}
                    </span>
                  )}
                </>
              );
              return canFix ? (
                <button
                  type="button"
                  aria-label={`${formatDate(date)}: ${meta?.label}. Request regularization`}
                  onClick={() => setDialogDate(date)}
                  className="block h-full w-full rounded text-left hover:bg-bg"
                >
                  {inner}
                </button>
              ) : (
                <div>{inner}</div>
              );
            }}
          />
        </>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">My regularization requests</h2>
      {regs.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : regs.isError ? (
        <ErrorState message={getErrorMessage(regs.error)} onRetry={() => void regs.refetch()} />
      ) : !regs.data?.length ? (
        <EmptyState
          title="No requests yet"
          description="If you forgot to punch in or out, request a correction from the calendar."
        />
      ) : (
        <DataTable
          caption="My regularization requests"
          columns={cols}
          rows={regs.data}
          getRowId={(r) => r.id}
          renderCard={card}
        />
      )}
      {dialogDate && <RegularizationDialog date={dialogDate} onClose={() => setDialogDate(null)} />}
    </>
  );
}
