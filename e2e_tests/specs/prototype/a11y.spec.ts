/**
 * Accessibility and layout sweep of the prototype (docs/technical/09-frontend.md §15 Verification: axe on every nav
 * destination for each key persona; architecture-plan §7: no horizontal page scroll).
 *
 * For each key persona the spec signs in, collects the sidebar navigation, and on every destination runs axe
 * (WCAG 2.0/2.1 A and AA) in the light AND the dark theme, failing on serious and critical violations, and checks
 * that the page does not scroll sideways. The public pages are swept anonymously. The consequential confirmation
 * dialogs (approve, submit) are checked in their open state, and the phone layout (drawer, top bar) is checked at
 * 390px.
 *
 * No prerequisites: Playwright starts Vite, and the mock API runs in the page (DD-50).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const THEMES = ['light', 'dark'] as const;

const PERSONAS = [
  'tebogo.officer',
  'admin.kwu',
  'mpho.manager',
  'boitumelo.chair',
  'amantle.eval',
  'tsodilo.admin',
  'serowe-ict.signatory',
  'ops.admin',
] as const;

async function signIn(page: Page, localPart: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`[data-persona="${localPart}@tenderiq.local"]`).click();
  await expect(page.locator('#tiq-main')).toBeVisible();
}

/** Waits until the page has settled: no pending requests and no loading skeletons. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.tiq-skeleton')).toHaveCount(0);
}

/** Switches the theme with transitions off, so axe never measures colours halfway through a transition. */
async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((value) => {
    if (document.getElementById('a11y-no-transitions') === null) {
      const style = document.createElement('style');
      style.id = 'a11y-no-transitions';
      style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.append(style);
    }
    document.documentElement.setAttribute('data-theme', value);
  }, theme);
}

