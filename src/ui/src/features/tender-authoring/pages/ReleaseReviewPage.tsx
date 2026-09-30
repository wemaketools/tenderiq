/**
 * BUY-13 — Document package and release review: issued documents with classification, language editions and
 * precedence, completeness (release checks by area and readiness), and the release approvals. Principal actions:
 * review the supplier/public view, request corrections, and request approval of the EXACT release package (draft
 * revision + content hash). The decision itself is taken on COM-05.
 *
 * AC-06: a scope or value change after approval invalidates the approval; the page shows the invalidated approval
 * with its reason, the material changes that caused it, the release checks to repeat, and keeps publication blocked.
 */
import { useState } from 'react';

import type { ReleaseChecksCheckArea } from '@contracts/enums';
import { getReleaseReview, requestReleaseApproval } from '@contracts/tenders';
import type {
  CorrectionRequest,
  PackageDocument,
  PublicationGate,
  ReadinessCounts,
  ReleaseApprovalRequested,
  ReleaseApprovalState,
  ReleaseCheck,
} from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
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
  ErrorState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  ReadinessChecklist,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { PackagePreviewCard } from '../components/PackagePreview';
import { GateBanner } from '../components/ReadinessCard';
import { CheckDialog, CorrectionDialog } from '../components/ReleaseDialogs';
import { TenderHeader, TenderWorkspace } from '../components/TenderWorkspace';
import type { TenderWorkspaceContext } from '../components/TenderWorkspace';
import { withTenderMessage } from '../lib/errors';
import { languageName, languageNames, lotLabel, scopeLabel, sectionLabel } from '../lib/labels';
import { tenderPaths } from '../lib/paths';
import { withReleaseApprovalRequested } from '../lib/overlay';
import { readinessItems } from '../lib/readiness';

export default function ReleaseReviewPage() {
  return <TenderWorkspace>{(context) => <Release context={context} />}</TenderWorkspace>;
}

