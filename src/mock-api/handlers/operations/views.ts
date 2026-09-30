/**
 * Projections of the operations fixtures onto the operations contract, shared by the operator, buyer, personal and
 * public handlers. Pure functions over static rows; `now` is always the request time.
 */
import type {
  ActivityEntry,
  CustomerDetail,
  CustomerLabel,
  CustomerRow,
  CustomerStatusLabel,
  EntitlementUsage,
  ExitExport,
  IncidentDetail,
  IncidentRow,
  Invoice,
  LiveContract,
  LiveEvent,
  OffboardingPlanDetail,
  OffboardingPlanRow,
  OnboardingItem,
  OnboardingView,
  ReadinessCheck,
  ServiceAction,
  SubscriptionDetail,
  SubscriptionRow,
  SupportCaseDetail,
  SupportCaseMessage,
  SupportCaseRow,
  SupportGrant,
} from '../../../contracts/operations.js';
import type { OffboardingPlansStatus, SupportAccessGrantsStatus, TenantsOnboardingStage } from '../../../contracts/enums.js';
import type { PersonRef } from '../../../contracts/common.js';
import { PERSONAS } from '../../fixtures/platform.js';
import type { FixtureTenant } from '../../fixtures/platform.js';
import {
  CUSTOMER_TENANTS,
  ENTITLEMENTS,
  EXIT_EXPORTS,
  FEATURE_LABELS,
  INVOICES,
  LIVE_CONTRACTS,
  LIVE_EVENTS,
  OFFBOARDING_PLANS,
  ONBOARDING_ITEMS,
  ONBOARDING_STAGE_ORDER,
  PLAN_DEFINITIONS,
  SERVICE_ACTIONS,
  SERVICE_INCIDENTS,
  SERVICE_INCIDENT_IMPACTS,
  SERVICE_INCIDENT_UPDATES,
  SUBSCRIPTIONS,
  SUPPORT_ACCESS_GRANTS,
  SUPPORT_ACTIVITY,
  SUPPORT_CASES,
  SUPPORT_CASE_MESSAGES,
  SUPPORT_GRANT_LIMITS,
  activeContractCount,
  activeMemberCount,
  customerProfileOf,
} from '../../fixtures/operations/index.js';
import type {
  FixtureExitExport,
  FixtureOffboardingPlan,
  FixtureServiceAction,
  FixtureServiceIncident,
  FixtureSubscription,
  FixtureSupportAccessGrant,
  FixtureSupportCase,
} from '../../fixtures/operations/index.js';
import { findTenantById, personRef } from '../../persona.js';

// ---------------------------------------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------------------------------------

/** Case-insensitive match of `q` against any of the texts (an absent or empty `q` matches everything). */
export function matchesText(q: string | undefined, ...texts: ReadonlyArray<string | null | undefined>): boolean {
  if (q === undefined || q.length === 0) return true;
  const needle = q.toLowerCase();
  return texts.some((text) => text !== null && text !== undefined && text.toLowerCase().includes(needle));
}

/** Whether an ISO instant or date lies within optional calendar-date bounds (inclusive, UTC dates). */
export function withinDates(value: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) return true;
  if (value === null) return false;
  const day = value.slice(0, 10);
  if (from !== undefined && day < from) return false;
  if (to !== undefined && day > to) return false;
  return true;
}

type SortValue = string | number | boolean | null;

/** Sorts a copy of `rows` by `pick`; nulls sort last in both directions. */
export function sortRows<T>(rows: readonly T[], pick: (row: T) => SortValue, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = pick(left);
    const b = pick(right);
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
    return String(a).localeCompare(String(b)) * factor;
  });
}

/** A person reference, or `null`. */
export function personOrNull(userId: number | null): PersonRef | null {
  return userId === null ? null : personRef(userId);
}

/** Whether the user is a platform operator (holds a membership of the operator tenant). */
export function isOperatorUser(userId: number): boolean {
  return PERSONAS.some(
    (persona) =>
      persona.userId === userId &&
      persona.isPlatformOperator &&
      persona.memberships.some((membership) => membership.status === 'active' && findTenantById(membership.tenantId)?.kind === 'operator'),
  );
}

/** Whether the user holds an active membership of the tenant. */
export function isActiveMember(userId: number, tenantId: number): boolean {
  return PERSONAS.some(
    (persona) =>
      persona.userId === userId &&
      persona.status === 'active' &&
      persona.memberships.some((membership) => membership.tenantId === tenantId && membership.status === 'active'),
  );
}

