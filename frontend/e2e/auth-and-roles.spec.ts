import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/password/i).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test('unauthenticated visitors are sent to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill('hr@cipl.test');
  await page.getByLabel(/password/i).fill('nope');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
});

test('employee sees self-service navigation only and is blocked from payroll', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'employee@cipl.test');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'My Payslips' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Payroll', exact: true })).toHaveCount(0);
  await page.goto('/payroll');
  await expect(page.getByText('You don’t have access to this page')).toBeVisible();
});

test('HR sees Employees and Payroll; sign out returns to login', async ({ page, isMobile }) => {
  await signIn(page, 'hr@cipl.test');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Employees' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Payroll', exact: true })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Close menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/login/);
});
