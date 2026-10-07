'use client';

import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HrDashboard } from '@/lib/api/types';

export function DepartmentChart({ data }: { data: HrDashboard['departmentDistribution'] }) {
  return (
    <>
      <div
        role="img"
        aria-label="Bar chart of employees per department"
        style={{ height: Math.max(220, data.length * 44) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 12 }} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar
              dataKey="count"
              name="Employees"
              fill="#f58220"
              radius={[0, 4, 4, 0]}
              label={{ position: 'right', fontSize: 12 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Employees per department</caption>
        <thead>
          <tr>
            <th>Department</th>
            <th>Employees</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.department}>
              <td>{d.department}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function AttendanceChart({ data }: { data: HrDashboard['attendanceSummary'] }) {
  const rows = data.map((d) => ({ ...d, label: format(parseISO(d.date), 'EEE d') }));
  return (
    <>
      <div
        role="img"
        aria-label="Stacked bar chart of attendance for the last working days"
        style={{ height: 260 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Legend />
            <Bar dataKey="present" name="Present" stackId="a" fill="#111111" />
            <Bar dataKey="onLeave" name="On leave" stackId="a" fill="#9ca3af" />
            <Bar dataKey="absent" name="Absent" stackId="a" fill="#f58220" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Attendance by day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Present</th>
            <th>On leave</th>
            <th>Absent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.date}>
              <td>{d.label}</td>
              <td>{d.present}</td>
              <td>{d.onLeave}</td>
              <td>{d.absent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
