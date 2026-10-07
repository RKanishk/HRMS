'use client';

import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/api/client';
import type { AppNotification } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import { useMarkAllRead, useMarkRead, useNotifications } from './hooks';
import { NotificationItem } from './notification-item';

export function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useNotifications(50);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const open = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.href) router.push(n.href);
  };
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button
            variant="outline"
            disabled={!data?.unreadCount || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        }
      />
      {isLoading ? (
        <div role="status" aria-label="Loading notifications" className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="Updates about leave, attendance and payslips will show up here."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {data.items.map((n) => (
            <li key={n.id}>
              <NotificationItem n={n} onOpen={open} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