/** The instant `days` after `from`. */
export function addDays(from: Date, days: number): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** An ISO instant without milliseconds. */
export function isoNow(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------------------------------------

function requireTenant(tenantId: number): FixtureTenant {
  const tenant = findTenantById(tenantId);
  if (tenant === undefined) {
    throw new Error(`Operations fixture names unknown tenant ${tenantId}.`);
  }
  return tenant;
}

export function customerLabel(tenantId: number): CustomerLabel {
  const tenant = requireTenant(tenantId);
  return { tenantId: tenant.id, slug: tenant.slug, name: tenant.name, kind: tenant.kind };
}

export function customerStatusLabel(tenantId: number): CustomerStatusLabel {
  const tenant = requireTenant(tenantId);
  return { ...customerLabel(tenantId), status: tenant.status };
}

/** Live events of a tenant as the customer itself sees them (ADM-17): full detail. */
export function liveEventsOf(tenantId: number): LiveEvent[] {
  return LIVE_EVENTS.filter((event) => event.tenantId === tenantId).map(({ tenantId: _tenantId, publiclyVisible: _public, ...event }) => ({
    ...event,
    withheld: false,
    submissionDeadline: event.submissionDeadline === null ? null : { ...event.submissionDeadline },
  }));
}

/** Live contracts of a tenant as the customer itself sees them (ADM-17): full detail. */
export function liveContractsOf(tenantId: number): LiveContract[] {
  return LIVE_CONTRACTS.filter((contract) => contract.tenantId === tenantId).map(({ tenantId: _tenantId, ...contract }) => ({
    ...contract,
    withheld: false,
  }));
}

/**
 * Live events as an operator sees them (OPS-01, OPS-02, offboarding plans): public visibility only (PRD §4.3).
 * Events the public cannot see (invitation-only, restricted, unreleased) keep reference, status and official
 * deadline; the title is withheld.
 */
export function operatorLiveEventsOf(tenantId: number): LiveEvent[] {
  return LIVE_EVENTS.filter((event) => event.tenantId === tenantId).map(({ tenantId: _tenantId, publiclyVisible, ...event }) => ({
    ...event,
    title: publiclyVisible ? event.title : null,
    withheld: !publiclyVisible,
    submissionDeadline: event.submissionDeadline === null ? null : { ...event.submissionDeadline },
  }));
}

/** Whether an active support access grant of the customer names the contract (`contract:<reference>`). */
export function contractCoveredByGrant(tenantId: number, contractReference: string, now: Date): boolean {
  return SUPPORT_ACCESS_GRANTS.some(
    (grant) =>
      grant.customerTenantId === tenantId &&
      grant.scope === 'specific_records' &&
      grantStatusAt(grant, now) === 'active' &&
      grant.recordRefs.includes(`contract:${contractReference}`),
  );
}

/**
 * Live contracts as an operator sees them: contract records are "no automatic access" (PRD §4.3), so only
 * reference, status and term end, unless an active support grant of the customer covers the contract.
 */
export function operatorLiveContractsOf(tenantId: number, now: Date): LiveContract[] {
  return LIVE_CONTRACTS.filter((contract) => contract.tenantId === tenantId).map(({ tenantId: _tenantId, ...contract }) => {
    const covered = contractCoveredByGrant(tenantId, contract.reference, now);
    return {
      ...contract,
      title: covered ? contract.title : null,
      supplierName: covered ? contract.supplierName : null,
      withheld: !covered,
    };
  });
}

/** Who reads an offboarding plan: the customer (full detail) or an operator at a time (withheld content). */
export type ObligationViewer = { readonly kind: 'customer' } | { readonly kind: 'operator'; readonly now: Date };

export const CUSTOMER_VIEWER: ObligationViewer = Object.freeze({ kind: 'customer' });

export function operatorViewer(now: Date): ObligationViewer {
  return { kind: 'operator', now };
}

function obligationsFor(tenantId: number, viewer: ObligationViewer): { events: LiveEvent[]; contracts: LiveContract[] } {
  return viewer.kind === 'customer'
    ? { events: liveEventsOf(tenantId), contracts: liveContractsOf(tenantId) }
    : { events: operatorLiveEventsOf(tenantId), contracts: operatorLiveContractsOf(tenantId, viewer.now) };
}

/** Active members of a tenant (active person, active membership). */
/** Active users of a customer as the customer's own member register counts them (ADM-03). */
export function activeUserCount(tenantId: number): number {
  return activeMemberCount(tenantId);
}

/** Contracts in the `active` status (CON-01); suppliers hold no contracts of their own on the platform. */
export function activeContractUsage(tenant: FixtureTenant): number {
  return tenant.kind === 'buyer' ? activeContractCount(tenant.id) : 0;
}

export const OPEN_CASE_STATUSES = ['open', 'in_progress', 'awaiting_customer'] as const;

export function openCaseCount(tenantId: number): number {
  return SUPPORT_CASES.filter(
    (row) => row.customerTenantId === tenantId && (OPEN_CASE_STATUSES as readonly string[]).includes(row.status),
  ).length;
}

/** The display status of a grant at `now`: an active grant past its expiry reads `expired` (DD-18). */
export function grantStatusAt(grant: FixtureSupportAccessGrant, now: Date): SupportAccessGrantsStatus {
  if (grant.status === 'active' && grant.expiresAt !== null && Date.parse(grant.expiresAt) <= now.getTime()) {
    return 'expired';
  }
  return grant.status;
}

export function activeGrantCount(tenantId: number, now: Date): number {
  return SUPPORT_ACCESS_GRANTS.filter((grant) => grant.customerTenantId === tenantId && grantStatusAt(grant, now) === 'active').length;
}

export function currentSubscriptionOf(tenantId: number): FixtureSubscription | undefined {
  const rows = SUBSCRIPTIONS.filter((row) => row.customerTenantId === tenantId);
  return rows.find((row) => row.status !== 'ended' && row.status !== 'cancelled') ?? rows[rows.length - 1];
}

/** Whether the customer agreed an offboarding (continuity) plan. */
export function hasAgreedPlan(tenantId: number): boolean {
  const plan = offboardingPlanOf(tenantId);
  return plan !== undefined && plan.agreedByCustomerAt !== null && plan.status !== 'draft';
}

/** Whether the customer has live events or contracts. */
export function hasLiveObligations(tenantId: number): boolean {
  return liveEventsOf(tenantId).length + liveContractsOf(tenantId).length > 0;
}

export function offboardingPlanOf(tenantId: number): FixtureOffboardingPlan | undefined {
  return OFFBOARDING_PLANS.find((plan) => plan.customerTenantId === tenantId);
}

export function customerRow(tenant: FixtureTenant, now: Date): CustomerRow {
  const profile = customerProfileOf(tenant.id);
  if (profile === undefined || tenant.kind === 'operator') {
    throw new Error(`Tenant ${tenant.id} is not a customer.`);
  }
  const subscription = currentSubscriptionOf(tenant.id);
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    kind: tenant.kind,
    name: tenant.name,
    legalName: tenant.legalName,
    status: tenant.status,
    onboardingStage: profile.onboardingStage,
    planCode: profile.planCode,
    subscriptionStatus: subscription?.status ?? null,
    serviceOwner: personOrNull(profile.serviceOwnerUserId),
    administrators: profile.administratorUserIds.map((userId) => personRef(userId)),
    openSupportCases: openCaseCount(tenant.id),
    activeSupportGrants: activeGrantCount(tenant.id, now),
    createdAt: tenant.createdAt,
  };
}

