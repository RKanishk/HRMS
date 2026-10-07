'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { formatMoney, monthLabel } from '@/lib/money';
import type { Role } from '@/lib/api/types';
import { ErrorState, Skeleton, StatusBadge } from '@/components/common/states';
import { AttendanceStatusBadge } from '@/features/attendance/status';
import { useMyAttendance, useRegularizations } from '@/features/attendance/hooks';
import { useLeaveBalances, useLeaveRequests } from '@/features/leave/hooks';
import { useNotifications } from '@/features/notifications/hooks';
import { useHolidays } from '@/features/organization/hooks';
import { usePayslips } from '@/features/payroll/hooks';

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-medium underline">
            {linkLabel ?? 'View all'}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
const Muted = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted">{children}</p>
);
const Loading = () => <Skeleton className="h-16 w-full" />;

function TodayCard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, isLoading, isError, error, refetch } = useMyAttendance(today.slice(0, 7));
  const day = data?.days.find((d) => d.date === today);
  return (
    <Panel title="Today’s attendance" href="/me/attendance" linkLabel="My attendance">
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{formatDate(today)}</p>
            <p className="mt-1 text-sm">
              {day?.checkIn
                ? `In ${day.checkIn}${day.checkOut ? ` · Out ${day.checkOut}` : ' · still working'}`
                : 'No punch recorded yet'}
            </p>
          </div>
          <AttendanceStatusBadge status={day?.status ?? null} />
        </div>
      )}
    </Panel>
  );
}

function BalanceCard() {
  const { data, isLoading, isError, error, refetch } = useLeaveBalances();
  return (
    <Panel title="Leave balance" href="/me/leave" linkLabel="My leave">
      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {data.map((b) => (
            <li key={b.leaveTypeId} className="rounded-md bg-bg p-2.5 text-center">
              <p className="text-2xl font-semibold tabular-nums">{b.available}</p>
              <p className="text-xs text-muted">{b.leaveTypeName}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function HolidaysCard() {
  const { data, isLoading, isError, error, refetch } = useHolidays();
  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = (data ?? [])
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  return (
    <Panel title="Upcoming holidays" href="/holidays">
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : upcoming.length === 0 ? (
        <Muted>No upcoming holidays are scheduled.</Muted>
      ) : (
        <ul className="divide-y divide-line">
          {upcoming.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium">{h.name}</span>
                <span className="block text-muted">{formatDate(h.date)}</span>
              </span>
              <StatusBadge label={h.type === 'PUBLIC' ? 'Public' : 'Optional'} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PayslipsCard() {
  const { data, isLoading, isError, error, refetch } = usePayslips();
  return (
    <Panel title="Recent payslips" href="/me/payslips">
      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Muted>Your payslips will appear here once payroll is approved.</Muted>
      ) : (
        <ul className="divide-y divide-line">
          {data.slice(0, 3).map((p) => (
            <li key={p.id}>
              <Link
                href={`/me/payslips/${p.id}`}
                className="flex items-center justify-between py-2 text-sm hover:underline"
              >
                <span className="font-medium">{monthLabel(p.month)}</span>
                <span className="tabular-nums">{formatMoney(p.net)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function NotificationsCard() {
  const { data, isLoading, isError, error, refetch } = useNotifications(3);
  return (
    <Panel title="Recent notifications" href="/notifications">
      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <Muted>You’re all caught up.</Muted>
      ) : (
        <ul className="divide-y divide-line">
          {data.items.map((n) => (
            <li key={n.id} className="py-2 text-sm">
              <p className="font-medium">
                {n.title}
                {!n.read && (
                  <span className="ml-2 rounded-full bg-brand/30 px-1.5 py-0.5 text-[10px] font-semibold">
                    New
                  </span>
                )}
              </p>
              <p className="text-muted">{n.message}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WaitingCard() {
  const leave = useLeaveRequests('team', { status: 'PENDING', pageSize: 1 });
  const regs = useRegularizations('team', 'PENDING');
  const loading = leave.isLoading || regs.isLoading;
  const failed = leave.isError || regs.isError;
  const total = (leave.data?.meta.total ?? 0) + (regs.data?.length ?? 0);
  return (
    <Panel title="Waiting for your approval" href="/team/approvals" linkLabel="Open approvals">
      {loading ? (
        <Loading />
      ) : failed ? (
        <ErrorState
          message={getErrorMessage(leave.error ?? regs.error)}
          onRetry={() => {
            void leave.refetch();
            void regs.refetch();
          }}
        />
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums">{total}</p>
          <Muted>
            {leave.data?.meta.total ?? 0} leave requests and {regs.data?.length ?? 0} attendance
            regularizations from your team.
          </Muted>
        </>
      )}
    </Panel>
  );
}

export function SelfServiceDashboard({ role }: { role: Role }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {role === 'MANAGER' && (
        <div className="md:col-span-2">
          <WaitingCard />
        </div>
      )}
      <TodayCard />
      <BalanceCard />
      <PayslipsCard />
      <HolidaysCard />
      <div className="md:col-span-2">
        <NotificationsCard />
      </div>
    </div>
  );
}
