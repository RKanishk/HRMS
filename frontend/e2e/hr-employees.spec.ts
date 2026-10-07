import { expect, test, type Page } from '@playwright/test';

async function signInAsHr(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill('hr@cipl.test');
  await page.getByLabel(/password/i).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test('HR dashboard shows live metrics and charts', async ({ page }) => {
  await signInAsHr(page);
  await expect(page.getByText('Total employees')).toBeVisible();
  await expect(page.getByRole('img', { name: /employees per department/i })).toBeVisible();
});

test('HR can search, create, view and edit an employee', async ({ page, isMobile }) => {
  test.skip(isMobile, 'HR journey is desktop-first');
  await signInAsHr(page);
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Employees' })
    .click();
  await page.getByRole('searchbox', { name: 'Search employees' }).fill('CIPL017');
  await expect(page.getByText('Showing 1–1 of 1')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search employees' }).fill('');

  await page.getByRole('link', { name: 'Add employee' }).click();
  await page.getByLabel(/^First name/).fill('Riya');
  await page.getByLabel(/^Last name/).fill('Test');
  await page.getByLabel(/^Date of birth/).fill('1994-05-06');
  await page.getByLabel(/^Gender/).selectOption('FEMALE');
  await page.getByLabel(/^Employee code/).fill('CIPL901');
  await page.getByLabel(/^Joining date/).fill('2026-09-15');
  await page.getByLabel(/^Department/).selectOption({ label: 'Finance' });
  await page.getByLabel(/^Designation/).selectOption({ label: 'Accounts Executive' });
  await page.getByLabel(/^Branch/).selectOption({ label: 'Head Office' });
  await page.getByLabel(/^Shift/).selectOption({ index: 1 });
  await page.getByLabel(/^Work email/).fill('riya.test@cipl.test');
  await page.getByLabel(/^Phone/).fill('+91 9876500001');
  await page.getByLabel(/^Address/).fill('1 Test Road');
  await page.getByLabel(/^Emergency contact name/).fill('Contact');
  await page.getByLabel(/^Emergency contact phone/).fill('9876500002');
  await page.getByRole('button', { name: 'Create employee' }).click();
  await expect(page.getByRole('heading', { name: 'Riya Test' })).toBeVisible();

  await page.getByRole('link', { name: 'Edit employee' }).click();
  await page.getByLabel(/^Phone/).fill('+91 9876500099');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('tab', { name: 'Contact' }).click();
  await expect(page.getByText('+91 9876500099')).toBeVisible();
});

test('HR can add a department and is told when one is in use', async ({ page, isMobile }) => {
  test.skip(isMobile, 'HR journey is desktop-first');
  await signInAsHr(page);
  await page.goto('/organization/departments');
  await page.getByRole('button', { name: 'Add department' }).click();
  await page.getByLabel(/^Name/).fill('Legal');
  await page.getByLabel(/^Code/).fill('LEG');
  await page.getByRole('dialog').getByRole('button', { name: 'Add department' }).click();
  await expect(page.getByRole('cell', { name: 'Legal' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Engineering' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toContainText('employees are assigned to it');
});

test('employees can see holidays but not edit them', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill('employee@cipl.test');
  await page.getByLabel(/password/i).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/holidays');
  await expect(page.getByRole('button', { name: /Add holiday/ })).toHaveCount(0);
});
