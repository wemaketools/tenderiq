/**
 * Reference data the tender fixtures point at (docs/plan/demo-storyline.md). These records belong to other domains
 * (org-admin: legal entities, departments, categories; workspace: calendars; policy: policy versions, templates;
 * requests: projects, requests, strategies; qualification: programs). They are mirrored here with the ids and natural
 * keys the storyline uses, so the tender screens can name them; the cross-fixture consistency test lines them up.
 */
import { TENANT_IDS } from '../platform.js';
import { POLICY_PROFILES, POLICY_VERSIONS as POLICY_VERSION_ROWS } from '../policy/profiles.js';
import { CATEGORIES as REQUEST_CATEGORIES } from '../requests/reference.js';
import { REQUESTS as REQUEST_ROWS } from '../requests/requests.js';
import { STRATEGIES as STRATEGY_ROWS } from '../requests/strategies.js';
import type {
  FxCalendar,
  FxCategory,
  FxNamed,
  FxPolicyVersion,
  FxProject,
  FxRequest,
  FxStrategy,
  FxTemplate,
} from './types.js';

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

/** Persona user ids used by the tender fixtures (docs/plan/foundation-contract.md §5). */
export const USERS = {
  mpho: 4,
  tebogo: 5,
  kagiso: 6,
  onalenna: 7,
  lesego: 9,
  boitumelo: 10,
  thato: 11,
  kabo: 12,
  amantle: 13,
  refilwe: 14,
  oratile: 15,
  goitse: 16,
  dineo: 17,
  keabetswe: 18,
  pule: 20,
  former: 21,
  officerOdc: 23,
  sam: 42,
} as const;

export const LEGAL_ENTITIES: readonly FxNamed[] = Object.freeze([
  { id: 1, tenantId: KWU, name: 'Kalahari Water Utilities Corporation' },
  { id: 2, tenantId: ODC, name: 'Okavango District Council' },
]);

export const DEPARTMENTS: readonly FxNamed[] = Object.freeze([
  { id: 1, tenantId: KWU, name: 'Operations' },
  { id: 2, tenantId: KWU, name: 'Technical Services' },
  { id: 3, tenantId: KWU, name: 'Network Operations' },
  { id: 4, tenantId: KWU, name: 'Water Quality' },
  { id: 5, tenantId: KWU, name: 'Corporate Services' },
  { id: 6, tenantId: ODC, name: 'Facilities Management' },
]);

export const CATEGORIES: readonly FxCategory[] = Object.freeze([
  { id: 1, tenantId: KWU, code: 'WTR-INFRA', name: 'Water infrastructure', parentId: null },
  { id: 2, tenantId: KWU, code: 'WTR-PUMP', name: 'Pumps and mechanical equipment', parentId: 1 },
  { id: 3, tenantId: KWU, code: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentId: 1 },
  { id: 4, tenantId: KWU, code: 'WTR-METER', name: 'Water metering', parentId: null },
  { id: 5, tenantId: KWU, code: 'ICT-SCADA', name: 'SCADA and telemetry', parentId: null },
  { id: 6, tenantId: KWU, code: 'WTR-CHEM', name: 'Water treatment chemicals and dosing', parentId: null },
  { id: 7, tenantId: KWU, code: 'ENV-LEAK', name: 'Leak detection services', parentId: null },
  { id: 8, tenantId: KWU, code: 'CIV-WORKS', name: 'Civil works', parentId: null },
  { id: 9, tenantId: KWU, code: 'FLEET-SVC', name: 'Fleet maintenance services', parentId: null },
  { id: 10, tenantId: KWU, code: 'ELEC-MAINT', name: 'Electrical maintenance services', parentId: null },
  { id: 20, tenantId: ODC, code: 'FAC-CLEAN', name: 'Cleaning services', parentId: null },
]);

