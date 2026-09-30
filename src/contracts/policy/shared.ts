/**
 * Policy contract, shared pieces: permission sets, custom-field rules (PRD §17.3) and the pure helpers that the
 * SPA (CustomFieldsSection), the mock API and Stage B all use to evaluate conditional required fields.
 *
 * - A custom field is `optional`, `required`, or `conditional`: it is required when its condition source (another
 *   custom field of the same entity type, or one of the entity's core fields in `CUSTOM_FIELD_CORE_CONDITIONS`)
 *   currently holds `required_condition_value` (`custom_fields.required_condition_field` / `_value`).
 * - Values travel as strings, decimal strings (number fields, DD-32), `YYYY-MM-DD` (date fields) or booleans. A
 *   number is never a JS float.
 * - Customization must not hide a mandatory control or introduce undisclosed scoring (PRD §17.3): keys that shadow
 *   core fields (`RESERVED_CUSTOM_FIELD_KEYS`) or that look like scoring inputs are refused.
 */
import { z } from 'zod';

import { DecimalString, issue } from '../common.js';
import { compare } from '../decimal.js';
import type { EndpointPermission } from '../endpoint.js';
import type { CustomFieldsEntityType, CustomFieldsFieldType, CustomFieldsRequiredMode } from '../enums.js';

// ---------------------------------------------------------------------------------------------------------
// Permission sets
// ---------------------------------------------------------------------------------------------------------

/** Reading policy profiles: administrators, approvers and auditors (ADM-06). */
export const POLICY_PROFILE_READ: EndpointPermission = ['org.policy.manage', 'org.policy.approve', 'audit.view'];
/** Choosing a policy version on a strategy or a tender. */
export const POLICY_PROFILE_PICK: EndpointPermission = [
  'org.policy.manage',
  'strategy.manage',
  'tender.create',
  'tender.edit',
];
/** Reading custom field definitions on ADM-07. */
export const CUSTOM_FIELD_ADMIN_READ: EndpointPermission = ['org.fields.manage', 'audit.view'];
/** Reading the active fields of a form (the request, tender, qualification and contract screens embed them). */
export const CUSTOM_FIELD_FORM_READ: EndpointPermission = [
  'org.fields.manage',
  'request.create',
  'request.view_all',
  'request.review',
  'tender.view',
  'tender.create',
  'tender.edit',
  'qualification.review',
  'qualification.financial_review',
  'qualification.decide',
  'contract.view',
  'contract.prepare',
  'audit.view',
];
/** Supplier forms: qualification applications and responses show the supplier-visible fields of the buyer. */
export const SUPPLIER_CUSTOM_FIELD_FORM_READ: EndpointPermission = [
  'supplier.qualification.apply',
  'supplier.opportunities.view',
  'supplier.response.edit',
  'supplier.contract.participate',
];
/** Reading the template library on ADM-08. */
export const TEMPLATE_ADMIN_READ: EndpointPermission = ['org.templates.manage', 'org.templates.approve', 'audit.view'];
/** Choosing a template on a tender, strategy or contract. */
export const TEMPLATE_PICK: EndpointPermission = [
  'org.templates.manage',
  'strategy.manage',
  'tender.create',
  'tender.edit',
  'contract.prepare',
];
/** Reading the portal and publication policy on ADM-11. */
export const PORTAL_POLICY_READ: EndpointPermission = ['org.portal.manage', 'org.settings.manage', 'tender.publish', 'audit.view'];

// ---------------------------------------------------------------------------------------------------------
// Custom field keys and conditions
// ---------------------------------------------------------------------------------------------------------

/**
 * Core fields a condition may refer to, per entity type. The host form supplies their current values as the
 * `context` of the evaluation (for example the selected category code or the value band of the estimate).
 */
