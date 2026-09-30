/**
 * Operations fixtures: customer profiles (OPS-01), onboarding checklists (OPS-02), the plan catalog, subscriptions,
 * entitlements, service actions and invoices (OPS-03), and the ODC offboarding plan with its exit export (AC-36).
 *
 * Storyline anchors (docs/plan/demo-storyline.md "Records and operations"):
 * - KWU is the pilot customer (`pilot` plan, stage `pilot`). Its published-event usage passed the pilot limit, which
 *   raised a service action that never blocks a submission (PRD §21.1).
 * - ODC gave notice of exit while T-2026-0011 is open and contract C-2025-0004 is active: its offboarding plan is
 *   `draft`, the continuity text is written, the customer has not yet agreed it (AC-36, BR-47).
 * - Suppliers use the platform free of charge: no plan, no subscription, no onboarding (BR-46).
 *
 * Live events and contracts are derived from the tenders and contracts fixtures so every domain shows the same
 * world. Static data: nothing here is mutated at runtime.
 */
import type {
  ContractsStatus,
  ExportsFormat,
  ExportsStatus,
  OffboardingPlansStatus,
  SubscriptionsStatus,
  TendersStatus,
  TenantsOnboardingStage,
} from '../../../contracts/enums.js';
import type {
  EntitlementFeatureCode,
  InvoiceStatus,
  OnboardingItemArea,
  OnboardingItemStatus,
  PlanCode,
  ServiceActionStatus,
} from '../../../contracts/operations.js';
import { CONTRACTS } from '../contracts/index.js';
import { TENANTS, TENANT_IDS } from '../platform.js';
import { PORTAL_SETTINGS } from '../publication/catalog.js';
import { MILESTONES, TENDERS } from '../tenders/index.js';

