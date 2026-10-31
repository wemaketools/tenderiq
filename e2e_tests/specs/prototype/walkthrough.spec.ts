/**
 * Prototype walkthrough (architecture-plan §0 and §5 A5): signs in as the right demo persona for every in-scope
 * screen ID (COM, PUB, SUP, BUY, EVA, CON, ADM, OPS, REP), opens the screen on the storyline data and captures a
 * JPEG screenshot (quality 70, 1600px wide viewport) to `docs/prototype/screens/<SCREEN-ID>--<persona>.jpg`.
 * A few extra captures show the dark theme and key states: readiness with blocking errors, the sealed restricted
 * state, the complaint hold, and the consequential confirmation dialogs (COM-02).
 *
 * The screenshots are embedded in `docs/prototype/walkthrough.md` for the owner's approval review.
 *
 * Every capture also checks that the page rendered its real content: a level-1 heading, no "Page not found", no
 * error state, and (unless the capture demonstrates it) no restricted state. The checks are soft, so one broken
 * screen is reported without hiding the remaining screenshots.
 *
 * No prerequisites: Playwright starts Vite, and the mock API runs in the page (DD-50).
 * Run: `npm run test:e2e:prototype -- walkthrough.spec.ts` (the servers start on the prototype port pair).
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const WIDTH = 1600;
const HEIGHT = 1000;
/** The tallest capture; longer pages are cut here so the walkthrough stays readable. */
const MAX_HEIGHT = 3200;
const SCREENS_DIR = fileURLToPath(new URL('../../../docs/prototype/screens/', import.meta.url));

type Persona = string | null;

interface Shot {
  /** The PRD screen ID, for example `BUY-19`. */
  readonly id: string;
  /** The demo account (local part of `@tenderiq.local`), or `null` for an anonymous visitor. */
  readonly persona: Persona;
  readonly path: string;
  /** A suffix for an extra capture of the same screen (state or theme). */
  readonly variant?: string;
  readonly theme?: 'dark';
  /** The capture demonstrates the restricted state instead of the screen's content. */
  readonly restricted?: boolean;
  /** For personas with several organizations: the organization to act for. */
  readonly organization?: string;
  /** Brings the page into the state the capture demonstrates (for example an open dialog). */
  readonly prepare?: (page: Page) => Promise<void>;
}