export const CUSTOM_FIELD_CORE_CONDITIONS = {
  procurement_request: ['category_code', 'procedure', 'value_band'],
  tender: ['category_code', 'procedure', 'event_type', 'participation', 'value_band'],
  qualification_application: ['category_code'],
  contract: ['category_code', 'value_band'],
} as const satisfies Record<CustomFieldsEntityType, readonly string[]>;

/** Every core condition source name. */
export const CORE_CONDITION_SOURCES = [
  'category_code',
  'procedure',
  'event_type',
  'participation',
  'value_band',
] as const;
export type CoreConditionSource = (typeof CORE_CONDITION_SOURCES)[number];

/** The value bands a `value_band` condition compares with. Bounds are in the record's own currency. */
export const VALUE_BANDS = ['low', 'medium', 'high'] as const;
export type ValueBand = (typeof VALUE_BANDS)[number];
/** `low` below 500 000.00, `medium` up to (excluding) 5 000 000.00, `high` from 5 000 000.00. */
export const VALUE_BAND_BOUNDS = { medium: '500000.00', high: '5000000.00' } as const;

/** The value band of an amount (decimal string, never a float). */
export function valueBandOf(amount: string): ValueBand {
  if (compare(amount, VALUE_BAND_BOUNDS.high) >= 0) return 'high';
  if (compare(amount, VALUE_BAND_BOUNDS.medium) >= 0) return 'medium';
  return 'low';
}

/**
 * Keys that would shadow a mandatory core control of the extended records (title, deadlines, values, owners,
 * evaluation). A custom field can add information; it can never replace or hide these (PRD §17.3).
 */
export const RESERVED_CUSTOM_FIELD_KEYS = [
  'id',
  'reference',
  'title',
  'summary',
  'status',
  'owner',
  'owner_user_id',
  'procedure',
  'event_type',
  'participation',
  'category',
  'category_code',
  'currency',
  'estimated_value',
  'budget_amount',
  'value_band',
  'official_time_zone',
  'submission_deadline',
  'question_deadline',
  'opening_mode',
  'legal_entity',
  'policy_profile_version',
  'evaluation_criteria',
] as const;

/** Keys that suggest an undisclosed scoring input; scoring belongs to the published evaluation method. */
const SCORING_KEY_PATTERN = /(^|_)(score|scores|scoring|weight|weighting|points|rank|ranking)(_|$)/;

export const CustomFieldKey = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,62}$/, issue('INVALID_FIELD_KEY', 'Use 2–63 lowercase letters, digits and underscores, starting with a letter.'))
  .refine(
    (key) => !(RESERVED_CUSTOM_FIELD_KEYS as readonly string[]).includes(key),
    issue('FIELD_KEY_RESERVED', 'This key belongs to a mandatory core field and cannot be redefined.'),
  )
  .refine(
    (key) => !SCORING_KEY_PATTERN.test(key),
    issue('SCORING_FIELD_NOT_ALLOWED', 'Custom fields cannot carry scores or weights; use the published evaluation method.'),
  );

