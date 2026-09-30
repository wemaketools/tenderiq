/**
 * ADM-09 — One qualification program (FR-06, PRD §7.3): scope, evidence, criteria and thresholds per assessment
 * area, assessors, decision authority, validity and monitoring triggers, with every criteria version. Program
 * managers revise the header, open a draft revision, edit its criteria, approve it (applications keep the version
 * they cite) and retire the program.
 */
import { useState } from 'react';

import {
  CreateProgramVersionBody,
  UpdateProgramBody,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type {
  Criterion,
  ProgramDetail,
  ProgramVersion,
  QualificationOptions,
} from '@contracts/qualification';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  FormErrorSummary,
  PageHeader,
  QueryView,
  RestrictedState,
  Select,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatInstantDate, formatMoney } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { CriteriaEditor } from '../../components/CriteriaEditor';
import { ProgramFields } from '../../components/ProgramFields';
import { summaryTitle, withQualificationMessage } from '../../lib/errors';
import { runCommand, useDefaultCurrency, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { buyerQualificationPaths } from '../../lib/paths';
import { PROGRAM_FIELDS, programBody, programDraftOf } from '../../lib/programDraft';
import { categoryLabel } from '../../lib/text';
import { errorLookup, validateWith } from '../../lib/validation';

export default function ProgramPage() {
  const programId = useIdParam('programId');
  const [versionId, setVersionId] = useState<number | null>(null);
  const query = useApiQuery(
    api.getProgram,
    programId === null
      ? null
      : { params: { programId }, query: versionId === null ? {} : { versionId } },
  );
  const notFound = programId === null || query.error?.kind === 'not_found';
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={
            notFound ? t('qualification.program.notFound') : t('qualification.program.loadingTitle')
          }
          back={{ to: buyerQualificationPaths.programs, label: t('qualification.program.back') }}
        />
      )}
      {notFound ? (
        <EmptyState title={t('qualification.program.notFound')} />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.program.restricted')} />
      ) : (
        <QueryView query={query}>
          {(data) => (
            <ProgramView
              key={`${data.id}-${data.shownVersionId ?? 0}`}
              fetched={data}
              onShowVersion={setVersionId}
            />
          )}
        </QueryView>
      )}
    </div>
  );
}

type DialogKind = 'approve' | 'retire' | 'version';

