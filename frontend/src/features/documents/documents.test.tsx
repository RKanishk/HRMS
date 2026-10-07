import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMocks, mockSignIn } from '@/lib/mocks/adapter';
import { renderWithProviders } from '@/test/utils';
import { HrDocumentsPage, MyDocumentsPage } from './documents-pages';

beforeAll(() => installMocks());
const user = () => userEvent.setup({ applyAccept: false });
const pdf = (name = 'cv.pdf') => new File(['hello'], name, { type: 'application/pdf' });

describe('My documents', () => {
  it('rejects the wrong file type and oversized files before uploading', async () => {
    mockSignIn('employee@cipl.test');
    const u = user();
    renderWithProviders(<MyDocumentsPage />);
    await screen.findByRole('table', { name: 'My documents' });
    const input = screen.getByLabelText(/choose a file/i);
    await u.upload(input, new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only PDF, JPG or PNG');
    await u.upload(
      input,
      new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('larger than 5 MB');
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('uploads a valid document and shows it as pending review', async () => {
    mockSignIn('employee@cipl.test');
    const u = user();
    renderWithProviders(<MyDocumentsPage />);
    await screen.findByRole('table', { name: 'My documents' });
    await u.upload(screen.getByLabelText(/choose a file/i), pdf());
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    await u.selectOptions(screen.getByLabelText(/^Document type/), 'ID proof');
    await u.click(screen.getByRole('button', { name: 'Upload' }));
    const table = await screen.findByRole('table', { name: 'My documents' });
    expect(await within(table).findByText('cv.pdf')).toBeInTheDocument();
  });

  it('lets an employee delete a pending document but not a verified one', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<MyDocumentsPage />);
    const table = await screen.findByRole('table', { name: 'My documents' });
    expect(
      within(table).queryByRole('button', { name: 'Delete aadhaar-card.pdf' }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'Delete rent-agreement.pdf' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: 'My documents' })).queryByText(
          'rent-agreement.pdf',
        ),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('HR documents', () => {
  it('verifies a pending document after confirmation', async () => {
    mockSignIn('hr@cipl.test');
    renderWithProviders(<HrDocumentsPage />);
    const table = await screen.findByRole('table', { name: 'Employee documents' });
    await userEvent.click(within(table).getByRole('button', { name: 'Verify passport.pdf' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Verify document' }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: 'Employee documents' })).queryByText(
          'passport.pdf',
        ),
      ).not.toBeInTheDocument(),
    );
  });

  it('is refused for employees', async () => {
    mockSignIn('employee@cipl.test');
    renderWithProviders(<HrDocumentsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
  });
});
