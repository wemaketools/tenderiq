/**
 * Due-diligence commands (BUY-25): record or update a finding by area with its disposition, owner and due date
 * (an open finding needs both; a failed finding always blocks the award), request evidence from the preferred bidder
 * through a due-diligence clarification with a permitted scope, and approve or reject readiness (AC-24).
 */
import { useState } from 'react';

import { DUE_DILIGENCE_FINDINGS_AREA, DUE_DILIGENCE_FINDINGS_DISPOSITION } from '@contracts/enums';
import type { DueDiligenceFindingsArea, DueDiligenceFindingsDisposition } from '@contracts/enums';
import type { PersonRef } from '@contracts/common';
import { selectionEndpoints } from '@contracts/selection';
import type {
  DueDiligenceCaseDetail,
  DueDiligenceEvidenceRequest,
  DueDiligenceFinding,
} from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  RadioGroup,
  ReadinessChecklist,
  Select,
  TextArea,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { withSelectionMessage } from '../lib/errors';
import { bidLabel, tenderLabel } from '../lib/labels';
import { attempt, idOf } from '../lib/lists';
import { EvidenceSelect } from './EvidenceSelect';

function caseScope(detail: DueDiligenceCaseDetail): string {
  return `${bidLabel(detail.bid)} · ${tenderLabel(detail.tender)}`;
}

export interface DiligenceFindingDialogProps {
  readonly detail: DueDiligenceCaseDetail;
  /** People who may own a finding (team members holding diligence.manage, from the tender summary). */
  readonly owners: readonly PersonRef[];
  /** The finding to update; omitted to record a new one. */
  readonly finding?: DueDiligenceFinding;
  readonly onClose: () => void;
  readonly onSaved: (finding: DueDiligenceFinding) => void;
}

