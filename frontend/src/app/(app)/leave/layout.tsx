import type { ReactNode } from 'react';
import { PageHeader } from '@/components/common/states';
import { SectionNav } from '@/components/common/section-nav';

const ITEMS = [
  { href: '/leave', label: 'Requests' },
  { href: '/leave/calendar', label: 'Calendar' },
  { href: '/leave/types', label: 'Leave types' },
];

export default function LeaveLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Leave"
        description="Requests, calendar and policies for the whole company."
      />
      <SectionNav label="Leave sections" items={ITEMS} />
      {children}
    </>
  );
}
