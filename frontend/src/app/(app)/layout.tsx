'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/common/states';
import { ForbiddenView } from '@/components/forbidden-view';
import { canAccess } from '@/lib/permissions';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, unknownRole, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (unknownRole !== null) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">We can’t work out your access</h1>
        <p className="mt-2 text-sm text-muted">
          You signed in, but this app doesn’t recognise the role “{unknownRole}”. Ask the developer
          to map it in <code>src/lib/api/roles.ts</code>.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </main>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="space-y-4 p-6" role="status" aria-label="Loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return (
    <AppShell user={user}>{canAccess(user.role, pathname) ? children : <ForbiddenView />}</AppShell>
  );
}
