/**
 * The editable draft of a custom field definition (ADM-07) and its conversion to the contract bodies.
 */
import type {
  CustomFieldsAudience,
  CustomFieldsFieldType,
  CustomFieldsRequiredMode,
} from '@contracts/enums';
import type { CustomFieldDetail } from '@contracts/policy';

export interface FieldDraft {
  readonly entityType: string;
  readonly key: string;
  readonly label: string;
  readonly purpose: string;
  readonly fieldType: string;
  /** One choice per line. */
  readonly allowedValues: string;
  readonly requiredMode: string;
  readonly requiredConditionField: string;
  readonly requiredConditionValue: string;
  readonly audience: string;
  readonly includeInReports: boolean;
  readonly changeNote: string;
}

export const EMPTY_FIELD_DRAFT: FieldDraft = {
  entityType: '',
  key: '',
  label: '',
  purpose: '',
  fieldType: 'text',
  allowedValues: '',
  requiredMode: 'optional',
  requiredConditionField: '',
  requiredConditionValue: '',
  audience: 'buyer_internal',
  includeInReports: false,
  changeNote: '',
};

export function fieldToDraft(field: CustomFieldDetail): FieldDraft {
  return {
    entityType: field.entityType,
    key: field.key,
    label: field.label,
    purpose: field.purpose,
    fieldType: field.fieldType,
    allowedValues: field.allowedValues.join('\n'),
    requiredMode: field.requiredMode,
    requiredConditionField: field.requiredConditionField ?? '',
    requiredConditionValue: field.requiredConditionValue ?? '',
    audience: field.audience,
    includeInReports: field.includeInReports,
    changeNote: '',
  };
}

function choicesOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** The editable rule part of a create or update body. */
export function draftToRule(draft: FieldDraft) {
  const conditional = draft.requiredMode === 'conditional';
  return {
    label: draft.label,
    purpose: draft.purpose,
    fieldType: draft.fieldType as CustomFieldsFieldType,
    allowedValues: draft.fieldType === 'choice' ? choicesOf(draft.allowedValues) : [],
    requiredMode: draft.requiredMode as CustomFieldsRequiredMode,
    requiredConditionField:
      conditional && draft.requiredConditionField !== '' ? draft.requiredConditionField : null,
    requiredConditionValue:
      conditional && draft.requiredConditionValue.trim() !== ''
        ? draft.requiredConditionValue.trim()
        : null,
    audience: draft.audience as CustomFieldsAudience,
    includeInReports: draft.includeInReports,
  };
}

export const FIELD_FORM_FIELDS = [
  'entityType',
  'key',
  'label',
  'purpose',
  'fieldType',
  'allowedValues',
  'requiredMode',
  'requiredConditionField',
  'requiredConditionValue',
  'audience',
  'includeInReports',
  'changeNote',
];
