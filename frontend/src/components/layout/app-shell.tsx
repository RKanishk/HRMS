'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { navFor } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand-logo';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { MOCKS_ENABLED } from '@/lib/env';
import type { CurrentUser } from '@/lib/api/types';

const ROLE_LABEL = { HR_ADMIN: 'HR / Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' } as const;

function Breadcrumbs({ pathname }: { pathname: string }) {
  const parts = pathname.split('/').filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex items-center gap-1.5">
        <li>CIPL HRMS</li>
        {parts.map((p, i) => (
          <li key={p + i} className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            <span
              className={i === parts.length - 1 ? 'font-medium text-ink' : ''}
              aria-current={i === parts.length - 1 ? 'page' : undefined}
            >
              {p.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SideNav({
  user,
  collapsed,
  onNavigate,
}: {
  user: CurrentUser;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
      {navFor(user.role).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center gap-3 rounded-md px-3 text-sm text-side-ink hover:bg-white/10 [&_svg]:text-brand',
              active && 'bg-white/20 font-medium text-white shadow-[inset_3px_0_0_#f58220]',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon aria-hidden className="h-5 w-5 shrink-0" />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen flex-col bg-side transition-[width] lg:flex print:hidden',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center px-4 text-white',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <span className="text-lg font-bold text-brand">C</span>
          ) : (
            <BrandLogo variant="light" height={30} />
          )}
        </div>
        <SideNav user={user} collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-12 items-center justify-center text-side-ink hover:bg-white/10"
        >
          {collapsed ? (
            <ChevronsRight aria-hidden className="h-5 w-5" />
          ) : (
            <ChevronsLeft aria-hidden className="h-5 w-5" />
          )}
        </button>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-side">
            <div className="flex h-14 items-center justify-between px-4 text-white">
              <BrandLogo variant="light" height={30} />
              <button aria-label="Close menu" onClick={() => setMobileOpen(false)}>
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            <SideNav user={user} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 print:hidden flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden className="h-5 w-5" />
          </Button>
          <div className="hidden min-w-0 flex-1 sm:block">
            <Breadcrumbs pathname={pathname} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {MOCKS_ENABLED && (
              <span className="hidden rounded-full bg-brand/20 px-2.5 py-1 text-xs font-semibold sm:inline">
                Demo data
              </span>
            )}
            <NotificationBell />
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut aria-hidden className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
