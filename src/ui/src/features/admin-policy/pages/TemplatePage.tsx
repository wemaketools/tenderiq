/**
 * ADM-08 — one template: governance metadata (owner, procedure, category, audience, effective and review dates),
 * the revision history, the content of any version, the records that adopted it, and the actions: edit details,
 * draft a revision (the approved version stays in use meanwhile), edit and submit the draft, approve or return it
 * (never your own submission, BR-07), and retire the template so no new work can select it (PRD §17.3).
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import {
  CreateTemplateVersionBody,
  UpdateTemplateBody,
  approveTemplateVersion,
  createTemplateVersion,
  getTemplate,
  getTemplateAuthoringOptions,
  getTemplateVersion,
  retireTemplate,
  returnTemplateVersion,
  submitTemplateVersion,
  updateTemplate,
  updateTemplateVersion,
} from '@contracts/policy';
import type {
  TemplateDetail,
  TemplateUsage,
  TemplateVersionDetail,
  TemplateVersionSummary,
} from '@contracts/policy';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  OrDash,
  OverdueChip,
  PageHeader,
  QueryView,
  Reference,
  SkeletonBlock,
  StatusChip,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { PlainMarkdown } from '../components/PlainMarkdown';
import { PolicyLayout } from '../components/PolicyLayout';
import { TemplateContentForm, TemplateMetaForm } from '../components/TemplateForms';
import { policyErrorMessage, withPolicyMessage } from '../lib/errors';
import { useCommandResult, useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { templateNextAction } from '../lib/nextActions';
import { contractPath, policyPaths, tenderPath } from '../lib/paths';
import {
  CONTENT_FIELDS,
  META_FIELDS,
  metaToBody,
  templateToMeta,
  versionToContent,
} from '../lib/templateDrafts';
import type { ContentDraft, TemplateMetaDraft } from '../lib/templateDrafts';
import { errorLookup, validateWith } from '../lib/validation';

type Action = 'submit' | 'approve' | 'return' | 'retire' | null;
type Editing = { readonly mode: 'revise' | 'draft'; readonly content: ContentDraft } | null;

function VersionContent({ version }: { readonly version: TemplateVersionDetail }) {
  const items = [...version.checklistItems].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="tiq-stack">
      {version.returnedReason !== null && version.versionStatus === 'draft' && (
        <Banner tone="warning" title={t('admin-policy.template.returnedTitle')}>
          <p>{version.returnedReason}</p>
        </Banner>
      )}
      {version.changeNote !== '' && (
        <p>
          <strong>{t('admin-policy.template.changeNote')}</strong> {version.changeNote}
        </p>
      )}
      {version.bodyMarkdown.trim() !== '' && <PlainMarkdown text={version.bodyMarkdown} />}
      {items.length > 0 && (
        <ol className="tiq-stack">
          {items.map((item) => (
            <li key={item.id} className="tiq-inline">
              <span>{item.itemText}</span>
              {item.mandatory ? (
                <Chip tone="warning" size="sm">
                  {t('admin-policy.templateForm.mandatory')}
                </Chip>
              ) : (
                <Chip tone="neutral" size="sm">
                  {t('admin-policy.template.optionalItem')}
                </Chip>
              )}
            </li>
          ))}
        </ol>
      )}
      {items.length === 0 && version.bodyMarkdown.trim() === '' && (
        <EmptyState compact title={t('admin-policy.template.noContent')} />
      )}
    </div>
  );
}

function SelectedVersion({
  template,
  versionId,
}: {
  readonly template: TemplateDetail;
  readonly versionId: number;
}) {
  const isFocus = template.focusVersion.id === versionId;
  const query = useApiQuery(
    getTemplateVersion,
    isFocus ? null : { params: { templateId: template.id, versionId } },
  );
  if (isFocus) return <VersionContent version={template.focusVersion} />;
  if (query.data === undefined && query.error !== null) {
    return <ErrorState error={query.error} onRetry={query.reload} />;
  }
  if (query.data === undefined) return <SkeletonBlock lines={4} />;
  return <VersionContent version={query.data} />;
}

interface TemplateViewProps {
  readonly template: TemplateDetail;
  readonly onUpdated: (template: TemplateDetail) => void;
}

function TemplateView({ template, onUpdated }: TemplateViewProps) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const caps = template.capabilities;
  const [selectedId, setSelectedId] = useState<number>(template.focusVersion.id);
  const [action, setAction] = useState<Action>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [metaDraft, setMetaDraft] = useState<TemplateMetaDraft | null>(null);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [metaErrors, setMetaErrors] = useState<readonly FieldError[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const options = useApiQuery(getTemplateAuthoringOptions, metaDraft === null ? null : {});
  const saveMeta = useApiMutation(updateTemplate);
  const revise = useApiMutation(createTemplateVersion);
  const editDraft = useApiMutation(updateTemplateVersion);
  const submit = useApiMutation(submitTemplateVersion);
  const approve = useApiMutation(approveTemplateVersion);
  const giveBack = useApiMutation(returnTemplateVersion);
  const retire = useApiMutation(retireTemplate);

  const pending = template.versions.find(
    (version) => version.versionStatus === 'draft' || version.versionStatus === 'in_review',
  );
  const pendingParams =
    pending === undefined ? null : { templateId: template.id, versionId: pending.id };
  const draftMutation = editing?.mode === 'draft' ? editDraft : revise;
  const contentErrors = errorLookup(clientErrors, draftMutation.error, CONTENT_FIELDS);
  const metaLookup = errorLookup(metaErrors, saveMeta.error, META_FIELDS);
  const scope = t('admin-policy.template.scope', {
    name: template.name,
    kind: tEnum('templates.kind', template.kind),
  });
  const versionScope = (version: TemplateVersionSummary | undefined): string =>
    version === undefined
      ? scope
      : t('admin-policy.template.versionScope', { name: template.name, no: version.versionNo });

  const accept = (result: TemplateDetail, message: string): void => {
    onUpdated(result);
    setSelectedId(result.focusVersion.id);
    toast.show(message, 'success');
  };

  const saveContent = async (): Promise<void> => {
    if (editing === null) return;
    const body = {
      bodyMarkdown: editing.content.bodyMarkdown,
      checklistItems: editing.content.checklistItems.map((item) => ({ ...item })),
      changeNote: editing.content.changeNote,
    };
    const problems = validateWith(CreateTemplateVersionBody, body);
    setClientErrors(problems);
    if (problems.length > 0) return;
    try {
      if (editing.mode === 'draft' && pendingParams !== null) {
        accept(
          await editDraft.mutate({ params: pendingParams, body }),
          t('admin-policy.template.draftSaved'),
        );
      } else {
        accept(
          await revise.mutate({ params: { templateId: template.id }, body }),
          t('admin-policy.template.revisionCreated'),
        );
      }
      setEditing(null);
    } catch {
      // Shown above the form.
    }
  };

  const saveDetails = async (): Promise<void> => {
    if (metaDraft === null) return;
    const body = metaToBody(metaDraft);
    const problems = validateWith(UpdateTemplateBody, body);
    setMetaErrors(problems);
    if (problems.length > 0) return;
    try {
      accept(
        await saveMeta.mutate({ params: { templateId: template.id }, body }),
        t('admin-policy.template.detailsSaved'),
      );
      setMetaDraft(null);
    } catch {
      // Shown in the dialog.
    }
  };

  const closeAction = (): void => {
    submit.reset();
    approve.reset();
    giveBack.reset();
    retire.reset();
    setAction(null);
  };

  const run = async (task: () => Promise<TemplateDetail>, message: string): Promise<void> => {
    try {
      accept(await task(), message);
      setAction(null);
    } catch {
      // Shown in the dialog.
    }
  };

  const versionColumns: DataTableColumn<TemplateVersionSummary>[] = [
    {
      id: 'version',
      header: t('admin-policy.template.col.version'),
      cell: (row) => (
        <span className="tiq-inline">
          <span>{t('admin-policy.common.versionNo', { no: row.versionNo })}</span>
          {row.isCurrent && (
            <Chip tone="accent" size="sm">
              {t('admin-policy.common.current')}
            </Chip>
          )}
          {row.id === selectedId && (
            <Chip tone="neutral" size="sm">
              {t('admin-policy.template.shown')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('admin-policy.template.col.status'),
      cell: (row) =>
        row.versionStatus === 'retired' && !row.isCurrent ? (
          <Chip tone="neutral">{t('admin-policy.template.superseded')}</Chip>
        ) : (
          <StatusChip enum="templates.status" value={row.versionStatus} />
        ),
    },
    {
      id: 'note',
      header: t('admin-policy.template.col.note'),
      cell: (row) => <OrDash>{row.changeNote}</OrDash>,
    },
    {
      id: 'submitted',
      header: t('admin-policy.template.col.submitted'),
      cell: (row) => (
        <>
          <OrDash>{row.submittedBy?.fullName}</OrDash>
          {row.submittedAt !== null && (
            <span className="tiq-cell-sub">{formatDateTime(row.submittedAt, timeZone)}</span>
          )}
        </>
      ),
    },
    {
      id: 'approved',
      header: t('admin-policy.template.col.approved'),
      cell: (row) => (
        <>
          <OrDash>{row.approvedBy?.fullName}</OrDash>
          {row.approvedAt !== null && (
            <span className="tiq-cell-sub">{formatDateTime(row.approvedAt, timeZone)}</span>
          )}
        </>
      ),
    },
  ];

  const usageColumns: DataTableColumn<TemplateUsage>[] = [
    {
      id: 'reference',
      header: t('admin-policy.template.usage.reference'),
      cell: (row) => (
        <Reference
          value={row.reference}
          to={row.recordType === 'tender' ? tenderPath(row.recordId) : contractPath(row.recordId)}
        />
      ),
    },
    {
      id: 'type',
      header: t('admin-policy.template.usage.type'),
      cell: (row) => t(`admin-policy.template.usage.recordType.${row.recordType}`),
    },
    {
      id: 'title',
      header: t('admin-policy.template.usage.recordTitle'),
      cell: (row) => row.title,
    },
    {
      id: 'adopted',
      header: t('admin-policy.template.usage.adopted'),
      cell: (row) => (
        <>
          <span>{t('admin-policy.common.versionNo', { no: row.adoptedVersionNo })}</span>
          <span className="tiq-cell-sub">{formatDateTime(row.adoptedAt, timeZone)}</span>
        </>
      ),
    },
  ];

  const primary =
    editing !== null ? (
      <Button
        variant="primary"
        icon="check"
        loading={draftMutation.pending}
        onClick={() => void saveContent()}
      >
        {editing.mode === 'draft'
          ? t('admin-policy.template.saveDraft')
          : t('admin-policy.template.createRevision')}
      </Button>
    ) : caps.canApprove ? (
      <Button variant="primary" icon="checkCircle" onClick={() => setAction('approve')}>
        {t('admin-policy.template.approve')}
      </Button>
    ) : caps.canSubmit ? (
      <Button variant="primary" icon="send" onClick={() => setAction('submit')}>
        {t('admin-policy.template.submit')}
      </Button>
    ) : caps.canDraftVersion ? (
      <Button
        variant="primary"
        icon="plus"
        onClick={() =>
          setEditing({ mode: 'revise', content: versionToContent(template.focusVersion) })
        }
      >
        {t('admin-policy.template.newRevision')}
      </Button>
    ) : undefined;

  return (
    <>
      <UnsavedChangesGuard when={editing !== null} />
      <PageHeader
        title={template.name}
        back={{ to: policyPaths.templates, label: t('admin-policy.templates.back') }}
        meta={
          <span className="tiq-inline">
            <span>{tEnum('templates.kind', template.kind)}</span>
            <StatusChip enum="templates.status" value={template.status} />
            {template.selectable ? (
              <Chip tone="success" icon="check">
                {t('admin-policy.template.selectable')}
              </Chip>
            ) : (
              <Chip tone="neutral" icon="ban">
                {t('admin-policy.templates.notSelectable')}
              </Chip>
            )}
            {template.reviewOverdue && <OverdueChip />}
            <span>
              <strong>{t('admin-policy.common.nextAction')}</strong> {templateNextAction(template)}
            </span>
          </span>
        }
        primaryAction={primary}
        actions={
          <>
            {editing !== null && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setClientErrors([]);
                  revise.reset();
                  editDraft.reset();
                }}
              >
                {t('admin-policy.common.cancelEditing')}
              </Button>
            )}
            {editing === null && caps.canEdit && (
              <Button icon="edit" onClick={() => setMetaDraft(templateToMeta(template))}>
                {t('admin-policy.template.editDetails')}
              </Button>
            )}
            {editing === null && caps.canSubmit && pending !== undefined && (
              <Button
                icon="edit"
                onClick={() =>
                  setEditing({
                    mode: 'draft',
                    content: versionToContent(
                      template.focusVersion,
                      template.focusVersion.changeNote,
                    ),
                  })
                }
              >
                {t('admin-policy.template.editDraft')}
              </Button>
            )}
            {editing === null && caps.canReturn && (
              <Button icon="arrowLeft" onClick={() => setAction('return')}>
                {t('admin-policy.template.return')}
              </Button>
            )}
            {editing === null && caps.canRetire && (
              <Button variant="danger-soft" icon="archive" onClick={() => setAction('retire')}>
                {t('admin-policy.template.retire')}
              </Button>
            )}
          </>
        }
      />
      {template.status === 'retired' && (
        <Banner tone="warning" title={t('admin-policy.template.retiredTitle')}>
          <p>{t('admin-policy.template.retiredBody', { count: template.usage.length })}</p>
          {template.retirementReason !== null && (
            <p>
              <strong>{t('admin-policy.common.reason')}</strong> {template.retirementReason}
            </p>
          )}
        </Banner>
      )}
      {caps.approvalBlockedReason !== null && (
        <Banner tone="warning" title={t('admin-policy.version.sodTitle')}>
          <p>{caps.approvalBlockedReason}</p>
        </Banner>
      )}
      {caps.alternativeOversightNote !== null && (
        <Banner tone="info" title={t('admin-policy.common.oversightTitle')}>
          <p>{t('admin-policy.common.oversightBody')}</p>
          <p>{caps.alternativeOversightNote}</p>
        </Banner>
      )}
      {template.reviewOverdue && template.status !== 'retired' && (
        <Banner tone="warning" title={t('admin-policy.template.overdueTitle')}>
          <p>
            {t('admin-policy.template.overdueBody', {
              date: template.reviewDate === null ? '' : formatCalendarDate(template.reviewDate),
              owner: template.owner.fullName,
            })}
          </p>
        </Banner>
      )}

      {editing !== null ? (
        <Card
          title={
            editing.mode === 'draft'
              ? t('admin-policy.template.editDraftTitle', { no: pending?.versionNo ?? 1 })
              : t('admin-policy.template.reviseTitle')
          }
          subtitle={t('admin-policy.template.reviseHint')}
        >
          {(contentErrors.other.length > 0 ||
            (draftMutation.error !== null && contentErrors.count === 0)) && (
            <FormErrorSummary
              title={draftMutation.error === null ? null : policyErrorMessage(draftMutation.error)}
              errors={contentErrors.other}
            />
          )}
          <TemplateContentForm
            kind={template.kind}
            value={editing.content}
            onChange={(content) => setEditing({ ...editing, content })}
            errors={contentErrors}
            withChangeNote
          />
        </Card>
      ) : (
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack">
            <Card
              title={t('admin-policy.template.content', {
                no:
                  template.versions.find((version) => version.id === selectedId)?.versionNo ??
                  template.focusVersion.versionNo,
              })}
            >
              <SelectedVersion template={template} versionId={selectedId} />
            </Card>
            <Card flush title={t('admin-policy.template.history')}>
              <DataTable
                caption={t('admin-policy.template.history')}
                columns={versionColumns}
                rows={template.versions}
                rowKey={(row) => String(row.id)}
                rowLabel={(row) => t('admin-policy.template.showVersion', { no: row.versionNo })}
                onRowClick={(row) => setSelectedId(row.id)}
              />
            </Card>
            <Card flush title={t('admin-policy.template.usage.title')}>
              <DataTable
                caption={t('admin-policy.template.usage.title')}
                columns={usageColumns}
                rows={template.usage}
                rowKey={(row) => `${row.recordType}-${row.recordId}`}
                empty={<EmptyState compact title={t('admin-policy.template.usage.none')} />}
              />
            </Card>
          </div>
          <Card title={t('admin-policy.template.governance')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'kind',
                  label: t('admin-policy.templateForm.kind'),
                  value: tEnum('templates.kind', template.kind),
                },
                {
                  key: 'owner',
                  label: t('admin-policy.templateForm.owner'),
                  value: template.owner.fullName,
                },
                {
                  key: 'procedure',
                  label: t('admin-policy.templateForm.procedure'),
                  value:
                    template.procedure === null
                      ? t('admin-policy.templateForm.anyProcedure')
                      : tEnum('tenders.procedure', template.procedure),
                },
                {
                  key: 'category',
                  label: t('admin-policy.templateForm.category'),
                  value:
                    template.category === null
                      ? t('admin-policy.templateForm.anyCategory')
                      : `${template.category.code} · ${template.category.name}`,
                },
                {
                  key: 'audience',
                  label: t('admin-policy.templateForm.audience'),
                  value: tEnum('templates.audience', template.audience),
                },
                {
                  key: 'effective',
                  label: t('admin-policy.template.effective'),
                  value:
                    template.effectiveFrom === null
                      ? null
                      : formatDateTime(template.effectiveFrom, timeZone),
                },
                {
                  key: 'review',
                  label: t('admin-policy.templateForm.reviewDate'),
                  value:
                    template.reviewDate === null ? null : formatCalendarDate(template.reviewDate),
                },
                {
                  key: 'current',
                  label: t('admin-policy.template.currentVersion'),
                  value:
                    template.currentVersionNo === null
                      ? null
                      : t('admin-policy.common.versionNo', { no: template.currentVersionNo }),
                },
                {
                  key: 'usage',
                  label: t('admin-policy.template.usageCount'),
                  value: formatCount(template.usageCount),
                },
                {
                  key: 'source',
                  label: t('admin-policy.template.sourceTender'),
                  value:
                    template.sourceTenderId === null ? null : (
                      <Reference
                        value={t('admin-policy.template.sourceTenderLink')}
                        to={tenderPath(template.sourceTenderId)}
                      />
                    ),
                },
                {
                  key: 'created',
                  label: t('admin-policy.template.created'),
                  value: formatDateTime(template.createdAt, timeZone),
                },
              ]}
            />
          </Card>
        </div>
      )}

      <Dialog
        open={metaDraft !== null}
        size="lg"
        title={t('admin-policy.template.editDetailsTitle')}
        dismissible={!saveMeta.pending}
        onClose={() => {
          saveMeta.reset();
          setMetaErrors([]);
          setMetaDraft(null);
        }}
        footer={
          <>
            <Button
              disabled={saveMeta.pending}
              onClick={() => {
                saveMeta.reset();
                setMetaErrors([]);
                setMetaDraft(null);
              }}
            >
              {t('admin-policy.common.cancel')}
            </Button>
            <Button variant="primary" loading={saveMeta.pending} onClick={() => void saveDetails()}>
              {t('admin-policy.template.saveDetails')}
            </Button>
          </>
        }
      >
        {metaDraft !== null && (
          <div className="tiq-stack">
            {(metaLookup.other.length > 0 ||
              (saveMeta.error !== null && metaLookup.count === 0)) && (
              <FormErrorSummary
                title={saveMeta.error === null ? null : policyErrorMessage(saveMeta.error)}
                errors={metaLookup.other}
              />
            )}
            <TemplateMetaForm
              value={metaDraft}
              onChange={setMetaDraft}
              errors={metaLookup}
              options={options.data}
              kindEditable={false}
            />
          </div>
        )}
      </Dialog>

      <ConfirmActionDialog
        open={action === 'submit'}
        title={t('admin-policy.template.submitTitle')}
        scope={versionScope(pending)}
        consequence={t('admin-policy.template.submitConsequence')}
        confirmLabel={t('admin-policy.template.submit')}
        reason={{ label: t('admin-policy.common.noteForApprover'), required: false }}
        pending={submit.pending}
        error={withPolicyMessage(submit.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          pendingParams === null
            ? undefined
            : run(
                () =>
                  submit.mutate({
                    params: pendingParams,
                    body: reason === '' ? {} : { note: reason },
                  }),
                t('admin-policy.template.submitted'),
              )
        }
      />
      <ConfirmActionDialog
        open={action === 'approve'}
        title={t('admin-policy.template.approveTitle')}
        scope={versionScope(pending)}
        consequence={t('admin-policy.template.approveConsequence', {
          count: template.usage.length,
        })}
        confirmLabel={t('admin-policy.template.approve')}
        reason={{ label: t('admin-policy.common.approvalNote'), required: false }}
        pending={approve.pending}
        error={withPolicyMessage(approve.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          pendingParams === null
            ? undefined
            : run(
                () =>
                  approve.mutate({
                    params: pendingParams,
                    body: {
                      ...(effectiveFrom === null ? {} : { effectiveFrom }),
                      ...(reason === '' ? {} : { note: reason }),
                    },
                  }),
                t('admin-policy.template.approved'),
              )
        }
      >
        <DateTimeInput
          label={t('admin-policy.version.effectiveFromLabel')}
          hint={t('admin-policy.version.effectiveFromHint')}
          timeZone={timeZone}
          value={effectiveFrom}
          onChange={setEffectiveFrom}
        />
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={action === 'return'}
        title={t('admin-policy.template.returnTitle')}
        scope={versionScope(pending)}
        consequence={t('admin-policy.template.returnConsequence')}
        confirmLabel={t('admin-policy.template.return')}
        reason={{ label: t('admin-policy.common.reasonLabel'), required: true }}
        pending={giveBack.pending}
        error={withPolicyMessage(giveBack.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          pendingParams === null
            ? undefined
            : run(
                () => giveBack.mutate({ params: pendingParams, body: { reason } }),
                t('admin-policy.template.returned'),
              )
        }
      />
      <ConfirmActionDialog
        open={action === 'retire'}
        tone="danger"
        title={t('admin-policy.template.retireTitle')}
        scope={scope}
        consequence={t('admin-policy.template.retireConsequence', {
          count: template.usage.length,
        })}
        confirmLabel={t('admin-policy.template.retire')}
        reason={{ label: t('admin-policy.common.reasonLabel'), required: true }}
        pending={retire.pending}
        error={withPolicyMessage(retire.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          run(
            () => retire.mutate({ params: { templateId: template.id }, body: { reason } }),
            t('admin-policy.template.retiredToast'),
          )
        }
      />
    </>
  );
}

export default function TemplatePage() {
  const templateId = useIdParam('templateId');
  const [latest, setLatest] = useCommandResult<TemplateDetail>(templateId);
  const query = useApiQuery(getTemplate, templateId === null ? null : { params: { templateId } });
  return (
    <PolicyLayout>
      {templateId === null ? (
        <EmptyState title={t('admin-policy.common.notFound')} />
      ) : latest !== null ? (
        <TemplateView key={latest.focusVersion.id} template={latest} onUpdated={setLatest} />
      ) : (
        <QueryView query={query}>
          {(template) => <TemplateView template={template} onUpdated={setLatest} />}
        </QueryView>
      )}
    </PolicyLayout>
  );
}
