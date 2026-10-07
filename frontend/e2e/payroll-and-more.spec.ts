import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/password/i).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test('HR opens a payroll run and reviews an employee’s pay', async ({ page }) => {
  await signIn(page, 'hr@cipl.test');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Payroll', exact: true })
    .click();
  await page
    .getByRole('link', { name: /^Open / })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /^Payroll for/ })).toBeVisible();
  await page
    .getByRole('button', { name: /^Review payroll for/ })
    .first()
    .click();
  await expect(page.getByRole('dialog').getByText('Net pay')).toBeVisible();
});

test('employee views a payslip', async ({ page }) => {
  await signIn(page, 'employee@cipl.test');
  await page.goto('/me/payslips');
  await page
    .getByRole('link', { name: /Net pay/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /^Payslip for/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
});

test('employee sees notifications and uploads a document', async ({ page }) => {
  await signIn(page, 'employee@cipl.test');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/me/documents');
  await page.setInputFiles('#doc-file', {
    name: 'cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('demo'),
  });
  await page.getByLabel(/^Document type/).selectOption({ label: 'ID proof' });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('cell', { name: /cv\.pdf/ })).toBeVisible();
});

test('HR checks onboarding and a report', async ({ page }) => {
  await signIn(page, 'hr@cipl.test');
  await page.goto('/onboarding');
  await expect(page.getByRole('progressbar').first()).toBeVisible();
  await page.goto('/reports');
  await expect(page.getByRole('table', { name: 'Headcount report' })).toBeVisible();
});
