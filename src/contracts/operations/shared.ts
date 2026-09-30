/**
 * Operations contract (domain 16): building blocks shared by the operator area (OPS-01..07), the buyer
 * integration, import and subscription screens (ADM-15..17) and the help and service-case centre (COM-09).
 *
 * Contract-defined enumerations live here until Integration moves them into `enums.ts`. They cover columns the
 * blueprint leaves as free text (`service_incidents.severity`, `subscriptions.plan_code`, `entitlements.feature_code`)
 * and records the blueprint does not yet table (onboarding checklist items, invoices, service actions, privileged
 * access reviews, conduct cases); each is reported as a follow-up so Stage B adds the matching CHECK list or table.
 *
 * Operator views carry service metadata only: customer identity, plans, counts and references. They never carry
 * tender content, bids, evaluation or supplier evidence (PRD §4.3, OPS-01, OPS-06).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { ACCESS_REVIEW_OUTCOMES, ACCESS_REVIEW_STATUSES, CONDUCT_CASE_KINDS, CONDUCT_CASE_STATUSES, INVOICE_STATUSES, ONBOARDING_ITEM_AREAS, ONBOARDING_ITEM_STATUSES, PLAN_CODES, SERVICE_ACTION_STATUSES, SERVICE_INCIDENT_SEVERITIES } from '../enums.js';

export { ACCESS_REVIEW_OUTCOMES, ACCESS_REVIEW_STATUSES, CONDUCT_CASE_KINDS, CONDUCT_CASE_STATUSES, INVOICE_STATUSES, ONBOARDING_ITEM_AREAS, ONBOARDING_ITEM_STATUSES, PLAN_CODES, SERVICE_ACTION_STATUSES, SERVICE_INCIDENT_SEVERITIES };

import { Id, Instant, PersonRef, Slug, issue } from '../common.js';
import { TenantsKind, TenantsStatus } from '../enums.js';

// ---------------------------------------------------------------------------------------------------------
// Contract-defined enumerations
// ---------------------------------------------------------------------------------------------------------

/** `service_incidents.severity` (free text in the blueprint; fixed here). */
export const ServiceIncidentSeverity = z.enum(SERVICE_INCIDENT_SEVERITIES, {
  error: issue('INVALID_SEVERITY', 'Choose low, medium, high or critical.'),
});
export type ServiceIncidentSeverity = z.infer<typeof ServiceIncidentSeverity>;

/** `subscriptions.plan_code` / `tenants.plan_code`: the buyer packages (PRD §21.1). Suppliers use the platform free of charge. */
export const PlanCode = z.enum(PLAN_CODES, { error: issue('PLAN_UNKNOWN', 'Choose one of the offered plans.') });
export type PlanCode = z.infer<typeof PlanCode>;

/** `entitlements.feature_code`: the metered or included capabilities of a plan. */
export const ENTITLEMENT_FEATURE_CODES = [
  'named_users',
  'legal_entities',
  'published_events_per_year',
  'active_contracts',
  'storage_gb',
  'integrations',
  'reporting_pack',
  'onboarding_days',
] as const;
export const EntitlementFeatureCode = z.enum(ENTITLEMENT_FEATURE_CODES, {
  error: issue('ENTITLEMENT_UNKNOWN', 'Not a feature of the plan catalog.'),
});
export type EntitlementFeatureCode = z.infer<typeof EntitlementFeatureCode>;

/** Commercial invoice state (OPS-03 "invoices and disputes"; no blueprint table yet). */
export const InvoiceStatus = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

/**
 * A service-management action raised when usage reaches a commercial limit (PRD §21.1). It never blocks an
 * invited supplier's submission: the contract states `blocksSubmissions: false` on every action.
 */
export const ServiceActionStatus = z.enum(SERVICE_ACTION_STATUSES);
export type ServiceActionStatus = z.infer<typeof ServiceActionStatus>;

/** Onboarding checklist areas (OPS-02: agreed setup, ownership checks, adoption tasks, unresolved issues). */
export const OnboardingItemArea = z.enum(ONBOARDING_ITEM_AREAS);
export type OnboardingItemArea = z.infer<typeof OnboardingItemArea>;

export const OnboardingItemStatus = z.enum(ONBOARDING_ITEM_STATUSES, {
  error: issue('INVALID_ITEM_STATUS', 'Choose open, in progress, done, blocked or not applicable.'),
});
export type OnboardingItemStatus = z.infer<typeof OnboardingItemStatus>;

/** Privileged-access review state and outcome (OPS-06). */
export const AccessReviewStatus = z.enum(ACCESS_REVIEW_STATUSES);
export type AccessReviewStatus = z.infer<typeof AccessReviewStatus>;

export const AccessReviewOutcome = z.enum(ACCESS_REVIEW_OUTCOMES, {
  error: issue('INVALID_OUTCOME', 'Choose retain, reduce or revoke.'),
});
export type AccessReviewOutcome = z.infer<typeof AccessReviewOutcome>;

