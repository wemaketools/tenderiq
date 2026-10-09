/**
 * Prototype shell journeys (architecture-plan §8, DD-43): real sign-in against local Supabase Auth, the mock API's
 * session context, the app shell, organization switching (COM-02), sign-out, and axe accessibility checks.
 *
 * Prerequisites: the local Supabase stack is running and the demo accounts exist (`npm run auth:personas`).
 * Playwright starts the mock API and Vite on the prototype ports (playwright.config.ts).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PASSWORD = 'test1234';

async function signIn(page: Page, localPart: string): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(`${localPart}@tenderiq.local`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}

test.describe('prototype shell', () => {
  test('the sign-in page lists the demo accounts in development and passes axe', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demo accounts (local development only)' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a wrong password shows one generic message', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email address').fill('tebogo.officer@tenderiq.local');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('We could not sign you in with those details');
    await expect(page).toHaveURL(/\/signin$/);
  });

  test('tebogo.officer signs in to the buyer shell, which passes axe, and signs out', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await expect(page).toHaveURL(/\/buyer/);
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    await expect(sidebar.locator('.tiq-brand-tenant')).toHaveText('Kalahari Water Utilities (Pilot)');
    await expect(sidebar.locator('.tiq-brand-name')).toHaveText('TenderIQ');
    await expect(sidebar.getByText('Tender Intelligence')).toBeVisible();
    await expect(page.getByTestId('prototype-banner')).toHaveText('Prototype — static demo data');
    await expect(page.getByRole('search')).toBeVisible();
    await expect(page.getByRole('link', { name: /^Notifications(, \d+ unread)?$/ })).toHaveAttribute('href', '/me/notifications');
    await expect(page.getByRole('link', { name: 'Help and support' })).toHaveAttribute('href', '/me/help');
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: /Account menu for Tebogo Molefe/ }).click();
    await expect(page.getByRole('menu', { name: 'Account menu' })).toContainText(
      'Acting as Procurement Officer for Kalahari Water Utilities (Pilot)',
    );
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/signin/);
    await page.goto('/buyer');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('sam.dual chooses an organization, sees the pending one explained and switches organization', async ({ page }) => {
    await signIn(page, 'sam.dual');
    await expect(page).toHaveURL(/\/select-organization/);
    const list = page.getByRole('list', { name: 'Your organizations' });
    await expect(list).toContainText("Waiting for the organization administrator's approval.");
    await expectNoAxeViolations(page);

    await list.getByRole('button', { name: /Tsodilo Engineering/ }).click();
    await expect(page).toHaveURL(/\/supplier/);
    await expect(page.locator('.tiq-brand-tenant')).toHaveText('Tsodilo Engineering');

    await page.getByRole('button', { name: /Account menu for Sam Keitumetse/ }).click();
    await page.getByRole('menuitem', { name: 'Switch organization' }).click();
    await expect(page).toHaveURL(/\/select-organization/);
    await expect(page.getByText(/You are acting as .* for Tsodilo Engineering/)).toBeVisible();
    await page
      .getByRole('list', { name: 'Your organizations' })
      .getByRole('button', { name: /Kalahari Water Utilities/ })
      .click();
    await expect(page).toHaveURL(/\/buyer/);
    await expect(page.locator('.tiq-brand-tenant')).toHaveText('Kalahari Water Utilities (Pilot)');

    // The remembered organization is restored after a reload (DD-36), re-validated by /me/context.
    await page.reload();
    await expect(page).toHaveURL(/\/buyer/);
    await expect(page.locator('.tiq-brand-tenant')).toHaveText('Kalahari Water Utilities (Pilot)');

    // A supplier URL while acting for the buyer explains the context instead of showing supplier data.
    await page.goto('/supplier');
    await expect(page.getByText('This page is for supplier organizations')).toBeVisible();
  });

  test('the shell collapses to an icon rail below 1280px and a drawer below 768px', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await expect(page).toHaveURL(/\/buyer/);
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.locator('.tiq-brand-name')).toBeHidden();
    await expect(page.locator('.tiq-brand-mark')).toBeVisible();
    await page.setViewportSize({ width: 700, height: 900 });
    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.tiq-brand-name')).toBeVisible();
  });

  test('a manager with every permission sees section headings with only the current section and My work open', async ({ page }) => {
    await signIn(page, 'mpho.manager');
    await expect(page).toHaveURL(/\/buyer/);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/buyer/tenders/5');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('button', { name: /^Sourcing/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('button', { name: /^My work/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('button', { name: /^Administration/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Tenders' })).toHaveClass(/tiq-nav-item--active/);
    // Search, notifications and help live in the top bar only.
    await expect(nav.getByRole('link', { name: /^(Search|Notifications|Help & support)/ })).toHaveCount(0);
    expect(await nav.getByRole('link').count()).toBeLessThanOrEqual(12);

    await nav.getByRole('button', { name: /^Administration/ }).click();
    await expect(nav.getByRole('link', { name: 'My organizations' })).toBeVisible();
    await page.reload();
    await expect(nav.getByRole('button', { name: /^Administration/ })).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(page);
  });

  test('the dashboard leaves out what the role cannot see instead of showing it locked (DD-49)', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await expect(page).toHaveURL(/\/buyer/);
    await page.goto('/buyer/dashboard');
    await expect(page.getByRole('heading', { level: 2, name: 'Upcoming deadlines' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workload by owner' })).toHaveCount(0);
    await expect(page.getByText(/limited to procurement managers|Not available in your role/)).toHaveCount(0);
    await expect(page.locator('main [data-state="restricted"]')).toHaveCount(0);

    await page.getByRole('button', { name: /^Account menu for/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/signin/);
    await signIn(page, 'mpho.manager');
    await expect(page).toHaveURL(/\/buyer/);
    await page.goto('/buyer/dashboard');
    await expect(page.getByRole('heading', { name: 'Workload by owner' })).toBeVisible();
  });
});
