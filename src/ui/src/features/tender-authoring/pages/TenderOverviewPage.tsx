/**
 * BUY-08 — Tender overview and team: summary, current version and draft revision, stage, lots, key dates, release
 * approval status, owners, evaluators and outstanding decisions. Principal actions: assign responsibilities, inspect
 * readiness and navigate the event's sections (tabs), plus editing the general fields, linking stages and saving
 * the structure as a template.
 */
import { useState } from 'react';

import type { SavedTemplate, TenderDetail, TenderLinkState } from '@contracts/tenders';

import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  MoneyText,
  OfficialDeadline,
  OrDash,
  Reference,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CustomFieldsSection } from '../../admin-policy/components/CustomFieldsSection';
import { EditTenderDialog } from '../components/EditTenderDialog';
import { LinkStageDialog } from '../components/LinkStageDialog';
import { ReadinessCard } from '../components/ReadinessCard';
import { SaveTemplateDialog } from '../components/SaveTemplateDialog';
import { TeamCard } from '../components/TeamCard';
import { TenderHeader, TenderWorkspace } from '../components/TenderWorkspace';
import type { TenderWorkspaceContext } from '../components/TenderWorkspace';
import { sectionLabel } from '../lib/labels';
import { tenderPaths } from '../lib/paths';
import { TENDER_CREATE } from '../lib/permissions';

export default function TenderOverviewPage() {
  return <TenderWorkspace>{(context) => <Overview context={context} />}</TenderWorkspace>;
}

type LotRow = TenderDetail['lots'][number];
type DecisionRow = TenderDetail['outstandingDecisions'][number];

