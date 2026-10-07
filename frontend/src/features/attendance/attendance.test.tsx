import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { subDays, format } from 'date-fns';
import { installMocks, mockSignIn } from '@/lib/mocks/adapter';
import { attendanceApi } from '@/lib/api/attendance';
import { renderWithProviders } from '@/test/utils';
import { DailyAttendance } from './daily-attendance';
import { MonthlyAttendance } from './monthly-attendance';
import { MyAttendance } from './my-attendance';
import { RegularizationList } from './regularization-list';

beforeAll(() => installMocks());
const setValue = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const WEEKDAY = '2026-09-16'; // a fixed past Wednesday

describe('Daily attendance (HR)', () => {
  it('shows the register with status counts and filters by status', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<DailyAttendance scope="all" />);
    await screen.findByRole('table', { name: /Attendance on/ });
    setValue(screen.getByLabelText('Date'), WEEKDAY);
    await screen.findByRole('table', { name: `Attendance on ${WEEKDAY}` });
    await userEvent.selectOptions(screen.getByLabelText('Attendance status'), 'PRESENT');
    await waitFor(() => {
      const table = screen.getByRole('table', { name: `Attendance on ${WEEKDAY}` });
      expect(within(table).getAllByText('Present').length).toBeGreaterThan(0);
      expect(within(table).queryByText('Absent')).not.toBeInTheDocument();
    });
  });

  it('shows an error with retry when the API fails', async () => {
    mockSignIn('hr@cipl.test');
    vi.spyOn(attendanceApi, 'daily').mockRejectedValueOnce(new Error('down'));
    renderWithProviders(<DailyAttendance scope="all" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this page');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: /Attendance on/ })).toBeInTheDocument();
  });

  it('is refused for people without the HR role', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<DailyAttendance scope="all" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });
});

describe('Monthly attendance (HR)', () => {
  it('renders one row per employee with a legend that explains the codes', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<MonthlyAttendance />);
    const table = await screen.findByRole('table', { name: /Attendance for/ });
    expect(within(table).getByText('CIPL001')).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Half day')).toBeInTheDocument();
    expect(within(legend).getByText('Weekly off')).toBeInTheDocument();
  });
});

describe('Attendance regularization', () => {
  it('lets an employee request a correction and a manager approve it', async () => {
    mockSignIn('employee@cipl.test');
    const first = renderWithProviders(<MyAttendance />);
    await userEvent.click(await screen.findByRole('button', { name: 'Request regularization' }));
    const dialog = await screen.findByRole('dialog');
    setValue(within(dialog).getByLabelText(/^Date/), format(subDays(new Date(), 20), 'yyyy-MM-dd'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    expect(
      await within(dialog).findByText('Give a short reason (at least 5 characters)'),
    ).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Forgot to punch in');
    setValue(within(dialog).getByLabelText(/^Check-out/), '08:00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    expect(await within(dialog).findByText('Check-out must be after check-in')).toBeInTheDocument();

    setValue(within(dialog).getByLabelText(/^Check-out/), '18:30');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const mine = await screen.findByRole('table', { name: 'My regularization requests' });
    expect(within(mine).getByText('Forgot to punch in')).toBeInTheDocument();
    first.unmount();

    mockSignIn('manager@cipl.test');
    renderWithProviders(<RegularizationList scope="team" />);
    const table = await screen.findByRole('table', { name: 'Attendance regularization requests' });
    const approveButtons = () =>
      within(table).getAllByRole('button', { name: /^Approve request from Neha Iyer/ });
    const before = approveButtons().length;
    await userEvent.click(approveButtons()[0]);
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve request' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(approveButtons().length).toBe(before - 1));
  });

  it('requires a reason to reject', async () => {
    mockSignIn('manager@cipl.test');
    renderWithProviders(<RegularizationList scope="team" />);
    const table = await screen.findByRole('table', { name: 'Attendance regularization requests' });
    await userEvent.click(
      within(table).getAllByRole('button', { name: /^Reject request from/ })[0],
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    expect(await within(dialog).findByText('Enter a reason for rejecting')).toBeInTheDocument();
  });
});
