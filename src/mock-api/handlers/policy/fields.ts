/**
 * Mock handlers of the custom field endpoints (ADM-07) and the form definitions that the request, tender,
 * qualification and contract forms embed. Buyer rows are filtered by the active tenant; suppliers only ever see the
 * supplier-visible and public fields of a buyer.
 */

import { TENDERS_EVENT_TYPE, TENDERS_PARTICIPATION, TENDERS_PROCEDURE_WRITE } from '../../../contracts/enums.js';
import type { CustomFieldsEntityType } from '../../../contracts/enums.js';
import {
  CUSTOM_FIELD_CORE_CONDITIONS,
  VALUE_BANDS,
  createCustomField,
  deactivateCustomField,
  getCustomField,
  getCustomFieldForm,
  getSupplierCustomFieldForm,
  isCoreConditionSource,
  listCustomFields,
  reactivateCustomField,
  reorderCustomFields,
  updateCustomField,
  widensAudience,
} from '../../../contracts/policy.js';
import type { CustomFieldDefinition, CustomFieldDetail, CustomFieldForm, CustomFieldSummary } from '../../../contracts/policy.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { CUSTOM_FIELDS, POLICY_CATEGORY_REFS } from '../../fixtures/policy.js';
import type { FixtureCustomField } from '../../fixtures/policy.js';
import { findTenantBySlug, personRef } from '../../persona.js';
import type { TenantAccess } from '../../persona.js';
import { holds, matchesText, sortRows, withinRange } from './common.js';

type Fail = (status: number, code: string, detail?: string) => never;

const NEW_FIELD_ID = 900;

function fieldsOf(tenantId: number): FixtureCustomField[] {
  return CUSTOM_FIELDS.filter((field) => field.tenantId === tenantId);
}

function definition(field: FixtureCustomField): CustomFieldDefinition {
  return {
    id: field.id,
    entityType: field.entityType,
    key: field.key,
    label: field.label,
    purpose: field.purpose,
    fieldType: field.fieldType,
    allowedValues: [...field.allowedValues],
    requiredMode: field.requiredMode,
    requiredConditionField: field.requiredConditionField,
    requiredConditionValue: field.requiredConditionValue,
    audience: field.audience,
    sortOrder: field.sortOrder,
  };
}

function summary(field: FixtureCustomField): CustomFieldSummary {
  return {
    ...definition(field),
    includeInReports: field.includeInReports,
    active: field.active,
    valueCount: field.valueCount,
    issuedRecordCount: field.issuedRecordCount,
    updatedAt: field.updatedAt,
    updatedBy: field.updatedBy === null ? null : personRef(field.updatedBy),
  };
}

function dependentsOf(field: FixtureCustomField, all: readonly FixtureCustomField[]): FixtureCustomField[] {
  return all.filter(
    (other) =>
      other.id !== field.id && other.active && other.entityType === field.entityType && other.requiredConditionField === field.key,
  );
}

function detail(field: FixtureCustomField, all: readonly FixtureCustomField[], access: TenantAccess): CustomFieldDetail {
  const manage = holds(access, 'org.fields.manage');
  const dependents = dependentsOf(field, all);
  return {
    ...summary(field),
    createdAt: field.createdAt,
    createdBy: field.createdBy === null ? null : personRef(field.createdBy),
    dependents: dependents.map((other) => ({
      id: other.id,
      key: other.key,
      label: other.label,
      requiredConditionValue: other.requiredConditionValue,
    })),
    history: [...field.history]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((change) => ({ at: change.at, by: change.by === null ? null : personRef(change.by), summary: change.summary })),
    capabilities: {
      canEdit: manage && field.active,
      structureLocked: field.issuedRecordCount > 0,
      canDeactivate: manage && field.active && dependents.length === 0,
      canReactivate: manage && !field.active,
    },
  };
}

function form(entityType: CustomFieldsEntityType, fields: readonly FixtureCustomField[]): CustomFieldForm {
  return {
    entityType,
    fields: fields
      .filter((field) => field.active && field.entityType === entityType)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(definition),
    coreConditionSources: [...CUSTOM_FIELD_CORE_CONDITIONS[entityType]],
  };
}

/** The values a condition source may take, or null when any text is acceptable. */
function conditionValues(
  tenantId: number,
  entityType: CustomFieldsEntityType,
  source: string,
  all: readonly FixtureCustomField[],
): readonly string[] | null {
  switch (source) {
    case 'value_band':
      return VALUE_BANDS;
    case 'procedure':
      return TENDERS_PROCEDURE_WRITE;
    case 'event_type':
      return TENDERS_EVENT_TYPE;
    case 'participation':
      return TENDERS_PARTICIPATION;
    case 'category_code':
      return POLICY_CATEGORY_REFS.filter((category) => category.tenantId === tenantId).map((category) => category.code);
    default: {
      const field = all.find((other) => other.active && other.entityType === entityType && other.key === source);
      if (field === undefined) return [];
      if (field.fieldType === 'boolean') return ['true', 'false'];
      if (field.fieldType === 'choice') return field.allowedValues;
      return null;
    }
  }
}

