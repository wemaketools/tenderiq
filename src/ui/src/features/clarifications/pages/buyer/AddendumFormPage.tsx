/**
 * BUY-17 Addenda and date changes, draft form: the proposed change, change areas, materiality, affected lots,
 * requirement changes (added, modified or removed, with the new wording and treatment), the response-time assessment,
 * an optional new submission deadline in the tender's official zone (the ONLY way to change a deadline, BR-13/BR-16)
 * and the action required of suppliers who already submitted. Saving keeps a draft; approval and issue follow on the
 * addendum page.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type {
  BuyerAddendumDetail,
  BuyerTenderContext,
  RequirementChangeInput,
} from '@contracts/clarifications';
import type {
  AddendaExistingSubmissionAction,
  AddendaMateriality,
  AddendumRequirementChangesChangeType,
  RequirementsTreatment,
} from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  DateTimeInput,
  EmptyState,
  FormErrorSummary,
  MultiSelect,
  OfficialDeadline,
  PageHeader,
  QueryView,
  RadioGroup,
  ReadinessChecklist,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../../components/ui';
import type { ReadinessItem } from '../../../../components/ui';
import { t, tEnum } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { BuyerTenderSelect } from '../../components/BuyerTenderSelect';
import { useBuyerTenders } from '../../hooks';
import { buyerPaths, enumOptions, explainError } from '../../lib';

interface ChangeRow {
  readonly key: number;
  readonly changeType: AddendumRequirementChangesChangeType;
  readonly requirementId: string;
  readonly refCode: string;
  readonly lotId: string;
  readonly newText: string;
  readonly newTreatment: string;
}

interface FormState {
  readonly title: string;
  readonly changeDescription: string;
  readonly reason: string;
  readonly materiality: AddendaMateriality;
  readonly changesScope: boolean;
  readonly changesTerms: boolean;
  readonly changesSubmission: boolean;
  readonly changesEvaluation: boolean;
  readonly lotIds: string[];
  readonly changes: ChangeRow[];
  readonly changesDeadline: boolean;
  readonly newSubmissionDeadline: string | null;
  readonly responseTimeAssessment: string;
  readonly existingSubmissionAction: AddendaExistingSubmissionAction;
}

const EMPTY_FORM: FormState = {
  title: '',
  changeDescription: '',
  reason: '',
  materiality: 'material',
  changesScope: false,
  changesTerms: false,
  changesSubmission: false,
  changesEvaluation: false,
  lotIds: [],
  changes: [],
  changesDeadline: false,
  newSubmissionDeadline: null,
  responseTimeAssessment: '',
  existingSubmissionAction: 'acknowledge',
};

function formOf(addendum: BuyerAddendumDetail): FormState {
  return {
    title: addendum.title,
    changeDescription: addendum.changeDescription,
    reason: addendum.reason,
    materiality: addendum.materiality,
    changesScope: addendum.changesScope,
    changesTerms: addendum.changesTerms,
    changesSubmission: addendum.changesSubmission,
    changesEvaluation: addendum.changesEvaluation,
    lotIds: addendum.affectedLots.map((lot) => String(lot.lotId)),
    changes: addendum.requirementChanges.map((change, index) => ({
      key: index + 1,
      changeType: change.changeType,
      requirementId: change.changeType === 'added' ? '' : String(change.requirementId),
      refCode: change.refCode,
      lotId: change.lotId === null ? '' : String(change.lotId),
      newText: change.newText ?? '',
      newTreatment: change.newTreatment ?? '',
    })),
    changesDeadline: addendum.newSubmissionDeadline !== null,
    newSubmissionDeadline: addendum.newSubmissionDeadline?.at ?? null,
    responseTimeAssessment: addendum.responseTimeAssessment ?? '',
    existingSubmissionAction: addendum.existingSubmissionAction,
  };
}

const FIELDS = [
  'title',
  'changeDescription',
  'reason',
  'materiality',
  'changesScope',
  'lotIds',
  'requirementChanges',
  'newSubmissionDeadline',
  'responseTimeAssessment',
  'existingSubmissionAction',
  'tenderId',
];

export default function AddendumFormPage() {
  const { addendumId } = useParams();
  if (addendumId === undefined) {
    return <NewAddendum />;
  }
  const id = Number(addendumId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.addendumPage.notFound')} />
        <EmptyState title={t('clarifications.addendumPage.notFound')} />
      </div>
    );
  }
  return <EditAddendum key={id} addendumId={id} />;
}

function NewAddendum() {
  const [searchParams] = useSearchParams();
  const tenders = useBuyerTenders();
  const [tender, setTender] = useState(searchParams.get('tenderId') ?? '');
  const questionId = Number(searchParams.get('questionId') ?? '');
  const sourceQuestionIds = Number.isInteger(questionId) && questionId > 0 ? [questionId] : [];
  const context = useApiQuery(
    clarificationsEndpoints.buyerTenderContext,
    tender === '' ? null : { params: { tenderId: Number(tender) } },
  );
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.addendumForm.newTitle')}
        subtitle={t('clarifications.addendumForm.subtitle')}
        back={{ to: buyerPaths.addenda, label: t('clarifications.addendumPage.back') }}
      />
      <Card>
        <BuyerTenderSelect
          tenders={tenders.data?.items}
          value={tender}
          onChange={setTender}
          required
          label={t('clarifications.addendumForm.tender')}
          placeholder={t('clarifications.addendumForm.pickTender')}
        />
      </Card>
      {tender === '' ? (
        <EmptyState
          icon="fileText"
          title={t('clarifications.addendumForm.pickTenderTitle')}
          description={t('clarifications.addendumForm.pickTenderHint')}
        />
      ) : (
        <QueryView query={context}>
          {(data) => (
            <AddendumForm
              key={data.tenderId}
              context={data}
              initial={EMPTY_FORM}
              sourceQuestionIds={sourceQuestionIds}
              existing={null}
            />
          )}
        </QueryView>
      )}
    </div>
  );
}

function EditAddendum({ addendumId }: { readonly addendumId: number }) {
  const addendum = useApiQuery(clarificationsEndpoints.addendaGet, { params: { addendumId } });
  const context = useApiQuery(
    clarificationsEndpoints.buyerTenderContext,
    addendum.data === undefined ? null : { params: { tenderId: addendum.data.tender.tenderId } },
  );
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.addendumForm.editTitle')}
        subtitle={t('clarifications.addendumForm.subtitle')}
        back={{
          to: buyerPaths.addendum(addendumId),
          label: t('clarifications.addendumForm.backToAddendum'),
        }}
      />
      <QueryView query={addendum}>
        {(data) =>
          data.status !== 'draft' ? (
            <Banner tone="warning" title={t('clarifications.addendumForm.notEditable')}>
              <p>{t('clarifications.errors.ADDENDUM_NOT_EDITABLE')}</p>
            </Banner>
          ) : (
            <QueryView query={context}>
              {(tender) => (
                <AddendumForm
                  context={tender}
                  initial={formOf(data)}
                  sourceQuestionIds={[]}
                  existing={data}
                />
              )}
            </QueryView>
          )
        }
      </QueryView>
    </div>
  );
}

function AddendumForm({
  context,
  initial,
  sourceQuestionIds,
  existing,
}: {
  readonly context: BuyerTenderContext;
  readonly initial: FormState;
  readonly sourceQuestionIds: readonly number[];
  readonly existing: BuyerAddendumDetail | null;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const [form, setForm] = useState<FormState>(initial);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<BuyerAddendumDetail | null>(null);
  const [nextKey, setNextKey] = useState(initial.changes.length + 1);
  const create = useApiMutation(clarificationsEndpoints.addendaCreate);
  const updateAddendum = useApiMutation(clarificationsEndpoints.addendaUpdate);
  const mutation = existing === null ? create : updateAddendum;
  const tz = context.officialTimeZone;
  const dirty = saved === null && JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    if (saved !== null) {
      navigate(buyerPaths.addendum(saved.id), { state: { addendum: saved } });
    }
  }, [navigate, saved]);

  const set = (values: Partial<FormState>): void => setForm({ ...form, ...values });
  const setRow = (key: number, values: Partial<ChangeRow>): void =>
    set({ changes: form.changes.map((row) => (row.key === key ? { ...row, ...values } : row)) });

  const anyArea =
    form.changesScope || form.changesTerms || form.changesSubmission || form.changesEvaluation;
  const deadlineMs =
    form.newSubmissionDeadline === null ? null : Date.parse(form.newSubmissionDeadline);
  const clientErrors: Record<string, string | undefined> = {
    title: form.title.trim() === '' ? t('clarifications.addendumForm.required.title') : undefined,
    changeDescription:
      form.changeDescription.trim() === ''
        ? t('clarifications.addendumForm.required.description')
        : undefined,
    reason:
      form.reason.trim() === '' ? t('clarifications.addendumForm.required.reason') : undefined,
    changesScope: anyArea ? undefined : t('clarifications.errors.CHANGE_AREA_REQUIRED'),
    newSubmissionDeadline: !form.changesDeadline
      ? undefined
      : deadlineMs === null
        ? t('clarifications.addendumForm.required.deadline')
        : deadlineMs <= now
          ? t('clarifications.errors.NEW_DEADLINE_IN_PAST')
          : !form.changesSubmission
            ? t('clarifications.errors.NEW_DEADLINE_WITHOUT_SUBMISSION_CHANGE')
            : undefined,
    requirementChanges: form.changes.some((row) =>
      row.changeType === 'added'
        ? row.refCode.trim() === '' || row.newText.trim() === '' || row.newTreatment === ''
        : row.requirementId === '' ||
          (row.changeType === 'modified' && row.newText.trim() === '' && row.newTreatment === ''),
    )
      ? t('clarifications.addendumForm.required.changes')
      : undefined,
  };
  const hasClientErrors = Object.values(clientErrors).some((value) => value !== undefined);
  const serverErrors = formErrors(mutation.error, FIELDS);
  const errorFor = (field: string): string | undefined =>
    serverErrors.forField(field) ?? (tried ? clientErrors[field] : undefined);

  const withSubmissions = context.participants.filter((p) => p.hasEffectiveSubmission);
  const readiness: ReadinessItem[] = [
    {
      id: 'areas',
      label: t('clarifications.readiness.CHANGE_AREA_REQUIRED.label'),
      status: anyArea ? 'passed' : 'blocking',
      detail: anyArea
        ? t('clarifications.readiness.CHANGE_AREA_REQUIRED.passed')
        : t('clarifications.readiness.CHANGE_AREA_REQUIRED.blocking'),
    },
    {
      id: 'lots',
      label: t('clarifications.readiness.AFFECTED_LOTS_REQUIRED.label'),
      status: form.lotIds.length > 0 || context.lots.length === 0 ? 'passed' : 'warning',
      detail:
        form.lotIds.length > 0 || context.lots.length === 0
          ? t('clarifications.readiness.AFFECTED_LOTS_REQUIRED.passed')
          : t('clarifications.addendumForm.readiness.lotsBeforeSubmit'),
    },
    {
      id: 'assessment',
      label: t('clarifications.readiness.RESPONSE_TIME_ASSESSMENT_REQUIRED.label'),
      status:
        form.materiality === 'non_material' || form.responseTimeAssessment.trim() !== ''
          ? 'passed'
          : 'warning',
      detail:
        form.materiality === 'non_material' || form.responseTimeAssessment.trim() !== ''
          ? t('clarifications.readiness.RESPONSE_TIME_ASSESSMENT_REQUIRED.passed')
          : t('clarifications.addendumForm.readiness.assessmentBeforeSubmit'),
    },
    {
      id: 'existing',
      label: t('clarifications.readiness.existing.label'),
      status:
        form.materiality === 'material' &&
        form.existingSubmissionAction === 'none' &&
        withSubmissions.length > 0
          ? 'warning'
          : 'passed',
      detail: t('clarifications.addendumForm.readiness.existing', {
        count: withSubmissions.length,
      }),
    },
  ];

  const lotOptions = context.lots.map((lot) => ({
    value: String(lot.lotId),
    label: t('clarifications.common.lotLabel', { no: lot.lotNo, title: lot.title }),
  }));

  const onSave = async (): Promise<void> => {
    setTried(true);
    if (hasClientErrors) return;
    const requirementChanges: RequirementChangeInput[] = form.changes.map((row) => {
      const requirement = context.requirements.find(
        (item) => String(item.requirementId) === row.requirementId,
      );
      return {
        ...(row.changeType === 'added' ? {} : { requirementId: Number(row.requirementId) }),
        refCode:
          row.changeType === 'added' ? row.refCode.trim() : (requirement?.refCode ?? row.refCode),
        lotId: row.lotId === '' ? (requirement?.lotId ?? null) : Number(row.lotId),
        changeType: row.changeType,
        newText:
          row.changeType === 'removed' || row.newText.trim() === '' ? null : row.newText.trim(),
        newTreatment:
          row.changeType === 'removed' || row.newTreatment === ''
            ? null
            : (row.newTreatment as RequirementsTreatment),
      };
    });
    const fields = {
      title: form.title,
      changeDescription: form.changeDescription,
      reason: form.reason,
      materiality: form.materiality,
      changesScope: form.changesScope,
      changesTerms: form.changesTerms,
      changesSubmission: form.changesSubmission,
      changesEvaluation: form.changesEvaluation,
      newSubmissionDeadline: form.changesDeadline ? form.newSubmissionDeadline : null,
      responseTimeAssessment:
        form.responseTimeAssessment.trim() === '' ? null : form.responseTimeAssessment,
      existingSubmissionAction: form.existingSubmissionAction,
      lotIds: form.lotIds.map(Number),
      requirementChanges,
    };
    try {
      const result =
        existing === null
          ? await create.mutate({
              body: {
                ...fields,
                tenderId: context.tenderId,
                sourceQuestionIds: [...sourceQuestionIds],
              },
            })
          : await updateAddendum.mutate({ params: { addendumId: existing.id }, body: fields });
      toast.show(t('clarifications.addendumForm.saved'), 'success');
      setSaved(result);
    } catch {
      // Shown by the form error summary.
    }
  };

  return (
    <>
      <UnsavedChangesGuard when={dirty} />
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.addendumForm.changeSection')}>
            <div className="tiq-form-grid">
              <TextField
                label={t('clarifications.addendumForm.title')}
                required
                fieldClassName="tiq-form-full"
                value={form.title}
                onChange={(value) => set({ title: value })}
                error={errorFor('title')}
              />
              <TextArea
                label={t('clarifications.addendumForm.description')}
                required
                rows={4}
                fieldClassName="tiq-form-full"
                value={form.changeDescription}
                onChange={(value) => set({ changeDescription: value })}
                error={errorFor('changeDescription')}
              />
              <TextArea
                label={t('clarifications.addendumForm.reason')}
                required
                rows={2}
                fieldClassName="tiq-form-full"
                value={form.reason}
                onChange={(value) => set({ reason: value })}
                error={errorFor('reason')}
              />
              <RadioGroup
                label={t('clarifications.addendumForm.materiality')}
                value={form.materiality}
                onChange={(value) => set({ materiality: value as AddendaMateriality })}
                error={errorFor('materiality')}
                options={(['material', 'non_material'] as const).map((value) => ({
                  value,
                  label: tEnum('addenda.materiality', value),
                  hint: t(`clarifications.addendumForm.materialityHint.${value}`),
                }))}
              />
              <div className="tiq-field">
                <span className="tiq-field-label">
                  {t('clarifications.addendumForm.changeAreas')}
                </span>
                <div className="tiq-stack">
                  <Checkbox
                    label={t('clarifications.changeAreas.scope')}
                    checked={form.changesScope}
                    onChange={(checked) => set({ changesScope: checked })}
                  />
                  <Checkbox
                    label={t('clarifications.changeAreas.terms')}
                    checked={form.changesTerms}
                    onChange={(checked) => set({ changesTerms: checked })}
                  />
                  <Checkbox
                    label={t('clarifications.changeAreas.submission')}
                    checked={form.changesSubmission}
                    onChange={(checked) => set({ changesSubmission: checked })}
                  />
                  <Checkbox
                    label={t('clarifications.changeAreas.evaluation')}
                    checked={form.changesEvaluation}
                    onChange={(checked) => set({ changesEvaluation: checked })}
                    error={errorFor('changesScope')}
                  />
                </div>
              </div>
              {lotOptions.length > 0 && (
                <MultiSelect
                  label={t('clarifications.addendumForm.lots')}
                  hint={t('clarifications.addendumForm.lotsHint')}
                  fieldClassName="tiq-form-full"
                  value={form.lotIds}
                  onChange={(value) => set({ lotIds: value })}
                  options={lotOptions}
                  error={errorFor('lotIds')}
                />
              )}
            </div>
          </Card>

          <Card
            title={t('clarifications.addendumForm.requirementsSection')}
            subtitle={t('clarifications.addendumForm.requirementsHint')}
            actions={
              <Button
                size="sm"
                icon="plus"
                onClick={() => {
                  set({
                    changes: [
                      ...form.changes,
                      {
                        key: nextKey,
                        changeType: 'modified',
                        requirementId: '',
                        refCode: '',
                        lotId: '',
                        newText: '',
                        newTreatment: '',
                      },
                    ],
                  });
                  setNextKey(nextKey + 1);
                }}
              >
                {t('clarifications.addendumForm.addChange')}
              </Button>
            }
          >
            <div className="tiq-stack tiq-stack--spaced">
              {form.changes.length === 0 && (
                <EmptyState compact title={t('clarifications.addendumForm.noChanges')} />
              )}
              {form.changes.map((row, index) => {
                const requirement = context.requirements.find(
                  (item) => String(item.requirementId) === row.requirementId,
                );
                return (
                  <fieldset key={row.key} className="tiq-fieldset">
                    <legend>{t('clarifications.addendumForm.changeNo', { no: index + 1 })}</legend>
                    <div className="tiq-form-grid">
                      <Select
                        label={t('clarifications.addendumForm.changeType')}
                        value={row.changeType}
                        onChange={(value) =>
                          setRow(row.key, {
                            changeType: value as AddendumRequirementChangesChangeType,
                          })
                        }
                        options={enumOptions('addendum_requirement_changes.change_type')}
                      />
                      {row.changeType === 'added' ? (
                        <TextField
                          label={t('clarifications.addendumForm.refCode')}
                          required
                          value={row.refCode}
                          onChange={(value) => setRow(row.key, { refCode: value })}
                        />
                      ) : (
                        <Select
                          label={t('clarifications.addendumForm.requirement')}
                          required
                          value={row.requirementId}
                          onChange={(value) => setRow(row.key, { requirementId: value })}
                          placeholder={t('clarifications.addendumForm.pickRequirement')}
                          options={context.requirements.map((item) => ({
                            value: String(item.requirementId),
                            label: `${item.refCode} · ${item.section}`,
                          }))}
                        />
                      )}
                      {lotOptions.length > 0 && (
                        <Select
                          label={t('clarifications.addendumForm.lot')}
                          value={row.lotId}
                          onChange={(value) => setRow(row.key, { lotId: value })}
                          placeholder={t('clarifications.common.allLots')}
                          options={lotOptions}
                        />
                      )}
                      {requirement !== undefined && (
                        <p className="tiq-form-full tiq-text-muted">
                          {t('clarifications.addendumForm.currentText', { text: requirement.text })}{' '}
                          ({tEnum('requirements.treatment', requirement.treatment)})
                        </p>
                      )}
                      {row.changeType !== 'removed' && (
                        <>
                          <TextArea
                            label={t('clarifications.addendumForm.newText')}
                            required={row.changeType === 'added'}
                            rows={2}
                            fieldClassName="tiq-form-full"
                            value={row.newText}
                            onChange={(value) => setRow(row.key, { newText: value })}
                          />
                          <Select
                            label={t('clarifications.addendumForm.newTreatment')}
                            required={row.changeType === 'added'}
                            value={row.newTreatment}
                            onChange={(value) => setRow(row.key, { newTreatment: value })}
                            placeholder={t('clarifications.addendumForm.unchanged')}
                            options={enumOptions('requirements.treatment')}
                          />
                        </>
                      )}
                      <div className="tiq-form-full">
                        <Button
                          size="sm"
                          variant="danger-soft"
                          icon="trash"
                          onClick={() =>
                            set({ changes: form.changes.filter((item) => item.key !== row.key) })
                          }
                        >
                          {t('clarifications.addendumForm.removeChange', { no: index + 1 })}
                        </Button>
                      </div>
                    </div>
                  </fieldset>
                );
              })}
              {errorFor('requirementChanges') !== undefined && (
                <p className="tiq-field-error">{errorFor('requirementChanges')}</p>
              )}
            </div>
          </Card>

          <Card title={t('clarifications.addendumForm.datesSection')}>
            <div className="tiq-form-stack">
              {context.submissionDeadline !== null && (
                <OfficialDeadline
                  variant="block"
                  label={t('clarifications.addendumPage.currentDeadline')}
                  deadline={context.submissionDeadline}
                />
              )}
              <Checkbox
                label={t('clarifications.addendumForm.changesDeadline')}
                hint={t('clarifications.addendumForm.changesDeadlineHint')}
                checked={form.changesDeadline}
                onChange={(checked) =>
                  set({
                    changesDeadline: checked,
                    changesSubmission: checked ? true : form.changesSubmission,
                  })
                }
              />
              {form.changesDeadline && (
                <DateTimeInput
                  label={t('clarifications.addendumPage.newDeadline')}
                  required
                  timeZone={tz}
                  value={form.newSubmissionDeadline}
                  onChange={(value) => set({ newSubmissionDeadline: value })}
                  error={errorFor('newSubmissionDeadline')}
                />
              )}
              <TextArea
                label={t('clarifications.addendumPage.responseTime')}
                hint={t('clarifications.addendumForm.responseTimeHint')}
                required={form.materiality === 'material'}
                rows={3}
                value={form.responseTimeAssessment}
                onChange={(value) => set({ responseTimeAssessment: value })}
                error={errorFor('responseTimeAssessment')}
              />
              <RadioGroup
                label={t('clarifications.addendumPage.existingAction')}
                hint={t('clarifications.addendumForm.existingHint', {
                  count: withSubmissions.length,
                })}
                value={form.existingSubmissionAction}
                onChange={(value) =>
                  set({ existingSubmissionAction: value as AddendaExistingSubmissionAction })
                }
                error={errorFor('existingSubmissionAction')}
                options={(['none', 'acknowledge', 'supplement', 'replace'] as const).map(
                  (value) => ({
                    value,
                    label: tEnum('addenda.existing_submission_action', value),
                    hint: t(`clarifications.existingAction.${value}`),
                  }),
                )}
              />
            </div>
          </Card>

          {mutation.error !== null && (
            <FormErrorSummary
              title={explainError(mutation.error)?.detail ?? mutation.error.title}
              errors={serverErrors.other}
            />
          )}
          {tried && hasClientErrors && (
            <Banner tone="error" title={t('clarifications.addendumForm.fixErrors')} />
          )}
          <div className="tiq-inline">
            <Button variant="primary" icon="check" loading={mutation.pending} onClick={onSave}>
              {t('clarifications.addendumForm.save')}
            </Button>
            <ButtonLink
              to={existing === null ? buyerPaths.addenda : buyerPaths.addendum(existing.id)}
            >
              {t('clarifications.common.cancel')}
            </ButtonLink>
            <span className="tiq-text-muted">{t('clarifications.addendumForm.saveHint')}</span>
          </div>
        </div>

        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.addendumPage.readiness')}>
            <ReadinessChecklist
              label={t('clarifications.addendumPage.readiness')}
              items={readiness}
            />
          </Card>
          <Card title={t('clarifications.addendumForm.participants')}>
            {context.participants.length === 0 ? (
              <EmptyState compact title={t('clarifications.addendumForm.noParticipants')} />
            ) : (
              <ul className="tiq-stack">
                {context.participants.map((participant) => (
                  <li key={participant.supplier.tenantId}>
                    {participant.supplier.name}
                    <div className="tiq-cell-sub">
                      {participant.hasEffectiveSubmission
                        ? t('clarifications.addendumPage.priorReceipt', {
                            receipt: participant.effectiveReceiptNo ?? '',
                          })
                        : t('clarifications.addendumPage.noSubmission')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
