/**
 * Operator handlers: customer register (OPS-01), onboarding and offboarding (OPS-02, AC-36), plans, subscriptions,
 * entitlements and service actions (OPS-03). Service metadata only: never tender content (PRD §4.3).
 */
import type { OffboardingPlansStatus, TenantsOnboardingStage, TenantsStatus } from '../../../contracts/enums.js';
import { operationsEndpoints as api } from '../../../contracts/operations.js';
import type { EntitlementUsage, PlanDefinition } from '../../../contracts/operations.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  CUSTOMER_PROFILES,
  ENTITLEMENTS,
  FEATURE_LABELS,
  OFFBOARDING_PLANS,
  PLAN_DEFINITIONS,
  SERVICE_ACTIONS,
  SUBSCRIPTIONS,
  customerProfileOf,
} from '../../fixtures/operations/index.js';
import type { FixtureOffboardingPlan } from '../../fixtures/operations/index.js';
import { personRef } from '../../persona.js';
import {
  allCustomers,
  customerDetail,
  customerRow,
  customerStatusLabel,
  entitlementsOf,
  hasAgreedPlan,
  hasLiveObligations,
  isOperatorUser,
  isoNow,
  matchesText,
  nextOnboardingStage,
  nextPlanStatus,
  offboardingDetail,
  operatorViewer,
  offboardingPlanOf,
  offboardingRow,
  onboardingItemsOf,
  onboardingView,
  openBlockingItems,
  planSectionsComplete,
  serviceActionView,
  sortRows,
  subscriptionDetail,
  subscriptionRow,
  withinDates,
} from './views.js';

/** Account status transitions the operator may make. */
const STATUS_TRANSITIONS: Readonly<Record<TenantsStatus, readonly TenantsStatus[]>> = {
  pending: ['active', 'closed'],
  active: ['suspended', 'offboarding'],
  suspended: ['active', 'offboarding'],
  offboarding: ['active', 'closed'],
  closed: [],
};

