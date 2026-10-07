'use client';

import { useState } from 'react';
import { Check, ChevronDown, Circle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/api/client';
import { processApi, type ProcessKind } from '@/lib/api/onboarding';
import type { ChecklistProcess } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/common/states';
import { cn } from '@/lib/utils';

function ProcessCard({ p, kind }: { p: ChecklistProcess; kind: ProcessKind }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const complete = useMutation({
    mutationFn: (itemId: string) => processApi.complete(kind, p.id, itemId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['process', kind] }),
  });
  const done = p.items.filter((i) => i.done).length;
  const pct = Math.round((done / p.items.length) * 100);
  const mark = async (itemId: string, title: string) => {
    try {
      await complete.mutateAsync(itemId);
      toast(`“${title}” marked done`);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    }
  };
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {p.employeeName} <span className="font-normal text-muted">· {p.employeeCode}</span>
          </p>
          <p className="text-sm text-muted">
            {p.designationName}, {p.departmentName}
          </p>
          <p className="mt-1 text-sm">
            {kind === 'onboarding' ? (
              <>Joined {formatDate(p.startDate)}</>
            ) : (
              <>
                Resigned {formatDate(p.resignationDate)} · Last working day{' '}
                <strong>{formatDate(p.lastWorkingDay)}</strong>
              </>
            )}
          </p>
        </div>
        <StatusBadge
          label={p.status === 'COMPLETED' ? 'Completed' : 'In progress'}
          tone={p.status === 'COMPLETED' ? 'ok' : 'warn'}
        />
      </div>
      <div className="mt-3">
        <div
          role="progressbar"
          aria-label={`${p.employeeName} checklist progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2 overflow-hidden rounded-full bg-black/10"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {done} of {p.items.length} tasks done
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 -ml-2"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
        {open ? 'Hide checklist' : 'Show checklist'}
      </Button>
      {open && (
        <ul
          aria-label={`Checklist for ${p.employeeName}`}
          className="mt-2 divide-y divide-line rounded-md border border-line"
        >
          {p.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              {i.done ? (
                <Check aria-hidden className="h-4 w-4 text-ok" />
              ) : (
                <Circle aria-hidden className="h-4 w-4 text-muted" />
              )}
              <span className={cn('min-w-0 flex-1', i.done && 'text-muted line-through')}>
                {i.title}
              </span>
              <span className="text-xs text-muted">
                {i.owner}
                {i.dueDate && ` · due ${formatDate(i.dueDate)}`}
              </span>
              <span className="text-xs font-medium">{i.done ? 'Done' : 'Pending'}</span>
              {!i.done && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={complete.isPending}
                  aria-label={`Mark “${i.title}” done for ${p.employeeName}`}
                  onClick={() => void mark(i.id, i.title)}
                >
                  Mark done
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ProcessList({ kind }: { kind: ProcessKind }) {
  const [filter, setFilter] = useState<'IN_PROGRESS' | 'COMPLETED' | ''>('IN_PROGRESS');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['process', kind],
    queryFn: () => processApi.list(kind),
  });
  const shown = (data ?? []).filter((p) => !filter || p.status === filter);
  const title = kind === 'onboarding' ? 'Onboarding' : 'Offboarding';
  return (
    <>
      <PageHeader
        title={title}
        description={
          kind === 'onboarding'
            ? 'Checklist progress for new joiners.'
            : 'Exit checklists, dates and status for people leaving.'
        }
      />
      <div className="mb-4 max-w-xs">
        <Select
          aria-label="Status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="">All</option>
        </Select>
      </div>
      {isLoading ? (
        <div role="status" aria-label={`Loading ${title.toLowerCase()}`} className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={`No ${title.toLowerCase()} records`}
          description={filter ? 'Try another status filter.' : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <ProcessCard key={p.id} p={p} kind={kind} />
          ))}
        </ul>
      )}
    </>
  );
}
