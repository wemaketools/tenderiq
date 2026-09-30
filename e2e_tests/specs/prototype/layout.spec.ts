/**
 * Layout guards for shared components, checked in a real browser (jsdom cannot measure layout):
 * - KPI values never overflow their card; long amounts such as "BWP 1,920,000" shrink to fit (KpiCard).
 * - Flush cards keep tables edge to edge, but every other block keeps the card gutter, so text never touches
 *   the card border (`.tiq-card--flush` in theme/components.css).
 *
 * Prerequisites: the local Supabase stack is running and the demo accounts exist (`npm run auth:personas`).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function signInAsOfficer(page: Page): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill('tebogo.officer@tenderiq.local');
  await page.getByLabel('Password').fill('test1234');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/buyer/);
}

/** KPI values whose text reaches past the right edge of their card. */
async function overflowingKpiValues(page: Page): Promise<string[]> {
  return page.$$eval('.tiq-kpi-value', (values) =>
    values
      .filter((value) => {
        const card = value.closest('.tiq-card');
        if (card === null) return false;
        const range = document.createRange();
        range.selectNodeContents(value);
        return range.getBoundingClientRect().right > card.getBoundingClientRect().right - 1;
      })
      .map((value) => value.textContent ?? ''),
  );
}

/** Non-table blocks of flush cards without the horizontal card gutter. */
async function unpaddedFlushBlocks(page: Page): Promise<string[]> {
  return page.$$eval('.tiq-card--flush > :not(.tiq-card-head):not(.tiq-datatable)', (blocks) =>
    blocks
      .filter((block) => parseFloat(getComputedStyle(block).paddingLeft) < 12 || parseFloat(getComputedStyle(block).paddingRight) < 12)
      .map((block) => (block.textContent ?? '').slice(0, 60)),
  );
}

const PAGES = ['/buyer/tenders/5/pricing', '/buyer', '/buyer/contracts', '/buyer/requests', '/buyer/tenders/5'];

test.describe('shared layout', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page);
  });

  for (const width of [1600, 1280]) {
    test(`KPI values fit their cards and flush cards keep their gutter at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForLoadState('networkidle');
        expect(await overflowingKpiValues(page), `${path} at ${width}px`).toEqual([]);
        expect(await unpaddedFlushBlocks(page), `${path} at ${width}px`).toEqual([]);
      }
    });
  }

  test('short KPI values keep the full size; only values that do not fit are scaled down', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/buyer');
    const active = page.locator('.tiq-kpi-value').first();
    await expect(active).toBeVisible();
    await expect(active).not.toHaveClass(/tiq-kpi-value--fit/);
    expect(await active.evaluate((element) => getComputedStyle(element).fontSize)).toBe('28px');
  });
});
