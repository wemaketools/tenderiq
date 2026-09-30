/**
 * Operator customer management: the customer register (OPS-01), onboarding and offboarding (OPS-02, AC-36) and
 * plans, entitlements and commercial accounts (OPS-03). Blueprint: `tenants` (plan_code, service_owner_user_id,
 * onboarding_stage), `subscriptions`, `entitlements`, `offboarding_plans` and `exports` (customer_exit).
 *
 * Rules the contract carries (Stage B enforces them):
 * - No automatic visibility of customer tender content: customer views carry identity, plan, counts and the
 *   references of live obligations only (OPS-01, PRD §4.3).
 * - A commercial account change never strands bidders: suspending or closing a customer, or ending its
 *   subscription, with live events or contracts requires an agreed continuity (offboarding) plan (BR-47, AC-36,
 *   `CONTINUITY_PLAN_REQUIRED`).
 * - Reaching a usage limit creates a service action and never blocks an invited supplier's submission (PRD §21.1).
 * - Entitlements never change competition results or supplier eligibility (OPS-03, BR-46).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  CurrencyCode,
  Id,
  IdParam,
  Instant,
  Money,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  Slug,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  ContractsStatus,
  ExportsFormat,
  ExportsStatus,
  OffboardingPlansStatus,
  SubscriptionsStatus,
  TendersStatus,
  TenantsOnboardingStage,
  TenantsStatus,
} from '../enums.js';
import { OFFBOARDING_PLANS_STATUS, SUBSCRIPTIONS_STATUS, TENANTS_ONBOARDING_STAGE } from '../enums.js';
import {
  CustomerStatusLabel,
  EntitlementFeatureCode,
  InvoiceStatus,
  NoteText,
  OnboardingItemArea,
  OnboardingItemStatus,
  PlanCode,
  ReadinessCheck,
  ServiceActionStatus,
  choice,
  optionalText,
} from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Customers (OPS-01)
// ---------------------------------------------------------------------------------------------------------

/** Customer kinds in the register (the operator tenant is never a customer). */
export const CUSTOMER_KINDS = ['buyer', 'supplier'] as const;
export const CustomerKind = z.enum(CUSTOMER_KINDS);
export type CustomerKind = z.infer<typeof CustomerKind>;

/** One row of the customer register. */
export const CustomerRow = z.object({
  tenantId: Id,
  slug: Slug,
  kind: CustomerKind,
  name: z.string().min(1),
  legalName: z.string().min(1),
  status: TenantsStatus,
  /** `tenants.onboarding_stage`; `null` for supplier organizations (free participation, no onboarding plan). */
  onboardingStage: TenantsOnboardingStage.nullable(),
  /** `tenants.plan_code`; `null` for suppliers. */
  planCode: PlanCode.nullable(),
  subscriptionStatus: SubscriptionsStatus.nullable(),
  serviceOwner: PersonRef.nullable(),
  administrators: z.array(PersonRef),
  openSupportCases: z.number().int().min(0),
  activeSupportGrants: z.number().int().min(0),
  createdAt: Instant,
});
export type CustomerRow = z.infer<typeof CustomerRow>;

export const CUSTOMER_SORT_FIELDS = ['name', 'kind', 'status', 'onboardingStage', 'createdAt'] as const;
export const CustomerListQuery = listQueryWithSort(CUSTOMER_SORT_FIELDS).extend({
  kind: queryList(CustomerKind).optional(),
  status: queryList(TenantsStatus).optional(),
  onboardingStage: queryList(TenantsOnboardingStage).optional(),
  planCode: queryList(PlanCode).optional(),
  serviceOwnerUserId: IdParam.optional(),
  createdFrom: CalendarDate.optional(),
  createdTo: CalendarDate.optional(),
});
export type CustomerListQuery = z.input<typeof CustomerListQuery>;