async function openDialog(page: Page, button: RegExp): Promise<void> {
  await page.getByRole('button', { name: button }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

const SHOTS: readonly Shot[] = [
  // Common screens (COM).
  { id: 'COM-01', persona: null, path: '/signin' },
  { id: 'COM-02', persona: 'sam.dual', path: '/select-organization' },
  { id: 'COM-03', persona: 'tebogo.officer', path: '/me/profile' },
  { id: 'COM-04', persona: 'tebogo.officer', path: '/me/tasks' },
  { id: 'COM-05', persona: 'mpho.manager', path: '/me/approvals/37' },
  {
    id: 'COM-05',
    persona: 'mpho.manager',
    path: '/me/approvals/37',
    variant: 'confirm',
    prepare: (page) => openDialog(page, /^Approve$/),
  },
  { id: 'COM-06', persona: 'tebogo.officer', path: '/me/notifications' },
  { id: 'COM-07', persona: 'tebogo.officer', path: '/me/documents/204' },
  { id: 'COM-08', persona: 'tebogo.officer', path: '/me/search?q=pump' },
  { id: 'COM-09', persona: 'tebogo.officer', path: '/me/help' },
  { id: 'COM-09', persona: null, path: '/service-status', variant: 'public' },

  // Public portal (PUB).
  { id: 'PUB-01', persona: null, path: '/' },
  { id: 'PUB-01', persona: null, path: '/', variant: 'dark', theme: 'dark' },
  { id: 'PUB-01', persona: null, path: '/b/kwu', variant: 'buyer' },
  { id: 'PUB-02', persona: null, path: '/opportunities' },
  { id: 'PUB-03', persona: null, path: '/opportunities/kwu/T-2026-0002' },
  { id: 'PUB-04', persona: null, path: '/clarifications/kwu/T-2026-0002' },
  { id: 'PUB-05', persona: null, path: '/awards' },
  { id: 'PUB-05', persona: null, path: '/awards/kwu/T-2026-0001', variant: 'detail' },
  { id: 'PUB-06', persona: null, path: '/plans' },
  { id: 'PUB-06', persona: null, path: '/plans/kwu/401', variant: 'notice' },
  { id: 'PUB-07', persona: null, path: '/guidance' },

  // Supplier (SUP).
  { id: 'SUP-01', persona: 'tsodilo.bidmanager', path: '/supplier/dashboard' },
  { id: 'SUP-01', persona: 'tsodilo.bidmanager', path: '/supplier/dashboard', variant: 'dark', theme: 'dark' },
  { id: 'SUP-02', persona: null, path: '/register' },
  { id: 'SUP-02', persona: 'makgadikgadi.admin', path: '/me/membership-requests', variant: 'membership' },
  { id: 'SUP-03', persona: 'tsodilo.admin', path: '/supplier/organization' },
  { id: 'SUP-04', persona: 'tsodilo.admin', path: '/supplier/admin/access/users' },
  { id: 'SUP-04', persona: 'tsodilo.admin', path: '/supplier/admin/access/authority', variant: 'authority' },
  { id: 'SUP-05', persona: 'chobe-pipe.admin', path: '/supplier/evidence' },
  { id: 'SUP-06', persona: 'tsodilo.bidmanager', path: '/supplier/opportunities' },
  { id: 'SUP-07', persona: 'tsodilo.bidmanager', path: '/supplier/invitations' },
  { id: 'SUP-07', persona: 'tsodilo.bidmanager', path: '/supplier/invitations/604', variant: 'invitation' },
  { id: 'SUP-08', persona: 'tsodilo.bidmanager', path: '/supplier/opportunities/2' },
  { id: 'SUP-09', persona: 'tsodilo.bidmanager', path: '/supplier/opportunities/6/pursuit' },
  { id: 'SUP-10', persona: 'tsodilo.bidmanager', path: '/supplier/clarifications/tenders/2' },
  { id: 'SUP-11', persona: 'tsodilo.bidmanager', path: '/supplier/briefings' },
  { id: 'SUP-11', persona: 'tsodilo.bidmanager', path: '/supplier/briefings/41', variant: 'session' },
  { id: 'SUP-12', persona: 'tsodilo.bidmanager', path: '/supplier/responses/14/answers' },
  { id: 'SUP-13', persona: 'tsodilo.bidmanager', path: '/supplier/responses/14/pricing' },
  { id: 'SUP-14', persona: 'tsodilo.bidmanager', path: '/supplier/responses/14/declarations' },
  { id: 'SUP-15', persona: 'tsodilo.bidmanager', path: '/supplier/responses/14/review' },
  { id: 'SUP-16', persona: 'tsodilo.bidmanager', path: '/supplier/responses/14/submit', variant: 'readiness-blocked' },
  { id: 'SUP-16', persona: 'serowe-ict.bidmanager', path: '/supplier/responses/7/submit' },
  {
    id: 'SUP-16',
    persona: 'serowe-ict.signatory',
    path: '/supplier/responses/7/submit',
    variant: 'confirm',
    prepare: (page) => openDialog(page, /^Submit (response|replacement)$/),
  },
  { id: 'SUP-17', persona: 'tsodilo.bidmanager', path: '/supplier/responses/6/receipts' },
  { id: 'SUP-17', persona: 'tsodilo.bidmanager', path: '/supplier/receipts', variant: 'receipts' },
  { id: 'SUP-18', persona: 'serowe-ict.bidmanager', path: '/supplier/assessment-requests' },
  { id: 'SUP-18', persona: 'serowe-ict.bidmanager', path: '/supplier/assessment-invites', variant: 'appointments' },
  { id: 'SUP-19', persona: 'serowe-ict.bidmanager', path: '/supplier/negotiations' },
  { id: 'SUP-19', persona: 'serowe-ict.bidmanager', path: '/supplier/negotiations/1', variant: 'negotiation' },
  { id: 'SUP-20', persona: 'makgadikgadi.admin', path: '/supplier/qualification' },
  { id: 'SUP-21', persona: 'tsodilo.bidmanager', path: '/supplier/outcomes/1' },
  { id: 'SUP-22', persona: 'limpopo-env.admin', path: '/supplier/complaints/92' },
  { id: 'SUP-23', persona: 'tsodilo.admin', path: '/supplier/contracts/1' },
  { id: 'SUP-24', persona: 'chobe-pipe.admin', path: '/supplier/qualification/decisions' },

  // Buyer (BUY).
  { id: 'BUY-01', persona: 'mpho.manager', path: '/buyer/dashboard' },
  { id: 'BUY-01', persona: 'mpho.manager', path: '/buyer/dashboard', variant: 'dark', theme: 'dark' },
  { id: 'BUY-02', persona: 'tebogo.officer', path: '/buyer/requests' },
  { id: 'BUY-03', persona: 'kagiso.requester', path: '/buyer/requests/3' },
  { id: 'BUY-03', persona: 'kagiso.requester', path: '/buyer/requests/new', variant: 'new' },
  { id: 'BUY-04', persona: 'keabetswe.approver', path: '/buyer/requests/3/decision' },
  { id: 'BUY-05', persona: 'mpho.manager', path: '/buyer/planning' },
  { id: 'BUY-06', persona: 'tebogo.officer', path: '/buyer/strategies/504' },
  { id: 'BUY-07', persona: 'tebogo.officer', path: '/buyer/tenders' },
  { id: 'BUY-07', persona: 'tebogo.officer', path: '/buyer/tenders/new', variant: 'new' },
  { id: 'BUY-08', persona: 'tebogo.officer', path: '/buyer/tenders/3' },
  { id: 'BUY-09', persona: 'tebogo.officer', path: '/buyer/tenders/2/scope' },
  { id: 'BUY-10', persona: 'tebogo.officer', path: '/buyer/tenders/2/pricing' },
  { id: 'BUY-11', persona: 'tebogo.officer', path: '/buyer/tenders/3/evaluation' },
  { id: 'BUY-12', persona: 'tebogo.officer', path: '/buyer/tenders/3/timetable' },
  { id: 'BUY-13', persona: 'tebogo.officer', path: '/buyer/tenders/5/release' },
  { id: 'BUY-14', persona: 'tebogo.officer', path: '/buyer/tenders/2/publication' },
  { id: 'BUY-14', persona: 'tebogo.officer', path: '/buyer/publications', variant: 'register' },
  { id: 'BUY-15', persona: 'tebogo.officer', path: '/buyer/tenders/6/participants' },
  { id: 'BUY-16', persona: 'tebogo.officer', path: '/buyer/clarifications/questions' },
  { id: 'BUY-16', persona: 'tebogo.officer', path: '/buyer/clarifications/questions/201', variant: 'question' },
  { id: 'BUY-17', persona: 'tebogo.officer', path: '/buyer/clarifications/addenda/22' },
  { id: 'BUY-18', persona: 'tebogo.officer', path: '/buyer/clarifications/sessions' },
  { id: 'BUY-19', persona: 'tebogo.officer', path: '/buyer/submissions/2' },
  { id: 'BUY-19', persona: 'admin.kwu', path: '/buyer/submissions/8', variant: 'sealed-restricted', restricted: true },
  { id: 'BUY-20', persona: 'oratile.opener', path: '/buyer/opening/tenders/8' },
  { id: 'BUY-20', persona: 'oratile.opener', path: '/buyer/opening/sessions/180', variant: 'session' },
  { id: 'BUY-20', persona: 'admin.kwu', path: '/buyer/opening/tenders/8', variant: 'sealed-restricted', restricted: true },
  { id: 'BUY-21', persona: 'boitumelo.chair', path: '/buyer/compliance/bids/3003' },
  { id: 'BUY-21', persona: 'boitumelo.chair', path: '/buyer/compliance/exclusions/5101', variant: 'exclusion' },
  { id: 'BUY-22', persona: 'tebogo.officer', path: '/buyer/selection/assessments?tenderId=9' },
  { id: 'BUY-22', persona: 'tebogo.officer', path: '/buyer/selection/references', variant: 'references' },
  { id: 'BUY-23', persona: 'mpho.manager', path: '/buyer/selection/shortlists/9' },
  { id: 'BUY-24', persona: 'tebogo.officer', path: '/buyer/selection/preferred-bidders/1' },
  { id: 'BUY-25', persona: 'mpho.manager', path: '/buyer/selection/due-diligence/1' },
  { id: 'BUY-26', persona: 'keabetswe.approver', path: '/buyer/awards/1/recommendations/14902' },
  { id: 'BUY-26', persona: 'keabetswe.approver', path: '/buyer/awards/1', variant: 'overview' },
  { id: 'BUY-27', persona: 'mpho.manager', path: '/buyer/selection/final-offers/1' },
  { id: 'BUY-27', persona: 'tebogo.officer', path: '/buyer/selection/negotiations/1', variant: 'negotiation' },
  { id: 'BUY-28', persona: 'tebogo.officer', path: '/buyer/awards/7/notices' },
  { id: 'BUY-28', persona: 'tebogo.officer', path: '/buyer/awards/7', variant: 'complaint-hold' },
  { id: 'BUY-29', persona: 'dineo.legal', path: '/buyer/award-cases/complaints/92' },
  { id: 'BUY-29', persona: 'dineo.legal', path: '/buyer/award-cases', variant: 'register' },
  { id: 'BUY-30', persona: 'tebogo.officer', path: '/buyer/awards/7/closeout' },
  { id: 'BUY-30', persona: 'tebogo.officer', path: '/buyer/closeout', variant: 'register' },
  { id: 'BUY-31', persona: 'mpho.manager', path: '/buyer/suppliers' },
  { id: 'BUY-32', persona: 'mpho.manager', path: '/buyer/suppliers/5' },
  { id: 'BUY-33', persona: 'neo.assessor', path: '/buyer/qualification' },
  { id: 'BUY-34', persona: 'neo.assessor', path: '/buyer/qualification/applications/503' },
  { id: 'BUY-35', persona: 'mpho.manager', path: '/buyer/qualification/monitoring' },
  { id: 'BUY-35', persona: 'mpho.manager', path: '/buyer/qualification/applications/509/decision', variant: 'decision' },

  // Evaluation (EVA).
  { id: 'EVA-01', persona: 'amantle.eval', path: '/buyer/evaluation/assignments' },
  { id: 'EVA-01', persona: 'amantle.eval', path: '/buyer/evaluation/assignments/3003', variant: 'assignment' },
  { id: 'EVA-02', persona: 'amantle.eval', path: '/buyer/evaluation/assignments/3003/assessment' },
  {
    id: 'EVA-02',
    persona: 'amantle.eval',
    path: '/buyer/evaluation/assignments/3003/assessment',
    variant: 'dark',
    theme: 'dark',
  },
  { id: 'EVA-03', persona: 'boitumelo.chair', path: '/buyer/bid-clarifications' },
  { id: 'EVA-03', persona: 'boitumelo.chair', path: '/buyer/bid-clarifications/4101', variant: 'detail' },
  { id: 'EVA-04', persona: 'refilwe.commercial', path: '/buyer/evaluation/tenders/3/commercial' },
  { id: 'EVA-05', persona: 'boitumelo.chair', path: '/buyer/evaluation/tenders/3/moderation' },
  { id: 'EVA-06', persona: 'boitumelo.chair', path: '/buyer/evaluation/tenders/3/results' },

  // Contracts (CON).
  { id: 'CON-01', persona: 'masego.contracts', path: '/buyer/contracts' },
  { id: 'CON-02', persona: 'masego.contracts', path: '/buyer/contracts/2/preparation' },
  { id: 'CON-03', persona: 'masego.contracts', path: '/buyer/contracts/2/signature' },
  { id: 'CON-04', persona: 'masego.contracts', path: '/buyer/contracts/1/handover' },
  { id: 'CON-05', persona: 'masego.contracts', path: '/buyer/contracts/1' },
  { id: 'CON-05', persona: 'masego.contracts', path: '/buyer/contracts/1', variant: 'dark', theme: 'dark' },
  { id: 'CON-06', persona: 'masego.contracts', path: '/buyer/contracts/1/milestones' },
  { id: 'CON-07', persona: 'masego.contracts', path: '/buyer/contracts/1/performance' },
  { id: 'CON-08', persona: 'masego.contracts', path: '/buyer/contracts/1/financials' },
  { id: 'CON-09', persona: 'masego.contracts', path: '/buyer/contracts/1/changes' },
  { id: 'CON-10', persona: 'masego.contracts', path: '/buyer/contracts/1/renewals' },
  { id: 'CON-11', persona: 'masego.contracts', path: '/buyer/contracts/4/closeout' },

  // Administration (ADM).
  { id: 'ADM-01', persona: 'admin.kwu', path: '/buyer/admin/organization/settings' },
  { id: 'ADM-02', persona: 'admin.kwu', path: '/buyer/admin/organization/structure' },
  { id: 'ADM-03', persona: 'admin.kwu', path: '/buyer/admin/access/users' },
  { id: 'ADM-03', persona: 'admin.kwu', path: '/buyer/admin/access/users/4', variant: 'user' },
  { id: 'ADM-04', persona: 'admin.kwu', path: '/buyer/admin/access/roles' },
  { id: 'ADM-04', persona: 'admin.kwu', path: '/buyer/admin/access/review', variant: 'review' },
  { id: 'ADM-05', persona: 'admin.kwu', path: '/buyer/admin/organization/authority' },
  { id: 'ADM-06', persona: 'admin.kwu', path: '/buyer/admin/policy/profiles' },
  { id: 'ADM-07', persona: 'admin.kwu', path: '/buyer/admin/policy/fields' },
  { id: 'ADM-08', persona: 'admin.kwu', path: '/buyer/admin/policy/templates' },
  { id: 'ADM-09', persona: 'mpho.manager', path: '/buyer/admin/qualification' },
  { id: 'ADM-10', persona: 'admin.kwu', path: '/buyer/admin/calendars/1' },
  { id: 'ADM-11', persona: 'admin.kwu', path: '/buyer/admin/policy/portal' },
  { id: 'ADM-12', persona: 'admin.kwu', path: '/buyer/admin/notification-rules' },
  { id: 'ADM-13', persona: 'mpho.manager', path: '/buyer/admin/reports' },
  { id: 'ADM-14', persona: 'pule.auditor', path: '/buyer/admin/records/holds' },
  { id: 'ADM-14', persona: 'mpho.manager', path: '/buyer/admin/records/disposals/1', variant: 'disposal-blocked' },
  { id: 'ADM-15', persona: 'admin.kwu', path: '/buyer/admin/service/integrations' },
  { id: 'ADM-15', persona: 'admin.kwu', path: '/buyer/admin/service/exceptions', variant: 'exceptions' },
  { id: 'ADM-16', persona: 'admin.kwu', path: '/buyer/admin/service/imports' },
  { id: 'ADM-17', persona: 'admin.kwu', path: '/buyer/admin/service/subscription' },

  // Platform operations (OPS).
  { id: 'OPS-01', persona: 'ops.admin', path: '/ops/customers' },
  { id: 'OPS-02', persona: 'ops.admin', path: '/ops/offboarding/1' },
  { id: 'OPS-02', persona: 'ops.admin', path: '/ops/customers/3/onboarding', variant: 'onboarding' },
  { id: 'OPS-03', persona: 'ops.admin', path: '/ops/subscriptions' },
  { id: 'OPS-04', persona: 'support.agent', path: '/ops/support/cases/1' },
  { id: 'OPS-04', persona: 'support.agent', path: '/ops/support/grants', variant: 'grants' },
  { id: 'OPS-05', persona: 'ops.admin', path: '/ops/incidents/1' },
  { id: 'OPS-06', persona: 'ops.admin', path: '/ops/oversight' },
  { id: 'OPS-06', persona: 'ops.admin', path: '/ops/supplier-duplicates', variant: 'duplicates' },
  { id: 'OPS-07', persona: 'ops.admin', path: '/ops/content/announcements' },

  // Reporting (REP).
  { id: 'REP-01', persona: 'mpho.manager', path: '/buyer/reports/participation' },
  { id: 'REP-01', persona: 'mpho.manager', path: '/buyer/reports', variant: 'catalog' },
  { id: 'REP-02', persona: 'mpho.manager', path: '/buyer/reports/definitions/1' },
];

function fileName(shot: Shot): string {
  const who = shot.persona ?? 'public';
  return `${shot.id}--${who}${shot.variant === undefined ? '' : `--${shot.variant}`}.jpg`;
}

async function signIn(page: Page, localPart: string, organization?: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`[data-persona="${localPart}@tenderiq.local"]`).click();
  await expect(page).not.toHaveURL(/\/signin/);
  const chooser = page.getByRole('list', { name: 'Your organizations' });
  await expect(page.locator('#tiq-main').or(chooser)).toBeVisible();
  if (await chooser.isVisible()) {
    const choice =
      organization === undefined
        ? chooser.getByRole('button').first()
        : chooser.getByRole('button', { name: new RegExp(organization) });
    await choice.click();
    await expect(page.locator('#tiq-main')).toBeVisible();
  }
}

/** Waits until the page has settled: no pending requests and no loading skeletons. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.tiq-skeleton')).toHaveCount(0);
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((value) => {
    if (document.getElementById('walkthrough-no-motion') === null) {
      const style = document.createElement('style');
      style.id = 'walkthrough-no-motion';
      style.textContent =
        '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }';
      document.head.append(style);
    }
    document.documentElement.setAttribute('data-theme', value);
  }, theme);
}

/** Captures the page at the walkthrough width, tall enough to show the whole page up to MAX_HEIGHT. */
async function capture(page: Page, shot: Shot): Promise<void> {
  const dialogOpen = await page.getByRole('dialog').isVisible();
  const height = dialogOpen
    ? HEIGHT
    : await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const target = Math.min(Math.max(height, HEIGHT), MAX_HEIGHT);
  if (target !== HEIGHT) {
    await page.setViewportSize({ width: WIDTH, height: target });
    await settle(page);
  }
  await page.screenshot({
    path: `${SCREENS_DIR}${fileName(shot)}`,
    type: 'jpeg',
    quality: 70,
    animations: 'disabled',
    caret: 'hide',
  });
  if (target !== HEIGHT) {
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  }
}

async function captureShot(page: Page, shot: Shot): Promise<void> {
  const where = `${shot.id} ${shot.path}`;
  await page.goto(shot.path);
  await settle(page);
  if (shot.prepare !== undefined) {
    await shot.prepare(page);
    await settle(page);
  }
  await setTheme(page, shot.theme ?? 'light');

  const heading = (await page.getByRole('heading', { level: 1 }).first().textContent())?.trim() ?? '';
  // Page-level restriction (a dashboard card may be restricted on its own; that is not the page's state).
  const restricted = /not available in your role/i.test(heading);
  const notFound = await page.getByRole('heading', { level: 1, name: /not found/i }).isVisible();
  const errorState = await page.locator('.tiq-error-state, [data-state="error"]').first().isVisible();

  expect.soft(heading, `${where}: a level-1 heading`).not.toBe('');
  expect.soft(notFound, `${where}: not a "not found" page`).toBe(false);
  expect.soft(errorState, `${where}: no error state`).toBe(false);
  expect.soft(restricted, `${where}: restricted state ${shot.restricted === true ? 'shown' : 'absent'}`).toBe(
    shot.restricted === true,
  );

  await capture(page, shot);
  test.info().annotations.push({
    type: 'screen',
    description: JSON.stringify({
      id: shot.id,
      persona: shot.persona,
      path: shot.path,
      variant: shot.variant ?? null,
      file: fileName(shot),
      heading,
      restricted,
    }),
  });
  if (shot.theme !== undefined) {
    await setTheme(page, 'light');
  }
}

const byPersona = new Map<string, Shot[]>();
for (const shot of SHOTS) {
  const key = shot.persona ?? '';
  byPersona.set(key, [...(byPersona.get(key) ?? []), shot]);
}

test.describe('prototype walkthrough screenshots', () => {
  // A fixed browser zone and locale make the captures machine-independent. The zone differs from the official
  // Africa/Gaborone zone on purpose, so the screenshots also show the "your time" line next to official deadlines.
  test.use({ viewport: { width: WIDTH, height: HEIGHT }, timezoneId: 'Europe/London', locale: 'en-GB' });

  test.beforeAll(() => {
    mkdirSync(SCREENS_DIR, { recursive: true });
  });

  test('every in-scope screen ID has at least one capture', () => {
    const prefixes: readonly (readonly [string, number])[] = [
      ['COM', 9],
      ['PUB', 7],
      ['SUP', 24],
      ['BUY', 35],
      ['EVA', 6],
      ['CON', 11],
      ['ADM', 17],
      ['OPS', 7],
      ['REP', 2],
    ];
    const expected = prefixes.flatMap(([prefix, count]) =>
      Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`),
    );
    const captured = new Set(SHOTS.map((shot) => shot.id));
    expect(expected.filter((id) => !captured.has(id))).toEqual([]);
    const names = SHOTS.map(fileName);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  for (const [persona, shots] of byPersona) {
    const label = persona === '' ? 'anonymous visitor' : persona;
    test(`${label}: captures ${shots.map((shot) => shot.id).join(', ')}`, async ({ page }) => {
      test.setTimeout(120_000 + shots.length * 45_000);
      if (persona !== '') {
        await signIn(page, persona, shots[0]?.organization);
      }
      for (const shot of shots) {
        await captureShot(page, shot);
      }
    });
  }
});
