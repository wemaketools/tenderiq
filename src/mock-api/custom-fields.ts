/**
 * Custom business field values on the request, tender, qualification application and contract forms (ADM-07,
 * PRD §17.3) for the handlers of the owning domains.
 *
 * Every form accepts `customFields` and validates it with the contract's pure helper `validateCustomFieldValues`
 * against the organization's active definitions (the policy fixtures), exactly as Stage B does:
 * - a save rejects values of the wrong type, choices outside the list and unknown keys (422, `customFields.<key>`);
 * - completeness (required and conditionally required fields) is checked where the record leaves the draft stage:
 *   request submission, tender release approval request, application submission and contract approval request.
 * A supplier (qualification applications) sees and edits only the buyer's supplier-visible and public fields.
 */
import type { FieldError } from '../contracts/common.js';
import type { CustomFieldsEntityType } from '../contracts/enums.js';
import { validateCustomFieldValues } from '../contracts/policy.js';
import type { CustomFieldContext, CustomFieldIssue, CustomFieldRule, CustomFieldValues } from '../contracts/policy.js';
import { CUSTOM_FIELD_VALUES, CUSTOM_FIELDS } from './fixtures/policy/fields.js';
import { validationError } from './middleware/problem.js';

/** Whose view of the form: the buyer sees every field; a supplier only supplier-visible and public ones. */
export type CustomFieldAudience = 'buyer' | 'supplier';

/** The active field definitions of one form of one buyer, in display order. */
export function customFieldRules(
  tenantId: number,
  entityType: CustomFieldsEntityType,
  audience: CustomFieldAudience = 'buyer',
): CustomFieldRule[] {
  return CUSTOM_FIELDS.filter(
    (field) =>
      field.tenantId === tenantId &&
      field.entityType === entityType &&
      field.active &&
      (audience === 'buyer' || field.audience !== 'buyer_internal'),
  ).sort((left, right) => left.sortOrder - right.sortOrder);
}

/** The stored custom field values of a record (empty when none were recorded). */
export function customFieldValuesOf(tenantId: number, entityType: CustomFieldsEntityType, recordId: number): CustomFieldValues {
  const row = CUSTOM_FIELD_VALUES.find((entry) => entry.tenantId === tenantId && entry.entityType === entityType && entry.recordId === recordId);
  return { ...(row?.values ?? {}) };
}

/** The values a supplier may see: those of the buyer's supplier-visible and public fields. */
export function supplierVisibleValues(tenantId: number, entityType: CustomFieldsEntityType, values: Readonly<CustomFieldValues>): CustomFieldValues {
  const visible = new Set(customFieldRules(tenantId, entityType, 'supplier').map((rule) => rule.key));
  return Object.fromEntries(Object.entries(values).filter(([key]) => visible.has(key)));
}

/** The problems of a record's values; `complete` also reports missing required and conditionally required fields. */
export function customFieldIssues(
  tenantId: number,
  entityType: CustomFieldsEntityType,
  values: Readonly<CustomFieldValues>,
  context: CustomFieldContext,
  complete: boolean,
  audience: CustomFieldAudience = 'buyer',
): CustomFieldIssue[] {
  const issues = validateCustomFieldValues(customFieldRules(tenantId, entityType, audience), values, context);
  return complete ? issues : issues.filter((issue) => issue.code !== 'CUSTOM_FIELD_REQUIRED');
}

/** `customFields.<key>` field errors (brief §5.3). */
export function customFieldErrors(issues: readonly CustomFieldIssue[]): FieldError[] {
  return issues.map((issue) => ({ field: `customFields.${issue.key}`, code: issue.code, message: issue.message }));
}

/**
 * Validates the values a save sends (type, choice and unknown-key problems) and returns the record's values after the
 * save; throws the 422 validation problem when a value is not acceptable. `undefined` keeps the stored values. A
 * supplier's save keeps the buyer-internal values it cannot see.
 */
export function acceptCustomFields(
  tenantId: number,
  entityType: CustomFieldsEntityType,
  sent: Readonly<CustomFieldValues> | undefined,
  stored: Readonly<CustomFieldValues>,
  context: CustomFieldContext,
  audience: CustomFieldAudience = 'buyer',
): CustomFieldValues {
  if (sent === undefined) {
    return { ...stored };
  }
  const issues = customFieldIssues(tenantId, entityType, sent, context, false, audience);
  if (issues.length > 0) {
    throw validationError(customFieldErrors(issues));
  }
  if (audience === 'buyer') {
    return { ...sent };
  }
  const visible = new Set(customFieldRules(tenantId, entityType, 'supplier').map((rule) => rule.key));
  const hidden = Object.fromEntries(Object.entries(stored).filter(([key]) => !visible.has(key)));
  return { ...hidden, ...sent };
}