export const CONTENT_ACCESS_NOTE =
  'Operators see customer identity, service arrangements and counts only. Tender content, bids, evaluation and supplier evidence stay inside the customer organization; support reads them only under a customer-authorized, time-limited grant.';

export function customerDetail(tenant: FixtureTenant, now: Date): CustomerDetail {
  const profile = customerProfileOf(tenant.id);
  if (profile === undefined) {
    throw new Error(`Tenant ${tenant.id} has no customer profile.`);
  }
  const events = operatorLiveEventsOf(tenant.id);
  const contracts = operatorLiveContractsOf(tenant.id, now);
  const subscription = currentSubscriptionOf(tenant.id);
  return {
    ...customerRow(tenant, now),
    tradingName: profile.tradingName,
    country: profile.country,
    registrationNumber: profile.registrationNumber,
    officialTimeZone: tenant.officialTimeZone,
    defaultCurrency: tenant.defaultCurrency,
    workingLanguages: [...tenant.workingLanguages],
    usage: {
      activeUsers: activeUserCount(tenant.id),
      publishedEventsYtd: profile.publishedEventsYtd,
      liveEvents: events.length,
      activeContracts: activeContractUsage(tenant),
      storageUsedGb: profile.storageUsedGb,
      lastActivityAt: profile.lastActivityAt,
    },
    liveEvents: tenant.kind === 'buyer' ? events : [],
    liveContracts: tenant.kind === 'buyer' ? contracts : [],
    subscriptionId: subscription?.id ?? null,
    offboardingPlanId: offboardingPlanOf(tenant.id)?.id ?? null,
    contentAccessNote: CONTENT_ACCESS_NOTE,
  };
}