/** Persona user ids used by the operations fixtures (foundation-contract §5). */
export const OPS_USERS = {
  opsAdmin: 1,
  supportAgent: 2,
  adminKwu: 3,
  mphoManager: 4,
  tebogoOfficer: 5,
  lesegoFinance: 9,
  masegoContracts: 19,
  puleAuditor: 20,
  adminOdc: 22,
  officerOdc: 23,
  tsodiloAdmin: 24,
  tsodiloBidManager: 25,
  chobeAdmin: 28,
  chobeBidManager: 29,
  seroweAdmin: 32,
  gaboroneMeterAdmin: 36,
  gaboroneMeterBidManager: 37,
  makgadikgadiAdmin: 40,
  limpopoAdmin: 41,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Customer profiles (tenants columns the platform fixture does not carry)
// ---------------------------------------------------------------------------------------------------------

/** The role mailbox of the TenderIQ customer service team (the service owner's contact address for customers). */
export const SERVICE_TEAM_EMAIL = 'customer.service@tenderiq.local';

/** The demo year: "year to date" usage counts events released in this calendar year. */
export const DEMO_YEAR = 2026;

/** Tender statuses that were never published (drafts and events awaiting release approval). */
const UNPUBLISHED_TENDER_STATUSES: readonly TendersStatus[] = ['draft', 'awaiting_release_approval'];

/** Events of a tenant released in a calendar year, derived from the tenders fixture (usage, entitlements). */
export function publishedEventsIn(tenantId: number, year: number): number {
  return TENDERS.filter(
    (tender) =>
      tender.tenantId === tenantId &&
      !UNPUBLISHED_TENDER_STATUSES.includes(tender.status) &&
      tender.releasedAt !== null &&
      tender.releasedAt.startsWith(`${year}-`),
  ).length;
}

export interface FixtureCustomerProfile {
  readonly tenantId: number;
  readonly tradingName: string | null;
  readonly country: string;
  readonly registrationNumber: string | null;
  readonly planCode: PlanCode | null;
  readonly onboardingStage: TenantsOnboardingStage | null;
  readonly serviceOwnerUserId: number | null;
  readonly administratorUserIds: readonly number[];
  readonly publishedEventsYtd: number;
  readonly submissionsReceivedYtd: number;
  readonly storageUsedGb: string;
  readonly lastActivityAt: string | null;
}

export const CUSTOMER_PROFILES: readonly FixtureCustomerProfile[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    tradingName: 'KWU',
    country: 'BW',
    registrationNumber: 'BW-PE-1998-0042',
    planCode: 'pilot',
    onboardingStage: 'pilot',
    serviceOwnerUserId: OPS_USERS.opsAdmin,
    administratorUserIds: [OPS_USERS.adminKwu],
    publishedEventsYtd: publishedEventsIn(TENANT_IDS.kwu, DEMO_YEAR),
    submissionsReceivedYtd: 41,
    storageUsedGb: '18.40',
    lastActivityAt: '2026-09-30T07:12:00Z',
  },
  {
    tenantId: TENANT_IDS.odc,
    tradingName: null,
    country: 'BW',
    registrationNumber: 'BW-LA-1966-0011',
    planCode: 'buyer_standard',
    onboardingStage: 'offboarding',
    serviceOwnerUserId: OPS_USERS.opsAdmin,
    administratorUserIds: [OPS_USERS.adminOdc],
    publishedEventsYtd: publishedEventsIn(TENANT_IDS.odc, DEMO_YEAR),
    submissionsReceivedYtd: 7,
    storageUsedGb: '2.15',
    lastActivityAt: '2026-09-29T13:40:00Z',
  },
  supplierProfile(TENANT_IDS.tsodilo, 'BW00001234567', [OPS_USERS.tsodiloAdmin], 9, '1.20', '2026-09-29T15:02:00Z'),
  supplierProfile(TENANT_IDS['chobe-pipe'], 'BW00002345678', [OPS_USERS.chobeAdmin], 6, '0.85', '2026-09-28T10:20:00Z'),
  supplierProfile(TENANT_IDS.makgadikgadi, 'BW00003456789', [OPS_USERS.makgadikgadiAdmin], 2, '0.40', '2026-09-24T08:05:00Z'),
  supplierProfile(TENANT_IDS['serowe-ict'], 'BW00004567890', [OPS_USERS.seroweAdmin], 4, '0.95', '2026-09-27T12:44:00Z'),
  supplierProfile(TENANT_IDS['limpopo-env'], 'BW00005678901', [OPS_USERS.limpopoAdmin], 3, '0.30', '2026-09-26T09:15:00Z'),
  supplierProfile(TENANT_IDS['gaborone-meter'], 'BW00006789012', [OPS_USERS.gaboroneMeterAdmin], 5, '0.70', '2026-09-29T09:31:00Z'),
] satisfies FixtureCustomerProfile[]);

function supplierProfile(
  tenantId: number,
  registrationNumber: string,
  administratorUserIds: readonly number[],
  submissionsYtd: number,
  storageUsedGb: string,
  lastActivityAt: string,
): FixtureCustomerProfile {
  return {
    tenantId,
    tradingName: null,
    country: 'BW',
    registrationNumber,
    planCode: null,
    onboardingStage: null,
    serviceOwnerUserId: null,
    administratorUserIds,
    publishedEventsYtd: 0,
    submissionsReceivedYtd: submissionsYtd,
    storageUsedGb,
    lastActivityAt,
  };
}

/** The customer profile of a tenant (every non-operator tenant has one). */
export function customerProfileOf(tenantId: number): FixtureCustomerProfile | undefined {
  return CUSTOMER_PROFILES.find((profile) => profile.tenantId === tenantId);
}

/** Customer tenants: every non-operator tenant. */
export const CUSTOMER_TENANTS = TENANTS.filter((tenant) => tenant.kind !== 'operator');

// ---------------------------------------------------------------------------------------------------------
// Live obligations (derived from the tenders and contracts fixtures)
// ---------------------------------------------------------------------------------------------------------

/** Tender statuses that are live obligations for an account change (open competition or decision pending). */
export const LIVE_TENDER_STATUSES: readonly TendersStatus[] = [
  'ready',
  'open',
  'closed',
  'under_assessment',
  'award_pending',
  'partially_awarded',
];

