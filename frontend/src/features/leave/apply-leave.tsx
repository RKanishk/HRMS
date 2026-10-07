'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/api/client';
import { useToast } from '@/providers/toast-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/common/states';
import { useApplyLeave, useLeavePreview, useLeaveTypes } from './hooks';

const schema = z
  .object({
    leaveTypeId: z.string().min(1, 'Select a leave type'),
    fromDate: z.string().min(1, 'Select the first day'),
    toDate: z.string().min(1, 'Select the last day'),
    reason: z.string().trim().min(5, 'Give a short reason (at least 5 characters)'),
  })
  .refine((v) => !v.fromDate || !v.toDate || v.toDate >= v.fromDate, {
    path: ['toDate'],
    message: 'The last day must be on or after the first day',
  });
type Values = z.infer<typeof schema>;

export function ApplyLeave() {
  const router = useRouter();
  const toast = useToast();
  const apply = useApplyLeave();
  const types = useLeaveTypes().data ?? [];
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { leaveTypeId: '', fromDate: '', toDate: '', reason: '' },
  });
  const [leaveTypeId, fromDate, toDate] = useWatch({
    control,
    name: ['leaveTypeId', 'fromDate', 'toDate'],
  });
  const ready = !!leaveTypeId && !!fromDate && !!toDate && toDate >= fromDate;
  const preview = useLeavePreview({ leaveTypeId, fromDate, toDate }, ready);
  const blocked = ready && preview.data ? !preview.data.sufficient : false;

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await apply.mutateAsync(v);
      toast('Leave request sent for approval');
      router.push('/me/leave');
    } catch (e) {
      setServerError(
        getErrorMessage(e, 'Could not send the request. Your entries are still here.'),
      );
    }
  });

  return (
    <>
      <PageHeader
        title="Apply for leave"
        description="Fields marked * are required. Your manager will review the request."
      />
      <form
        onSubmit={submit}
        noValidate
        aria-busy={isSubmitting}
        className="max-w-xl space-y-4 rounded-lg border border-line bg-surface p-6"
      >
        {serverError && (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {serverError}
          </p>
        )}
        <Field id="leaveTypeId" label="Leave type" required error={errors.leaveTypeId?.message}>
          <Select
            {...fieldProps('leaveTypeId', errors.leaveTypeId?.message)}
            {...register('leaveTypeId')}
          >
            <option value="">Select…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="fromDate" label="From" required error={errors.fromDate?.message}>
            <Input
              type="date"
              {...fieldProps('fromDate', errors.fromDate?.message)}
              {...register('fromDate')}
            />
          </Field>
          <Field id="toDate" label="To" required error={errors.toDate?.message}>
            <Input
              type="date"
              min={fromDate || undefined}
              {...fieldProps('toDate', errors.toDate?.message)}
              {...register('toDate')}
            />
          </Field>
        </div>
        {ready && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-line bg-bg p-3 text-sm"
          >
            {preview.isLoading ? (
              'Checking duration and balance…'
            ) : preview.isError ? (
              <span className="text-danger">
                {getErrorMessage(preview.error, 'Could not check your balance right now.')}
              </span>
            ) : (
              preview.data && (
                <>
                  <p>
                    <strong>{preview.data.days}</strong> working day
                    {preview.data.days === 1 ? '' : 's'}
                    {preview.data.available !== null && (
                      <>
                        {' '}
                        · <strong>{preview.data.available}</strong> available
                      </>
                    )}
                  </p>
                  {preview.data.message && (
                    <p className="mt-1 text-danger">{preview.data.message}</p>
                  )}
                </>
              )
            )}
          </div>
        )}
        <Field id="reason" label="Reason" required error={errors.reason?.message}>
          <Textarea {...fieldProps('reason', errors.reason?.message)} {...register('reason')} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Link href="/me/leave" className={buttonVariants({ variant: 'outline' })}>
            Cancel
          </Link>
          <Button type="submit" disabled={isSubmitting || blocked}>
            {isSubmitting ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </form>
    </>
  );
}