/** Serious and critical axe violations, one line each. */
async function axeProblems(page: Page, where: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${where}: ${violation.id} (${violation.impact ?? 'n/a'}) ${violation.nodes
          .slice(0, 5)
          .map((node) => node.target.join(' '))
          .join(', ')}`,
    );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Axe in both themes and the horizontal scroll check for the current page. */
async function checkPage(page: Page, where: string): Promise<string[]> {
  const problems: string[] = [];
  await settle(page);
  const overflow = await horizontalOverflow(page);
  if (overflow > 0) {
    problems.push(`${where}: page scrolls sideways by ${overflow}px`);
  }
  for (const theme of THEMES) {
    await setTheme(page, theme);
    problems.push(...(await axeProblems(page, `${where} [${theme}]`)));
  }
  await setTheme(page, 'light');
  return problems;
}

/**
 * Restricted placeholders on a page the role may open (DD-49): anything the role cannot see or do is left out, so a
 * sidebar or top bar destination never shows a lock box, a locked tile or "Not available in your role".
 */
async function restrictedPlaceholders(page: Page, where: string): Promise<string[]> {
  const boxes = await page
    .locator('main [data-state="restricted"]')
    .evaluateAll((elements) => elements.map((element) => (element.textContent ?? '').trim().slice(0, 80)));
  return boxes.map((text) => `${where}: restricted placeholder "${text}"`);
}

/** The top bar destinations that have no sidebar entry (DD-48): every signed-in user reaches them. */
const TOPBAR_DESTINATIONS = ['/me/search', '/me/notifications', '/me/help'];

async function navDestinations(page: Page): Promise<string[]> {
  await settle(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link').first()).toBeVisible();
  // Open every collapsed section (DD-48), so each destination is visited.
  const closed = nav.locator('button[aria-expanded="false"]');
  while ((await closed.count()) > 0) {
    await closed.first().click();
  }
  const hrefs = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  return [...new Set([...hrefs.filter((href) => href.startsWith('/')), ...TOPBAR_DESTINATIONS])];
}

test.describe('accessibility sweep', () => {
  for (const persona of PERSONAS) {
    test(`${persona}: every nav destination passes axe in both themes without sideways scroll or restricted placeholders`, async ({ page }) => {
      test.setTimeout(600_000);
      await signIn(page, persona);
      const destinations = await navDestinations(page);
      expect(destinations.length).toBeGreaterThan(0);
      const problems: string[] = [];
      for (const path of destinations) {
        await page.goto(path);
        problems.push(...(await checkPage(page, path)));
        problems.push(...(await restrictedPlaceholders(page, path)));
      }
      expect(problems).toEqual([]);
    });
  }

  // Detail and form pages where the QA crawl found readiness contrast, banner links and radio-group ARIA problems.
  const DETAIL_PAGES: readonly { readonly persona: string; readonly paths: readonly string[] }[] = [
    {
      persona: 'tebogo.officer',
      paths: [
        '/buyer/requests/new',
        '/buyer/requests/8',
        '/buyer/tenders/new',
        '/buyer/tenders/12',
        '/buyer/strategies/new',
      ],
    },
    { persona: 'pule.auditor', paths: ['/buyer/awards/7'] },
    {
      persona: 'serowe-ict.signatory',
      paths: ['/supplier/opportunities/10', '/supplier/responses/26/answers'],
    },
  ];
  for (const { persona, paths } of DETAIL_PAGES) {
    test(`${persona}: flagged detail and form pages pass axe in both themes`, async ({ page }) => {
      test.setTimeout(300_000);
      await signIn(page, persona);
      const problems: string[] = [];
      for (const path of paths) {
        await page.goto(path);
        problems.push(...(await checkPage(page, path)));
      }
      expect(problems).toEqual([]);
    });
  }

  test('anonymous: the public pages pass axe in both themes without sideways scroll', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/');
    await settle(page);
    const hrefs = await page
      .locator('.tiq-public-header a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    const destinations = [...new Set(['/', '/signin', '/register', ...hrefs])];
    const problems: string[] = [];
    for (const path of destinations) {
      await page.goto(path);
      problems.push(...(await checkPage(page, path)));
    }
    expect(problems).toEqual([]);
  });
});

test.describe('consequential confirmation dialogs (open state)', () => {
  test('the approve dialog passes axe in both themes', async ({ page }) => {
    await signIn(page, 'mpho.manager');
    await page.goto('/me/approvals/37');
    await settle(page);
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const problems: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      problems.push(...(await axeProblems(page, `approve dialog [${theme}]`)));
    }
    expect(problems).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeFocused();
  });

  test('the submit dialog passes axe in both themes', async ({ page }) => {
    await signIn(page, 'serowe-ict.signatory');
    await page.goto('/supplier/responses/7/submit');
    await settle(page);
    await page.getByRole('button', { name: /^Submit (response|replacement)$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const problems: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      problems.push(...(await axeProblems(page, `submit dialog [${theme}]`)));
    }
    expect(problems).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('route error page', () => {
  test('a page module that fails to load shows a styled reload prompt that passes axe and recovers on reload', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    const pageModule = '**/src/features/records/pages/RecordsOverviewPage.tsx*';
    await page.route(pageModule, (route) => route.abort('connectionfailed'));
    await page.goto('/buyer/admin/records');
    await expect(
      page.getByRole('heading', { level: 1, name: 'This page could not be loaded' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
    const problems = await checkPage(page, 'route error page');
    expect(problems).toEqual([]);

    await page.unroute(pageModule);
    await page.getByRole('button', { name: 'Reload the page' }).click();
    await settle(page);
    await expect(
      page.getByRole('heading', { level: 1, name: 'This page could not be loaded' }),
    ).toHaveCount(0);
    await expect(page.locator('#tiq-main')).toBeVisible();
  });
});

test.describe('phone layout (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the closed drawer is out of the tab order; opening focuses it and Escape returns to the menu button', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await settle(page);
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    await expect(sidebar).toBeHidden();
    await page.locator('body').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Tab');
    const focusedInSidebar = await page.evaluate(
      () => document.activeElement?.closest('.tiq-sidebar') !== null,
    );
    expect(focusedInSidebar).toBe(false);

    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar.getByRole('navigation').getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(menuButton).toBeFocused();
    await expect(sidebar).toBeHidden();
  });

  test('pages with a primary action and wide tables do not scroll sideways', async ({ page }) => {
    const problems: string[] = [];
    await page.goto('/register');
    await settle(page);
    const registerOverflow = await horizontalOverflow(page);
    if (registerOverflow > 0) problems.push(`/register: ${registerOverflow}px`);
    await signIn(page, 'tebogo.officer');
    for (const path of [
      '/buyer/dashboard',
      '/buyer/contracts',
      '/me/tasks',
      '/me/notifications',
      '/me/memberships',
      '/me/membership-requests',
    ]) {
      await page.goto(path);
      await settle(page);
      const overflow = await horizontalOverflow(page);
      if (overflow > 0) problems.push(`${path}: ${overflow}px`);
    }
    expect(problems).toEqual([]);
  });
});

test.describe('desktop layout (1440px)', () => {
  test('the buyer dashboard does not scroll sideways (chart data tables stay clipped)', async ({ page }) => {
    await signIn(page, 'tebogo.officer');
    await page.goto('/buyer/dashboard');
    await settle(page);
    expect(await horizontalOverflow(page)).toBe(0);
    const table = page.getByRole('table', { name: 'Workload by owner' });
    if ((await table.count()) > 0) {
      await expect(table.getByRole('columnheader').first()).toHaveText('Owner');
    }
  });
});