/** Aggregate usage of a customer: counts only, never content (OPS-01, OPS-06). */
export const CustomerUsage = z.object({
  activeUsers: z.number().int().min(0),
  publishedEventsYtd: z.number().int().min(0),
  liveEvents: z.number().int().min(0),
  activeContracts: z.number().int().min(0),
  storageUsedGb: z.string().regex(/^\d+(\.\d{1,2})?$/),
  lastActivityAt: Instant.nullable(),
});
export type CustomerUsage = z.infer<typeof CustomerUsage>;

/**
 * A live event that constrains an account change. Operators see reference, status and official deadline; the
 * title only for events the public can see (PRD §4.3: public visibility only). For invitation-only, restricted
 * or unreleased events `title` is `null` and `withheld` is `true`. The customer's own view (ADM-17) always carries
 * the title (`withheld: false`).
 */
export const LiveEvent = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1).nullable(),
  withheld: z.boolean(),
  status: TendersStatus,
  submissionDeadline: OfficialDeadline.nullable(),
});
export type LiveEvent = z.infer<typeof LiveEvent>;

/**
 * A live contract that constrains an account change. Contract records are "no automatic access" for operators
 * (PRD §4.3): operator views carry reference, status and term end only, with `title` and `supplierName` `null`
 * and `withheld: true`, unless an active support access grant of the customer covers the contract. The
 * customer's own view (ADM-17) carries full detail.
 */
export const LiveContract = z.object({
  contractId: Id,
  reference: Reference,
  title: z.string().min(1).nullable(),
  withheld: z.boolean(),
  status: ContractsStatus,
  supplierName: z.string().min(1).nullable(),
  termEnd: CalendarDate.nullable(),
});
export type LiveContract = z.infer<typeof LiveContract>;

/** The customer detail (OPS-01). */
export const CustomerDetail = CustomerRow.extend({
  tradingName: z.string().nullable(),
  country: z.string().length(2).nullable(),
  registrationNumber: z.string().nullable(),
  officialTimeZone: TimeZone,
  defaultCurrency: CurrencyCode.nullable(),
  workingLanguages: z.array(z.string().min(2)),
  usage: CustomerUsage,
  liveEvents: z.array(LiveEvent),
  liveContracts: z.array(LiveContract),
  subscriptionId: Id.nullable(),
  offboardingPlanId: Id.nullable(),
  /** Standing reminder shown on every operator customer view. */
  contentAccessNote: z.string().min(1),
});
export type CustomerDetail = z.infer<typeof CustomerDetail>;

export const CustomerParams = z.object({ customerTenantId: IdParam });

/** Establish a buyer customer (OPS-01). Supplier organizations register themselves (PUB/SUP journeys). */
export const CreateCustomerBody = z.object({
  legalName: z
    .string({ error: issue('LEGAL_NAME_REQUIRED', 'The legal name is required.') })
    .trim()
    .min(2, issue('LEGAL_NAME_REQUIRED', 'The legal name is required.'))
    .max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.')),
  tradingName: optionalText(200).optional(),
  slug: z.string({ error: issue('SLUG_REQUIRED', 'Enter the organization address, for example kwu.') }).pipe(Slug),
  country: z
    .string({ error: issue('INVALID_COUNTRY', 'Use a two-letter country code such as BW.') })
    .regex(/^[A-Z]{2}$/, issue('INVALID_COUNTRY', 'Use a two-letter country code such as BW.')),
  registrationNumber: optionalText(60).optional(),
  officialTimeZone: TimeZone,
  defaultCurrency: CurrencyCode,
  planCode: PlanCode,
  serviceOwnerUserId: Id,
  administratorName: z
    .string({ error: issue('ADMINISTRATOR_REQUIRED', 'Name the designated administrator.') })
    .trim()
    .min(2, issue('ADMINISTRATOR_REQUIRED', 'Name the designated administrator.'))
    .max(120, issue('TEXT_TOO_LONG', 'At most 120 characters.')),
  administratorEmail: z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.')),
});
export type CreateCustomerBody = z.infer<typeof CreateCustomerBody>;

