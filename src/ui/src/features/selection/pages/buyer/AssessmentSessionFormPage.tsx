/**
 * BUY-22 — Plan an assessment session: type, purpose, agenda, the declared assessment basis (scored criterion,
 * claim verification or eligibility gate) announced to every invitee, comparable instructions and the preparation
 * time. The session is created as planned; equal treatment is confirmed before invitations (FR-15, AC-21).
 */
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

import {
  ASSESSMENT_SESSIONS_ASSESSMENT_BASIS,
  ASSESSMENT_SESSIONS_SESSION_TYPE,
} from '@contracts/enums';
import type {
  AssessmentSessionsAssessmentBasis,
  AssessmentSessionsSessionType,
} from '@contracts/enums';
import { ASSESSMENT_BASIS_EFFECTS, selectionEndpoints } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  FormErrorSummary,
  NumberInput,
  PageHeader,
  RadioGroup,
  Select,
  TextArea,
  UnsavedChangesGuard,
  formErrors,
} from '../../../../components/ui';
import { t, tEnum } from '../../../../lib/i18n';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { selectionErrorMessage } from '../../lib/errors';
import { useTenderSearchParam } from '../../lib/hooks';
import { attempt, idOf } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';

const FIELDS = [
  'tenderId',
  'lotId',
  'sessionType',
  'purpose',
  'agenda',
  'assessmentBasis',
  'criterionId',
  'instructions',
  'preparationDays',
];

interface Draft {
  readonly tender: string;
  readonly lot: string;
  readonly sessionType: string;
  readonly purpose: string;
  readonly agenda: string;
  readonly basis: string;
  readonly criterion: string;
  readonly instructions: string;
  readonly preparationDays: string;
}

type DraftErrors = Partial<Record<keyof Draft, string>>;

function validate(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  const required = t('selection.form.required');
  if (idOf(draft.tender) === undefined) errors.tender = required;
  if (draft.sessionType === '') errors.sessionType = required;
  if (draft.purpose.trim() === '') errors.purpose = required;
  if (draft.agenda.trim() === '') errors.agenda = required;
  if (draft.basis === '') errors.basis = required;
  if (draft.basis === 'scored_criterion' && draft.criterion === '') {
    errors.criterion = t('selection.sessionForm.criterionRequired');
  }
  if (draft.instructions.trim() === '') errors.instructions = required;
  const days = Number(draft.preparationDays);
  if (draft.preparationDays === '' || !Number.isInteger(days) || days < 0 || days > 60) {
    errors.preparationDays = t('selection.sessionForm.preparationInvalid');
  }
  return errors;
}

