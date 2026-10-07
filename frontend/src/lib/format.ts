import { format, isValid, parseISO } from 'date-fns';

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'dd MMM yyyy') : '—';
}

export const STATUS_META = {
  ACTIVE: { label: 'Active', tone: 'ok' },
  ON_NOTICE: { label: 'On notice', tone: 'warn' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
} as const;

export const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`;
