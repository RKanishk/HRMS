'use client';

import type { TeamMember } from '@/lib/api/types';
import { getErrorMessage } from '@/lib/api/client';
import { formatDate, fullName } from '@/lib/format';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmployeeAvatar } from '@/components/common/employee-avatar';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import { AttendanceStatusBadge } from './status';
import { useTeamMembers } from './hooks';

const person = (m: TeamMember) => (
  <div className="flex items-center gap-3">
    <EmployeeAvatar firstName={m.firstName} lastName={m.lastName} />
    <div>
      <p className="font-medium">{fullName(m)}</p>
      <p className="text-xs text-muted">{m.employeeCode}</p>
    </div>
  </div>
);
const columns: Column<TeamMember>[] = [
  { key: 'p', header: 'Team member', cell: person },
  { key: 'd', header: 'Designation', cell: (m) => m.designationName },
  { key: 'b', header: 'Branch', cell: (m) => m.branchName },
  { key: 'j', header: 'Joined', cell: (m) => formatDate(m.joiningDate) },
  { key: 's', header: 'Today', cell: (m) => <AttendanceStatusBadge status={m.todayStatus} /> },
];

export function TeamPage() {
  const { data, isLoading, isError, error, refetch } = useTeamMembers();
  return (
    <>
      <PageHeader title="My team" description="People who report to you." />
      {isLoading ? (
        <div role="status" aria-label="Loading team" className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No direct reports"
          description="People assigned to you as their manager will appear here."
        />
      ) : (
        <DataTable
          caption="My team"
          columns={columns}
          rows={data}
          getRowId={(m) => m.id}
          renderCard={(m) => (
            <div className="flex items-center justify-between gap-2">
              {person(m)}
              <AttendanceStatusBadge status={m.todayStatus} />
            </div>
          )}
        />
      )}
    </>
  );
}
