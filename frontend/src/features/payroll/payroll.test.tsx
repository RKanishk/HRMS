import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, subMonths } from 'date-fns';
import { installMocks, mockSignIn } from '@/lib/mocks/adapter';
import { renderWithProviders } from '@/test/utils';
import { PayrollPeriodDetail } from './period-detail';
import { PayrollPeriodsPage } from './periods-page';
import { PayslipDetail, PayslipsPage } from './payslips';
import * as download from '@/lib/api/download';

vi.mock('@/lib/api/download', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/download')>()),
  saveFile: vi.fn(),
}));
beforeAll(() => installMocks());

const thisMonth = format(new Date(), 'yyyy-MM');
const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

describe('Payslips (employee)', () => {
  it('lists published payslips only', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<PayslipsPage />);
    const month = format(subMonths(new Date(), 1), 'MMMM yyyy');
    expect(await screen.findByText(month)).toBeInTheDocument();
    expect(screen.queryByText(format(new Date(), 'MMMM yyyy'))).not.toBeInTheDocument();
  });

  it('shows the payslip and downloads the file from the backend', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<PayslipDetail id={`ps-${lastMonth}`} />);
    expect(await screen.findByRole('heading', { name: /^Payslip for/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Net pay/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Download/ }));
    await waitFor(() =>
      expect(download.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ filename: `payslip-${lastMonth}.txt` }),
      ),
    );
  });

  it('reports a payslip that does not exist', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<PayslipDetail id="ps-1999-01" />);
    expect(await screen.findByText('Payslip not found')).toBeInTheDocument();
  });

  it('does not give HR a payslip list (payroll data stays behind roles)', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<PayslipsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });
});

// The HR suite below approves and locks the current month, so published-only checks run first.

describe('Payroll (HR)', () => {
  it('lists payroll runs with their status', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<PayrollPeriodsPage />);
    const table = await screen.findByRole('table', { name: 'Payroll periods' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText('In review')).toBeInTheDocument();
    expect(within(table).getByText('Approved')).toBeInTheDocument();
    expect(within(table).getAllByText('Locked')).toHaveLength(2);
  });

  it('shows the server’s message when a run already exists', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<PayrollPeriodsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Start payroll run' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start run' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });

  it('shows the breakdown for one employee exactly as the backend supplies it', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<PayrollPeriodDetail id={`p-${thisMonth}`} />);
    const table = await screen.findByRole('table', { name: 'Payroll entries' });
    await userEvent.click(within(table).getAllByRole('button', { name: /^Review payroll for/ })[0]);
    const dialog = await screen.findByRole('dialog');
    for (const label of [
      'Basic',
      'Allowances',
      'Bonus',
      'Overtime',
      'Gross pay',
      'Total deductions',
      'Net pay',
      'Provident fund',
    ]) {
      expect(within(dialog).getAllByText(new RegExp(`^${label}`)).length).toBeGreaterThan(0);
    }
    expect(within(dialog).getAllByText(/₹/).length).toBeGreaterThan(5);
    expect(within(dialog).getByText(/Loss of pay \(\d+ days?\)/)).toBeInTheDocument();
  });

  it('moves a run through approval and locking, each after confirmation', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<PayrollPeriodDetail id={`p-${thisMonth}`} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve payroll' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('publishes each employee’s payslip');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve payroll' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Lock payroll' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lock payroll' }),
    );
    expect(await screen.findByText('Locked and read-only.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Lock payroll|Approve payroll/ }),
    ).not.toBeInTheDocument();
  });

  it('refuses people without the HR role', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<PayrollPeriodsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });
});
