import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMocks, mockSignIn } from '@/lib/mocks/adapter';
import * as download from '@/lib/api/download';
import { renderWithProviders } from '@/test/utils';
import { SelfServiceDashboard } from './dashboard/self-service-dashboard';
import { NotificationBell } from './notifications/notification-bell';
import { ProcessList } from './onboarding/process-list';
import { ReportView } from './reports/report-view';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/api/download', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/download')>()),
  saveFile: vi.fn(),
}));
beforeAll(() => installMocks());

describe('Notifications', () => {
  it('shows the unread count, lists items, and clears them with “Mark all as read”', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<NotificationBell />);
    const bell = await screen.findByRole('button', { name: /Notifications, 3 unread/ });
    await userEvent.click(bell);
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByText('Leave approved')).toBeInTheDocument();
    expect(within(panel).getByText('Payslip available')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument(),
    );
  });
});

describe('Onboarding and offboarding (HR)', () => {
  it('shows checklist progress and lets HR mark a task done', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<ProcessList kind="onboarding" />);
    expect(await screen.findByText('4 of 6 tasks done')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    await userEvent.click(screen.getAllByRole('button', { name: 'Show checklist' })[0]);
    await userEvent.click(screen.getAllByRole('button', { name: /^Mark .* done for/ })[0]);
    expect(await screen.findByText('5 of 6 tasks done')).toBeInTheDocument();
  });

  it('shows the exit dates for offboarding', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<ProcessList kind="offboarding" />);
    expect(await screen.findAllByText(/Last working day/)).toHaveLength(3);
  });

  it('is refused for employees', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<ProcessList kind="onboarding" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });
});

describe('Reports (HR)', () => {
  it('shows backend-supplied rows and totals, and exports CSV', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<ReportView kind="headcount" />);
    const table = await screen.findByRole('table', { name: 'Headcount report' });
    expect(within(table).getByText('Engineering')).toBeInTheDocument();
    expect(within(table).getAllByText('64').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    await waitFor(() =>
      expect(download.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'headcount-report.csv' }),
      ),
    );
  });

  it('explains when Excel export is not available on the server', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<ReportView kind="headcount" />);
    await screen.findByRole('table', { name: 'Headcount report' });
    await userEvent.click(screen.getByRole('button', { name: /Export Excel/ }));
    expect(await screen.findByText(/Excel export isn’t available/)).toBeInTheDocument();
  });

  it('shows the payroll report with currency formatting', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<ReportView kind="payroll" />);
    const table = await screen.findByRole('table', { name: 'Payroll report' });
    expect(within(table).getAllByText(/₹/).length).toBeGreaterThan(3);
  });

  it('validates the date range', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<ReportView kind="attendance" />);
    await screen.findByRole('table', { name: 'Attendance report' });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2020-01-01' } });
    expect(await screen.findByText('Check the dates')).toBeInTheDocument();
  });

  it('is refused for employees', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<ReportView kind="payroll" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });
});

describe('Role dashboards', () => {
  it('gives employees today’s attendance, balances, payslips and notifications', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<SelfServiceDashboard role="EMPLOYEE" />);
    expect(await screen.findByRole('heading', { name: 'Today’s attendance' })).toBeInTheDocument();
    expect(await screen.findByText('Casual Leave')).toBeInTheDocument();
    expect(await screen.findByText(/^Payslip available$/)).toBeInTheDocument();
    expect(screen.queryByText('Waiting for your approval')).not.toBeInTheDocument();
  });

  it('adds a pending-approvals card for managers', async () => {
    mockSignIn('manager@cipl.test');
    renderWithProviders(<SelfServiceDashboard role="MANAGER" />);
    expect(await screen.findByText('Waiting for your approval')).toBeInTheDocument();
    expect(
      await screen.findByText(/leave requests and \d+ attendance regularizations/),
    ).toBeInTheDocument();
  });
});
