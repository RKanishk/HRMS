import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BrandLogo } from '@/components/brand-logo';
import { LoginForm } from '@/components/login-form';
import { MOCKS_ENABLED } from '@/lib/env';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-side p-10 text-side-ink lg:flex">
        <div
          aria-hidden
          className="absolute -bottom-24 -left-24 h-72 w-[130%] -rotate-12 bg-brand/90"
        />
        <BrandLogo variant="light" height={64} priority />
        <div className="relative max-w-md">
          <p className="text-3xl font-semibold leading-tight text-white">
            Attendance, leave and payslips in one place.
          </p>
          <p className="mt-4 text-sm leading-relaxed">
            The CIPL people portal for employees, managers and HR.
          </p>
        </div>
        <p className="relative text-xs font-medium text-ink">
          Internal use only. Access is limited to authorised CIPL staff.
        </p>
      </aside>

      <main id="main" className="flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo height={56} priority />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Use your CIPL work account to continue.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
          {MOCKS_ENABLED && (
            <p className="mt-6 rounded-md bg-black/5 p-3 text-xs text-muted">
              Development mock data is on. Try hr@cipl.test, manager@cipl.test or employee@cipl.test
              with password “password”.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