/** Service conduct cases (OPS-06: service complaints and misuse cases). */
export const ConductCaseKind = z.enum(CONDUCT_CASE_KINDS);
export type ConductCaseKind = z.infer<typeof ConductCaseKind>;

export const ConductCaseStatus = z.enum(CONDUCT_CASE_STATUSES);
export type ConductCaseStatus = z.infer<typeof ConductCaseStatus>;

/** Readiness of a consequential step (offboarding completion, onboarding stage change). Same states as the SPA ReadinessChecklist. */
export const READINESS_STATUSES = ['blocking', 'warning', 'passed'] as const;
export const ReadinessStatus = z.enum(READINESS_STATUSES);
export type ReadinessStatus = z.infer<typeof ReadinessStatus>;

/** Records an import row can create (`import_records.created_entity_type`). */
export const IMPORT_CREATED_ENTITY_TYPES = ['supplier_tenant', 'contract', 'historical_tender'] as const;
export const ImportCreatedEntityType = z.enum(IMPORT_CREATED_ENTITY_TYPES);
export type ImportCreatedEntityType = z.infer<typeof ImportCreatedEntityType>;

/** How a reviewer settles a duplicate candidate when accepting an import row (ADM-16, BR-44). */
export const DUPLICATE_RESOLUTIONS = ['link_existing', 'create_new'] as const;
export const DuplicateResolution = z.enum(DUPLICATE_RESOLUTIONS, {
  error: issue('INVALID_DUPLICATE_RESOLUTION', 'Choose link to the existing record or create a new record.'),
});
export type DuplicateResolution = z.infer<typeof DuplicateResolution>;

/** Records an integration exception can concern (`integration_exceptions.record_type`). */
export const INTEGRATION_RECORD_TYPES = ['publication', 'contract', 'membership', 'supplier', 'export', 'notice'] as const;
export const IntegrationRecordType = z.enum(INTEGRATION_RECORD_TYPES);
export type IntegrationRecordType = z.infer<typeof IntegrationRecordType>;

/** How an integration exception is settled (a subset of `integration_exceptions.status`). */
export const EXCEPTION_RESOLUTIONS = ['reconciled', 'manual_fallback_used', 'closed'] as const;
export const ExceptionResolution = z.enum(EXCEPTION_RESOLUTIONS, {
  error: issue('INVALID_RESOLUTION', 'Choose reconciled, manual fallback used or closed.'),
});
export type ExceptionResolution = z.infer<typeof ExceptionResolution>;

// ---------------------------------------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------------------------------------

/** A customer organization as the operator sees it: identity only. */
export const CustomerLabel = z.object({
  tenantId: Id,
  slug: Slug,
  name: z.string().min(1),
  kind: TenantsKind,
});
export type CustomerLabel = z.infer<typeof CustomerLabel>;

/** A customer label with its account status. */
export const CustomerStatusLabel = CustomerLabel.extend({
  status: TenantsStatus,
});
export type CustomerStatusLabel = z.infer<typeof CustomerStatusLabel>;

/** One readiness check before a consequential step. */
export const ReadinessCheck = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().nullable(),
  status: ReadinessStatus,
});
export type ReadinessCheck = z.infer<typeof ReadinessCheck>;

/** One entry of an activity history (support activity, incident timeline, exception history). */
export const ActivityEntry = z.object({
  id: Id,
  at: Instant,
  actor: PersonRef.nullable(),
  /** Stable action code such as `grant.authorized`. */
  action: z.string().min(1),
  description: z.string().min(1),
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;

/**
 * A body enumeration with a coded field error (brief §5.3). zod's default enum message lists the options joined
 * by `|`, which the `"CODE|message"` convention would split into a nonsense code.
 */
export function choice<const T extends readonly [string, ...string[]]>(values: T, code: string, message: string) {
  return z.enum(values, { error: issue(code, message) });
}

/** Optional free text of at most `max` characters, with coded errors. */
export function optionalText(max: number) {
  return z
    .string({ error: issue('INVALID_TEXT', 'Enter text.') })
    .trim()
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));
}

/** Optional note text (0..4000). */
export const NoteText = optionalText(4000);

/** Required short title text. */
export function titleText(code: string, max = 200) {
  return z
    .string({ error: issue(code, 'A title is required.') })
    .trim()
    .min(3, issue(code, 'At least 3 characters.'))
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));
}

/** Required body text. */
export function bodyText(code: string, max = 20000) {
  return z
    .string({ error: issue(code, 'This text is required.') })
    .trim()
    .min(1, issue(code, 'This text is required.'))
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));
}

/** An explicit `true` confirmation a consequential command requires (COM-02). */
export function confirmation(code: string, message: string) {
  return z.literal(true, { error: issue(code, message) });
}

/**
 * A tender reference in text (`T-2026-0002`). Product announcements must not carry formal tender notices
 * (OPS-07): the handler rejects announcement texts that name one.
 */
export const TENDER_REFERENCE_IN_TEXT = /\bT-\d{4}-\d{4}\b/;
