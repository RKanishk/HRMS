'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ENTITIES } from '@/features/organization/entities';
import { PageHeader } from '@/components/common/states';
import { cn } from '@/lib/utils';

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <PageHeader
        title="Organization"
        description="Set up the structure that employees, attendance and leave rely on."
      />
      <nav
        aria-label="Organization sections"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-line"
      >
        {ENTITIES.map((e) => {
          const active = pathname === `/organization/${e.key}`;
          return (
            <Link
              key={e.key}
              href={`/organization/${e.key}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium',
                active ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {e.title}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