/** Change the service owner of a customer (OPS-01). */
export const UpdateCustomerBody = z.object({
  serviceOwnerUserId: Id,
});
export type UpdateCustomerBody = z.infer<typeof UpdateCustomerBody>;

/** Account status changes the operator may make. */
export const CUSTOMER_STATUS_TARGETS = ['active', 'suspended', 'offboarding', 'closed'] as const;
export const CustomerStatusTarget = z.enum(CUSTOMER_STATUS_TARGETS, {
  error: issue('INVALID_STATUS', 'Choose active, suspended, offboarding or closed.'),
});

export const ChangeCustomerStatusBody = z.object({
  status: CustomerStatusTarget,
  reason: ReasonText,
});
export type ChangeCustomerStatusBody = z.infer<typeof ChangeCustomerStatusBody>;

/** Result of an account status change. */
export const CustomerStatusResult = z.object({
  customer: CustomerStatusLabel,
  previousStatus: TenantsStatus,
  changedAt: Instant,
  consequence: z.string().min(1),
});
export type CustomerStatusResult = z.infer<typeof CustomerStatusResult>;

// ---------------------------------------------------------------------------------------------------------
// Onboarding (OPS-02)
// ---------------------------------------------------------------------------------------------------------

/** One onboarding checklist item. */
export const OnboardingItem = z.object({
  id: Id,
  area: OnboardingItemArea,
  title: z.string().min(1),
  detail: z.string().nullable(),
  status: OnboardingItemStatus,
  owner: PersonRef.nullable(),
  dueDate: CalendarDate.nullable(),
  /** Blocks advancing the onboarding stage while not done or not applicable. */
  blocking: z.boolean(),
  resolvedAt: Instant.nullable(),
  note: z.string().nullable(),
});
export type OnboardingItem = z.infer<typeof OnboardingItem>;

/** The onboarding workspace of a buyer customer. */
export const OnboardingView = z.object({
  customer: CustomerStatusLabel,
  stage: TenantsOnboardingStage,
  /** The next stage the operator may move to, or `null` when onboarding is complete or the customer is leaving. */
  nextStage: TenantsOnboardingStage.nullable(),
  items: z.array(OnboardingItem),
  readiness: z.array(ReadinessCheck),
  serviceOwner: PersonRef.nullable(),
  administrators: z.array(PersonRef),
});
export type OnboardingView = z.infer<typeof OnboardingView>;

export const OnboardingItemParams = z.object({ customerTenantId: IdParam, itemId: IdParam });

export const UpdateOnboardingItemBody = z.object({
  status: OnboardingItemStatus,
  note: NoteText.optional(),
});
export type UpdateOnboardingItemBody = z.infer<typeof UpdateOnboardingItemBody>;

export const AdvanceOnboardingBody = z.object({
  toStage: choice(TENANTS_ONBOARDING_STAGE, 'INVALID_STAGE', 'Choose setup, configuring, pilot, live or offboarding.'),
  note: NoteText.optional(),
});
export type AdvanceOnboardingBody = z.infer<typeof AdvanceOnboardingBody>;

// ---------------------------------------------------------------------------------------------------------
// Offboarding (OPS-02, ADM-17, AC-36)
// ---------------------------------------------------------------------------------------------------------

/** The customer-exit export package (`exports` with `export_type = 'customer_exit'`). */
export const ExitExport = z.object({
  id: Id,
  format: ExportsFormat,
  status: ExportsStatus,
  requestedAt: Instant,
  requestedBy: PersonRef,
  completedAt: Instant.nullable(),
  /** The manifest summary: what the package contains, omits and redacts. */
  contents: z.array(z.string().min(1)),
  omissions: z.array(z.string().min(1)),
});
export type ExitExport = z.infer<typeof ExitExport>;

