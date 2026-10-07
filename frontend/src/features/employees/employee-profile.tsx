'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { getErrorMessage } from '@/lib/api/client';
import type { EmployeeListItem } from '@/lib/api/types';
import { STATUS_META, formatDate, fullName } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
import { EmployeeAvatar } from '@/components/common/employee-avatar';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '@/components/common/states';
import { cn } from '@/lib/utils';
import { EmployeeDocuments } from '@/features/documents/documents-pages';
import { useEmployee } from './hooks';

const TABS = ['Overview', 'Personal', 'Employment', 'Contact', 'Documents'] as const;
type Tab = (typeof TABS)[number];
const GENDER = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' } as const;

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-sm text-muted">{k}</dt>
          <dd className="mt-0.5 font-medium">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ e, tab }: { e: EmployeeListItem; tab: Tab }) {
  if (tab === 'Documents') return <EmployeeDocuments employeeId={e.id} />;
  if (tab === 'Overview')
    return (
      <Facts
        items={[
          ['Department', e.departmentName],
          ['Designation', e.designationName],
          ['Branch', e.branchName],
          [
            'Reporting manager',
            e.managerId ? (
              <Link key="m" href={`/employees/${e.managerId}`} className="underline">
                {e.managerName}
              </Link>
            ) : null,
          ],
          [
            'Joined',
            `${formatDate(e.joiningDate)} (${formatDistanceToNowStrict(parseISO(e.joiningDate))} ago)`,
          ],
          ['Shift', e.shiftName],
        ]}
      />
    );
  if (tab === 'Personal')
    return (
      <Facts
        items={[
          ['First name', e.firstName],
          ['Last name', e.lastName],
          ['Date of birth', formatDate(e.dateOfBirth)],
          ['Gender', GENDER[e.gender]],
        ]}
      />
    );
  if (tab === 'Employment')
    return (
      <Facts
        items={[
          ['Employee code', e.employeeCode],
          ['Status', STATUS_META[e.status].label],
          ['Department', e.departmentName],
          ['Designation', e.designationName],
          ['Branch', e.branchName],
          ['Shift', e.shiftName],
          ['Joining date', formatDate(e.joiningDate)],
        ]}
      />
    );
  return (
    <Facts
      items={[
        [
          'Work email',
          <a key="e" href={`mailto:${e.email}`} className="underline">
            {e.email}
          </a>,
        ],
        ['Phone', e.phone],
        ['Address', e.address],
        ['Emergency contact', e.emergencyContactName],
        ['Emergency phone', e.emergencyContactPhone],
      ]}
    />
  );
}

export function EmployeeProfile({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const { data: e, isLoading, isError, error, refetch } = useEmployee(id);

  if (isLoading)
    return (
      <div role="status" aria-label="Loading profile" className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  if (isError) {
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return (
        <EmptyState
          title="Employee not found"
          description="This record may have been removed."
          action={
            <Link href="/employees" className={buttonVariants({ variant: 'outline' })}>
              Back to employees
            </Link>
          }
        />
      );
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  }
  if (!e) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{fullName(e)}</h1>
            <p className="text-sm text-muted">
              {e.designationName} · {e.employeeCode}
            </p>
            <div className="mt-1">
              <StatusBadge label={STATUS_META[e.status].label} tone={STATUS_META[e.status].tone} />
            </div>
          </div>
        </div>
        <Link href={`/employees/${e.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
          Edit employee
        </Link>
      </div>
      <div
        role="tablist"
        aria-label="Employee sections"
        className="mb-4 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="tabpanel"
            onClick={() => setTab(t)}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium',
              tab === t ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <section
        id="tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="rounded-lg border border-line bg-surface p-6"
      >
        <Body e={e} tab={tab} />
      </section>
    </div>
  );
}
