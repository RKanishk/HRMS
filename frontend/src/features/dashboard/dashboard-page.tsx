'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import { getErrorMessage } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import {
  ErrorState,
  MetricCard,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/common/states';
import { SelfServiceDashboard } from './self-service-dashboard';

const chartLoading = () => <Skeleton className="h-60 w-full" />;
const DepartmentChart = dynamic(() => import('./dashboard-charts').then((m) => m.DepartmentChart), {
  ssr: false,
  loading: chartLoading,
});
const AttendanceChart = dynamic(() => import('./dashboard-charts').then((m) => m.AttendanceChart), {
  ssr: false,
  loading: chartLoading,
});

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-lg border border-line bg-surface p-4">
    <h2 className="mb-3 font-semibold">{title}</h2>
    {children}
  </section>
);

function Holidays({
  items,
}: {
  items: { id: string; name: string; date: string; type: string }[];
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted">No upcoming holidays are scheduled.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((h) => (
        <li key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span>
            <span className="font-medium">{h.name}</span>
            <span className="block text-muted">{formatDate(h.date)}</span>
          </span>
          <StatusBadge label={h.type === 'PUBLIC' ? 'Public' : 'Optional'} />
        </li>
      ))}
    </ul>
  );
}

function HrDashboardView() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'hr'],
    queryFn: dashboardApi.hr,
    staleTime: 60_000,
  });
  if (isLoading)
    return (
      <div
        role="status"
        aria-label="Loading dashboard"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  if (isError || !data)
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  const pending = data.pendingApprovals.leave + data.pendingApprovals.regularization;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total employees" value={data.totalEmployees} />
        <MetricCard label="Active employees" value={data.activeEmployees} />
        <MetricCard label="Present today" value={data.presentToday} />
        <MetricCard label="Absent today" value={data.absentToday} />
        <MetricCard label="On leave today" value={data.onLeaveToday} />
        <MetricCard label="New joiners" value={data.newJoiners} hint="Joined in the last 30 days" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Employees by department">
          <DepartmentChart data={data.departmentDistribution} />
        </Panel>
        <Panel title="Attendance, recent working days">
          <AttendanceChart data={data.attendanceSummary} />
        </Panel>
        <Panel title="Pending approvals">
          <p className="text-3xl font-semibold tabular-nums">{pending}</p>
          <p className="mt-1 text-sm text-muted">
            {data.pendingApprovals.leave} leave requests and {data.pendingApprovals.regularization}{' '}
            attendance regularizations are waiting.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
            <Link href="/leave" className="underline">
              Review leave requests
            </Link>
            <Link href="/attendance/regularizations" className="underline">
              Review regularizations
            </Link>
          </div>
        </Panel>
        <Panel title="Upcoming holidays">
          <Holidays items={data.upcomingHolidays} />
        </Panel>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        description={
          user.role === 'HR_ADMIN' ? 'Company overview for today.' : 'Your day at a glance.'
        }
      />
      {user.role === 'HR_ADMIN' ? <HrDashboardView /> : <SelfServiceDashboard role={user.role} />}
    </>
  );
}
