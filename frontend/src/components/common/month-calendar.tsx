import type { ReactNode } from 'react';
import { getDay, getDaysInMonth, parseISO } from 'date-fns';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Semantic month table (Monday first). `month` is yyyy-MM. */
export function MonthCalendar({
  month,
  caption,
  renderDay,
}: {
  month: string;
  caption: string;
  renderDay: (date: string, day: number) => ReactNode;
}) {
  const first = parseISO(`${month}-01`);
  const lead = (getDay(first) + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: getDaysInMonth(first) }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th
                key={d}
                scope="col"
                className="border-b border-line bg-bg px-2 py-2 text-left font-medium text-muted"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, i) => (
                <td
                  key={i}
                  className="h-24 border-b border-r border-line p-1.5 align-top last:border-r-0"
                >
                  {day && renderDay(`${month}-${String(day).padStart(2, '0')}`, day)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
