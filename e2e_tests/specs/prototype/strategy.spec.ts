/**
 * Strategy screens (BUY-06, FR-05) end to end: every strategy detail loads against the running mock API, which
 * catches contract drift between the SPA and the mock API (the SPA validates every response against the contract
 * in development builds and shows "does not match its API contract" when they disagree). Also covers the RFI rules
 * on the strategy form: the procedure follows the event type, and competition-only fields do not apply to an RFI.
 *
 * Prerequisites: the local Supabase stack is running and the demo accounts exist (`npm run auth:personas`).
 * Playwright starts a fresh mock API and Vite on the prototype ports (playwright.config.ts).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const LOAD_FAILURE = 'This could not be loaded';

async function signInAsOfficer(page: Page): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill('tebogo.officer@tenderiq.local');
  await page.getByLabel('Password').fill('test1234');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/buyer/);
}

/** The "Strategy" card of the detail page, where the recorded strategy fields are listed. */
function strategyCard(page: Page) {
  return page.locator('section.tiq-card').filter({ has: page.getByRole('heading', { level: 2, name: 'Strategy', exact: true }) });
}

async function expectLoaded(page: Page, heading: string | RegExp): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.getByText(LOAD_FAILURE)).toHaveCount(0);
}

test.describe('strategy screens (BUY-06)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page);
  });

  test('every strategy in the register opens without a load or contract error', async ({ page }) => {
    await page.goto('/buyer/strategies');
    await expectLoaded(page, 'Market research and strategy');
    const links = page.locator('main a[href^="/buyer/strategies/"]:not([href$="/new"])');
    await expect(links.first()).toBeVisible();
    const hrefs = [
      ...new Set(
        (await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''))).filter(
          (href) => /^\/buyer\/strategies\/\d+$/.test(href),
        ),
      ),
    ];
    expect(hrefs.length).toBeGreaterThan(1);

    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible();
      await expect(page.getByText(LOAD_FAILURE), `${href} failed to load`).toHaveCount(0);
    }
  });

  test('the RFI strategy shows its use of supplier information and marks competition fields not applicable', async ({ page }) => {
    await page.goto('/buyer/strategies/503');
    await expect(page.getByText(LOAD_FAILURE)).toHaveCount(0);
    const card = strategyCard(page);
    await expect(card.getByText('Use of supplier information', { exact: true })).toBeVisible();
    await expect(card.getByText(/creates no right to an award/)).toBeVisible();
    await expect(card.getByText('Not applicable (RFI)').first()).toBeVisible();
    await expect(card.getByText('Competition rationale', { exact: true })).toHaveCount(0);
  });

  test('a competitive strategy shows the competition fields and no RFI statement', async ({ page }) => {
    await page.goto('/buyer/strategies/502');
    await expect(page.getByText(LOAD_FAILURE)).toHaveCount(0);
    const card = strategyCard(page);
    await expect(card.getByText('Competition rationale', { exact: true })).toBeVisible();
    await expect(card.getByText('Use of supplier information', { exact: true })).toHaveCount(0);
  });

  test('choosing RFI on a new strategy locks the procedure and keeps only the fields an RFI needs', async ({ page }) => {
    await page.goto('/buyer/strategies/new');
    await expectLoaded(page, 'New strategy');

    await page.getByLabel(/^Event type/).selectOption('rfi');

    await expect(page.getByRole('radio', { name: /^RFI/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /^Open/ })).toHaveCount(0);
    await expect(page.getByLabel(/^Award model/)).toHaveCount(0);
    await expect(page.getByLabel(/^Competition rationale/)).toHaveCount(0);
    await expect(page.getByLabel(/^Lot structure/)).toHaveCount(0);
    await expect(page.getByLabel(/^What do you want to learn/)).toBeVisible();
    await expect(page.getByLabel(/^Use of supplier information/)).toHaveValue(/creates no right to an award/);

    await page.getByLabel(/^Event type/).selectOption('rfq');
    await expect(page.getByRole('radio', { name: /^Open/ })).toBeChecked();
    await expect(page.getByLabel(/^Competition rationale/)).toBeVisible();
  });
});