export function DiligenceFindingDialog({
  detail,
  owners,
  finding,
  onClose,
  onSaved,
}: DiligenceFindingDialogProps) {
  const toast = useToast();
  const create = useApiMutation(selectionEndpoints.recordDiligenceFinding);
  const update = useApiMutation(selectionEndpoints.updateDiligenceFinding);
  const mutation = finding === undefined ? create : update;
  const [area, setArea] = useState<string>(finding?.area ?? '');
  const [text, setText] = useState(finding?.finding ?? '');
  const [disposition, setDisposition] = useState<string>(finding?.disposition ?? '');
  const [owner, setOwner] = useState(
    finding?.owner === null || finding === undefined ? '' : String(finding.owner.userId),
  );
  const [dueAt, setDueAt] = useState<string | null>(finding?.dueAt ?? null);
  const [evidence, setEvidence] = useState(
    finding?.evidenceDocumentId === null || finding === undefined
      ? ''
      : String(finding.evidenceDocumentId),
  );
  const [blocking, setBlocking] = useState(finding?.isAwardBlocking ?? false);
  const [touched, setTouched] = useState(false);
  const server = formErrors(mutation.error, [
    'area',
    'finding',
    'disposition',
    'ownerUserId',
    'dueAt',
    'evidenceDocumentId',
    'isAwardBlocking',
  ]);
  const required = t('selection.form.required');
  const open = disposition === 'unresolved' || disposition === 'condition';
  const failed = disposition === 'failed';
  const errors = {
    area: touched && area === '' ? required : undefined,
    finding: touched && text.trim() === '' ? required : undefined,
    disposition: touched && disposition === '' ? required : undefined,
    owner:
      touched && open && owner === '' ? t('selection.diligenceFinding.ownerRequired') : undefined,
    dueAt:
      touched && open && dueAt === null ? t('selection.diligenceFinding.dueRequired') : undefined,
  };

  return (
    <ConfirmActionDialog
      open
      title={
        finding === undefined
          ? t('selection.diligenceFinding.recordTitle')
          : t('selection.diligenceFinding.updateTitle')
      }
      scope={caseScope(detail)}
      consequence={
        failed || blocking
          ? t('selection.diligenceFinding.blockingConsequence')
          : t('selection.diligenceFinding.consequence')
      }
      confirmLabel={
        finding === undefined
          ? t('selection.diligenceFinding.record')
          : t('selection.diligenceFinding.update')
      }
      pending={mutation.pending}
      error={withSelectionMessage(mutation.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTouched(true);
        if (area === '' || text.trim() === '' || disposition === '') return;
        if (open && (owner === '' || dueAt === null)) return;
        const body = {
          area: area as DueDiligenceFindingsArea,
          finding: text.trim(),
          disposition: disposition as DueDiligenceFindingsDisposition,
          ownerUserId: idOf(owner) ?? null,
          dueAt,
          evidenceDocumentId: idOf(evidence) ?? null,
          isAwardBlocking: failed ? true : blocking,
        };
        const result =
          finding === undefined
            ? await attempt(create.mutate({ params: { caseId: detail.caseId }, body }))
            : await attempt(
                update.mutate({
                  params: { caseId: detail.caseId, findingId: finding.findingId },
                  body,
                }),
              );
        if (result === undefined) return;
        toast.show(t('selection.diligenceFinding.saved'), 'success');
        onSaved(result);
      }}
    >
      <Select
        label={t('selection.diligenceFinding.area')}
        placeholder={t('selection.form.select')}
        required
        value={area}
        options={DUE_DILIGENCE_FINDINGS_AREA.map((value) => ({
          value,
          label: tEnum('due_diligence_findings.area', value),
        }))}
        onChange={setArea}
        error={errors.area ?? server.forField('area')}
      />
      <TextArea
        label={t('selection.diligenceFinding.finding')}
        required
        rows={3}
        value={text}
        onChange={setText}
        error={errors.finding ?? server.forField('finding')}
      />
      <Select
        label={t('selection.diligenceFinding.disposition')}
        placeholder={t('selection.form.select')}
        required
        value={disposition}
        options={DUE_DILIGENCE_FINDINGS_DISPOSITION.map((value) => ({
          value,
          label: tEnum('due_diligence_findings.disposition', value),
        }))}
        onChange={setDisposition}
        error={errors.disposition ?? server.forField('disposition')}
      />
      <Select
        label={t('selection.diligenceFinding.owner')}
        hint={t('selection.diligenceFinding.ownerHint')}
        placeholder={t('selection.diligenceFinding.noOwner')}
        required={open}
        value={owner}
        options={owners.map((person) => ({ value: String(person.userId), label: person.fullName }))}
        onChange={setOwner}
        error={errors.owner ?? server.forField('ownerUserId')}
      />
      <DateTimeInput
        label={t('selection.diligenceFinding.dueAt')}
        required={open}
        timeZone={detail.tender.officialTimeZone}
        value={dueAt}
        onChange={setDueAt}
        error={errors.dueAt ?? server.forField('dueAt')}
      />
      <EvidenceSelect
        relatedType="due_diligence_case"
        relatedId={detail.caseId}
        value={evidence}
        onChange={setEvidence}
        error={server.forField('evidenceDocumentId')}
      />
      <Checkbox
        label={t('selection.diligenceFinding.blocking')}
        hint={failed ? t('selection.diligenceFinding.failedBlocks') : undefined}
        checked={failed || blocking}
        disabled={failed}
        onChange={setBlocking}
        error={server.forField('isAwardBlocking')}
      />
    </ConfirmActionDialog>
  );
}

export interface RequestEvidenceDialogProps {
  readonly detail: DueDiligenceCaseDetail;
  readonly onClose: () => void;
  readonly onRequested: (request: DueDiligenceEvidenceRequest) => void;
}

