/**
 * Forms and business fields (ADM-07; PRD §17.1 "Forms and questionnaires", §17.3; blueprint Migration 03
 * `custom_fields`, `custom_field_values`).
 *
 * - A field is labelled, explained (`purpose`), assigned an audience, and optional, required, or conditionally
 *   required (`requiredConditionField` = `requiredConditionValue`). `validateCustomFieldValues` in
 *   `./shared.ts` evaluates the rules identically in the SPA, the mock API and Stage B.
 * - Issued forms are never changed silently: once records carrying the field have been issued (a released tender,
 *   a submitted application, a signed contract…), its key, type and existing choices are locked; label and purpose
 *   edits apply to new forms only, and deactivation hides the field from new forms while issued records keep their
 *   values.
 * - Once issued records carry a field, its audience may be narrowed but never widened (buyer_internal →
 *   supplier_visible → public): values captured for a narrower audience must not be disclosed silently (PRD §4.3,
 *   §18.1). Widening answers `AUDIENCE_WIDENING_REQUIRES_NEW_FIELD`; create a new field instead.
 * - Customization cannot hide a mandatory control or introduce undisclosed scoring (`CustomFieldKey`).
 * - Buyer forms read `form-definitions/:entityType`; supplier forms read only the supplier-visible and public
 *   fields of the buyer they deal with.
 *
 * Stage B storage mapping (blueprint amendment, see the policy domain follow-ups): the contract fields beyond the
 * blueprint columns are `custom_fields.purpose` (already listed), `created_by`, `created_at`, `updated_by`,
 * `updated_at` and `issued_record_count` (derived from `custom_field_values` on issued records); the change
 * history is read from `audit_log` entries of the field.
 */
import { z } from 'zod';

import { Id, IdParam, Instant, PersonRef, ReasonText, Slug, issue, listQueryWithSort, pageOf, queryList, QueryBoolean } from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { CUSTOM_FIELDS_AUDIENCE, CustomFieldsAudience, CustomFieldsEntityType, CustomFieldsFieldType, CustomFieldsRequiredMode } from '../enums.js';
import {
  CUSTOM_FIELD_ADMIN_READ,
  CUSTOM_FIELD_CORE_CONDITIONS,
  CUSTOM_FIELD_FORM_READ,
  CustomFieldKey,
  SUPPLIER_CUSTOM_FIELD_FORM_READ,
} from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Rows and details
// ---------------------------------------------------------------------------------------------------------

/** A field definition as a form needs it (the rule subset plus display data). */
export const CustomFieldDefinition = z.object({
  id: Id,
  entityType: CustomFieldsEntityType,
  key: z.string().min(1),
  label: z.string().min(1),
  purpose: z.string().min(1),
  fieldType: CustomFieldsFieldType,
  allowedValues: z.array(z.string().min(1)),
  requiredMode: CustomFieldsRequiredMode,
  requiredConditionField: z.string().nullable(),
  requiredConditionValue: z.string().nullable(),
  audience: CustomFieldsAudience,
  sortOrder: z.number().int().min(0),
});
export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinition>;

/** A field row on ADM-07. */
export const CustomFieldSummary = CustomFieldDefinition.extend({
  includeInReports: z.boolean(),
  active: z.boolean(),
  /** Records holding a value for this field. */
  valueCount: z.number().int().min(0),
  /** Of those, records already issued (their form is frozen). */
  issuedRecordCount: z.number().int().min(0),
  updatedAt: Instant,
  updatedBy: PersonRef.nullable(),
});
export type CustomFieldSummary = z.infer<typeof CustomFieldSummary>;

/** Another active field whose required condition reads this field. */
export const CustomFieldDependent = z.object({
  id: Id,
  key: z.string().min(1),
  label: z.string().min(1),
  requiredConditionValue: z.string().nullable(),
});

/** One recorded change of a definition (label, choices, requirement, activation). */
export const CustomFieldChange = z.object({
  at: Instant,
  by: PersonRef.nullable(),
  summary: z.string().min(1),
});

/**
 * Whether changing a field's audience from `from` to `to` discloses its values more widely (buyer_internal <
 * supplier_visible < public). Refused once issued records carry the field.
 */
export function widensAudience(from: CustomFieldsAudience, to: CustomFieldsAudience): boolean {
  return CUSTOM_FIELDS_AUDIENCE.indexOf(to) > CUSTOM_FIELDS_AUDIENCE.indexOf(from);
}

