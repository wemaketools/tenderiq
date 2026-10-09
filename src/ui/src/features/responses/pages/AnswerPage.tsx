/**
 * SUP-12 — one requirement of the response: the answer (by response type), progress, deviation, evidence and file
 * attachments (snapshots), reuse of earlier content (flagged for review, FR-11), the assigned contributor with an
 * internal due date, and private review comments. Saving is never submission: every edit states the approvals it
 * invalidated (BR-10).
 */
import { useState } from 'react';

import {
  addAnswerComment,
  assignAnswer,
  attachAnswerDocument,
  detachAnswerDocument,
  getAnswer,
  getDeclarations,
  listReuseCandidates,
  reuseAnswer,
  saveAnswer,
} from '@contracts/bids';
import type { AnswerAttachment, BidAnswerDetail, BidDetail, ReuseCandidate } from '@contracts/bids';
import { BID_ANSWERS_PROGRESS } from '@contracts/enums';
import type { BidAnswersProgress } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { DocumentUploader } from '../../../components/documents';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateTimeInput,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  NumberInput,
  OrDash,
  RadioGroup,
  Select,
  SkeletonBlock,
  StatusChip,
  TextArea,
  Timeline,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatBytes, formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ResponseWorkspace } from '../components/ResponseWorkspace';
import { responseErrorMessage } from '../lib/errors';
import { useCurrentUserId, useIdParam } from '../lib/hooks';

const ANSWER_FIELDS = [
  'answerText',
  'answerNumber',
  'answerChoice',
  'answerBool',
  'deviationNote',
  'progress',
] as const;

interface AnswerDraft {
  readonly answerText: string;
  readonly answerNumber: string;
  readonly answerChoice: string;
  readonly answerBool: string;
  readonly isDeviation: boolean;
  readonly deviationNote: string;
  readonly progress: BidAnswersProgress;
  readonly reuseReviewed: boolean;
}

function draftOf(answer: BidAnswerDetail): AnswerDraft {
  return {
    answerText: answer.answerText ?? '',
    answerNumber: answer.answerNumber ?? '',
    answerChoice: answer.answerChoice ?? '',
    answerBool: answer.answerBool === null ? '' : answer.answerBool ? 'yes' : 'no',
    isDeviation: answer.isDeviation,
    deviationNote: answer.deviationNote ?? '',
    progress: answer.progress,
    reuseReviewed: false,
  };
}

function sameDraft(a: AnswerDraft, b: AnswerDraft): boolean {
  return (Object.keys(a) as (keyof AnswerDraft)[]).every((key) => a[key] === b[key]);
}

// ---------------------------------------------------------------------------------------------------------
// Answer form
// ---------------------------------------------------------------------------------------------------------

interface AnswerFormProps {
  readonly bid: BidDetail;
  readonly answer: BidAnswerDetail;
  readonly canEdit: boolean;
  readonly onSaved: () => void;
}

