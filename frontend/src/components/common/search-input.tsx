'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** Debounced search box. Change its `key` to reset it from outside. */
export function SearchInput({
  initialValue = '',
  onSearch,
  label,
  placeholder,
}: {
  initialValue?: string;
  onSearch: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(initialValue);
  useEffect(() => {
    if (text === initialValue) return;
    const t = setTimeout(() => onSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text, initialValue, onSearch]);
  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