/** One row of the offboarding plan register. */
export const OffboardingPlanRow = z.object({
  id: Id,
  customer: CustomerStatusLabel,
  status: OffboardingPlansStatus,
  activeEventsCount: z.number().int().min(0),
  activeContractsCount: z.number().int().min(0),
  serviceEndDate: CalendarDate.nullable(),
  agreedByCustomerAt: Instant.nullable(),
  owner: PersonRef.nullable(),
  updatedAt: Instant,
});
export type OffboardingPlanRow = z.infer<typeof OffboardingPlanRow>;

export const OFFBOARDING_SORT_FIELDS = ['customer', 'status', 'serviceEndDate', 'updatedAt'] as const;
export const OffboardingPlanListQuery = listQueryWithSort(OFFBOARDING_SORT_FIELDS).extend({
  status: queryList(OffboardingPlansStatus).optional(),
  ownerUserId: IdParam.optional(),
  serviceEndFrom: CalendarDate.optional(),
  serviceEndTo: CalendarDate.optional(),
});
export type OffboardingPlanListQuery = z.input<typeof OffboardingPlanListQuery>;

/** The full offboarding (continuity and exit) plan. */
export const OffboardingPlanDetail = OffboardingPlanRow.extend({
  reason: z.string().min(1),
  continuityPlan: z.string().nullable(),
  supplierAccessPlan: z.string().nullable(),
  retentionResponsibilities: z.string().nullable(),
  disposalTimetable: z.string().nullable(),
  liveEvents: z.array(LiveEvent),
  liveContracts: z.array(LiveContract),
  exportRequest: ExitExport.nullable(),
  readiness: z.array(ReadinessCheck),
  /** The status the plan may move to next (`null` when completed). */
  nextStatus: OffboardingPlansStatus.nullable(),
  createdAt: Instant,
});
export type OffboardingPlanDetail = z.infer<typeof OffboardingPlanDetail>;

export const OffboardingPlanParams = z.object({ planId: IdParam });

const PlanText = optionalText(8000);

export const CreateOffboardingPlanBody = z.object({
  reason: ReasonText,
  serviceEndDate: CalendarDate,
});
export type CreateOffboardingPlanBody = z.infer<typeof CreateOffboardingPlanBody>;

export const UpdateOffboardingPlanBody = z.object({
  serviceEndDate: CalendarDate.optional(),
  continuityPlan: PlanText.optional(),
  supplierAccessPlan: PlanText.optional(),
  retentionResponsibilities: PlanText.optional(),
  disposalTimetable: PlanText.optional(),
  ownerUserId: Id.optional(),
});
export type UpdateOffboardingPlanBody = z.infer<typeof UpdateOffboardingPlanBody>;

export const TransitionOffboardingPlanBody = z.object({
  toStatus: choice(OFFBOARDING_PLANS_STATUS, 'INVALID_STATUS', 'Choose draft, agreed, in progress or completed.'),
  note: NoteText.optional(),
});
export type TransitionOffboardingPlanBody = z.infer<typeof TransitionOffboardingPlanBody>;

// ---------------------------------------------------------------------------------------------------------
// Plans, subscriptions and entitlements (OPS-03)
// ---------------------------------------------------------------------------------------------------------

/** One entitlement of a plan definition. */
export const PlanEntitlement = z.object({
  featureCode: EntitlementFeatureCode,
  label: z.string().min(1),
  /** `null` = included without a metered limit. */
  limitValue: z.number().int().min(0).nullable(),
  unit: z.string().min(1),
});
export type PlanEntitlement = z.infer<typeof PlanEntitlement>;

/** A buyer package of the plan catalog (PRD §21.1). */
export const PlanDefinition = z.object({
  code: PlanCode,
  name: z.string().min(1),
  description: z.string().min(1),
  annualFee: Money,
  entitlements: z.array(PlanEntitlement),
  optionalServices: z.array(z.string().min(1)),
  customers: z.number().int().min(0),
});
export type PlanDefinition = z.infer<typeof PlanDefinition>;

