import type { AttendanceStatus } from '@/lib/api/types';
import { StatusBadge, type Tone } from '@/components/common/states';

export const ATTENDANCE_META: Record<
  AttendanceStatus,
  { label: string; tone: Tone; code: string; cell: string }
> = {
  PRESENT: { label: 'Present', tone: 'ok', code: 'P', cell: 'bg-ok/15 text-ok' },
  ABSENT: { label: 'Absent', tone: 'danger', code: 'A', cell: 'bg-danger/15 text-danger' },
  HALF_DAY: { label: 'Half day', tone: 'warn', code: 'HD', cell: 'bg-warn/15 text-warn' },
  LEAVE: { label: 'Leave', tone: 'info', code: 'L', cell: 'bg-[#1e5aa8]/15 text-[#1e5aa8]' },
  HOLIDAY: { label: 'Holiday', tone: 'info', code: 'H', cell: 'bg-[#1e5aa8]/15 text-[#1e5aa8]' },
  WEEKLY_OFF: { label: 'Weekly off', tone: 'neutral', code: 'WO', cell: 'bg-black/5 text-muted' },
};

export const STATUS_ORDER = Object.keys(ATTENDANCE_META) as AttendanceStatus[];

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span className="text-muted">—</span>;
  return <StatusBadge label={ATTENDANCE_META[status].label} tone={ATTENDANCE_META[status].tone} />;
}

export const formatWorked = (m: number | null) =>
  m === null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
