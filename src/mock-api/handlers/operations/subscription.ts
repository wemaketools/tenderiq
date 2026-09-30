/**
 * Buyer handlers: subscription and organization offboarding (ADM-17, AC-36, BR-47). The active buyer sees only its
 * own service arrangement; the offboarding plan preserves live events and contracts.
 */
import { operationsEndpoints as api } from '../../../contracts/operations.js';
import type { BuyerSubscriptionView, ServiceContact } from '../../../contracts/operations.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { SERVICE_TEAM_EMAIL, customerProfileOf } from '../../fixtures/operations/index.js';
import type { FixtureOffboardingPlan, FixtureSubscription } from '../../fixtures/operations/index.js';
import { PERSONAS } from '../../fixtures/platform.js';
import type { FixtureTenant } from '../../fixtures/platform.js';
import { personRef } from '../../persona.js';
import type { TenantAccess } from '../../persona.js';
import {
  ENTITLEMENT_RULE,
  currentSubscriptionOf,
  entitlementsOf,
  exitExportsOf,
  invoicesOf,
  isoNow,
  liveContractsOf,
  liveEventsOf,
  CUSTOMER_VIEWER,
  offboardingDetail,
  offboardingPlanOf,
  planName,
  planSectionsComplete,
  serviceActionsOf,
} from './views.js';

/** The service contacts of a customer: the TenderIQ service team mailbox, the administrators' accounts, the commercial contact. */
function contactsOf(tenant: FixtureTenant, subscription: FixtureSubscription): ServiceContact[] {
  const profile = customerProfileOf(tenant.id);
  const contacts: ServiceContact[] = [];
  if (profile?.serviceOwnerUserId !== undefined && profile.serviceOwnerUserId !== null) {
    const owner = personRef(profile.serviceOwnerUserId);
    contacts.push({ role: 'TenderIQ service owner', person: owner, name: owner.fullName, email: SERVICE_TEAM_EMAIL });
  }
  for (const adminId of profile?.administratorUserIds ?? []) {
    const admin = personRef(adminId);
    const email = PERSONAS.find((persona) => persona.userId === adminId)?.email ?? null;
    contacts.push({ role: 'Designated administrator', person: admin, name: admin.fullName, email });
  }
  if (subscription.commercialContact !== null) {
    contacts.push({ role: 'Commercial contact', person: null, name: subscription.commercialContact, email: subscription.commercialContactEmail });
  }
  return contacts;
}

function subscriptionView(access: TenantAccess, plan: FixtureOffboardingPlan | undefined, fail: (status: number, code: string, detail?: string) => never): BuyerSubscriptionView {
  const tenant = access.tenant;
  const subscription = currentSubscriptionOf(tenant.id);
  if (subscription === undefined) {
    return fail(404, 'SUBSCRIPTION_NOT_FOUND', 'This organization has no subscription.');
  }
  const canManage = access.permissions.includes('org.settings.manage');
  const exports = exitExportsOf(tenant.id);
  return {
    subscriptionId: subscription.id,
    planCode: subscription.planCode,
    planName: planName(subscription.planCode),
    status: subscription.status,
    startsAt: subscription.startsAt,
    renewsAt: subscription.renewsAt,
    entitlements: entitlementsOf(subscription.id),
    serviceActions: serviceActionsOf(subscription.id),
    invoices: invoicesOf(subscription.id),
    optionalServices: [...subscription.optionalServices],
    contacts: contactsOf(tenant, subscription),
    liveEvents: liveEventsOf(tenant.id),
    liveContracts: liveContractsOf(tenant.id),
    exportRequests: exports,
    offboardingPlan: plan === undefined ? null : offboardingDetail(plan, CUSTOMER_VIEWER),
    usageLimitRule: ENTITLEMENT_RULE,
    capabilities: {
      canRequestOffboarding: canManage && plan === undefined,
      canAgreePlan: canManage && plan !== undefined && plan.agreedByCustomerAt === null && planSectionsComplete(plan),
      canRequestExport: canManage && plan !== undefined && !exports.some((row) => row.status === 'queued' || row.status === 'running'),
    },
  };
}

