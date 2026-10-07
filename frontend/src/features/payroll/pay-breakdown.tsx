import type { PayBreakdown } from '@/lib/api/types';
import { formatMoney } from '@/lib/money';

const Row = ({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) => (
  <tr className={strong ? 'border-t border-line font-semibold' : undefined}>
    <th scope="row" className="py-1.5 pr-4 text-left font-normal">
      {label}
    </th>
    <td className="py-1.5 text-right tabular-nums">{formatMoney(amount)}</td>
  </tr>
);

/** Shows figures exactly as supplied by the backend; nothing is recalculated here. */
export function PayBreakdownView({ b }: { b: PayBreakdown }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-6 sm:grid-cols-2">
        <table className="w-full text-sm">
          <caption className="mb-1 text-left text-sm font-semibold">Earnings</caption>
          <tbody>
            <Row label="Basic" amount={b.basic} />
            <Row label="Allowances" amount={b.allowances} />
            <Row label="Bonus" amount={b.bonus} />
            <Row label="Overtime" amount={b.overtime} />
            <Row label="Gross pay" amount={b.gross} strong />
          </tbody>
        </table>
        <table className="w-full text-sm">
          <caption className="mb-1 text-left text-sm font-semibold">Deductions</caption>
          <tbody>
            <Row
              label={`Loss of pay (${b.lopDays} day${b.lopDays === 1 ? '' : 's'})`}
              amount={b.lopDeduction}
            />
            {b.statutory.map((l) => (
              <Row key={l.label} label={l.label} amount={l.amount} />
            ))}
            {b.otherDeductions.map((l) => (
              <Row key={l.label} label={l.label} amount={l.amount} />
            ))}
            <Row label="Total deductions" amount={b.totalDeductions} strong />
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-ink px-4 py-3 text-white">
        <span className="font-medium">Net pay</span>
        <span className="text-xl font-semibold tabular-nums">{formatMoney(b.net)}</span>
      </div>
    </div>
  );
}