const BOTSWANA_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'New Year’s Day' },
  { date: '2026-01-02', name: 'New Year holiday' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-04', name: 'Holy Saturday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-14', name: 'Ascension Day' },
  { date: '2026-07-01', name: 'Sir Seretse Khama Day' },
  { date: '2026-07-20', name: 'President’s Day' },
  { date: '2026-07-21', name: 'President’s Day holiday' },
  { date: '2026-09-30', name: 'Botswana Day' },
  { date: '2026-10-01', name: 'Botswana Day holiday' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Boxing Day' },
  { date: '2026-12-28', name: 'Boxing Day holiday' },
  { date: '2027-01-01', name: 'New Year’s Day' },
] as const;

export const CALENDARS: readonly FxCalendar[] = Object.freeze([
  { id: 1, tenantId: KWU, name: 'Botswana Public Holidays 2026', holidays: BOTSWANA_HOLIDAYS_2026 },
  { id: 5, tenantId: ODC, name: 'Okavango District working calendar 2026', holidays: BOTSWANA_HOLIDAYS_2026 },
]);

/**
 * Policy versions, projected from the policy domain (the owner of policy_profile_versions). Each tenant's default
 * version for a new tender comes first: the current version of its first active profile.
 */
export const POLICY_VERSIONS: readonly FxPolicyVersion[] = Object.freeze(
  [...POLICY_VERSION_ROWS]
    .filter((version) => version.status === 'approved' || version.status === 'retired')
    .sort((left, right) => {
      const defaultOf = (tenantId: number): number | null =>
        POLICY_PROFILES.find((profile) => profile.tenantId === tenantId && profile.status === 'active')?.currentVersionId ?? null;
      const rank = (version: (typeof POLICY_VERSION_ROWS)[number]): number => (defaultOf(version.tenantId) === version.id ? 0 : 1);
      return rank(left) - rank(right) || left.id - right.id;
    })
    .map((version) => ({
      id: version.id,
      tenantId: version.tenantId,
      profileName: POLICY_PROFILES.find((profile) => profile.id === version.profileId)?.name ?? '',
      versionNo: version.versionNo,
      permittedProcedures: version.rules.permittedProcedures,
      minResponseDays: version.rules.minResponseDays,
      questionDeadlineDaysBeforeClose: version.rules.questionDeadlineDaysBeforeClose,
      requiresReleaseApproval: version.rules.requiresReleaseApproval,
      negotiationPermitted: version.rules.negotiationPermitted,
      bafoPermitted: version.rules.bafoPermitted,
    })),
);

export const PROJECTS: readonly FxProject[] = Object.freeze([
  { id: 1, tenantId: KWU, reference: 'PP-2026-0001', title: 'Borehole rehabilitation programme 2026' },
  { id: 2, tenantId: KWU, reference: 'PP-2026-0002', title: 'Network loss reduction programme' },
]);

/** A requests-domain category id mapped to the tender category with the same code (`null` when none matches). */
function tenderCategoryOf(requestCategoryId: number | null): number | null {
  const code = REQUEST_CATEGORIES.find((category) => category.id === requestCategoryId)?.code;
  return CATEGORIES.find((category) => category.code === code)?.id ?? null;
}

/**
 * Approved and converted procurement requests, projected from the requests domain (the owner of
 * procurement_requests): a tender can be created from an approved request that is not yet converted.
 */
export const REQUESTS: readonly FxRequest[] = Object.freeze(
  REQUEST_ROWS.filter((request) => request.status === 'approved' || request.status === 'converted').map((request) => ({
    id: request.id,
    tenantId: request.tenantId,
    reference: request.reference,
    title: request.title,
    status: request.status,
    estimatedValue: request.estimatedValue?.amount ?? null,
    categoryId: tenderCategoryOf(request.categoryId),
    convertedToTenderId: request.convertedTenderId,
  })),
);

/** Procurement strategies, projected from the requests domain (the owner of procurement_strategies). */
export const STRATEGIES: readonly FxStrategy[] = Object.freeze(
  STRATEGY_ROWS.map((strategy) => ({
    id: strategy.id,
    tenantId: strategy.tenantId,
    title: strategy.title,
    requestId: strategy.requestId,
    eventType: strategy.eventType,
    procedure: strategy.procedure,
    status: strategy.status,
    usedByTenderId: strategy.tenderIds[0] ?? null,
  })),
);

/** Tender-package templates; each points at a template tender (`tenders.is_template = true`). */
export const TEMPLATES: readonly FxTemplate[] = Object.freeze([
  {
    id: 11,
    tenantId: KWU,
    name: 'KWU standard goods tender (open)',
    procedure: 'open',
    categoryId: null,
    versionNo: 3,
    status: 'approved',
    effectiveFrom: '2026-03-01',
    reviewDate: '2027-02-28',
    sourceTenderId: 901,
    sections: ['overview', 'requirements', 'pricing', 'terms', 'evaluation_plan', 'timetable', 'participation'],
  },
  {
    id: 12,
    tenantId: KWU,
    name: 'KWU services RFQ',
    procedure: 'open',
    categoryId: null,
    versionNo: 2,
    status: 'approved',
    effectiveFrom: '2026-04-15',
    reviewDate: '2027-04-14',
    sourceTenderId: 902,
    sections: ['overview', 'requirements', 'pricing', 'terms', 'evaluation_plan', 'timetable'],
  },
  {
    id: 13,
    tenantId: KWU,
    name: 'KWU consultancy RFP (two envelopes)',
    procedure: 'open',
    categoryId: null,
    versionNo: 1,
    status: 'in_review',
    effectiveFrom: null,
    reviewDate: null,
    sourceTenderId: 903,
    sections: ['overview', 'requirements', 'pricing', 'evaluation_plan'],
  },
  {
    id: 21,
    tenantId: ODC,
    name: 'ODC services RFQ',
    procedure: 'open',
    categoryId: 20,
    versionNo: 1,
    status: 'approved',
    effectiveFrom: '2026-06-01',
    reviewDate: '2027-05-31',
    sourceTenderId: 904,
    sections: ['overview', 'requirements', 'pricing', 'terms', 'timetable'],
  },
]);

export const QUALIFICATION_PROGRAMS: readonly FxNamed[] = Object.freeze([
  { id: 1, tenantId: KWU, name: 'Water Infrastructure Suppliers — Category A' },
]);

/** Deterministic 64-hex content hash of a package revision (stands in for the SHA-256 of the snapshot). */
export function fixtureHash(seed: string): string {
  let out = '';
  for (let round = 0; round < 8; round += 1) {
    let hash = 0x811c9dc5 ^ round;
    for (const char of `${round}:${seed}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    out += hash.toString(16).padStart(8, '0');
  }
  return out;
}

/** The content hash of a tender revision. */
export function revisionHash(tenderId: number, draftRevision: number): string {
  return fixtureHash(`tender:${tenderId}:revision:${draftRevision}`);
}
