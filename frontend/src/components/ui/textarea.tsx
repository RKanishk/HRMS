import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      rows={3}
      className={cn(
        'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  );
}