function AnswerForm({ bid, answer, canEdit, onSaved }: AnswerFormProps) {
  const toast = useToast();
  const initial = draftOf(answer);
  const [draft, setDraft] = useState<AnswerDraft>(initial);
  const [invalidated, setInvalidated] = useState<number>(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const save = useApiMutation(saveAnswer);
  const errors = formErrors(save.error, ANSWER_FIELDS);
  const dirty = !sameDraft(draft, initial);
  const reusePending = answer.reuse !== null && answer.reuse.reviewedAt === null;
  const set = (values: Partial<AnswerDraft>): void =>
    setDraft((current) => ({ ...current, ...values }));

  const submit = async (): Promise<void> => {
    setLocalError(null);
    if (draft.isDeviation && draft.deviationNote.trim() === '') {
      setLocalError(t('responses.answer.deviationNoteRequired'));
      return;
    }
    try {
      const result = await save.mutate({
        params: { bidId: bid.id, requirementId: answer.requirementId },
        body: {
          revisionId: answer.revisionId,
          answerText: draft.answerText.trim() === '' ? null : draft.answerText,
          answerNumber: draft.answerNumber === '' ? null : draft.answerNumber,
          answerChoice: draft.answerChoice === '' ? null : draft.answerChoice,
          answerBool: draft.answerBool === '' ? null : draft.answerBool === 'yes',
          isDeviation: draft.isDeviation,
          deviationNote: draft.isDeviation ? draft.deviationNote.trim() : null,
          progress: draft.progress,
          ...(reusePending && draft.reuseReviewed ? { reuseReviewed: true } : {}),
        },
      });
      setInvalidated(result.invalidatedApprovalIds.length);
      toast.show(t('responses.answer.saved'), 'success');
      onSaved();
    } catch {
      // Shown below the form.
    }
  };

  const disabled = !canEdit;
  let input;
  switch (answer.responseType) {
    case 'yes_no':
      input = (
        <RadioGroup
          label={t('responses.answer.field.answer')}
          value={draft.answerBool}
          inline
          options={[
            { value: 'yes', label: t('responses.answer.yes') },
            { value: 'no', label: t('responses.answer.no') },
          ]}
          onChange={(answerBool) => set({ answerBool })}
          error={errors.forField('answerBool')}
        />
      );
      break;
    case 'number':
    case 'quantity':
      input = (
        <NumberInput
          label={t('responses.answer.field.number')}
          value={draft.answerNumber}
          places={4}
          disabled={disabled}
          onChange={(answerNumber) => set({ answerNumber })}
          error={errors.forField('answerNumber')}
        />
      );
      break;
    case 'choice':
      input = (
        <Select
          label={t('responses.answer.field.choice')}
          placeholder={t('responses.answer.choose')}
          value={draft.answerChoice}
          disabled={disabled}
          options={answer.choices.map((choice) => ({ value: choice, label: choice }))}
          onChange={(answerChoice) => set({ answerChoice })}
          error={errors.forField('answerChoice')}
        />
      );
      break;
    default:
      input = (
        <TextArea
          label={
            answer.responseType === 'document'
              ? t('responses.answer.field.coveringNote')
              : t('responses.answer.field.answer')
          }
          value={draft.answerText}
          rows={8}
          disabled={disabled}
          onChange={(answerText) => set({ answerText })}
          error={errors.forField('answerText')}
          fieldClassName="tiq-form-full"
        />
      );
  }

  return (
    <Card
      title={t('responses.answer.formTitle')}
      subtitle={t('responses.answer.formSubtitle', { no: answer.revisionNo })}
      footer={
        canEdit ? (
          <div className="tiq-inline">
            <Button
              variant="primary"
              loading={save.pending}
              disabled={!dirty}
              onClick={() => void submit()}
            >
              {t('responses.answer.save')}
            </Button>
            <Button disabled={!dirty || save.pending} onClick={() => setDraft(initial)}>
              {t('responses.answer.discard')}
            </Button>
            <span className="tiq-text-muted">{t('responses.answer.saveIsNotSubmit')}</span>
          </div>
        ) : undefined
      }
    >
      <UnsavedChangesGuard when={dirty} />
      <fieldset className="tiq-form-grid" disabled={disabled}>
        <legend className="tiq-visually-hidden">{t('responses.answer.formTitle')}</legend>
        {input}
        <Select
          label={t('responses.answer.field.progress')}
          value={draft.progress}
          required
          options={BID_ANSWERS_PROGRESS.map((value) => ({
            value,
            label: tEnum('bid_answers.progress', value),
          }))}
          onChange={(progress) => set({ progress: progress as BidAnswersProgress })}
          error={errors.forField('progress')}
        />
        <div className="tiq-form-full">
          <Checkbox
            label={t('responses.answer.field.deviation')}
            hint={t('responses.answer.deviationHint')}
            checked={draft.isDeviation}
            onChange={(isDeviation) => set({ isDeviation })}
          />
        </div>
        {draft.isDeviation && (
          <TextArea
            label={t('responses.answer.field.deviationNote')}
            required
            value={draft.deviationNote}
            rows={3}
            onChange={(deviationNote) => set({ deviationNote })}
            error={errors.forField('deviationNote') ?? localError ?? undefined}
            fieldClassName="tiq-form-full"
          />
        )}
        {reusePending && (
          <div className="tiq-form-full">
            <Checkbox
              label={t('responses.answer.field.reuseReviewed')}
              hint={t('responses.answer.reuseReviewedHint')}
              checked={draft.reuseReviewed}
              onChange={(reuseReviewed) => set({ reuseReviewed })}
            />
          </div>
        )}
      </fieldset>
      {invalidated > 0 && (
        <Banner
          tone="warning"
          title={t('responses.common.approvalsInvalidated', { count: invalidated })}
        >
          <p>{t('responses.common.approvalsInvalidatedHint')}</p>
        </Banner>
      )}
      {save.error !== null && (
        <FormErrorSummary title={responseErrorMessage(save.error)} errors={errors.other} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------------------------------------

function AssignmentCard({
  bid,
  answer,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly answer: BidAnswerDetail;
  readonly onSaved: () => void;
}) {
  const toast = useToast();
  const [assignee, setAssignee] = useState(
    answer.assignedUser === null ? '' : String(answer.assignedUser.userId),
  );
  const [dueAt, setDueAt] = useState<string | null>(answer.dueAt);
  const assign = useApiMutation(assignAnswer);
  const canAssign = bid.viewer.canAssign && answer.editable;
  const dirty =
    assignee !== (answer.assignedUser === null ? '' : String(answer.assignedUser.userId)) ||
    dueAt !== answer.dueAt;

  const submit = async (): Promise<void> => {
    try {
      await assign.mutate({
        params: { bidId: bid.id, requirementId: answer.requirementId },
        body: {
          revisionId: answer.revisionId,
          assigneeUserId: assignee === '' ? null : Number(assignee),
          dueAt,
        },
      });
      toast.show(t('responses.assign.saved'), 'success');
      onSaved();
    } catch {
      // Shown in the card.
    }
  };

  return (
    <Card
      title={t('responses.assign.title')}
      footer={
        canAssign ? (
          <Button
            size="sm"
            loading={assign.pending}
            disabled={!dirty}
            onClick={() => void submit()}
          >
            {t('responses.assign.save')}
          </Button>
        ) : undefined
      }
    >
      {canAssign ? (
        <div className="tiq-stack">
          <Select
            label={t('responses.assign.assignee')}
            placeholder={t('responses.assign.unassigned')}
            value={assignee}
            options={bid.team.map((member) => ({
              value: String(member.userId),
              label: `${member.fullName} (${tEnum('pursuit_team_members.responsibility', member.responsibility)})`,
            }))}
            onChange={setAssignee}
          />
          <DateTimeInput
            label={t('responses.assign.dueAt')}
            hint={t('responses.assign.dueHint')}
            value={dueAt}
            timeZone={bid.officialTimeZone}
            onChange={setDueAt}
          />
        </div>
      ) : (
        <DetailList
          stacked
          items={[
            { label: t('responses.assign.assignee'), value: answer.assignedUser?.fullName },
            {
              label: t('responses.assign.dueAt'),
              value:
                answer.dueAt === null ? null : formatDateTime(answer.dueAt, bid.officialTimeZone),
            },
          ]}
        />
      )}
      {assign.error !== null && (
        <Banner tone="error" title={t('responses.assign.failed')}>
          <p>{responseErrorMessage(assign.error)}</p>
        </Banner>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------------------------------------

function AttachmentsCard({
  bid,
  answer,
  canEdit,
  onChanged,
}: {
  readonly bid: BidDetail;
  readonly answer: BidAnswerDetail;
  readonly canEdit: boolean;
  readonly onChanged: () => void;
}) {
  const toast = useToast();
  const [evidenceItemId, setEvidenceItemId] = useState('');
  const attach = useApiMutation(attachAnswerDocument);
  const detach = useApiMutation(detachAnswerDocument);
  const declarations = useApiQuery(
    getDeclarations,
    canEdit ? { params: { bidId: bid.id }, query: { revisionId: answer.revisionId } } : null,
  );
  const options = (declarations.data?.evidenceOptions ?? []).filter(
    (option) => option.status !== 'expired' && option.status !== 'replaced',
  );
  const failure = attach.error ?? detach.error;

  const attachEvidence = async (): Promise<void> => {
    try {
      await attach.mutate({
        params: { bidId: bid.id, requirementId: answer.requirementId },
        body: { revisionId: answer.revisionId, evidenceItemId: Number(evidenceItemId) },
      });
      setEvidenceItemId('');
      toast.show(t('responses.attachments.attached'), 'success');
      onChanged();
    } catch {
      // Shown in the card.
    }
  };

  const attachUpload = async (documentVersionId: number): Promise<void> => {
    try {
      await attach.mutate({
        params: { bidId: bid.id, requirementId: answer.requirementId },
        body: { revisionId: answer.revisionId, documentVersionId },
      });
      toast.show(t('responses.attachments.attached'), 'success');
      onChanged();
    } catch {
      // Shown in the card.
    }
  };

  const remove = async (row: AnswerAttachment): Promise<void> => {
    try {
      await detach.mutate({
        params: { bidId: bid.id, requirementId: answer.requirementId, attachmentId: row.id },
        query: { revisionId: answer.revisionId },
      });
      toast.show(t('responses.attachments.removed'), 'success');
      onChanged();
    } catch {
      // Shown in the card.
    }
  };

  const columns: DataTableColumn<AnswerAttachment>[] = [
    {
      id: 'file',
      header: t('responses.attachments.col.file'),
      cell: (row) => (
        <>
          <span>{row.fileName}</span>
          <span className="tiq-cell-sub">
            {row.evidenceTitle === null
              ? t('responses.attachments.upload')
              : t('responses.attachments.evidence', { title: row.evidenceTitle })}
          </span>
        </>
      ),
    },
    {
      id: 'size',
      header: t('responses.attachments.col.size'),
      numeric: true,
      cell: (row) => formatBytes(row.sizeBytes),
    },
    {
      id: 'envelope',
      header: t('responses.attachments.col.envelope'),
      cell: (row) => tEnum('bid_answers.envelope', row.envelope),
    },
    {
      id: 'attached',
      header: t('responses.attachments.col.attached'),
      cell: (row) => (
        <>
          <span>{row.attachedBy.fullName}</span>
          <span className="tiq-cell-sub">
            {formatDateTime(row.attachedAt, bid.officialTimeZone)}
          </span>
        </>
      ),
    },
    {
      id: 'actions',
      header: t('responses.common.actions'),
      cell: (row) =>
        canEdit ? (
          <Button
            size="sm"
            variant="danger-soft"
            icon="trash"
            disabled={detach.pending}
            onClick={() => void remove(row)}
            aria-label={t('responses.attachments.removeLabel', { name: row.fileName })}
          >
            {t('responses.attachments.remove')}
          </Button>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  return (
    <Card title={t('responses.attachments.title')} subtitle={t('responses.attachments.subtitle')}>
      {answer.evidenceRequired !== null && (
        <p className="tiq-text-muted">
          {t('responses.attachments.required', { what: answer.evidenceRequired })}
        </p>
      )}
      <DataTable
        caption={t('responses.attachments.title')}
        columns={columns}
        rows={answer.attachments}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState compact title={t('responses.attachments.empty')} />}
      />
      {canEdit && (
        <div className="tiq-stack tiq-stack--spaced">
          <div className="tiq-inline">
            <Select
              label={t('responses.attachments.evidenceLabel')}
              placeholder={t('responses.attachments.chooseEvidence')}
              value={evidenceItemId}
              options={options.map((option) => ({
                value: String(option.evidenceItemId),
                label:
                  option.expiresAt === null
                    ? option.title
                    : t('responses.attachments.evidenceOption', {
                        title: option.title,
                        date: formatInstantDate(option.expiresAt, bid.officialTimeZone),
                      }),
              }))}
              onChange={setEvidenceItemId}
              hint={t('responses.attachments.snapshotHint')}
            />
            <Button
              size="sm"
              icon="link"
              disabled={evidenceItemId === ''}
              loading={attach.pending}
              onClick={() => void attachEvidence()}
            >
              {t('responses.attachments.attachEvidence')}
            </Button>
          </div>
          <DocumentUploader
            audience="supplier"
            relatedType="bid_answer"
            relatedId={answer.requirementId}
            defaultClassification="sealed"
            classifications={['sealed', 'commercially_confidential']}
            onUploaded={(result) => void attachUpload(result.version.id)}
          />
        </div>
      )}
      {failure !== null && (
        <Banner tone="error" title={t('responses.attachments.failed')}>
          <p>{responseErrorMessage(failure)}</p>
        </Banner>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------------------------------------

function CommentsCard({
  bid,
  answer,
  onAdded,
}: {
  readonly bid: BidDetail;
  readonly answer: BidAnswerDetail;
  readonly onAdded: () => void;
}) {
  const [body, setBody] = useState('');
  const add = useApiMutation(addAnswerComment);
  const errors = formErrors(add.error, ['body']);

  const submit = async (): Promise<void> => {
    try {
      await add.mutate({
        params: { bidId: bid.id, requirementId: answer.requirementId },
        body: { revisionId: answer.revisionId, body: body.trim() },
      });
      setBody('');
      onAdded();
    } catch {
      // Shown below the input.
    }
  };

  return (
    <Card title={t('responses.comments.title')} subtitle={t('responses.comments.subtitle')}>
      {answer.comments.length === 0 ? (
        <EmptyState compact title={t('responses.comments.empty')} />
      ) : (
        <Timeline
          label={t('responses.comments.title')}
          items={answer.comments.map((comment) => ({
            id: comment.id,
            title: comment.author.fullName,
            meta: formatDateTime(comment.createdAt, bid.officialTimeZone),
            detail: comment.body,
            icon: 'messageSquare',
          }))}
        />
      )}
      {bid.viewer.canComment && (
        <div className="tiq-stack tiq-stack--spaced">
          <UnsavedChangesGuard when={body.trim() !== ''} />
          <TextArea
            label={t('responses.comments.add')}
            value={body}
            rows={3}
            onChange={setBody}
            error={errors.forField('body')}
          />
          <div>
            <Button
              size="sm"
              icon="send"
              disabled={body.trim() === ''}
              loading={add.pending}
              onClick={() => void submit()}
            >
              {t('responses.comments.post')}
            </Button>
          </div>
          {add.error !== null && errors.other.length === 0 && !errors.hasFieldErrors && (
            <p className="tiq-field-error">{responseErrorMessage(add.error)}</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Reuse
// ---------------------------------------------------------------------------------------------------------

function ReuseDialog({
  bid,
  answer,
  open,
  onClose,
  onReused,
}: {
  readonly bid: BidDetail;
  readonly answer: BidAnswerDetail;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onReused: () => void;
}) {
  const toast = useToast();
  const candidates = useApiQuery(
    listReuseCandidates,
    open ? { params: { bidId: bid.id, requirementId: answer.requirementId }, query: {} } : null,
  );
  const reuse = useApiMutation(reuseAnswer);

  const choose = async (candidate: ReuseCandidate): Promise<void> => {
    try {
      await reuse.mutate({
        params: { bidId: bid.id, requirementId: answer.requirementId },
        body: { revisionId: answer.revisionId, sourceAnswerId: candidate.sourceAnswerId },
      });
      toast.show(t('responses.reuse.done'), 'success');
      onReused();
      onClose();
    } catch {
      // Shown in the dialog.
    }
  };

  const columns: DataTableColumn<ReuseCandidate>[] = [
    {
      id: 'source',
      header: t('responses.reuse.col.source'),
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.tenderReference}</span>
          <span className="tiq-cell-sub">
            {row.tenderTitle} · {t('responses.common.revisionNo', { no: row.revisionNo })}
          </span>
        </>
      ),
    },
    {
      id: 'content',
      header: t('responses.reuse.col.content'),
      cell: (row) => (
        <>
          <span>{row.answerText}</span>
          <span className="tiq-cell-sub">
            {row.refCode} · {row.requirementText}
          </span>
        </>
      ),
    },
    {
      id: 'submitted',
      header: t('responses.reuse.col.submitted'),
      cell: (row) =>
        row.submittedAt === null
          ? t('responses.reuse.notSubmitted')
          : formatDateTime(row.submittedAt, bid.officialTimeZone),
    },
    {
      id: 'use',
      header: t('responses.common.actions'),
      cell: (row) => (
        <Button size="sm" loading={reuse.pending} onClick={() => void choose(row)}>
          {t('responses.reuse.use')}
        </Button>
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t('responses.reuse.title')}
      description={t('responses.reuse.description')}
      dismissible={!reuse.pending}
    >
      <DataTable
        caption={t('responses.reuse.title')}
        columns={columns}
        rows={candidates.data?.items}
        rowKey={(row) => String(row.sourceAnswerId)}
        loading={candidates.isFetching}
        error={candidates.error}
        onRetry={candidates.reload}
        empty={<EmptyState compact title={t('responses.reuse.empty')} />}
      />
      {reuse.error !== null && (
        <Banner tone="error" title={t('responses.reuse.failed')}>
          <p>{responseErrorMessage(reuse.error)}</p>
        </Banner>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------------

function AnswerContent({ bid }: { readonly bid: BidDetail }) {
  const requirementId = useIdParam('requirementId');
  const userId = useCurrentUserId();
  const [reuseOpen, setReuseOpen] = useState(false);
  const query = useApiQuery(
    getAnswer,
    requirementId === null ? null : { params: { bidId: bid.id, requirementId }, query: {} },
  );

  if (requirementId === null || query.error?.kind === 'not_found') {
    return (
      <EmptyState
        title={t('responses.answer.notFound')}
        description={t('responses.answer.notFoundHint')}
      />
    );
  }
  const answer = query.data;
  if (answer === undefined) {
    return query.error !== null ? (
      <ErrorState error={query.error} onRetry={query.reload} />
    ) : (
      <SkeletonBlock lines={6} />
    );
  }

  const assignedToOther =
    !bid.viewer.canAssign &&
    answer.assignedUser !== null &&
    userId !== null &&
    answer.assignedUser.userId !== userId;
  const unassignedForContributor =
    !bid.viewer.canAssign && answer.assignedUser === null && !bid.viewer.canEditPricing;
  const canEdit =
    answer.editable && bid.viewer.canEditResponse && !assignedToOther && !unassignedForContributor;
  const formKey = `${answer.revisionId}-${answer.updatedAt ?? 'new'}-${answer.progress}`;

  return (
    <>
      {!answer.editable && (
        <Banner tone="info" title={t('responses.answer.readOnlyTitle')}>
          <p>
            {t('responses.answer.readOnlyRevision', {
              no: answer.revisionNo,
            })}
          </p>
        </Banner>
      )}
      {answer.editable &&
        bid.viewer.canEditResponse &&
        (assignedToOther || unassignedForContributor) && (
          <Banner tone="info" title={t('responses.answer.notAssignedTitle')}>
            <p>
              {assignedToOther
                ? t('responses.answer.assignedToOther', {
                    name: answer.assignedUser?.fullName ?? '',
                  })
                : t('responses.answer.unassigned')}
            </p>
          </Banner>
        )}
      {answer.reuse !== null && answer.reuse.reviewedAt === null && (
        <Banner tone="warning" title={t('responses.answer.reuseTitle')}>
          <p>
            {t('responses.answer.reuseDetail', {
              reference: answer.reuse.tenderReference,
              no: answer.reuse.revisionNo,
              name: answer.reuse.reusedBy.fullName,
            })}
          </p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card
            title={t('responses.answer.requirementTitle', { ref: answer.refCode })}
            actions={
              canEdit ? (
                <Button size="sm" icon="copy" onClick={() => setReuseOpen(true)}>
                  {t('responses.reuse.open')}
                </Button>
              ) : undefined
            }
          >
            <p>{answer.text}</p>
            <DetailList
              items={[
                { label: t('responses.answer.section'), value: answer.section },
                {
                  label: t('responses.answer.lot'),
                  value:
                    answer.lot === null
                      ? t('responses.answer.allLots')
                      : t('responses.lots.option', {
                          no: answer.lot.lotNo,
                          title: answer.lot.title,
                        }),
                },
                {
                  label: t('responses.answer.treatment'),
                  value: <StatusChip enum="requirements.treatment" value={answer.treatment} />,
                },
                {
                  label: t('responses.answer.envelope'),
                  value: tEnum('bid_answers.envelope', answer.envelope),
                },
                {
                  label: t('responses.answer.responseType'),
                  value: tEnum('requirements.response_type', answer.responseType),
                },
                {
                  label: t('responses.answer.missingConsequence'),
                  value: tEnum('requirements.missing_consequence', answer.missingConsequence),
                },
                { label: t('responses.answer.instructions'), value: answer.responseInstructions },
                {
                  label: t('responses.answer.addendum'),
                  value:
                    answer.addendumNumber === null
                      ? null
                      : t('responses.answers.flag.addendum', { no: answer.addendumNumber }),
                },
              ]}
            />
          </Card>
          <AnswerForm
            key={formKey}
            bid={bid}
            answer={answer}
            canEdit={canEdit}
            onSaved={query.reload}
          />
          <AttachmentsCard bid={bid} answer={answer} canEdit={canEdit} onChanged={query.reload} />
        </div>
        <div className="tiq-stack">
          <Card title={t('responses.answer.statusTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('responses.answer.progress'),
                  value: <StatusChip enum="bid_answers.progress" value={answer.progress} />,
                },
                {
                  label: t('responses.answer.deviation'),
                  value: answer.isDeviation ? (
                    <Chip tone="warning">{answer.deviationNote ?? t('responses.answer.yes')}</Chip>
                  ) : (
                    t('responses.answer.no')
                  ),
                },
                {
                  label: t('responses.answer.lastSaved'),
                  value:
                    answer.updatedAt === null
                      ? null
                      : t('responses.answer.savedBy', {
                          name: answer.updatedBy?.fullName ?? '',
                          time: formatDateTime(answer.updatedAt, bid.officialTimeZone),
                        }),
                },
              ]}
            />
          </Card>
          <AssignmentCard
            key={`${answer.assignedUser?.userId ?? 0}-${answer.dueAt ?? ''}`}
            bid={bid}
            answer={answer}
            onSaved={query.reload}
          />
          <CommentsCard bid={bid} answer={answer} onAdded={query.reload} />
        </div>
      </div>
      <ReuseDialog
        bid={bid}
        answer={answer}
        open={reuseOpen}
        onClose={() => setReuseOpen(false)}
        onReused={query.reload}
      />
    </>
  );
}

export default function AnswerPage() {
  return (
    <ResponseWorkspace tab="answers" title={t('responses.answer.pageTitle')}>
      {(bid) => <AnswerContent bid={bid} />}
    </ResponseWorkspace>
  );
}
