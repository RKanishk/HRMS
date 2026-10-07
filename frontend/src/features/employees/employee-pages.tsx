'use client';

import { useRouter } from 'next/navigation';
import type { EmployeeInput } from '@/lib/api/types';
import { getErrorMessage } from '@/lib/api/client';
import { useToast } from '@/providers/toast-provider';
import { PageHeader, ErrorState, Skeleton } from '@/components/common/states';
import { EmployeeForm } from './employee-form';
import { useEmployee, useSaveEmployee } from './hooks';

export function CreateEmployeePage() {
  const router = useRouter();
  const toast = useToast();
  const save = useSaveEmployee();
  return (
    <>
      <PageHeader title="Add employee" description="Fields marked * are required." />
      <div className="rounded-lg border border-line bg-surface p-6">
        <EmployeeForm
          submitLabel="Create employee"
          cancelHref="/employees"
          onSubmit={async (v: EmployeeInput) => {
            const created = await save.mutateAsync(v);
            toast('Employee created');
            router.push(`/employees/${created.id}`);
          }}
        />
      </div>
    </>
  );
}

export function EditEmployeePage({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const save = useSaveEmployee(id);
  const { data, isLoading, isError, error, refetch } = useEmployee(id);
  if (isLoading)
    return (
      <div role="status" aria-label="Loading employee">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (isError || !data)
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    id: _id,
    departmentName,
    designationName,
    branchName,
    shiftName,
    managerName,
    ...input
  } = data;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return (
    <>
      <PageHeader
        title={`Edit ${data.firstName} ${data.lastName}`}
        description="Fields marked * are required."
      />
      <div className="rounded-lg border border-line bg-surface p-6">
        <EmployeeForm
          defaultValues={input}
          employeeId={id}
          submitLabel="Save changes"
          cancelHref={`/employees/${id}`}
          onSubmit={async (v) => {
            await save.mutateAsync(v);
            toast('Employee updated');
            router.push(`/employees/${id}`);
          }}
        />
      </div>
    </>
  );
}
