import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginForm } from './login-form';
import { authApi } from '@/lib/api/auth';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginForm />
    </QueryClientProvider>,
  );

describe('LoginForm', () => {
  it('shows validation messages for empty fields and does not call the API', async () => {
    const spy = vi.spyOn(authApi, 'login');
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows the server error and keeps the entered email after a failed sign-in', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('boom'));
    setup();
    await userEvent.type(screen.getByLabelText(/work email/i), 'a@cipl.test');
    await userEvent.type(screen.getByLabelText(/password/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign in');
    expect(screen.getByLabelText(/work email/i)).toHaveValue('a@cipl.test');
  });

  it('routes to the dashboard on success', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      id: '1',
      employeeCode: 'C1',
      name: 'A',
      email: 'a@cipl.test',
      role: 'HR_ADMIN',
    });
    setup();
    await userEvent.type(screen.getByLabelText(/work email/i), 'a@cipl.test');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });
});

describe('LoginForm with an unrecognised backend role', () => {
  it('tells the user which role value was not understood', async () => {
    const { UnknownRoleError } = await import('@/lib/api/roles');
    vi.spyOn(authApi, 'login').mockRejectedValue(new UnknownRoleError('SUPERVISOR'));
    setup();
    await userEvent.type(screen.getByLabelText(/work email/i), 'a@cipl.test');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('SUPERVISOR');
  });
});
