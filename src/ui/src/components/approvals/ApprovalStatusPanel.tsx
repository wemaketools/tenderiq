/**
 * ApprovalStatusPanel: the approval card of a record (requests, strategies, tenders, awards, contracts, policy…).
 * It shows the pending or latest approval of the subject with its status, amount, requester, due date and current
 * step, flags an approval that was for an older version (a material edit invalidates it, AC-06), lists the history,
 * shows the full route on demand, and offers the actions the caller may take: request approval of the current
 * version, withdraw their own pending request (with a reason, COM-02 confirmation), or open their decision (COM-05).
 */
import { useState } from 'react';

import { getApproval, getSubjectApprovals, withdrawApproval } from '@contracts/approvals';
import type { ApprovalStep, ApprovalSummary } from '@contracts/approvals';
import type { ApprovalRequestsSubjectType } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../api/hooks';
import { useCanCall } from '../../auth/permissions';
import { useActiveTenant, useAppSelector } from '../../app/hooks';
import { formatMoney, formatOfficialTime } from '../../lib/format';
import { t, tEnum } from '../../lib/i18n';
import { Banner } from '../ui/Banner';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmActionDialog } from '../ui/ConfirmActionDialog';
import { DataTable } from '../ui/DataTable';
import { DetailList } from '../ui/DetailList';
import { EmptyState } from '../ui/EmptyState';
import { QueryView } from '../ui/QueryView';
import { OverdueChip, StatusChip } from '../ui/StatusChip';
import { Timeline } from '../ui/Timeline';
import type { TimelineTone } from '../ui/Timeline';
import { useToast } from '../ui/toastContext';
import { RequestApprovalDialog } from './RequestApprovalDialog';
import type { RequestApprovalDefaults } from './RequestApprovalDialog';

export interface ApprovalStatusPanelProps {
  readonly subjectType: ApprovalRequestsSubjectType;
  readonly subjectId: number;
  /** Human scope of the subject, for example "T-2026-0005 Water treatment chemicals framework". */
  readonly subjectLabel: string;
  /** The subject's CURRENT version; `null` while it cannot be approved (the request action is hidden). */
  readonly currentVersion: { readonly subjectVersion: number; readonly contentHash: string } | null;
  readonly requestDefaults: RequestApprovalDefaults;
  readonly title?: string;
}

const STEP_TONE: Readonly<Record<string, TimelineTone>> = {
  approved: 'success',
  approved_with_conditions: 'success',
  rejected: 'danger',
  returned: 'warning',
  pending: 'info',
  invalidated: 'warning',
};

function stepTitle(step: ApprovalStep): string {
  const who =
    step.approver?.fullName ?? step.committee?.name ?? t('approvalWidget.step.unassigned');
  return t('approvalWidget.step.title', { sequence: step.sequence, who });
}

