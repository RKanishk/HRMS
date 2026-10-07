import type { NotificationType } from '../api/types';
import { nextId } from './db';

export interface NotifRow {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  href: string | null;
}
export const notifStore: NotifRow[] = [];

export function notify(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  href: string | null = null,
  minutesAgo = 0,
) {
  notifStore.push({
    id: nextId(),
    userId,
    type,
    title,
    message,
    href,
    read: false,
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  });
}
