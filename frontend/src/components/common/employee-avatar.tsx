import { cn } from '@/lib/utils';

export function EmployeeAvatar({
  firstName,
  lastName,
  size = 'md',
}: {
  firstName: string;
  lastName: string;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand/20 font-semibold text-ink',
        size === 'md' ? 'h-9 w-9 text-xs' : 'h-16 w-16 text-xl',
      )}
    >
      {(firstName[0] ?? '') + (lastName[0] ?? '')}
    </span>
  );
}