export const PlanCatalog = z.object({
  plans: z.array(PlanDefinition),
  /** Supplier participation is free and never depends on a plan (BR-46). */
  supplierAccessNote: z.string().min(1),
});
export type PlanCatalog = z.infer<typeof PlanCatalog>;

/** Entitlement with current usage (`entitlements`). */
export const EntitlementUsage = z.object({
  featureCode: EntitlementFeatureCode,
  label: z.string().min(1),
  unit: z.string().min(1),
  limitValue: z.number().int().min(0).nullable(),
  usageValue: z.number().int().min(0),
  /** `usageValue >= limitValue` (never for unmetered entitlements). */
  limitReached: z.boolean(),
});
export type EntitlementUsage = z.infer<typeof EntitlementUsage>;

/** A service-management action raised by a usage limit (PRD §21.1). */
export const ServiceAction = z.object({
  id: Id,
  featureCode: EntitlementFeatureCode,
  description: z.string().min(1),
  status: ServiceActionStatus,
  owner: PersonRef.nullable(),
  raisedAt: Instant,
  resolvedAt: Instant.nullable(),
  resolution: z.string().nullable(),
  /** Always false: a commercial limit never blocks a supplier's submission. */
  blocksSubmissions: z.literal(false),
});
export type ServiceAction = z.infer<typeof ServiceAction>;

/** A commercial invoice, with any dispute. */
export const Invoice = z.object({
  id: Id,
  number: z.string().min(1),
  periodLabel: z.string().min(1),
  issuedOn: CalendarDate,
  dueOn: CalendarDate,
  amount: Money,
  status: InvoiceStatus,
  disputeNote: z.string().nullable(),
});
export type Invoice = z.infer<typeof Invoice>;

/** One row of the subscription register. */
export const SubscriptionRow = z.object({
  id: Id,
  customer: CustomerStatusLabel,
  planCode: PlanCode,
  status: SubscriptionsStatus,
  startsAt: Instant,
  renewsAt: Instant.nullable(),
  commercialContact: z.string().nullable(),
  commercialContactEmail: z.string().nullable(),
  openServiceActions: z.number().int().min(0),
  disputedInvoices: z.number().int().min(0),
});
export type SubscriptionRow = z.infer<typeof SubscriptionRow>;

export const SUBSCRIPTION_SORT_FIELDS = ['customer', 'planCode', 'status', 'startsAt', 'renewsAt'] as const;
export const SubscriptionListQuery = listQueryWithSort(SUBSCRIPTION_SORT_FIELDS).extend({
  status: queryList(SubscriptionsStatus).optional(),
  planCode: queryList(PlanCode).optional(),
  customerTenantId: IdParam.optional(),
  renewsFrom: CalendarDate.optional(),
  renewsTo: CalendarDate.optional(),
  hasOpenServiceActions: QueryBoolean.optional(),
});
export type SubscriptionListQuery = z.input<typeof SubscriptionListQuery>;

/** The subscription detail (OPS-03). */
export const SubscriptionDetail = SubscriptionRow.extend({
  notes: z.string().nullable(),
  entitlements: z.array(EntitlementUsage),
  serviceActions: z.array(ServiceAction),
  invoices: z.array(Invoice),
  optionalServices: z.array(z.string().min(1)),
  /** Standing rule: entitlements never change competition results or supplier eligibility. */
  entitlementRule: z.string().min(1),
});
export type SubscriptionDetail = z.infer<typeof SubscriptionDetail>;

export const SubscriptionParams = z.object({ subscriptionId: IdParam });

