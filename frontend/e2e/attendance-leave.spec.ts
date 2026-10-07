import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/password/i).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test('employee applies for leave and sees it pending', async ({ page }) => {
  await signIn(page, 'employee@cipl.test');
  await page.goto('/me/leave');
  await page.getByRole('link', { name: 'Apply for leave' }).first().click();
  await page.getByLabel(/^Leave type/).selectOption({ label: 'Casual Leave' });
  await page.getByLabel(/^From/).fill('2027-06-07');
  await page.getByLabel(/^To/).fill('2027-06-08');
  await expect(page.getByText(/2 working days/)).toBeVisible();
  await page.getByLabel(/^Reason/).fill('Family event');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL(/\/me\/leave$/);
  await expect(page.getByText('Family event')).toBeVisible();
});

test('manager reviews and approves a leave request', async ({ page }) => {
  await signIn(page, 'manager@cipl.test');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Approvals' })
    .click();
  await page
    .getByRole('button', { name: /^Approve leave for/ })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve request' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('HR sees the monthly attendance grid and is blocked from My Leave', async ({ page }) => {
  await signIn(page, 'hr@cipl.test');
  await page.goto('/attendance/monthly');
  await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
  await page.goto('/me/leave');
  await expect(page.getByText('You don’t have access to this page')).toBeVisible();
});
