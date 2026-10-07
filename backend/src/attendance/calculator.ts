import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import type { Shift, RawPunch } from '../generated/prisma/client.js';
import type { AttendanceStatus } from '../generated/prisma/enums.js';
import { shiftTimes } from '../common/dates.js';
export function calculateAttendance(
  date: Date,
  shift: Pick<
    Shift,
    'startMinute' | 'endMinute' | 'graceMinutes' | 'halfDayMinutes' | 'fullDayMinutes' | 'weeklyOff'
  >,
  punches: Pick<RawPunch, 'occurredAt' | 'direction'>[],
  zone: string,
  holiday = false,
  onLeave = false,
) {
  const scheduled = shiftTimes(date, shift.startMinute, shift.endMinute, zone);
  let open: Date | null = null;
  let first: Date | null = null;
  let last: Date | null = null;
  let minutes = 0;
  for (const p of [...punches].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    if (p.direction === 'IN') {
      if (open) throw new BadRequestException('Consecutive IN punches require regularization');
      open = p.occurredAt;
      first ??= open;
    } else {
      if (!open) throw new BadRequestException('OUT punch has no matching IN');
      if (p.occurredAt < open) throw new BadRequestException('Invalid punch order');
      minutes += Math.floor((p.occurredAt.getTime() - open.getTime()) / 60000);
      last = p.occurredAt;
      open = null;
    }
  }
  const weekday = DateTime.fromJSDate(date, { zone: 'utc' }).weekday;
  let status: AttendanceStatus = onLeave
    ? 'LEAVE'
    : holiday
      ? 'HOLIDAY'
      : shift.weeklyOff.includes(weekday)
        ? 'WEEKLY_OFF'
        : minutes >= shift.fullDayMinutes
          ? 'PRESENT'
          : minutes >= shift.halfDayMinutes
            ? 'HALF_DAY'
            : 'ABSENT';
  // Open shifts remain provisional; payroll refuses them until closed or regularized.
  if (open && !onLeave && !holiday && !shift.weeklyOff.includes(weekday)) status = 'ABSENT';
  return {
    status,
    checkIn: first,
    checkOut: open ? null : last,
    workingMinutes: minutes,
    lateMinutes: first
      ? Math.max(
          0,
          Math.floor((first.getTime() - scheduled.start.getTime()) / 60000) - shift.graceMinutes,
        )
      : 0,
    earlyMinutes:
      last && !open
        ? Math.max(0, Math.floor((scheduled.end.getTime() - last.getTime()) / 60000))
        : 0,
    overtimeMinutes: Math.max(0, minutes - shift.fullDayMinutes),
  };
}
