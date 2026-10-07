'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getErrorMessage } from '@/lib/api/client';
import type { EmployeeInput } from '@/lib/api/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  useBranches,
  useDepartments,
  useDesignations,
  useShifts,
} from '@/features/organization/hooks';
import { EmployeeSelector } from './employee-selector';
import { employeeSchema, type EmployeeFormValues } from './employee-schema';

const EMPTY = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '' as never,
  departmentId: '',
  designationId: '',
  branchId: '',
  shiftId: '',
  managerId: null,
  joiningDate: '',
  status: 'ACTIVE',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
} satisfies EmployeeFormValues;

export function EmployeeForm({
  defaultValues,
  employeeId,
  onSubmit,
  submitLabel,
  cancelHref,
}: {
  defaultValues?: EmployeeInput;
  employeeId?: string;
  onSubmit: (v: EmployeeInput) => Promise<void>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const departments = useDepartments().data ?? [];
  const designations = useDesignations().data ?? [];
  const branches = useBranches().data ?? [];
  const shifts = useShifts().data ?? [];

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setServerError(
        getErrorMessage(e, 'Could not save the employee. Your entries are still here.'),
      );
    }
  });

  const text = (
    name: keyof EmployeeFormValues,
    label: string,
    opts: { type?: string; required?: boolean } = {},
  ) => (
    <Field id={name} label={label} required={opts.required ?? true} error={errors[name]?.message}>
      <Input
        type={opts.type ?? 'text'}
        {...fieldProps(name, errors[name]?.message)}
        {...register(name as never)}
      />
    </Field>
  );
  const select = (
    name: 'gender' | 'departmentId' | 'designationId' | 'branchId' | 'shiftId' | 'status',
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <Field id={name} label={label} required error={errors[name]?.message}>
      <Select {...fieldProps(name, errors[name]?.message)} {...register(name)}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate aria-busy={isSubmitting} className="space-y-8">
      {serverError && (
        <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {serverError}
        </p>
      )}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Personal details</legend>
        {text('firstName', 'First name')}
        {text('lastName', 'Last name')}
        {text('dateOfBirth', 'Date of birth', { type: 'date' })}
        {select('gender', 'Gender', [
          { value: 'FEMALE', label: 'Female' },
          { value: 'MALE', label: 'Male' },
          { value: 'OTHER', label: 'Other' },
        ])}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Employment</legend>
        {text('employeeCode', 'Employee code')}
        {text('joiningDate', 'Joining date', { type: 'date' })}
        {select(
          'departmentId',
          'Department',
          departments.map((d) => ({ value: d.id, label: d.name })),
        )}
        {select(
          'designationId',
          'Designation',
          designations.map((d) => ({ value: d.id, label: d.name })),
        )}
        {select(
          'branchId',
          'Branch',
          branches.map((d) => ({ value: d.id, label: d.name })),
        )}
        {select(
          'shiftId',
          'Shift',
          shifts.map((d) => ({ value: d.id, label: `${d.name} (${d.startTime}–${d.endTime})` })),
        )}
        {select('status', 'Status', [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'ON_NOTICE', label: 'On notice' },
          { value: 'INACTIVE', label: 'Inactive' },
        ])}
        <Field
          id="managerId"
          label="Reporting manager"
          hint="Leave empty if this person has no manager."
        >
          <Controller
            control={control}
            name="managerId"
            render={({ field }) => (
              <EmployeeSelector
                id="managerId"
                value={field.value}
                onChange={field.onChange}
                excludeId={employeeId}
              />
            )}
          />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Contact</legend>
        {text('email', 'Work email', { type: 'email' })}
        {text('phone', 'Phone', { type: 'tel' })}
        <div className="sm:col-span-2">{text('address', 'Address')}</div>
        {text('emergencyContactName', 'Emergency contact name')}
        {text('emergencyContactPhone', 'Emergency contact phone', { type: 'tel' })}
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Link href={cancelHref} className={buttonVariants({ variant: 'outline' })}>
          Cancel
        </Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
