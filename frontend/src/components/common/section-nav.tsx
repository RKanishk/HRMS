'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function SectionNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={pathname === i.href ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium',
            pathname === i.href
              ? 'border-brand text-ink'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