export const CustomFieldCapabilities = z.object({
  canEdit: z.boolean(),
  /**
   * Key, type and existing choices are locked once issued records carry the field, and the audience can then only
   * be narrowed (`AUDIENCE_WIDENING_REQUIRES_NEW_FIELD`).
   */
  structureLocked: z.boolean(),
  canDeactivate: z.boolean(),
  canReactivate: z.boolean(),
});

export const CustomFieldDetail = CustomFieldSummary.extend({
  createdAt: Instant,
  createdBy: PersonRef.nullable(),
  dependents: z.array(CustomFieldDependent),
  history: z.array(CustomFieldChange),
  capabilities: CustomFieldCapabilities,
});
export type CustomFieldDetail = z.infer<typeof CustomFieldDetail>;

/** The active fields of one form plus the core values its conditions may refer to. */
export const CustomFieldForm = z.object({
  entityType: CustomFieldsEntityType,
  fields: z.array(CustomFieldDefinition),
  /** Core fields a condition may read (`CUSTOM_FIELD_CORE_CONDITIONS[entityType]`). */
  coreConditionSources: z.array(z.string().min(1)),
});
export type CustomFieldForm = z.infer<typeof CustomFieldForm>;

// ---------------------------------------------------------------------------------------------------------
// Queries and bodies
// ---------------------------------------------------------------------------------------------------------

export const CUSTOM_FIELD_SORT_FIELDS = ['sortOrder', 'label', 'key', 'entityType', 'updatedAt'] as const;

export const CustomFieldListQuery = listQueryWithSort(CUSTOM_FIELD_SORT_FIELDS).extend({
  entityType: queryList(CustomFieldsEntityType).optional(),
  audience: queryList(CustomFieldsAudience).optional(),
  requiredMode: queryList(CustomFieldsRequiredMode).optional(),
  fieldType: queryList(CustomFieldsFieldType).optional(),
  active: QueryBoolean.optional(),
  includeInReports: QueryBoolean.optional(),
  updatedFrom: Instant.optional(),
  updatedTo: Instant.optional(),
});
export type CustomFieldListQuery = z.input<typeof CustomFieldListQuery>;

export const CustomFieldPage = pageOf(CustomFieldSummary);
export type CustomFieldPage = z.infer<typeof CustomFieldPage>;

export const FieldParams = z.object({ fieldId: IdParam });
export const FormParams = z.object({ entityType: CustomFieldsEntityType });
/** Suppliers see the qualification, tender and contract forms of a buyer (never the buyer's request form). */
export const SUPPLIER_FORM_ENTITY_TYPES = ['qualification_application', 'tender', 'contract'] as const;
export const SupplierFormParams = z.object({
  buyerSlug: Slug,
  entityType: z.enum(SUPPLIER_FORM_ENTITY_TYPES, {
    error: issue('ENTITY_TYPE_NOT_AVAILABLE', 'Suppliers see qualification, tender and contract fields only.'),
  }),
});

const FieldTextShape = {
  label: z.string().trim().min(2, issue('LABEL_REQUIRED', 'A label of at least 2 characters is required.')).max(120),
  purpose: z
    .string()
    .trim()
    .min(10, issue('PURPOSE_REQUIRED', 'Explain why the field is collected (at least 10 characters).'))
    .max(1000),
};

const FieldRuleShape = z.object({
  ...FieldTextShape,
  fieldType: CustomFieldsFieldType,
  allowedValues: z
    .array(z.string().trim().min(1, issue('CHOICE_EMPTY', 'Choices cannot be empty.')).max(120))
    .max(50)
    .default([]),
  requiredMode: CustomFieldsRequiredMode,
  requiredConditionField: z.string().trim().min(1).max(63).nullable().default(null),
  requiredConditionValue: z.string().trim().min(1).max(120).nullable().default(null),
  audience: CustomFieldsAudience,
  includeInReports: z.boolean().default(false),
});

type FieldRuleLike = z.infer<typeof FieldRuleShape>;