/** Status changes the operator may make to a subscription. */
export const UpdateSubscriptionBody = z.object({
  planCode: PlanCode.optional(),
  status: choice(SUBSCRIPTIONS_STATUS, 'INVALID_STATUS', 'Choose trial, active, past due, cancelled or ended.').optional(),
  renewsAt: Instant.nullable().optional(),
  commercialContact: optionalText(300).optional(),
  notes: NoteText.optional(),
  reason: ReasonText,
});
export type UpdateSubscriptionBody = z.infer<typeof UpdateSubscriptionBody>;

export const EntitlementParams = z.object({ subscriptionId: IdParam, featureCode: EntitlementFeatureCode });

export const UpdateEntitlementBody = z.object({
  limitValue: z
    .number({ error: issue('INVALID_LIMIT', 'Enter a whole number, or leave empty for unmetered.') })
    .int(issue('INVALID_LIMIT', 'Enter a whole number.'))
    .min(0, issue('INVALID_LIMIT', 'The limit cannot be negative.'))
    .nullable(),
  reason: ReasonText,
});
export type UpdateEntitlementBody = z.infer<typeof UpdateEntitlementBody>;

/** Result of an entitlement change: the new usage row and any service action it raised. */
export const EntitlementChangeResult = z.object({
  subscriptionId: Id,
  entitlement: EntitlementUsage,
  serviceAction: ServiceAction.nullable(),
});
export type EntitlementChangeResult = z.infer<typeof EntitlementChangeResult>;

export const ServiceActionParams = z.object({ actionId: IdParam });

export const ResolveServiceActionBody = z.object({
  resolution: ReasonText,
});
export type ResolveServiceActionBody = z.infer<typeof ResolveServiceActionBody>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const CUSTOMER_READ = ['ops.customers.manage', 'ops.support.manage', 'ops.oversight.view'] as const;

export const listCustomers = defineEndpoint({
  id: 'ops.operations.customers.list',
  method: 'GET',
  path: '/api/v1/ops/customers',
  audience: 'ops',
  permission: CUSTOMER_READ,
  query: CustomerListQuery,
  response: pageOf(CustomerRow),
  errors: [],
  screens: ['OPS-01'],
  summary: 'Customer register: identity, service owner, onboarding stage, plan, status and administrators.',
});

export const getCustomer = defineEndpoint({
  id: 'ops.operations.customers.get',
  method: 'GET',
  path: '/api/v1/ops/customers/:customerTenantId',
  audience: 'ops',
  permission: CUSTOMER_READ,
  params: CustomerParams,
  response: CustomerDetail,
  errors: [],
  screens: ['OPS-01', 'OPS-02'],
});

export const createCustomer = defineEndpoint({
  id: 'ops.operations.customers.create',
  method: 'POST',
  path: '/api/v1/ops/customers',
  audience: 'ops',
  permission: 'ops.customers.manage',
  body: CreateCustomerBody,
  response: CustomerDetail,
  idempotent: true,
  errors: ['SLUG_TAKEN', 'CUSTOMER_ALREADY_REGISTERED', 'SERVICE_OWNER_NOT_OPERATOR'],
  screens: ['OPS-01'],
});

export const updateCustomer = defineEndpoint({
  id: 'ops.operations.customers.update',
  method: 'PATCH',
  path: '/api/v1/ops/customers/:customerTenantId',
  audience: 'ops',
  permission: 'ops.customers.manage',
  params: CustomerParams,
  body: UpdateCustomerBody,
  response: CustomerDetail,
  errors: ['SERVICE_OWNER_NOT_OPERATOR'],
  screens: ['OPS-01'],
});

export const changeCustomerStatus = defineEndpoint({
  id: 'ops.operations.customers.changeStatus',
  method: 'POST',
  path: '/api/v1/ops/customers/:customerTenantId/status',
  audience: 'ops',
  permission: 'ops.customers.manage',
  params: CustomerParams,
  body: ChangeCustomerStatusBody,
  response: CustomerStatusResult,
  errors: ['STATUS_TRANSITION_INVALID', 'CONTINUITY_PLAN_REQUIRED'],
  screens: ['OPS-01', 'OPS-02'],
});