interface RuleInput {
  readonly requiredMode: FixtureCustomField['requiredMode'];
  readonly requiredConditionField: string | null;
  readonly requiredConditionValue: string | null;
}

function checkCondition(
  tenantId: number,
  entityType: CustomFieldsEntityType,
  key: string,
  rule: RuleInput,
  all: readonly FixtureCustomField[],
  fail: Fail,
): void {
  if (rule.requiredMode !== 'conditional' || rule.requiredConditionField === null) return;
  const source = rule.requiredConditionField;
  if (source === key) return fail(422, 'CONDITION_CYCLE', 'A field cannot depend on itself.');
  const sourceField = all.find((other) => other.active && other.entityType === entityType && other.key === source);
  if (!isCoreConditionSource(entityType, source) && sourceField === undefined) {
    return fail(422, 'CONDITION_FIELD_NOT_FOUND', 'The condition must name a core field of this form or another active field.');
  }
  if (sourceField !== undefined && sourceField.requiredConditionField === key) {
    return fail(422, 'CONDITION_CYCLE', 'The two fields would each depend on the other.');
  }
  const allowed = conditionValues(tenantId, entityType, source, all);
  if (allowed !== null && rule.requiredConditionValue !== null && !allowed.includes(rule.requiredConditionValue)) {
    return fail(422, 'CONDITION_VALUE_INVALID', `The condition value must be one of: ${allowed.join(', ')}.`);
  }
}