export function registerCustomers(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Customer register (OPS-01)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listCustomers, ({ query, fixtures, now }) => {
    const rows = allCustomers()
      .map((tenant) => customerRow(tenant, now))
      .filter((row) => query.kind === undefined || query.kind.includes(row.kind))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.onboardingStage === undefined || (row.onboardingStage !== null && query.onboardingStage.includes(row.onboardingStage)))
      .filter((row) => query.planCode === undefined || (row.planCode !== null && query.planCode.includes(row.planCode)))
      .filter((row) => query.serviceOwnerUserId === undefined || row.serviceOwner?.userId === query.serviceOwnerUserId)
      .filter((row) => withinDates(row.createdAt, query.createdFrom, query.createdTo))
      .filter((row) => matchesText(query.q, row.name, row.legalName, row.slug, ...row.administrators.map((admin) => admin.fullName)));
    const sort = query.sort ?? 'name';
    const sorted = sortRows(rows, (row) => (sort === 'createdAt' ? row.createdAt : sort === 'onboardingStage' ? row.onboardingStage : row[sort]), query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getCustomer, ({ params, now, notFound }) => {
    const tenant = allCustomers().find((row) => row.id === params.customerTenantId);
    if (tenant === undefined) return notFound();
    return customerDetail(tenant, now);
  });

  mockRoute(app, api.createCustomer, ({ body, now, fail }) => {
    if (allCustomers().some((tenant) => tenant.slug === body.slug) || body.slug === 'tenderiq-ops') {
      fail(409, 'SLUG_TAKEN', `The slug "${body.slug}" is already used by another organization.`);
    }
    if (
      allCustomers().some((tenant) => tenant.legalName.toLowerCase() === body.legalName.toLowerCase()) ||
      (body.registrationNumber !== undefined && CUSTOMER_PROFILES.some((profile) => profile.registrationNumber === body.registrationNumber))
    ) {
      fail(409, 'CUSTOMER_ALREADY_REGISTERED', 'An organization with this legal name or registration number is already a customer.');
    }
    if (!isOperatorUser(body.serviceOwnerUserId)) {
      fail(422, 'SERVICE_OWNER_NOT_OPERATOR', 'The service owner must be a platform operator.');
    }
    const createdAt = isoNow(now);
    return {
      tenantId: 900,
      slug: body.slug,
      kind: 'buyer',
      name: body.tradingName ?? body.legalName,
      legalName: body.legalName,
      status: 'pending',
      onboardingStage: 'setup',
      planCode: body.planCode,
      subscriptionStatus: 'trial',
      serviceOwner: personRef(body.serviceOwnerUserId),
      administrators: [],
      openSupportCases: 0,
      activeSupportGrants: 0,
      createdAt,
      tradingName: body.tradingName ?? null,
      country: body.country,
      registrationNumber: body.registrationNumber ?? null,
      officialTimeZone: body.officialTimeZone,
      defaultCurrency: body.defaultCurrency,
      workingLanguages: ['en'],
      usage: { activeUsers: 0, publishedEventsYtd: 0, liveEvents: 0, activeContracts: 0, storageUsedGb: '0', lastActivityAt: null },
      liveEvents: [],
      liveContracts: [],
      subscriptionId: 900,
      offboardingPlanId: null,
      contentAccessNote: `An invitation was sent to ${body.administratorName} <${body.administratorEmail}> to become the designated administrator. Operators never see the customer's tender content.`,
    };
  });

  mockRoute(app, api.updateCustomer, ({ params, body, now, notFound, fail }) => {
    const tenant = allCustomers().find((row) => row.id === params.customerTenantId);
    if (tenant === undefined) return notFound();
    if (!isOperatorUser(body.serviceOwnerUserId)) {
      fail(422, 'SERVICE_OWNER_NOT_OPERATOR', 'The service owner must be a platform operator.');
    }
    return { ...customerDetail(tenant, now), serviceOwner: personRef(body.serviceOwnerUserId) };
  });

  mockRoute(app, api.changeCustomerStatus, ({ params, body, now, notFound, fail }) => {
    const tenant = allCustomers().find((row) => row.id === params.customerTenantId);
    if (tenant === undefined) return notFound();
    if (!STATUS_TRANSITIONS[tenant.status].includes(body.status)) {
      fail(409, 'STATUS_TRANSITION_INVALID', `A ${tenant.status} organization cannot be set to ${body.status}.`);
    }
    if ((body.status === 'suspended' || body.status === 'closed') && hasLiveObligations(tenant.id) && !hasAgreedPlan(tenant.id)) {
      fail(
        409,
        'CONTINUITY_PLAN_REQUIRED',
        'This organization has live events or contracts. Agree a continuity (offboarding) plan with the customer before suspending or closing the account (BR-47).',
      );
    }
    const consequence =
      body.status === 'suspended'
        ? 'Members cannot sign in. Live events and contracts continue under the agreed continuity plan; suppliers keep access to their own submissions and receipts.'
        : body.status === 'offboarding'
          ? 'The customer is leaving: the offboarding plan governs live events, supplier access, exports and retention.'
          : body.status === 'closed'
            ? 'The account is closed. Retained records follow the agreed retention and disposal timetable.'
            : 'The account is active again.';
    return {
      customer: { ...customerStatusLabel(tenant.id), status: body.status },
      previousStatus: tenant.status,
      changedAt: isoNow(now),
      consequence,
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Onboarding (OPS-02)
  // ---------------------------------------------------------------------------------------------------
  function onboardingTenant(customerTenantId: number, notFound: () => never, fail: (status: number, code: string, detail?: string) => never) {
    const tenant = allCustomers().find((row) => row.id === customerTenantId);
    if (tenant === undefined) return notFound();
    const stage = customerProfileOf(tenant.id)?.onboardingStage ?? null;
    if (tenant.kind !== 'buyer' || stage === null) {
      return fail(409, 'ONBOARDING_NOT_APPLICABLE', 'Supplier organizations register themselves and have no onboarding plan.');
    }
    return { tenant, stage };
  }

  mockRoute(app, api.getOnboarding, ({ params, notFound, fail }) => {
    const { tenant, stage } = onboardingTenant(params.customerTenantId, notFound, fail);
    return onboardingView(tenant, onboardingItemsOf(tenant.id), stage);
  });

  mockRoute(app, api.updateOnboardingItem, ({ params, body, now, notFound, fail }) => {
    const { tenant } = onboardingTenant(params.customerTenantId, notFound, fail);
    const item = onboardingItemsOf(tenant.id).find((row) => row.id === params.itemId);
    if (item === undefined) return notFound();
    const note = body.note ?? item.note;
    if (body.status === 'blocked' && (note === null || note.trim().length === 0)) {
      fail(422, 'NOTE_REQUIRED_FOR_BLOCKED', 'Explain what blocks the item.');
    }
    const done = body.status === 'done' || body.status === 'not_applicable';
    return { ...item, status: body.status, note, resolvedAt: done ? isoNow(now) : null };
  });

  mockRoute(app, api.advanceOnboarding, ({ params, body, notFound, fail }) => {
    const { tenant, stage } = onboardingTenant(params.customerTenantId, notFound, fail);
    const next = nextOnboardingStage(stage);
    if (next === null || body.toStage !== next) {
      fail(409, 'STAGE_TRANSITION_INVALID', next === null ? `Onboarding cannot advance from ${stage}.` : `The next stage is ${next}.`);
    }
    const items = onboardingItemsOf(tenant.id);
    const blocking = openBlockingItems(items);
    if (blocking.length > 0) {
      fail(409, 'ONBOARDING_ITEMS_OPEN', `${blocking.length} blocking item(s) are still open: ${blocking.map((item) => item.title).join('; ')}.`);
    }
    return onboardingView(tenant, items, body.toStage as TenantsOnboardingStage);
  });

  // ---------------------------------------------------------------------------------------------------
  // Offboarding (OPS-02, AC-36)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listOffboardingPlans, ({ query, fixtures }) => {
    const rows = OFFBOARDING_PLANS.map(offboardingRow)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.ownerUserId === undefined || row.owner?.userId === query.ownerUserId)
      .filter((row) => withinDates(row.serviceEndDate, query.serviceEndFrom, query.serviceEndTo))
      .filter((row) => matchesText(query.q, row.customer.name, row.customer.slug));
    const sort = query.sort ?? 'updatedAt';
    const sorted = sortRows(rows, (row) => (sort === 'customer' ? row.customer.name : row[sort]), query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function findPlan(planId: number): FixtureOffboardingPlan | undefined {
    return OFFBOARDING_PLANS.find((plan) => plan.id === planId);
  }

  mockRoute(app, api.getOffboardingPlan, ({ params, now, notFound }) => {
    const plan = findPlan(params.planId);
    if (plan === undefined) return notFound();
    return offboardingDetail(plan, operatorViewer(now));
  });

  mockRoute(app, api.createOffboardingPlan, ({ params, body, requirePersona, now, notFound, fail }) => {
    const tenant = allCustomers().find((row) => row.id === params.customerTenantId);
    if (tenant === undefined) return notFound();
    if (tenant.kind !== 'buyer') {
      fail(409, 'OFFBOARDING_NOT_APPLICABLE', 'Only buyer customers have offboarding plans; supplier accounts are closed by their administrators.');
    }
    if (offboardingPlanOf(tenant.id) !== undefined) {
      fail(409, 'OFFBOARDING_PLAN_EXISTS', 'This customer already has an offboarding plan.');
    }
    const at = isoNow(now);
    return offboardingDetail({
      id: 900,
      customerTenantId: tenant.id,
      status: 'draft',
      reason: body.reason,
      serviceEndDate: body.serviceEndDate,
      continuityPlan: null,
      supplierAccessPlan: null,
      retentionResponsibilities: null,
      disposalTimetable: null,
      exportRequestId: null,
      agreedByCustomerAt: null,
      ownerUserId: requirePersona().userId,
      createdAt: at,
      updatedAt: at,
    }, operatorViewer(now));
  });

  mockRoute(app, api.updateOffboardingPlan, ({ params, body, now, notFound, fail }) => {
    const plan = findPlan(params.planId);
    if (plan === undefined) return notFound();
    if (plan.status === 'completed') {
      fail(409, 'OFFBOARDING_PLAN_LOCKED', 'A completed offboarding plan cannot be changed.');
    }
    if (body.ownerUserId !== undefined && !isOperatorUser(body.ownerUserId)) {
      fail(422, 'SERVICE_OWNER_NOT_OPERATOR', 'The plan owner must be a platform operator.');
    }
    const changedAgreedText =
      plan.agreedByCustomerAt !== null &&
      (body.continuityPlan !== undefined || body.supplierAccessPlan !== undefined || body.retentionResponsibilities !== undefined);
    return offboardingDetail({
      ...plan,
      serviceEndDate: body.serviceEndDate ?? plan.serviceEndDate,
      continuityPlan: body.continuityPlan ?? plan.continuityPlan,
      supplierAccessPlan: body.supplierAccessPlan ?? plan.supplierAccessPlan,
      retentionResponsibilities: body.retentionResponsibilities ?? plan.retentionResponsibilities,
      disposalTimetable: body.disposalTimetable ?? plan.disposalTimetable,
      ownerUserId: body.ownerUserId ?? plan.ownerUserId,
      // A change to agreed text needs the customer's agreement again.
      agreedByCustomerAt: changedAgreedText ? null : plan.agreedByCustomerAt,
      status: changedAgreedText && plan.status === 'agreed' ? 'draft' : plan.status,
      updatedAt: isoNow(now),
    }, operatorViewer(now));
  });

  mockRoute(app, api.transitionOffboardingPlan, ({ params, body, now, notFound, fail }) => {
    const plan = findPlan(params.planId);
    if (plan === undefined) return notFound();
    const next = nextPlanStatus(plan.status);
    const target: OffboardingPlansStatus = body.toStatus;
    if (next === null || target !== next) {
      fail(409, 'OFFBOARDING_TRANSITION_INVALID', next === null ? 'The plan is completed.' : `The next status is ${next}.`);
    }
    if (target === 'agreed' && !planSectionsComplete(plan)) {
      fail(409, 'CONTINUITY_PLAN_INCOMPLETE', 'Write the continuity plan, supplier access and retention responsibilities first.');
    }
    if (target === 'agreed' && plan.agreedByCustomerAt === null) {
      fail(409, 'CUSTOMER_AGREEMENT_REQUIRED', 'The customer administrator must agree the plan in ADM-17 before it is agreed.');
    }
    if (target === 'completed') {
      const detail = offboardingDetail(plan, operatorViewer(now));
      if (detail.exportRequest?.status !== 'ready') {
        fail(409, 'EXIT_EXPORT_NOT_READY', 'The exit export package must be ready before the plan is completed.');
      }
      if (hasLiveObligations(plan.customerTenantId)) {
        fail(409, 'LIVE_OBLIGATIONS_REMAIN', 'Live events or contracts remain. Complete or transfer them under the continuity plan first.');
      }
    }
    return offboardingDetail({ ...plan, status: target, updatedAt: isoNow(now) }, operatorViewer(now));
  });

  // ---------------------------------------------------------------------------------------------------
  // Plans and subscriptions (OPS-03)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.getPlanCatalog, () => ({
    plans: PLAN_DEFINITIONS.map(
      (plan): PlanDefinition => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        annualFee: { amount: plan.annualFee, currency: 'BWP' },
        entitlements: Object.entries(plan.limits).map(([featureCode, limitValue]) => {
          const code = featureCode as keyof typeof FEATURE_LABELS;
          return { featureCode: code, label: FEATURE_LABELS[code].label, unit: FEATURE_LABELS[code].unit, limitValue: limitValue ?? null };
        }),
        optionalServices: [...plan.optionalServices],
        customers: CUSTOMER_PROFILES.filter((profile) => profile.planCode === plan.code).length,
      }),
    ),
    supplierAccessNote:
      'Suppliers view public notices and take part in eligible competitions free of charge. No plan or optional service changes eligibility, ranking or access to a competition (BR-46).',
  }));

  mockRoute(app, api.listSubscriptions, ({ query, fixtures }) => {
    const rows = SUBSCRIPTIONS.map(subscriptionRow)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.planCode === undefined || query.planCode.includes(row.planCode))
      .filter((row) => query.customerTenantId === undefined || row.customer.tenantId === query.customerTenantId)
      .filter((row) => withinDates(row.renewsAt, query.renewsFrom, query.renewsTo))
      .filter((row) => query.hasOpenServiceActions === undefined || (row.openServiceActions > 0) === query.hasOpenServiceActions)
      .filter((row) => matchesText(query.q, row.customer.name, row.commercialContact));
    const sort = query.sort ?? 'customer';
    const sorted = sortRows(rows, (row) => (sort === 'customer' ? row.customer.name : row[sort]), query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getSubscription, ({ params, notFound }) => {
    const subscription = SUBSCRIPTIONS.find((row) => row.id === params.subscriptionId);
    if (subscription === undefined) return notFound();
    return subscriptionDetail(subscription);
  });

  mockRoute(app, api.updateSubscription, ({ params, body, notFound, fail }) => {
    const subscription = SUBSCRIPTIONS.find((row) => row.id === params.subscriptionId);
    if (subscription === undefined) return notFound();
    if (subscription.status === 'ended') {
      fail(409, 'SUBSCRIPTION_ENDED', 'An ended subscription cannot be changed.');
    }
    const status = body.status ?? subscription.status;
    if (status === 'trial' && subscription.status !== 'trial') {
      fail(409, 'SUBSCRIPTION_TRANSITION_INVALID', 'A paid subscription cannot return to trial.');
    }
    if (
      (status === 'cancelled' || status === 'ended') &&
      status !== subscription.status &&
      hasLiveObligations(subscription.customerTenantId) &&
      !hasAgreedPlan(subscription.customerTenantId)
    ) {
      fail(
        409,
        'CONTINUITY_PLAN_REQUIRED',
        'The customer has live events or contracts. Agree its offboarding plan before cancelling or ending the subscription (BR-47).',
      );
    }
    return subscriptionDetail({
      ...subscription,
      planCode: body.planCode ?? subscription.planCode,
      status,
      renewsAt: body.renewsAt === undefined ? subscription.renewsAt : body.renewsAt,
      commercialContact: body.commercialContact ?? subscription.commercialContact,
      notes: body.notes ?? subscription.notes,
    });
  });

  mockRoute(app, api.updateEntitlement, ({ params, body, requirePersona, now, notFound, fail }) => {
    const subscription = SUBSCRIPTIONS.find((row) => row.id === params.subscriptionId);
    if (subscription === undefined) return notFound();
    if (subscription.status === 'ended') {
      fail(409, 'SUBSCRIPTION_ENDED', 'An ended subscription cannot be changed.');
    }
    const current = ENTITLEMENTS.find((row) => row.subscriptionId === subscription.id && row.featureCode === params.featureCode);
    if (current === undefined) {
      fail(404, 'ENTITLEMENT_NOT_IN_SUBSCRIPTION', 'This feature is not part of the subscription.');
    }
    const usage = entitlementsOf(subscription.id).find((row) => row.featureCode === params.featureCode);
    const usageValue = usage?.usageValue ?? 0;
    const entitlement: EntitlementUsage = {
      featureCode: params.featureCode,
      label: FEATURE_LABELS[params.featureCode].label,
      unit: FEATURE_LABELS[params.featureCode].unit,
      limitValue: body.limitValue,
      usageValue,
      limitReached: body.limitValue !== null && usageValue >= body.limitValue,
    };
    const serviceAction = entitlement.limitReached
      ? serviceActionView({
          id: 900,
          subscriptionId: subscription.id,
          featureCode: params.featureCode,
          description: `Usage (${usageValue}) is at or above the new limit (${body.limitValue ?? 0}). The account team agrees the next step with the customer; no submission is blocked.`,
          status: 'open',
          ownerUserId: requirePersona().userId,
          raisedAt: isoNow(now),
          resolvedAt: null,
          resolution: null,
        })
      : null;
    return { subscriptionId: subscription.id, entitlement, serviceAction };
  });

  mockRoute(app, api.resolveServiceAction, ({ params, body, now, notFound, fail }) => {
    const action = SERVICE_ACTIONS.find((row) => row.id === params.actionId);
    if (action === undefined) return notFound();
    if (action.status === 'resolved') {
      fail(409, 'SERVICE_ACTION_RESOLVED', 'This service action is already resolved.');
    }
    return { ...serviceActionView(action), status: 'resolved', resolvedAt: isoNow(now), resolution: body.resolution };
  });
}