/** Contract statuses with live obligations. */
export const LIVE_CONTRACT_STATUSES: readonly ContractsStatus[] = [
  'under_review',
  'awaiting_signature',
  'signed_not_effective',
  'active',
  'suspended',
];

export interface FixtureLiveEvent {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: TendersStatus;
  readonly submissionDeadline: { readonly at: string; readonly timeZone: string } | null;
  /**
   * The event is on the public portal (released, open participation, portal enabled; AC-01). Operators see the
   * title of public events only (PRD §4.3).
   */
  readonly publiclyVisible: boolean;
}

export interface FixtureLiveContract {
  readonly tenantId: number;
  readonly contractId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: ContractsStatus;
  readonly supplierName: string;
  readonly termEnd: string | null;
}

export const LIVE_EVENTS: readonly FixtureLiveEvent[] = Object.freeze(
  TENDERS.filter((tender) => /^T-\d{4}-\d{4}$/.test(tender.reference) && LIVE_TENDER_STATUSES.includes(tender.status)).map(
    (tender) => {
      const deadline = MILESTONES.find(
        (milestone) => milestone.tenderId === tender.id && milestone.lotId === null && milestone.milestone === 'submission_deadline',
      );
      return {
        tenantId: tender.tenantId,
        tenderId: tender.id,
        reference: tender.reference,
        title: tender.title,
        status: tender.status,
        submissionDeadline: deadline === undefined ? null : { at: deadline.at, timeZone: tender.officialTimeZone },
        publiclyVisible:
          tender.releasedAt !== null &&
          tender.participation === 'open' &&
          PORTAL_SETTINGS.some((portal) => portal.tenantId === tender.tenantId && portal.publicPortalEnabled),
      };
    },
  ),
);

export const LIVE_CONTRACTS: readonly FixtureLiveContract[] = Object.freeze(
  CONTRACTS.filter((contract) => LIVE_CONTRACT_STATUSES.includes(contract.status)).map((contract) => ({
    tenantId: contract.tenantId,
    contractId: contract.id,
    reference: contract.reference,
    title: contract.title,
    status: contract.status,
    supplierName: TENANTS.find((tenant) => tenant.id === contract.supplierTenantId)?.name ?? 'Unknown supplier',
    termEnd: contract.termEnd,
  })),
);

// ---------------------------------------------------------------------------------------------------------
// Onboarding (OPS-02)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureOnboardingItem {
  readonly id: number;
  readonly customerTenantId: number;
  readonly area: OnboardingItemArea;
  readonly title: string;
  readonly detail: string | null;
  readonly status: OnboardingItemStatus;
  readonly ownerUserId: number | null;
  readonly dueDate: string | null;
  readonly blocking: boolean;
  readonly resolvedAt: string | null;
  readonly note: string | null;
}