function Release({ context }: { readonly context: TenderWorkspaceContext }) {
  const { tender, canEdit, canReview } = context;
  const toast = useToast();
  const query = useApiQuery(getReleaseReview, { params: { tenderId: tender.id } });
  const request = useApiMutation(requestReleaseApproval);
  const [checks, setChecks] = useState<Partial<Record<ReleaseChecksCheckArea, ReleaseCheck>>>({});
  const [gate, setGate] = useState<PublicationGate | null>(null);
  const [summary, setSummary] = useState<ReadinessCounts | null>(null);
  const [newCorrections, setNewCorrections] = useState<CorrectionRequest[]>([]);
  const [requested, setRequested] = useState<ReleaseApprovalRequested | null>(null);
  const [checkArea, setCheckArea] = useState<ReleaseChecksCheckArea | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const zone = tender.officialTimeZone;

  const data =
    query.data === undefined ? undefined : withReleaseApprovalRequested(query.data, requested);
  const currentGate = gate ?? data?.gate ?? tender.gate;
  const approval = data?.releaseApproval ?? tender.releaseApproval;
  const approvalCovers =
    approval !== null && approval.coversCurrentRevision && approval.status !== 'invalidated';
  const approvalLive =
    approvalCovers && (approval.status === 'pending' || approval.status === 'approved');
  const canRequest = canEdit && currentGate.canRequestReleaseApproval && !approvalLive;

  const confirmRequest = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      const result = await request.mutate({
        params: { tenderId: tender.id },
        body: {
          draftRevision: tender.draftRevision,
          contentHash: tender.contentHash,
          justification: reason,
          ...(tender.scheduledReleaseAt === null
            ? {}
            : { scheduledReleaseAt: tender.scheduledReleaseAt }),
        },
      });
      setRequested(result);
      setGate(result.gate);
      setSummary(result.summary);
      context.setTender({
        ...tender,
        status: result.tenderStatus,
        releaseApproval: result.approval,
        gate: result.gate,
      });
      setConfirming(false);
      request.reset();
      toast.show(
        t('tender-authoring.release.requested', { id: result.approval.approvalId }),
        'success',
      );
    } catch {
      // Shown in the dialog.
    }
  };

  const checkColumns: DataTableColumn<ReleaseCheck>[] = [
    {
      id: 'area',
      header: t('tender-authoring.release.col.area'),
      cell: (row) => tEnum('release_checks.check_area', row.checkArea),
    },
    {
      id: 'status',
      header: t('tender-authoring.release.col.status'),
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="release_checks.status" value={row.status} size="sm" />
          {!row.coversCurrentRevision && (
            <Chip tone="warning" size="sm" icon="history">
              {t('tender-authoring.release.stale', { revision: row.draftRevision })}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'reviewer',
      header: t('tender-authoring.release.col.reviewer'),
      cell: (row) => (
        <>
          <span>{row.reviewer?.fullName ?? t('tender-authoring.release.unassigned')}</span>
          <span className="tiq-cell-sub">
            {row.checkedAt === null ? '' : formatDateTime(row.checkedAt, zone)}
          </span>
        </>
      ),
    },
    { id: 'note', header: t('tender-authoring.release.col.note'), cell: (row) => row.note ?? '' },
    {
      id: 'actions',
      header: t('tender-authoring.common.actions'),
      cell: (row) =>
        canReview ? (
          <Button
            size="sm"
            variant="ghost"
            icon="clipboardCheck"
            aria-label={t('tender-authoring.release.checkTitle', {
              area: tEnum('release_checks.check_area', row.checkArea),
            })}
            onClick={() => setCheckArea(row.checkArea)}
          >
            {t('tender-authoring.release.recordCheck')}
          </Button>
        ) : null,
    },
  ];

  const documentColumns: DataTableColumn<PackageDocument>[] = [
    {
      id: 'title',
      header: t('tender-authoring.release.docs.title'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {row.fileName} ·{' '}
            {row.lot === null
              ? t(`tender-authoring.release.docs.related.${row.relatedTo}`)
              : lotLabel(row.lot)}
          </span>
        </>
      ),
    },
    {
      id: 'classification',
      header: t('tender-authoring.release.docs.classification'),
      cell: (row) => (
        <StatusChip enum="documents.classification" value={row.classification} size="sm" />
      ),
    },
    {
      id: 'language',
      header: t('tender-authoring.release.docs.language'),
      cell: (row) => languageName(row.language),
    },
    {
      id: 'precedence',
      header: t('tender-authoring.release.docs.precedence'),
      numeric: true,
      cell: (row) => row.precedence ?? t('tender-authoring.release.docs.unranked'),
    },
    {
      id: 'version',
      header: t('tender-authoring.release.docs.version'),
      numeric: true,
      cell: (row) => row.versionNo,
    },
    {
      id: 'visibility',
      header: t('tender-authoring.release.docs.visibility'),
      cell: (row) => (
        <span className="tiq-inline">
          {row.publicVisible ? (
            <Chip tone="info" size="sm" icon="globe">
              {t('tender-authoring.preview.public')}
            </Chip>
          ) : row.supplierVisible ? (
            <Chip tone="accent" size="sm" icon="users">
              {t('tender-authoring.preview.supplier')}
            </Chip>
          ) : (
            <Chip tone="neutral" size="sm" icon="lock">
              {t('tender-authoring.release.docs.internal')}
            </Chip>
          )}
        </span>
      ),
    },
  ];

  const approvalItem = (row: ReleaseApprovalState) => ({
    id: row.approvalId,
    title: (
      <span className="tiq-inline">
        <span>{t('tender-authoring.release.approval.number', { id: row.approvalId })}</span>
        <StatusChip enum="approval_requests.status" value={row.status} size="sm" />
        <span className="tiq-text-muted">
          {t('tender-authoring.release.approval.forRevision', { revision: row.subjectVersion })}
        </span>
      </span>
    ),
    meta: `${t('tender-authoring.release.approval.requestedBy', { name: row.requestedBy.fullName, date: formatDateTime(row.requestedAt, zone) })}${
      row.decidedBy === null || row.decidedAt === null
        ? ''
        : ` · ${t('tender-authoring.release.approval.decidedBy', { name: row.decidedBy.fullName, date: formatDateTime(row.decidedAt, zone) })}`
    }`,
    detail:
      row.status === 'invalidated'
        ? `${t('tender-authoring.release.approval.invalidatedOn', { date: row.invalidatedAt === null ? '' : formatDateTime(row.invalidatedAt, zone) })} ${row.invalidationReason ?? ''}`
        : undefined,
    tone:
      row.status === 'invalidated' || row.status === 'returned' || row.status === 'rejected'
        ? ('warning' as const)
        : row.status === 'approved'
          ? ('success' as const)
          : ('info' as const),
  });

  const content = (() => {
    if (query.error !== null) {
      return query.error.kind === 'forbidden' ? (
        <RestrictedState />
      ) : (
        <ErrorState error={query.error} onRetry={query.reload} />
      );
    }
    if (data === undefined) return <SkeletonBlock lines={10} />;
    const checkRows = data.checks.map((row) => checks[row.checkArea] ?? row);
    const counts = summary ?? data.summary;
    const passed = checkRows.filter(
      (row) =>
        row.coversCurrentRevision && (row.status === 'passed' || row.status === 'not_applicable'),
    ).length;
    const corrections = [...newCorrections, ...data.corrections];
    const openCorrections = corrections.filter((row) => row.status === 'open').length;
    const history = data.approvalHistory;
    return (
      <>
        <GateBanner gate={currentGate} approval={approval} />
        <KpiGrid>
          <KpiCard
            label={t('tender-authoring.release.kpi.checks')}
            icon="clipboardCheck"
            tone={passed === checkRows.length ? 'success' : 'warning'}
            value={`${passed} / ${checkRows.length}`}
            hint={t('tender-authoring.release.kpi.checksHint', { revision: data.draftRevision })}
          />
          <KpiCard
            label={t('tender-authoring.release.kpi.blocking')}
            icon="xCircle"
            tone={counts.blocking > 0 ? 'danger' : 'success'}
            value={counts.blocking}
            hint={t('tender-authoring.release.kpi.warnings', { count: counts.warnings })}
          />
          <KpiCard
            label={t('tender-authoring.release.kpi.documents')}
            icon="files"
            tone="info"
            value={data.packageDocuments.length}
            hint={t('tender-authoring.release.kpi.missingEditions', {
              count: data.missingLanguageEditions.length,
            })}
          />
          <KpiCard
            label={t('tender-authoring.release.kpi.corrections')}
            icon="edit"
            tone={openCorrections > 0 ? 'warning' : 'success'}
            value={openCorrections}
            hint={t('tender-authoring.release.kpi.correctionsHint')}
          />
        </KpiGrid>
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack">
            <Card
              title={t('tender-authoring.release.checksTitle')}
              subtitle={t('tender-authoring.release.checksSubtitle', {
                revision: data.draftRevision,
              })}
              flush
            >
              <DataTable
                caption={t('tender-authoring.release.checksCaption')}
                columns={checkColumns}
                rows={checkRows}
                rowKey={(row) => row.checkArea}
                empty={
                  <EmptyState
                    compact
                    icon="clipboardCheck"
                    title={t('tender-authoring.release.noChecks')}
                  />
                }
              />
            </Card>
            <Card
              title={t('tender-authoring.readiness.title')}
              subtitle={t('tender-authoring.readiness.subtitle')}
            >
              <ReadinessChecklist
                label={t('tender-authoring.readiness.label')}
                items={readinessItems(data.readiness)}
              />
            </Card>
            <Card
              title={t('tender-authoring.release.docsTitle')}
              subtitle={t('tender-authoring.release.docsSubtitle', {
                languages: languageNames(data.acceptedLanguages),
              })}
              flush
            >
              {data.missingLanguageEditions.length > 0 && (
                <Banner tone="warning" title={t('tender-authoring.release.missingEditions')}>
                  <ul>
                    {data.missingLanguageEditions.map((row) => (
                      <li key={`${row.documentId}-${row.language}`}>
                        {t('tender-authoring.release.missingEdition', {
                          title: row.title,
                          language: languageName(row.language),
                        })}
                      </li>
                    ))}
                  </ul>
                </Banner>
              )}
              <DataTable
                caption={t('tender-authoring.release.docsCaption')}
                columns={documentColumns}
                rows={[...data.packageDocuments].sort(
                  (a, b) => (a.precedence ?? 99) - (b.precedence ?? 99),
                )}
                rowKey={(row) => `${row.documentId}-${row.language}`}
                empty={
                  <EmptyState compact icon="files" title={t('tender-authoring.release.noDocs')} />
                }
              />
            </Card>
            <PackagePreviewCard tenderId={tender.id} />
          </div>
          <div className="tiq-stack">
            <Card title={t('tender-authoring.release.approvalTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    key: 'revision',
                    label: t('tender-authoring.release.package'),
                    value: t('tender-authoring.release.packageValue', {
                      revision: tender.draftRevision,
                      hash: tender.contentHash.slice(0, 12),
                    }),
                  },
                  {
                    key: 'issued',
                    label: t('tender-authoring.overview.issuedVersion'),
                    value:
                      data.currentVersionNo === 0
                        ? t('tender-authoring.overview.notIssued')
                        : t('tender-authoring.overview.versionNo', { no: data.currentVersionNo }),
                  },
                  {
                    key: 'release',
                    label: t('tender-authoring.timetable.release'),
                    value:
                      data.scheduledReleaseAt === null ? null : (
                        <OfficialDeadline
                          deadline={{
                            at: data.scheduledReleaseAt,
                            timeZone: data.officialTimeZone,
                          }}
                          showLocal={false}
                        />
                      ),
                  },
                  {
                    key: 'approval',
                    label: t('tender-authoring.release.approval.status'),
                    value:
                      approval === null ? (
                        t('tender-authoring.overview.noApproval')
                      ) : (
                        <span className="tiq-inline">
                          <StatusChip enum="approval_requests.status" value={approval.status} />
                          <span>
                            {approval.coversCurrentRevision
                              ? t('tender-authoring.release.approval.coversCurrent', {
                                  revision: approval.subjectVersion,
                                })
                              : t('tender-authoring.release.approval.coversOld', {
                                  revision: approval.subjectVersion,
                                  current: tender.draftRevision,
                                })}
                          </span>
                        </span>
                      ),
                  },
                ]}
              />
              {requested !== null && (
                <Banner
                  tone="info"
                  title={t('tender-authoring.release.pendingTitle', {
                    id: requested.approval.approvalId,
                  })}
                  actions={
                    <ButtonLink to={requested.approvalLink} size="sm">
                      {t('tender-authoring.release.openApproval')}
                    </ButtonLink>
                  }
                >
                  <p>{t('tender-authoring.release.pendingDetail')}</p>
                </Banner>
              )}
              {requested === null && approval !== null && approval.status === 'pending' && (
                <ButtonLink to={tenderPaths.approval(approval.approvalId)} size="sm">
                  {t('tender-authoring.release.openApproval')}
                </ButtonLink>
              )}
              {!canRequest &&
                canEdit &&
                !currentGate.canRequestReleaseApproval &&
                !approvalLive && (
                  <p className="tiq-text-danger">{t('tender-authoring.readiness.cannotRequest')}</p>
                )}
              {history.length > 0 && (
                <Timeline
                  label={t('tender-authoring.release.approvalHistory')}
                  items={history.map(approvalItem)}
                />
              )}
            </Card>
            <Card
              title={t('tender-authoring.release.changesTitle')}
              subtitle={t('tender-authoring.release.changesSubtitle')}
            >
              {data.materialChanges.length === 0 ? (
                <EmptyState
                  compact
                  icon="history"
                  title={t('tender-authoring.release.noChanges')}
                />
              ) : (
                <Timeline
                  label={t('tender-authoring.release.changesTitle')}
                  items={data.materialChanges.map((row) => ({
                    id: row.id,
                    title: row.summary,
                    meta: `${formatDateTime(row.changedAt, zone)} · ${row.changedBy.fullName} · ${sectionLabel(row.section)} · ${t('tender-authoring.release.revisionN', { revision: row.draftRevision })}`,
                    detail: [
                      row.fromValue === null && row.toValue === null
                        ? null
                        : t('tender-authoring.release.fromTo', {
                            from: row.fromValue ?? '—',
                            to: row.toValue ?? '—',
                          }),
                      row.invalidatedApprovalId === null
                        ? null
                        : t('tender-authoring.release.invalidatedBy', {
                            id: row.invalidatedApprovalId,
                          }),
                    ]
                      .filter((value) => value !== null)
                      .join(' · '),
                    tone: row.invalidatedApprovalId === null ? 'neutral' : 'warning',
                  }))}
                />
              )}
            </Card>
            <Card
              title={t('tender-authoring.release.correctionsTitle')}
              actions={
                canReview ? (
                  <Button size="sm" icon="plus" onClick={() => setCorrectionOpen(true)}>
                    {t('tender-authoring.release.requestCorrection')}
                  </Button>
                ) : undefined
              }
            >
              {corrections.length === 0 ? (
                <EmptyState
                  compact
                  icon="checkCircle"
                  title={t('tender-authoring.release.noCorrections')}
                />
              ) : (
                <ul
                  className="tiq-stack"
                  aria-label={t('tender-authoring.release.correctionsTitle')}
                >
                  {corrections.map((row) => (
                    <li key={row.id} className="tiq-stack">
                      <span className="tiq-inline">
                        <Chip tone={row.status === 'open' ? 'warning' : 'success'} size="sm">
                          {t(`tender-authoring.release.correctionStatus.${row.status}`)}
                        </Chip>
                        <strong>{sectionLabel(row.section)}</strong>
                        {row.lot !== null && <span>{scopeLabel(row.lot)}</span>}
                      </span>
                      <span>{row.note}</span>
                      <span className="tiq-cell-sub">
                        {t('tender-authoring.release.correctionMeta', {
                          by: row.requestedBy.fullName,
                          to: row.assignee.fullName,
                          date: formatDateTime(row.requestedAt, zone),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </>
    );
  })();

  return (
    <>
      <TenderHeader
        context={context}
        section="release"
        primaryAction={
          canRequest ? (
            <Button variant="primary" icon="send" onClick={() => setConfirming(true)}>
              {t('tender-authoring.release.requestApproval')}
            </Button>
          ) : undefined
        }
      />
      {content}
      {canReview && (
        <>
          <CheckDialog
            open={checkArea !== null}
            tenderId={tender.id}
            draftRevision={tender.draftRevision}
            area={checkArea}
            onClose={() => setCheckArea(null)}
            onSaved={(result) => {
              setChecks((current) => ({ ...current, [result.check.checkArea]: result.check }));
              setGate(result.gate);
              setSummary(result.summary);
              toast.show(
                t('tender-authoring.release.checkRecorded', {
                  area: tEnum('release_checks.check_area', result.check.checkArea),
                }),
                'success',
              );
            }}
          />
          <CorrectionDialog
            open={correctionOpen}
            tenderId={tender.id}
            lots={tender.lots}
            onClose={() => setCorrectionOpen(false)}
            onSaved={(result) => {
              setNewCorrections((current) => [result, ...current]);
              toast.show(
                t('tender-authoring.release.correctionRequested', {
                  name: result.assignee.fullName,
                }),
                'success',
              );
            }}
          />
        </>
      )}
      <ConfirmActionDialog
        open={confirming}
        title={t('tender-authoring.release.confirmTitle')}
        scope={t('tender-authoring.release.confirmScope', {
          reference: tender.reference,
          title: tender.title,
          revision: tender.draftRevision,
          hash: tender.contentHash.slice(0, 12),
        })}
        consequence={t('tender-authoring.release.confirmResult')}
        confirmLabel={t('tender-authoring.release.requestApproval')}
        reason={{ label: t('tender-authoring.release.justification'), required: true }}
        onConfirm={confirmRequest}
        onCancel={() => {
          setConfirming(false);
          request.reset();
        }}
        pending={request.pending}
        error={withTenderMessage(request.error)}
      >
        {currentGate.blockedReasons.length > 0 && (
          <Banner tone="info" title={t('tender-authoring.release.stillBlocked')}>
            <ul>
              {currentGate.blockedReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Banner>
        )}
      </ConfirmActionDialog>
    </>
  );
}
