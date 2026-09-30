/**
 * BUY-29 — One complaint case: standing and timeliness, grounds, evidence, the independent case owner, the
 * procurement hold and what it blocks, investigation, response and remedy, appeal and closure, with the full case
 * history (FR-17, AC-25). A complaint is never handled solely by the person whose conduct is challenged, and
 * releasing a hold needs a decided case and a reason.
 */
import { useState } from 'react';

import {
  COMPLAINT_RESPONSE_OUTCOMES,
  RespondComplaintBody,
  acknowledgeComplaint,
  assignComplaintOwner,
  getComplaint,
  listComplaintOwnerCandidates,
  placeComplaintHold,
  recordComplaintAppealOutcome,
  releaseComplaintHold,
  respondToComplaint,
  transitionComplaint,
} from '@contracts/awards';
import type {
  ComplaintBuyerTransition,
  ComplaintDetail,
  ComplaintResponseOutcome,
} from '@contracts/awards';
import type { FieldError } from '@contracts/common';
import { HOLDS_BLOCKED_ACTIONS } from '@contracts/enums';
import type { ComplaintsStatus, HoldsBlockedActions } from '@contracts/enums';

import type { ApiError } from '../../../api/client';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { DocumentList } from '../../../components/documents';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DateInput,
  DetailList,
  EmptyState,
  MultiSelect,
  OfficialDeadline,
  PageHeader,
  QueryView,
  Reference,
  Select,
  StatusChip,
  TextArea,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { TimelineTone } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { BlockedActions, HoldsCard } from '../components/HoldsCard';