function checkFieldRule(value: FieldRuleLike, context: z.RefinementCtx): void {
  if (value.fieldType === 'choice' && value.allowedValues.length < 2) {
    context.addIssue({
      code: 'custom',
      path: ['allowedValues'],
      message: issue('ALLOWED_VALUES_REQUIRED', 'A choice field needs at least two choices.'),
    });
  }
  if (value.fieldType !== 'choice' && value.allowedValues.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['allowedValues'],
      message: issue('ALLOWED_VALUES_NOT_APPLICABLE', 'Only choice fields have a list of values.'),
    });
  }
  if (new Set(value.allowedValues).size !== value.allowedValues.length) {
    context.addIssue({ code: 'custom', path: ['allowedValues'], message: issue('DUPLICATE_CHOICE', 'Each choice may appear once.') });
  }
  if (value.requiredMode === 'conditional') {
    if (value.requiredConditionField === null) {
      context.addIssue({
        code: 'custom',
        path: ['requiredConditionField'],
        message: issue('CONDITION_FIELD_REQUIRED', 'Choose the field that makes this one required.'),
      });
    }
    if (value.requiredConditionValue === null) {
      context.addIssue({
        code: 'custom',
        path: ['requiredConditionValue'],
        message: issue('CONDITION_VALUE_REQUIRED', 'Give the value that makes this field required.'),
      });
    }
  } else if (value.requiredConditionField !== null || value.requiredConditionValue !== null) {
    context.addIssue({
      code: 'custom',
      path: ['requiredConditionField'],
      message: issue('CONDITION_NOT_APPLICABLE', 'Only conditional fields have a condition.'),
    });
  }
}

export const CreateCustomFieldBody = FieldRuleShape.extend({
  entityType: CustomFieldsEntityType,
  key: CustomFieldKey,
}).superRefine(checkFieldRule);
export type CreateCustomFieldBody = z.input<typeof CreateCustomFieldBody>;

/** A full replacement of the editable definition. Key and entity type never change. */
export const UpdateCustomFieldBody = FieldRuleShape.extend({
  /** Recorded in the field history; required so changes are explained. */
  changeNote: z.string().trim().min(3, issue('CHANGE_NOTE_REQUIRED', 'Explain the change.')).max(1000),
}).superRefine(checkFieldRule);
export type UpdateCustomFieldBody = z.input<typeof UpdateCustomFieldBody>;

export const DeactivateCustomFieldBody = z.object({ reason: ReasonText });
export type DeactivateCustomFieldBody = z.input<typeof DeactivateCustomFieldBody>;

export const ReorderCustomFieldsBody = z.object({
  entityType: CustomFieldsEntityType,
  fieldIds: z
    .array(Id)
    .min(1, issue('FIELD_IDS_REQUIRED', 'List the fields in their new order.'))
    .refine((ids) => new Set(ids).size === ids.length, issue('DUPLICATE_FIELD_ID', 'Each field may appear once.')),
});
export type ReorderCustomFieldsBody = z.input<typeof ReorderCustomFieldsBody>;

/** Whether a condition source is valid for an entity type: a core source or another field key. */
export function isCoreConditionSource(entityType: z.infer<typeof CustomFieldsEntityType>, source: string): boolean {
  return (CUSTOM_FIELD_CORE_CONDITIONS[entityType] as readonly string[]).includes(source);
}

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const DEFINITION_ERRORS = [
  'CONDITION_FIELD_NOT_FOUND',
  'CONDITION_VALUE_INVALID',
  'CONDITION_CYCLE',
] as const;

/** GET /api/v1/buyer/policy/custom-fields (ADM-07). */
export const listCustomFields = defineEndpoint({
  id: 'buyer.policy.listFields',
  method: 'GET',
  path: '/api/v1/buyer/policy/custom-fields',
  audience: 'buyer',
  permission: CUSTOM_FIELD_ADMIN_READ,
  query: CustomFieldListQuery,
  response: CustomFieldPage,
  errors: [],
  screens: ['ADM-07'],
});

/** GET /api/v1/buyer/policy/custom-fields/:fieldId. */
export const getCustomField = defineEndpoint({
  id: 'buyer.policy.getField',
  method: 'GET',
  path: '/api/v1/buyer/policy/custom-fields/:fieldId',
  audience: 'buyer',
  permission: CUSTOM_FIELD_ADMIN_READ,
  params: FieldParams,
  response: CustomFieldDetail,
  errors: ['CUSTOM_FIELD_NOT_FOUND'],
  screens: ['ADM-07'],
});

/** POST /api/v1/buyer/policy/custom-fields: a new active field (appears on NEW forms only). */
export const createCustomField = defineEndpoint({
  id: 'buyer.policy.createField',
  method: 'POST',
  path: '/api/v1/buyer/policy/custom-fields',
  audience: 'buyer',
  permission: 'org.fields.manage',
  body: CreateCustomFieldBody,
  response: CustomFieldDetail,
  idempotent: true,
  errors: ['CUSTOM_FIELD_KEY_TAKEN', ...DEFINITION_ERRORS],
  screens: ['ADM-07'],
});

