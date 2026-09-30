/**
 * BUY-21 — One exclusion decision (FR-13, BR-23, AC-17): the grounds and the failed checks it cites with their
 * evidence, the approval (subject type `exclusion`, requested and decided through the approvals service), the formal
 * notice with the challenge route, and the effect on the bid: not ranked, commercial envelope kept sealed.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { openingEndpoints } from '@contracts/opening';
import type { ComplianceCheck, ExclusionDetail } from '@contracts/opening';

import { useActiveTenant } from '../../../app/hooks';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { ApprovalStatusPanel } from '../../../components/approvals';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  OrDash,
  PageHeader,
  Reference,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatOfficialTime } from '../../../lib/format';
import { sha256Hex } from '../../../lib/hash';
import { t, tEnum } from '../../../lib/i18n';
import { LoadingFrame } from '../components/LoadingFrame';
import { RecordNotFound } from '../components/RecordNotFound';
import { withBusinessMessage } from '../lib/errors';
import { ENVELOPE_STATE_TONE, envelopeStateLabel } from '../lib/options';
import { idParam, openingPaths } from '../lib/paths';

type DialogKind = 'withdraw' | 'notice';

/** SHA-256 of the proposal content the approval is requested for (grounds, cited checks, challenge route). */
function useProposalHash(exclusion: ExclusionDetail | undefined): string | null {
  const content =
    exclusion === undefined
      ? null
      : JSON.stringify([exclusion.grounds, exclusion.checkIds, exclusion.challengeRoute]);
  const [hash, setHash] = useState<{ readonly content: string; readonly value: string } | null>(
    null,
  );
  useEffect(() => {
    if (content === null) return undefined;
    let active = true;
    sha256Hex(new Blob([content])).then(
      (value) => {
        if (active) setHash({ content, value });
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [content]);
  return hash !== null && hash.content === content ? hash.value : null;
}

function nextAction(exclusion: ExclusionDetail): string {
  if (exclusion.status === 'approved' && exclusion.noticeId === null) {
    return t('opening.next.exclusion.notify');
  }
  return t(`opening.next.exclusion.${exclusion.status}`);
}

function ExclusionView({ exclusionId }: { readonly exclusionId: number }) {
  const query = useApiQuery(openingEndpoints.getExclusion, { params: { exclusionId } });
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canAssess = usePermission('compliance.assess');
  const canNotify = usePermission('notice.issue');
  const toast = useToast();
  const withdraw = useApiMutation(openingEndpoints.withdrawExclusion);
  const notice = useApiMutation(openingEndpoints.issueExclusionNotice);
  const [latest, setLatest] = useState<ExclusionDetail | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const hash = useProposalHash(latest ?? query.data);
  const back = {
    to: `${openingPaths.compliance}?tab=exclusions`,
    label: t('opening.exclusion.back'),
  };

  const close = (): void => {
    withdraw.reset();
    notice.reset();
    setDialog(null);
  };

  return (
    <LoadingFrame title={t('opening.exclusion.loadingTitle')} back={back} query={query}>
      {(fetched) => {
        const exclusion = latest ?? fetched;
        const scope = t('opening.bid.scope', {
          supplier: exclusion.supplier.name,
          reference: exclusion.tenderReference,
        });
        const pending = exclusion.status === 'proposed' || exclusion.status === 'awaiting_approval';
        const canWithdraw = canAssess && pending;
        const canIssueNotice =
          canNotify && exclusion.status === 'approved' && exclusion.noticeId === null;

        const done = (result: ExclusionDetail, message: string): void => {
          setLatest(result);
          setDialog(null);
          invalidateApiQueries('buyer.opening.listExclusions');
          invalidateApiQueries('buyer.opening.listBids');
          toast.show(message, 'success');
        };

        const checkColumns: DataTableColumn<ComplianceCheck>[] = [
          {
            id: 'type',
            header: t('opening.columns.checkType'),
            cell: (row) => (
              <>
                {tEnum('compliance_checks.check_type', row.checkType)}
                {row.requirement !== null && (
                  <span className="tiq-cell-sub">
                    <span className="tiq-mono">{row.requirement.refCode}</span>{' '}
                    {row.requirement.text}
                  </span>
                )}
              </>
            ),
          },
          {
            id: 'result',
            header: t('opening.columns.result'),
            cell: (row) => <StatusChip enum="compliance_checks.result" value={row.result} />,
          },
          {
            id: 'class',
            header: t('opening.columns.findingClass'),
            cell: (row) => (
              <StatusChip
                enum="compliance_checks.finding_class"
                value={row.findingClass}
                size="sm"
              />
            ),
          },
          {
            id: 'evidence',
            header: t('opening.columns.evidence'),
            cell: (row) => (
              <>
                <OrDash>{row.evidenceRef}</OrDash>
                {row.reason !== null && <span className="tiq-cell-sub">{row.reason}</span>}
              </>
            ),
          },
          {
            id: 'assessed',
            header: t('opening.columns.assessed'),
            cell: (row) => <OrDash>{row.assessedBy?.fullName ?? null}</OrDash>,
          },
        ];

        return (
          <div className="tiq-page">
            <PageHeader
              title={t('opening.exclusion.title', { supplier: exclusion.supplier.name })}
              subtitle={`${exclusion.tenderReference} ${exclusion.tenderTitle}`}
              back={back}
              primaryAction={
                canIssueNotice ? (
                  <Button variant="primary" icon="send" onClick={() => setDialog('notice')}>
                    {t('opening.notice.action')}
                  </Button>
                ) : undefined
              }
              actions={
                <>
                  <ButtonLink to={openingPaths.bid(exclusion.bidId)} icon="clipboardCheck">
                    {t('opening.exclusion.toBid')}
                  </ButtonLink>
                  {canWithdraw && (
                    <Button variant="danger-soft" icon="x" onClick={() => setDialog('withdraw')}>
                      {t('opening.withdraw.action')}
                    </Button>
                  )}
                </>
              }
              meta={
                <>
                  <Reference
                    value={exclusion.tenderReference}
                    to={openingPaths.register(exclusion.tenderId)}
                  />
                  <StatusChip enum="exclusions.status" value={exclusion.status} />
                  <span>
                    <strong>{t('opening.common.nextAction')}</strong> {nextAction(exclusion)}
                  </span>
                </>
              }
            />
            {(pending || exclusion.status === 'approved') && (
              <Banner
                tone={exclusion.status === 'approved' ? 'error' : 'warning'}
                title={
                  exclusion.status === 'approved'
                    ? t('opening.exclusion.effectTitle')
                    : t('opening.exclusion.pendingTitle')
                }
              >
                {exclusion.status === 'approved'
                  ? t('opening.exclusion.effect')
                  : t('opening.exclusion.pendingEffect')}
              </Banner>
            )}
            <div className="tiq-grid tiq-grid--sidebar">
              <div className="tiq-stack">
                <Card title={t('opening.exclusion.rationale')}>
                  <DetailList
                    stacked
                    items={[
                      {
                        key: 'grounds',
                        label: t('opening.columns.grounds'),
                        value: exclusion.grounds,
                      },
                      {
                        key: 'challenge',
                        label: t('opening.propose.challengeRoute'),
                        value: exclusion.challengeRoute,
                      },
                      {
                        key: 'proposed',
                        label: t('opening.columns.proposed'),
                        value: `${exclusion.proposedBy.fullName} · ${formatOfficialTime(exclusion.proposedAt, timeZone)}`,
                      },
                      ...(exclusion.withdrawnReason === null
                        ? []
                        : [
                            {
                              key: 'withdrawn',
                              label: t('opening.exclusion.withdrawnReason'),
                              value: exclusion.withdrawnReason,
                            },
                          ]),
                    ]}
                  />
                </Card>
                <Card title={t('opening.exclusion.checks')} flush>
                  <DataTable
                    caption={t('opening.exclusion.checks')}
                    columns={checkColumns}
                    rows={exclusion.checks}
                    rowKey={(row) => String(row.id)}
                    empty={<EmptyState compact title={t('opening.checks.none')} />}
                  />
                </Card>
              </div>
              <div className="tiq-stack">
                <Card title={t('opening.exclusion.decision')}>
                  <DetailList
                    stacked
                    items={[
                      {
                        key: 'approval',
                        label: t('opening.columns.approval'),
                        value:
                          exclusion.approval === null ? (
                            t('opening.exclusion.notRequested')
                          ) : (
                            <StatusChip
                              enum="approval_requests.status"
                              value={exclusion.approval.status}
                            />
                          ),
                      },
                      {
                        key: 'decided',
                        label: t('opening.exclusion.decided'),
                        value:
                          exclusion.approval === null || exclusion.approval.decidedAt === null
                            ? null
                            : `${exclusion.approval.decidedBy?.fullName ?? ''} · ${formatOfficialTime(exclusion.approval.decidedAt, timeZone)}`,
                      },
                      {
                        key: 'notice',
                        label: t('opening.columns.notice'),
                        value:
                          exclusion.noticeStatus === null ? (
                            t('opening.exclusion.noNotice')
                          ) : (
                            <StatusChip enum="notices.status" value={exclusion.noticeStatus} />
                          ),
                      },
                      {
                        key: 'notified',
                        label: t('opening.exclusion.notifiedAt'),
                        value:
                          exclusion.notifiedAt === null
                            ? null
                            : formatOfficialTime(exclusion.notifiedAt, timeZone),
                      },
                      {
                        key: 'commercial',
                        label: t('opening.columns.commercialEnvelope'),
                        value: (
                          <Chip
                            tone={ENVELOPE_STATE_TONE[exclusion.commercialEnvelope]}
                            icon="lock"
                          >
                            {envelopeStateLabel(exclusion.commercialEnvelope)}
                          </Chip>
                        ),
                      },
                    ]}
                  />
                </Card>
                <ApprovalStatusPanel
                  subjectType="exclusion"
                  subjectId={exclusion.id}
                  subjectLabel={scope}
                  currentVersion={
                    exclusion.status === 'proposed' && canAssess && hash !== null
                      ? { subjectVersion: 1, contentHash: hash }
                      : null
                  }
                  requestDefaults={{
                    title: t('opening.exclusion.approvalTitle', {
                      supplier: exclusion.supplier.name,
                      reference: exclusion.tenderReference,
                    }),
                    summary: exclusion.grounds,
                  }}
                />
              </div>
            </div>

            <ConfirmActionDialog
              key={`withdraw-${String(dialog === 'withdraw')}`}
              open={dialog === 'withdraw'}
              title={t('opening.withdraw.title')}
              scope={scope}
              consequence={t('opening.withdraw.result')}
              confirmLabel={t('opening.withdraw.confirm')}
              tone="danger"
              reason={{ label: t('opening.withdraw.reason'), required: true }}
              pending={withdraw.pending}
              error={withBusinessMessage(withdraw.error)}
              onCancel={close}
              onConfirm={async ({ reason }) => {
                try {
                  done(
                    await withdraw.mutate({
                      params: { exclusionId: exclusion.id },
                      body: { reason },
                    }),
                    t('opening.withdraw.done'),
                  );
                } catch {
                  // Shown in the dialog.
                }
              }}
            />
            <ConfirmActionDialog
              key={`notice-${String(dialog === 'notice')}`}
              open={dialog === 'notice'}
              title={t('opening.notice.title')}
              scope={scope}
              consequence={t('opening.notice.result')}
              confirmLabel={t('opening.notice.confirm')}
              reason={{
                label: t('opening.notice.message'),
                required: false,
                hint: t('opening.notice.messageHint'),
              }}
              pending={notice.pending}
              error={withBusinessMessage(notice.error)}
              onCancel={close}
              onConfirm={async ({ reason }) => {
                try {
                  done(
                    await notice.mutate({
                      params: { exclusionId: exclusion.id },
                      body: reason === '' ? {} : { message: reason },
                    }),
                    t('opening.notice.done'),
                  );
                } catch {
                  // Shown in the dialog.
                }
              }}
            >
              <DetailList
                stacked
                items={[
                  { key: 'grounds', label: t('opening.columns.grounds'), value: exclusion.grounds },
                  {
                    key: 'challenge',
                    label: t('opening.propose.challengeRoute'),
                    value: exclusion.challengeRoute,
                  },
                ]}
              />
            </ConfirmActionDialog>
          </div>
        );
      }}
    </LoadingFrame>
  );
}

export default function ExclusionPage() {
  const params = useParams();
  const exclusionId = idParam(params.exclusionId);
  if (exclusionId === null) {
    return (
      <RecordNotFound
        title={t('opening.exclusion.loadingTitle')}
        back={{ to: openingPaths.compliance, label: t('opening.compliance.back') }}
      />
    );
  }
  return <ExclusionView key={exclusionId} exclusionId={exclusionId} />;
}
