/**
 * Layout guards for shared components, checked in a real browser (jsdom cannot measure layout):
 * - KPI values never overflow their card; long amounts such as "BWP 1,920,000" shrink to fit (KpiCard).
 * - Flush cards keep tables edge to edge, but every other block keeps the card gutter, so text never touches
 *   the card border (`.tiq-card--flush` in theme/components.css).
 * - The buyer utility bar's search box and icons never move between pages, and it holds no buttons at all: the
 *   section action of the active sidebar destination renders in the page head on every page of the destination,
 *   beside the page's own buttons, never twice (DD-46 as amended by docs/plan/design1).
 * - Tabs start at the same height on every tab of a section, whether or not the tab's page has buttons in its head row.
 * - A record header keeps its buttons on the first row, beside the text, at the same place on every tab: the record
 *   meta runs full width below the buttons, so it never pushes them onto a row of their own.
 *
 * No prerequisites: Playwright starts Vite, and the mock API runs in the page (DD-50).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function signInAsOfficer(page: Page): Promise<void> {
  await page.goto('/signin');
  await page.locator('[data-persona="tebogo.officer@tenderiq.local"]').click();
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
    await page.goto('/buyer/requests');
    const active = page.locator('.tiq-kpi-value').first();
    await expect(active).toBeVisible();
    await expect(active).not.toHaveClass(/tiq-kpi-value--fit/);
    expect(await active.evaluate((element) => getComputedStyle(element).fontSize)).toBe('28px');
  });
});

/** The left edge of the search box and of each top bar icon, in page order. */
async function topbarAnchors(page: Page): Promise<number[]> {
  return page.$$eval('.tiq-topbar form[role="search"], .tiq-topbar-actions > a', (elements) =>
    elements.map((element) => Math.round(element.getBoundingClientRect().left)),
  );
}

test.describe('utility bar and section action placement (DD-46, design1)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
  });

  test('keeps search and the icons in place on every page, with or without a section action', async ({ page }) => {
    const paths = ['/me/tasks', '/buyer/requests', '/buyer/tenders/5', '/buyer/tenders/5/pricing', '/buyer/evaluation', '/me/notifications'];
    let reference: number[] | null = null;
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
      const anchors = await topbarAnchors(page);
      expect(anchors, path).toHaveLength(4);
      if (reference === null) reference = anchors;
      expect(anchors, `${path} moved the search box or icons`).toEqual(reference);
    }
  });

  test('shows the section action once, in the page head, on every page of the destination', async ({ page }) => {
    for (const path of ['/buyer/tenders', '/buyer/tenders/5', '/buyer/tenders/5/scope', '/buyer/tenders/5/evaluation']) {
      await page.goto(path);
      const action = page.locator('main .tiq-page-section-action');
      await expect(action, path).toHaveText('New tender');
      await expect(action).toHaveAttribute('href', '/buyer/tenders/new');
      await expect(page.locator('.tiq-topbar .tiq-btn'), path).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'New tender' }), path).toHaveCount(1);
    }
    await page.goto('/buyer/tenders/new');
    await expect(page.locator('main .tiq-page-section-action')).toHaveCount(0);
  });

  test('shows the organization switcher in the utility bar and enters another organization from it', async ({ page }) => {
    await page.goto('/buyer/tenders');
    const switcher = page.getByRole('button', { name: /Switch organization/ });
    await expect(switcher).toContainText('Kalahari Water Utilities (Pilot)');
    await switcher.click();
    const menu = page.getByRole('menu', { name: 'Your organizations' });
    await expect(menu.getByRole('menuitem', { name: /Kalahari Water Utilities/ })).toHaveAttribute('aria-current', 'true');
    await expect(menu.getByRole('menuitem', { name: 'All organizations…' })).toHaveAttribute('href', '/select-organization');
    await page.keyboard.press('Escape');
    await expect(switcher).toBeFocused();
  });

  test('keeps the page and record buttons in the content area, never in the top bar', async ({ page }) => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['/buyer/tenders/5', 'Edit details'],
      ['/buyer/tenders/5/scope', 'Add requirement'],
      ['/buyer/tenders/5/pricing', 'Add pricing schedule'],
    ];
    for (const [path, name] of cases) {
      await page.goto(path);
      const button = page.getByRole('button', { name, exact: true });
      await expect(button, path).toBeVisible();
      await expect(page.locator('main').getByRole('button', { name, exact: true })).toBeVisible();
      await expect(page.locator('.tiq-topbar').getByRole('button', { name, exact: true })).toHaveCount(0);
      await expect(page.locator('.tiq-topbar .tiq-btn')).toHaveCount(0);
    }
  });
});

test.describe('tab position within a section', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
  });

  test('keeps the tab list at the same height on every tab, with or without page buttons', async ({ page }) => {
    const sections = ['/buyer/selection', '/buyer/tenders/5', '/buyer/tenders/9', '/buyer/clarifications', '/buyer/evaluation', '/buyer/awards'];
    let tabbed = 0;
    for (const start of sections) {
      await page.goto(start);
      await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
      await page.waitForLoadState('networkidle');
      const tabs = page.locator('main nav.tiq-tabs, main nav.tiq-segmented').first();
      if ((await tabs.count()) === 0) continue;
      tabbed += 1;
      const hrefs = await tabs
        .locator('a.tiq-tab, a.tiq-segmented-item')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
      const tops: Record<string, number> = {};
      for (const href of hrefs) {
        await page.goto(href);
        await page.waitForLoadState('networkidle');
        const box = await page.locator('main nav.tiq-tabs, main nav.tiq-segmented').first().boundingBox();
        tops[href] = Math.round(box?.y ?? -1);
      }
      const first = Object.values(tops)[0];
      expect(tops, `tab list moved between the tabs of ${start}`).toEqual(Object.fromEntries(hrefs.map((href) => [href, first])));
    }
    expect(tabbed).toBeGreaterThanOrEqual(3);
  });
});

test.describe('record header buttons', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page);
  });

  for (const width of [1600, 1280]) {
    test(`keep the tender buttons beside the header text on every tab at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const tabs = ['/buyer/tenders/5', '/buyer/tenders/5/scope', '/buyer/tenders/5/pricing', '/buyer/tenders/5/evaluation', '/buyer/tenders/5/timetable', '/buyer/tenders/5/release'];
      const rightEdges = new Set<number>();
      const metaTops = new Set<number>();
      for (const path of tabs) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page.getByTestId('tender-meta-dates')).toContainText('Submission deadline:');
        const meta = await page.locator('main .tiq-page-meta').first().boundingBox();
        metaTops.add(Math.round(meta?.y ?? -1));
        const actions = page.locator('main .tiq-page-actions').first();
        if ((await actions.count()) === 0) continue;
        const box = await actions.boundingBox();
        // On the first row: the buttons end above the record meta instead of wrapping below it.
        expect((box?.y ?? 0) + (box?.height ?? 0), `${path}: buttons wrapped below the header`).toBeLessThanOrEqual((meta?.y ?? 0) + 1);
        rightEdges.add(Math.round((box?.x ?? 0) + (box?.width ?? 0)));
      }
      expect([...metaTops], 'the record meta starts at the same height on every tab').toHaveLength(1);
      expect([...rightEdges], 'the buttons end at the same place on every tab').toHaveLength(1);
    });
  }
});