/** PUT /api/v1/buyer/policy/custom-fields/:fieldId. */
export const updateCustomField = defineEndpoint({
  id: 'buyer.policy.updateField',
  method: 'PUT',
  path: '/api/v1/buyer/policy/custom-fields/:fieldId',
  audience: 'buyer',
  permission: 'org.fields.manage',
  params: FieldParams,
  body: UpdateCustomFieldBody,
  response: CustomFieldDetail,
  errors: [
    'CUSTOM_FIELD_NOT_FOUND',
    'CUSTOM_FIELD_INACTIVE',
    'FIELD_LOCKED_BY_ISSUED_FORMS',
    'AUDIENCE_WIDENING_REQUIRES_NEW_FIELD',
    ...DEFINITION_ERRORS,
  ],
  screens: ['ADM-07'],
});

/** POST …/custom-fields/:fieldId/deactivate: hidden from new forms; issued records keep their values. */
export const deactivateCustomField = defineEndpoint({
  id: 'buyer.policy.deactivateField',
  method: 'POST',
  path: '/api/v1/buyer/policy/custom-fields/:fieldId/deactivate',
  audience: 'buyer',
  permission: 'org.fields.manage',
  params: FieldParams,
  body: DeactivateCustomFieldBody,
  response: CustomFieldDetail,
  errors: ['CUSTOM_FIELD_NOT_FOUND', 'CUSTOM_FIELD_INACTIVE', 'FIELD_IS_CONDITION_SOURCE'],
  screens: ['ADM-07'],
});

/** POST …/custom-fields/:fieldId/reactivate. */
export const reactivateCustomField = defineEndpoint({
  id: 'buyer.policy.reactivateField',
  method: 'POST',
  path: '/api/v1/buyer/policy/custom-fields/:fieldId/reactivate',
  audience: 'buyer',
  permission: 'org.fields.manage',
  params: FieldParams,
  response: CustomFieldDetail,
  errors: ['CUSTOM_FIELD_NOT_FOUND', 'CUSTOM_FIELD_ACTIVE'],
  screens: ['ADM-07'],
});

/** PUT /api/v1/buyer/policy/custom-field-order: the display order of one form's fields. */
export const reorderCustomFields = defineEndpoint({
  id: 'buyer.policy.reorderFields',
  method: 'PUT',
  path: '/api/v1/buyer/policy/custom-field-order',
  audience: 'buyer',
  permission: 'org.fields.manage',
  body: ReorderCustomFieldsBody,
  response: CustomFieldForm,
  errors: ['FIELD_ORDER_INCOMPLETE'],
  screens: ['ADM-07'],
});

/** GET /api/v1/buyer/policy/form-definitions/:entityType: the active fields of a buyer form (CustomFieldsSection). */
export const getCustomFieldForm = defineEndpoint({
  id: 'buyer.policy.formDefinition',
  method: 'GET',
  path: '/api/v1/buyer/policy/form-definitions/:entityType',
  audience: 'buyer',
  permission: CUSTOM_FIELD_FORM_READ,
  params: FormParams,
  response: CustomFieldForm,
  errors: [],
  screens: ['ADM-07', 'BUY-03', 'BUY-08', 'BUY-34', 'CON-02'],
});

/** GET /api/v1/supplier/policy/form-definitions/:buyerSlug/:entityType: supplier-visible and public fields only. */
export const getSupplierCustomFieldForm = defineEndpoint({
  id: 'supplier.policy.formDefinition',
  method: 'GET',
  path: '/api/v1/supplier/policy/form-definitions/:buyerSlug/:entityType',
  audience: 'supplier',
  permission: SUPPLIER_CUSTOM_FIELD_FORM_READ,
  params: SupplierFormParams,
  response: CustomFieldForm,
  errors: ['BUYER_NOT_FOUND'],
  screens: ['SUP-20', 'SUP-08', 'SUP-23'],
});

export const customFieldRoutes = {
  listCustomFields,
  getCustomField,
  createCustomField,
  updateCustomField,
  deactivateCustomField,
  reactivateCustomField,
  reorderCustomFields,
  getCustomFieldForm,
  getSupplierCustomFieldForm,
} as const;