export function RequestEvidenceDialog({
  detail,
  onClose,
  onRequested,
}: RequestEvidenceDialogProps) {
  const toast = useToast();
  const request = useApiMutation(selectionEndpoints.requestDiligenceEvidence);
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const server = formErrors(request.error, ['question', 'permittedScope', 'dueAt']);
  const required = t('selection.form.required');

  return (
    <ConfirmActionDialog
      open
      title={t('selection.evidenceRequest.title')}
      scope={caseScope(detail)}
      consequence={t('selection.evidenceRequest.consequence', {
        supplier: detail.bid.supplierName,
      })}
      confirmLabel={t('selection.evidenceRequest.confirm')}
      pending={request.pending}
      error={withSelectionMessage(request.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTouched(true);
        if (question.trim() === '' || scope.trim() === '' || dueAt === null) return;
        const result = await attempt(
          request.mutate({
            params: { caseId: detail.caseId },
            body: { question: question.trim(), permittedScope: scope.trim(), dueAt },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.evidenceRequest.sent'), 'success');
        onRequested(result);
      }}
    >
      <Banner tone="info" title={t('selection.evidenceRequest.notNegotiation')} />
      <TextArea
        label={t('selection.evidenceRequest.question')}
        required
        rows={3}
        value={question}
        onChange={setQuestion}
        error={
          (touched && question.trim() === '' ? required : undefined) ?? server.forField('question')
        }
      />
      <TextArea
        label={t('selection.evidenceRequest.scope')}
        hint={t('selection.evidenceRequest.scopeHint')}
        required
        rows={2}
        value={scope}
        onChange={setScope}
        error={
          (touched && scope.trim() === '' ? required : undefined) ??
          server.forField('permittedScope')
        }
      />
      <DateTimeInput
        label={t('selection.evidenceRequest.dueAt')}
        required
        timeZone={detail.tender.officialTimeZone}
        value={dueAt}
        onChange={setDueAt}
        error={(touched && dueAt === null ? required : undefined) ?? server.forField('dueAt')}
      />
    </ConfirmActionDialog>
  );
}

export interface DecideDiligenceDialogProps {
  readonly detail: DueDiligenceCaseDetail;
  readonly onClose: () => void;
  readonly onDecided: (detail: DueDiligenceCaseDetail) => void;
}

export function DecideDiligenceDialog({ detail, onClose, onDecided }: DecideDiligenceDialogProps) {
  const toast = useToast();
  const decide = useApiMutation(selectionEndpoints.decideDiligenceCase);
  const [outcome, setOutcome] = useState<'passed' | 'failed'>(
    detail.passGate.allowed ? 'passed' : 'failed',
  );

  return (
    <ConfirmActionDialog
      open
      tone={outcome === 'failed' ? 'danger' : 'primary'}
      title={t('selection.decideDiligence.title')}
      scope={caseScope(detail)}
      consequence={
        outcome === 'passed'
          ? t('selection.decideDiligence.passConsequence')
          : t('selection.decideDiligence.failConsequence')
      }
      confirmLabel={
        outcome === 'passed'
          ? t('selection.decideDiligence.approve')
          : t('selection.decideDiligence.reject')
      }
      reason={{ label: t('selection.decideDiligence.note'), required: true }}
      pending={decide.pending}
      error={withSelectionMessage(decide.error)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        const result = await attempt(
          decide.mutate({
            params: { caseId: detail.caseId },
            body: { outcome, decisionNote: reason },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.decideDiligence.decided'), 'success');
        onDecided(result);
      }}
    >
      <RadioGroup
        label={t('selection.decideDiligence.outcome')}
        required
        value={outcome}
        options={[
          {
            value: 'passed',
            label: t('selection.decideDiligence.passed'),
            disabled: !detail.passGate.allowed,
            hint: detail.passGate.allowed ? undefined : t('selection.decideDiligence.passBlocked'),
          },
          { value: 'failed', label: t('selection.decideDiligence.failed') },
        ]}
        onChange={(value) => setOutcome(value === 'passed' ? 'passed' : 'failed')}
      />
      {!detail.passGate.allowed && (
        <ReadinessChecklist
          label={t('selection.decideDiligence.readiness')}
          items={detail.passGate.blockers.map((blocker) => ({
            id: blocker.code,
            label: blocker.message,
            status: 'blocking' as const,
          }))}
        />
      )}
    </ConfirmActionDialog>
  );
}
