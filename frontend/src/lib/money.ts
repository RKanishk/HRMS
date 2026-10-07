import { format, parseISO } from 'date-fns';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
/** Display formatting only. All amounts are calculated by the backend. */
export const formatMoney = (n: number) => inr.format(n);
export const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMMM yyyy');
