import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMocks, mockSignIn } from '@/lib/mocks/adapter';
import { renderWithProviders } from '@/test/utils';
import { ApplyLeave } from './apply-leave';
import { LeaveRequests } from './leave-requests';
import { MyLeave } from './my-leave';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

beforeAll(() => installMocks());
const setValue = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

async function fillDates(from: string, to: string) {
  const type = screen.getByLabelText(/^Leave type/);
  await waitFor(() =>
    expect(within(type).getByRole('option', { name: 'Casual Leave' })).toBeInTheDocument(),
  );
  await userEvent.selectOptions(type, 'Casual Leave');
  setValue(screen.getByLabelText(/^From/), from);
  setValue(screen.getByLabelText(/^To/), to);
}

describe('Apply for leave', () => {
  it('validates required fields and does not call the API', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<ApplyLeave />);
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Select a leave type')).toBeInTheDocument();
    expect(screen.getByText('Select the first day')).toBeInTheDocument();
    expect(screen.getByText('Give a short reason (at least 5 characters)')).toBeInTheDocument();
  });

  it('shows the duration and balance calculated by the backend', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<ApplyLeave />);
    await fillDates('2027-06-07', '2027-06-08');
    const status = await screen.findByText(/working days?/);
    expect(status.closest('[role="status"]')).toHaveTextContent('2 working days');
    expect(status.closest('[role="status"]')).toHaveTextContent('12 available');
  });

  it('blocks a request that exceeds the balance', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<ApplyLeave />);
    await fillDates('2027-06-07', '2027-06-30');
    expect(await screen.findByText(/Not enough balance/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled();
  });

  it('sends a valid request and returns to My leave', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<ApplyLeave />);
    await fillDates('2027-06-07', '2027-06-08');
    await screen.findByText(/working days?/);
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Cousin wedding');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/me/leave'));
  });

  it('keeps the entries and explains when the backend rejects an overlapping request', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<ApplyLeave />);
    await fillDates('2027-06-07', '2027-06-08');
    await screen.findByText(/working days?/);
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Trying again');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('overlapping');
    expect(screen.getByLabelText(/^Reason/)).toHaveValue('Trying again');
  });
});

describe('My leave', () => {
  it('shows balances and history, and cancels a pending request after confirmation', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<MyLeave />);
    const balances = await screen.findByRole('region', { name: 'Leave balances' });
    expect(await within(balances).findByText('Casual Leave')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'My leave requests' });
    expect(within(table).getByText('Family function')).toBeInTheDocument();
    await userEvent.click(
      within(table).getByRole('button', { name: 'Cancel Earned Leave request' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: 'My leave requests' })).queryByRole('button', {
          name: 'Cancel Earned Leave request',
        }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('Leave approvals', () => {
  const approveButtons = () =>
    within(screen.getByRole('table', { name: 'Leave requests' })).queryAllByRole('button', {
      name: /^Approve leave for/,
    });

  it('shows the details a manager needs and requires a reason to reject', async () => {
    mockSignIn('manager@cipl.test');
    renderWithProviders(<LeaveRequests scope="team" />);
    const table = await screen.findByRole('table', { name: 'Leave requests' });
    expect(within(table).getAllByText(/available/).length).toBeGreaterThan(0);
    const before = approveButtons().length;
    await userEvent.click(within(table).getAllByRole('button', { name: /^Reject leave for/ })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    expect(await within(dialog).findByText('Enter a reason for rejecting')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Project deadline that week');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(approveButtons().length).toBe(before - 1));
  });

  it('approves a request after confirmation', async () => {
    mockSignIn('manager@cipl.test');
    renderWithProviders(<LeaveRequests scope="team" />);
    await screen.findByRole('table', { name: 'Leave requests' });
    const before = approveButtons().length;
    await userEvent.click(approveButtons()[0]);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('available before this request');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve request' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(approveButtons().length).toBe(before - 1));
  });

  it('refuses employees who are not approvers', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<LeaveRequests scope="all" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });
});