export const ONBOARDING_ITEMS: readonly FixtureOnboardingItem[] = Object.freeze([
  // KWU (pilot)
  {
    id: 101,
    customerTenantId: TENANT_IDS.kwu,
    area: 'setup',
    title: 'Organization identity and legal entity confirmed',
    detail: 'Kalahari Water Utilities Corporation, official time zone Africa/Gaborone, currency BWP.',
    status: 'done',
    ownerUserId: OPS_USERS.opsAdmin,
    dueDate: '2026-01-20',
    blocking: true,
    resolvedAt: '2026-01-16T09:00:00Z',
    note: null,
  },
  {
    id: 102,
    customerTenantId: TENANT_IDS.kwu,
    area: 'setup',
    title: 'Working calendar and procurement policy profile adopted',
    detail: 'Calendar "Botswana Public Holidays 2026" and policy profile "KWU procurement rules 2026".',
    status: 'done',
    ownerUserId: OPS_USERS.adminKwu,
    dueDate: '2026-02-15',
    blocking: true,
    resolvedAt: '2026-02-11T14:30:00Z',
    note: null,
  },
  {
    id: 103,
    customerTenantId: TENANT_IDS.kwu,
    area: 'ownership',
    title: 'Designated administrator identity verified',
    detail: 'Lorato Kgosi verified against the board resolution appointing the system administrator.',
    status: 'done',
    ownerUserId: OPS_USERS.opsAdmin,
    dueDate: '2026-01-20',
    blocking: true,
    resolvedAt: '2026-01-14T11:00:00Z',
    note: null,
  },
  {
    id: 104,
    customerTenantId: TENANT_IDS.kwu,
    area: 'ownership',
    title: 'Procurement, records and publication owners named',
    detail: 'Owners recorded in organization settings (ADM-01).',
    status: 'done',
    ownerUserId: OPS_USERS.adminKwu,
    dueDate: '2026-02-01',
    blocking: true,
    resolvedAt: '2026-01-29T08:45:00Z',
    note: null,
  },
  {
    id: 105,
    customerTenantId: TENANT_IDS.kwu,
    area: 'adoption',
    title: 'Evaluator training for the SCADA and leak-detection panels',
    detail: 'Two sessions on independent scoring, conflict declarations and moderation.',
    status: 'in_progress',
    ownerUserId: OPS_USERS.opsAdmin,
    dueDate: '2026-10-15',
    blocking: true,
    resolvedAt: null,
    note: 'First session held 22 Sep 2026 (9 attendees); second session booked for 13 Oct 2026.',
  },
  {
    id: 106,
    customerTenantId: TENANT_IDS.kwu,
    area: 'adoption',
    title: 'Supplier outreach: registration clinic in Francistown',
    detail: 'Help regional suppliers register and understand qualification before the Q4 pipeline.',
    status: 'open',
    ownerUserId: OPS_USERS.supportAgent,
    dueDate: '2026-11-05',
    blocking: false,
    resolvedAt: null,
    note: null,
  },
  {
    id: 107,
    customerTenantId: TENANT_IDS.kwu,
    area: 'issue',
    title: 'Gazette gateway rejects attachments above 5 MB',
    detail: 'External publication of T-2026-0002 addendum 1 failed (integration exception open). A size-aware manual fallback is being agreed with KWU.',
    status: 'blocked',
    ownerUserId: OPS_USERS.supportAgent,
    dueDate: '2026-10-09',
    blocking: true,
    resolvedAt: null,
    note: 'Waiting for the Gazette gateway provider to confirm the raised limit.',
  },
  {
    id: 108,
    customerTenantId: TENANT_IDS.kwu,
    area: 'setup',
    title: 'Single sign-on with the KWU staff directory',
    detail: 'Optional: KWU chose e-mail sign-in for the pilot.',
    status: 'not_applicable',
    ownerUserId: null,
    dueDate: null,
    blocking: false,
    resolvedAt: '2026-01-20T10:00:00Z',
    note: 'Revisit when moving from pilot to live.',
  },
  // ODC (offboarding)
  {
    id: 201,
    customerTenantId: TENANT_IDS.odc,
    area: 'setup',
    title: 'Organization identity and legal entity confirmed',
    detail: 'Okavango District Council, official time zone Africa/Gaborone, currency BWP.',
    status: 'done',
    ownerUserId: OPS_USERS.opsAdmin,
    dueDate: '2026-02-10',
    blocking: true,
    resolvedAt: '2026-02-06T09:30:00Z',
    note: null,
  },
  {
    id: 202,
    customerTenantId: TENANT_IDS.odc,
    area: 'ownership',
    title: 'Designated administrator identity verified',
    detail: 'Wame Olebile verified against the council resolution.',
    status: 'done',
    ownerUserId: OPS_USERS.opsAdmin,
    dueDate: '2026-02-10',
    blocking: true,
    resolvedAt: '2026-02-05T12:00:00Z',
    note: null,
  },
  {
    id: 203,
    customerTenantId: TENANT_IDS.odc,
    area: 'adoption',
    title: 'Procurement officer training',
    detail: 'Tender authoring, publication and opening.',
    status: 'done',
    ownerUserId: OPS_USERS.supportAgent,
    dueDate: '2026-03-31',
    blocking: true,
    resolvedAt: '2026-03-24T13:00:00Z',
    note: null,
  },
  {
    id: 204,
    customerTenantId: TENANT_IDS.odc,
    area: 'issue',
    title: 'Customer exit: continuity plan for T-2026-0011 and C-2025-0004',
    detail: 'ODC gave notice on 10 Sep 2026. The open tender and the active cleaning contract must continue under the offboarding plan.',
    status: 'in_progress',
    ownerUserId: OPS_USERS.opsAdmin,
    dueDate: '2026-10-31',
    blocking: true,
    resolvedAt: null,
    note: 'Draft plan shared with the council administrator on 25 Sep 2026.',
  },
] satisfies FixtureOnboardingItem[]);