function Overview({ context }: { readonly context: TenderWorkspaceContext }) {
  const { tender, canEdit } = context;
  const toast = useToast();
  const canCreate = usePermission(TENDER_CREATE);
  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [template, setTemplate] = useState<SavedTemplate | null>(null);
  const zone = tender.officialTimeZone;

  const onLinked = (result: TenderLinkState): void => {
    context.setTender({
      ...tender,
      linkedFrom: result.linkedFrom,
      linkType: result.linkType,
      stageNo: result.stageNo,
    });
    toast.show(
      t('tender-authoring.link.done', {
        from: result.linkedFrom.reference,
        type: tEnum('tenders.link_type', result.linkType),
      }),
      'success',
    );
  };

  const lotColumns: DataTableColumn<LotRow>[] = [
    { id: 'lotNo', header: t('tender-authoring.lots.col.no'), cell: (row) => row.lotNo },
    { id: 'title', header: t('tender-authoring.lots.col.title'), cell: (row) => row.title },
    {
      id: 'stage',
      header: t('tender-authoring.lots.col.stage'),
      cell: (row) => <StatusChip enum="lots.stage" value={row.stage} size="sm" />,
    },
    {
      id: 'owner',
      header: t('tender-authoring.lots.col.owner'),
      cell: (row) =>
        row.owner === null ? (
          <Chip tone="danger" size="sm">
            {t('tender-authoring.lots.noOwner')}
          </Chip>
        ) : (
          row.owner.fullName
        ),
    },
    {
      id: 'value',
      header: t('tender-authoring.lots.col.value'),
      numeric: true,
      cell: (row) => <MoneyText value={row.estimatedValue} />,
    },
    {
      id: 'deadline',
      header: t('tender-authoring.lots.col.deadline'),
      cell: (row) =>
        row.submissionDeadline === null ? (
          <span className="tiq-text-muted">{t('tender-authoring.lots.tenderDeadline')}</span>
        ) : (
          <OfficialDeadline deadline={row.submissionDeadline} showLocal={false} />
        ),
    },
  ];

  const decisionColumns: DataTableColumn<DecisionRow>[] = [
    {
      id: 'severity',
      header: t('tender-authoring.decisions.col.severity'),
      cell: (row) => (
        <Chip
          tone={row.severity === 'blocking' ? 'danger' : 'warning'}
          size="sm"
          icon={row.severity === 'blocking' ? 'xCircle' : 'alertTriangle'}
        >
          {t(`tender-authoring.issues.severity.${row.severity}`)}
        </Chip>
      ),
    },
    {
      id: 'title',
      header: t('tender-authoring.decisions.col.decision'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {sectionLabel(row.section)}
            {row.detail === null ? '' : ` · ${row.detail}`}
          </span>
        </>
      ),
    },
    {
      id: 'owner',
      header: t('tender-authoring.decisions.col.owner'),
      cell: (row) => <OrDash>{row.owner?.fullName ?? null}</OrDash>,
    },
    {
      id: 'due',
      header: t('tender-authoring.decisions.col.due'),
      cell: (row) =>
        row.dueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={{ at: row.dueAt, timeZone: zone }} showLocal={false} />
        ),
    },
    {
      id: 'link',
      header: t('tender-authoring.common.actions'),
      cell: (row) =>
        row.link === null ? null : (
          <ButtonLink to={row.link} size="sm" variant="ghost">
            {t('tender-authoring.readiness.open')}
          </ButtonLink>
        ),
    },
  ];

  const approval = tender.releaseApproval;

  return (
    <>
      <TenderHeader
        context={context}
        section="overview"
        primaryAction={
          canEdit ? (
            <Button variant="primary" icon="edit" onClick={() => setEditOpen(true)}>
              {t('tender-authoring.overview.edit')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canEdit && (
              <Button icon="link" onClick={() => setLinkOpen(true)}>
                {t('tender-authoring.overview.linkStage')}
              </Button>
            )}
            {canCreate && (
              <Button icon="copy" onClick={() => setTemplateOpen(true)}>
                {t('tender-authoring.overview.saveTemplate')}
              </Button>
            )}
          </>
        }
      />
      {template !== null && (
        <Banner
          tone="success"
          title={t('tender-authoring.template.saved', {
            name: template.name,
            version: template.versionNo,
          })}
        >
          <p>
            {template.approvalRequired
              ? t('tender-authoring.template.needsApproval')
              : t('tender-authoring.template.ready')}
          </p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card title={t('tender-authoring.overview.summaryTitle')}>
            <p>{tender.summary ?? t('tender-authoring.overview.noSummary')}</p>
            <DetailList
              items={[
                {
                  key: 'ref',
                  label: t('tender-authoring.fields.reference'),
                  value: <Reference value={tender.reference} />,
                },
                {
                  key: 'method',
                  label: t('tender-authoring.fields.method'),
                  value: `${tEnum('tenders.event_type', tender.eventType)} · ${tEnum('tenders.procedure', tender.procedure)}`,
                },
                {
                  key: 'participation',
                  label: t('tender-authoring.fields.participation'),
                  value: tEnum('tenders.participation', tender.participation),
                },
                {
                  key: 'owner',
                  label: t('tender-authoring.fields.owner'),
                  value: tender.owner.fullName,
                },
                {
                  key: 'entity',
                  label: t('tender-authoring.fields.legalEntity'),
                  value: tender.legalEntity?.name ?? null,
                },
                {
                  key: 'category',
                  label: t('tender-authoring.fields.category'),
                  value:
                    tender.category === null
                      ? null
                      : `${tender.category.code} · ${tender.category.name}`,
                },
                {
                  key: 'department',
                  label: t('tender-authoring.fields.department'),
                  value: tender.department?.name ?? null,
                },
                {
                  key: 'project',
                  label: t('tender-authoring.fields.project'),
                  value:
                    tender.project === null
                      ? null
                      : `${tender.project.reference} ${tender.project.title}`,
                },
                {
                  key: 'request',
                  label: t('tender-authoring.fields.sourceRequest'),
                  value:
                    tender.sourceRequest === null ? null : (
                      <span>
                        <Reference value={tender.sourceRequest.reference} />{' '}
                        {tender.sourceRequest.title}
                      </span>
                    ),
                },
                {
                  key: 'strategy',
                  label: t('tender-authoring.fields.strategy'),
                  value: tender.strategy?.title ?? null,
                },
                {
                  key: 'provenance',
                  label: t('tender-authoring.fields.provenance'),
                  value: tender.provenance.label,
                },
                {
                  key: 'estimate',
                  label: t('tender-authoring.fields.estimatedValue'),
                  value: <MoneyText value={tender.estimatedValue} />,
                },
                {
                  key: 'budget',
                  label: t('tender-authoring.fields.budgetAmount'),
                  value: <MoneyText value={tender.budgetAmount} />,
                },
                {
                  key: 'award',
                  label: t('tender-authoring.fields.awardModel'),
                  value: tEnum('tenders.award_model', tender.awardModel),
                },
                {
                  key: 'policy',
                  label: t('tender-authoring.fields.policy'),
                  value:
                    tender.policyProfileVersion === null
                      ? null
                      : t('tender-authoring.overview.policyVersion', {
                          name: tender.policyProfileVersion.profileName,
                          version: tender.policyProfileVersion.versionNo,
                        }),
                },
                {
                  key: 'zone',
                  label: t('tender-authoring.fields.officialTimeZone'),
                  value: tender.officialTimeZone,
                },
                {
                  key: 'calendar',
                  label: t('tender-authoring.fields.calendar'),
                  value: tender.calendar?.name ?? null,
                },
                {
                  key: 'stage',
                  label: t('tender-authoring.fields.stage'),
                  value:
                    tender.linkedFrom === null || tender.linkType === null ? (
                      t('tender-authoring.overview.stageFirst', { stage: tender.stageNo })
                    ) : (
                      <span>
                        {t('tender-authoring.overview.stageOf', {
                          stage: tender.stageNo,
                          type: tEnum('tenders.link_type', tender.linkType),
                        })}{' '}
                        <Reference
                          value={tender.linkedFrom.reference}
                          to={tenderPaths.overview(tender.linkedFrom.id)}
                        />
                      </span>
                    ),
                },
                {
                  key: 'linkedTo',
                  label: t('tender-authoring.fields.linkedTo'),
                  value:
                    tender.linkedTo.length === 0 ? null : (
                      <span className="tiq-inline">
                        {tender.linkedTo.map((row) => (
                          <Reference
                            key={row.id}
                            value={row.reference}
                            to={tenderPaths.overview(row.id)}
                          />
                        ))}
                      </span>
                    ),
                },
              ]}
            />
          </Card>
          <Card
            title={t('tender-authoring.overview.lotsTitle', { count: tender.lots.length })}
            actions={
              <ButtonLink to={tenderPaths.scope(tender.id)} size="sm" variant="ghost">
                {t('tender-authoring.overview.openScope')}
              </ButtonLink>
            }
            flush
          >
            <DataTable
              caption={t('tender-authoring.overview.lotsCaption')}
              columns={lotColumns}
              rows={tender.lots}
              rowKey={(row) => String(row.id)}
              empty={
                <EmptyState compact icon="layers" title={t('tender-authoring.overview.noLots')} />
              }
            />
          </Card>
          {tender.customFields !== undefined && Object.keys(tender.customFields).length > 0 && (
            <Card title={t('tender-authoring.overview.customFieldsTitle')}>
              <CustomFieldsSection entityType="tender" values={tender.customFields} readOnly />
            </Card>
          )}
          <Card title={t('tender-authoring.overview.decisionsTitle')} flush>
            <DataTable
              caption={t('tender-authoring.overview.decisionsCaption')}
              columns={decisionColumns}
              rows={tender.outstandingDecisions}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  compact
                  icon="checkCircle"
                  title={t('tender-authoring.overview.noDecisions')}
                />
              }
            />
          </Card>
          <TeamCard
            tender={tender}
            canEdit={canEdit}
            onOwnerChanged={(result) => {
              if (result.newOwner !== null)
                context.setTender({ ...tender, owner: result.newOwner });
            }}
          />
        </div>
        <div className="tiq-stack">
          <Card title={t('tender-authoring.overview.versionTitle')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'draft',
                  label: t('tender-authoring.overview.draftRevision'),
                  value: (
                    <span className="tiq-inline">
                      <span>{tender.draftRevision}</span>
                      <Chip tone="neutral" size="sm">
                        {t('tender-authoring.overview.saved')}
                      </Chip>
                    </span>
                  ),
                },
                {
                  key: 'issued',
                  label: t('tender-authoring.overview.issuedVersion'),
                  value:
                    tender.currentVersionNo === 0
                      ? t('tender-authoring.overview.notIssued')
                      : t('tender-authoring.overview.versionNo', { no: tender.currentVersionNo }),
                },
                {
                  key: 'hash',
                  label: t('tender-authoring.overview.contentHash'),
                  value: <span className="tiq-mono">{tender.contentHash.slice(0, 12)}</span>,
                },
                {
                  key: 'updated',
                  label: t('tender-authoring.overview.updated'),
                  value: formatDateTime(tender.updatedAt, zone),
                },
                {
                  key: 'created',
                  label: t('tender-authoring.overview.created'),
                  value: `${formatDateTime(tender.createdAt, zone)}${tender.createdBy === null ? '' : ` · ${tender.createdBy.fullName}`}`,
                },
              ]}
            />
            {tender.versions.length > 0 && (
              <Timeline
                label={t('tender-authoring.overview.versions')}
                items={tender.versions.map((row) => ({
                  id: row.versionNo,
                  title: t('tender-authoring.overview.versionNo', { no: row.versionNo }),
                  meta: `${formatDateTime(row.issuedAt, zone)} · ${row.issuedBy.fullName}`,
                  detail: row.changeSummary,
                  tone: row.addendumId === null ? 'accent' : 'info',
                }))}
              />
            )}
          </Card>
          <Card
            title={t('tender-authoring.overview.approvalTitle')}
            actions={
              <ButtonLink to={tenderPaths.release(tender.id)} size="sm" variant="ghost">
                {t('tender-authoring.overview.openRelease')}
              </ButtonLink>
            }
          >
            {approval === null ? (
              <p>{t('tender-authoring.overview.noApproval')}</p>
            ) : (
              <DetailList
                stacked
                items={[
                  {
                    key: 'status',
                    label: t('tender-authoring.release.approval.status'),
                    value: (
                      <span className="tiq-inline">
                        <StatusChip enum="approval_requests.status" value={approval.status} />
                        <span>
                          {t('tender-authoring.release.approval.number', {
                            id: approval.approvalId,
                          })}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: 'covers',
                    label: t('tender-authoring.release.approval.covers'),
                    value: approval.coversCurrentRevision
                      ? t('tender-authoring.release.approval.coversCurrent', {
                          revision: approval.subjectVersion,
                        })
                      : t('tender-authoring.release.approval.coversOld', {
                          revision: approval.subjectVersion,
                          current: tender.draftRevision,
                        }),
                  },
                  {
                    key: 'decided',
                    label: t('tender-authoring.release.approval.decided'),
                    value:
                      approval.decidedBy === null
                        ? null
                        : `${approval.decidedBy.fullName} · ${approval.decidedAt === null ? '' : formatDateTime(approval.decidedAt, zone)}`,
                  },
                ]}
              />
            )}
          </Card>
          <Card title={t('tender-authoring.overview.teamTitle')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'owner',
                  label: t('tender-authoring.overview.owner'),
                  value: tender.owner.fullName,
                },
                {
                  key: 'chair',
                  label: t('tender-authoring.overview.chair'),
                  value: tender.team.evaluationChair?.fullName ?? null,
                },
                {
                  key: 'evaluators',
                  label: t('tender-authoring.overview.evaluators'),
                  value:
                    tender.team.evaluators.length === 0
                      ? null
                      : tender.team.evaluators.map((person) => person.fullName).join(', '),
                },
                {
                  key: 'members',
                  label: t('tender-authoring.overview.members'),
                  value: tender.team.memberCount,
                },
                {
                  key: 'missing',
                  label: t('tender-authoring.overview.missingRoles'),
                  value:
                    tender.team.missingRoles.length === 0 ? (
                      t('tender-authoring.common.none')
                    ) : (
                      <span className="tiq-inline">
                        {tender.team.missingRoles.map((role) => (
                          <Chip key={role} tone="danger" size="sm">
                            {tEnum('tender_team_members.team_role', role)}
                          </Chip>
                        ))}
                      </span>
                    ),
                },
              ]}
            />
          </Card>
          <Card title={t('tender-authoring.overview.datesTitle')}>
            {tender.keyDates.length === 0 ? (
              <EmptyState compact icon="calendar" title={t('tender-authoring.overview.noDates')} />
            ) : (
              <DetailList
                stacked
                items={tender.keyDates.map((row) => ({
                  key: `${row.milestone}-${row.lot?.id ?? 'tender'}`,
                  label: `${tEnum('tender_milestones.milestone', row.milestone)}${row.lot === null ? '' : ` · ${t('tender-authoring.common.lotNo', { no: row.lot.lotNo })}`}${row.isDisclosed ? '' : ` · ${t('tender-authoring.timetable.internal')}`}`,
                  value: <OfficialDeadline deadline={row.deadline} showLocal={false} />,
                }))}
              />
            )}
          </Card>
          <ReadinessCard tenderId={tender.id} approval={tender.releaseApproval} />
        </div>
      </div>
      {canEdit && (
        <EditTenderDialog
          open={editOpen}
          tender={tender}
          onClose={() => setEditOpen(false)}
          onSaved={(result) => {
            context.setTender(result.tender);
            context.reportChange(result.change);
          }}
        />
      )}
      {canEdit && (
        <LinkStageDialog
          open={linkOpen}
          tenderId={tender.id}
          onClose={() => setLinkOpen(false)}
          onLinked={onLinked}
        />
      )}
      {canCreate && (
        <SaveTemplateDialog
          open={templateOpen}
          tender={tender}
          onClose={() => setTemplateOpen(false)}
          onSaved={setTemplate}
        />
      )}
    </>
  );
}
