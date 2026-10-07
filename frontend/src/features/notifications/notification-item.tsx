import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/lib/api/types';

export function NotificationItem({
  n,
  onOpen,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-bg', !n.read && 'bg-brand/10')}
    >
      <span
        aria-hidden
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          n.read ? 'bg-transparent' : 'bg-brand',
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {n.title}
          {!n.read && <span className="sr-only"> (unread)</span>}
        </span>
        <span className="block text-sm text-muted">{n.message}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
        </span>
      </span>
    </button>
  );
}