export const getOnboarding = defineEndpoint({
  id: 'ops.operations.onboarding.get',
  method: 'GET',
  path: '/api/v1/ops/customers/:customerTenantId/onboarding',
  audience: 'ops',
  permission: CUSTOMER_READ,
  params: CustomerParams,
  response: OnboardingView,
  errors: ['ONBOARDING_NOT_APPLICABLE'],
  screens: ['OPS-02'],
});

export const updateOnboardingItem = defineEndpoint({
  id: 'ops.operations.onboarding.updateItem',
  method: 'POST',
  path: '/api/v1/ops/customers/:customerTenantId/onboarding/items/:itemId',
  audience: 'ops',
  permission: 'ops.customers.manage',
  params: OnboardingItemParams,
  body: UpdateOnboardingItemBody,
  response: OnboardingItem,
  errors: ['ONBOARDING_NOT_APPLICABLE', 'NOTE_REQUIRED_FOR_BLOCKED'],
  screens: ['OPS-02'],
});

export const advanceOnboarding = defineEndpoint({
  id: 'ops.operations.onboarding.advance',
  method: 'POST',
  path: '/api/v1/ops/customers/:customerTenantId/onboarding/advance',
  audience: 'ops',
  permission: 'ops.customers.manage',
  params: CustomerParams,
  body: AdvanceOnboardingBody,
  response: OnboardingView,
  errors: ['ONBOARDING_NOT_APPLICABLE', 'STAGE_TRANSITION_INVALID', 'ONBOARDING_ITEMS_OPEN'],
  screens: ['OPS-02'],
});

export const listOffboardingPlans = defineEndpoint({
  id: 'ops.operations.offboarding.list',
  method: 'GET',
  path: '/api/v1/ops/offboarding-plans',
  audience: 'ops',
  permission: CUSTOMER_READ,
  query: OffboardingPlanListQuery,
  response: pageOf(OffboardingPlanRow),
  errors: [],
  screens: ['OPS-02'],
});

export const getOffboardingPlan = defineEndpoint({
  id: 'ops.operations.offboarding.get',
  method: 'GET',
  path: '/api/v1/ops/offboarding-plans/:planId',
  audience: 'ops',
  permission: CUSTOMER_READ,
  params: OffboardingPlanParams,
  response: OffboardingPlanDetail,
  errors: [],
  screens: ['OPS-02'],
});

export const createOffboardingPlan = defineEndpoint({
  id: 'ops.operations.offboarding.create',
  method: 'POST',
  path: '/api/v1/ops/customers/:customerTenantId/offboarding-plan',
  audience: 'ops',
  permission: 'ops.customers.manage',
  params: CustomerParams,
  body: CreateOffboardingPlanBody,
  response: OffboardingPlanDetail,
  idempotent: true,
  errors: ['OFFBOARDING_PLAN_EXISTS', 'OFFBOARDING_NOT_APPLICABLE'],
  screens: ['OPS-02'],
});

export const updateOffboardingPlan = defineEndpoint({
  id: 'ops.operations.offboarding.update',
  method: 'PATCH',
  path: '/api/v1/ops/offboarding-plans/:planId',
  audience: 'ops',
  permission: 'ops.customers.manage',
  params: OffboardingPlanParams,
  body: UpdateOffboardingPlanBody,
  response: OffboardingPlanDetail,
  errors: ['OFFBOARDING_PLAN_LOCKED', 'SERVICE_OWNER_NOT_OPERATOR'],
  screens: ['OPS-02'],
});

