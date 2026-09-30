/**
 * ADM-09 criteria editor for a DRAFT program version: criteria per assessment area with the question, guidance,
 * response type, mandatory flag, accepted evidence types, whether "not applicable" needs a reason, and the
 * threshold (category- or risk-specific requirements). Approved versions are never edited: a revision opens a new
 * draft version.
 */
import { useState } from 'react';

import { SaveCriteriaBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { ProgramDetail } from '@contracts/qualification';
import {
  EVIDENCE_ITEMS_EVIDENCE_TYPE,
  QUALIFICATION_CRITERIA_AREA,
  QUALIFICATION_CRITERIA_RESPONSE_TYPE,
} from '@contracts/enums';
import type {
  EvidenceItemsEvidenceType,
  QualificationCriteriaArea,
  QualificationCriteriaResponseType,
} from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Checkbox,
  EmptyState,
  FormErrorSummary,
  IconButton,
  MultiSelect,
  Select,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { summaryTitle } from '../lib/errors';
import { runCommand } from '../lib/hooks';
import { criteriaBody, criterionDraftOf, newCriterionDraft } from '../lib/programDraft';
import type { CriterionDraft } from '../lib/programDraft';
import { errorLookup, validateWith } from '../lib/validation';

export function CriteriaEditor({
  program,
  versionId,
  onSaved,
}: {
  readonly program: ProgramDetail;
  readonly versionId: number;
  readonly onSaved: (program: ProgramDetail) => void;
}) {
  const save = useApiMutation(api.saveProgramCriteria);
  const [baseline, setBaseline] = useState(() => program.criteria.map(criterionDraftOf));
  const [rows, setRows] = useState<readonly CriterionDraft[]>(baseline);
  const [counter, setCounter] = useState(0);
  const [newArea, setNewArea] = useState<QualificationCriteriaArea>('corporate');
  const [tried, setTried] = useState(false);
  const body = criteriaBody(rows);
  const errors = errorLookup(tried ? validateWith(SaveCriteriaBody, body) : [], save.error, [
    'criteria',
  ]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(baseline);

  const update = (index: number, patch: Partial<CriterionDraft>): void =>
    setRows((previous) =>
      previous.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  const move = (index: number, delta: number): void =>
    setRows((previous) => {
      const target = index + delta;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      const [row] = next.splice(index, 1);
      if (row !== undefined) next.splice(target, 0, row);
      return next;
    });
  const add = (): void => {
    setRows((previous) => [...previous, newCriterionDraft(`new${counter}`, newArea)]);
    setCounter((value) => value + 1);
  };

  const submit = (): void => {
    setTried(true);
    const parsed = SaveCriteriaBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () => save.mutate({ params: { programId: program.id, versionId }, body: parsed.data }),
      (saved) => {
        const next = saved.criteria.map(criterionDraftOf);
        setBaseline(next);
        setRows(next);
        setTried(false);
        onSaved(saved);
      },
    );
  };

  const rowError = (index: number, field: string): string | undefined =>
    errors.forField(`criteria.${index}.${field}`);

  return (
    <div className="tiq-stack">
      <UnsavedChangesGuard when={dirty && !save.pending} />
      <FormErrorSummary
        title={summaryTitle(save.error)}
        errors={errors.other.filter((item) => !/^criteria\.\d+\./.test(item.field))}
      />
      {rows.length === 0 && <EmptyState compact title={t('qualification.criteria.none')} />}
      {rows.map((row, index) => (
        <fieldset key={row.key} className="tiq-fieldset tiq-stack">
          <legend>{t('qualification.criteria.itemLegend', { no: index + 1 })}</legend>
          <div className="tiq-form-grid">
            <Select
              label={t('qualification.criteria.area')}
              required
              value={row.area}
              onChange={(value) => update(index, { area: value as QualificationCriteriaArea })}
              error={rowError(index, 'area')}
              options={QUALIFICATION_CRITERIA_AREA.map((value) => ({
                value,
                label: tEnum('qualification_criteria.area', value),
              }))}
            />
            <Select
              label={t('qualification.criteria.responseType')}
              required
              value={row.responseType}
              onChange={(value) =>
                update(index, { responseType: value as QualificationCriteriaResponseType })
              }
              error={rowError(index, 'responseType')}
              options={QUALIFICATION_CRITERIA_RESPONSE_TYPE.map((value) => ({
                value,
                label: tEnum('qualification_criteria.response_type', value),
              }))}
            />
            <TextArea
              label={t('qualification.criteria.question')}
              required
              rows={2}
              value={row.question}
              onChange={(question) => update(index, { question })}
              error={rowError(index, 'question')}
              fieldClassName="tiq-form-full"
            />
            <TextArea
              label={t('qualification.criteria.guidance')}
              rows={2}
              value={row.guidance}
              onChange={(guidance) => update(index, { guidance })}
              error={rowError(index, 'guidance')}
              fieldClassName="tiq-form-full"
            />
            <TextArea
              label={t('qualification.criteria.threshold')}
              hint={t('qualification.criteria.thresholdHint')}
              rows={2}
              value={row.thresholdDescription}
              onChange={(thresholdDescription) => update(index, { thresholdDescription })}
              error={rowError(index, 'thresholdDescription')}
              fieldClassName="tiq-form-full"
            />
            <MultiSelect
              label={t('qualification.criteria.evidenceTypes')}
              required={row.responseType === 'document'}
              value={row.evidenceTypes}
              onChange={(value) =>
                update(index, { evidenceTypes: value as EvidenceItemsEvidenceType[] })
              }
              error={rowError(index, 'evidenceTypes')}
              fieldClassName="tiq-form-full"
              options={EVIDENCE_ITEMS_EVIDENCE_TYPE.map((value) => ({
                value,
                label: tEnum('evidence_items.evidence_type', value),
              }))}
            />
            <Checkbox
              label={t('qualification.criteria.mandatory')}
              checked={row.mandatory}
              onChange={(mandatory) => update(index, { mandatory })}
            />
            <Checkbox
              label={t('qualification.criteria.naReason')}
              hint={t('qualification.criteria.naReasonHint')}
              checked={row.requiresNaReason}
              onChange={(requiresNaReason) => update(index, { requiresNaReason })}
            />
          </div>
          <div className="tiq-inline">
            <IconButton
              icon="arrowUp"
              label={t('qualification.criteria.moveUp', { no: index + 1 })}
              onClick={() => move(index, -1)}
              disabled={index === 0}
            />
            <IconButton
              icon="arrowDown"
              label={t('qualification.criteria.moveDown', { no: index + 1 })}
              onClick={() => move(index, 1)}
              disabled={index === rows.length - 1}
            />
            <Button
              size="sm"
              variant="danger-soft"
              icon="trash"
              onClick={() =>
                setRows((previous) => previous.filter((_, position) => position !== index))
              }
            >
              {t('qualification.criteria.remove')}
            </Button>
          </div>
        </fieldset>
      ))}
      <div className="tiq-inline">
        <Select
          label={t('qualification.criteria.newArea')}
          value={newArea}
          onChange={(value) => setNewArea(value as QualificationCriteriaArea)}
          options={QUALIFICATION_CRITERIA_AREA.map((value) => ({
            value,
            label: tEnum('qualification_criteria.area', value),
          }))}
        />
        <Button icon="plus" onClick={add}>
          {t('qualification.criteria.add')}
        </Button>
        <Button
          variant="primary"
          icon="check"
          onClick={submit}
          loading={save.pending}
          disabled={!dirty}
        >
          {t('qualification.criteria.save')}
        </Button>
      </div>
    </div>
  );
}
