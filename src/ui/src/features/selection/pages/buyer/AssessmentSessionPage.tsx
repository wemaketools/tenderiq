/**
 * BUY-22 — One assessment session: purpose, agenda, participants (invitations), the equal-treatment checks, the
 * announced evaluation treatment of its basis, findings with evidence, and reference checks with consent. Actions:
 * confirm equal treatment, schedule (issue invitations), record findings, add references and feedback, complete or
 * cancel the session (FR-15, AC-21).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type {
  AssessmentFinding,
  AssessmentInvite,
  AssessmentSessionDetail,
  ReferenceCheck,
} from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import { DocumentList } from '../../../../components/documents';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  OrDash,
  PageHeader,
  QueryView,
  ReadinessChecklist,
  Reference,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatDateTime, formatOfficialTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { BidName } from '../../components/BidName';
import { IssueInvitesDialog } from '../../components/IssueInvitesDialog';
import { RecordFindingDialog } from '../../components/RecordFindingDialog';
import {
  CreateReferenceCheckDialog,
  RecordFeedbackDialog,
} from '../../components/ReferenceCheckDialogs';
import { ReferenceCheckTable } from '../../components/ReferenceCheckTable';
import { SelectionPage } from '../../components/SelectionPage';
import { withSelectionMessage } from '../../lib/errors';
import { useCommandResult, useIdParam } from '../../lib/hooks';
import { lotLabel, tenderLabel } from '../../lib/labels';
import { attempt } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { FINDING_RECORD, SELECTION_MANAGE } from '../../lib/permissions';

type Dialog =
  | 'equalTreatment'
  | 'invites'
  | 'finding'
  | 'reference'
  | 'complete'
  | 'cancel'
  | { readonly feedback: ReferenceCheck }
  | null;

function nextAction(session: AssessmentSessionDetail): string {
  if (session.status === 'cancelled') return t('selection.session.next.cancelled');
  if (session.status === 'completed') return t('selection.session.next.completed');
  if (!session.equalTreatmentConfirmed) return t('selection.session.next.equalTreatment');
  if (session.invites.length === 0) return t('selection.session.next.invite');
  if (session.status === 'scheduled') return t('selection.session.next.findings');
  return t('selection.session.next.schedule');
}

export default function AssessmentSessionPage() {
  const sessionId = useIdParam('sessionId');
  const toast = useToast();
  const canManage = usePermission(SELECTION_MANAGE);
  const canRecord = usePermission(FINDING_RECORD);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [latest, setLatest] = useCommandResult<AssessmentSessionDetail>(
    sessionId,
    (record) => record.sessionId,
  );
  const [addedFindings, setAddedFindings] = useState<readonly AssessmentFinding[]>([]);
  const [references, setReferences] = useState<Readonly<Record<number, ReferenceCheck>>>({});
  const query = useApiQuery(
    selectionEndpoints.getSession,
    sessionId === null ? null : { params: { sessionId } },
  );
  const confirm = useApiMutation(selectionEndpoints.confirmEqualTreatment);
  const complete = useApiMutation(selectionEndpoints.completeSession);
  const cancel = useApiMutation(selectionEndpoints.cancelSession);

  const loaded = latest ?? query.data;
  const view =
    loaded === undefined
      ? undefined
      : {
          ...loaded,
          findings: [
            ...loaded.findings,
            ...addedFindings.filter(
              (item) => !loaded.findings.some((f) => f.findingId === item.findingId),
            ),
          ],
          referenceChecks: [
            ...loaded.referenceChecks.map((item) => references[item.referenceCheckId] ?? item),
            ...Object.values(references).filter(
              (item) =>
                !loaded.referenceChecks.some((r) => r.referenceCheckId === item.referenceCheckId),
            ),
          ],
        };
  const open = view !== undefined && (view.status === 'planned' || view.status === 'scheduled');
  const close = (): void => setDialog(null);
  const saveReference = (check: ReferenceCheck): void => {
    setReferences((current) => ({ ...current, [check.referenceCheckId]: check }));
    close();
  };

  const inviteColumns: DataTableColumn<AssessmentInvite>[] = [
    {
      id: 'supplier',
      header: t('selection.invites.col.supplier'),
      cell: (row) => <BidName bid={row.bid} />,
    },
    {
      id: 'scheduledAt',
      header: t('selection.invites.col.scheduled'),
      cell: (row) =>
        row.scheduledAt === null || view === undefined ? (
          <OrDash>{null}</OrDash>
        ) : (
          formatOfficialTime(row.scheduledAt, view.tender.officialTimeZone)
        ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      cell: (row) => <StatusChip enum="assessment_invites.status" value={row.status} />,
    },
    {
      id: 'invitedAt',
      header: t('selection.invites.col.invited'),
      cell: (row) =>
        view === undefined ? null : formatDateTime(row.invitedAt, view.tender.officialTimeZone),
    },
    {
      id: 'confirmed',
      header: t('selection.invites.col.confirmed'),
      cell: (row) =>
        row.supplierConfirmedAt === null || view === undefined ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{formatDateTime(row.supplierConfirmedAt, view.tender.officialTimeZone)}</span>
            {row.supplierConfirmedBy !== null && (
              <span className="tiq-cell-sub">{row.supplierConfirmedBy.fullName}</span>
            )}
          </>
        ),
    },
  ];

  const findingColumns: DataTableColumn<AssessmentFinding>[] = [
    {
      id: 'supplier',
      header: t('selection.findings.col.supplier'),
      cell: (row) => <BidName bid={row.bid} />,
    },
    {
      id: 'finding',
      header: t('selection.findings.col.finding'),
      cell: (row) => row.finding,
    },
    {
      id: 'effect',
      header: t('selection.findings.col.effect'),
      cell: (row) => <StatusChip enum="assessment_findings.effect" value={row.effect} size="sm" />,
    },
    {
      id: 'evidence',
      header: t('selection.findings.col.evidence'),
      cell: (row) =>
        row.evidenceTitle === null ? (
          <span className="tiq-text-warning">{t('selection.findings.noEvidence')}</span>
        ) : (
          row.evidenceTitle
        ),
    },
    {
      id: 'assessor',
      header: t('selection.findings.col.assessor'),
      cell: (row) => (
        <>
          <span>{row.assessor.fullName}</span>
          <span className="tiq-cell-sub">
            {view === undefined
              ? null
              : formatDateTime(row.recordedAt, view.tender.officialTimeZone)}
          </span>
        </>
      ),
    },
  ];

  return (
    <SelectionPage
      header={
        <PageHeader
          title={
            view === undefined
              ? t('selection.session.title')
              : t('selection.session.heading', {
                  type: tEnum('assessment_sessions.session_type', view.sessionType),
                  reference: view.tender.reference,
                })
          }
          back={{ to: selectionPaths.assessments, label: t('selection.assessments.title') }}
          meta={
            view === undefined ? undefined : (
              <>
                <Reference
                  value={view.tender.reference}
                  to={selectionPaths.tender(view.tender.tenderId)}
                />
                <StatusChip enum="assessment_sessions.status" value={view.status} />
                <span>{tEnum('assessment_sessions.assessment_basis', view.assessmentBasis)}</span>
                <span>{t('selection.common.nextAction', { action: nextAction(view) })}</span>
              </>
            )
          }
          primaryAction={
            view !== undefined && open && canManage ? (
              view.equalTreatmentConfirmed ? (
                <Button variant="primary" icon="send" onClick={() => setDialog('invites')}>
                  {t('selection.invites.action')}
                </Button>
              ) : (
                <Button variant="primary" icon="scale" onClick={() => setDialog('equalTreatment')}>
                  {t('selection.equalTreatment.action')}
                </Button>
              )
            ) : undefined
          }
          actions={
            view !== undefined && open && canManage ? (
              <>
                <Button icon="checkCircle" onClick={() => setDialog('complete')}>
                  {t('selection.session.complete')}
                </Button>
                <Button variant="danger-soft" icon="ban" onClick={() => setDialog('cancel')}>
                  {t('selection.session.cancel')}
                </Button>
              </>
            ) : undefined
          }
        />
      }
    >
      <QueryView query={query}>
        {() =>
          view === undefined ? null : (
            <>
              {view.status === 'cancelled' && (
                <Banner tone="warning" title={t('selection.session.cancelledBanner')}>
                  <p>{view.cancellationReason}</p>
                </Banner>
              )}
              {view.status === 'completed' && (
                <Banner tone="success" title={t('selection.session.completedBanner')}>
                  <p>{view.completionSummary}</p>
                </Banner>
              )}
              <div className="tiq-grid tiq-grid--2">
                <Card title={t('selection.session.details')}>
                  <DetailList
                    items={[
                      { label: t('selection.common.tender'), value: tenderLabel(view.tender) },
                      { label: t('selection.common.lot'), value: lotLabel(view.lot) },
                      {
                        label: t('selection.sessionForm.type'),
                        value: tEnum('assessment_sessions.session_type', view.sessionType),
                      },
                      {
                        label: t('selection.sessionForm.preparationDays'),
                        value: t('selection.session.days', { count: view.preparationDays }),
                      },
                      { label: t('selection.sessionForm.purpose'), value: view.purpose },
                      { label: t('selection.common.owner'), value: view.createdBy.fullName },
                    ]}
                  />
                  <DetailList
                    stacked
                    items={[
                      { label: t('selection.sessionForm.agenda'), value: view.agenda },
                      { label: t('selection.sessionForm.instructions'), value: view.instructions },
                    ]}
                  />
                </Card>
                <Card
                  title={t('selection.session.treatment')}
                  subtitle={t('selection.session.treatmentHint')}
                >
                  <DetailList
                    stacked
                    items={[
                      {
                        label: t('selection.sessionForm.basis'),
                        value: tEnum('assessment_sessions.assessment_basis', view.assessmentBasis),
                      },
                      {
                        label: t('selection.sessionForm.criterion'),
                        value:
                          view.criterion === null
                            ? null
                            : t('selection.sessionForm.criterionOption', {
                                name: view.criterion.name,
                                weight: view.criterion.weight,
                              }),
                      },
                      {
                        label: t('selection.session.allowedEffects'),
                        value: (
                          <span className="tiq-inline">
                            {view.treatment.allowedEffects.map((effect) => (
                              <Chip key={effect} tone="info" size="sm">
                                {tEnum('assessment_findings.effect', effect)}
                              </Chip>
                            ))}
                          </span>
                        ),
                      },
                      {
                        label: t('selection.session.treatmentDescription'),
                        value: view.treatment.description,
                      },
                    ]}
                  />
                </Card>
              </div>
              <Card
                title={t('selection.equalTreatment.title')}
                subtitle={
                  view.equalTreatment.confirmedBy === null ||
                  view.equalTreatment.confirmedAt === null
                    ? t('selection.equalTreatment.notConfirmed')
                    : t('selection.equalTreatment.confirmedBy', {
                        name: view.equalTreatment.confirmedBy.fullName,
                        at: formatDateTime(
                          view.equalTreatment.confirmedAt,
                          view.tender.officialTimeZone,
                        ),
                      })
                }
              >
                <ReadinessChecklist
                  label={t('selection.equalTreatment.title')}
                  items={view.equalTreatment.checks.map((check) => ({
                    id: check.check,
                    label: t(`selection.equalTreatment.check.${check.check}`),
                    detail: check.detail,
                    status: check.satisfied ? 'passed' : 'blocking',
                  }))}
                />
              </Card>
              <Card
                title={t('selection.invites.cardTitle')}
                subtitle={t('selection.invites.cardHint', { count: view.invitableBids.length })}
                flush
                actions={
                  open && canManage && view.equalTreatmentConfirmed ? (
                    <Button size="sm" icon="send" onClick={() => setDialog('invites')}>
                      {t('selection.invites.action')}
                    </Button>
                  ) : undefined
                }
              >
                <DataTable
                  caption={t('selection.invites.cardTitle')}
                  columns={inviteColumns}
                  rows={view.invites}
                  rowKey={(row) => String(row.inviteId)}
                  empty={<EmptyState compact title={t('selection.invites.empty')} />}
                />
              </Card>
              <Card
                title={t('selection.findings.title')}
                subtitle={t('selection.findings.hint')}
                flush
                actions={
                  open && canRecord && view.invites.length > 0 ? (
                    <Button size="sm" icon="plus" onClick={() => setDialog('finding')}>
                      {t('selection.findings.record')}
                    </Button>
                  ) : undefined
                }
              >
                <DataTable
                  caption={t('selection.findings.title')}
                  columns={findingColumns}
                  rows={view.findings}
                  rowKey={(row) => String(row.findingId)}
                  empty={<EmptyState compact title={t('selection.findings.empty')} />}
                />
              </Card>
              {(view.sessionType === 'reference_check' || view.referenceChecks.length > 0) && (
                <Card
                  title={t('selection.references.title')}
                  subtitle={t('selection.references.hint')}
                  flush
                  actions={
                    canManage && view.status !== 'cancelled' ? (
                      <Button size="sm" icon="userPlus" onClick={() => setDialog('reference')}>
                        {t('selection.references.add')}
                      </Button>
                    ) : undefined
                  }
                >
                  <ReferenceCheckTable
                    caption={t('selection.references.title')}
                    checks={view.referenceChecks}
                    onRecordFeedback={
                      canManage ? (check) => setDialog({ feedback: check }) : undefined
                    }
                    empty={<EmptyState compact title={t('selection.references.empty')} />}
                  />
                </Card>
              )}
              <DocumentList
                audience="buyer"
                relatedType="assessment_session"
                relatedId={view.sessionId}
                title={t('selection.session.evidence')}
                canUpload={canRecord}
              />

              {dialog === 'equalTreatment' && (
                <ConfirmActionDialog
                  open
                  title={t('selection.equalTreatment.confirmTitle')}
                  scope={tenderLabel(view.tender, view.lot)}
                  consequence={t('selection.equalTreatment.consequence')}
                  confirmLabel={t('selection.equalTreatment.action')}
                  acknowledgement={t('selection.equalTreatment.acknowledgement')}
                  reason={{ label: t('selection.equalTreatment.note'), required: false }}
                  pending={confirm.pending}
                  error={withSelectionMessage(confirm.error)}
                  onCancel={() => {
                    confirm.reset();
                    close();
                  }}
                  onConfirm={async ({ reason }) => {
                    const result = await attempt(
                      confirm.mutate({
                        params: { sessionId: view.sessionId },
                        body: { confirmed: true, note: reason === '' ? null : reason },
                      }),
                    );
                    if (result === undefined) return;
                    toast.show(t('selection.equalTreatment.confirmed'), 'success');
                    setLatest(result);
                    close();
                  }}
                >
                  <ReadinessChecklist
                    label={t('selection.equalTreatment.title')}
                    items={view.equalTreatment.checks.map((check) => ({
                      id: check.check,
                      label: t(`selection.equalTreatment.check.${check.check}`),
                      detail: check.detail,
                      status: check.satisfied ? 'passed' : 'blocking',
                    }))}
                  />
                </ConfirmActionDialog>
              )}
              {dialog === 'invites' && (
                <IssueInvitesDialog
                  session={view}
                  onClose={close}
                  onIssued={(result) => {
                    setLatest(result);
                    close();
                  }}
                />
              )}
              {dialog === 'finding' && (
                <RecordFindingDialog
                  session={view}
                  onClose={close}
                  onRecorded={(finding) => {
                    setAddedFindings((list) => [...list, finding]);
                    close();
                  }}
                />
              )}
              {dialog === 'reference' && (
                <CreateReferenceCheckDialog
                  tender={view.tender}
                  bids={[...view.invites.map((invite) => invite.bid), ...view.invitableBids]}
                  onClose={close}
                  onCreated={saveReference}
                />
              )}
              {dialog !== null && typeof dialog === 'object' && (
                <RecordFeedbackDialog
                  check={dialog.feedback}
                  onClose={close}
                  onRecorded={saveReference}
                />
              )}
              {dialog === 'complete' && (
                <ConfirmActionDialog
                  open
                  title={t('selection.session.completeTitle')}
                  scope={tenderLabel(view.tender, view.lot)}
                  consequence={t('selection.session.completeConsequence', {
                    count: view.findings.length,
                  })}
                  confirmLabel={t('selection.session.complete')}
                  reason={{ label: t('selection.session.summary'), required: true }}
                  pending={complete.pending}
                  error={withSelectionMessage(complete.error)}
                  onCancel={() => {
                    complete.reset();
                    close();
                  }}
                  onConfirm={async ({ reason }) => {
                    const result = await attempt(
                      complete.mutate({
                        params: { sessionId: view.sessionId },
                        body: { summary: reason },
                      }),
                    );
                    if (result === undefined) return;
                    toast.show(t('selection.session.completed'), 'success');
                    setLatest(result);
                    close();
                  }}
                />
              )}
              {dialog === 'cancel' && (
                <ConfirmActionDialog
                  open
                  tone="danger"
                  title={t('selection.session.cancelTitle')}
                  scope={tenderLabel(view.tender, view.lot)}
                  consequence={t('selection.session.cancelConsequence')}
                  confirmLabel={t('selection.session.cancel')}
                  reason={{ label: t('selection.common.reason'), required: true }}
                  pending={cancel.pending}
                  error={withSelectionMessage(cancel.error)}
                  onCancel={() => {
                    cancel.reset();
                    close();
                  }}
                  onConfirm={async ({ reason }) => {
                    const result = await attempt(
                      cancel.mutate({ params: { sessionId: view.sessionId }, body: { reason } }),
                    );
                    if (result === undefined) return;
                    toast.show(t('selection.session.cancelled'), 'success');
                    setLatest(result);
                    close();
                  }}
                />
              )}
            </>
          )
        }
      </QueryView>
    </SelectionPage>
  );
}
