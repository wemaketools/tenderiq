/**
 * ADM-09 program header fields: scope (category and its descendants, geography, value limit), validity and renewal
 * notice, decision authority (deciding role, independent approval), owner and the monitoring triggers.
 */
import type { QualificationOptions } from '@contracts/qualification';
import { REASSESSMENT_TRIGGERS_TRIGGER_TYPE } from '@contracts/enums';
import type { ReassessmentTriggersTriggerType } from '@contracts/enums';

import {
  Checkbox,
  MoneyInput,
  MultiSelect,
  NumberInput,
  Select,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import type { ProgramDraft } from '../lib/programDraft';
import { categoryLabel } from '../lib/text';
import type { ErrorLookup } from '../lib/validation';

export function ProgramFields({
  draft,
  onChange,
  options,
  errors,
}: {
  readonly draft: ProgramDraft;
  readonly onChange: (next: ProgramDraft) => void;
  readonly options: QualificationOptions | undefined;
  readonly errors: ErrorLookup;
}) {
  const set = <K extends keyof ProgramDraft>(key: K, value: ProgramDraft[K]): void =>
    onChange({ ...draft, [key]: value });
  return (
    <div className="tiq-form-grid">
      <TextField
        label={t('qualification.program.name')}
        required
        value={draft.name}
        onChange={(value) => set('name', value)}
        error={errors.forField('name')}
        fieldClassName="tiq-form-full"
      />
      <TextArea
        label={t('qualification.program.description')}
        rows={3}
        value={draft.description}
        onChange={(value) => set('description', value)}
        error={errors.forField('description')}
        fieldClassName="tiq-form-full"
      />
      <Select
        label={t('qualification.program.category')}
        hint={t('qualification.program.categoryHint')}
        required
        placeholder={t('qualification.common.select')}
        value={draft.categoryId}
        onChange={(value) => set('categoryId', value)}
        error={errors.forField('categoryId')}
        options={(options?.categories ?? []).map((category) => ({
          value: String(category.categoryId),
          label: categoryLabel(category),
        }))}
      />
      <TextField
        label={t('qualification.program.geography')}
        value={draft.geography}
        onChange={(value) => set('geography', value)}
        error={errors.forField('geography')}
      />
      <MoneyInput
        label={t('qualification.program.maxValue')}
        hint={t('qualification.program.maxValueHint')}
        value={draft.maxContractValue}
        currencies={options?.currencies ?? [draft.maxContractValue.currency]}
        onChange={(value) => set('maxContractValue', value)}
        error={errors.forField('maxContractValue')}
      />
      <NumberInput
        label={t('qualification.program.validity')}
        required
        places={0}
        suffix={t('qualification.program.monthsSuffix')}
        value={draft.validityMonths}
        onChange={(value) => set('validityMonths', value)}
        error={errors.forField('validityMonths')}
      />
      <NumberInput
        label={t('qualification.program.notice')}
        hint={t('qualification.program.noticeHint')}
        required
        places={0}
        suffix={t('qualification.program.daysSuffix')}
        value={draft.renewalNoticeDays}
        onChange={(value) => set('renewalNoticeDays', value)}
        error={errors.forField('renewalNoticeDays')}
      />
      <Select
        label={t('qualification.program.decisionRole')}
        hint={t('qualification.program.decisionRoleHint')}
        required
        placeholder={t('qualification.common.select')}
        value={draft.decisionRoleCode}
        onChange={(value) => set('decisionRoleCode', value)}
        error={errors.forField('decisionRoleCode')}
        options={(options?.decisionRoles ?? []).map((role) => ({
          value: role.code,
          label: role.name,
        }))}
      />
      <Select
        label={t('qualification.program.owner')}
        required
        placeholder={t('qualification.common.select')}
        value={draft.ownerUserId}
        onChange={(value) => set('ownerUserId', value)}
        error={errors.forField('ownerUserId')}
        options={(options?.programOwners ?? []).map((person) => ({
          value: String(person.userId),
          label: person.fullName,
        }))}
      />
      <div className="tiq-form-full">
        <Checkbox
          label={t('qualification.program.independentApproval')}
          hint={t('qualification.program.independentApprovalHint')}
          checked={draft.requiresIndependentApproval}
          onChange={(value) => set('requiresIndependentApproval', value)}
          error={errors.forField('requiresIndependentApproval')}
        />
      </div>
      <MultiSelect
        label={t('qualification.program.triggers')}
        hint={t('qualification.program.triggersHint')}
        value={draft.monitoredTriggerTypes}
        onChange={(value) =>
          set('monitoredTriggerTypes', value as ReassessmentTriggersTriggerType[])
        }
        error={errors.forField('monitoredTriggerTypes')}
        fieldClassName="tiq-form-full"
        options={REASSESSMENT_TRIGGERS_TRIGGER_TYPE.map((value) => ({
          value,
          label: tEnum('reassessment_triggers.trigger_type', value),
        }))}
      />
    </div>
  );
}