export function allCustomers(): readonly FixtureTenant[] {
  return CUSTOMER_TENANTS;
}

// ---------------------------------------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------------------------------------

export function onboardingItemView(item: (typeof ONBOARDING_ITEMS)[number]): OnboardingItem {
  return {
    id: item.id,
    area: item.area,
    title: item.title,
    detail: item.detail,
    status: item.status,
    owner: personOrNull(item.ownerUserId),
    dueDate: item.dueDate,
    blocking: item.blocking,
    resolvedAt: item.resolvedAt,
    note: item.note,
  };
}

/** The next onboarding stage, or `null` when live or leaving. */
export function nextOnboardingStage(stage: TenantsOnboardingStage): TenantsOnboardingStage | null {
  const index = ONBOARDING_STAGE_ORDER.indexOf(stage);
  if (index < 0 || index === ONBOARDING_STAGE_ORDER.length - 1) return null;
  return ONBOARDING_STAGE_ORDER[index + 1] ?? null;
}

export function openBlockingItems(items: readonly OnboardingItem[]): OnboardingItem[] {
  return items.filter((item) => item.blocking && item.status !== 'done' && item.status !== 'not_applicable');
}

export function onboardingView(tenant: FixtureTenant, items: readonly OnboardingItem[], stage: TenantsOnboardingStage): OnboardingView {
  const profile = customerProfileOf(tenant.id);
  const blocking = openBlockingItems(items);
  const readiness: ReadinessCheck[] = [
    ...blocking.map((item) => ({
      id: `item-${item.id}`,
      label: item.title,
      detail: item.status === 'blocked' ? `Blocked: ${item.note ?? 'see the item note'}` : `Still ${item.status.replace('_', ' ')}.`,
      status: 'blocking' as const,
    })),
    ...items
      .filter((item) => !item.blocking && item.status !== 'done' && item.status !== 'not_applicable')
      .map((item) => ({ id: `item-${item.id}`, label: item.title, detail: 'Optional; does not block the next stage.', status: 'warning' as const })),
  ];
  if (readiness.length === 0) {
    readiness.push({ id: 'all-done', label: 'Every onboarding item is done', detail: null, status: 'passed' });
  }
  return {
    customer: customerStatusLabel(tenant.id),
    stage,
    nextStage: nextOnboardingStage(stage),
    items: [...items],
    readiness,
    serviceOwner: personOrNull(profile?.serviceOwnerUserId ?? null),
    administrators: (profile?.administratorUserIds ?? []).map((userId) => personRef(userId)),
  };
}

export function onboardingItemsOf(tenantId: number): OnboardingItem[] {
  return ONBOARDING_ITEMS.filter((item) => item.customerTenantId === tenantId).map(onboardingItemView);
}

// ---------------------------------------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------------------------------------

export function planName(code: string): string {
  return PLAN_DEFINITIONS.find((plan) => plan.code === code)?.name ?? code;
}

export function entitlementsOf(subscriptionId: number): EntitlementUsage[] {
  return ENTITLEMENTS.filter((row) => row.subscriptionId === subscriptionId).map((row) => ({
    featureCode: row.featureCode,
    label: FEATURE_LABELS[row.featureCode].label,
    unit: FEATURE_LABELS[row.featureCode].unit,
    limitValue: row.limitValue,
    usageValue: row.usageValue,
    limitReached: row.limitValue !== null && row.usageValue >= row.limitValue,
  }));
}

export function serviceActionView(action: FixtureServiceAction): ServiceAction {
  return {
    id: action.id,
    featureCode: action.featureCode,
    description: action.description,
    status: action.status,
    owner: personOrNull(action.ownerUserId),
    raisedAt: action.raisedAt,
    resolvedAt: action.resolvedAt,
    resolution: action.resolution,
    blocksSubmissions: false,
  };
}

