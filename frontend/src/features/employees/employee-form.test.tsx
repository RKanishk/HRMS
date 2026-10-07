import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMocks } from '@/lib/mocks/adapter';
import { renderWithProviders } from '@/test/utils';
import { EmployeeForm } from './employee-form';

beforeAll(() => installMocks());

async function fillValid() {
  const type = (label: string, value: string) =>
    userEvent.type(screen.getByLabelText(new RegExp(`^${label}`)), value);
  await type('First name', 'Test');
  await type('Last name', 'Person');
  await userEvent.type(screen.getByLabelText(/^Date of birth/), '1990-04-12');
  await userEvent.selectOptions(screen.getByLabelText(/^Gender/), 'FEMALE');
  await type('Employee code', 'CIPL900');
  await userEvent.type(screen.getByLabelText(/^Joining date/), '2026-09-01');
  for (const [label, option] of [
    ['Department', 'Finance'],
    ['Designation', 'Accounts Executive'],
    ['Branch', 'Head Office'],
    ['Shift', 'General (09:30–18:30)'],
  ]) {
    const select = screen.getByLabelText(new RegExp(`^${label}`));
    await waitFor(() =>
      expect(within(select).getByRole('option', { name: option })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(select, option);
  }
  await type('Work email', 'test.person@cipl.test');
  await type('Phone', '+91 9876543210');
  await type('Address', '1 Test Road');
  await type('Emergency contact name', 'Someone');
  await type('Emergency contact phone', '9876500000');
}

describe('EmployeeForm', () => {
  it('shows validation messages and does not submit an empty form', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <EmployeeForm submitLabel="Create employee" cancelHref="/employees" onSubmit={onSubmit} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText('Enter the first name')).toBeInTheDocument();
    expect(screen.getByText('Enter the employee code')).toBeInTheDocument();
    expect(screen.getByText('Select a department')).toBeInTheDocument();
    expect(screen.getByText('Enter the email address')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects an invalid email address', async () => {
    renderWithProviders(
      <EmployeeForm submitLabel="Create employee" cancelHref="/employees" onSubmit={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText(/^Work email/), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('submits valid values once', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <EmployeeForm submitLabel="Create employee" cancelHref="/employees" onSubmit={onSubmit} />,
    );
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      employeeCode: 'CIPL900',
      firstName: 'Test',
      email: 'test.person@cipl.test',
      managerId: null,
      status: 'ACTIVE',
    });
  });

  it('keeps entered data and shows the server error when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('conflict'));
    renderWithProviders(
      <EmployeeForm submitLabel="Create employee" cancelHref="/employees" onSubmit={onSubmit} />,
    );
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your entries are still here');
    expect(screen.getByLabelText(/^First name/)).toHaveValue('Test');
    expect(screen.getByLabelText(/^Work email/)).toHaveValue('test.person@cipl.test');
  });
});