/** The order in which onboarding stages advance. `offboarding` and `closed` follow the offboarding plan. */
export const ONBOARDING_STAGE_ORDER: readonly TenantsOnboardingStage[] = ['setup', 'configuring', 'pilot', 'live'];

// ---------------------------------------------------------------------------------------------------------
// Plans, subscriptions, entitlements, service actions and invoices (OPS-03)
// ---------------------------------------------------------------------------------------------------------

export const FEATURE_LABELS: Readonly<Record<EntitlementFeatureCode, { label: string; unit: string }>> = {
  named_users: { label: 'Named buyer users', unit: 'users' },
  legal_entities: { label: 'Legal entities', unit: 'entities' },
  published_events_per_year: { label: 'Published events per year', unit: 'events' },
  active_contracts: { label: 'Active contracts', unit: 'contracts' },
  storage_gb: { label: 'Document storage', unit: 'GB' },
  integrations: { label: 'Business integrations', unit: 'connections' },
  reporting_pack: { label: 'Management reporting pack', unit: 'pack' },
  onboarding_days: { label: 'Onboarding and training days', unit: 'days' },
};

export interface FixturePlanDefinition {
  readonly code: PlanCode;
  readonly name: string;
  readonly description: string;
  readonly annualFee: string;
  readonly limits: Readonly<Partial<Record<EntitlementFeatureCode, number | null>>>;
  readonly optionalServices: readonly string[];
}

export const PLAN_DEFINITIONS: readonly FixturePlanDefinition[] = Object.freeze([
  {
    code: 'pilot',
    name: 'Pilot',
    description: 'Twelve-month pilot for one legal entity with guided onboarding, before a live plan is chosen.',
    annualFee: '120000.00',
    limits: {
      named_users: 25,
      legal_entities: 1,
      published_events_per_year: 8,
      active_contracts: 20,
      storage_gb: 50,
      integrations: 3,
      onboarding_days: 15,
    },
    optionalServices: ['Supplier outreach clinics', 'Additional training days'],
  },
  {
    code: 'buyer_standard',
    name: 'Buyer Standard',
    description: 'For councils and agencies running up to 40 events a year with contract management.',
    annualFee: '180000.00',
    limits: {
      named_users: 15,
      legal_entities: 2,
      published_events_per_year: 40,
      active_contracts: 60,
      storage_gb: 100,
      integrations: 2,
      onboarding_days: 5,
    },
    optionalServices: ['Management reporting pack', 'Additional integrations', 'Records migration'],
  },
  {
    code: 'buyer_enterprise',
    name: 'Buyer Enterprise',
    description: 'For utilities and ministries with several legal entities, integrations and the reporting pack.',
    annualFee: '540000.00',
    limits: {
      named_users: 250,
      legal_entities: 10,
      published_events_per_year: null,
      active_contracts: null,
      storage_gb: 1000,
      integrations: 12,
      reporting_pack: null,
      onboarding_days: 30,
    },
    optionalServices: ['Dedicated service manager', 'Records migration', 'Custom integrations'],
  },
] satisfies FixturePlanDefinition[]);