import { TextBlock } from '../components/TextBlock';
import { withAwardMessage } from '../lib/errors';
import { useIdParam, useLatest, useOfficialTimeZone } from '../lib/hooks';
import { yesNo } from '../lib/labels';
import { awardPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

type Command =
  | 'acknowledge'
  | 'assign'
  | 'transition'
  | 'respond'
  | 'appealOutcome'
  | 'placeHold'
  | 'releaseHold';

const CLOSED: readonly ComplaintsStatus[] = ['closed', 'withdrawn'];

/** The generic transitions the buyer may take from each status (the API decides). */
const TRANSITIONS: Readonly<
  Partial<Record<ComplaintsStatus, readonly ComplaintBuyerTransition[]>>
> = {
  acknowledged: ['admissibility_review'],
  admissibility_review: ['under_investigation'],
  response_issued: ['resolved'],
  resolved: ['closed'],
  withdrawn: ['closed'],
};

const RESPONDABLE: readonly ComplaintsStatus[] = ['admissibility_review', 'under_investigation'];

const EVENT_TONE: Readonly<Record<string, TimelineTone>> = {
  received: 'info',
  acknowledged: 'info',
  owner_assigned: 'accent',
  status_changed: 'neutral',
  hold_placed: 'danger',
  hold_released: 'success',
  response_issued: 'accent',
  appeal_lodged: 'warning',
  appeal_decided: 'accent',
  withdrawn: 'neutral',
  closed: 'success',
  note: 'neutral',
};

export default function ComplaintPage() {
  const complaintId = useIdParam('complaintId');
  const query = useApiQuery(
    getComplaint,
    complaintId === null ? null : { params: { complaintId } },
  );
  const [latest, setLatest] = useLatest<ComplaintDetail>(
    complaintId === null ? null : String(complaintId),
    (record) => String(record.complaintId),
  );
  if (complaintId === null) {
    return <EmptyState title={t('awards.complaint.notFound')} icon="scale" />;
  }
  const back = { to: awardPaths.complaints, label: t('awards.complaint.back') };
  return (
    <QueryView
      query={query}
      loading={<PageHeader title={t('awards.complaint.title')} back={back} />}
    >
      {(data) => <ComplaintBody detail={latest ?? data} onChanged={setLatest} back={back} />}
    </QueryView>
  );
}

function ComplaintBody({
  detail,
  onChanged,
  back,
}: {
  readonly detail: ComplaintDetail;
  readonly onChanged: (detail: ComplaintDetail) => void;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission('complaint.manage');
  const [command, setCommand] = useState<Command | null>(null);
  const [standing, setStanding] = useState(detail.standingConfirmed);
  const [timely, setTimely] = useState(detail.withinWindow);
  const [ownerId, setOwnerId] = useState('');
  const [toStatus, setToStatus] = useState('');
  const [outcome, setOutcome] = useState<ComplaintResponseOutcome>('dismissed');
  const [responseText, setResponseText] = useState('');
  const [remedy, setRemedy] = useState('');
  const [publicSummary, setPublicSummary] = useState('');
  const [blocked, setBlocked] = useState<string[]>(['award_final', 'contract_sign']);
  const [reviewDate, setReviewDate] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);

  const acknowledge = useApiMutation(acknowledgeComplaint);
  const assign = useApiMutation(assignComplaintOwner);
  const transition = useApiMutation(transitionComplaint);
  const respond = useApiMutation(respondToComplaint);
  const appealOutcome = useApiMutation(recordComplaintAppealOutcome);
  const placeHold = useApiMutation(placeComplaintHold);
  const releaseHold = useApiMutation(releaseComplaintHold);
  const candidates = useApiQuery(
    listComplaintOwnerCandidates,
    command === 'assign' ? { params: { complaintId: detail.complaintId } } : null,
  );

  const mutations = {
    acknowledge,
    assign,
    transition,
    respond,
    appealOutcome,
    placeHold,
    releaseHold,
  };
  const activeError: ApiError | null = command === null ? null : mutations[command].error;
  const pending = command === null ? false : mutations[command].pending;
  const errors = errorLookup(clientErrors, activeError, [
    'caseOwnerUserId',
    'toStatus',
    'outcome',
    'responseText',
    'remedy',
    'publicSummary',
    'blockedActions',
    'reviewDate',
  ]);

  const closed = CLOSED.includes(detail.status);
  const transitions = TRANSITIONS[detail.status] ?? [];
  const params = { complaintId: detail.complaintId };
  const scope = `${detail.reference} · ${detail.complainant.name} · ${detail.tender.reference}`;

  const start = (next: Command): void => {
    Object.values(mutations).forEach((mutation) => mutation.reset());
    setClientErrors([]);
    setStanding(detail.standingConfirmed);
    setTimely(detail.withinWindow);
    setOwnerId(detail.caseOwner === null ? '' : String(detail.caseOwner.userId));
    setToStatus(transitions[0] ?? '');
    setReviewDate('');
    setCommand(next);
  };

  const missing = (field: string, message: string): boolean => {
    setClientErrors([{ field, code: 'REQUIRED', message }]);
    return true;
  };

  const run = async (reason: string): Promise<ComplaintDetail | null> => {
    const note = reason.trim();
    switch (command) {
      case 'acknowledge':
        return acknowledge.mutate({
          params,
          body: {
            standingConfirmed: standing,
            withinWindow: timely,
            note: note === '' ? undefined : note,
          },
        });
      case 'assign':
        if (ownerId === '' && missing('caseOwnerUserId', t('awards.complaint.ownerRequired')))
          return null;
        return assign.mutate({
          params,
          body: { caseOwnerUserId: Number(ownerId), independenceConfirmed: true },
        });
      case 'transition': {
        const target = transitions.find((item) => item === toStatus);
        if (target === undefined && missing('toStatus', t('awards.complaint.transitionRequired')))
          return null;
        return transition.mutate({ params, body: { toStatus: target ?? 'closed', note } });
      }
      case 'respond': {
        const body = {
          outcome,
          responseText: responseText.trim(),
          remedy: remedy.trim() === '' ? undefined : remedy.trim(),
          publicSummary: publicSummary.trim() === '' ? undefined : publicSummary.trim(),
        };
        const found = validateWith(RespondComplaintBody, body);
        setClientErrors(found);
        if (found.length > 0) return null;
        return respond.mutate({ params, body });
      }
      case 'appealOutcome':
        return appealOutcome.mutate({ params, body: { appealOutcome: note } });
      case 'placeHold': {
        const actions = HOLDS_BLOCKED_ACTIONS.filter((item) => blocked.includes(item));
        if (
          actions.length === 0 &&
          missing('blockedActions', t('awards.complaint.blockedRequired'))
        )
          return null;
        if (reviewDate === '' && missing('reviewDate', t('awards.complaint.reviewDateRequired')))
          return null;
        return placeHold.mutate({
          params,
          body: { blockedActions: actions as HoldsBlockedActions[], reason: note, reviewDate },
        });
      }
      case 'releaseHold':
        return releaseHold.mutate({ params, body: { reason: note } });
      default:
        return null;
    }
  };

  const confirm = async ({ reason }: { readonly reason: string }): Promise<void> => {
    const done = command;
    try {
      const result = await run(reason);
      if (result === null) return;
      setCommand(null);
      onChanged(result);
      invalidateApiQueries('buyer.awards.');
      toast.show(t(`awards.complaint.done.${done ?? 'acknowledge'}`), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const reasonFor = (current: Command | null) => {
    switch (current) {
      case 'acknowledge':
        return { label: t('awards.common.noteOptional'), required: false };
      case 'transition':
        return { label: t('awards.complaint.transitionNote'), required: true };
      case 'appealOutcome':
        return { label: t('awards.complaint.appealOutcome'), required: true };
      case 'placeHold':
        return { label: t('awards.complaint.holdReason'), required: true };
      case 'releaseHold':
        return { label: t('awards.complaint.releaseReason'), required: true };
      default:
        return undefined;
    }
  };

  const primary: Command | null = !canManage
    ? null
    : detail.status === 'received'
      ? 'acknowledge'
      : detail.caseOwner === null && !closed
        ? 'assign'
        : RESPONDABLE.includes(detail.status)
          ? 'respond'
          : detail.status === 'appealed'
            ? 'appealOutcome'
            : null;

  const secondary: Command[] = [];
  if (canManage && !closed) {
    if (primary !== 'assign') secondary.push('assign');
    if (transitions.length > 0) secondary.push('transition');
    if (detail.holdActive) secondary.push('releaseHold');
    else secondary.push('placeHold');
  } else if (canManage && transitions.length > 0) {
    secondary.push('transition');
  }

  return (
    <>
      <PageHeader
        title={t('awards.complaint.titleFor', { reference: detail.reference })}
        back={back}
        meta={
          <>
            <Reference
              value={detail.tender.reference}
              to={awardPaths.tender(detail.tender.tenderId)}
            />
            <StatusChip enum="complaints.status" value={detail.status} />
            {detail.holdActive && (
              <Chip tone="danger" icon="pause">
                {t('awards.complaints.holdActive')}
              </Chip>
            )}
            {detail.responseDueAt !== null && (
              <span className="tiq-inline">
                <span className="tiq-text-muted">{t('awards.complaint.responseDue')}</span>
                <OfficialDeadline deadline={detail.responseDueAt} />
              </span>
            )}
          </>
        }
        primaryAction={
          primary === null ? undefined : (
            <Button variant="primary" onClick={() => start(primary)}>
              {t(`awards.complaint.action.${primary}`)}
            </Button>
          )
        }
        actions={
          secondary.length === 0 ? undefined : (
            <>
              {secondary.map((item) => (
                <Button key={item} onClick={() => start(item)}>
                  {t(`awards.complaint.action.${item}`)}
                </Button>
              ))}
            </>
          )
        }
      />
      <div className="tiq-stack tiq-stack--spaced">
        {detail.holdActive && detail.hold !== null ? (
          <Banner tone="error" title={t('awards.complaint.holdBanner')}>
            <BlockedActions actions={detail.hold.blockedActions} />
          </Banner>
        ) : null}
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('awards.complaint.groundsTitle')}>
              <TextBlock text={detail.grounds} />
            </Card>
            <Card title={t('awards.complaint.responseTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    label: t('awards.complaint.outcome'),
                    value:
                      detail.outcome === null ? (
                        t('awards.complaint.noOutcome')
                      ) : (
                        <StatusChip enum="complaints.outcome" value={detail.outcome} />
                      ),
                  },
                  {
                    label: t('awards.complaint.responseText'),
                    value: (
                      <TextBlock
                        text={detail.responseText}
                        empty={t('awards.complaint.noResponse')}
                      />
                    ),
                  },
                  { label: t('awards.complaint.remedy'), value: detail.remedy },
                  { label: t('awards.complaint.publicSummary'), value: detail.publicSummary },
                ]}
              />
            </Card>
            <Card title={t('awards.complaint.appealTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    label: t('awards.complaint.appealGrounds'),
                    value: (
                      <TextBlock
                        text={detail.appealGrounds}
                        empty={t('awards.complaint.noAppeal')}
                      />
                    ),
                  },
                  { label: t('awards.complaint.appealOutcome'), value: detail.appealOutcome },
                  {
                    label: t('awards.complaint.closedAt'),
                    value:
                      detail.closedAt === null ? null : formatDateTime(detail.closedAt, timeZone),
                  },
                ]}
              />
            </Card>
            <Card title={t('awards.complaint.historyTitle')}>
              <Timeline
                label={t('awards.complaint.historyTitle')}
                items={detail.events.map((event) => ({
                  id: event.eventId,
                  title: t(`awards.complaint.event.${event.eventType}`),
                  meta: `${event.actor.fullName} · ${formatDateTime(event.occurredAt, timeZone)}${
                    event.supplierVisible ? '' : ` · ${t('awards.complaint.internal')}`
                  }`,
                  detail:
                    event.toStatus === null
                      ? event.note
                      : `${tEnum('complaints.status', event.toStatus)}. ${event.note}`,
                  tone: EVENT_TONE[event.eventType] ?? 'neutral',
                }))}
              />
            </Card>
          </div>
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('awards.complaint.caseTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    label: t('awards.complaint.complainant'),
                    value: `${detail.complainant.name} · ${detail.complainantUser.fullName}`,
                  },
                  {
                    label: t('awards.complaint.subject'),
                    value: tEnum('complaints.subject', detail.subject),
                  },
                  {
                    label: t('awards.complaint.tender'),
                    value: `${detail.tender.reference} ${detail.tender.title}`,
                  },
                  {
                    label: t('awards.complaint.lot'),
                    value:
                      detail.lot === null
                        ? t('awards.common.allLots')
                        : t('awards.common.lotLabel', {
                            no: detail.lot.lotNo,
                            title: detail.lot.title,
                          }),
                  },
                  {
                    label: t('awards.complaint.received'),
                    value: formatDateTime(detail.receivedAt, timeZone),
                  },
                  {
                    label: t('awards.complaint.withinWindow'),
                    value: (
                      <span className={detail.withinWindow ? undefined : 'tiq-text-warning'}>
                        {yesNo(detail.withinWindow)}
                      </span>
                    ),
                  },
                  { label: t('awards.complaint.standing'), value: yesNo(detail.standingConfirmed) },
                  {
                    label: t('awards.complaint.acknowledged'),
                    value:
                      detail.acknowledgedAt === null
                        ? null
                        : formatDateTime(detail.acknowledgedAt, timeZone),
                  },
                  {
                    label: t('awards.complaint.owner'),
                    value:
                      detail.caseOwner === null ? (
                        <span className="tiq-text-warning">
                          {t('awards.complaints.unassigned')}
                        </span>
                      ) : (
                        `${detail.caseOwner.fullName} · ${
                          detail.independenceConfirmed
                            ? t('awards.complaints.independent')
                            : t('awards.complaints.independenceUnconfirmed')
                        }`
                      ),
                  },
                  { label: t('awards.complaint.blocking'), value: yesNo(detail.isBlocking) },
                ]}
              />
            </Card>
            <Card title={t('awards.complaint.effectTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    label: t('awards.complaint.blockedActions'),
                    value: <BlockedActions actions={detail.procurementEffect.blockedActions} />,
                  },
                  {
                    label: t('awards.complaint.affectedOutcomes'),
                    value: t('awards.complaint.affectedCount', {
                      count: detail.procurementEffect.affectedLotOutcomeIds.length,
                    }),
                  },
                  {
                    label: t('awards.complaint.standstillEffect'),
                    value: detail.procurementEffect.standstillEffect,
                  },
                ]}
              />
            </Card>
            <DocumentList
              audience="buyer"
              relatedType="complaint"
              relatedId={detail.complaintId}
              title={t('awards.complaint.evidenceTitle')}
            />
          </div>
        </div>
        {detail.hold !== null && (
          <HoldsCard
            holds={[detail.hold]}
            timeZone={timeZone}
            title={t('awards.complaint.holdTitle')}
          />
        )}
      </div>

      <ConfirmActionDialog
        open={command !== null}
        title={command === null ? '' : t(`awards.complaint.action.${command}`)}
        scope={scope}
        consequence={command === null ? '' : t(`awards.complaint.consequence.${command}`)}
        confirmLabel={command === null ? '' : t(`awards.complaint.action.${command}`)}
        tone={command === 'placeHold' ? 'danger' : 'primary'}
        reason={reasonFor(command)}
        acknowledgement={command === 'assign' ? t('awards.complaint.independenceAck') : undefined}
        pending={pending}
        error={withAwardMessage(activeError)}
        onCancel={() => setCommand(null)}
        onConfirm={confirm}
      >
        {command === 'acknowledge' && (
          <>
            <Checkbox
              label={t('awards.complaint.confirmStanding')}
              checked={standing}
              onChange={setStanding}
            />
            <Checkbox
              label={t('awards.complaint.confirmTimely')}
              checked={timely}
              onChange={setTimely}
            />
          </>
        )}
        {command === 'assign' && (
          <Select
            label={t('awards.complaint.owner')}
            required
            placeholder={
              candidates.status === 'loading'
                ? t('awards.complaint.loadingCandidates')
                : t('awards.complaint.chooseOwner')
            }
            hint={
              candidates.error !== null
                ? t('awards.complaint.candidatesFailed')
                : t('awards.complaint.ownerHint')
            }
            value={ownerId}
            error={errors.forField('caseOwnerUserId')}
            options={(candidates.data?.candidates ?? []).map((candidate) => ({
              value: String(candidate.person.userId),
              label: candidate.independent
                ? `${candidate.person.fullName} · ${candidate.capacity ?? ''}`
                : `${candidate.person.fullName} · ${t('awards.complaint.notIndependent')}`,
              disabled: !candidate.independent,
            }))}
            onChange={setOwnerId}
          />
        )}
        {command === 'assign' &&
          (candidates.data?.candidates ?? []).some((candidate) => !candidate.independent) && (
            <Banner tone="info" title={t('awards.complaint.notIndependentTitle')}>
              <ul className="tiq-stack">
                {(candidates.data?.candidates ?? [])
                  .filter((candidate) => !candidate.independent)
                  .map((candidate) => (
                    <li key={candidate.person.userId}>
                      {candidate.note === null
                        ? candidate.person.fullName
                        : `${candidate.person.fullName}: ${candidate.note}`}
                    </li>
                  ))}
              </ul>
            </Banner>
          )}
        {command === 'transition' && (
          <Select
            label={t('awards.complaint.toStatus')}
            required
            value={toStatus}
            error={errors.forField('toStatus')}
            options={transitions.map((value) => ({
              value,
              label: tEnum('complaints.status', value),
            }))}
            onChange={setToStatus}
          />
        )}
        {command === 'respond' && (
          <>
            <Select
              label={t('awards.complaint.outcome')}
              required
              value={outcome}
              error={errors.forField('outcome')}
              options={COMPLAINT_RESPONSE_OUTCOMES.map((value) => ({
                value,
                label: tEnum('complaints.outcome', value),
              }))}
              onChange={(value) => {
                const found = COMPLAINT_RESPONSE_OUTCOMES.find((item) => item === value);
                if (found !== undefined) setOutcome(found);
              }}
            />
            <TextArea
              label={t('awards.complaint.responseText')}
              required
              rows={5}
              value={responseText}
              error={errors.forField('responseText')}
              onChange={setResponseText}
            />
            <TextArea
              label={t('awards.complaint.remedy')}
              hint={t('awards.complaint.remedyHint')}
              required={outcome === 'upheld' || outcome === 'partially_upheld'}
              rows={3}
              value={remedy}
              error={errors.forField('remedy')}
              onChange={setRemedy}
            />
            <TextArea
              label={t('awards.complaint.publicSummary')}
              hint={t('awards.complaint.publicSummaryHint')}
              rows={2}
              value={publicSummary}
              error={errors.forField('publicSummary')}
              onChange={setPublicSummary}
            />
          </>
        )}
        {command === 'placeHold' && (
          <>
            <MultiSelect
              label={t('awards.complaint.blockedActions')}
              required
              value={blocked}
              error={errors.forField('blockedActions')}
              options={HOLDS_BLOCKED_ACTIONS.map((value) => ({
                value,
                label: tEnum('holds.blocked_actions', value),
              }))}
              onChange={setBlocked}
            />
            <DateInput
              label={t('awards.complaint.reviewDate')}
              required
              value={reviewDate}
              error={errors.forField('reviewDate')}
              onChange={setReviewDate}
            />
            <p className="tiq-text-muted">{t('awards.complaint.holdNoDates')}</p>
          </>
        )}
      </ConfirmActionDialog>
    </>
  );
}