function ProgramView({
  fetched,
  onShowVersion,
}: {
  readonly fetched: ProgramDetail;
  readonly onShowVersion: (versionId: number) => void;
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission('qualification.program.manage');
  const options = useApiQuery(api.getQualificationOptions, {});
  const approve = useApiMutation(api.approveProgramVersion);
  const retire = useApiMutation(api.retireProgram);
  const [program, setProgram] = useState<ProgramDetail>(fetched);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  const shown = program.versions.find((version) => version.id === program.shownVersionId) ?? null;
  const draftVersion = program.versions.find((version) => version.status === 'draft') ?? null;
  const retired = program.status === 'retired';
  const canEditCriteria = canManage && shown !== null && shown.status === 'draft' && !retired;

  const apply = (next: ProgramDetail, message: string): void => {
    setProgram(next);
    setDialog(null);
    invalidateApiQueries('buyer.qualification.programs.list');
    toast.show(message, 'success');
  };

  const next = retired
    ? t('qualification.program.next.retired')
    : draftVersion !== null
      ? t('qualification.program.next.approveDraft', { no: draftVersion.versionNo })
      : t('qualification.program.next.current');

  const versionColumns: DataTableColumn<ProgramVersion>[] = [
    {
      id: 'versionNo',
      header: t('qualification.program.col.version'),
      cell: (row) => (
        <span className="tiq-inline">
          <span>{t('qualification.common.versionNo', { no: row.versionNo })}</span>
          {row.id === program.shownVersionId && (
            <Chip tone="accent" size="sm">
              {t('qualification.program.shown')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('qualification.program.col.status'),
      cell: (row) => (
        <StatusChip enum="qualification_program_versions.status" value={row.status} size="sm" />
      ),
    },
    {
      id: 'changeNote',
      header: t('qualification.program.col.changeNote'),
      cell: (row) => row.changeNote ?? t('qualification.common.none'),
    },
    {
      id: 'approved',
      header: t('qualification.program.col.approved'),
      cell: (row) =>
        row.approvedAt === null ? (
          <span className="tiq-text-muted">{t('qualification.program.notApproved')}</span>
        ) : (
          <>
            <span>{formatInstantDate(row.approvedAt, timeZone)}</span>
            <span className="tiq-cell-sub">{row.approvedBy?.fullName ?? ''}</span>
          </>
        ),
    },
    {
      id: 'criteria',
      header: t('qualification.program.col.criteria'),
      numeric: true,
      cell: (row) =>
        t('qualification.program.criteriaCount', {
          total: row.criteriaCount,
          mandatory: row.mandatoryCount,
        }),
    },
    {
      id: 'applications',
      header: t('qualification.program.col.applications'),
      numeric: true,
      cell: (row) => formatCount(row.applicationCount),
    },
  ];

  return (
    <>
      <PageHeader
        title={program.name}
        subtitle={program.description ?? undefined}
        back={{ to: buyerQualificationPaths.programs, label: t('qualification.program.back') }}
        meta={
          <>
            <StatusChip enum="qualification_programs.status" value={program.status} />
            {program.currentVersion !== null && (
              <span>
                {t('qualification.program.currentVersion', {
                  no: program.currentVersion.versionNo,
                })}
              </span>
            )}
            <span>{t('qualification.common.nextAction', { action: next })}</span>
          </>
        }
        primaryAction={
          canManage && shown?.status === 'draft' && !retired ? (
            <Button variant="primary" icon="checkCircle" onClick={() => setDialog('approve')}>
              {t('qualification.program.approve', { no: shown.versionNo })}
            </Button>
          ) : undefined
        }
        actions={
          canManage && !retired ? (
            <>
              {draftVersion === null && (
                <Button icon="copy" onClick={() => setDialog('version')}>
                  {t('qualification.program.newVersion')}
                </Button>
              )}
              {!editing && (
                <Button icon="edit" onClick={() => setEditing(true)}>
                  {t('qualification.program.edit')}
                </Button>
              )}
              <Button variant="danger-soft" icon="archive" onClick={() => setDialog('retire')}>
                {t('qualification.program.retire')}
              </Button>
            </>
          ) : undefined
        }
      />
      {retired && <Banner tone="info">{t('qualification.program.retiredBanner')}</Banner>}
      {editing ? (
        <HeaderEditor
          program={program}
          options={options.data}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            apply(saved, t('qualification.program.saved'));
          }}
        />
      ) : (
        <div className="tiq-grid tiq-grid--2">
          <Card title={t('qualification.program.scopeTitle')}>
            <DetailList
              items={[
                {
                  label: t('qualification.program.category'),
                  value: categoryLabel(program.category),
                },
                {
                  label: t('qualification.program.covered'),
                  value: program.coveredCategories.map(categoryLabel).join(', '),
                },
                { label: t('qualification.program.geography'), value: program.geography },
                {
                  label: t('qualification.program.maxValue'),
                  value:
                    program.maxContractValue === null
                      ? t('qualification.common.noValueLimit')
                      : formatMoney(program.maxContractValue),
                },
                {
                  label: t('qualification.program.validity'),
                  value: t('qualification.programs.months', { count: program.validityMonths }),
                },
                {
                  label: t('qualification.program.notice'),
                  value: t('qualification.programs.notice', { count: program.renewalNoticeDays }),
                },
              ]}
            />
          </Card>
          <Card title={t('qualification.program.authorityTitle')}>
            <DetailList
              items={[
                { label: t('qualification.program.decisionRole'), value: program.decisionRoleName },
                {
                  label: t('qualification.program.independentApproval'),
                  value: program.requiresIndependentApproval
                    ? t('qualification.common.yes')
                    : t('qualification.common.no'),
                },
                { label: t('qualification.program.owner'), value: program.owner.fullName },
                {
                  label: t('qualification.program.assessors'),
                  value: program.assessors.map((person) => person.fullName).join(', '),
                },
                {
                  label: t('qualification.program.financialReviewers'),
                  value: program.financialReviewers.map((person) => person.fullName).join(', '),
                },
                {
                  label: t('qualification.program.deciders'),
                  value: program.deciders.map((person) => person.fullName).join(', '),
                },
                {
                  label: t('qualification.program.triggers'),
                  value: program.monitoredTriggerTypes
                    .map((value) => tEnum('reassessment_triggers.trigger_type', value))
                    .join(', '),
                },
              ]}
            />
          </Card>
        </div>
      )}
      <Card
        flush
        title={t('qualification.program.versionsTitle')}
        subtitle={t('qualification.program.versionsHint')}
      >
        <DataTable
          caption={t('qualification.program.versionsTitle')}
          columns={versionColumns}
          rows={program.versions}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => t('qualification.common.versionNo', { no: row.versionNo })}
          onRowClick={(row) => onShowVersion(row.id)}
          empty={<EmptyState compact title={t('qualification.program.noVersions')} />}
        />
      </Card>
      <Card title={t('qualification.program.areasTitle')}>
        {program.areaCounts.length === 0 ? (
          <EmptyState compact title={t('qualification.criteria.none')} />
        ) : (
          <DetailList
            items={program.areaCounts.map((item) => ({
              key: item.area,
              label: tEnum('qualification_criteria.area', item.area),
              value: t('qualification.program.criteriaCount', {
                total: item.criteria,
                mandatory: item.mandatory,
              }),
            }))}
          />
        )}
      </Card>
      <Card
        title={
          shown === null
            ? t('qualification.program.criteriaTitle')
            : t('qualification.program.criteriaOf', {
                no: shown.versionNo,
                status: tEnum('qualification_program_versions.status', shown.status),
              })
        }
        subtitle={
          canEditCriteria
            ? t('qualification.program.criteriaDraftHint')
            : t('qualification.program.criteriaLockedHint')
        }
      >
        {canEditCriteria && shown !== null ? (
          <CriteriaEditor
            key={shown.id}
            program={program}
            versionId={shown.id}
            onSaved={(saved) => apply(saved, t('qualification.criteria.saved'))}
          />
        ) : (
          <CriteriaList criteria={program.criteria} />
        )}
      </Card>

      {dialog === 'approve' && shown !== null && (
        <ConfirmActionDialog
          open
          title={t('qualification.program.approveTitle', { no: shown.versionNo })}
          scope={t('qualification.program.approveScope', {
            name: program.name,
            no: shown.versionNo,
            count: program.criteria.length,
          })}
          consequence={t('qualification.program.approveConsequence')}
          confirmLabel={t('qualification.program.approve', { no: shown.versionNo })}
          reason={{ label: t('qualification.program.approveNote'), required: false }}
          pending={approve.pending}
          error={withQualificationMessage(approve.error)}
          onCancel={() => {
            approve.reset();
            setDialog(null);
          }}
          onConfirm={({ reason }) =>
            runCommand(
              () =>
                approve.mutate({
                  params: { programId: program.id, versionId: shown.id },
                  body: { note: reason.trim() === '' ? null : reason.trim() },
                }),
              (saved) => apply(saved, t('qualification.program.approved', { no: shown.versionNo })),
            )
          }
        />
      )}
      {dialog === 'retire' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('qualification.program.retireTitle')}
          scope={program.name}
          consequence={t('qualification.program.retireConsequence', {
            count: program.openApplicationCount,
          })}
          confirmLabel={t('qualification.program.retire')}
          reason={{ label: t('qualification.program.retireReason'), required: true }}
          pending={retire.pending}
          error={withQualificationMessage(retire.error)}
          onCancel={() => {
            retire.reset();
            setDialog(null);
          }}
          onConfirm={({ reason }) =>
            runCommand(
              () => retire.mutate({ params: { programId: program.id }, body: { reason } }),
              (saved) => apply(saved, t('qualification.program.retired')),
            )
          }
        />
      )}
      {dialog === 'version' && (
        <NewVersionDialog
          program={program}
          onClose={() => setDialog(null)}
          onCreated={(saved) => apply(saved, t('qualification.program.versionCreated'))}
        />
      )}
    </>
  );
}