export function registerFields(app: MockApp): void {
  function find(access: TenantAccess, fieldId: number, fail: Fail): FixtureCustomField {
    const field = fieldsOf(access.tenant.id).find((row) => row.id === fieldId);
    if (field === undefined) return fail(404, 'CUSTOM_FIELD_NOT_FOUND', 'No custom field with this id.');
    return field;
  }

  mockRoute(app, listCustomFields, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = fieldsOf(tenant.id)
      .filter((field) => matchesText(query.q, field.label, field.key, field.purpose))
      .filter((field) => query.entityType === undefined || query.entityType.includes(field.entityType))
      .filter((field) => query.audience === undefined || query.audience.includes(field.audience))
      .filter((field) => query.requiredMode === undefined || query.requiredMode.includes(field.requiredMode))
      .filter((field) => query.fieldType === undefined || query.fieldType.includes(field.fieldType))
      .filter((field) => query.active === undefined || field.active === query.active)
      .filter((field) => query.includeInReports === undefined || field.includeInReports === query.includeInReports)
      .filter((field) => withinRange(field.updatedAt, query.updatedFrom, query.updatedTo));
    const sort = query.sort;
    const sorted =
      sort === undefined
        ? sortRows(sortRows(rows, (field) => field.sortOrder, 'asc'), (field) => field.entityType, 'asc')
        : sortRows(rows, (field) => field[sort], query.dir);
    return fixtures.page(sorted.map(summary));
  });

  mockRoute(app, getCustomField, ({ requireTenant, params, fail }) => {
    const access = requireTenant();
    return detail(find(access, params.fieldId, fail), fieldsOf(access.tenant.id), access);
  });

  mockRoute(app, createCustomField, ({ requireTenant, requirePersona, body, now, fail }) => {
    const access = requireTenant();
    const all = fieldsOf(access.tenant.id);
    if (all.some((field) => field.entityType === body.entityType && field.key === body.key)) {
      return fail(409, 'CUSTOM_FIELD_KEY_TAKEN', 'This form already has a field with this key.');
    }
    checkCondition(access.tenant.id, body.entityType, body.key, body, all, fail);
    const userId = requirePersona().userId;
    const at = now.toISOString();
    const lastOrder = Math.max(0, ...all.filter((field) => field.entityType === body.entityType).map((field) => field.sortOrder));
    const created: FixtureCustomField = {
      id: NEW_FIELD_ID,
      tenantId: access.tenant.id,
      entityType: body.entityType,
      key: body.key,
      label: body.label,
      purpose: body.purpose,
      fieldType: body.fieldType,
      allowedValues: body.allowedValues,
      requiredMode: body.requiredMode,
      requiredConditionField: body.requiredConditionField,
      requiredConditionValue: body.requiredConditionValue,
      audience: body.audience,
      includeInReports: body.includeInReports,
      active: true,
      sortOrder: lastOrder + 10,
      valueCount: 0,
      issuedRecordCount: 0,
      createdAt: at,
      createdBy: userId,
      updatedAt: at,
      updatedBy: userId,
      history: [{ at, by: userId, summary: 'Field created; it appears on new forms only.' }],
    };
    return detail(created, [...all, created], access);
  });

  mockRoute(app, updateCustomField, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const all = fieldsOf(access.tenant.id);
    const field = find(access, params.fieldId, fail);
    if (!field.active) return fail(409, 'CUSTOM_FIELD_INACTIVE', 'Reactivate the field before changing it.');
    if (field.issuedRecordCount > 0) {
      const removedChoices = field.allowedValues.filter((value) => !body.allowedValues.includes(value));
      if (body.fieldType !== field.fieldType || removedChoices.length > 0) {
        return fail(
          409,
          'FIELD_LOCKED_BY_ISSUED_FORMS',
          'Issued records carry this field: its type and existing choices cannot change. Add a new field instead.',
        );
      }
      if (widensAudience(field.audience, body.audience)) {
        return fail(
          409,
          'AUDIENCE_WIDENING_REQUIRES_NEW_FIELD',
          'Issued records carry values captured for a narrower audience; the audience can only be narrowed. Add a new field for the wider audience instead.',
        );
      }
    }
    checkCondition(access.tenant.id, field.entityType, field.key, body, all, fail);
    const userId = requirePersona().userId;
    const at = now.toISOString();
    const updated: FixtureCustomField = {
      ...field,
      label: body.label,
      purpose: body.purpose,
      fieldType: body.fieldType,
      allowedValues: body.allowedValues,
      requiredMode: body.requiredMode,
      requiredConditionField: body.requiredConditionField,
      requiredConditionValue: body.requiredConditionValue,
      audience: body.audience,
      includeInReports: body.includeInReports,
      updatedAt: at,
      updatedBy: userId,
      history: [...field.history, { at, by: userId, summary: `${body.changeNote} (applies to new forms only)` }],
    };
    return detail(updated, all, access);
  });

  mockRoute(app, deactivateCustomField, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const all = fieldsOf(access.tenant.id);
    const field = find(access, params.fieldId, fail);
    if (!field.active) return fail(409, 'CUSTOM_FIELD_INACTIVE', 'The field is already inactive.');
    const dependents = dependentsOf(field, all);
    if (dependents.length > 0) {
      return fail(
        409,
        'FIELD_IS_CONDITION_SOURCE',
        `Change the condition of ${dependents.map((other) => other.label).join(', ')} first.`,
      );
    }
    const userId = requirePersona().userId;
    const at = now.toISOString();
    return detail(
      {
        ...field,
        active: false,
        updatedAt: at,
        updatedBy: userId,
        history: [...field.history, { at, by: userId, summary: `Deactivated: ${body.reason}` }],
      },
      all,
      access,
    );
  });

  mockRoute(app, reactivateCustomField, ({ requireTenant, requirePersona, params, now, fail }) => {
    const access = requireTenant();
    const all = fieldsOf(access.tenant.id);
    const field = find(access, params.fieldId, fail);
    if (field.active) return fail(409, 'CUSTOM_FIELD_ACTIVE', 'The field is already active.');
    const userId = requirePersona().userId;
    const at = now.toISOString();
    return detail(
      {
        ...field,
        active: true,
        updatedAt: at,
        updatedBy: userId,
        history: [...field.history, { at, by: userId, summary: 'Reactivated for new forms.' }],
      },
      all,
      access,
    );
  });

  mockRoute(app, reorderCustomFields, ({ requireTenant, body, fail }) => {
    const { tenant } = requireTenant();
    const active = fieldsOf(tenant.id).filter((field) => field.active && field.entityType === body.entityType);
    const sameSet =
      active.length === body.fieldIds.length && active.every((field) => body.fieldIds.includes(field.id));
    if (!sameSet) {
      return fail(422, 'FIELD_ORDER_INCOMPLETE', 'List every active field of this form exactly once.');
    }
    const reordered = active.map((field) => ({ ...field, sortOrder: (body.fieldIds.indexOf(field.id) + 1) * 10 }));
    return form(body.entityType, reordered);
  });

  mockRoute(app, getCustomFieldForm, ({ requireTenant, params }) => {
    const { tenant } = requireTenant();
    return form(params.entityType, fieldsOf(tenant.id));
  });

  mockRoute(app, getSupplierCustomFieldForm, ({ params, fail }) => {
    const buyer = findTenantBySlug(params.buyerSlug);
    if (buyer === undefined || buyer.kind !== 'buyer' || buyer.status !== 'active') {
      return fail(404, 'BUYER_NOT_FOUND', 'No buyer organization with this address.');
    }
    const visible = fieldsOf(buyer.id).filter((field) => field.audience === 'supplier_visible' || field.audience === 'public');
    return form(params.entityType, visible);
  });
}