/** One value of a custom field: text/choice/date as a string, a number as a decimal string, or a boolean. */
export const CustomFieldValue = z.union([z.string().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')), z.boolean(), z.null()]);
export type CustomFieldValue = z.infer<typeof CustomFieldValue>;

/** The custom field values of one record, keyed by field key. */
export const CustomFieldValues = z.record(z.string(), CustomFieldValue);
export type CustomFieldValues = z.infer<typeof CustomFieldValues>;

/** Core field values supplied by the host form for conditions (see `CUSTOM_FIELD_CORE_CONDITIONS`). */
export type CustomFieldContext = Partial<Record<CoreConditionSource, string | null>>;

/** The definition subset the evaluation needs (a `CustomFieldDefinition` fits). */
export interface CustomFieldRule {
  readonly key: string;
  readonly label: string;
  readonly fieldType: CustomFieldsFieldType;
  readonly allowedValues: readonly string[];
  readonly requiredMode: CustomFieldsRequiredMode;
  readonly requiredConditionField: string | null;
  readonly requiredConditionValue: string | null;
}

/** One problem with a record's custom field values. */
export interface CustomFieldIssue {
  readonly key: string;
  readonly code: 'CUSTOM_FIELD_REQUIRED' | 'CUSTOM_FIELD_INVALID_NUMBER' | 'CUSTOM_FIELD_INVALID_DATE' | 'CUSTOM_FIELD_INVALID_CHOICE' | 'CUSTOM_FIELD_INVALID_BOOLEAN' | 'CUSTOM_FIELD_INVALID_TEXT' | 'CUSTOM_FIELD_UNKNOWN';
  readonly message: string;
}

function conditionValueToText(value: CustomFieldValue | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function isBlank(value: CustomFieldValue | undefined): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/** Whether a field is required given the other values of the record and the host form's core values. */
export function isCustomFieldRequired(
  rule: CustomFieldRule,
  values: Readonly<CustomFieldValues>,
  context: CustomFieldContext = {},
): boolean {
  if (rule.requiredMode === 'required') return true;
  if (rule.requiredMode === 'optional' || rule.requiredConditionField === null) return false;
  const source = rule.requiredConditionField;
  const current = (CORE_CONDITION_SOURCES as readonly string[]).includes(source)
    ? (context[source as CoreConditionSource] ?? null)
    : conditionValueToText(values[source]);
  return current !== null && current === rule.requiredConditionValue;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function typeIssue(rule: CustomFieldRule, value: CustomFieldValue): CustomFieldIssue | null {
  if (value === null) return null;
  switch (rule.fieldType) {
    case 'boolean':
      return typeof value === 'boolean'
        ? null
        : { key: rule.key, code: 'CUSTOM_FIELD_INVALID_BOOLEAN', message: `${rule.label}: choose yes or no.` };
    case 'number':
      return typeof value === 'string' && DecimalString.safeParse(value.trim()).success
        ? null
        : { key: rule.key, code: 'CUSTOM_FIELD_INVALID_NUMBER', message: `${rule.label}: enter a number such as 12.50.` };
    case 'date':
      return typeof value === 'string' && DATE_PATTERN.test(value.trim()) && !Number.isNaN(Date.parse(`${value.trim()}T00:00:00Z`))
        ? null
        : { key: rule.key, code: 'CUSTOM_FIELD_INVALID_DATE', message: `${rule.label}: enter a date such as 2026-10-14.` };
    case 'choice':
      return typeof value === 'string' && rule.allowedValues.includes(value)
        ? null
        : { key: rule.key, code: 'CUSTOM_FIELD_INVALID_CHOICE', message: `${rule.label}: choose one of the listed values.` };
    case 'text':
      return typeof value === 'string'
        ? null
        : { key: rule.key, code: 'CUSTOM_FIELD_INVALID_TEXT', message: `${rule.label}: enter text.` };
  }
}

/**
 * Validates a record's custom field values against the active definitions: required and conditionally required
 * fields, value types and choice lists, and unknown keys. Returns an empty list when the values are acceptable.
 */
export function validateCustomFieldValues(
  rules: readonly CustomFieldRule[],
  values: Readonly<CustomFieldValues>,
  context: CustomFieldContext = {},
): CustomFieldIssue[] {
  const issues: CustomFieldIssue[] = [];
  const known = new Set(rules.map((rule) => rule.key));
  for (const key of Object.keys(values)) {
    if (!known.has(key)) {
      issues.push({ key, code: 'CUSTOM_FIELD_UNKNOWN', message: `${key} is not an active field of this form.` });
    }
  }
  for (const rule of rules) {
    const value = values[rule.key];
    if (isBlank(value)) {
      if (isCustomFieldRequired(rule, values, context)) {
        issues.push({ key: rule.key, code: 'CUSTOM_FIELD_REQUIRED', message: `${rule.label} is required.` });
      }
      continue;
    }
    const problem = typeIssue(rule, value ?? null);
    if (problem !== null) issues.push(problem);
  }
  return issues;
}