function CriteriaList({ criteria }: { readonly criteria: readonly Criterion[] }) {
  if (criteria.length === 0) return <EmptyState compact title={t('qualification.criteria.none')} />;
  const areas = [...new Set(criteria.map((criterion) => criterion.area))];
  return (
    <div className="tiq-stack">
      {areas.map((area) => (
        <section
          key={area}
          className="tiq-stack"
          aria-label={tEnum('qualification_criteria.area', area)}
        >
          <h3 className="tiq-form-section-title">{tEnum('qualification_criteria.area', area)}</h3>
          {criteria
            .filter((criterion) => criterion.area === area)
            .map((criterion) => (
              <div key={criterion.id} className="tiq-stack">
                <div className="tiq-inline">
                  <strong>{criterion.question}</strong>
                  {criterion.mandatory && (
                    <Chip tone="neutral" size="sm">
                      {t('qualification.common.mandatory')}
                    </Chip>
                  )}
                  <Chip tone="info" size="sm">
                    {tEnum('qualification_criteria.response_type', criterion.responseType)}
                  </Chip>
                </div>
                <DetailList
                  items={[
                    { label: t('qualification.criteria.guidance'), value: criterion.guidance },
                    {
                      label: t('qualification.criteria.threshold'),
                      value: criterion.thresholdDescription,
                    },
                    {
                      label: t('qualification.criteria.evidenceTypes'),
                      value: criterion.evidenceTypes
                        .map((value) => tEnum('evidence_items.evidence_type', value))
                        .join(', '),
                    },
                    {
                      label: t('qualification.criteria.naReason'),
                      value: criterion.requiresNaReason
                        ? t('qualification.common.yes')
                        : t('qualification.common.no'),
                    },
                  ]}
                />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

function HeaderEditor({
  program,
  options,
  onCancel,
  onSaved,
}: {
  readonly program: ProgramDetail;
  readonly options: QualificationOptions | undefined;
  readonly onCancel: () => void;
  readonly onSaved: (program: ProgramDetail) => void;
}) {
  const update = useApiMutation(api.updateProgram);
  const defaultCurrency = useDefaultCurrency();
  const [baseline] = useState(() =>
    programDraftOf(program, options?.currencies[0] ?? defaultCurrency),
  );
  const [draft, setDraft] = useState(baseline);
  const [tried, setTried] = useState(false);
  const body = programBody(draft);
  const errors = errorLookup(
    tried ? validateWith(UpdateProgramBody, body) : [],
    update.error,
    PROGRAM_FIELDS,
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const save = (): void => {
    setTried(true);
    const parsed = UpdateProgramBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () => update.mutate({ params: { programId: program.id }, body: parsed.data }),
      onSaved,
    );
  };

  return (
    <Card
      title={t('qualification.program.headerTitle')}
      subtitle={t('qualification.program.headerHint')}
    >
      <UnsavedChangesGuard when={dirty && !update.pending} />
      <FormErrorSummary title={summaryTitle(update.error)} errors={errors.other} />
      <ProgramFields draft={draft} onChange={setDraft} options={options} errors={errors} />
      <div className="tiq-inline">
        <Button onClick={onCancel} disabled={update.pending}>
          {t('qualification.common.cancel')}
        </Button>
        <Button
          variant="primary"
          icon="check"
          onClick={save}
          loading={update.pending}
          disabled={!dirty}
        >
          {t('qualification.program.save')}
        </Button>
      </div>
    </Card>
  );
}

function NewVersionDialog({
  program,
  onClose,
  onCreated,
}: {
  readonly program: ProgramDetail;
  readonly onClose: () => void;
  readonly onCreated: (program: ProgramDetail) => void;
}) {
  const create = useApiMutation(api.createProgramVersion);
  const [changeNote, setChangeNote] = useState('');
  const [copyFrom, setCopyFrom] = useState(
    program.currentVersion === null ? '' : String(program.currentVersion.id),
  );
  const [tried, setTried] = useState(false);
  const body = { changeNote, copyFromVersionId: copyFrom === '' ? null : Number(copyFrom) };
  const errors = errorLookup(
    tried ? validateWith(CreateProgramVersionBody, body) : [],
    create.error,
    ['changeNote', 'copyFromVersionId'],
  );
  return (
    <ConfirmActionDialog
      open
      title={t('qualification.program.newVersionTitle')}
      scope={program.name}
      consequence={t('qualification.program.newVersionConsequence')}
      confirmLabel={t('qualification.program.newVersion')}
      pending={create.pending}
      error={withQualificationMessage(create.error)}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        const parsed = CreateProgramVersionBody.safeParse(body);
        if (!parsed.success) return;
        return runCommand(
          () => create.mutate({ params: { programId: program.id }, body: parsed.data }),
          onCreated,
        );
      }}
    >
      <FormErrorSummary title={null} errors={errors.other} />
      <TextArea
        label={t('qualification.program.changeNote')}
        required
        rows={3}
        value={changeNote}
        onChange={setChangeNote}
        error={errors.forField('changeNote')}
      />
      <Select
        label={t('qualification.program.copyFrom')}
        placeholder={t('qualification.program.copyNothing')}
        value={copyFrom}
        onChange={setCopyFrom}
        error={errors.forField('copyFromVersionId')}
        options={program.versions.map((version) => ({
          value: String(version.id),
          label: `${t('qualification.common.versionNo', { no: version.versionNo })} · ${tEnum('qualification_program_versions.status', version.status)}`,
        }))}
      />
    </ConfirmActionDialog>
  );
}
