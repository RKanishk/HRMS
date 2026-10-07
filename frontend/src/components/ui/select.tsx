import type { Ref, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Select({
  className,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  );
}
