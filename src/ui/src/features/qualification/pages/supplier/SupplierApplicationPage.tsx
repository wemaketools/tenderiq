/**
 * SUP-20 — One qualification application (FR-06, BR-24; AC-07, AC-08): questions per assessment area with guidance,
 * thresholds and accepted evidence, the supplier's answers and cited evidence from its library, the review status
 * and the buyer's requests for information with their official due time. The supplier saves answers (draft, not
 * visible to the buyer), submits (evidence is snapshotted and a reference assigned), withdraws, and responds to
 * information requests. "Not applicable" needs a reason; missing mandatory evidence blocks submission.
 */
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';

import {
  RespondInfoRequestBody,
  SaveAnswersBody,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type { CustomFieldIssue, CustomFieldValues } from '@contracts/policy';
import type {
  EvidenceCandidate,
  InfoRequest,
  InfoRequestResult,
  SupplierApplicationDetail,
  SupplierApplicationItem,
} from '@contracts/qualification';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DateInput,
  DetailList,
  Dialog,
  EmptyState,
  FormErrorSummary,
  MultiSelect,
  NumberInput,
  OfficialDeadline,
  PageHeader,
  QueryView,
  RadioGroup,
  ReadinessChecklist,
  RestrictedState,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  isReady,
  useToast,
} from '../../../../components/ui';
import type { ReadinessItem } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { CustomFieldsSection } from '../../../admin-policy/components/CustomFieldsSection';
import { EvidenceChips, InfoRequestList } from '../../components/shared';
import { answerDraftOf, answersBody, isStarted } from '../../lib/answerDraft';
import type { AnswerDraft } from '../../lib/answerDraft';
import { summaryTitle, withQualificationMessage } from '../../lib/errors';
import { runCommand, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { supplierQualificationPaths } from '../../lib/paths';
import { dateOrDash, scopeText } from '../../lib/text';
import { errorLookup, validateWith } from '../../lib/validation';

export default function SupplierApplicationPage() {
  const applicationId = useIdParam('applicationId');
  const location = useLocation();
  const created = (location.state as { readonly created?: SupplierApplicationDetail } | null)
    ?.created;
  const seeded = created !== undefined && created.id === applicationId ? created : null;
  const query = useApiQuery(
    api.getSupplierApplication,
    applicationId === null || seeded !== null ? null : { params: { applicationId } },
  );
  const notFound = applicationId === null || query.error?.kind === 'not_found';
  const data = seeded ?? query.data;
  return (
    <div className="tiq-page">
      {data === undefined && (
        <PageHeader
          title={
            notFound
              ? t('qualification.application.notFound')
              : t('qualification.application.loadingTitle')
          }
          back={{ to: supplierQualificationPaths.home, label: t('qualification.application.back') }}
        />
      )}
      {seeded !== null ? (
        <ApplicationView key={seeded.id} fetched={seeded} />
      ) : notFound ? (
        <EmptyState title={t('qualification.application.notFound')} />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.application.restricted')} />
      ) : (
        <QueryView query={query}>
          {(fetched) => <ApplicationView key={fetched.id} fetched={fetched} />}
        </QueryView>
      )}
    </div>
  );
}

type DialogState =
  | { readonly kind: 'submit' }
  | { readonly kind: 'withdraw' }
  | { readonly kind: 'respond'; readonly request: InfoRequest };

function ApplicationView({ fetched }: { readonly fetched: SupplierApplicationDetail }) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canApply = usePermission('supplier.qualification.apply');
  const [application, setApplication] = useState(fetched);
  const [baseline, setBaseline] = useState(() => fetched.items.map(answerDraftOf));
  const [drafts, setDrafts] = useState<readonly AnswerDraft[]>(baseline);
  const [custom, setCustom] = useState<CustomFieldValues>(() => ({
    ...(fetched.customFields ?? {}),
  }));
  const [customBaseline, setCustomBaseline] = useState<CustomFieldValues>(custom);
  const [customIssues, setCustomIssues] = useState<readonly CustomFieldIssue[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [tried, setTried] = useState(false);
  const save = useApiMutation(api.saveSupplierAnswers);
  const submit = useApiMutation(api.submitSupplierApplication);
  const withdraw = useApiMutation(api.withdrawSupplierApplication);
  const needsCandidates =
    canApply &&
    (application.canEdit || application.infoRequests.some((request) => request.status === 'open'));
  const candidates = useApiQuery(
    api.listEvidenceCandidates,
    needsCandidates ? { params: { applicationId: application.id } } : null,
  );

  const editable = canApply && application.canEdit;
  const customDirty = JSON.stringify(custom) !== JSON.stringify(customBaseline);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(baseline) || customDirty;
  const body = customDirty ? { ...answersBody(drafts), customFields: custom } : answersBody(drafts);
  const customContext = useMemo(
    () => ({ category_code: application.scopeCategory.code }),
    [application.scopeCategory.code],
  );
  // Required additional fields are checked on submission; wrong values block the save.
  const customBlocking = customIssues.some((issue) => issue.code !== 'CUSTOM_FIELD_REQUIRED');
  const customMissing = customIssues.some((issue) => issue.code === 'CUSTOM_FIELD_REQUIRED');
  const errors = errorLookup(tried ? validateWith(SaveAnswersBody, body) : [], save.error, [
    'answers',
  ]);
  const answerIndex = new Map(body.answers.map((answer, index) => [answer.criterionId, index]));

  const readiness = readinessOf(application.items, drafts, candidates.data?.items ?? [], dirty);
  const status = application.status;
  const openRequests = application.infoRequests.filter((request) => request.status === 'open');

  const applyDetail = (next: SupplierApplicationDetail): void => {
    setApplication(next);
    const nextDrafts = next.items.map(answerDraftOf);
    setBaseline(nextDrafts);
    setDrafts(nextDrafts);
    const nextCustom = { ...(next.customFields ?? {}) };
    setCustom(nextCustom);
    setCustomBaseline(nextCustom);
    setTried(false);
  };

  const onSave = (): void => {
    setTried(true);
    const parsed = SaveAnswersBody.safeParse(body);
    if (!parsed.success || customBlocking) return;
    void runCommand(
      () => save.mutate({ params: { applicationId: application.id }, body: parsed.data }),
      (next) => {
        applyDetail(next);
        toast.show(t('qualification.application.saved'), 'success');
      },
    );
  };

  const next =
    status === 'draft'
      ? isReady(readiness)
        ? t('qualification.application.next.submit')
        : t('qualification.application.next.complete')
      : status === 'more_info_required'
        ? t('qualification.application.next.respond', { count: openRequests.length })
        : status === 'decided'
          ? t('qualification.application.next.decided')
          : status === 'withdrawn'
            ? t('qualification.application.next.withdrawn')
            : t('qualification.application.next.review');

  return (
    <>
      <PageHeader
        title={t('qualification.application.title', {
          reference: application.reference ?? t('qualification.supplier.draft'),
          program: application.program.programName,
        })}
        subtitle={t('qualification.application.subtitle', {
          buyer: application.buyer.name,
          no: application.program.versionNo,
        })}
        back={{ to: supplierQualificationPaths.home, label: t('qualification.application.back') }}
        meta={
          <>
            <StatusChip enum="qualification_applications.status" value={status} />
            {application.nextDueAt !== null && (
              <OfficialDeadline
                deadline={application.nextDueAt}
                label={t('qualification.application.nextDue')}
                showRemaining
              />
            )}
            <span>{t('qualification.common.nextAction', { action: next })}</span>
          </>
        }
        primaryAction={
          canApply && application.canSubmit ? (
            <Button
              variant="primary"
              icon="send"
              onClick={() => setDialog({ kind: 'submit' })}
              disabled={!isReady(readiness) || customMissing || customDirty}
            >
              {t('qualification.application.submit')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {editable && (
              <Button icon="check" onClick={onSave} loading={save.pending} disabled={!dirty}>
                {t('qualification.application.save')}
              </Button>
            )}
            {canApply && application.canWithdraw && (
              <Button
                variant="danger-soft"
                icon="xCircle"
                onClick={() => setDialog({ kind: 'withdraw' })}
              >
                {t('qualification.application.withdraw')}
              </Button>
            )}
            {application.decisionId !== null && (
              <ButtonLink
                to={supplierQualificationPaths.decision(application.decisionId)}
                icon="gavel"
              >
                {t('qualification.application.openDecision')}
              </ButtonLink>
            )}
          </>
        }
      />
      <StageBanner application={application} timeZone={timeZone} />
      <UnsavedChangesGuard when={dirty && !save.pending} />
      <div className={status === 'draft' ? 'tiq-grid tiq-grid--sidebar' : 'tiq-stack'}>
        <Card title={t('qualification.application.overview')}>
          <DetailList
            items={[
              { label: t('qualification.supplier.col.buyer'), value: application.buyer.name },
              {
                label: t('qualification.supplier.col.program'),
                value: t('qualification.common.programVersion', {
                  name: application.program.programName,
                  no: application.program.versionNo,
                }),
              },
              {
                label: t('qualification.supplier.col.scope'),
                value: scopeText(
                  application.scopeCategory,
                  application.scopeMaxValue,
                  application.scopeGeography,
                ),
              },
              {
                label: t('qualification.application.renewal'),
                value:
                  application.renewalOfDecisionId === null
                    ? t('qualification.queue.newApplication')
                    : t('qualification.assessment.renewalOf', {
                        id: application.renewalOfDecisionId,
                      }),
              },
              {
                label: t('qualification.application.submittedBy'),
                value:
                  application.submittedBy === null || application.submittedAt === null
                    ? t('qualification.application.notSubmitted')
                    : `${application.submittedBy.fullName} · ${formatDateTime(application.submittedAt, timeZone)}`,
              },
              {
                label: t('qualification.application.withdrawnReason'),
                value: application.withdrawnReason,
              },
            ]}
          />
        </Card>
        {status === 'draft' && (
          <Card title={t('qualification.application.readiness')}>
            <ReadinessChecklist
              label={t('qualification.application.readiness')}
              items={readiness}
            />
          </Card>
        )}
      </div>
      <Card title={t('qualification.application.requestsTitle')}>
        <InfoRequestList
          requests={application.infoRequests}
          timeZone={timeZone}
          renderActions={(request) =>
            canApply && request.status === 'open' ? (
              <Button
                size="sm"
                variant="primary"
                icon="send"
                onClick={() => setDialog({ kind: 'respond', request })}
              >
                {t('qualification.application.respond')}
              </Button>
            ) : null
          }
        />
      </Card>
      <FormErrorSummary
        title={summaryTitle(save.error)}
        errors={errors.other.filter((item) => !/^answers\.\d+\./.test(item.field))}
      />
      <Card title={t('qualification.application.customFields')}>
        <CustomFieldsSection
          entityType="qualification_application"
          source={{ audience: 'supplier', buyerSlug: application.buyer.slug }}
          values={custom}
          onChange={editable ? setCustom : undefined}
          context={customContext}
          showErrors={tried}
          serverErrors={save.error?.fieldErrors}
          onValidationChange={setCustomIssues}
        />
      </Card>
      {areasOf(application.items).map((area) => (
        <Card key={area} title={tEnum('qualification_criteria.area', area)}>
          <div className="tiq-stack">
            {application.items
              .filter((item) => item.criterion.area === area)
              .map((item) => {
                const draft = drafts.find((entry) => entry.criterionId === item.criterion.id);
                if (draft === undefined) return null;
                const index = answerIndex.get(item.criterion.id);
                return (
                  <AnswerFields
                    key={item.criterion.id}
                    item={item}
                    draft={draft}
                    editable={editable}
                    candidates={(candidates.data?.items ?? []).filter((candidate) =>
                      candidate.criterionIds.includes(item.criterion.id),
                    )}
                    error={(field) =>
                      index === undefined ? undefined : errors.forField(`answers.${index}.${field}`)
                    }
                    onChange={(nextDraft) =>
                      setDrafts((previous) =>
                        previous.map((entry) =>
                          entry.criterionId === nextDraft.criterionId ? nextDraft : entry,
                        ),
                      )
                    }
                  />
                );
              })}
          </div>
        </Card>
      ))}
      {editable && (
        <div className="tiq-inline">
          <Button icon="check" onClick={onSave} loading={save.pending} disabled={!dirty}>
            {t('qualification.application.save')}
          </Button>
        </div>
      )}

      {dialog?.kind === 'submit' && (
        <ConfirmActionDialog
          open
          title={t('qualification.application.submitTitle')}
          scope={t('qualification.application.submitScope', {
            program: application.program.programName,
            no: application.program.versionNo,
            buyer: application.buyer.name,
          })}
          consequence={t('qualification.application.submitConsequence')}
          acknowledgement={t('qualification.application.declaration')}
          confirmLabel={t('qualification.application.submit')}
          pending={submit.pending}
          error={withQualificationMessage(submit.error)}
          onCancel={() => {
            submit.reset();
            setDialog(null);
          }}
          onConfirm={() =>
            runCommand(
              () =>
                submit.mutate({
                  params: { applicationId: application.id },
                  body: { confirmAccuracy: true },
                }),
              (nextDetail) => {
                applyDetail(nextDetail);
                setDialog(null);
                toast.show(
                  t('qualification.application.submitted', {
                    reference: nextDetail.reference ?? '',
                  }),
                  'success',
                );
              },
            )
          }
        />
      )}
      {dialog?.kind === 'withdraw' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('qualification.application.withdrawTitle')}
          scope={application.reference ?? t('qualification.supplier.draft')}
          consequence={t('qualification.application.withdrawConsequence', {
            buyer: application.buyer.name,
          })}
          confirmLabel={t('qualification.application.withdraw')}
          reason={{ label: t('qualification.application.withdrawReason'), required: true }}
          pending={withdraw.pending}
          error={withQualificationMessage(withdraw.error)}
          onCancel={() => {
            withdraw.reset();
            setDialog(null);
          }}
          onConfirm={({ reason }) =>
            runCommand(
              () =>
                withdraw.mutate({ params: { applicationId: application.id }, body: { reason } }),
              (nextDetail) => {
                applyDetail(nextDetail);
                setDialog(null);
                toast.show(t('qualification.application.withdrawn'), 'success');
              },
            )
          }
        />
      )}
      {dialog?.kind === 'respond' && (
        <RespondDialog
          applicationId={application.id}
          request={dialog.request}
          candidates={candidates.data?.items ?? []}
          onClose={() => setDialog(null)}
          onResponded={(result) => {
            setApplication((previous) => withInfoRequestResult(previous, result));
            invalidateApiQueries('supplier.qualification.overview');
            invalidateApiQueries('supplier.qualification.applications.list');
            setDialog(null);
            toast.show(t('qualification.application.responded'), 'success');
          }}
        />
      )}
    </>
  );
}

function areasOf(items: readonly SupplierApplicationItem[]) {
  return [...new Set(items.map((item) => item.criterion.area))];
}

function StageBanner({
  application,
  timeZone,
}: {
  readonly application: SupplierApplicationDetail;
  readonly timeZone: string;
}) {
  switch (application.status) {
    case 'draft':
      return (
        <Banner tone="info" title={t('qualification.application.stage.draftTitle')}>
          {t('qualification.application.stage.draft', {
            at: formatDateTime(application.updatedAt, timeZone),
          })}
        </Banner>
      );
    case 'more_info_required':
      return (
        <Banner tone="warning" title={t('qualification.application.stage.infoTitle')}>
          {t('qualification.application.stage.info')}
        </Banner>
      );
    case 'decided':
      return (
        <Banner tone="success" title={t('qualification.application.stage.decidedTitle')}>
          {t('qualification.application.stage.decided')}
        </Banner>
      );
    case 'withdrawn':
      return <Banner tone="info" title={t('qualification.application.stage.withdrawnTitle')} />;
    default:
      return (
        <Banner tone="info" title={t('qualification.application.stage.submittedTitle')}>
          {t('qualification.application.stage.submitted')}
        </Banner>
      );
  }
}

function readinessOf(
  items: readonly SupplierApplicationItem[],
  drafts: readonly AnswerDraft[],
  candidates: readonly EvidenceCandidate[],
  dirty: boolean,
): ReadinessItem[] {
  const byId = new Map(drafts.map((draft) => [draft.criterionId, draft]));
  let unanswered = 0;
  let evidenceMissing = 0;
  let naWithoutReason = 0;
  let expiring = 0;
  for (const item of items) {
    const draft = byId.get(item.criterion.id);
    if (draft === undefined) continue;
    const na = draft.applicability === 'not_applicable';
    if (na) {
      if (item.criterion.requiresNaReason && draft.naReason.trim() === '') naWithoutReason += 1;
      continue;
    }
    const needsEvidence = item.criterion.mandatory && item.criterion.evidenceTypes.length > 0;
    if (needsEvidence && draft.evidenceItemIds.length === 0) evidenceMissing += 1;
    const hasValue =
      item.criterion.responseType === 'document'
        ? draft.evidenceItemIds.length > 0
        : item.criterion.responseType === 'yes_no'
          ? draft.bool !== ''
          : item.criterion.responseType === 'number'
            ? draft.number.trim() !== ''
            : item.criterion.responseType === 'date'
              ? draft.date !== ''
              : draft.text.trim() !== '';
    if (item.criterion.mandatory && !isStarted(draft)) unanswered += 1;
    else if (item.criterion.mandatory && !hasValue) unanswered += 1;
    expiring += draft.evidenceItemIds.filter((id) =>
      candidates.some(
        (candidate) => String(candidate.evidenceItemId) === id && candidate.expiringSoon,
      ),
    ).length;
  }
  return [
    {
      id: 'answers',
      label: t('qualification.application.ready.answers'),
      detail:
        unanswered === 0
          ? t('qualification.application.ready.answersDone')
          : t('qualification.application.ready.answersOpen', { count: unanswered }),
      status: unanswered === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'evidence',
      label: t('qualification.application.ready.evidence'),
      detail:
        evidenceMissing === 0
          ? t('qualification.application.ready.evidenceDone')
          : t('qualification.application.ready.evidenceOpen', { count: evidenceMissing }),
      status: evidenceMissing === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'na',
      label: t('qualification.application.ready.na'),
      detail:
        naWithoutReason === 0
          ? t('qualification.application.ready.naDone')
          : t('qualification.application.ready.naOpen', { count: naWithoutReason }),
      status: naWithoutReason === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'saved',
      label: t('qualification.application.ready.saved'),
      detail: dirty
        ? t('qualification.application.ready.unsaved')
        : t('qualification.application.ready.savedDone'),
      status: dirty ? 'blocking' : 'passed',
    },
    {
      id: 'expiring',
      label: t('qualification.application.ready.expiring'),
      detail:
        expiring === 0
          ? t('qualification.application.ready.expiringDone')
          : t('qualification.application.ready.expiringOpen', { count: expiring }),
      status: expiring === 0 ? 'passed' : 'warning',
    },
  ];
}

function AnswerFields({
  item,
  draft,
  editable,
  candidates,
  error,
  onChange,
}: {
  readonly item: SupplierApplicationItem;
  readonly draft: AnswerDraft;
  readonly editable: boolean;
  readonly candidates: readonly EvidenceCandidate[];
  readonly error: (field: string) => string | undefined;
  readonly onChange: (draft: AnswerDraft) => void;
}) {
  const criterion = item.criterion;
  const na = draft.applicability === 'not_applicable';
  const set = (patch: Partial<AnswerDraft>): void => onChange({ ...draft, ...patch });
  return (
    <section className="tiq-stack" aria-label={criterion.question}>
      <div className="tiq-inline">
        <strong>{criterion.question}</strong>
        {criterion.mandatory && (
          <Chip tone="neutral" size="sm">
            {t('qualification.common.mandatory')}
          </Chip>
        )}
        {item.evidenceMissing && (
          <Chip tone="danger" size="sm" icon="alertCircle">
            {t('qualification.assessment.evidenceMissing')}
          </Chip>
        )}
        {item.openInfoRequestIds.length > 0 && (
          <Chip tone="warning" size="sm" icon="messageQuestion">
            {t('qualification.assessment.openRequestChip', {
              count: item.openInfoRequestIds.length,
            })}
          </Chip>
        )}
      </div>
      {criterion.guidance !== null && <p className="tiq-text-muted">{criterion.guidance}</p>}
      {criterion.thresholdDescription !== null && (
        <p className="tiq-text-muted">
          {t('qualification.assessment.threshold', { text: criterion.thresholdDescription })}
        </p>
      )}
      {!editable ? (
        <>
          <DetailList
            items={[
              {
                label: t('qualification.assessment.answer'),
                value: na
                  ? t('qualification.assessment.notApplicable', { reason: draft.naReason })
                  : criterion.responseType === 'yes_no'
                    ? draft.bool === ''
                      ? null
                      : draft.bool === 'yes'
                        ? t('qualification.common.yes')
                        : t('qualification.common.no')
                    : criterion.responseType === 'date'
                      ? dateOrDash(draft.date === '' ? null : draft.date)
                      : criterion.responseType === 'number'
                        ? draft.number || null
                        : draft.text || null,
              },
            ]}
          />
          <EvidenceChips evidence={item.evidence} />
        </>
      ) : (
        <div className="tiq-form-grid">
          <div className="tiq-form-full">
            <RadioGroup
              label={t('qualification.application.applicability')}
              inline
              value={draft.applicability}
              onChange={(value) => set({ applicability: value as AnswerDraft['applicability'] })}
              error={error('applicability')}
              options={[
                {
                  value: 'applicable',
                  label: tEnum('qualification_answers.applicability', 'applicable'),
                },
                {
                  value: 'not_applicable',
                  label: tEnum('qualification_answers.applicability', 'not_applicable'),
                },
              ]}
            />
          </div>
          {na ? (
            <TextArea
              label={t('qualification.application.naReason')}
              hint={t('qualification.application.naReasonHint')}
              required
              rows={2}
              value={draft.naReason}
              onChange={(naReason) => set({ naReason })}
              error={error('naReason')}
              fieldClassName="tiq-form-full"
            />
          ) : (
            <>
              {criterion.responseType === 'text' && (
                <TextArea
                  label={t('qualification.application.answer')}
                  required={criterion.mandatory}
                  rows={3}
                  value={draft.text}
                  onChange={(text) => set({ text })}
                  error={error('answerText')}
                  fieldClassName="tiq-form-full"
                />
              )}
              {criterion.responseType === 'yes_no' && (
                <RadioGroup
                  label={t('qualification.application.answer')}
                  required={criterion.mandatory}
                  inline
                  value={draft.bool}
                  onChange={(bool) => set({ bool })}
                  error={error('answerBool')}
                  options={[
                    { value: 'yes', label: t('qualification.common.yes') },
                    { value: 'no', label: t('qualification.common.no') },
                  ]}
                />
              )}
              {criterion.responseType === 'number' && (
                <NumberInput
                  label={t('qualification.application.answer')}
                  required={criterion.mandatory}
                  places={2}
                  value={draft.number}
                  onChange={(number) => set({ number })}
                  error={error('answerNumber')}
                />
              )}
              {criterion.responseType === 'date' && (
                <DateInput
                  label={t('qualification.application.answer')}
                  required={criterion.mandatory}
                  value={draft.date}
                  onChange={(date) => set({ date })}
                  error={error('answerDate')}
                />
              )}
              {criterion.evidenceTypes.length > 0 && (
                <MultiSelect
                  label={t('qualification.application.evidence', {
                    types: criterion.evidenceTypes
                      .map((value) => tEnum('evidence_items.evidence_type', value))
                      .join(', '),
                  })}
                  hint={
                    candidates.length === 0
                      ? t('qualification.application.noCandidates')
                      : t('qualification.application.evidenceHint')
                  }
                  required={criterion.mandatory}
                  value={draft.evidenceItemIds}
                  onChange={(evidenceItemIds) => set({ evidenceItemIds })}
                  error={error('evidenceItemIds')}
                  fieldClassName="tiq-form-full"
                  options={candidates.map((candidate) => ({
                    value: String(candidate.evidenceItemId),
                    label: candidateLabel(candidate),
                  }))}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function candidateLabel(candidate: EvidenceCandidate): string {
  return [
    candidate.title,
    tEnum('evidence_items.evidence_type', candidate.evidenceType),
    candidate.expiresAt === null
      ? null
      : t('qualification.evidence.expiresOn', { date: dateOrDash(candidate.expiresAt) ?? '' }),
    candidate.expiringSoon ? t('qualification.application.expiringSoon') : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/**
 * The application after the supplier answered an information request: the answered request, the status the mock
 * returned (PRD §8.3: `under_review` once no request stays open), and the open-request count and next due date
 * recomputed from the remaining open requests.
 */
function withInfoRequestResult(
  application: SupplierApplicationDetail,
  result: InfoRequestResult,
): SupplierApplicationDetail {
  const answered = result.infoRequest;
  const infoRequests = application.infoRequests.map((item) =>
    item.id === answered.id ? answered : item,
  );
  const open = infoRequests.filter((item) => item.status === 'open');
  const nextDueAt = open.reduce<SupplierApplicationDetail['nextDueAt']>(
    (earliest, item) =>
      earliest === null || Date.parse(item.dueAt.at) < Date.parse(earliest.at)
        ? item.dueAt
        : earliest,
    null,
  );
  return {
    ...application,
    status: result.applicationStatus,
    infoRequests,
    openInfoRequestCount: open.length,
    nextDueAt,
    items: application.items.map((item) => ({
      ...item,
      openInfoRequestIds: item.openInfoRequestIds.filter((id) =>
        open.some((request) => request.id === id),
      ),
    })),
  };
}

function RespondDialog({
  applicationId,
  request,
  candidates,
  onClose,
  onResponded,
}: {
  readonly applicationId: number;
  readonly request: InfoRequest;
  readonly candidates: readonly EvidenceCandidate[];
  readonly onClose: () => void;
  readonly onResponded: (result: InfoRequestResult) => void;
}) {
  const respond = useApiMutation(api.respondToInfoRequest);
  const [responseText, setResponseText] = useState('');
  const [evidence, setEvidence] = useState<readonly string[]>([]);
  const [tried, setTried] = useState(false);
  const body = { responseText, evidenceItemIds: evidence.map(Number) };
  const errors = errorLookup(
    tried ? validateWith(RespondInfoRequestBody, body) : [],
    respond.error,
    ['responseText', 'evidenceItemIds'],
  );
  const relevant =
    request.criterionId === null
      ? candidates
      : candidates.filter((candidate) => candidate.criterionIds.includes(request.criterionId ?? 0));

  const send = (): void => {
    setTried(true);
    const parsed = RespondInfoRequestBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () =>
        respond.mutate({ params: { applicationId, infoRequestId: request.id }, body: parsed.data }),
      onResponded,
    );
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('qualification.application.respondTitle')}
      description={request.question}
      onClose={onClose}
      dismissible={!respond.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={respond.pending}>
            {t('qualification.common.cancel')}
          </Button>
          <Button variant="primary" icon="send" onClick={send} loading={respond.pending}>
            {t('qualification.application.respond')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={responseText !== '' && !respond.pending} />
      <OfficialDeadline
        deadline={request.dueAt}
        label={t('qualification.infoRequests.due')}
        variant="block"
        showRemaining
      />
      <FormErrorSummary title={summaryTitle(respond.error)} errors={errors.other} />
      <div className="tiq-form-stack">
        <TextArea
          label={t('qualification.application.response')}
          required
          rows={5}
          value={responseText}
          onChange={setResponseText}
          error={errors.forField('responseText')}
        />
        <MultiSelect
          label={t('qualification.application.responseEvidence')}
          hint={relevant.length === 0 ? t('qualification.application.noCandidates') : undefined}
          value={evidence}
          onChange={setEvidence}
          error={errors.forField('evidenceItemIds')}
          options={relevant.map((candidate) => ({
            value: String(candidate.evidenceItemId),
            label: candidateLabel(candidate),
          }))}
        />
      </div>
    </Dialog>
  );
}
