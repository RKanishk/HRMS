import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm placeholder:text-muted aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  );
}
