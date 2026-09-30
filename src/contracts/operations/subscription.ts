/**
 * Buyer subscription and organization offboarding (ADM-17; BR-47; AC-36). The customer-side view of
 * `subscriptions`, `entitlements`, `offboarding_plans` and the customer-exit `exports`.
 *
 * Rules the contract carries (Stage B enforces them):
 * - Entitlements are visible before the customer relies on a capability; a usage limit creates a service action
 *   and never blocks a supplier's submission (PRD §21.1).
 * - Leaving never abandons live procurements: the offboarding request starts a continuity plan that names every
 *   live event and contract, supplier access, retention responsibilities, the export package and the disposal
 *   timetable (PRD §18.3, BR-47). The customer agrees the plan only when it is complete (`OFFBOARDING_PLAN_NOT_READY`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { CalendarDate, Id, Instant, PersonRef, ReasonText, issue } from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { EXPORTS_FORMAT, SubscriptionsStatus } from '../enums.js';
import {
  EntitlementUsage,
  ExitExport,
  Invoice,
  LiveContract,
  LiveEvent,
  OffboardingPlanDetail,
  ServiceAction,
} from './customers.js';
import { PlanCode, choice, confirmation } from './shared.js';

/** A contact on the service arrangement. */
export const ServiceContact = z.object({
  role: z.string().min(1),
  person: PersonRef.nullable(),
  name: z.string().min(1),
  email: z.string().nullable(),
});
export type ServiceContact = z.infer<typeof ServiceContact>;

/** The subscription and offboarding workspace of the active buyer (ADM-17). */
export const BuyerSubscriptionView = z.object({
  subscriptionId: Id,
  planCode: PlanCode,
  planName: z.string().min(1),
  status: SubscriptionsStatus,
  startsAt: Instant,
  renewsAt: Instant.nullable(),
  entitlements: z.array(EntitlementUsage),
  serviceActions: z.array(ServiceAction),
  invoices: z.array(Invoice),
  optionalServices: z.array(z.string().min(1)),
  contacts: z.array(ServiceContact),
  liveEvents: z.array(LiveEvent),
  liveContracts: z.array(LiveContract),
  exportRequests: z.array(ExitExport),
  /** The agreed or draft offboarding plan, when the customer is leaving. */
  offboardingPlan: OffboardingPlanDetail.nullable(),
  /** Standing rule shown with the entitlements. */
  usageLimitRule: z.string().min(1),
  capabilities: z.object({
    canRequestOffboarding: z.boolean(),
    canAgreePlan: z.boolean(),
    canRequestExport: z.boolean(),
  }),
});
export type BuyerSubscriptionView = z.infer<typeof BuyerSubscriptionView>;

export const RequestOffboardingBody = z.object({
  reason: ReasonText,
  requestedEndDate: CalendarDate,
  contactName: z
    .string({ error: issue('CONTACT_REQUIRED', 'Name the contact for the exit.') })
    .trim()
    .min(2, issue('CONTACT_REQUIRED', 'Name the contact for the exit.'))
    .max(120, issue('TEXT_TOO_LONG', 'At most 120 characters.')),
  contactEmail: z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.')),
  acknowledgement: confirmation(
    'ACKNOWLEDGEMENT_REQUIRED',
    'Confirm that live events and contracts continue under the continuity plan until they are completed or transferred.',
  ),
});
export type RequestOffboardingBody = z.infer<typeof RequestOffboardingBody>;

export const AgreeOffboardingPlanBody = z.object({
  acknowledgement: confirmation(
    'ACKNOWLEDGEMENT_REQUIRED',
    'Confirm that the organization agrees the continuity, supplier access, retention and export arrangements.',
  ),
});
export type AgreeOffboardingPlanBody = z.infer<typeof AgreeOffboardingPlanBody>;

export const RequestExitExportBody = z.object({
  format: choice(EXPORTS_FORMAT, 'INVALID_FORMAT', 'Choose Excel (xlsx), CSV or HTML.'),
});
export type RequestExitExportBody = z.infer<typeof RequestExitExportBody>;

export const getBuyerSubscription = defineEndpoint({
  id: 'buyer.operations.subscription.get',
  method: 'GET',
  path: '/api/v1/buyer/subscription',
  audience: 'buyer',
  permission: 'org.subscription.view',
  response: BuyerSubscriptionView,
  errors: ['SUBSCRIPTION_NOT_FOUND'],
  screens: ['ADM-17'],
});

export const requestOffboarding = defineEndpoint({
  id: 'buyer.operations.subscription.requestOffboarding',
  method: 'POST',
  path: '/api/v1/buyer/subscription/offboarding-request',
  audience: 'buyer',
  permission: 'org.settings.manage',
  body: RequestOffboardingBody,
  response: BuyerSubscriptionView,
  idempotent: true,
  errors: ['OFFBOARDING_ALREADY_REQUESTED', 'END_DATE_IN_PAST'],
  screens: ['ADM-17'],
});

export const agreeOffboardingPlan = defineEndpoint({
  id: 'buyer.operations.subscription.agreePlan',
  method: 'POST',
  path: '/api/v1/buyer/subscription/offboarding-plan/agree',
  audience: 'buyer',
  permission: 'org.settings.manage',
  body: AgreeOffboardingPlanBody,
  response: BuyerSubscriptionView,
  errors: ['NO_OFFBOARDING_PLAN', 'OFFBOARDING_PLAN_NOT_READY', 'OFFBOARDING_PLAN_ALREADY_AGREED'],
  screens: ['ADM-17'],
});

export const requestExitExport = defineEndpoint({
  id: 'buyer.operations.subscription.requestExport',
  method: 'POST',
  path: '/api/v1/buyer/subscription/exit-exports',
  audience: 'buyer',
  permission: 'org.settings.manage',
  body: RequestExitExportBody,
  response: ExitExport,
  idempotent: true,
  errors: ['NO_OFFBOARDING_PLAN', 'EXIT_EXPORT_IN_PROGRESS'],
  screens: ['ADM-17'],
});

export const subscriptionRoutes = {
  getBuyerSubscription,
  requestOffboarding,
  agreeOffboardingPlan,
  requestExitExport,
} as const;
