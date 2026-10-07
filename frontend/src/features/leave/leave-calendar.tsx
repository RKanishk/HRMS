'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { MonthCalendar } from '@/components/common/month-calendar';
import { ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import type { Scope } from '@/features/attendance/hooks';
import { useHolidays } from '@/features/organization/hooks';
import { useLeaveCalendar } from './hooks';

export function LeaveCalendar({
  scope,
  showHeader = true,
}: {
  scope: Scope;
  showHeader?: boolean;
}) {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { data, isLoading, isError, error, refetch } = useLeaveCalendar(scope, month);
  const holidays = useHolidays().data ?? [];
  return (
    <>
      {showHeader && (
        <PageHeader
          title={scope === 'team' ? 'Team leave calendar' : 'Leave calendar'}
          description="Approved leave is solid; leave awaiting approval is marked pending."
        />
      )}
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
        <MonthCalendar
          month={month}
          caption={`Leave calendar for ${month}`}
          renderDay={(date, day) => {
            const on = data.filter((e) => e.fromDate <= date && date <= e.toDate);
            const holiday = holidays.find((h) => h.date === date);
            return (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted">{day}</span>
                {holiday && (
                  <p className="rounded bg-[#1e5aa8]/10 px-1 text-[11px] font-medium text-[#1e5aa8]">
                    {holiday.name}
                  </p>
                )}
                {on.slice(0, 3).map((e) => (
                  <p
                    key={e.id}
                    title={`${e.employeeName} · ${e.leaveTypeName}${e.status === 'PENDING' ? ' (pending)' : ''}`}
                    className={`truncate rounded px-1 text-[11px] ${e.status === 'PENDING' ? 'border border-dashed border-warn text-warn' : 'bg-brand/20 text-ink'}`}
                  >
                    {e.employeeName}
                    {e.status === 'PENDING' ? ' (pending)' : ''}
                  </p>
                ))}
                {on.length > 3 && <p className="text-[11px] text-muted">+{on.length - 3} more</p>}
              </div>
            );
          }}
        />
      )}
    </>
  );
}
