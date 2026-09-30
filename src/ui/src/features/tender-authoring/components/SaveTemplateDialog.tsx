/**
 * "Save as template" (FR-07, BUY-07/BUY-08): the tender's structure becomes a DRAFT tender-package template. It is
 * usable for new events only after template approval (ADM-08). Bids, deliberations, approvals and outcomes are never
 * part of a template.
 */
import { useState } from 'react';

import { TEMPLATES_AUDIENCE } from '@contracts/enums';
import type { TemplatesAudience } from '@contracts/enums';
import { TENDER_COPY_SECTIONS, saveTenderAsTemplate } from '@contracts/tenders';
import type { SavedTemplate, TenderCopySection, TenderDetail } from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import { MultiSelect, Select, TextArea, TextField, formErrors } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { sectionLabel } from '../lib/labels';
import { FormDialog } from './FormDialog';

export interface SaveTemplateDialogProps {
  readonly open: boolean;
  readonly tender: TenderDetail;
  readonly onClose: () => void;
  readonly onSaved: (template: SavedTemplate) => void;
}

export function SaveTemplateDialog({ open, tender, onClose, onSaved }: SaveTemplateDialogProps) {
  const mutation = useApiMutation(saveTenderAsTemplate);
  const [name, setName] = useState(tender.title);
  const [audience, setAudience] = useState<string>('buyer_internal');
  const [sections, setSections] = useState<string[]>([...TENDER_COPY_SECTIONS]);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const errors = formErrors(mutation.error, ['name', 'audience', 'sections', 'changeNote']);
  const local = {
    name: name.trim().length < 3 ? t('tender-authoring.create.titleShort') : undefined,
    sections: sections.length === 0 ? t('tender-authoring.create.sectionsRequired') : undefined,
    note: note.trim() === '' ? t('tender-authoring.template.noteRequired') : undefined,
  };

  const close = (): void => {
    mutation.reset();
    setTouched(false);
    onClose();
  };

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (Object.values(local).some((value) => value !== undefined)) return;
    try {
      const result = await mutation.mutate({
        params: { tenderId: tender.id },
        body: {
          name: name.trim(),
          audience: audience as TemplatesAudience,
          sections: sections as TenderCopySection[],
          changeNote: note.trim(),
        },
      });
      onSaved(result);
      setNote('');
      close();
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <FormDialog
      open={open}
      title={t('tender-authoring.template.title')}
      description={t('tender-authoring.template.description')}
      submitLabel={t('tender-authoring.template.submit')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <TextField
        label={t('tender-authoring.template.name')}
        required
        value={name}
        onChange={setName}
        error={errors.forField('name') ?? (touched ? local.name : undefined)}
        maxLength={300}
      />
      <Select
        label={t('tender-authoring.template.audience')}
        value={audience}
        options={TEMPLATES_AUDIENCE.map((value) => ({
          value,
          label: tEnum('templates.audience', value),
        }))}
        onChange={setAudience}
        error={errors.forField('audience')}
      />
      <MultiSelect
        label={t('tender-authoring.template.sections')}
        required
        value={sections}
        onChange={setSections}
        options={TENDER_COPY_SECTIONS.map((value) => ({ value, label: sectionLabel(value) }))}
        error={errors.forField('sections') ?? (touched ? local.sections : undefined)}
      />
      <TextArea
        label={t('tender-authoring.template.note')}
        required
        value={note}
        onChange={setNote}
        rows={2}
        error={errors.forField('changeNote') ?? (touched ? local.note : undefined)}
      />
      <p className="tiq-text-muted">{t('tender-authoring.template.never')}</p>
    </FormDialog>
  );
}