function ApprovalRoute({
  approvalId,
  timeZone,
}: {
  readonly approvalId: number;
  readonly timeZone: string;
}) {
  const detail = useApiQuery(getApproval, { params: { approvalId } });
  return (
    <QueryView query={detail}>
      {(approval) =>
        approval.steps.length === 0 ? (
          <EmptyState compact title={t('approvalWidget.route.empty')} />
        ) : (
          <>
            {approval.routing !== null && approval.routing !== undefined && (
              <Banner tone="info" title={t('approvalWidget.route.routedTitle')}>
                <p>
                  {t('approvalWidget.route.routed', {
                    skipped:
                      approval.routing.skipped?.fullName ?? t('approvalWidget.step.unassigned'),
                    skippedLimit:
                      approval.routing.skippedLimit === null
                        ? t('approvalWidget.route.noLimit')
                        : formatMoney(approval.routing.skippedLimit),
                    routedTo:
                      approval.routing.routedTo?.fullName ?? t('approvalWidget.step.unassigned'),
                    routedToLimit:
                      approval.routing.routedToLimit === null
                        ? t('approvalWidget.route.noLimit')
                        : formatMoney(approval.routing.routedToLimit),
                  })}
                </p>
                {approval.routing.note !== null && <p>{approval.routing.note}</p>}
              </Banner>
            )}
            {approval.invalidation !== null && approval.invalidation !== undefined && (
              <Banner tone="warning" title={t('approvalWidget.route.invalidatedTitle')}>
                <p>
                  {t('approvalWidget.route.invalidated', {
                    from: approval.invalidation.fromVersion,
                    to: approval.invalidation.toVersion,
                    at: formatOfficialTime(approval.invalidation.changedAt, timeZone),
                  })}
                </p>
                {approval.invalidation.changes.length > 0 && (
                  <ul className="tiq-list-plain">
                    {approval.invalidation.changes.map((change) => (
                      <li key={change.key}>
                        {t('approvalWidget.route.change', {
                          field: change.label,
                          before: change.before ?? '—',
                          after: change.after ?? '—',
                        })}
                      </li>
                    ))}
                  </ul>
                )}
              </Banner>
            )}
            <Timeline
              label={t('approvalWidget.route.label')}
              items={approval.steps.map((step) => ({
                id: step.id,
                title: stepTitle(step),
                tone: STEP_TONE[step.status] ?? 'neutral',
                icon:
                  step.status === 'pending'
                    ? 'hourglass'
                    : step.status === 'rejected'
                      ? 'xCircle'
                      : 'checkCircle',
                meta: (
                  <>
                    {tEnum('approval_steps.status', step.status)}
                    {step.decidedAt !== null &&
                      ` · ${formatOfficialTime(step.decidedAt, timeZone)}`}
                    {step.actingFor !== null &&
                      ` · ${t('approvalWidget.step.actingFor', { name: step.actingFor.fullName })}`}
                  </>
                ),
                detail:
                  step.decisionReason !== null || step.conditions !== null ? (
                    <>
                      {step.decisionReason !== null && <p>{step.decisionReason}</p>}
                      {step.conditions !== null && (
                        <p>
                          {t('approvalWidget.step.conditions', { conditions: step.conditions })}
                        </p>
                      )}
                    </>
                  ) : undefined,
              }))}
            />
          </>
        )
      }
    </QueryView>
  );
}

