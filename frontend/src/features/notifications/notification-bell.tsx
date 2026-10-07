'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { getErrorMessage } from '@/lib/api/client';
import type { AppNotification } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/common/states';
import { useMarkAllRead, useMarkRead, useNotifications } from './hooks';
import { NotificationItem } from './notification-item';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useNotifications(8);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = data?.unreadCount ?? 0;

  const openItem = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative"
        >
          <Bell aria-hidden className="h-5 w-5" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-ink"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label="Notifications"
          className="z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-lg border border-line bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <Button
              size="sm"
              variant="ghost"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Mark all as read
            </Button>
          </div>
          <div className="max-h-96 divide-y divide-line overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : isError || !data ? (
              <div role="alert" className="p-4 text-sm">
                <p className="text-danger">{getErrorMessage(error)}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            ) : data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">You’re all caught up.</p>
            ) : (
              data.items.map((n) => <NotificationItem key={n.id} n={n} onOpen={openItem} />)
            )}
          </div>
          <div className="border-t border-line px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium underline"
            >
              View all notifications
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
