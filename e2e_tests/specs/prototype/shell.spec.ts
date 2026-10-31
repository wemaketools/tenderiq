/**
 * Prototype shell journeys (architecture-plan §8, DD-50): sign-in with the persona picker, the in-browser mock
 * API's session context, the app shell, organization switching (COM-02), sign-out, and axe accessibility checks.
 *
 * No prerequisites: Playwright starts Vite on the prototype port (playwright.config.ts), and the mock API runs in
 * the page.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function signIn(page: Page, localPart: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`[data-persona="${localPart}@tenderiq.local"]`).click();
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}

test.describe('prototype shell', () => {
  test('the sign-in page lists the demo personas without any password field and passes axe', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: 'Choose a demo persona', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kalahari Water Utilities (Pilot)' })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('a deactivated persona shows one generic message and stays on sign-in', async ({ page }) => {
    await signIn(page, 'former.officer');
    await expect(page.getByRole('alert')).toContainText('This persona cannot sign in');
    await expect(page).toHaveURL(/\/signin$/);
  });

  test('tebogo.officer signs in to the buyer shell, which passes axe, and signs out', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await expect(page).toHaveURL(/\/buyer/);
    // Buyer presentation (design1): the brand mark on the labelled rail, the organization in the utility bar.
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    await expect(sidebar.locator('.tiq-brand-mark')).toBeVisible();
    await expect(page.getByRole('button', { name: /Switch organization/ })).toContainText('Kalahari Water Utilities (Pilot)');
    const nav = sidebar.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Overview' })).toHaveClass(/tiq-rail-item--active/);
    await expect(nav.getByRole('link', { name: 'Tenders' })).toBeVisible();
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
    // A supplier organization keeps the default shell: the tenant label and wordmark on the sidebar.
    await expect(page.locator('.tiq-brand-tenant')).toBeVisible();
    await expect(page.locator('.tiq-brand-tenant')).toHaveText('Tsodilo Engineering');
    await expect(page.locator('.tiq-brand-name')).toHaveText('TenderIQ');
    await expect(page.getByRole('button', { name: /Switch organization/ })).toHaveCount(0);

    await page.getByRole('button', { name: /Account menu for Sam Keitumetse/ }).click();
    await page.getByRole('menuitem', { name: 'Switch organization' }).click();
    await expect(page).toHaveURL(/\/select-organization/);
    await expect(page.getByText(/You are acting as .* for Tsodilo Engineering/)).toBeVisible();
    await page
      .getByRole('list', { name: 'Your organizations' })
      .getByRole('button', { name: /Kalahari Water Utilities/ })
      .click();
    await expect(page).toHaveURL(/\/buyer/);
    await expect(page.getByRole('button', { name: /Switch organization/ })).toContainText('Kalahari Water Utilities (Pilot)');

    // The remembered organization is restored after a reload (DD-36), re-validated by /me/context.
    await page.reload();
    await expect(page).toHaveURL(/\/buyer/);
    await expect(page.getByRole('button', { name: /Switch organization/ })).toContainText('Kalahari Water Utilities (Pilot)');

    // A supplier URL while acting for the buyer explains the context instead of showing supplier data.
    await page.goto('/supplier');
    await expect(page.getByText('This page is for supplier organizations')).toBeVisible();

    // The utility bar switcher enters the supplier organization in place (design1).
    await page.goto('/buyer');
    await page.getByRole('button', { name: /Switch organization/ }).click();
    await page.getByRole('menu', { name: 'Your organizations' }).getByRole('menuitem', { name: /Tsodilo Engineering/ }).click();
    await expect(page).toHaveURL(/\/supplier/);
    await expect(page.locator('.tiq-brand-tenant')).toHaveText('Tsodilo Engineering');
  });

  test('the buyer shell keeps its labelled rail down to 768px and becomes a drawer with the full list below', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await expect(page).toHaveURL(/\/buyer/);
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.locator('.tiq-brand-name')).toBeHidden();
    await expect(page.locator('.tiq-brand-mark')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Tenders' })).toBeVisible();
    await page.setViewportSize({ width: 700, height: 900 });
    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.tiq-brand-name')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^More/ })).toHaveCount(0);
  });

  test('a manager with every permission gets the six pinned destinations and the rest under More (design1)', async ({ page }) => {
    await signIn(page, 'mpho.manager');
    await expect(page).toHaveURL(/\/buyer/);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/buyer/tenders/5');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Tenders', 'Approvals', 'Evaluations', 'Awards', 'Contracts']);
    await expect(nav.getByRole('link', { name: 'Tenders' })).toHaveClass(/tiq-rail-item--active/);
    // Search, notifications and help live in the utility bar only.
    await expect(nav.getByRole('link', { name: /^(Search|Notifications|Help & support)/ })).toHaveCount(0);

    const more = nav.getByRole('button', { name: /^More/ });
    await more.click();
    const menu = page.getByRole('menu', { name: 'More destinations' });
    await expect(menu.getByText('Administration')).toBeVisible();
    await menu.getByRole('menuitem', { name: 'My organizations' }).click();
    await expect(page).toHaveURL(/\/me\/memberships/);
    await expect(nav.getByRole('button', { name: 'More, current page inside' })).toHaveAttribute('aria-current', 'page');
    await expectNoAxeViolations(page);
  });

  test('a supplier keeps the grouped sidebar with section headings (DD-48)', async ({ page }) => {
    await signIn(page, 'tsodilo.bidmanager');
    await expect(page).toHaveURL(/\/supplier/);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('button', { name: /^My work/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link').first()).toHaveClass(/tiq-nav-item/);
    await expectNoAxeViolations(page);
  });

  test('the dashboard leaves out what the role cannot see instead of showing it locked (DD-49)', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await expect(page).toHaveURL(/\/buyer/);
    await page.goto('/buyer/dashboard');
    await expect(page.getByRole('heading', { level: 2, name: /^Up next/ })).toBeVisible();
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
