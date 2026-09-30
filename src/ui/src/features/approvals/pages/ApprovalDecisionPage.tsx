/**
 * COM-05 — Approval decision: the exact version, amount, scope, justification, evidence, previous decisions,
 * conflicts and the approver's authority. Approve, approve with conditions (if the route permits), reject or
 * return, with required reasons. Shows the AC-05 routing ("exceeds the authority of X — routed to Y") and the
 * AC-06 invalidation ("invalidated by a change") states.
 */
import { useState } from 'react';

import { getMyApproval } from '@contracts/approvals';
import type { ApprovalDecision, ApprovalDetail } from '@contracts/approvals';

import { invalidateApiQueries, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { HistoryTimeline } from '../../../components/audit';
import { ClassificationBadge } from '../../../components/documents';
import {
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  MoneyText,
  OverdueChip,
  PageHeader,
  Reference,
  SkeletonBlock,
  StatusChip,
  Timeline,
} from '../../../components/ui';
import type { TimelineTone } from '../../../components/ui';
import { formatMoney, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { INBOX_PATHS } from '../../tasks/lib/paths';
import { useCommandResult, useDisplayTimeZone, useIdParam } from '../../tasks/lib/shared';
import { AuthorityCard, DecisionReadiness, IndependenceCard } from '../components/ApprovalChecks';
import { InvalidationNotice, RoutingNotice } from '../components/ApprovalNotices';
import { DecisionDialog } from '../components/DecisionDialog';

const STEP_TONE: Readonly<Record<ApprovalDetail['steps'][number]['status'], TimelineTone>> = {
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

function nextAction(approval: ApprovalDetail): string {
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

function ApprovalView({
  approval,
  recorded,
  onDecide,
}: {
  readonly approval: ApprovalDetail;
  readonly recorded: boolean;
  readonly onDecide: (decision: ApprovalDecision) => void;
}) {
  const timeZone = useDisplayTimeZone();
  const activeTenant = useActiveTenant();
  const canAudit = usePermission('audit.view');
  const snapshot = approval.versionSnapshot ?? null;
  const decisions = DECISION_ORDER.filter((decision) =>
    approval.allowedDecisions.includes(decision),
  );
  const related = approval.relatedApprovals ?? [];

  return (
    <div className="tiq-page">
      <PageHeader
        title={approval.title}
        back={{ to: INBOX_PATHS.approvals, label: t('approvals.detail.back') }}
        subtitle={tEnum('approval_requests.subject_type', approval.subjectType)}
        meta={
          <>
            <Chip tone="neutral" size="sm" icon="building">
              {approval.organization.tenantName}
            </Chip>
            {approval.subjectReference !== null && (
              <Reference value={approval.subjectReference} to={approval.subjectLinkPath} />
            )}
            <StatusChip enum="approval_requests.status" value={approval.status} />
            <Chip tone="neutral-outlined" size="sm">
              {t('approvals.detail.version', { version: approval.subjectVersion })}
            </Chip>
            {approval.amount !== null && <MoneyText value={approval.amount} />}
            {approval.dueAt !== null && (
              <span className="tiq-inline">
                <span className={approval.isOverdue ? 'tiq-text-danger' : undefined}>
                  {formatOfficialTime(approval.dueAt, timeZone)}
                </span>
                {approval.isOverdue && <OverdueChip />}
              </span>
            )}
            <span className="tiq-text-muted">
              {t('approvals.detail.nextAction', { action: nextAction(approval) })}
            </span>
          </>
        }
      />
      {recorded && <Banner tone="success">{t('approvals.decide.recorded')}</Banner>}
      {approval.routing !== null && approval.routing !== undefined && (
        <RoutingNotice routing={approval.routing} timeZone={timeZone} />
      )}
      <InvalidationNotice approval={approval} timeZone={timeZone} />
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card title={t('approvals.detail.decision')}>
            <DetailList
              items={[
                {
                  key: 'org',
                  label: t('approvals.detail.organization'),
                  value: approval.organization.tenantName,
                },
                {
                  key: 'type',
                  label: t('approvals.detail.subjectType'),
                  value: tEnum('approval_requests.subject_type', approval.subjectType),
                },
                {
                  key: 'record',
                  label: t('approvals.detail.record'),
                  value:
                    approval.subjectReference === null ? null : (
                      <Reference value={approval.subjectReference} to={approval.subjectLinkPath} />
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
                  key: 'amount',
                  label: t('approvals.detail.amount'),
                  value: approval.amount === null ? null : formatMoney(approval.amount),
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
                  key: 'requestedBy',
                  label: t('approvals.detail.requestedBy'),
                  value: approval.requestedBy.fullName,
                },
                {
                  key: 'requestedAt',
                  label: t('approvals.detail.requestedAt'),
                  value: formatOfficialTime(approval.requestedAt, timeZone),
                },
                {
                  key: 'due',
                  label: t('approvals.detail.due'),
                  value:
                    approval.dueAt === null ? null : formatOfficialTime(approval.dueAt, timeZone),
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
          <Card title={t('approvals.detail.scope')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'summary',
                  label: t('approvals.detail.summary'),
                  value: approval.summary ?? t('approvals.detail.noSummary'),
                },
                {
                  key: 'justification',
                  label: t('approvals.detail.justification'),
                  value: approval.justification ?? t('approvals.detail.noJustification'),
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
          <Card title={t('approvals.detail.evidence')}>
            {approval.evidence.length === 0 ? (
              <EmptyState compact title={t('approvals.detail.evidenceEmpty')} />
            ) : (
              <ul className="tiq-check-list">
                {approval.evidence.map((item) => (
                  <li key={item.documentId} className="tiq-inline">
                    <Reference
                      value={item.title}
                      to={INBOX_PATHS.documentVersion(item.documentId, item.versionId)}
                    />
                    <span className="tiq-text-muted">
                      {t('approvals.detail.evidenceVersion', { version: item.versionNo })}
                    </span>
                    {item.latestVersionNo > item.versionNo && (
                      <Chip tone="warning" size="sm" outlined>
                        {t('approvals.detail.evidenceNewer', { version: item.latestVersionNo })}
                      </Chip>
                    )}
                    <ClassificationBadge
                      classification={item.classification}
                      redactedCopy={item.isRedactedCopy}
                    />
                  </li>
                ))}
              </ul>
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
                      <Reference value={row.title} to={INBOX_PATHS.approval(row.id)} />
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
          {canAudit && activeTenant?.tenantId === approval.organization.tenantId && (
            <HistoryTimeline
              entityType="approval_request"
              entityId={approval.id}
              title={t('approvals.detail.history')}
            />
          )}
        </div>
        <div className="tiq-stack">
          <Card title={t('approvals.decide.title')}>
            {decisions.length === 0 ? (
              <p className="tiq-text-muted">{t('approvals.decide.none')}</p>
            ) : (
              <div className="tiq-stack">
                <p>{t('approvals.decide.intro', { version: approval.subjectVersion })}</p>
                {decisions.map((decision) => (
                  <Button
                    key={decision}
                    block
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
                {approval.conditionsPermitted === false && (
                  <p className="tiq-text-muted">{t('approvals.decide.conditionsNotPermitted')}</p>
                )}
              </div>
            )}
          </Card>
          <DecisionReadiness approval={approval} />
          <AuthorityCard approval={approval} />
          <IndependenceCard approval={approval} />
        </div>
      </div>
    </div>
  );
}

export default function ApprovalDecisionPage() {
  const approvalId = useIdParam('approvalId');
  const query = useApiQuery(getMyApproval, approvalId === null ? null : { params: { approvalId } });
  const [result, setResult] = useCommandResult<ApprovalDetail>(approvalId);
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);

  if (approvalId === null) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('approvals.detail.loadingTitle')}
          back={{ to: INBOX_PATHS.approvals, label: t('approvals.detail.back') }}
        />
        <EmptyState icon="alertCircle" title={t('approvals.errors.APPROVAL_NOT_FOUND')} />
      </div>
    );
  }
  const approval = result ?? query.data;
  if (approval === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('approvals.detail.loadingTitle')}
          back={{ to: INBOX_PATHS.approvals, label: t('approvals.detail.back') }}
        />
        {query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return (
    <>
      <ApprovalView approval={approval} recorded={result !== null} onDecide={setDecision} />
      {decision !== null && (
        <DecisionDialog
          approval={approval}
          decision={decision}
          onClose={() => setDecision(null)}
          onDecided={(decided) => {
            setResult(decided);
            setDecision(null);
            invalidateApiQueries('me.approvals.list');
            invalidateApiQueries('me.tasks.');
          }}
        />
      )}
    </>
  );
}
