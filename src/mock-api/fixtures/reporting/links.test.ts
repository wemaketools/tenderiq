/**
 * Every in-app link the reporting and records fixtures and handlers hand to the SPA resolves to a route the SPA
 * really registers (no dead links or drill-throughs). The registered routes are read from the SPA's own feature
 * registry (`src/ui/src/app/featureRegistry.ts`, auto-registration of every `features/<x>/routes.tsx`) through a
 * Vite SSR loader, so the check follows the routes as the other features define them. Nothing from the SPA is
 * imported statically (the mock API stays independent of it).
 */
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { recordsEndpoints as D } from '../../../contracts/records.js';
import { reportingEndpoints as R } from '../../../contracts/reporting.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import * as RECORDS from '../records/index.js';
import * as REPORTING from './index.js';

interface RegisteredRoute {
  readonly area: string;
  readonly path: string;
}
interface RegistryModule {
  readonly features: ReadonlyArray<{ readonly area: string; readonly routes: readonly RegisteredRoute[] }>;
  areaPath(area: string, relative: string): string;
}

const uiRoot = fileURLToPath(new URL('../../../ui', import.meta.url));
let routePatterns: readonly RegExp[] = [];
let api: TestMockApp;

function patternOf(route: string): RegExp {
  const escaped = route
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}/?$`);
}

beforeAll(async () => {
  const server = await createServer({
    root: uiRoot,
    configFile: `${uiRoot}/vite.config.ts`,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const registry = (await server.ssrLoadModule('/src/app/featureRegistry.ts')) as unknown as RegistryModule;
    routePatterns = registry.features.flatMap((feature) => feature.routes.map((route) => patternOf(registry.areaPath(feature.area, route.path))));
  } finally {
    await server.close();
  }
  api = await createTestMockApp();
}, 60_000);

afterAll(() => {
  routePatterns = [];
});

/** Collects every string that looks like an in-app link (`/buyer…`, `/supplier…`, `/me…`, `/ops…`). */
function collectLinks(value: unknown, into: Set<string>, seen = new Set<unknown>()): Set<string> {
  if (typeof value === 'string') {
    if (/^\/(buyer|supplier|me|ops)(\/|$|\?)/.test(value)) into.add(value);
    return into;
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return into;
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) collectLinks(item, into, seen);
  return into;
}

function unresolved(links: Iterable<string>): string[] {
  return [...links].filter((link) => {
    const path = link.split('?')[0] ?? link;
    return !routePatterns.some((pattern) => pattern.test(path));
  });
}

describe('fixture links resolve to registered SPA routes', () => {
  it('loads the SPA route registry', () => {
    expect(routePatterns.length).toBeGreaterThan(100);
    expect(unresolved(['/buyer/dashboard', '/supplier/responses/6'])).toEqual([]);
    expect(unresolved(['/buyer/records/holds/1'])).toEqual(['/buyer/records/holds/1']);
  });

  it('resolves every LINKS helper', () => {
    const links = Object.values(REPORTING.LINKS).map((helper) => (helper as (a: number | string, b?: number) => string)(1, 1));
    links.push(REPORTING.LINKS.auditTrail('tender', REPORTING.LEGACY_TENDER_ID), REPORTING.LINKS.buyerTenders('open'), REPORTING.LINKS.tasks());
    expect(unresolved(links)).toEqual([]);
  });

  it('resolves every link stored in the reporting and records fixtures', () => {
    const links = collectLinks([REPORTING, RECORDS], new Set<string>());
    expect(links.size).toBeGreaterThan(50);
    expect(unresolved(links)).toEqual([]);
  });

  it('resolves every link the dashboards, reports, search and records handlers return', async () => {
    const links = new Set<string>();
    const buyer = ['mpho.manager@tenderiq.local', 'tebogo.officer@tenderiq.local', 'pule.auditor@tenderiq.local'];
    const suppliers: Array<[string, string]> = [
      ['tsodilo.bidmanager@tenderiq.local', 'tsodilo'],
      ['chobe-pipe.bidmanager@tenderiq.local', 'chobe-pipe'],
      ['serowe-ict.bidmanager@tenderiq.local', 'serowe-ict'],
      ['gaborone-meter.bidmanager@tenderiq.local', 'gaborone-meter'],
      ['limpopo-env.admin@tenderiq.local', 'limpopo-env'],
      ['sam.dual@tenderiq.local', 'chobe-pipe'],
    ];
    for (const email of buyer) {
      collectLinks((await api.callAs(email, R.getBuyerDashboard, { tenant: 'kwu' })).body, links);
      for (const { family } of REPORTING.REPORT_FAMILIES) {
        collectLinks((await api.callAs(email, R.runReport, { tenant: 'kwu', params: { family } })).body, links);
      }
      for (const q of ['water', 'pump', 'valve', 'T-20', 'PR-2026']) {
        collectLinks((await api.callAs(email, R.search, { tenant: 'kwu', query: { q, pageSize: 100 } })).body, links);
      }
    }
    for (const [email, tenant] of suppliers) {
      collectLinks((await api.callAs(email, R.getSupplierDashboard, { tenant })).body, links);
      for (const q of ['water', 'pump', 'valve', 'T-20', 'leak']) {
        collectLinks((await api.callAs(email, R.search, { tenant, query: { q, pageSize: 100 } })).body, links);
      }
    }
    const pule = 'pule.auditor@tenderiq.local';
    collectLinks((await api.callAs(pule, D.listAuditEvents, { tenant: 'kwu', query: { pageSize: 100 } })).body, links);
    collectLinks((await api.callAs(pule, D.listRecordSubjects, { tenant: 'kwu', query: { pageSize: 100 } })).body, links);
    collectLinks((await api.callAs(pule, D.listDisposalRequests, { tenant: 'kwu' })).body, links);
    for (const holdId of [1, 2, 3]) {
      collectLinks((await api.callAs(pule, D.getHold, { tenant: 'kwu', params: { holdId } })).body, links);
    }

    expect(links.size).toBeGreaterThan(30);
    expect(unresolved(links)).toEqual([]);
  }, 60_000);
});
