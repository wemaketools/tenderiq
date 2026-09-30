/**
 * BUY-16 Tender Q&A, one question: late-question disposition, owner, draft answer with the sanitized shared wording,
 * confidentiality review by a second person, publication to participants or the public, a private answer, escalation
 * to an addendum, or a decline (FR-10, BR-14). Every consequential step is confirmed (COM-02).
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { BuyerQuestionDetail } from '@contracts/clarifications';
import type { QuestionsAudience } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { useAppSelector } from '../../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  FormErrorSummary,
  OfficialDeadline,
  PageHeader,
  QueryView,
  RadioGroup,
  Reference,
  Select,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { ClarificationHistory } from '../../components/shared';
import {
  buyerPaths,
  explainError,
  isQuestionClosed,
  questionNextAction,
  subjectLabel,
} from '../../lib';

type DialogKind =
  'assign' | 'late' | 'requestReview' | 'review' | 'publish' | 'private' | 'escalate' | 'decline';

interface Draft {
  readonly sanitizedQuestion: string;
  readonly answerText: string;
  readonly audience: QuestionsAudience;
}

function draftOf(question: BuyerQuestionDetail): Draft {
  return {
    sanitizedQuestion: question.sanitizedQuestion ?? '',
    answerText: question.answerText ?? '',
    audience: question.audience,
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.sanitizedQuestion === b.sanitizedQuestion &&
    a.answerText === b.answerText &&
    a.audience === b.audience
  );
}

export default function QuestionPage() {
  const { questionId } = useParams();
  const id = Number(questionId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.questionPage.notFound')} />
        <EmptyState title={t('clarifications.questionPage.notFound')} />
      </div>
    );
  }
  return <QuestionLoader key={id} questionId={id} />;
}

function QuestionLoader({ questionId }: { readonly questionId: number }) {
  const query = useApiQuery(clarificationsEndpoints.questionsGet, { params: { questionId } });
  const [result, setResult] = useState<BuyerQuestionDetail | null>(null);
  return (
    <div className="tiq-page">
      <QueryView query={query}>
        {(data) => <QuestionWorkspace question={result ?? data} onChanged={setResult} />}
      </QueryView>
      {query.data === undefined && (
        <PageHeader
          title={t('clarifications.questionPage.title', { id: questionId })}
          back={{ to: buyerPaths.questions, label: t('clarifications.questionPage.back') }}
        />
      )}
    </div>
  );
}

function QuestionWorkspace({
  question,
  onChanged,
}: {
  readonly question: BuyerQuestionDetail;
  readonly onChanged: (next: BuyerQuestionDetail) => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const e = clarificationsEndpoints;
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [baseline, setBaseline] = useState<Draft>(() => draftOf(question));
  const [draft, setDraft] = useState<Draft>(baseline);
  const [triedSave, setTriedSave] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState(
    question.owner === null ? '' : String(question.owner.userId),
  );
  const [lateDecision, setLateDecision] = useState<'accepted' | 'declined'>('accepted');
  const [reviewOutcome, setReviewOutcome] = useState<'cleared' | 'returned'>('cleared');
  const [publishAudience, setPublishAudience] = useState<'all_participants' | 'public'>(
    question.audience === 'public' ? 'public' : 'all_participants',
  );
  const [targetAddendum, setTargetAddendum] = useState('');

  const owners = useApiQuery(e.ownerCandidates, { query: { tenderId: question.tender.tenderId } });
  const draftAddenda = useApiQuery(
    e.addendaList,
    dialog === 'escalate'
      ? { query: { tenderId: question.tender.tenderId, status: ['draft'], pageSize: 50 } }
      : null,
  );

  const assign = useApiMutation(e.questionsAssign);
  const late = useApiMutation(e.questionsLateDisposition);
  const save = useApiMutation(e.questionsSaveAnswer);
  const requestReview = useApiMutation(e.questionsRequestReview);
  const review = useApiMutation(e.questionsReview);
  const publish = useApiMutation(e.questionsPublish);
  const answerPrivately = useApiMutation(e.questionsAnswerPrivately);
  const escalate = useApiMutation(e.questionsEscalate);
  const decline = useApiMutation(e.questionsDecline);

  const tz = question.timeZone;
  const closed = isQuestionClosed(question.status);
  const needsDisposition = question.afterDeadline && question.lateDisposition === null && !closed;
  const hasOwner = question.owner !== null;
  const editable = !closed && !needsDisposition && hasOwner && question.status !== 'in_review';
  const dirty = !sameDraft(draft, baseline);
  const ownReview = question.owner !== null && question.owner.userId === userId;
  const reviewCleared =
    question.status === 'in_review' && question.confidentialityReviewedBy !== null;

  const apply = (next: BuyerQuestionDetail, message: string): void => {
    onChanged(next);
    const nextDraft = draftOf(next);
    setBaseline(nextDraft);
    setDraft(nextDraft);
    setTriedSave(false);
    setDialog(null);
    toast.show(message, 'success');
  };

  const run = async <T,>(action: () => Promise<T>, onDone: (value: T) => void): Promise<void> => {
    try {
      onDone(await action());
    } catch {
      // The mutation keeps the error; the dialog or form shows it.
    }
  };

  const saveErrors = formErrors(save.error, ['sanitizedQuestion', 'answerText', 'audience']);
  const sanitizedMissing = draft.sanitizedQuestion.trim() === '';
  const answerMissing = draft.answerText.trim() === '';

  const onSave = (): void => {
    setTriedSave(true);
    if (sanitizedMissing || answerMissing) return;
    void run(
      () =>
        save.mutate({
          params: { questionId: question.id },
          body: {
            sanitizedQuestion: draft.sanitizedQuestion,
            answerText: draft.answerText,
            audience: draft.audience,
          },
        }),
      (next) => apply(next, t('clarifications.questionPage.toast.saved')),
    );
  };

  const scope = t('clarifications.questionPage.scope', {
    id: question.id,
    reference: question.tender.reference,
  });

  const close = (reset: () => void) => () => {
    reset();
    setDialog(null);
  };

  const actions = (
    <>
      {needsDisposition && (
        <Button variant="primary" icon="alertTriangle" onClick={() => setDialog('late')}>
          {t('clarifications.questionPage.action.late')}
        </Button>
      )}
      {!closed && !needsDisposition && (
        <Button icon="userPlus" onClick={() => setDialog('assign')}>
          {hasOwner
            ? t('clarifications.questionPage.action.reassign')
            : t('clarifications.questionPage.action.assign')}
        </Button>
      )}
      {question.status === 'draft_answer' && (
        <Button icon="send" onClick={() => setDialog('requestReview')} disabled={dirty}>
          {t('clarifications.questionPage.action.requestReview')}
        </Button>
      )}
      {question.status === 'in_review' && question.confidentialityReviewedBy === null && (
        <Button icon="shieldCheck" onClick={() => setDialog('review')}>
          {t('clarifications.questionPage.action.review')}
        </Button>
      )}
      {reviewCleared && (
        <Button variant="primary" icon="megaphone" onClick={() => setDialog('publish')}>
          {t('clarifications.questionPage.action.publish')}
        </Button>
      )}
      {!closed && !needsDisposition && hasOwner && (
        <Button icon="lock" onClick={() => setDialog('private')}>
          {t('clarifications.questionPage.action.private')}
        </Button>
      )}
      {!closed && !needsDisposition && (
        <Button icon="fileText" onClick={() => setDialog('escalate')}>
          {t('clarifications.questionPage.action.escalate')}
        </Button>
      )}
      {!closed && (
        <Button variant="danger-soft" icon="ban" onClick={() => setDialog('decline')}>
          {t('clarifications.questionPage.action.decline')}
        </Button>
      )}
    </>
  );

  return (
    <>
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={t('clarifications.questionPage.title', { id: question.id })}
        back={{ to: buyerPaths.questions, label: t('clarifications.questionPage.back') }}
        meta={
          <>
            <Reference value={question.tender.reference} />
            <StatusChip enum="questions.status" value={question.status} />
            <StatusChip enum="questions.audience" value={question.audience} />
            {question.responseDueAt !== null && (
              <OfficialDeadline
                variant="block"
                label={t('clarifications.questionPage.responseDue')}
                deadline={{ at: question.responseDueAt, timeZone: tz }}
                showRemaining
              />
            )}
            <span>
              <strong>{t('clarifications.common.nextAction')}:</strong>{' '}
              {questionNextAction(question)}
            </span>
          </>
        }
        actions={actions}
      />

      {needsDisposition && (
        <Banner tone="error" title={t('clarifications.questionPage.lateBanner.title')}>
          <p>{t('clarifications.questionPage.lateBanner.body')}</p>
        </Banner>
      )}
      {question.status === 'escalated_to_addendum' && question.addendumId !== null && (
        <Banner
          tone="info"
          title={t('clarifications.questionPage.escalatedBanner', {
            no: question.addendumNumber ?? question.addendumId,
          })}
          actions={
            <Button
              size="sm"
              onClick={() => navigate(buyerPaths.addendum(question.addendumId ?? 0))}
            >
              {t('clarifications.questionPage.openAddendum')}
            </Button>
          }
        />
      )}
      {question.status === 'published' && (
        <Banner tone="success" title={t('clarifications.questionPage.publishedBanner')}>
          <p>
            {t('clarifications.questionPage.publishedDetail', {
              audience: t(`clarifications.audience.${question.audience}`),
              at: formatDateTime(question.publishedAt, tz),
            })}
          </p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card
            title={t('clarifications.questionPage.questionCard')}
            subtitle={t('clarifications.questionPage.questionCardHint')}
          >
            <div className="tiq-stack">
              <p>{question.questionText}</p>
              <DetailList
                items={[
                  {
                    key: 'supplier',
                    label: t('clarifications.questionPage.supplier'),
                    value: (
                      <span className="tiq-inline">
                        {question.supplier.name}
                        <Chip tone="neutral" size="sm" icon="lock">
                          {t('clarifications.questionPage.confidential')}
                        </Chip>
                      </span>
                    ),
                  },
                  {
                    key: 'askedBy',
                    label: t('clarifications.questionPage.askedBy'),
                    value: question.askedBy.fullName,
                  },
                  {
                    key: 'category',
                    label: t('clarifications.questionPage.category'),
                    value: `${t(`clarifications.subject.type.${question.subjectType}`)} · ${subjectLabel(question)}`,
                  },
                  {
                    key: 'submitted',
                    label: t('clarifications.questionPage.submitted'),
                    value: formatDateTime(question.submittedAt, tz),
                  },
                  {
                    key: 'late',
                    label: t('clarifications.questionPage.lateLabel'),
                    value: question.afterDeadline
                      ? question.lateDisposition === null
                        ? t('clarifications.questions.lateUndecided')
                        : `${t(`clarifications.questions.late.${question.lateDisposition}`)} — ${question.lateDispositionReason ?? ''}`
                      : t('clarifications.questionPage.onTime'),
                  },
                ]}
              />
            </div>
          </Card>

          <Card
            title={t('clarifications.questionPage.draftCard')}
            subtitle={
              editable
                ? t('clarifications.questionPage.draftHint')
                : t('clarifications.questionPage.draftLocked')
            }
            footer={
              editable ? (
                <div className="tiq-inline">
                  <Button
                    variant="primary"
                    icon="check"
                    loading={save.pending}
                    disabled={!dirty}
                    onClick={onSave}
                  >
                    {t('clarifications.questionPage.saveDraft')}
                  </Button>
                  <span className="tiq-text-muted" aria-live="polite">
                    {dirty
                      ? t('clarifications.questionPage.unsaved')
                      : question.answerText === null
                        ? t('clarifications.questionPage.noDraft')
                        : t('clarifications.questionPage.savedNotPublished')}
                  </span>
                </div>
              ) : undefined
            }
          >
            <div className="tiq-form-stack">
              <TextArea
                label={t('clarifications.questionPage.sanitized')}
                hint={t('clarifications.questionPage.sanitizedHint')}
                required
                rows={3}
                value={draft.sanitizedQuestion}
                disabled={!editable}
                onChange={(value) => setDraft({ ...draft, sanitizedQuestion: value })}
                error={
                  saveErrors.forField('sanitizedQuestion') ??
                  (triedSave && sanitizedMissing
                    ? t('clarifications.questionPage.sanitizedRequired')
                    : undefined)
                }
              />
              <TextArea
                label={t('clarifications.questionPage.answer')}
                required
                rows={5}
                value={draft.answerText}
                disabled={!editable}
                onChange={(value) => setDraft({ ...draft, answerText: value })}
                error={
                  saveErrors.forField('answerText') ??
                  (triedSave && answerMissing
                    ? t('clarifications.questionPage.answerRequired')
                    : undefined)
                }
              />
              <RadioGroup
                label={t('clarifications.questionPage.audience')}
                value={draft.audience}
                onChange={(value) => setDraft({ ...draft, audience: value as QuestionsAudience })}
                error={saveErrors.forField('audience')}
                options={(['all_participants', 'public', 'private'] as const).map((value) => ({
                  value,
                  label: t(`clarifications.audience.${value}`),
                  hint: t(`clarifications.audienceHint.${value}`),
                  disabled: !editable,
                }))}
              />
              {save.error !== null && (
                <FormErrorSummary
                  title={explainError(save.error)?.detail ?? save.error.title}
                  errors={saveErrors.other}
                />
              )}
            </div>
          </Card>
        </div>

        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.questionPage.handling')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'owner',
                  label: t('clarifications.common.owner'),
                  value: question.owner?.fullName ?? t('clarifications.common.unassigned'),
                },
                {
                  key: 'status',
                  label: t('clarifications.questions.col.status'),
                  value: <StatusChip enum="questions.status" value={question.status} />,
                },
                {
                  key: 'reviewer',
                  label: t('clarifications.questionPage.reviewer'),
                  value:
                    question.confidentialityReviewedBy?.fullName ??
                    t('clarifications.questionPage.notReviewed'),
                },
                {
                  key: 'published',
                  label:
                    question.status === 'answered_privately'
                      ? t('clarifications.questionPage.answeredPrivatelyAt')
                      : t('clarifications.questionPage.publishedAt'),
                  value:
                    question.publishedAt === null
                      ? t('clarifications.questions.notPublished')
                      : formatDateTime(question.publishedAt, tz),
                },
                {
                  key: 'addendum',
                  label: t('clarifications.questionPage.addendum'),
                  value:
                    question.addendumId === null ? null : (
                      <Reference
                        value={t('clarifications.common.addendumNo', {
                          no: question.addendumNumber ?? question.addendumId,
                        })}
                        to={buyerPaths.addendum(question.addendumId)}
                      />
                    ),
                },
              ]}
            />
            {ownReview && question.status === 'in_review' && (
              <p className="tiq-text-muted">{t('clarifications.questionPage.selfReviewHint')}</p>
            )}
          </Card>
          <Card title={t('clarifications.history.title')}>
            <ClarificationHistory entries={question.history} timeZone={tz} />
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={dialog === 'assign'}
        title={t('clarifications.questionPage.assignDialog.title')}
        scope={scope}
        consequence={t('clarifications.questionPage.assignDialog.consequence')}
        confirmLabel={t('clarifications.questionPage.action.assign')}
        pending={assign.pending}
        error={explainError(assign.error)}
        reason={{ label: t('clarifications.common.note'), required: false }}
        onCancel={close(assign.reset)}
        onConfirm={({ reason }) => {
          if (ownerUserId === '') return;
          void run(
            () =>
              assign.mutate({
                params: { questionId: question.id },
                body: {
                  ownerUserId: Number(ownerUserId),
                  ...(reason === '' ? {} : { note: reason }),
                },
              }),
            (next) => apply(next, t('clarifications.questionPage.toast.assigned')),
          );
        }}
      >
        <Select
          label={t('clarifications.common.owner')}
          required
          value={ownerUserId}
          onChange={setOwnerUserId}
          placeholder={t('clarifications.questionPage.assignDialog.pick')}
          error={formErrors(assign.error, ['ownerUserId']).forField('ownerUserId')}
          options={(owners.data ?? []).map((owner) => ({
            value: String(owner.userId),
            label: t('clarifications.questionPage.assignDialog.option', {
              name: owner.fullName,
              capacity: owner.capacity ?? '',
              count: owner.openQuestions,
            }),
          }))}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'late'}
        title={t('clarifications.questionPage.lateDialog.title')}
        scope={scope}
        consequence={
          lateDecision === 'accepted'
            ? t('clarifications.questionPage.lateDialog.accepted')
            : t('clarifications.questionPage.lateDialog.declined')
        }
        confirmLabel={t('clarifications.questionPage.lateDialog.confirm')}
        pending={late.pending}
        error={explainError(late.error)}
        reason={{ label: t('clarifications.common.reason'), required: true }}
        onCancel={close(late.reset)}
        onConfirm={({ reason }) =>
          run(
            () =>
              late.mutate({
                params: { questionId: question.id },
                body: { lateDisposition: lateDecision, lateDispositionReason: reason },
              }),
            (next) => apply(next, t('clarifications.questionPage.toast.late')),
          )
        }
      >
        <RadioGroup
          label={t('clarifications.questionPage.lateDialog.decision')}
          value={lateDecision}
          onChange={(value) => setLateDecision(value as 'accepted' | 'declined')}
          options={[
            { value: 'accepted', label: t('clarifications.questions.late.accepted') },
            { value: 'declined', label: t('clarifications.questions.late.declined') },
          ]}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'requestReview'}
        title={t('clarifications.questionPage.requestReviewDialog.title')}
        scope={scope}
        consequence={t('clarifications.questionPage.requestReviewDialog.consequence')}
        confirmLabel={t('clarifications.questionPage.action.requestReview')}
        pending={requestReview.pending}
        error={explainError(requestReview.error)}
        reason={{ label: t('clarifications.common.note'), required: false }}
        onCancel={close(requestReview.reset)}
        onConfirm={({ reason }) =>
          run(
            () =>
              requestReview.mutate({
                params: { questionId: question.id },
                body: reason === '' ? {} : { note: reason },
              }),
            (next) => apply(next, t('clarifications.questionPage.toast.reviewRequested')),
          )
        }
      />

      <ConfirmActionDialog
        open={dialog === 'review'}
        title={t('clarifications.questionPage.reviewDialog.title')}
        scope={scope}
        consequence={
          reviewOutcome === 'cleared'
            ? t('clarifications.questionPage.reviewDialog.cleared')
            : t('clarifications.questionPage.reviewDialog.returned')
        }
        confirmLabel={t('clarifications.questionPage.reviewDialog.confirm')}
        pending={review.pending}
        error={explainError(review.error)}
        reason={{ label: t('clarifications.common.note'), required: reviewOutcome === 'returned' }}
        onCancel={close(review.reset)}
        onConfirm={({ reason }) =>
          run(
            () =>
              review.mutate({
                params: { questionId: question.id },
                body: { outcome: reviewOutcome, ...(reason === '' ? {} : { note: reason }) },
              }),
            (next) => apply(next, t('clarifications.questionPage.toast.reviewed')),
          )
        }
      >
        <div className="tiq-stack">
          <p>
            <strong>{t('clarifications.questionPage.sanitized')}:</strong>{' '}
            {question.sanitizedQuestion}
          </p>
          <p>
            <strong>{t('clarifications.questionPage.answer')}:</strong> {question.answerText}
          </p>
          <RadioGroup
            label={t('clarifications.questionPage.reviewDialog.outcome')}
            value={reviewOutcome}
            onChange={(value) => setReviewOutcome(value as 'cleared' | 'returned')}
            options={[
              { value: 'cleared', label: t('clarifications.questionPage.reviewDialog.clear') },
              { value: 'returned', label: t('clarifications.questionPage.reviewDialog.return') },
            ]}
          />
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'publish'}
        title={t('clarifications.questionPage.publishDialog.title')}
        scope={scope}
        consequence={t(`clarifications.questionPage.publishDialog.${publishAudience}`)}
        confirmLabel={t('clarifications.questionPage.action.publish')}
        pending={publish.pending}
        error={explainError(publish.error)}
        onCancel={close(publish.reset)}
        onConfirm={() =>
          run(
            () =>
              publish.mutate({
                params: { questionId: question.id },
                body: { audience: publishAudience },
              }),
            (next) => apply(next, t('clarifications.questionPage.toast.published')),
          )
        }
      >
        <RadioGroup
          label={t('clarifications.questionPage.audience')}
          value={publishAudience}
          onChange={(value) => setPublishAudience(value as 'all_participants' | 'public')}
          options={(['all_participants', 'public'] as const).map((value) => ({
            value,
            label: t(`clarifications.audience.${value}`),
            hint: t(`clarifications.audienceHint.${value}`),
          }))}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'private'}
        title={t('clarifications.questionPage.privateDialog.title')}
        scope={scope}
        consequence={t('clarifications.questionPage.privateDialog.consequence', {
          supplier: question.supplier.name,
        })}
        confirmLabel={t('clarifications.questionPage.action.private')}
        pending={answerPrivately.pending}
        error={explainError(answerPrivately.error)}
        reason={{ label: t('clarifications.common.reason'), required: true }}
        acknowledgement={t('clarifications.questionPage.privateDialog.acknowledge')}
        onCancel={close(answerPrivately.reset)}
        onConfirm={({ reason }) => {
          if (answerMissing) return;
          void run(
            () =>
              answerPrivately.mutate({
                params: { questionId: question.id },
                body: { answerText: draft.answerText, reason, notMaterialConfirmed: true },
              }),
            (next) => apply(next, t('clarifications.questionPage.toast.private')),
          );
        }}
      >
        {answerMissing ? (
          <Banner tone="error" title={t('clarifications.questionPage.answerRequired')} />
        ) : (
          <p>
            <strong>{t('clarifications.questionPage.answer')}:</strong> {draft.answerText}
          </p>
        )}
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'escalate'}
        title={t('clarifications.questionPage.escalateDialog.title')}
        scope={scope}
        consequence={t('clarifications.questionPage.escalateDialog.consequence')}
        confirmLabel={t('clarifications.questionPage.action.escalate')}
        pending={escalate.pending}
        error={explainError(escalate.error)}
        reason={{ label: t('clarifications.common.reason'), required: true }}
        onCancel={close(escalate.reset)}
        onConfirm={({ reason }) =>
          run(
            () =>
              escalate.mutate({
                params: { questionId: question.id },
                body: {
                  reason,
                  ...(targetAddendum === '' ? {} : { addendumId: Number(targetAddendum) }),
                },
              }),
            (next) =>
              apply(
                next.question,
                t('clarifications.questionPage.toast.escalated', { no: next.addendum.number }),
              ),
          )
        }
      >
        <Select
          label={t('clarifications.questionPage.escalateDialog.target')}
          value={targetAddendum}
          onChange={setTargetAddendum}
          placeholder={t('clarifications.questionPage.escalateDialog.newAddendum')}
          options={(draftAddenda.data?.items ?? []).map((addendum) => ({
            value: String(addendum.id),
            label: `${t('clarifications.common.addendumNo', { no: addendum.number })} · ${addendum.title}`,
          }))}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'decline'}
        tone="danger"
        title={t('clarifications.questionPage.declineDialog.title')}
        scope={scope}
        consequence={t('clarifications.questionPage.declineDialog.consequence')}
        confirmLabel={t('clarifications.questionPage.action.decline')}
        pending={decline.pending}
        error={explainError(decline.error)}
        reason={{ label: t('clarifications.common.reason'), required: true }}
        onCancel={close(decline.reset)}
        onConfirm={({ reason }) =>
          run(
            () => decline.mutate({ params: { questionId: question.id }, body: { reason } }),
            (next) => apply(next, t('clarifications.questionPage.toast.declined')),
          )
        }
      />
    </>
  );
}
