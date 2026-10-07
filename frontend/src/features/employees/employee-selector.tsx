'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fullName } from '@/lib/format';
import { useEmployee, useEmployees } from './hooks';

/** Server-side searchable picker; never loads the whole employee list. */
export function EmployeeSelector({
  id,
  value,
  onChange,
  excludeId,
}: {
  id: string;
  value: string | null;
  onChange: (id: string | null) => void;
  excludeId?: string;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const selected = useEmployee(value);
  const results = useEmployees({ search: query, pageSize: 6 }, query.length >= 2);
  const options = (results.data?.data ?? []).filter((e) => e.id !== excludeId);

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-md border border-line bg-surface pl-3 pr-1 text-sm">
        <span>
          {selected.data
            ? `${fullName(selected.data)} (${selected.data.employeeCode})`
            : 'Loading…'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Remove manager"
          onClick={() => onChange(null)}
        >
          <X aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <div>
      <Input
        id={id}
        type="search"
        placeholder="Search by name or code"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
      {query.length >= 2 && (
        <ul
          aria-label="Matching employees"
          className="mt-1 max-h-48 overflow-auto rounded-md border border-line bg-surface text-sm"
        >
          {results.isLoading && <li className="px-3 py-2 text-muted">Searching…</li>}
          {results.isSuccess && options.length === 0 && (
            <li className="px-3 py-2 text-muted">No employees match “{query}”.</li>
          )}
          {options.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-bg"
                onClick={() => {
                  onChange(e.id);
                  setText('');
                  setQuery('');
                }}
              >
                {fullName(e)} <span className="text-muted">({e.employeeCode})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