export interface FixtureSubscription {
  readonly id: number;
  readonly customerTenantId: number;
  readonly planCode: PlanCode;
  readonly startsAt: string;
  readonly renewsAt: string | null;
  readonly status: SubscriptionsStatus;
  readonly commercialContact: string | null;
  /** The commercial contact's role mailbox (kept apart from the name). */
  readonly commercialContactEmail: string | null;
  readonly notes: string | null;
  readonly optionalServices: readonly string[];
}

export const SUBSCRIPTIONS: readonly FixtureSubscription[] = Object.freeze([
  {
    id: 1,
    customerTenantId: TENANT_IDS.kwu,
    planCode: 'pilot',
    startsAt: '2026-01-12T00:00:00Z',
    renewsAt: '2027-01-11T22:00:00Z',
    status: 'trial',
    commercialContact: 'Finance Manager, Kalahari Water Utilities',
    commercialContactEmail: 'finance@kwu.example',
    notes: 'Pilot pricing agreed for 12 months. Move to Buyer Enterprise is under discussion for 2027.',
    optionalServices: ['Supplier outreach clinics'],
  },
  {
    id: 2,
    customerTenantId: TENANT_IDS.odc,
    planCode: 'pilot',
    startsAt: '2026-02-02T00:00:00Z',
    renewsAt: null,
    status: 'ended',
    commercialContact: 'Council Treasurer, Okavango District Council',
    commercialContactEmail: 'treasury@odc.example',
    notes: 'Two-month pilot converted to Buyer Standard on 1 Apr 2026.',
    optionalServices: [],
  },
  {
    id: 3,
    customerTenantId: TENANT_IDS.odc,
    planCode: 'buyer_standard',
    startsAt: '2026-04-01T00:00:00Z',
    renewsAt: null,
    status: 'active',
    commercialContact: 'Council Treasurer, Okavango District Council',
    commercialContactEmail: 'treasury@odc.example',
    notes:
      'Notice of non-renewal received 10 Sep 2026: service ends 31 Dec 2026. Live events and contracts continue under the offboarding plan; no renewal is scheduled.',
    optionalServices: ['Records migration'],
  },
] satisfies FixtureSubscription[]);

export interface FixtureEntitlement {
  readonly subscriptionId: number;
  readonly featureCode: EntitlementFeatureCode;
  readonly limitValue: number | null;
  readonly usageValue: number;
}

export const ENTITLEMENTS: readonly FixtureEntitlement[] = Object.freeze([
  { subscriptionId: 1, featureCode: 'named_users', limitValue: 25, usageValue: 21 },
  { subscriptionId: 1, featureCode: 'legal_entities', limitValue: 1, usageValue: 1 },
  { subscriptionId: 1, featureCode: 'published_events_per_year', limitValue: 8, usageValue: publishedEventsIn(TENANT_IDS.kwu, DEMO_YEAR) },
  { subscriptionId: 1, featureCode: 'active_contracts', limitValue: 20, usageValue: 6 },
  { subscriptionId: 1, featureCode: 'storage_gb', limitValue: 50, usageValue: 18 },
  { subscriptionId: 1, featureCode: 'integrations', limitValue: 3, usageValue: 3 },
  { subscriptionId: 1, featureCode: 'onboarding_days', limitValue: 15, usageValue: 11 },
  { subscriptionId: 2, featureCode: 'named_users', limitValue: 5, usageValue: 2 },
  { subscriptionId: 2, featureCode: 'published_events_per_year', limitValue: 2, usageValue: 0 },
  { subscriptionId: 3, featureCode: 'named_users', limitValue: 15, usageValue: 2 },
  { subscriptionId: 3, featureCode: 'legal_entities', limitValue: 2, usageValue: 1 },
  { subscriptionId: 3, featureCode: 'published_events_per_year', limitValue: 40, usageValue: publishedEventsIn(TENANT_IDS.odc, DEMO_YEAR) },
  { subscriptionId: 3, featureCode: 'active_contracts', limitValue: 60, usageValue: 1 },
  { subscriptionId: 3, featureCode: 'storage_gb', limitValue: 100, usageValue: 3 },
  { subscriptionId: 3, featureCode: 'integrations', limitValue: 2, usageValue: 2 },
] satisfies FixtureEntitlement[]);

