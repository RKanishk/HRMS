import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMocks } from '@/lib/mocks/adapter';
import { employeesApi } from '@/lib/api/employees';
import { renderWithProviders } from '@/test/utils';
import { EmployeesPage } from './employees-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/employees',
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => installMocks());

const table = () => screen.getByRole('table', { name: 'Employees' });

describe('EmployeesPage', () => {
  it('loads the first page with pagination info', async () => {
    renderWithProviders(<EmployeesPage />);
    expect(
      await within(await screen.findByRole('table', { name: 'Employees' })).findByText('CIPL001'),
    ).toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 64')).toBeInTheDocument();
  });

  it('searches by employee code', async () => {
    renderWithProviders(<EmployeesPage />);
    await screen.findByText('Showing 1–10 of 64');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search employees' }), 'CIPL017');
    await waitFor(() => expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument());
    expect(within(table()).getByText('CIPL017')).toBeInTheDocument();
    expect(within(table()).queryByText('CIPL001')).not.toBeInTheDocument();
  });

  it('filters by department and can clear the filter', async () => {
    renderWithProviders(<EmployeesPage />);
    await screen.findByText('Showing 1–10 of 64');
    const dept = screen.getByRole('combobox', { name: 'Department' });
    await waitFor(() =>
      expect(within(dept).getByRole('option', { name: 'Finance' })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(dept, 'Finance');
    await waitFor(() => expect(screen.getByText('Showing 1–10 of 11')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(screen.getByText('Showing 1–10 of 64')).toBeInTheDocument());
  });

  it('shows an empty state when nothing matches', async () => {
    renderWithProviders(<EmployeesPage />);
    await screen.findByText('Showing 1–10 of 64');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search employees' }), 'zzzzzz');
    expect(await screen.findByText('No employees match these filters')).toBeInTheDocument();
  });

  it('shows an error with retry when the API fails', async () => {
    vi.spyOn(employeesApi, 'list').mockRejectedValueOnce(new Error('down'));
    renderWithProviders(<EmployeesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this page');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Showing 1–10 of 64')).toBeInTheDocument();
  });
});
