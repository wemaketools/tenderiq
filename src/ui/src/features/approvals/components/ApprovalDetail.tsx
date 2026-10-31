/**
 * COM-05 — the decision presentation of one approval (docs/plan/design1 §4), reusable beside the inbox list and on
 * its own at narrow widths: the heading with its organization (the inbox spans organizations, DD-21), the amount as
 * a figure, scope and justification, the checks the data establishes (version, gates and, for a decider, authority,
 * conflicts and independence), the evidence pinned to the exact version, the approval path, the decisions the route
 * allows (each through the DecisionDialog, which carries the required reasons and conditions), then the exact
 * version snapshot, previous decisions, related approvals, the decider's authority and independence cards (DD-49)
 * and the audit trail. AC-05 routing and AC-06 invalidation keep their notices.
 */
import { useEffect, useRef } from 'react';

import type {
  ApprovalDecision,
  ApprovalDetail as ApprovalDetailRecord,
} from '@contracts/approvals';

import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { HistoryTimeline } from '../../../components/audit';
import { ClassificationBadge } from '../../../components/documents';
import {
  ApprovalPath,
  Banner,
  Button,
  Card,
  CheckList,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  IconTile,
  OverdueChip,
  Rule,
  Section,
  Stat,
  StatusChip,
  Timeline,
} from '../../../components/ui';
// WorkRow is not re-exported from the index yet (follow-up for the shared index).
import { WorkList, WorkRow } from '../../../components/ui/WorkRow';
import type { TimelineTone } from '../../../components/ui';
import { formatInstantDate, formatMoney, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { INBOX_PATHS } from '../../tasks/lib/paths';
import { useDisplayTimeZone } from '../../tasks/lib/shared';
import { decisionChecks, pathNodes } from '../lib/checks';
import { AuthorityCard, IndependenceCard } from './ApprovalChecks';
import { InvalidationNotice, RoutingNotice } from './ApprovalNotices';
import { SubjectReference } from './SubjectReference';

const STEP_TONE: Readonly<Record<ApprovalDetailRecord['steps'][number]['status'], TimelineTone>> = {
  pending: 'info',
  approved: 'success',
  approved_with_conditions: 'success',
  returned: 'warning',
  rejected: 'danger',
  skipped: 'neutral',
  invalidated: 'danger',
};

const DECISION_ORDER: readonly ApprovalDecision[] = [
  'approve',
  'approve_with_conditions',
  'return',
  'reject',
];

function nextAction(approval: ApprovalDetailRecord): string {
  if (approval.invalidation !== null && approval.invalidation !== undefined) {
    return t('approvals.detail.next.newRequest', { version: approval.invalidation.toVersion });
  }
  if (approval.myStep?.canDecide === true) {
    return t('approvals.detail.next.decide', { sequence: approval.myStep.sequence });
  }
  if (approval.status === 'pending' && approval.myStep !== null) {
    return t('approvals.detail.next.blocked');
  }
  const current = approval.currentStep;
  if (approval.status === 'pending' && current !== null) {
    return t('approvals.detail.next.waitOther', {
      name: current.committee?.name ?? current.approver?.fullName ?? '—',
    });
  }
  return t('approvals.detail.next.none');
}

/** The decision-recorded confirmation; focus moves to it once it renders (the dialog that recorded it is gone). */
function DecisionRecorded() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} data-testid="decision-recorded">
      <Banner tone="success">{t('approvals.decide.recorded')}</Banner>
    </div>
  );
}

export interface ApprovalDetailProps {
  readonly approval: ApprovalDetailRecord;
  /** True right after a decision was recorded through the dialog. */
  readonly recorded: boolean;
  readonly onDecide: (decision: ApprovalDecision) => void;
  /** The page already shows the title as its H1 (narrow width): the heading line is left out. */
  readonly hideTitle?: boolean;
}

