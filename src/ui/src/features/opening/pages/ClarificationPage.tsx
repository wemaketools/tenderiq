/**
 * EVA-03 / BUY-21 — One bid clarification: the question, who raised it, the merged duplicates, the permitted
 * scope, the official response deadline, the supplier's response (attached to the clarification, never a new bid,
 * BR-22), its recorded effect and the assessors who received it. Actions follow the status: merge duplicates and
 * approve (chair), issue, record the effect and distribute.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { openingEndpoints } from '@contracts/opening';
import type { ClarificationDetail, ClarificationRow } from '@contracts/opening';

import { useActiveTenant } from '../../../app/hooks';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { DownloadVersionButton } from '../../../components/documents';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ConsolidateDialog } from '../components/ConsolidateDialog';
import { LoadingFrame } from '../components/LoadingFrame';
import { RecordEffectDialog } from '../components/RecordEffectDialog';
import { RecordNotFound } from '../components/RecordNotFound';
import { withBusinessMessage } from '../lib/errors';
import { clarificationNextAction } from '../lib/nextAction';
import { idParam, openingPaths } from '../lib/paths';

type DialogKind = 'approve' | 'issue' | 'effect' | 'consolidate';

const COMPLIANCE_VIEW = ['compliance.assess', 'exclusion.approve', 'evaluation.chair'] as const;

function ClarificationView({ clarificationId }: { readonly clarificationId: number }) {
  const query = useApiQuery(openingEndpoints.getClarification, { params: { clarificationId } });
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const isChair = usePermission('evaluation.chair');
  const canApprove = usePermission(['evaluation.chair', 'exclusion.approve']);
  const canIssue = usePermission(['compliance.assess', 'evaluation.chair']);
  const canSeeBid = usePermission(COMPLIANCE_VIEW);
  const toast = useToast();
  const approve = useApiMutation(openingEndpoints.approveClarification);
  const issue = useApiMutation(openingEndpoints.issueClarification);
  const [latest, setLatest] = useState<ClarificationDetail | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const current = latest ?? query.data;
  const draftOpen =
    current !== undefined && current.status === 'draft' && current.consolidatedIntoId === null;
  const drafts = useApiQuery(
    openingEndpoints.listClarifications,
    isChair && draftOpen && current !== undefined
      ? { query: { bidId: current.bidId, status: ['draft'], pageSize: 100 } }
      : null,
  );
  const back = { to: openingPaths.clarifications, label: t('opening.coordination.back') };

  const close = (): void => {
    approve.reset();
    issue.reset();
    setDialog(null);
  };

  const done = (result: ClarificationDetail, message: string): void => {
    setLatest(result);
    setDialog(null);
    invalidateApiQueries('buyer.opening.listClarifications');
    toast.show(message, 'success');
  };

  return (
    <LoadingFrame title={t('opening.clarification.loadingTitle')} back={back} query={query}>
      {(fetched) => {
        const clarification = latest ?? fetched;
        const scope = t('opening.bid.scope', {
          supplier: clarification.supplier.name,
          reference: clarification.tenderReference,
        });
        const isDraft =
          clarification.status === 'draft' && clarification.consolidatedIntoId === null;
        const mergeable = (drafts.data?.items ?? []).filter(
          (row) => row.consolidatedIntoId === null && row.status === 'draft',
        );
        const withSelf: ClarificationRow[] = mergeable.some((row) => row.id === clarification.id)
          ? mergeable
          : [clarification, ...mergeable];

        const mergedColumns: DataTableColumn<ClarificationRow>[] = [
          {
            id: 'reference',
            header: t('opening.columns.reference'),
            cell: (row) => (
              <Reference
                value={t('opening.clarification.number', { id: row.id })}
                to={openingPaths.clarification(row.id)}
              />
            ),
          },
          { id: 'question', header: t('opening.columns.question'), cell: (row) => row.question },
          {
            id: 'raisedBy',
            header: t('opening.columns.raisedBy'),
            cell: (row) => row.raisedBy.fullName,
          },
          {
            id: 'raisedAt',
            header: t('opening.columns.raisedAt'),
            cell: (row) => formatOfficialTime(row.raisedAt, timeZone),
          },
        ];

        return (
          <div className="tiq-page">
            <PageHeader
              title={t('opening.clarification.title', { id: clarification.id })}
              subtitle={t('opening.bid.scope', {
                supplier: clarification.supplier.name,
                reference: clarification.tenderReference,
              })}
              back={back}
              primaryAction={
                isDraft && canApprove ? (
                  <Button variant="primary" icon="checkSquare" onClick={() => setDialog('approve')}>
                    {t('opening.approveClar.action')}
                  </Button>
                ) : clarification.status === 'approved' && canIssue ? (
                  <Button variant="primary" icon="send" onClick={() => setDialog('issue')}>
                    {t('opening.issue.action')}
                  </Button>
                ) : clarification.status === 'responded' && canIssue ? (
                  <Button variant="primary" icon="checkCircle" onClick={() => setDialog('effect')}>
                    {t('opening.effect.action')}
                  </Button>
                ) : undefined
              }
              actions={
                <>
                  {isDraft && isChair && (
                    <Button icon="layers" onClick={() => setDialog('consolidate')}>
                      {t('opening.consolidate.action')}
                    </Button>
                  )}
                  {canSeeBid && (
                    <ButtonLink to={openingPaths.bid(clarification.bidId)} icon="clipboardCheck">
                      {t('opening.exclusion.toBid')}
                    </ButtonLink>
                  )}
                </>
              }
              meta={
                <>
                  <span className="tiq-mono">{clarification.tenderReference}</span>
                  <StatusChip enum="bid_clarifications.status" value={clarification.status} />
                  <span>{tEnum('bid_clarifications.source', clarification.source)}</span>
                  {clarification.dueAt !== null && (
                    <OfficialDeadline
                      deadline={clarification.dueAt}
                      label={t('opening.columns.due')}
                    />
                  )}
                  <span>
                    <strong>{t('opening.common.nextAction')}</strong>{' '}
                    {clarificationNextAction(clarification)}
                  </span>
                </>
              }
            />
            {clarification.consolidatedIntoId !== null && (
              <Banner tone="info" title={t('opening.clarification.mergedTitle')}>
                <Reference
                  value={t('opening.clarification.mergedInto', {
                    id: clarification.consolidatedIntoId,
                  })}
                  to={openingPaths.clarification(clarification.consolidatedIntoId)}
                />
              </Banner>
            )}
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('opening.clarification.question')}>
                <DetailList
                  stacked
                  items={[
                    {
                      key: 'question',
                      label: t('opening.columns.question'),
                      value: clarification.question,
                    },
                    {
                      key: 'scope',
                      label: t('opening.raise.scope'),
                      value: clarification.permittedScope,
                    },
                    {
                      key: 'raised',
                      label: t('opening.columns.raisedBy'),
                      value: `${clarification.raisedBy.fullName} · ${formatOfficialTime(clarification.raisedAt, timeZone)}`,
                    },
                    {
                      key: 'approved',
                      label: t('opening.clarification.approvedBy'),
                      value: clarification.approvedBy?.fullName ?? null,
                    },
                  ]}
                />
              </Card>
              <Card title={t('opening.clarification.response')} subtitle={t('opening.br22.buyer')}>
                {clarification.responseText === null ? (
                  <EmptyState
                    compact
                    icon="hourglass"
                    title={t('opening.clarification.noResponse')}
                    description={
                      clarification.status === 'expired'
                        ? t('opening.clarification.expired')
                        : undefined
                    }
                  />
                ) : (
                  <div className="tiq-stack">
                    <p>{clarification.responseText}</p>
                    <DetailList
                      items={[
                        {
                          key: 'by',
                          label: t('opening.clarification.respondedBy'),
                          value:
                            clarification.respondedBy === null
                              ? null
                              : `${clarification.respondedBy.fullName}${
                                  clarification.respondedAt === null
                                    ? ''
                                    : ` · ${formatOfficialTime(clarification.respondedAt, timeZone)}`
                                }`,
                        },
                      ]}
                    />
                    {clarification.attachments.length > 0 && (
                      <ul className="tiq-stack">
                        {clarification.attachments.map((file) => (
                          <li key={file.versionId} className="tiq-inline">
                            <span>{file.title}</span>
                            <DownloadVersionButton
                              documentId={file.documentId}
                              versionId={file.versionId}
                              fileName={file.fileName}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            </div>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('opening.clarification.effect')}>
                <DetailList
                  stacked
                  items={[
                    {
                      key: 'effect',
                      label: t('opening.columns.effect'),
                      value:
                        clarification.effect === null ? null : (
                          <StatusChip
                            enum="bid_clarifications.effect"
                            value={clarification.effect}
                          />
                        ),
                    },
                    {
                      key: 'note',
                      label: t('opening.effect.note'),
                      value: clarification.effectNote,
                    },
                    {
                      key: 'distributed',
                      label: t('opening.clarification.distributedTo'),
                      value:
                        clarification.distributedTo.length === 0
                          ? null
                          : clarification.distributedTo.map((person) => person.fullName).join(', '),
                    },
                  ]}
                />
              </Card>
              <Card title={t('opening.clarification.merged')} flush>
                <DataTable
                  caption={t('opening.clarification.merged')}
                  columns={mergedColumns}
                  rows={clarification.consolidated}
                  rowKey={(row) => String(row.id)}
                  empty={<EmptyState compact title={t('opening.clarification.noMerged')} />}
                />
              </Card>
            </div>

            <ConfirmActionDialog
              key={`approve-${String(dialog === 'approve')}`}
              open={dialog === 'approve'}
              title={t('opening.approveClar.title')}
              scope={scope}
              consequence={t('opening.approveClar.result')}
              confirmLabel={t('opening.approveClar.action')}
              pending={approve.pending}
              error={withBusinessMessage(approve.error)}
              onCancel={close}
              onConfirm={async () => {
                try {
                  done(
                    await approve.mutate({ params: { clarificationId: clarification.id } }),
                    t('opening.approveClar.done'),
                  );
                } catch {
                  // Shown in the dialog.
                }
              }}
            >
              <DetailList
                stacked
                items={[
                  { key: 'q', label: t('opening.columns.question'), value: clarification.question },
                  {
                    key: 's',
                    label: t('opening.raise.scope'),
                    value: clarification.permittedScope,
                  },
                ]}
              />
            </ConfirmActionDialog>
            <ConfirmActionDialog
              key={`issue-${String(dialog === 'issue')}`}
              open={dialog === 'issue'}
              title={t('opening.issue.title')}
              scope={scope}
              consequence={t('opening.issue.result')}
              confirmLabel={t('opening.issue.action')}
              pending={issue.pending}
              error={withBusinessMessage(issue.error)}
              onCancel={close}
              onConfirm={async () => {
                try {
                  done(
                    await issue.mutate({ params: { clarificationId: clarification.id } }),
                    t('opening.issue.done'),
                  );
                } catch {
                  // Shown in the dialog.
                }
              }}
            >
              {clarification.dueAt === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <OfficialDeadline
                  deadline={clarification.dueAt}
                  variant="block"
                  label={t('opening.columns.due')}
                />
              )}
            </ConfirmActionDialog>
            {dialog === 'effect' && (
              <RecordEffectDialog
                clarification={clarification}
                scope={scope}
                onClose={() => setDialog(null)}
                onRecorded={(result) => done(result, t('opening.effect.done'))}
              />
            )}
            {dialog === 'consolidate' && (
              <ConsolidateDialog
                drafts={withSelf}
                initialTargetId={clarification.id}
                onClose={() => setDialog(null)}
                onConsolidated={(result) =>
                  done(
                    result,
                    t('opening.consolidate.done', {
                      id: result.id,
                      count: result.consolidatedCount,
                    }),
                  )
                }
              />
            )}
          </div>
        );
      }}
    </LoadingFrame>
  );
}

export default function ClarificationPage() {
  const params = useParams();
  const clarificationId = idParam(params.clarificationId);
  if (clarificationId === null) {
    return (
      <RecordNotFound
        title={t('opening.clarification.loadingTitle')}
        back={{ to: openingPaths.clarifications, label: t('opening.coordination.back') }}
      />
    );
  }
  return <ClarificationView key={clarificationId} clarificationId={clarificationId} />;
}
