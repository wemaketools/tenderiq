/**
 * Template library editors (ADM-08, PRD §17.3): the governance metadata every reusable template carries (owner,
 * intended procedure and category, audience, review date) and the versioned content (text and checklist items).
 */
import { TEMPLATES_AUDIENCE, TEMPLATES_KIND, TENDERS_PROCEDURE_WRITE } from '@contracts/enums';
import type { TemplatesKind } from '@contracts/enums';
import type { TemplateAuthoringOptions } from '@contracts/policy';

import {
  Button,
  Checkbox,
  DateInput,
  IconButton,
  Select,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import type { ChecklistDraft, ContentDraft, TemplateMetaDraft } from '../lib/templateDrafts';
import type { ErrorLookup } from '../lib/validation';

// ---------------------------------------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------------------------------------

export interface TemplateMetaFormProps {
  readonly value: TemplateMetaDraft;
  readonly onChange: (value: TemplateMetaDraft) => void;
  readonly errors: ErrorLookup;
  readonly options: TemplateAuthoringOptions | undefined;
  /** The kind is chosen once, at creation. */
  readonly kindEditable: boolean;
}

export function TemplateMetaForm({
  value,
  onChange,
  errors,
  options,
  kindEditable,
}: TemplateMetaFormProps) {
  const set = (patch: Partial<TemplateMetaDraft>): void => onChange({ ...value, ...patch });
  return (
    <div className="tiq-form-grid">
      <TextField
        label={t('admin-policy.templateForm.name')}
        required
        value={value.name}
        onChange={(name) => set({ name })}
        error={errors.forField('name')}
      />
      <Select
        label={t('admin-policy.templateForm.kind')}
        required
        disabled={!kindEditable}
        placeholder={t('admin-policy.common.choose')}
        value={value.kind}
        options={TEMPLATES_KIND.map((kind) => ({
          value: kind,
          label: tEnum('templates.kind', kind),
        }))}
        onChange={(kind) => set({ kind })}
        error={errors.forField('kind')}
      />
      <Select
        label={t('admin-policy.templateForm.owner')}
        hint={t('admin-policy.templateForm.ownerHint')}
        required
        placeholder={
          options === undefined ? t('admin-policy.common.loading') : t('admin-policy.common.choose')
        }
        value={value.ownerUserId}
        options={(options?.owners ?? []).map((owner) => ({
          value: String(owner.userId),
          label: owner.capacity === null ? owner.fullName : `${owner.fullName} (${owner.capacity})`,
        }))}
        onChange={(ownerUserId) => set({ ownerUserId })}
        error={errors.forField('ownerUserId')}
      />
      <DateInput
        label={t('admin-policy.templateForm.reviewDate')}
        hint={t('admin-policy.templateForm.reviewDateHint')}
        required
        value={value.reviewDate}
        onChange={(reviewDate) => set({ reviewDate })}
        error={errors.forField('reviewDate')}
      />
      <Select
        label={t('admin-policy.templateForm.procedure')}
        placeholder={t('admin-policy.templateForm.anyProcedure')}
        value={value.procedure}
        options={TENDERS_PROCEDURE_WRITE.map((procedure) => ({
          value: procedure,
          label: tEnum('tenders.procedure', procedure),
        }))}
        onChange={(procedure) => set({ procedure })}
        error={errors.forField('procedure')}
      />
      <Select
        label={t('admin-policy.templateForm.category')}
        placeholder={t('admin-policy.templateForm.anyCategory')}
        value={value.categoryId}
        options={(options?.categories ?? []).map((category) => ({
          value: String(category.categoryId),
          label: `${category.code} · ${category.name}`,
        }))}
        onChange={(categoryId) => set({ categoryId })}
        error={errors.forField('categoryId')}
      />
      <Select
        label={t('admin-policy.templateForm.audience')}
        required
        value={value.audience}
        options={TEMPLATES_AUDIENCE.map((audience) => ({
          value: audience,
          label: tEnum('templates.audience', audience),
        }))}
        onChange={(audience) => set({ audience })}
        error={errors.forField('audience')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------------------------------------

export interface TemplateContentFormProps {
  readonly kind: TemplatesKind | string;
  readonly value: ContentDraft;
  readonly onChange: (value: ContentDraft) => void;
  readonly errors: ErrorLookup;
  /** Revisions explain what changes; the first version of a new template does not. */
  readonly withChangeNote: boolean;
}

export function TemplateContentForm({
  kind,
  value,
  onChange,
  errors,
  withChangeNote,
}: TemplateContentFormProps) {
  const set = (patch: Partial<ContentDraft>): void => onChange({ ...value, ...patch });
  const setItem = (index: number, patch: Partial<ChecklistDraft>): void =>
    set({
      checklistItems: value.checklistItems.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    });
  return (
    <div className="tiq-form-stack">
      {withChangeNote && (
        <TextArea
          label={t('admin-policy.templateForm.changeNote')}
          hint={t('admin-policy.templateForm.changeNoteHint')}
          required
          rows={2}
          value={value.changeNote}
          onChange={(changeNote) => set({ changeNote })}
          error={errors.forField('changeNote')}
        />
      )}
      <TextArea
        label={t('admin-policy.templateForm.body')}
        hint={t('admin-policy.templateForm.bodyHint')}
        required={kind !== 'checklist'}
        rows={12}
        value={value.bodyMarkdown}
        onChange={(bodyMarkdown) => set({ bodyMarkdown })}
        error={errors.forField('bodyMarkdown')}
      />
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.templateForm.checklist')}</legend>
        <div className="tiq-form-stack">
          {errors.forField('checklistItems') !== undefined && value.checklistItems.length === 0 && (
            <p className="tiq-field-error">{errors.forField('checklistItems')}</p>
          )}
          {value.checklistItems.map((item, index) => (
            <div
              key={index}
              className="tiq-form-grid"
              role="group"
              aria-label={t('admin-policy.templateForm.item', { no: index + 1 })}
            >
              <TextField
                label={t('admin-policy.templateForm.itemText', { no: index + 1 })}
                required
                value={item.itemText}
                onChange={(itemText) => setItem(index, { itemText })}
                error={errors.forField(`checklistItems.${index}.itemText`)}
              />
              <div className="tiq-inline">
                <Checkbox
                  label={t('admin-policy.templateForm.mandatory')}
                  checked={item.mandatory}
                  onChange={(mandatory) => setItem(index, { mandatory })}
                />
                <IconButton
                  icon="trash"
                  label={t('admin-policy.templateForm.removeItem', { no: index + 1 })}
                  onClick={() =>
                    set({
                      checklistItems: value.checklistItems.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                />
              </div>
            </div>
          ))}
          <div>
            <Button
              size="sm"
              icon="plus"
              onClick={() =>
                set({
                  checklistItems: [...value.checklistItems, { itemText: '', mandatory: true }],
                })
              }
            >
              {t('admin-policy.templateForm.addItem')}
            </Button>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