export function ApprovalStatusPanel({
  subjectType,
  subjectId,
  subjectLabel,
  currentVersion,
  requestDefaults,
  title,
}: ApprovalStatusPanelProps) {
  const tenant = useActiveTenant();
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const toast = useToast();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  // A role that cannot read the approvals of the subject does not see the panel (DD-49).
  const allowed = useCanCall(getSubjectApprovals);
  const query = useApiQuery(
    getSubjectApprovals,
    allowed ? { params: { subjectType, subjectId } } : null,
  );
  const withdraw = useApiMutation(withdrawApproval);
  const [requesting, setRequesting] = useState(false);
  const [withdrawing, setWithdrawing] = useState<ApprovalSummary | null>(null);
  const [showRoute, setShowRoute] = useState(false);

  const refresh = (): void => {
    invalidateApiQueries('buyer.approvals.');
    invalidateApiQueries('me.approvals.');
  };

  if (!allowed || query.error?.kind === 'forbidden') {
    return null;
  }

  return (
    <Card title={title ?? t('approvalWidget.panel.title')}>
      <QueryView query={query}>
        {(data) => {
          const current = data.current;
          const pending = current !== null && current.status === 'pending';
          const outdated =
            current !== null &&
            currentVersion !== null &&
            current.subjectVersion !== currentVersion.subjectVersion;
          const mine = current !== null && current.requestedBy.userId === userId;
          const myStep = pending && current.currentStep?.approver?.userId === userId;
          const history = data.history.filter((item) => item.id !== current?.id);
          return (
            <div className="tiq-stack">
              {current === null ? (
                <EmptyState compact icon="clipboardCheck" title={t('approvalWidget.panel.none')} />
              ) : (
                <>
                  <div className="tiq-inline">
                    <StatusChip enum="approval_requests.status" value={current.status} />
                    {current.isOverdue && <OverdueChip />}
                    <strong>{current.title}</strong>
                  </div>
                  {outdated && (
                    <Banner tone="warning" title={t('approvalWidget.panel.outdatedTitle')}>
                      {t('approvalWidget.panel.outdated', {
                        approved: current.subjectVersion,
                        current: currentVersion.subjectVersion,
                      })}
                    </Banner>
                  )}
                  <DetailList
                    items={[
                      {
                        key: 'version',
                        label: t('approvalWidget.panel.version'),
                        value: String(current.subjectVersion),
                      },
                      {
                        key: 'amount',
                        label: t('approvalWidget.panel.amount'),
                        value: formatMoney(current.amount),
                      },
                      {
                        key: 'requested',
                        label: t('approvalWidget.panel.requested'),
                        value: `${current.requestedBy.fullName} · ${formatOfficialTime(current.requestedAt, timeZone)}`,
                      },
                      {
                        key: 'due',
                        label: t('approvalWidget.panel.due'),
                        value:
                          current.dueAt === null
                            ? null
                            : formatOfficialTime(current.dueAt, timeZone),
                      },
                      {
                        key: 'step',
                        label: t('approvalWidget.panel.currentStep'),
                        value: current.currentStep === null ? null : stepTitle(current.currentStep),
                      },
                      {
                        key: 'route',
                        label: t('approvalWidget.panel.routeMode'),
                        value: tEnum('approval_requests.route_mode', current.routeMode),
                      },
                    ]}
                  />
                  <div className="tiq-inline">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="workflow"
                      onClick={() => setShowRoute((v) => !v)}
                    >
                      {showRoute
                        ? t('approvalWidget.panel.hideRoute')
                        : t('approvalWidget.panel.showRoute')}
                    </Button>
                    {myStep && (
                      <ButtonLink size="sm" variant="primary" to={`/me/approvals/${current.id}`}>
                        {t('approvalWidget.panel.decide')}
                      </ButtonLink>
                    )}
                    {pending && mine && (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onClick={() => setWithdrawing(current)}
                      >
                        {t('approvalWidget.panel.withdraw')}
                      </Button>
                    )}
                  </div>
                  {showRoute && <ApprovalRoute approvalId={current.id} timeZone={timeZone} />}
                </>
              )}
              {data.canRequest && currentVersion !== null && !pending && (
                <div>
                  <Button variant="primary" icon="send" onClick={() => setRequesting(true)}>
                    {t('approvalWidget.panel.request')}
                  </Button>
                </div>
              )}
              {history.length > 0 && (
                <DataTable
                  caption={t('approvalWidget.panel.history')}
                  rows={history}
                  rowKey={(row) => String(row.id)}
                  columns={[
                    {
                      id: 'title',
                      header: t('approvalWidget.panel.col.title'),
                      cell: (row) => row.title,
                    },
                    {
                      id: 'version',
                      header: t('approvalWidget.panel.col.version'),
                      numeric: true,
                      cell: (row) => row.subjectVersion,
                    },
                    {
                      id: 'status',
                      header: t('approvalWidget.panel.col.status'),
                      cell: (row) => (
                        <StatusChip enum="approval_requests.status" value={row.status} size="sm" />
                      ),
                    },
                    {
                      id: 'decided',
                      header: t('approvalWidget.panel.col.decided'),
                      cell: (row) =>
                        row.decidedAt === null ? '—' : formatOfficialTime(row.decidedAt, timeZone),
                    },
                  ]}
                />
              )}
            </div>
          );
        }}
      </QueryView>
      {requesting && currentVersion !== null && (
        <RequestApprovalDialog
          open
          onClose={() => setRequesting(false)}
          subjectType={subjectType}
          subjectId={subjectId}
          subjectVersion={currentVersion.subjectVersion}
          contentHash={currentVersion.contentHash}
          subjectLabel={subjectLabel}
          defaults={requestDefaults}
          onRequested={() => {
            toast.show(t('approvalWidget.request.done'), 'success');
            refresh();
          }}
        />
      )}
      {withdrawing !== null && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('approvalWidget.withdraw.title')}
          scope={`${subjectLabel} · ${withdrawing.title}`}
          consequence={t('approvalWidget.withdraw.result')}
          confirmLabel={t('approvalWidget.panel.withdraw')}
          reason={{ label: t('approvalWidget.withdraw.reason'), required: true }}
          pending={withdraw.pending}
          error={withdraw.error}
          onCancel={() => {
            withdraw.reset();
            setWithdrawing(null);
          }}
          onConfirm={async ({ reason }) => {
            try {
              await withdraw.mutate({ params: { approvalId: withdrawing.id }, body: { reason } });
              setWithdrawing(null);
              toast.show(t('approvalWidget.withdraw.done'), 'success');
              refresh();
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </Card>
  );
}
