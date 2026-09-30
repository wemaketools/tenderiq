/**
 * Small presentational pieces shared by the contract screens: next decision, readiness checks, the BR-35 milestone
 * track, linked approvals and dates.
 */
import { Link } from 'react-router';

import type {
  ContractApprovalRef,
  ContractCheck,
  ContractMilestone,
  ContractNextDecision,
} from '@contracts/contracts';
import type { OfficialDeadline as OfficialDeadlineValue, PersonRef } from '@contracts/common';

import {
  Chip,
  OfficialDeadline,
  OrDash,
  ReadinessChecklist,
  StatusChip,
  Stepper,
} from '../../../components/ui';
import type { StepState } from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatMoney } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { contractPaths } from '../lib/paths';

/** The label of a next decision kind. */
function decisionLabel(kind: ContractNextDecision['kind']): string {
  return t(`contracts.decision.${kind}`);
}

/** "Signature · 14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone" — the next decision a contract needs. */
export function NextDecision({
  decision,
  compact = false,
}: {
  readonly decision: ContractNextDecision | null;
  /** Hides the explanation (register rows). */
  readonly compact?: boolean;
}) {
  if (decision === null) {
    return <span className="tiq-text-muted">{t('contracts.decision.none')}</span>;
  }
  return (
    <span className="tiq-stack">
      <span>{decisionLabel(decision.kind)}</span>
      {decision.dueAt !== null && <OfficialDeadline deadline={decision.dueAt} showLocal={false} />}
      {!compact && decision.detail !== null && (
        <span className="tiq-cell-sub">{decision.detail}</span>
      )}
    </span>
  );
}

/** Readiness / precondition checks, blocking errors apart from warnings. */
export function ChecksPanel({
  checks,
  label,
}: {
  readonly checks: readonly ContractCheck[];
  readonly label: string;
}) {
  return (
    <ReadinessChecklist
      label={label}
      items={checks.map((check) => ({
        id: check.id,
        label: check.label,
        detail: check.detail ?? undefined,
        status: check.state,
      }))}
    />
  );
}

const STEP_STATE: Readonly<Record<ContractMilestone['state'], StepState>> = {
  done: 'complete',
  pending: 'upcoming',
  blocked: 'blocked',
};

/** Signature, effective date, notice to proceed, delivery start and handover as SEPARATE milestones (BR-35). */
export function MilestoneTrack({
  milestones,
  timeZone,
}: {
  readonly milestones: readonly ContractMilestone[];
  readonly timeZone: string;
}) {
  const firstPending = milestones.findIndex((item) => item.state !== 'done');
  return (
    <Stepper
      label={t('contracts.milestone.label')}
      steps={milestones.map((item, index) => {
        const when =
          item.at !== null
            ? formatDateTime(item.at, timeZone)
            : item.date !== null
              ? formatCalendarDate(item.date)
              : null;
        const state: StepState =
          index === firstPending && item.state === 'pending' ? 'current' : STEP_STATE[item.state];
        return {
          id: item.key,
          label: t(`contracts.milestone.${item.key}`),
          description: [when, item.detail].filter((part) => part !== null).join(' · ') || undefined,
          state,
        };
      })}
    />
  );
}

/**
 * The approval's title: a link to the approval workspace when the workspace holds the request, otherwise plain text
 * with a note that the record is kept with the contract (never a link to a page that cannot open it).
 */
export function ApprovalTitle({ approval }: { readonly approval: ContractApprovalRef }) {
  if (approval.inApprovalWorkspace) {
    return <Link to={contractPaths.approval(approval.approvalId)}>{approval.title}</Link>;
  }
  return (
    <span className="tiq-stack">
      <span>{approval.title}</span>
      <span className="tiq-cell-sub">{t('contracts.approval.contractRecord')}</span>
    </span>
  );
}

/** A linked approval: status, route position and, when the workspace holds it, a link to the approval. */
export function ApprovalSummary({
  approval,
  timeZone,
}: {
  readonly approval: ContractApprovalRef | null;
  readonly timeZone: string;
}) {
  if (approval === null) {
    return <span className="tiq-text-muted">{t('contracts.approval.none')}</span>;
  }
  return (
    <span className="tiq-stack">
      <span className="tiq-inline">
        <StatusChip enum="approval_requests.status" value={approval.status} size="sm" />
        <ApprovalTitle approval={approval} />
      </span>
      <span className="tiq-cell-sub">
        {approval.currentApprover !== null
          ? t('contracts.approval.with', { name: approval.currentApprover.fullName })
          : approval.decidedAt !== null
            ? t('contracts.approval.decidedAt', {
                at: formatDateTime(approval.decidedAt, timeZone),
              })
            : t('contracts.approval.requestedBy', {
                name: approval.requestedBy.fullName,
                at: formatDateTime(approval.requestedAt, timeZone),
              })}
      </span>
      {approval.amount !== null && (
        <span className="tiq-cell-sub">
          {t('contracts.approval.amount', { amount: formatMoney(approval.amount) })}
        </span>
      )}
    </span>
  );
}

export function PersonName({ person }: { readonly person: PersonRef | null }) {
  return <OrDash>{person?.fullName}</OrDash>;
}

/** A calendar date or the em dash. */
export function DateText({ date }: { readonly date: string | null }) {
  return <OrDash>{date === null ? null : formatCalendarDate(date)}</OrDash>;
}

/** An instant in the official zone, or the em dash. */
export function InstantText({
  at,
  timeZone,
}: {
  readonly at: string | null;
  readonly timeZone: string;
}) {
  return <OrDash>{at === null ? null : formatDateTime(at, timeZone)}</OrDash>;
}

/** An official deadline (with its IANA zone) or the em dash. */
export function DeadlineText({ deadline }: { readonly deadline: OfficialDeadlineValue | null }) {
  return deadline === null ? <OrDash>{null}</OrDash> : <OfficialDeadline deadline={deadline} />;
}

/** A yes/no flag chip. */
export function FlagChip({
  on,
  labelOn,
  labelOff,
  toneOn = 'warning',
}: {
  readonly on: boolean;
  readonly labelOn: string;
  readonly labelOff: string;
  readonly toneOn?: 'warning' | 'danger' | 'success' | 'info';
}) {
  return (
    <Chip tone={on ? toneOn : 'neutral'} size="sm">
      {on ? labelOn : labelOff}
    </Chip>
  );
}
