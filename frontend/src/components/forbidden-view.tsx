import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export function ForbiddenView() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <ShieldAlert aria-hidden className="mb-3 h-10 w-10 text-warn" />
      <h1 className="text-xl font-semibold">You don’t have access to this page</h1>
      <p className="mt-2 text-sm text-muted">
        Your role doesn’t include this area. Ask HR if you think this is a mistake.
      </p>
      <Link href="/dashboard" className="mt-5 text-sm font-medium text-brand underline">
        Back to dashboard
      </Link>
    </div>
  );
}

export function UnrecognizedRoleView({
  role,
  onSignOut,
}: {
  role: unknown;
  onSignOut: () => void;
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <ShieldAlert aria-hidden className="mb-3 h-10 w-10 text-warn" />
      <h1 className="text-xl font-semibold">We can’t tell what your role is</h1>
      <p className="mt-2 text-sm text-muted">
        The server sent the role “{String(role ?? 'none')}”, which this app doesn’t recognise
        (expected HR_ADMIN, MANAGER or EMPLOYEE). Please tell the IT team.
      </p>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-5 text-sm font-medium text-brand-text underline"
      >
        Sign out
      </button>
    </div>
  );
}