export function serviceActionsOf(subscriptionId: number): ServiceAction[] {
  return SERVICE_ACTIONS.filter((row) => row.subscriptionId === subscriptionId).map(serviceActionView);
}

export function invoicesOf(subscriptionId: number): Invoice[] {
  return INVOICES.filter((row) => row.subscriptionId === subscriptionId).map((row) => ({
    id: row.id,
    number: row.number,
    periodLabel: row.periodLabel,
    issuedOn: row.issuedOn,
    dueOn: row.dueOn,
    amount: { amount: row.amount, currency: 'BWP' },
    status: row.status,
    disputeNote: row.disputeNote,
  }));
}

export function subscriptionRow(subscription: FixtureSubscription): SubscriptionRow {
  return {
    id: subscription.id,
    customer: customerStatusLabel(subscription.customerTenantId),
    planCode: subscription.planCode,
    status: subscription.status,
    startsAt: subscription.startsAt,
    renewsAt: subscription.renewsAt,
    commercialContact: subscription.commercialContact,
    commercialContactEmail: subscription.commercialContactEmail,
    openServiceActions: SERVICE_ACTIONS.filter((row) => row.subscriptionId === subscription.id && row.status !== 'resolved').length,
    disputedInvoices: INVOICES.filter((row) => row.subscriptionId === subscription.id && row.status === 'disputed').length,
  };
}

export const ENTITLEMENT_RULE =
  'Entitlements never change competition results, supplier eligibility or an invited supplier’s ability to submit. Reaching a limit creates a service action for the account team.';

