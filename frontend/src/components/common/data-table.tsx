import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortKey?: string;
  className?: string;
}

interface Props<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  renderCard: (row: T) => ReactNode;
  sort?: { key: string; order: 'asc' | 'desc' };
  onSort?: (key: string) => void;
}

/** Table on md+ screens, stacked cards on phones. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  renderCard,
  sort,
  onSort,
}: Props<T>) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line bg-bg text-muted">
            <tr>
              {columns.map((c) => {
                const active = sort && c.sortKey === sort.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn('whitespace-nowrap px-4 py-3 font-medium', c.className)}
                  >
                    {c.sortKey && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.sortKey!)}
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        {c.header}
                        {active &&
                          (sort.order === 'asc' ? (
                            <ArrowUp aria-hidden className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown aria-hidden className="h-3.5 w-3.5" />
                          ))}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={getRowId(row)} className="hover:bg-bg/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={getRowId(row)} className="rounded-lg border border-line bg-surface p-4">
            {renderCard(row)}
          </li>
        ))}
      </ul>
    </>
  );
}
