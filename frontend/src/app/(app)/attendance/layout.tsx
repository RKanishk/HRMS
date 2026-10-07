import type { ReactNode } from 'react';
import { SectionNav } from '@/components/common/section-nav';

const ITEMS = [
  { href: '/attendance', label: 'Daily' },
  { href: '/attendance/monthly', label: 'Monthly' },
  { href: '/attendance/regularizations', label: 'Regularizations' },
];

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionNav label="Attendance sections" items={ITEMS} />
      {children}
    </>
  );
}