export function ApprovalDetail({
  approval,
  recorded,
  onDecide,
  hideTitle = false,
}: ApprovalDetailProps) {
  const timeZone = useDisplayTimeZone();
  const activeTenant = useActiveTenant();
  const canAudit = usePermission('audit.view');
  const snapshot = approval.versionSnapshot ?? null;
  const decisions = DECISION_ORDER.filter((decision) =>
    approval.allowedDecisions.includes(decision),
  );
  const related = approval.relatedApprovals ?? [];
  // The decider's parts (decision, authority, independence) show only to a decider of the approval; a requester or
  // observer reads the record without them (DD-49).
  const decider = approval.myStep !== null || decisions.length > 0;
  // A decided approval offers nothing to decide: the section would only repeat the status.
  const showDecision = decider && (decisions.length > 0 || approval.status === 'pending');
  const checks = decisionChecks(approval, decider);
  const subjectType = tEnum('approval_requests.subject_type', approval.subjectType);

  return (
    <article className="tiq-approval-detail" aria-label={approval.title}>
      <header className="tiq-approval-head">
        <IconTile icon="clipboardCheck" size="lg" />
        <div className="tiq-approval-head-text">
          {!hideTitle && <h2 className="tiq-approval-title">{approval.title}</h2>}
          <p className="tiq-row-meta tiq-dotsep">
            <span>{t('approvals.list.requestedBy', { name: approval.requestedBy.fullName })}</span>
            <span>{formatInstantDate(approval.requestedAt, timeZone)}</span>
            {(approval.subjectReference !== null || approval.subjectLinkPath !== null) && (
              <span>
                <SubjectReference value={approval.subjectReference} to={approval.subjectLinkPath} />
              </span>
            )}
          </p>
          <p className="tiq-inline">
            <Chip tone="neutral" size="sm" icon="building">
              {approval.organization.tenantName}
            </Chip>
            <StatusChip enum="approval_requests.status" value={approval.status} size="sm" />
            <Chip tone="neutral-outlined" size="sm">
              {t('approvals.detail.version', { version: approval.subjectVersion })}
            </Chip>
            {approval.dueAt !== null && (
              <span className="tiq-inline">
                <span className={approval.isOverdue ? 'tiq-text-danger' : 'tiq-text-muted'}>
                  {t('approvals.detail.dueLine', {
                    time: formatOfficialTime(approval.dueAt, timeZone),
                  })}
                </span>
                {approval.isOverdue && <OverdueChip />}
              </span>
            )}
          </p>
          <p className="tiq-text-muted">
            {t('approvals.detail.nextAction', { action: nextAction(approval) })}
          </p>
        </div>
      </header>
      <Rule />

      {recorded && <DecisionRecorded />}
      {approval.routing !== null && approval.routing !== undefined && (
        <RoutingNotice routing={approval.routing} timeZone={timeZone} />
      )}
      <InvalidationNotice approval={approval} timeZone={timeZone} />

      <Stat
        value={
          approval.amount === null ? t('approvals.detail.noAmount') : formatMoney(approval.amount)
        }
        caption={t('approvals.detail.amountCaption', {
          version: approval.subjectVersion,
          type: subjectType,
        })}
      />

      <div className="tiq-approval-scope">
        <p className="tiq-approval-summary">
          {approval.summary ?? t('approvals.detail.noSummary')}
        </p>
        <p className="tiq-text-muted">
          {approval.justification ?? t('approvals.detail.noJustification')}
        </p>
      </div>

      <CheckList items={checks} label={t('approvals.checks.title')} />

      <Section title={t('approvals.detail.evidence')} headingLevel={3}>
        {approval.evidence.length === 0 ? (
          <EmptyState compact icon="fileText" title={t('approvals.detail.evidenceEmpty')} />
        ) : (
          <WorkList label={t('approvals.detail.evidence')}>
            {approval.evidence.map((item) => (
              <WorkRow
                key={item.documentId}
                compact
                lead={<IconTile icon="fileText" size="sm" tone="neutral" />}
                title={
                  <SubjectReference
                    value={item.title}
                    to={INBOX_PATHS.documentVersion(item.documentId, item.versionId)}
                  />
                }
                meta={[
                  t('approvals.detail.evidenceVersion', { version: item.versionNo }),
                  item.latestVersionNo > item.versionNo ? (
                    <Chip tone="warning" size="sm" outlined>
                      {t('approvals.detail.evidenceNewer', { version: item.latestVersionNo })}
                    </Chip>
                  ) : null,
                ]}
                aside={
                  <ClassificationBadge
                    classification={item.classification}
                    redactedCopy={item.isRedactedCopy}
                  />
                }
              />
            ))}
          </WorkList>
        )}
      </Section>

      <Rule />
      <Section title={t('approvals.path.title')} headingLevel={3}>
        <ApprovalPath nodes={pathNodes(approval)} label={t('approvals.path.title')} />
      </Section>

      {showDecision && (
        <>
          <Rule />
          <Section title={t('approvals.decide.title')} headingLevel={2}>
            {decisions.length === 0 ? (
              <p className="tiq-text-muted">{t('approvals.decide.none')}</p>
            ) : (
              <div className="tiq-approval-decide">
                <p className="tiq-text-muted">
                  {t('approvals.decide.intro', { version: approval.subjectVersion })}
                </p>
                <div className="tiq-approval-actions">
                  {decisions.map((decision) => (
                    <Button
                      key={decision}
                      variant={
                        decision === 'approve'
                          ? 'primary'
                          : decision === 'reject'
                            ? 'danger-soft'
                            : 'secondary'
                      }
                      onClick={() => onDecide(decision)}
                    >
                      {t(`approvals.decide.${decision}`)}
                    </Button>
                  ))}
                </div>
                {approval.conditionsPermitted === false && (
                  <p className="tiq-text-muted">{t('approvals.decide.conditionsNotPermitted')}</p>
                )}
              </div>
            )}
          </Section>
        </>
      )}

      <Rule />
      <div className="tiq-stack tiq-stack--spaced">
        <Card title={t('approvals.detail.decision')}>
          <DetailList
            items={[
              {
                key: 'org',
                label: t('approvals.detail.organization'),
                value: approval.organization.tenantName,
              },
              { key: 'type', label: t('approvals.detail.subjectType'), value: subjectType },
              {
                key: 'record',
                label: t('approvals.detail.record'),
                value: (
                  <SubjectReference
                    value={approval.subjectReference}
                    to={approval.subjectLinkPath}
                  />
                ),
              },
              {
                key: 'version',
                label: t('approvals.detail.exactVersion'),
                value: (
                  <span className="tiq-stack">
                    <span>
                      {t('approvals.detail.version', { version: approval.subjectVersion })}
                    </span>
                    {approval.currentSubjectVersion !== null &&
                      approval.currentSubjectVersion !== approval.subjectVersion && (
                        <span className="tiq-text-danger">
                          {t('approvals.detail.currentVersion', {
                            version: approval.currentSubjectVersion,
                          })}
                        </span>
                      )}
                  </span>
                ),
              },
              {
                key: 'hash',
                label: t('approvals.detail.contentHash'),
                value: (
                  <span className="tiq-mono" title={approval.contentHash}>
                    {approval.contentHash.slice(0, 16)}…
                  </span>
                ),
              },
              {
                key: 'entity',
                label: t('approvals.detail.legalEntity'),
                value: approval.legalEntity?.name ?? null,
              },
              {
                key: 'category',
                label: t('approvals.detail.category'),
                value: approval.category?.name ?? null,
              },
              {
                key: 'expires',
                label: t('approvals.detail.expires'),
                value:
                  approval.expiresAt === null
                    ? null
                    : formatOfficialTime(approval.expiresAt, timeZone),
              },
              {
                key: 'decided',
                label: t('approvals.detail.decided'),
                value:
                  approval.decidedAt === null
                    ? null
                    : formatOfficialTime(approval.decidedAt, timeZone),
              },
              {
                key: 'route',
                label: t('approvals.detail.routeMode'),
                value: tEnum('approval_requests.route_mode', approval.routeMode),
              },
              {
                key: 'committee',
                label: t('approvals.detail.committee'),
                value:
                  approval.committee === null
                    ? null
                    : approval.committee.quorum === null
                      ? approval.committee.name
                      : t('approvals.detail.committeeQuorum', {
                          name: approval.committee.name,
                          quorum: approval.committee.quorum,
                        }),
              },
              {
                key: 'conditions',
                label: t('approvals.detail.conditions'),
                value: approval.conditions,
              },
            ]}
          />
        </Card>
        <Card
          title={t('approvals.detail.snapshot')}
          subtitle={
            snapshot === null
              ? undefined
              : t('approvals.detail.snapshotIntro', {
                  version: snapshot.subjectVersion,
                  time: formatOfficialTime(snapshot.capturedAt, timeZone),
                })
          }
          flush={snapshot !== null}
        >
          {snapshot === null ? (
            <p className="tiq-text-muted">{t('approvals.detail.noSnapshot')}</p>
          ) : (
            <DataTable
              caption={t('approvals.detail.snapshotCaption')}
              rows={snapshot.facts}
              rowKey={(row) => row.key}
              columns={[
                { id: 'fact', header: t('approvals.detail.fact'), cell: (row) => row.label },
                { id: 'value', header: t('approvals.detail.value'), cell: (row) => row.value },
                {
                  id: 'changed',
                  header: t('approvals.detail.changedSince'),
                  cell: (row) =>
                    row.changedSince ? (
                      <Chip tone="danger" size="sm" icon="alertTriangle">
                        {t('approvals.detail.changedSince')}
                      </Chip>
                    ) : (
                      <span className="tiq-text-muted">{t('approvals.detail.unchanged')}</span>
                    ),
                },
              ]}
            />
          )}
        </Card>
        <Card title={t('approvals.detail.steps')}>
          <Timeline
            label={t('approvals.detail.steps')}
            items={approval.steps.map((step) => ({
              id: step.id,
              tone: STEP_TONE[step.status],
              title: (
                <span className="tiq-inline">
                  <span>
                    {step.approver === null && step.committee === null
                      ? t('approvals.detail.stepUnassigned', { sequence: step.sequence })
                      : t('approvals.detail.stepTitle', {
                          sequence: step.sequence,
                          name: step.committee?.name ?? step.approver?.fullName ?? '',
                        })}
                  </span>
                  <StatusChip enum="approval_steps.status" value={step.status} size="sm" />
                </span>
              ),
              meta: [
                step.decidedBy === null
                  ? null
                  : t('approvals.detail.decidedBy', { name: step.decidedBy.fullName }) +
                    (step.actingFor === null
                      ? ''
                      : ` (${t('approvals.detail.actingFor', { name: step.actingFor.fullName })})`),
                step.decidedAt === null ? null : formatOfficialTime(step.decidedAt, timeZone),
                step.authorityCheckedAmount === null
                  ? null
                  : t('approvals.detail.checkedAmount', {
                      amount: formatMoney(step.authorityCheckedAmount),
                    }),
              ]
                .filter((part): part is string => part !== null)
                .join(' · '),
              detail:
                step.decisionReason === null && step.conditions === null ? undefined : (
                  <>
                    {step.decisionReason !== null && <p>{step.decisionReason}</p>}
                    {step.conditions !== null && (
                      <p>{t('approvals.detail.stepConditions', { text: step.conditions })}</p>
                    )}
                  </>
                ),
            }))}
          />
        </Card>
        <Card title={t('approvals.detail.related')} flush={related.length > 0}>
          {related.length === 0 ? (
            <p className="tiq-text-muted">{t('approvals.detail.relatedEmpty')}</p>
          ) : (
            <DataTable
              caption={t('approvals.detail.relatedCaption')}
              rows={related}
              rowKey={(row) => String(row.id)}
              columns={[
                {
                  id: 'title',
                  header: t('approvals.detail.relatedCol.title'),
                  cell: (row) => (
                    <SubjectReference value={row.title} to={INBOX_PATHS.approval(row.id)} />
                  ),
                },
                {
                  id: 'version',
                  header: t('approvals.detail.relatedCol.version'),
                  cell: (row) => t('approvals.detail.version', { version: row.subjectVersion }),
                },
                {
                  id: 'status',
                  header: t('approvals.detail.relatedCol.status'),
                  cell: (row) => (
                    <StatusChip enum="approval_requests.status" value={row.status} size="sm" />
                  ),
                },
                {
                  id: 'requested',
                  header: t('approvals.detail.relatedCol.requested'),
                  cell: (row) => formatOfficialTime(row.requestedAt, timeZone),
                },
                {
                  id: 'decided',
                  header: t('approvals.detail.relatedCol.decided'),
                  cell: (row) =>
                    row.decidedAt === null ? '—' : formatOfficialTime(row.decidedAt, timeZone),
                },
              ]}
            />
          )}
        </Card>
        {decider && (
          <>
            <AuthorityCard approval={approval} />
            <IndependenceCard approval={approval} />
          </>
        )}
        {canAudit && activeTenant?.tenantId === approval.organization.tenantId && (
          <HistoryTimeline
            entityType="approval_request"
            entityId={approval.id}
            title={t('approvals.detail.history')}
          />
        )}
      </div>
    </article>
  );
}
