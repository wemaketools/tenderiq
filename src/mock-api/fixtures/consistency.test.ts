/**
 * Cross-fixture consistency of the demo world (docs/plan/demo-storyline.md, architecture-plan §3.11).
 *
 * Every domain writes its own fixtures and projects the records of other domains it needs. This suite checks that
 * those projections agree with the owning domain:
 * - the mock API loads every handler module and serves every endpoint of the catalog;
 * - natural keys resolve: tenant slugs, persona emails, tender, contract, request and application references, and
 *   the ids that travel with them;
 * - every in-app link a fixture carries matches a route the SPA registers, and the record it names exists;
 * - the storyline states agree across domains (deadlines, bidders, receipts, award values, evidence expiry,
 *   authority), and the PRD §9.2 worked example (AC-19) is exact.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { ENDPOINT_CATALOG } from '../../contracts/catalog.js';
import { getResults } from '../../contracts/evaluation.js';
import { TENDERS_STATUS } from '../../contracts/enums.js';
import { MockRouteCollector } from '../middleware/routes.js';
import { discoverHandlerModules, registerModules } from '../registry.js';
import { createTestMockApp } from '../testing/index.js';
import { ADDENDA } from './clarifications/index.js';
import { APPROVALS, AUTHORITY_LIMITS as WORKSPACE_LIMITS, DELEGATIONS as WORKSPACE_DELEGATIONS } from './approvals.js';
import { LOT_OUTCOMES, RECOMMENDATIONS } from './awards/index.js';
import { BIDS, BID_TENDERS, SUBMISSION_RECEIPTS } from './bids/index.js';
import { CALENDAR_DEADLINES } from './calendars.js';
import { CONTRACTS } from './contracts/index.js';
import { DOCUMENTS } from './documents.js';
import { EVALUATIONS } from './evaluation.js';
import { NOTIFICATIONS } from './notifications.js';
import { OPENING_BIDS } from './opening.js';
import { SERVICE_TEAM_EMAIL } from './operations/index.js';
import { AUTHORITY_LIMITS as ORG_LIMITS, DELEGATIONS as ORG_DELEGATIONS, TENDER_REFS } from './org-admin/index.js';
import { PERSONAS, TENANTS, UNMAPPED_AUTH_ACCOUNT } from './platform.js';
import { TENDERS as NOTICES } from './publication.js';
import { QUALIFICATION_APPLICATIONS } from './qualification/index.js';
import { REQUESTS } from './requests/index.js';
import { EVIDENCE_ITEMS } from './suppliers/index.js';
import { TASKS } from './tasks.js';
import { LOTS, MILESTONES, TENDERS } from './tenders/index.js';

const FIXTURES_DIR = fileURLToPath(new URL('./', import.meta.url));
const FEATURES_DIR = fileURLToPath(new URL('../../ui/src/features/', import.meta.url));

// ---------------------------------------------------------------------------------------------------------------
// Fixture walking
// ---------------------------------------------------------------------------------------------------------------

interface FoundObject {
  readonly file: string;
  readonly value: Readonly<Record<string, unknown>>;
}

interface FoundString {
  readonly file: string;
  readonly key: string;
  readonly value: string;
}

function fixtureFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        return fixtureFiles(path);
      }
      return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
    });
}

/** Every plain object and every string (with its key) reachable from the exports of each fixture module. */
async function walkFixtures(): Promise<{ objects: FoundObject[]; strings: FoundString[] }> {
  const objects: FoundObject[] = [];
  const strings: FoundString[] = [];
  const seen = new Set<unknown>();
  for (const path of fixtureFiles(FIXTURES_DIR)) {
    const file = relative(FIXTURES_DIR, path).replaceAll('\\', '/');
    const exports = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
    const visit = (value: unknown, key: string, depth: number): void => {
      if (typeof value === 'string') {
        strings.push({ file, key, value });
        return;
      }
      if (depth > 12 || value === null || typeof value !== 'object' || seen.has(value)) {
        return;
      }
      seen.add(value);
      if (value instanceof Map) {
        for (const item of value.values()) visit(item, key, depth + 1);
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) visit(item, key, depth + 1);
        return;
      }
      const record = value as Record<string, unknown>;
      objects.push({ file, value: record });
      for (const [childKey, child] of Object.entries(record)) visit(child, childKey, depth + 1);
    };
    for (const [name, value] of Object.entries(exports)) visit(value, name, 0);
  }
  return { objects, strings };
}