export const transitionOffboardingPlan = defineEndpoint({
  id: 'ops.operations.offboarding.transition',
  method: 'POST',
  path: '/api/v1/ops/offboarding-plans/:planId/transition',
  audience: 'ops',
  permission: 'ops.customers.manage',
  params: OffboardingPlanParams,
  body: TransitionOffboardingPlanBody,
  response: OffboardingPlanDetail,
  errors: [
    'OFFBOARDING_TRANSITION_INVALID',
    'CONTINUITY_PLAN_INCOMPLETE',
    'CUSTOMER_AGREEMENT_REQUIRED',
    'EXIT_EXPORT_NOT_READY',
    'LIVE_OBLIGATIONS_REMAIN',
  ],
  screens: ['OPS-02'],
});

export const getPlanCatalog = defineEndpoint({
  id: 'ops.operations.plans.list',
  method: 'GET',
  path: '/api/v1/ops/plans',
  audience: 'ops',
  permission: ['ops.subscriptions.manage', 'ops.customers.manage', 'ops.oversight.view'],
  response: PlanCatalog,
  errors: [],
  screens: ['OPS-03'],
});

export const listSubscriptions = defineEndpoint({
  id: 'ops.operations.subscriptions.list',
  method: 'GET',
  path: '/api/v1/ops/subscriptions',
  audience: 'ops',
  permission: ['ops.subscriptions.manage', 'ops.oversight.view'],
  query: SubscriptionListQuery,
  response: pageOf(SubscriptionRow),
  errors: [],
  screens: ['OPS-03'],
});

export const getSubscription = defineEndpoint({
  id: 'ops.operations.subscriptions.get',
  method: 'GET',
  path: '/api/v1/ops/subscriptions/:subscriptionId',
  audience: 'ops',
  permission: ['ops.subscriptions.manage', 'ops.oversight.view'],
  params: SubscriptionParams,
  response: SubscriptionDetail,
  errors: [],
  screens: ['OPS-03'],
});

export const updateSubscription = defineEndpoint({
  id: 'ops.operations.subscriptions.update',
  method: 'PATCH',
  path: '/api/v1/ops/subscriptions/:subscriptionId',
  audience: 'ops',
  permission: 'ops.subscriptions.manage',
  params: SubscriptionParams,
  body: UpdateSubscriptionBody,
  response: SubscriptionDetail,
  errors: ['SUBSCRIPTION_TRANSITION_INVALID', 'CONTINUITY_PLAN_REQUIRED', 'SUBSCRIPTION_ENDED'],
  screens: ['OPS-03'],
});

export const updateEntitlement = defineEndpoint({
  id: 'ops.operations.subscriptions.updateEntitlement',
  method: 'PUT',
  path: '/api/v1/ops/subscriptions/:subscriptionId/entitlements/:featureCode',
  audience: 'ops',
  permission: 'ops.subscriptions.manage',
  params: EntitlementParams,
  body: UpdateEntitlementBody,
  response: EntitlementChangeResult,
  errors: ['ENTITLEMENT_NOT_IN_SUBSCRIPTION', 'SUBSCRIPTION_ENDED'],
  screens: ['OPS-03'],
});

export const resolveServiceAction = defineEndpoint({
  id: 'ops.operations.serviceActions.resolve',
  method: 'POST',
  path: '/api/v1/ops/service-actions/:actionId/resolve',
  audience: 'ops',
  permission: 'ops.subscriptions.manage',
  params: ServiceActionParams,
  body: ResolveServiceActionBody,
  response: ServiceAction,
  errors: ['SERVICE_ACTION_RESOLVED'],
  screens: ['OPS-03'],
});

export const customerRoutes = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  changeCustomerStatus,
  getOnboarding,
  updateOnboardingItem,
  advanceOnboarding,
  listOffboardingPlans,
  getOffboardingPlan,
  createOffboardingPlan,
  updateOffboardingPlan,
  transitionOffboardingPlan,
  getPlanCatalog,
  listSubscriptions,
  getSubscription,
  updateSubscription,
  updateEntitlement,
  resolveServiceAction,
} as const;
