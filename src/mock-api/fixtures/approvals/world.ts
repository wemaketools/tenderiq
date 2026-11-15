/**
 * Shared anchors of the workspace fixtures (tasks, approvals, notifications, documents, audit, calendars and
 * notification rules): the storyline "as of" instant, persona ids by login, and the records of other domains the
 * workspace rows point at (docs/plan/demo-storyline.md).
 *
 * The records are read from the domains that own them (tenders, requests, contracts), so a workspace row always
 * shows the same reference, title and organization as the record's own page. In-app links follow the feature routes
 * of the owning domains; the fixture tests match every link against the SPA route table.
 */
import { sha256Hex } from '../../sha256.js';

import { CONTRACTS } from '../contracts/core.js';
import { DEMO_AS_OF, DEMO_TIME_ZONE, storylineInstant, storylineNow } from '../demo-clock.js';
import { PERSONA_EMAIL_DOMAIN, TENANT_IDS } from '../platform.js';
import type { TenantSlug } from '../platform.js';
import { REQUESTS } from '../requests/requests.js';
import { TENDERS } from '../tenders/tenders.js';
import { personaByEmail } from '../../persona.js';

/**
 * The storyline "now" used for derived fixture facts such as `isOverdue`: the one demo clock of every fixture domain
 * (`../demo-clock.ts`), so the workspace agrees with the dashboards and the SPA countdowns.
 */
export const WORKSPACE_AS_OF = DEMO_AS_OF;

/** The official zone of every demo organization. */
export const OFFICIAL_ZONE = DEMO_TIME_ZONE;

/**
 * The instant a state-changing action is stamped with: the request time on the storyline clock (never earlier than
 * the storyline "now", so an action never predates the records it acts on).
 */
export { storylineInstant, storylineNow };

/** The user id of a persona login such as `mpho.manager`. */
export function uid(login: string): number {
  return personaByEmail(`${login}@${PERSONA_EMAIL_DOMAIN}`).userId;
}

/** The tenant id of a storyline slug. */
export function tid(slug: TenantSlug): number {
  return TENANT_IDS[slug];
}

/** A deterministic SHA-256 hex digest standing in for a content hash or file digest. */
export function digest(seed: string): string {
  return sha256Hex(seed);
}

/** True when `dueAt` lies before the storyline "now". */
export function isPastDue(dueAt: string | null): boolean {
  return dueAt !== null && Date.parse(dueAt) < Date.parse(WORKSPACE_AS_OF);
}

/** A record of another domain that workspace rows refer to. */
export interface WorkspaceRecord {
  readonly type: string;
  readonly id: number;
  readonly reference: string;
  readonly title: string;
  readonly tenantId: number;
  /** The buyer-side page of the record. */
  readonly buyerLink: string;
  /** The supplier-side page, where suppliers have one. */
  readonly supplierLink: string | null;
}

function tender(id: number): WorkspaceRecord {
  const row = TENDERS.find((candidate) => candidate.id === id);
  if (row === undefined) {
    throw new Error(`The tenders fixtures hold no tender ${id}.`);
  }
  return {
    type: 'tender',
    id,
    reference: row.reference,
    title: row.title,
    tenantId: row.tenantId,
    buyerLink: `/buyer/tenders/${id}`,
    supplierLink: `/supplier/opportunities/${id}`,
  };
}

function request(tenantId: number, reference: string): WorkspaceRecord {
  const row = REQUESTS.find((candidate) => candidate.tenantId === tenantId && candidate.reference === reference);
  if (row === undefined) {
    throw new Error(`The requests fixtures hold no ${reference}.`);
  }
  return {
    type: 'procurement_request',
    id: row.id,
    reference: row.reference,
    title: row.title,
    tenantId: row.tenantId,
    buyerLink: `/buyer/requests/${row.id}`,
    supplierLink: null,
  };
}

function contract(reference: string): WorkspaceRecord {
  const row = CONTRACTS.find((candidate) => candidate.reference === reference);
  if (row === undefined) {
    throw new Error(`The contracts fixtures hold no ${reference}.`);
  }
  return {
    type: 'contract',
    id: row.id,
    reference: row.reference,
    title: row.title,
    tenantId: row.tenantId,
    buyerLink: `/buyer/contracts/${row.id}`,
    supplierLink: `/supplier/contracts/${row.id}`,
  };
}

const KWU = TENANT_IDS.kwu;

/** The records of the storyline the workspace refers to. */
export const RECORDS = {
  t1: tender(1),
  t2: tender(2),
  t3: tender(3),
  t4: tender(4),
  t5: tender(5),
  t6: tender(6),
  t7: tender(7),
  t8: tender(8),
  t9: tender(9),
  t10: tender(10),
  t11: tender(11),
  pr1: request(KWU, 'PR-2026-0001'),
  pr3: request(KWU, 'PR-2026-0003'),
  pr4: request(KWU, 'PR-2026-0004'),
  pr5: request(KWU, 'PR-2026-0005'),
  pr8: request(KWU, 'PR-2026-0008'),
  pr11: request(KWU, 'PR-2026-0011'),
  pr13: request(KWU, 'PR-2026-0013'),
  c1: contract('C-2026-0001'),
  c2: contract('C-2026-0002'),
  c7: contract('C-2025-0007'),
} as const satisfies Record<string, WorkspaceRecord>;

export type RecordKey = keyof typeof RECORDS;

/** In-app pages of other domains that workspace rows link to (routes of the owning features). */
export const LINKS = {
  evaluation: (tenderId: number): string => `/buyer/evaluation/tenders/${tenderId}`,
  buyerQuestion: (questionId: number): string => `/buyer/clarifications/questions/${questionId}`,
  buyerUser: (userId: number): string => `/buyer/admin/access/users/${userId}`,
  buyerSubscription: '/buyer/admin/service/subscription',
  supplierUsers: '/supplier/admin/access/users',
  supplierOrganization: '/supplier/organization',
  supplierEvidence: '/supplier/evidence',
  opsSupportCase: (caseId: number): string => `/ops/support/cases/${caseId}`,
  opsIncident: (incidentId: number): string => `/ops/incidents/${incidentId}`,
  opsOffboardingPlan: (planId: number): string => `/ops/offboarding/${planId}`,
  opsCustomer: (tenantId: number): string => `/ops/customers/${tenantId}`,
} as const;