export interface FixtureServiceAction {
  readonly id: number;
  readonly subscriptionId: number;
  readonly featureCode: EntitlementFeatureCode;
  readonly description: string;
  readonly status: ServiceActionStatus;
  readonly ownerUserId: number | null;
  readonly raisedAt: string;
  readonly resolvedAt: string | null;
  readonly resolution: string | null;
}

export const SERVICE_ACTIONS: readonly FixtureServiceAction[] = Object.freeze([
  {
    id: 301,
    subscriptionId: 1,
    featureCode: 'published_events_per_year',
    description:
      'KWU published its 10th event of the pilot year (limit 8) on 21 Sep. Agree a plan change or an extra-events allowance. Publication and supplier submissions continue unaffected.',
    status: 'open',
    ownerUserId: OPS_USERS.opsAdmin,
    raisedAt: '2026-09-21T07:05:00Z',
    resolvedAt: null,
    resolution: null,
  },
  {
    id: 302,
    subscriptionId: 1,
    featureCode: 'integrations',
    description: 'KWU reached the pilot integration limit (3 of 3) when the finance connection was enabled.',
    status: 'in_progress',
    ownerUserId: OPS_USERS.opsAdmin,
    raisedAt: '2026-08-04T09:00:00Z',
    resolvedAt: null,
    resolution: null,
  },
  {
    id: 303,
    subscriptionId: 3,
    featureCode: 'integrations',
    description: 'ODC used both Buyer Standard integrations (Gazette notices and records transfer).',
    status: 'resolved',
    ownerUserId: OPS_USERS.opsAdmin,
    raisedAt: '2026-05-12T10:30:00Z',
    resolvedAt: '2026-05-20T08:00:00Z',
    resolution: 'ODC confirmed no further integrations are needed. No charge.',
  },
] satisfies FixtureServiceAction[]);

export interface FixtureInvoice {
  readonly id: number;
  readonly subscriptionId: number;
  readonly number: string;
  readonly periodLabel: string;
  readonly issuedOn: string;
  readonly dueOn: string;
  readonly amount: string;
  readonly status: InvoiceStatus;
  readonly disputeNote: string | null;
}

export const INVOICES: readonly FixtureInvoice[] = Object.freeze([
  {
    id: 401,
    subscriptionId: 1,
    number: 'INV-2026-0012',
    periodLabel: 'Pilot, Jan–Jun 2026',
    issuedOn: '2026-01-15',
    dueOn: '2026-02-14',
    amount: '60000.00',
    status: 'paid',
    disputeNote: null,
  },
  {
    id: 402,
    subscriptionId: 1,
    number: 'INV-2026-0031',
    periodLabel: 'Pilot, Jul–Dec 2026',
    issuedOn: '2026-07-01',
    dueOn: '2026-07-31',
    amount: '60000.00',
    status: 'paid',
    disputeNote: null,
  },
  {
    id: 403,
    subscriptionId: 1,
    number: 'INV-2026-0044',
    periodLabel: 'Supplier outreach clinic (Francistown)',
    issuedOn: '2026-09-20',
    dueOn: '2026-10-20',
    amount: '8500.00',
    status: 'issued',
    disputeNote: null,
  },
  {
    id: 404,
    subscriptionId: 3,
    number: 'INV-2026-0019',
    periodLabel: 'Buyer Standard, Apr–Sep 2026',
    issuedOn: '2026-04-01',
    dueOn: '2026-05-01',
    amount: '90000.00',
    status: 'paid',
    disputeNote: null,
  },
  {
    id: 405,
    subscriptionId: 3,
    number: 'INV-2026-0038',
    periodLabel: 'Buyer Standard, Oct 2026–Mar 2027',
    issuedOn: '2026-09-01',
    dueOn: '2026-10-01',
    amount: '90000.00',
    status: 'disputed',
    disputeNote:
      'ODC disputes the charge for Jan–Mar 2027 after its notice of non-renewal. A pro-rata credit note for three months is proposed; the dispute does not affect T-2026-0011 or C-2025-0004.',
  },
] satisfies FixtureInvoice[]);

