import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMocks } from '@/lib/mocks/adapter';
import { renderWithProviders } from '@/test/utils';
import { CrudPage } from './crud-page';
import { ENTITIES, HOLIDAYS } from './entities';

beforeAll(() => installMocks());
const departments = ENTITIES[0];
// The page renders a table (md+) and a card list (phones); assert against the table.
const tableOf = (name: string) => screen.findByRole('table', { name });

describe('CrudPage', () => {
  it('validates, then adds a department', async () => {
    renderWithProviders(<CrudPage config={departments} canEdit />);
    expect(
      await within(await tableOf('Departments')).findByText('Engineering'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add department' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add department' }));
    expect(await within(dialog).findByText('Enter a department name')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Legal');
    await userEvent.type(within(dialog).getByLabelText(/^Code/), 'LEG');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add department' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await within(await tableOf('Departments')).findByText('Legal')).toBeInTheDocument();
  });

  it('explains why a department in use cannot be deleted', async () => {
    renderWithProviders(<CrudPage config={departments} canEdit />);
    expect(
      await within(await tableOf('Departments')).findByText('Engineering'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Engineering' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('employees are assigned to it');
    // The open dialog hides the page from the accessibility tree, hence hidden: true.
    expect(
      within(screen.getByRole('table', { name: 'Departments', hidden: true })).getByText(
        'Engineering',
      ),
    ).toBeInTheDocument();
  });

  it('hides edit controls for people who cannot edit (holidays for non-HR)', async () => {
    renderWithProviders(<CrudPage config={HOLIDAYS} canEdit={false} />);
    expect(await within(await tableOf('Holidays')).findByText('Diwali')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add holiday/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