let walked: { objects: FoundObject[]; strings: FoundString[] };

beforeAll(async () => {
  walked = await walkFixtures();
});

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// ---------------------------------------------------------------------------------------------------------------
// SPA routes (read from the feature route files; the mock API never imports the SPA)
// ---------------------------------------------------------------------------------------------------------------

const AREA_ROOT: Readonly<Record<string, string>> = { buyer: '/buyer', supplier: '/supplier', ops: '/ops', common: '/me', public: '' };

/** The absolute path patterns every feature registers (`/buyer/tenders/:tenderId`, ...). */
function spaRoutePatterns(): string[] {
  const patterns: string[] = [];
  for (const feature of readdirSync(FEATURES_DIR).sort()) {
    let source: string;
    try {
      source = readFileSync(join(FEATURES_DIR, feature, 'routes.tsx'), 'utf8');
    } catch {
      continue;
    }
    // Path constants imported from the feature's own lib files (`path: supplierOrgRoutes.profile`).
    const constants = new Map<string, string>();
    for (const imported of source.matchAll(/import \{([^}]+)\} from '(\.\/lib\/[^']+)'/g)) {
      const libSource = readFileSync(join(FEATURES_DIR, feature, `${imported[2] ?? ''}.ts`), 'utf8');
      for (const name of (imported[1] ?? '').split(',').map((part) => part.trim())) {
        const block = new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\}`).exec(libSource);
        for (const entry of block?.[1]?.matchAll(/(\w+): '([^']*)'/g) ?? []) {
          constants.set(`${name}.${entry[1] ?? ''}`, entry[2] ?? '');
        }
      }
    }
    for (const part of source.split(/area: '/).slice(1)) {
      const area = /^(\w+)'/.exec(part)?.[1] ?? '';
      for (const match of part.matchAll(/path: (?:'([^']*)'|(\w+\.\w+))/g)) {
        const path = match[1] ?? constants.get(match[2] ?? '');
        if (path !== undefined) {
          patterns.push(`${AREA_ROOT[area] ?? ''}${path === '' ? '' : `/${path}`}` || '/');
        }
      }
    }
  }
  return patterns;
}

function matchesPattern(pattern: string, path: string): boolean {
  const expected = pattern.split('/');
  const actual = path.split('/');
  return expected.length === actual.length && expected.every((segment, index) => segment.startsWith(':') || segment === actual[index]);
}

const APP_LINK = /^\/(buyer|supplier|ops|me|plans|clarifications|tenders|notices|awards|help|register|invite)(\/|$|\?|#)/;

// ---------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------

describe('mock API registry', () => {
  it('loads every handler module without a skip and serves every endpoint of the catalog', async () => {
    // Arrange
    const discovered = await discoverHandlerModules();
    const collector = new MockRouteCollector('consistency');

    // Act
    const result = registerModules(collector, discovered.modules);

    // Assert
    expect([...discovered.failed, ...result.failed]).toEqual([]);
    const served = new Set(collector.records.map((record) => record.endpoint.id));
    expect(ENDPOINT_CATALOG.filter((endpoint) => !served.has(endpoint.id)).map((endpoint) => endpoint.id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Natural keys
// ---------------------------------------------------------------------------------------------------------------

describe('natural keys', () => {
  it('names only persona accounts that exist (emails of the demo world), besides the operator’s shared mailbox', () => {
    const known = new Set([...PERSONAS.map((persona) => persona.email), UNMAPPED_AUTH_ACCOUNT.email, SERVICE_TEAM_EMAIL]);
    const unknown = walked.strings
      .filter((entry) => /^[a-z0-9.-]+@tenderiq\.local$/.test(entry.value) && !known.has(entry.value))
      .map((entry) => `${entry.file}: ${entry.value}`);
    expect([...new Set(unknown)]).toEqual([]);
  });

  it('names only tenant slugs that exist', () => {
    const slugs = new Set(TENANTS.map((tenant) => tenant.slug));
    const unknown = walked.strings
      .filter((entry) => /^(supplier|supplierSlug|tenantSlug|buyerSlug|tenant)$/.test(entry.key) && /^[a-z][a-z-]+$/.test(entry.value))
      .filter((entry) => !slugs.has(entry.value))
      .map((entry) => `${entry.file}: ${entry.key}=${entry.value}`);
    expect([...new Set(unknown)]).toEqual([]);
  });

  it('gives every tender reference the id, title, buyer and status of the tender register', () => {
    const problems: string[] = [];
    const statuses = new Set<string>(TENDERS_STATUS);
    const byReference = new Map(TENDERS.map((tender) => [tender.reference, tender]));
    for (const { file, value } of walked.objects) {
      const reference = str(value.reference) ?? str(value.tenderReference);
      if (reference === null || !/^T-2026-\d{4}$/.test(reference)) continue;
      const tenderId = num(value.tenderId) ?? (str(value.reference) !== null && statuses.has(str(value.status) ?? '') ? num(value.id) : null);
      if (tenderId === null) continue;
      const tender = byReference.get(reference);
      if (tender === undefined) {
        problems.push(`${file}: ${reference} is not in the tender register`);
        continue;
      }
      if (tenderId !== tender.id) problems.push(`${file}: ${reference} carries id ${tenderId}, the register has ${tender.id}`);
      const title = str(value.tenderTitle) ?? (str(value.reference) === null ? null : str(value.title));
      // The storyline names T-2026-0001 "Borehole pump replacement programme (3 lots)"; the suffix is descriptive.
      if (title !== null && title.replace(/ \(3 lots\)$/, '') !== tender.title && statuses.has(str(value.status) ?? '')) {
        problems.push(`${file}: ${reference} is titled "${title}", the register has "${tender.title}"`);
      }
      const status = str(value.status);
      if (status !== null && statuses.has(status) && str(value.reference) !== null && status !== tender.status) {
        problems.push(`${file}: ${reference} is ${status}, the register has ${tender.status}`);
      }
      const tenantId = num(value.buyerTenantId);
      if (tenantId !== null && tenantId !== tender.tenantId) problems.push(`${file}: ${reference} belongs to tenant ${tender.tenantId}, not ${tenantId}`);
    }
    expect([...new Set(problems)]).toEqual([]);
  });

  it('gives every contract reference the id of the contract register', () => {
    const problems: string[] = [];
    const byReference = new Map(CONTRACTS.map((contract) => [contract.reference, contract]));
    for (const { file, value } of walked.objects) {
      const reference = str(value.contractReference) ?? str(value.reference);
      if (reference === null || !/^C-20\d{2}-\d{4}$/.test(reference)) continue;
      const id = num(value.contractId) ?? (str(value.contractReference) === null ? num(value.id) : null);
      if (id === null || (str(value.contractReference) === null && num(value.contractId) === null && str(value.title) === null)) continue;
      const contract = byReference.get(reference);
      if (contract === undefined) problems.push(`${file}: ${reference} is not in the contract register`);
      else if (contract.id !== id) problems.push(`${file}: ${reference} carries id ${id}, the register has ${contract.id}`);
    }
    expect([...new Set(problems)]).toEqual([]);
  });

  it('gives every request and qualification application reference an id of its owning register', () => {
    const problems: string[] = [];
    const requests = new Set(REQUESTS.map((request) => `${request.reference}#${request.id}`));
    const applications = new Set(QUALIFICATION_APPLICATIONS.map((application) => `${application.reference}#${application.id}`));
    for (const { file, value } of walked.objects) {
      const reference = str(value.reference) ?? str(value.requestReference) ?? str(value.applicationReference);
      if (reference === null) continue;
      const own = str(value.reference) === reference;
      if (/^PR-2026-\d{4}$/.test(reference)) {
        const id = num(value.requestId) ?? (own && str(value.title) !== null && /^(procurement_request|request)?$/.test(str(value.type) ?? '') ? num(value.id) : null);
        if (id !== null && !requests.has(`${reference}#${id}`)) problems.push(`${file}: ${reference} carries request id ${id}`);
      }
      if (/^QA-20\d{2}-\d{4}$/.test(reference)) {
        const id = num(value.applicationId) ?? (own ? num(value.id) : null);
        if (id !== null && !applications.has(`${reference}#${id}`)) problems.push(`${file}: ${reference} carries application id ${id}`);
      }
    }
    expect([...new Set(problems)]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------------------------

describe('in-app links', () => {
  it('match a route that an SPA feature registers', () => {
    const patterns = spaRoutePatterns();
    expect(patterns.length).toBeGreaterThan(100);
    const unmatched = walked.strings
      .filter((entry) => APP_LINK.test(entry.value))
      .map((entry) => ({ ...entry, path: (entry.value.split(/[?#]/)[0] ?? '').replace(/(.)\/$/, '$1') }))
      .filter((entry) => !patterns.some((pattern) => matchesPattern(pattern, entry.path)))
      .map((entry) => `${entry.file}: ${entry.value}`);
    expect([...new Set(unmatched)]).toEqual([]);
  });

  it('name records that exist in the owning domain', () => {
    const exists: ReadonlyArray<readonly [RegExp, ReadonlySet<number>, string]> = [
      [/^\/buyer\/tenders\/(\d+)(\/|$|\?)/, new Set(TENDERS.map((tender) => tender.id)), 'tender'],
      [/^\/supplier\/opportunities\/(\d+)(\/|$|\?)/, new Set(TENDERS.map((tender) => tender.id)), 'tender'],
      [/^\/(?:buyer|supplier)\/contracts\/(\d+)(\/|$|\?)/, new Set(CONTRACTS.map((contract) => contract.id)), 'contract'],
      [/^\/buyer\/requests\/(\d+)(\/|$|\?)/, new Set(REQUESTS.map((request) => request.id)), 'request'],
      [/^\/me\/approvals\/(\d+)(\/|$|\?)/, new Set(APPROVALS.map((approval) => approval.id)), 'approval'],
      [/^\/me\/documents\/(\d+)(\/|$|\?)/, new Set(DOCUMENTS.map((document) => document.id)), 'document'],
      [/^\/(?:buyer|supplier)\/qualification\/applications\/(\d+)(\/|$|\?)/, new Set(QUALIFICATION_APPLICATIONS.map((row) => row.id)), 'application'],
      [/^\/me\/tasks\?task=(\d+)/, new Set(TASKS.map((task) => task.id)), 'task'],
    ];
    const dangling: string[] = [];
    for (const entry of walked.strings.filter((candidate) => APP_LINK.test(candidate.value))) {
      for (const [pattern, ids, kind] of exists) {
        const id = Number(pattern.exec(entry.value)?.[1] ?? Number.NaN);
        if (!Number.isNaN(id) && !ids.has(id)) dangling.push(`${entry.file}: ${entry.value} (no ${kind} ${id})`);
      }
    }
    expect([...new Set(dangling)]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Storyline agreement
// ---------------------------------------------------------------------------------------------------------------

function tenderByReference(reference: string) {
  const tender = TENDERS.find((row) => row.reference === reference);
  if (tender === undefined) throw new Error(`${reference} is missing from the tender register.`);
  return tender;
}

function plannedDeadline(tenderId: number): string | undefined {
  return MILESTONES.find((row) => row.tenderId === tenderId && row.lotId === null && row.milestone === 'submission_deadline')?.at;
}

describe('storyline agreement across domains', () => {
  it.each([
    ['T-2026-0002', '2026-10-21T10:00:00Z', '2026-10-14T10:00:00Z'],
    ['T-2026-0011', '2026-10-23T10:00:00Z', '2026-10-21T10:00:00Z'],
  ])('uses one submission deadline for %s after its Addendum 1 (%s, moved from %s)', (reference, deadline, previous) => {
    // Arrange
    const tender = tenderByReference(reference);
    const addendum = ADDENDA.find((row) => row.tenderId === tender.id && row.status === 'issued' && row.newSubmissionDeadline !== null);

    // Assert
    expect(plannedDeadline(tender.id)).toBe(deadline);
    expect(addendum).toMatchObject({ newSubmissionDeadline: deadline, previousSubmissionDeadline: previous });
    expect(NOTICES.find((row) => row.id === tender.id)?.submissionDeadline).toBe(deadline);
    expect(BID_TENDERS.find((row) => row.id === tender.id)?.rounds.map((round) => round.deadline)).toEqual([deadline]);
    for (const row of CALENDAR_DEADLINES.filter((entry) => entry.tenderId === tender.id && entry.milestone === 'submission_deadline')) {
      expect(row.deadline).toBe(deadline);
    }
    const orgRef = TENDER_REFS.find((row) => row.tenderId === tender.id);
    if (orgRef !== undefined) expect(orgRef.submissionDeadline).toBe(deadline);
  });

  it('keeps every open tender deadline of the notification and task fixtures on the tender timetable', () => {
    const deadlines = new Set(MILESTONES.map((row) => row.at));
    const withDeadline = NOTIFICATIONS.filter((row) => row.deadline !== null && row.deadline !== undefined);
    for (const notification of withDeadline) {
      expect(deadlines.has(notification.deadline?.at ?? ''), `notification ${notification.id}`).toBe(true);
    }
  });

  it('keeps the submission deadline of every tender the same in the tenders, publication and bids fixtures', () => {
    for (const tender of TENDERS.filter((row) => !row.isTemplate)) {
      const deadline = plannedDeadline(tender.id);
      const notice = NOTICES.find((row) => row.id === tender.id);
      if (notice !== undefined) expect(notice.submissionDeadline, tender.reference).toBe(deadline ?? null);
      const bidTender = BID_TENDERS.find((row) => row.id === tender.id);
      if (bidTender !== undefined && bidTender.rounds.length === 1) expect(bidTender.rounds[0]?.deadline, tender.reference).toBe(deadline);
    }
  });

  it('keeps the calendar impact deadlines on the tender timetable and the tender’s calendar', () => {
    for (const row of CALENDAR_DEADLINES) {
      const tender = TENDERS.find((candidate) => candidate.id === row.tenderId);
      const milestone = MILESTONES.find((candidate) => candidate.tenderId === row.tenderId && candidate.milestone === row.milestone && candidate.lotId === row.lotId);
      expect(milestone?.at, `${row.reference} ${row.milestone}`).toBe(row.deadline);
      expect(tender?.calendarId, row.reference).toBe(row.calendarId);
      expect(tender?.status, row.reference).toBe(row.status);
    }
  });

  it('links every approval id another domain carries to an approval request of the workspace', () => {
    const approvals = new Set(APPROVALS.map((approval) => approval.id));
    const dangling = walked.objects.flatMap(({ file, value }) =>
      ['approvalRequestId', 'approvalId', 'finalAwardApprovalId']
        .map((key) => [key, num(value[key])] as const)
        .filter(([, id]) => id !== null && !approvals.has(id))
        .map(([key, id]) => `${file}: ${key} ${String(id)}`),
    );
    expect([...new Set(dangling)]).toEqual([]);
  });

  it('uses the lots of the tenders domain in the bids domain, or its implicit single lot', () => {
    for (const bidTender of BID_TENDERS) {
      const owned = LOTS.filter((lot) => lot.tenderId === bidTender.id);
      for (const lot of bidTender.lots) {
        if (owned.length === 0) {
          expect(lot.id, bidTender.reference).toBe(bidTender.id * 100 + 1);
        } else {
          expect(owned.find((row) => row.id === lot.id)?.title, `${bidTender.reference} lot ${lot.id}`).toBe(lot.title.replace(/^Lot \d+ — /, ''));
        }
      }
    }
  });

  it('opens and evaluates exactly the effective receipts of the bids domain (T-2026-0001, T-2026-0003, T-2026-0008)', () => {
    const effective = (tenderId: number) =>
      SUBMISSION_RECEIPTS.filter((receipt) => {
        const bid = BIDS.find((row) => row.id === receipt.bidId);
        return bid?.tenderId === tenderId && receipt.status !== 'superseded' && receipt.status !== 'late_rejected' && receipt.status !== 'withdrawn';
      }).map((receipt) => receipt.receiptNo);
    for (const tenderId of [1, 3, 8]) {
      const opened = OPENING_BIDS.filter((row) => row.tenderId === tenderId && row.receiptStatus !== 'withdrawn').map((row) => row.receiptNo);
      expect([...opened].sort(), `T-2026-000${tenderId}`).toEqual([...effective(tenderId)].sort());
    }
    for (const evaluation of EVALUATIONS.filter((row) => row.tender.tenderId === 1 || row.tender.tenderId === 3)) {
      const opened = new Map(OPENING_BIDS.map((row) => [row.receiptNo, row]));
      for (const bid of evaluation.bids) {
        expect(opened.get(bid.receiptNo), `${evaluation.key} ${bid.receiptNo}`).toMatchObject({
          tenderId: evaluation.tender.tenderId,
          supplierTenantId: bid.supplierTenantId,
          receivedAt: bid.receivedAt,
        });
      }
    }
  });

  it('reproduces the PRD §9.2 worked example on T-2026-0003 exactly (AC-19) and the awards draft follows it', async () => {
    // Arrange
    const api = await createTestMockApp({ auth: 'fixture', now: () => new Date('2026-09-30T08:00:00Z') });
    const evaluation = EVALUATIONS.find((row) => row.tender.tenderId === 3 && row.lot === null);
    const supplierOf = (label: string) => evaluation?.bids.find((bid) => bid.label === label)?.supplierTenantId;

    // Act
    const response = await api.callAs('boitumelo.chair@tenderiq.local', getResults, { tenant: 'kwu', params: { tenderId: 3 } });
    const view = getResults.response.parse(response.body);
    const ranked = view.results.filter((row) => row.rank !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

    // Assert
    expect(evaluation?.tender).toMatchObject({ reference: 'T-2026-0003', status: tenderByReference('T-2026-0003').status });
    expect(ranked.map((row) => [supplierOf(row.bid.label), row.totalScoreDisplay])).toEqual([
      [TENANTS.find((tenant) => tenant.slug === 'tsodilo')?.id, '88.00'],
      [TENANTS.find((tenant) => tenant.slug === 'serowe-ict')?.id, '86.00'],
    ]);
    const costs = evaluation?.commercial?.rows.map((row) => row.evaluatedCost?.amount).filter((amount) => amount !== undefined);
    expect(new Set(costs)).toEqual(new Set(['100000.00', '120000.00']));
    const recommendation = RECOMMENDATIONS.find((row) => row.detail.tender.tenderId === 3);
    expect(recommendation?.detail.summary).toContain('Tsodilo');
    expect(recommendation?.detail.summary).toContain('88.00');
  });

  it('agrees on the award values the approvals, awards and contracts domains record (AC-28)', () => {
    const lot1 = LOT_OUTCOMES.find((row) => row.lotOutcomeId === 14011);
    expect(lot1).toMatchObject({ awardedValue: { amount: '5340000.00' }, status: 'final_awarded' });
    const approval35 = APPROVALS.find((row) => row.id === 35);
    expect(approval35?.amount?.amount).toBe(lot1?.awardedValue?.amount);
    const t7 = RECOMMENDATIONS.find((row) => row.detail.approval?.approvalRequestId === 38);
    expect(APPROVALS.find((row) => row.id === 38)?.amount?.amount).toBe(t7?.detail.proposedContracts[0]?.value.amount);
    const c2 = CONTRACTS.find((row) => row.reference === 'C-2026-0002');
    expect(APPROVALS.find((row) => row.id === 42)?.amount?.amount).toBe(c2?.value.amount);
  });

  it('links award and exclusion approvals to approval requests of the matching subject type', () => {
    for (const recommendation of RECOMMENDATIONS) {
      const id = recommendation.detail.approval?.approvalRequestId ?? null;
      if (id !== null) expect(APPROVALS.find((row) => row.id === id)?.subjectType, `recommendation ${recommendation.detail.recommendationId}`).toBe('award');
    }
    expect(APPROVALS.find((row) => row.id === 37)).toMatchObject({ subjectType: 'exclusion', subjectId: 5101 });
  });

  it('keeps Chobe’s public liability insurance expiring on 8 Oct 2026 in every domain (AC-09)', () => {
    const chobe = TENANTS.find((tenant) => tenant.slug === 'chobe-pipe')?.id;
    const insurance = EVIDENCE_ITEMS.find((item) => item.id === 504);
    expect(insurance).toMatchObject({ evidenceType: 'insurance', expiresAt: '2026-10-08' });
    const document = DOCUMENTS.find((row) => row.relatedType === 'evidence_item' && row.relatedId === 504);
    expect(document?.ownerTenantId).toBe(chobe);
    expect(document?.evidence?.expiresAt).toBe('2026-10-08');
  });

  it('points workspace evidence sources and evidence documents at items of the suppliers evidence library', () => {
    const library = new Set(EVIDENCE_ITEMS.map((item) => item.id));
    for (const document of DOCUMENTS.filter((row) => row.relatedType === 'evidence_item')) {
      expect(library.has(document.relatedId), `document ${document.id}`).toBe(true);
    }
    for (const task of TASKS.filter((row) => row.sourceType === 'evidence_item')) {
      expect(library.has(task.sourceId ?? 0), `task ${task.id}`).toBe(true);
    }
    for (const notification of NOTIFICATIONS.filter((row) => row.sourceType === 'evidence_item')) {
      expect(library.has(notification.sourceId ?? 0), `notification ${notification.id}`).toBe(true);
    }
  });

  it('gives the organization administrator and the approval workspace the same authority facts (AC-05, BR-06)', () => {
    const limitOf = (limits: readonly { userId: number; maxAmount: string | null }[], login: string) => {
      const userId = PERSONAS.find((persona) => persona.email === `${login}@tenderiq.local`)?.userId;
      return limits.filter((limit) => limit.userId === userId).map((limit) => limit.maxAmount);
    };
    const workspace = WORKSPACE_LIMITS.map((limit) => ({ userId: limit.userId, maxAmount: limit.maxAmount?.amount ?? null }));
    const orgAdmin = ORG_LIMITS.filter((limit) => limit.effectiveTo === null || limit.effectiveTo > '2026-10-01').map((limit) => ({
      userId: limit.subjectUserId ?? -1,
      maxAmount: limit.maxAmount,
    }));
    expect(limitOf(workspace, 'mpho.manager')).toEqual(['2000000.00']);
    expect(limitOf(workspace, 'keabetswe.approver')).toEqual(['10000000.00']);
    expect(new Set(limitOf(orgAdmin, 'mpho.manager').filter((amount) => amount !== null))).toEqual(new Set(['2000000.00']));
    expect(new Set(limitOf(orgAdmin, 'keabetswe.approver'))).toEqual(new Set(['10000000.00']));
    const delegation = WORKSPACE_DELEGATIONS.find((row) => row.id === 7);
    expect(ORG_DELEGATIONS).toContainEqual(
      expect.objectContaining({
        delegatorUserId: delegation?.delegatorUserId,
        delegateUserId: delegation?.delegateUserId,
        decisionTypes: delegation?.decisionTypes,
        maxAmount: delegation?.maxAmount.amount,
        startsAt: delegation?.startsAt,
        endsAt: delegation?.endsAt,
      }),
    );
  });

  it('routes PR-2026-0003 above Mpho’s limit to Keabetswe (AC-05)', () => {
    const request = REQUESTS.find((row) => row.reference === 'PR-2026-0003' && row.tenantId === tenderByReference('T-2026-0003').tenantId);
    const approval = APPROVALS.find((row) => row.subjectType === 'procurement_request' && row.subjectId === request?.id);
    expect(approval?.title).toContain(request?.title ?? '∅');
    expect(Number(approval?.amount?.amount)).toBeGreaterThan(2_000_000);
    expect(approval?.steps.at(-1)?.approverUserId).toBe(PERSONAS.find((persona) => persona.email === 'keabetswe.approver@tenderiq.local')?.userId);
  });
});