export function subscriptionDetail(subscription: FixtureSubscription): SubscriptionDetail {
  return {
    ...subscriptionRow(subscription),
    notes: subscription.notes,
    entitlements: entitlementsOf(subscription.id),
    serviceActions: serviceActionsOf(subscription.id),
    invoices: invoicesOf(subscription.id),
    optionalServices: [...subscription.optionalServices],
    entitlementRule: ENTITLEMENT_RULE,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Offboarding
// ---------------------------------------------------------------------------------------------------------

export function exitExportView(row: FixtureExitExport): ExitExport {
  return {
    id: row.id,
    format: row.format,
    status: row.status,
    requestedAt: row.requestedAt,
    requestedBy: personRef(row.requestedByUserId),
    completedAt: row.completedAt,
    contents: [...row.contents],
    omissions: [...row.omissions],
  };
}

export function exitExportsOf(tenantId: number): ExitExport[] {
  return EXIT_EXPORTS.filter((row) => row.customerTenantId === tenantId).map(exitExportView);
}

const NEXT_PLAN_STATUS: Readonly<Record<OffboardingPlansStatus, OffboardingPlansStatus | null>> = {
  draft: 'agreed',
  agreed: 'in_progress',
  in_progress: 'completed',
  completed: null,
};

export function nextPlanStatus(status: OffboardingPlansStatus): OffboardingPlansStatus | null {
  return NEXT_PLAN_STATUS[status];
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

/** Whether the continuity sections a customer must agree are written. */
export function planSectionsComplete(plan: FixtureOffboardingPlan): boolean {
  return hasText(plan.continuityPlan) && hasText(plan.supplierAccessPlan) && hasText(plan.retentionResponsibilities);
}

export function offboardingReadiness(plan: FixtureOffboardingPlan): ReadinessCheck[] {
  const events = liveEventsOf(plan.customerTenantId);
  const contracts = liveContractsOf(plan.customerTenantId);
  const exportRow = EXIT_EXPORTS.find((row) => row.id === plan.exportRequestId);
  const subscription = currentSubscriptionOf(plan.customerTenantId);
  const disputed = subscription === undefined ? 0 : INVOICES.filter((row) => row.subscriptionId === subscription.id && row.status === 'disputed').length;
  const section = (id: string, label: string, value: string | null, missing: 'blocking' | 'warning'): ReadinessCheck => ({
    id,
    label,
    detail: hasText(value) ? null : 'Not written yet.',
    status: hasText(value) ? 'passed' : missing,
  });
  return [
    section('continuity', 'Continuity plan for live events and contracts', plan.continuityPlan, 'blocking'),
    section('supplier-access', 'Supplier access after exit', plan.supplierAccessPlan, 'blocking'),
    section('retention', 'Retention responsibilities', plan.retentionResponsibilities, 'blocking'),
    section('disposal', 'Disposal timetable', plan.disposalTimetable, 'warning'),
    {
      id: 'export',
      label: 'Exit export package',
      detail:
        exportRow === undefined
          ? 'No export requested yet.'
          : exportRow.status === 'ready'
            ? `Export ${exportRow.id} is ready (${exportRow.format.toUpperCase()}).`
            : `Export ${exportRow.id} is ${exportRow.status}.`,
      status: exportRow === undefined ? 'blocking' : exportRow.status === 'ready' ? 'passed' : 'warning',
    },
    {
      id: 'customer-agreement',
      label: 'Customer agreement',
      detail: plan.agreedByCustomerAt === null ? 'The customer administrator has not agreed the plan yet.' : null,
      status: plan.agreedByCustomerAt === null ? 'blocking' : 'passed',
    },
    {
      id: 'live-obligations',
      label: 'Live events and contracts',
      detail:
        events.length + contracts.length === 0
          ? null
          : `${events.length} live event(s) and ${contracts.length} live contract(s) continue under the continuity plan; the plan cannot be completed until they are finished or transferred.`,
      status: events.length + contracts.length === 0 ? 'passed' : 'warning',
    },
    {
      id: 'commercial',
      label: 'Commercial account',
      detail: disputed === 0 ? null : `${disputed} disputed invoice(s). A dispute never affects live events or contracts.`,
      status: disputed === 0 ? 'passed' : 'warning',
    },
  ];
}

export function offboardingRow(plan: FixtureOffboardingPlan): OffboardingPlanRow {
  return {
    id: plan.id,
    customer: customerStatusLabel(plan.customerTenantId),
    status: plan.status,
    activeEventsCount: liveEventsOf(plan.customerTenantId).length,
    activeContractsCount: liveContractsOf(plan.customerTenantId).length,
    serviceEndDate: plan.serviceEndDate,
    agreedByCustomerAt: plan.agreedByCustomerAt,
    owner: personOrNull(plan.ownerUserId),
    updatedAt: plan.updatedAt,
  };
}

export function offboardingDetail(plan: FixtureOffboardingPlan, viewer: ObligationViewer): OffboardingPlanDetail {
  const exportRow = EXIT_EXPORTS.find((row) => row.id === plan.exportRequestId);
  const obligations = obligationsFor(plan.customerTenantId, viewer);
  return {
    ...offboardingRow(plan),
    reason: plan.reason,
    continuityPlan: plan.continuityPlan,
    supplierAccessPlan: plan.supplierAccessPlan,
    retentionResponsibilities: plan.retentionResponsibilities,
    disposalTimetable: plan.disposalTimetable,
    liveEvents: obligations.events,
    liveContracts: obligations.contracts,
    exportRequest: exportRow === undefined ? null : exitExportView(exportRow),
    readiness: offboardingReadiness(plan),
    nextStatus: nextPlanStatus(plan.status),
    createdAt: plan.createdAt,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------------------------------------

/** The reference of a support case (every grant names an existing case; a fixture test checks it). */
export function caseReferenceOf(caseId: number): string {
  const supportCase = SUPPORT_CASES.find((row) => row.id === caseId);
  if (supportCase === undefined) {
    throw new Error(`Support grant names unknown case ${caseId}.`);
  }
  return supportCase.reference;
}

export function grantView(grant: FixtureSupportAccessGrant, now: Date): SupportGrant {
  return {
    id: grant.id,
    caseId: grant.caseId,
    caseReference: caseReferenceOf(grant.caseId),
    customer: customerLabel(grant.customerTenantId),
    operator: personRef(grant.operatorUserId),
    authorizedBy: personOrNull(grant.authorizedByUserId),
    businessNeed: grant.businessNeed,
    scope: grant.scope,
    recordRefs: [...grant.recordRefs],
    requestedAt: grant.requestedAt,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
    status: grantStatusAt(grant, now),
    statusReason: grant.statusReason,
    limits: [...SUPPORT_GRANT_LIMITS],
  };
}

export function caseMessages(caseId: number, includeInternal: boolean): SupportCaseMessage[] {
  return SUPPORT_CASE_MESSAGES.filter((message) => message.caseId === caseId && (includeInternal || !message.internal)).map((message) => ({
    id: message.id,
    author: personRef(message.authorUserId),
    authorSide: isOperatorUser(message.authorUserId) ? 'operator' : 'customer',
    body: message.body,
    internal: message.internal,
    createdAt: message.createdAt,
  }));
}

export function activityView(entry: { id: number; at: string; actorUserId: number | null; action: string; description: string }): ActivityEntry {
  return { id: entry.id, at: entry.at, actor: personOrNull(entry.actorUserId), action: entry.action, description: entry.description };
}

export function caseRow(row: FixtureSupportCase, now: Date): SupportCaseRow {
  return {
    id: row.id,
    reference: row.reference,
    customer: customerLabel(row.customerTenantId),
    openedBy: personRef(row.openedByUserId),
    category: row.category,
    subject: row.subject,
    status: row.status,
    assignedOperator: personOrNull(row.assignedOperatorUserId),
    routedTo: row.routedToTenantId === null ? null : customerLabel(row.routedToTenantId),
    activeGrant: SUPPORT_ACCESS_GRANTS.some((grant) => grant.caseId === row.id && grantStatusAt(grant, now) === 'active'),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
  };
}

export function isCaseClosed(row: Pick<FixtureSupportCase, 'status'>): boolean {
  return row.status === 'closed';
}

export function caseDetail(row: FixtureSupportCase, now: Date): SupportCaseDetail {
  const closed = isCaseClosed(row);
  const grants = SUPPORT_ACCESS_GRANTS.filter((grant) => grant.caseId === row.id).map((grant) => grantView(grant, now));
  return {
    ...caseRow(row, now),
    description: row.description,
    resolution: row.resolution,
    messages: caseMessages(row.id, true),
    grants,
    activity: SUPPORT_ACTIVITY.filter((entry) => entry.caseId === row.id)
      .map(activityView)
      .sort((a, b) => a.at.localeCompare(b.at)),
    capabilities: {
      canRequestAccess:
        !closed &&
        row.status !== 'routed_to_buyer' &&
        !grants.some((grant) => grant.status === 'active' || grant.status === 'requested' || grant.status === 'authorized'),
      canRouteToBuyer: !closed && row.status !== 'routed_to_buyer',
      canResolve: !closed && row.status !== 'resolved' && row.category !== 'procurement_merits',
    },
  };
}

export function findCase(caseId: number): FixtureSupportCase | undefined {
  return SUPPORT_CASES.find((row) => row.id === caseId);
}

// ---------------------------------------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------------------------------------

export function incidentRow(incident: FixtureServiceIncident): IncidentRow {
  const impacts = SERVICE_INCIDENT_IMPACTS.filter((impact) => impact.incidentId === incident.id);
  return {
    id: incident.id,
    reference: incident.reference,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    affectedCustomers: new Set(impacts.map((impact) => impact.customerTenantId)).size,
    affectedEvents: impacts.filter((impact) => impact.tenderId !== null).length,
    pendingBuyerDecisions: impacts.filter((impact) => impact.tenderId !== null && impact.buyerDecisionNote === null).length,
  };
}

export const INCIDENT_DECISION_RULE =
  'The operator records incident timing and affected actions. The responsible buyer decides whether any deadline is extended or an event restarted, and notifies every affected participant.';

export function incidentDetail(incident: FixtureServiceIncident): IncidentDetail {
  return {
    ...incidentRow(incident),
    description: incident.description,
    customerNotice: incident.customerNotice,
    impacts: SERVICE_INCIDENT_IMPACTS.filter((impact) => impact.incidentId === incident.id).map((impact) => ({
      id: impact.id,
      customer: customerLabel(impact.customerTenantId),
      tenderId: impact.tenderId,
      tenderReference: impact.tenderReference,
      impactNote: impact.impactNote,
      buyerDecisionNote: impact.buyerDecisionNote,
    })),
    timeline: SERVICE_INCIDENT_UPDATES.filter((update) => update.incidentId === incident.id)
      .map((update) => activityView({ ...update, actorUserId: update.authorUserId }))
      .sort((a, b) => a.at.localeCompare(b.at)),
    decisionRule: INCIDENT_DECISION_RULE,
  };
}

export function findIncident(incidentId: number): FixtureServiceIncident | undefined {
  return SERVICE_INCIDENTS.find((row) => row.id === incidentId);
}
