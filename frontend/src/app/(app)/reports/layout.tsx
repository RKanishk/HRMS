import type { ReactNode } from 'react';
import { SectionNav } from '@/components/common/section-nav';

const ITEMS = [
  { href: '/reports', label: 'Headcount' },
  { href: '/reports/attendance', label: 'Attendance' },
  { href: '/reports/leave', label: 'Leave' },
  { href: '/reports/payroll', label: 'Payroll' },
];

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionNav label="Report types" items={ITEMS} />
      {children}
    </>
  );
}