// ---------------------------------------------------------------------------------------------------------
// Offboarding plans and exit exports (OPS-02, ADM-17, AC-36)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureExitExport {
  readonly id: number;
  readonly customerTenantId: number;
  readonly format: ExportsFormat;
  readonly status: ExportsStatus;
  readonly requestedAt: string;
  readonly requestedByUserId: number;
  readonly completedAt: string | null;
  readonly contents: readonly string[];
  readonly omissions: readonly string[];
}

export const EXIT_EXPORTS: readonly FixtureExitExport[] = Object.freeze([
  {
    id: 3101,
    customerTenantId: TENANT_IDS.odc,
    format: 'xlsx',
    status: 'ready',
    requestedAt: '2026-09-18T08:00:00Z',
    requestedByUserId: OPS_USERS.adminOdc,
    completedAt: '2026-09-18T08:21:00Z',
    contents: [
      'Closed and cancelled events with notices, clarifications and addenda (2026)',
      'Opening records and evaluation reports of completed events',
      'Contracts register with obligations, changes and performance reviews',
      'Supplier relationships and qualification decisions',
      'Audit trail of business actions (2026)',
    ],
    omissions: [
      'T-2026-0011 (open): exported after closing under the continuity plan',
      'Sealed bid content of any event before opening',
      'Personal preferences and sign-in history of individual users',
    ],
  },
] satisfies FixtureExitExport[]);

export interface FixtureOffboardingPlan {
  readonly id: number;
  readonly customerTenantId: number;
  readonly status: OffboardingPlansStatus;
  readonly reason: string;
  readonly serviceEndDate: string;
  readonly continuityPlan: string | null;
  readonly supplierAccessPlan: string | null;
  readonly retentionResponsibilities: string | null;
  readonly disposalTimetable: string | null;
  readonly exportRequestId: number | null;
  readonly agreedByCustomerAt: string | null;
  readonly ownerUserId: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const OFFBOARDING_PLANS: readonly FixtureOffboardingPlan[] = Object.freeze([
  {
    id: 1,
    customerTenantId: TENANT_IDS.odc,
    status: 'draft',
    reason: 'The council moves procurement to the national shared e-procurement service from January 2027.',
    serviceEndDate: '2026-12-31',
    continuityPlan:
      'T-2026-0011 Office cleaning services stays open until its official deadline (21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone) and is opened, evaluated and awarded in TenderIQ. ODC keeps full access until the award decision and any standstill end. Contract C-2025-0004 continues to be managed in TenderIQ until 31 Dec 2026, then transfers to the council records system with its obligations and open performance items.',
    supplierAccessPlan:
      'Suppliers who responded to T-2026-0011 keep access to their own submissions, receipts and notices until 30 Jun 2027. Limpopo Environmental Services keeps read access to C-2025-0004 contract records until the transfer is confirmed.',
    retentionResponsibilities:
      'ODC becomes the records owner of every exported record from the transfer date. TenderIQ retains the audit log and receipts for 7 years unless ODC confirms receipt of an equivalent evidence pack.',
    disposalTimetable:
      'After ODC confirms the final export (planned 15 Jan 2027), TenderIQ disposes of the customer data by 31 Mar 2027, except records under legal hold or needed by a live complaint.',
    exportRequestId: 3101,
    agreedByCustomerAt: null,
    ownerUserId: OPS_USERS.opsAdmin,
    createdAt: '2026-09-12T09:00:00Z',
    updatedAt: '2026-09-25T15:20:00Z',
  },
] satisfies FixtureOffboardingPlan[]);
