'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/client';
import { UnknownRoleError } from '@/lib/api/roles';
import { ME_KEY } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const schema = z.object({
  email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const expired = useSearchParams().get('expired') === '1';
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await authApi.login(values);
      qc.setQueryData(ME_KEY, user);
      router.replace('/dashboard');
    } catch (e) {
      setServerError(
        e instanceof UnknownRoleError
          ? `Signed in, but this app doesn’t recognise the role “${e.rawRole}”. Ask the developer to map it.${e.fields.length ? ` (The server sent: ${e.fields.join(', ')}.)` : ''}`
          : getErrorMessage(e, 'Could not sign in. Try again.'),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={isSubmitting}>
      {expired && (
        <p role="status" className="rounded-md bg-warn/10 p-3 text-sm text-warn">
          Your session expired. Sign in again to continue.
        </p>
      )}
      {serverError && (
        <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {serverError}
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Work email{' '}
          <span aria-hidden className="text-danger">
            *
          </span>
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          aria-required
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-err' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-err" className="text-xs text-danger">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password{' '}
          <span aria-hidden className="text-danger">
            *
          </span>
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-required
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'pw-err' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <p id="pw-err" className="text-xs text-danger">
            {errors.password.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