export function registerSubscription(app: MockApp): void {
  mockRoute(app, api.getBuyerSubscription, ({ requireTenant, fail }) => {
    const access = requireTenant();
    return subscriptionView(access, offboardingPlanOf(access.tenant.id), fail);
  });

  mockRoute(app, api.requestOffboarding, ({ body, requireTenant, requirePersona, now, fail }) => {
    const access = requireTenant();
    if (offboardingPlanOf(access.tenant.id) !== undefined) {
      fail(409, 'OFFBOARDING_ALREADY_REQUESTED', 'An offboarding plan already exists for this organization.');
    }
    if (body.requestedEndDate < now.toISOString().slice(0, 10)) {
      fail(422, 'END_DATE_IN_PAST', 'Choose an end date in the future.');
    }
    const at = isoNow(now);
    const plan: FixtureOffboardingPlan = {
      id: 900,
      customerTenantId: access.tenant.id,
      status: 'draft',
      reason: `${body.reason} (requested by ${requirePersona().fullName}; exit contact ${body.contactName} <${body.contactEmail}>)`,
      serviceEndDate: body.requestedEndDate,
      continuityPlan: null,
      supplierAccessPlan: null,
      retentionResponsibilities: null,
      disposalTimetable: null,
      exportRequestId: null,
      agreedByCustomerAt: null,
      ownerUserId: customerProfileOf(access.tenant.id)?.serviceOwnerUserId ?? null,
      createdAt: at,
      updatedAt: at,
    };
    return subscriptionView(access, plan, fail);
  });

  mockRoute(app, api.agreeOffboardingPlan, ({ requireTenant, now, fail }) => {
    const access = requireTenant();
    const plan = offboardingPlanOf(access.tenant.id);
    if (plan === undefined) return fail(409, 'NO_OFFBOARDING_PLAN', 'This organization has no offboarding plan.');
    if (plan.agreedByCustomerAt !== null) fail(409, 'OFFBOARDING_PLAN_ALREADY_AGREED', 'The plan is already agreed.');
    if (!planSectionsComplete(plan)) {
      fail(409, 'OFFBOARDING_PLAN_NOT_READY', 'The continuity, supplier access and retention sections must be written before you agree the plan.');
    }
    const at = isoNow(now);
    return subscriptionView(access, { ...plan, agreedByCustomerAt: at, status: plan.status === 'draft' ? 'agreed' : plan.status, updatedAt: at }, fail);
  });

  mockRoute(app, api.requestExitExport, ({ body, requireTenant, requirePersona, now, fail }) => {
    const access = requireTenant();
    const plan = offboardingPlanOf(access.tenant.id);
    if (plan === undefined) return fail(409, 'NO_OFFBOARDING_PLAN', 'Request offboarding before requesting the exit export.');
    if (exitExportsOf(access.tenant.id).some((row) => row.status === 'queued' || row.status === 'running')) {
      fail(409, 'EXIT_EXPORT_IN_PROGRESS', 'An exit export is already being prepared.');
    }
    const live = liveEventsOf(access.tenant.id);
    return {
      id: 900,
      format: body.format,
      status: 'queued',
      requestedAt: isoNow(now),
      requestedBy: personRef(requirePersona().userId),
      completedAt: null,
      contents: [
        'Every event with notices, clarifications, addenda, opening records and evaluation reports permitted for export',
        'Contracts register with obligations, changes and performance reviews',
        'Supplier relationships and qualification decisions',
        'Audit trail of business actions',
      ],
      omissions: [
        ...live.filter((event) => event.status === 'open').map((event) => `${event.reference} (open): exported after closing under the continuity plan`),
        'Sealed bid content of any event before opening',
      ],
    };
  });
}