export default function AssessmentSessionFormPage() {
  const navigate = useNavigate();
  const linkedTender = useTenderSearchParam();
  const initial: Draft = {
    tender: linkedTender === null ? '' : String(linkedTender),
    lot: '',
    sessionType: '',
    purpose: '',
    agenda: '',
    basis: '',
    criterion: '',
    instructions: '',
    preparationDays: '5',
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const create = useApiMutation(selectionEndpoints.createSession);
  const tenderId = idOf(draft.tender);
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    tenderId === undefined ? null : { params: { tenderId } },
  );

  const update = (values: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...values }));
    setDirty(true);
  };

  const local = touched ? validate(draft) : {};
  const server = formErrors(create.error, FIELDS);
  const conditions = summary.data?.tender.conditions;
  const typeBlocked =
    conditions !== undefined &&
    ((draft.sessionType === 'reference_check' && !conditions.referencesPermitted) ||
      (draft.sessionType !== 'reference_check' &&
        draft.sessionType !== '' &&
        !conditions.demonstrationsPermitted));

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (Object.keys(validate(draft)).length > 0 || tenderId === undefined) return;
    const created = await attempt(
      create.mutate({
        body: {
          tenderId,
          lotId: idOf(draft.lot) ?? null,
          sessionType: draft.sessionType as AssessmentSessionsSessionType,
          purpose: draft.purpose.trim(),
          agenda: draft.agenda.trim(),
          assessmentBasis: draft.basis as AssessmentSessionsAssessmentBasis,
          criterionId: draft.basis === 'scored_criterion' ? (idOf(draft.criterion) ?? null) : null,
          instructions: draft.instructions.trim(),
          preparationDays: Number(draft.preparationDays),
        },
      }),
    );
    if (created === undefined) return;
    flushSync(() => setDirty(false));
    void navigate(selectionPaths.session(created.sessionId), { state: { record: created } });
  };

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.sessionForm.title')}
          subtitle={t('selection.sessionForm.intro')}
          back={{ to: selectionPaths.assessments, label: t('selection.assessments.title') }}
        />
      }
    >
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <form
        className="tiq-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {create.error !== null && (
          <FormErrorSummary title={selectionErrorMessage(create.error)} errors={server.other} />
        )}
        <Card title={t('selection.sessionForm.scope')}>
          <div className="tiq-form-grid">
            <TenderSelect
              mode="form"
              value={draft.tender}
              onChange={(tender) => update({ tender, lot: '', criterion: '' })}
              error={local.tender ?? server.forField('tenderId')}
            />
            <Select
              label={t('selection.common.lot')}
              placeholder={t('selection.common.wholeTender')}
              value={draft.lot}
              options={(summary.data?.lots ?? []).map((lot) => ({
                value: String(lot.lotId),
                label: t('selection.common.lotLabel', { lotNo: lot.lotNo, title: lot.title }),
              }))}
              onChange={(lot) => update({ lot })}
              error={server.forField('lotId')}
            />
            <Select
              label={t('selection.sessionForm.type')}
              placeholder={t('selection.form.select')}
              required
              value={draft.sessionType}
              options={ASSESSMENT_SESSIONS_SESSION_TYPE.map((value) => ({
                value,
                label: tEnum('assessment_sessions.session_type', value),
              }))}
              onChange={(sessionType) => update({ sessionType })}
              error={local.sessionType ?? server.forField('sessionType')}
            />
            <NumberInput
              label={t('selection.sessionForm.preparationDays')}
              hint={t('selection.sessionForm.preparationHint')}
              required
              places={0}
              suffix={t('selection.sessionForm.days')}
              value={draft.preparationDays}
              onChange={(preparationDays) => update({ preparationDays })}
              error={local.preparationDays ?? server.forField('preparationDays')}
            />
            {typeBlocked && conditions !== undefined && (
              <div className="tiq-form-full">
                <Banner tone="warning" title={t('selection.sessionForm.typeNotPermitted')}>
                  <p>{conditions.conditionsNote}</p>
                </Banner>
              </div>
            )}
            <TextArea
              label={t('selection.sessionForm.purpose')}
              required
              rows={3}
              fieldClassName="tiq-form-full"
              value={draft.purpose}
              onChange={(purpose) => update({ purpose })}
              error={local.purpose ?? server.forField('purpose')}
            />
            <TextArea
              label={t('selection.sessionForm.agenda')}
              required
              rows={4}
              fieldClassName="tiq-form-full"
              value={draft.agenda}
              onChange={(agenda) => update({ agenda })}
              error={local.agenda ?? server.forField('agenda')}
            />
          </div>
        </Card>
        <Card
          title={t('selection.sessionForm.basisTitle')}
          subtitle={t('selection.sessionForm.basisIntro')}
        >
          <div className="tiq-form-grid">
            <RadioGroup
              label={t('selection.sessionForm.basis')}
              required
              fieldClassName="tiq-form-full"
              value={draft.basis}
              options={ASSESSMENT_SESSIONS_ASSESSMENT_BASIS.map((value) => ({
                value,
                label: tEnum('assessment_sessions.assessment_basis', value),
                hint: t('selection.sessionForm.basisEffects', {
                  effects: ASSESSMENT_BASIS_EFFECTS[value]
                    .map((effect) => tEnum('assessment_findings.effect', effect))
                    .join(', '),
                }),
              }))}
              onChange={(basis) => update({ basis, criterion: '' })}
              error={local.basis ?? server.forField('assessmentBasis')}
            />
            {draft.basis === 'scored_criterion' && (
              <Select
                label={t('selection.sessionForm.criterion')}
                hint={t('selection.sessionForm.criterionHint')}
                placeholder={t('selection.form.select')}
                required
                value={draft.criterion}
                options={(summary.data?.criteria ?? []).map((criterion) => ({
                  value: String(criterion.criterionId),
                  label: t('selection.sessionForm.criterionOption', {
                    name: criterion.name,
                    weight: criterion.weight,
                  }),
                }))}
                onChange={(criterion) => update({ criterion })}
                error={local.criterion ?? server.forField('criterionId')}
              />
            )}
            <TextArea
              label={t('selection.sessionForm.instructions')}
              hint={t('selection.sessionForm.instructionsHint')}
              required
              rows={4}
              fieldClassName="tiq-form-full"
              value={draft.instructions}
              onChange={(instructions) => update({ instructions })}
              error={local.instructions ?? server.forField('instructions')}
            />
          </div>
        </Card>
        <div className="tiq-inline">
          <Button type="submit" variant="primary" icon="check" loading={create.pending}>
            {t('selection.sessionForm.submit')}
          </Button>
          <Button type="button" onClick={() => void navigate(selectionPaths.assessments)}>
            {t('selection.form.cancel')}
          </Button>
          <span className="tiq-text-muted">{t('selection.sessionForm.savedAsPlanned')}</span>
        </div>
      </form>
    </SelectionPage>
  );
}
