/**
 * SUP-14 — Declarations, qualifications and exceptions: authority, eligibility declarations, subcontractors, key
 * personnel, consortium, conflicts, tender-specific evidence (attached as immutable snapshots), contract exceptions
 * and current addenda. Supplier statements are clearly distinguished from the buyer's verification.
 */
import { useState } from 'react';

import {
  attachEvidence,
  detachEvidence,
  getDeclarations,
  saveConsortium,
  saveDeclarations,
  saveExceptions,
  saveKeyPersonnel,
  saveSubcontractors,
} from '@contracts/bids';
import type {
  BidDeclaration,
  BidDeclarations,
  BidDetail,
  BidEvidence,
  SaveDeclarationsResult,
} from '@contracts/bids';
import { add, isDecimal } from '@contracts/decimal';
import type { BidDeclarationsDeclarationType } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  RadioGroup,
  Select,
  SkeletonBlock,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ResponseWorkspace } from '../components/ResponseWorkspace';
import { RowsEditor } from '../components/RowsEditor';
import type { RowValues } from '../components/RowsEditor';
import { AddendaCard } from '../components/WorkspaceCards';
import { responseErrorMessage } from '../lib/errors';

type Refresh = (result: SaveDeclarationsResult) => void;

const text = (value: string | boolean | undefined): string =>
  typeof value === 'string' ? value.trim() : '';
const optional = (value: string | boolean | undefined): string | null => {
  const trimmed = text(value);
  return trimmed === '' ? null : trimmed;
};

// ---------------------------------------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------------------------------------

interface DeclarationDraft {
  readonly accepted: '' | 'yes' | 'no';
  readonly explanation: string;
}

function DeclarationsForm({
  bid,
  pack,
  canEdit,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly pack: BidDeclarations;
  readonly canEdit: boolean;
  readonly onSaved: Refresh;
}) {
  const toast = useToast();
  const initial: Record<string, DeclarationDraft> = {};
  for (const declaration of pack.declarations) {
    initial[declaration.declarationType] = {
      accepted: declaration.accepted === null ? '' : declaration.accepted ? 'yes' : 'no',
      explanation: declaration.explanation ?? '',
    };
  }
  const [draft, setDraft] = useState<Record<string, DeclarationDraft>>(initial);
  const save = useApiMutation(saveDeclarations);
  const errors = formErrors(save.error, ['declarations']);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const missingExplanation = pack.declarations.some(
    (declaration) =>
      draft[declaration.declarationType]?.accepted === 'no' &&
      (draft[declaration.declarationType]?.explanation.trim() ?? '') === '',
  );

  const set = (type: string, values: Partial<DeclarationDraft>): void =>
    setDraft((current) => ({
      ...current,
      [type]: { ...(current[type] ?? { accepted: '', explanation: '' }), ...values },
    }));

  const submit = async (): Promise<void> => {
    const declarations = pack.declarations.flatMap((declaration) => {
      const value = draft[declaration.declarationType];
      if (value === undefined || value.accepted === '') return [];
      return [
        {
          declarationType: declaration.declarationType,
          accepted: value.accepted === 'yes',
          explanation: value.explanation.trim() === '' ? null : value.explanation.trim(),
        },
      ];
    });
    if (declarations.length === 0) return;
    try {
      const result = await save.mutate({
        params: { bidId: bid.id },
        body: { revisionId: pack.revisionId, declarations },
      });
      toast.show(t('responses.declarations.saved'), 'success');
      onSaved(result);
    } catch {
      // Shown below.
    }
  };

  const errorFor = (index: number): string | undefined =>
    errors.forField(`declarations.${index}.explanation`) ??
    errors.forField(`declarations.${index}.accepted`);

  const answered = pack.declarations.filter(
    (declaration) => (draft[declaration.declarationType]?.accepted ?? '') !== '',
  );

  return (
    <Card title={t('responses.declarations.title')} subtitle={t('responses.declarations.subtitle')}>
      <UnsavedChangesGuard when={dirty} />
      <div className="tiq-stack">
        {pack.declarations.map((declaration: BidDeclaration) => {
          const value = draft[declaration.declarationType] ?? { accepted: '', explanation: '' };
          const position = answered.findIndex(
            (row) => row.declarationType === declaration.declarationType,
          );
          return (
            <fieldset
              key={declaration.declarationType}
              className="tiq-fieldset"
              disabled={!canEdit}
            >
              <legend>
                {tEnum('bid_declarations.declaration_type', declaration.declarationType)}
                {declaration.required && (
                  <span className="tiq-required" aria-hidden="true">
                    *
                  </span>
                )}
              </legend>
              <p className="tiq-text-muted">
                {t(`responses.declarations.text.${declaration.declarationType}`, {
                  party: pack.legalParty.legalName,
                  days: pack.bidValidityDays,
                })}
              </p>
              <RadioGroup
                label={t('responses.declarations.statement')}
                inline
                required={declaration.required}
                value={value.accepted}
                options={[
                  { value: 'yes', label: t('responses.declarations.confirm') },
                  { value: 'no', label: t('responses.declarations.cannotConfirm') },
                ]}
                onChange={(accepted) =>
                  set(declaration.declarationType, {
                    accepted: accepted as DeclarationDraft['accepted'],
                  })
                }
              />
              {value.accepted === 'no' && (
                <TextArea
                  label={t('responses.declarations.explanation')}
                  required
                  rows={2}
                  value={value.explanation}
                  onChange={(explanation) => set(declaration.declarationType, { explanation })}
                  error={
                    (position < 0 ? undefined : errorFor(position)) ??
                    (value.explanation.trim() === ''
                      ? t('responses.declarations.explanationRequired')
                      : undefined)
                  }
                />
              )}
              <p className="tiq-text-muted">
                {declaration.declaredBy === null || declaration.declaredAt === null
                  ? t('responses.declarations.notDeclared')
                  : t('responses.declarations.declaredBy', {
                      name: declaration.declaredBy.fullName,
                      time: formatDateTime(declaration.declaredAt, bid.officialTimeZone),
                    })}
              </p>
            </fieldset>
          );
        })}
      </div>
      {canEdit && (
        <div className="tiq-inline tiq-stack--spaced">
          <Button
            variant="primary"
            size="sm"
            loading={save.pending}
            disabled={!dirty || missingExplanation || answered.length === 0}
            onClick={() => void submit()}
          >
            {t('responses.declarations.save')}
          </Button>
          <Button size="sm" disabled={!dirty || save.pending} onClick={() => setDraft(initial)}>
            {t('responses.answer.discard')}
          </Button>
        </div>
      )}
      {save.error !== null && (
        <FormErrorSummary title={responseErrorMessage(save.error)} errors={errors.other} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------------------------------------

function EvidenceCard({
  bid,
  pack,
  canEdit,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly pack: BidDeclarations;
  readonly canEdit: boolean;
  readonly onSaved: Refresh;
}) {
  const toast = useToast();
  const [choice, setChoice] = useState('');
  const attach = useApiMutation(attachEvidence);
  const detach = useApiMutation(detachEvidence);
  const failure = attach.error ?? detach.error;
  const options = pack.evidenceOptions.filter((option) => !option.attached);
  const timeZone = bid.officialTimeZone;

  const doAttach = async (): Promise<void> => {
    try {
      const result = await attach.mutate({
        params: { bidId: bid.id },
        body: { revisionId: pack.revisionId, evidenceItemId: Number(choice) },
      });
      setChoice('');
      toast.show(t('responses.evidence.attached'), 'success');
      onSaved(result);
    } catch {
      // Shown below.
    }
  };

  const doDetach = async (row: BidEvidence): Promise<void> => {
    try {
      const result = await detach.mutate({
        params: { bidId: bid.id, evidenceItemId: row.evidenceItemId },
        query: { revisionId: pack.revisionId },
      });
      toast.show(t('responses.evidence.removed'), 'success');
      onSaved(result);
    } catch {
      // Shown below.
    }
  };

  const columns: DataTableColumn<BidEvidence>[] = [
    {
      id: 'title',
      header: t('responses.evidence.col.title'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('evidence_items.evidence_type', row.evidenceType)}
            {row.issuer === null ? '' : ` · ${row.issuer}`}
          </span>
        </>
      ),
    },
    {
      id: 'edition',
      header: t('responses.evidence.col.edition'),
      cell: (row) => (
        <>
          <span>{row.fileName}</span>
          <span className="tiq-cell-sub">
            {t('responses.evidence.version', { no: row.versionNo })} ·{' '}
            {t('responses.evidence.snapshot', {
              time: formatDateTime(row.attachedAt, timeZone),
              name: row.attachedBy.fullName,
            })}
          </span>
        </>
      ),
    },
    {
      id: 'validity',
      header: t('responses.evidence.col.validity'),
      cell: (row) => (
        <>
          <span>
            {row.expiresAt === null
              ? t('responses.evidence.noExpiry')
              : t('responses.evidence.expires', {
                  date: formatInstantDate(row.expiresAt, timeZone),
                })}
          </span>
          {row.expiresDuringValidity && (
            <span className="tiq-cell-sub tiq-text-warning">
              {t('responses.evidence.expiresDuringValidity')}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('responses.evidence.col.statement'),
      cell: (row) => <StatusChip enum="evidence_items.status" value={row.status} size="sm" />,
    },
    {
      id: 'verification',
      header: t('responses.evidence.col.verification'),
      cell: (row) => (
        <StatusChip
          enum="evidence_items.verification_status"
          value={row.verificationStatus}
          size="sm"
        />
      ),
    },
    {
      id: 'actions',
      header: t('responses.common.actions'),
      cell: (row) =>
        canEdit ? (
          <Button
            size="sm"
            variant="danger-soft"
            icon="trash"
            disabled={detach.pending}
            onClick={() => void doDetach(row)}
            aria-label={t('responses.evidence.removeLabel', { title: row.title })}
          >
            {t('responses.attachments.remove')}
          </Button>
        ) : null,
    },
  ];

  return (
    <Card title={t('responses.evidence.title')} subtitle={t('responses.evidence.subtitle')} flush>
      <DataTable
        caption={t('responses.evidence.title')}
        columns={columns}
        rows={pack.evidence}
        rowKey={(row) => String(row.evidenceItemId)}
        empty={<EmptyState compact title={t('responses.evidence.empty')} />}
      />
      {canEdit && (
        <div className="tiq-inline tiq-stack--spaced">
          <Select
            label={t('responses.evidence.attachLabel')}
            placeholder={t('responses.attachments.chooseEvidence')}
            value={choice}
            options={options.map((option) => ({
              value: String(option.evidenceItemId),
              label: `${option.title} (${tEnum('evidence_items.status', option.status)})`,
              disabled: option.status === 'expired' || option.status === 'replaced',
            }))}
            onChange={setChoice}
            hint={t('responses.attachments.snapshotHint')}
          />
          <Button
            size="sm"
            icon="link"
            disabled={choice === ''}
            loading={attach.pending}
            onClick={() => void doAttach()}
          >
            {t('responses.attachments.attachEvidence')}
          </Button>
        </div>
      )}
      {failure !== null && (
        <Banner tone="error" title={t('responses.evidence.failed')}>
          <p>{responseErrorMessage(failure)}</p>
        </Banner>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Parties and exceptions
// ---------------------------------------------------------------------------------------------------------

function SubcontractorsEditor({
  bid,
  pack,
  canEdit,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly pack: BidDeclarations;
  readonly canEdit: boolean;
  readonly onSaved: Refresh;
}) {
  const toast = useToast();
  const save = useApiMutation(saveSubcontractors);
  return (
    <RowsEditor
      title={t('responses.subcontractors.title')}
      subtitle={t('responses.subcontractors.subtitle')}
      prefix="subcontractors"
      rowNoun={t('responses.subcontractors.noun')}
      emptyTitle={t('responses.subcontractors.empty')}
      canEdit={canEdit}
      fields={[
        { key: 'name', label: t('responses.subcontractors.name'), kind: 'text', required: true },
        {
          key: 'scope',
          label: t('responses.subcontractors.scope'),
          kind: 'textarea',
          required: true,
        },
        {
          key: 'sharePercent',
          label: t('responses.subcontractors.share'),
          kind: 'decimal',
          required: true,
          suffix: '%',
        },
      ]}
      initialRows={pack.subcontractors.map((row) => ({
        name: row.name,
        scope: row.scope,
        sharePercent: row.sharePercent,
        evidence:
          row.qualificationEvidenceDocumentId === null
            ? ''
            : String(row.qualificationEvidenceDocumentId),
      }))}
      emptyRow={{ name: '', scope: '', sharePercent: '', evidence: '' }}
      validate={(rows) => {
        const shares = rows.map((row) => text(row.sharePercent)).filter(isDecimal);
        const total = shares.reduce((sum, share) => add(sum, share), '0');
        return Number(total) > 100 ? t('responses.subcontractors.shareTooHigh', { total }) : null;
      }}
      pending={save.pending}
      error={save.error}
      onSave={async (rows: readonly RowValues[]) => {
        const result = await save.mutate({
          params: { bidId: bid.id },
          body: {
            revisionId: pack.revisionId,
            subcontractors: rows.map((row) => ({
              name: text(row.name),
              scope: text(row.scope),
              sharePercent: text(row.sharePercent) === '' ? '0' : text(row.sharePercent),
              qualificationEvidenceDocumentId:
                text(row.evidence) === '' ? null : Number(text(row.evidence)),
            })),
          },
        });
        toast.show(t('responses.rows.saved'), 'success');
        onSaved(result);
      }}
    />
  );
}

function KeyPersonnelEditor({
  bid,
  pack,
  canEdit,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly pack: BidDeclarations;
  readonly canEdit: boolean;
  readonly onSaved: Refresh;
}) {
  const toast = useToast();
  const save = useApiMutation(saveKeyPersonnel);
  return (
    <RowsEditor
      title={t('responses.personnel.title')}
      subtitle={t('responses.personnel.subtitle')}
      prefix="keyPersonnel"
      rowNoun={t('responses.personnel.noun')}
      emptyTitle={t('responses.personnel.empty')}
      canEdit={canEdit}
      fields={[
        { key: 'name', label: t('responses.personnel.name'), kind: 'text', required: true },
        { key: 'role', label: t('responses.personnel.role'), kind: 'text', required: true },
        { key: 'qualifications', label: t('responses.personnel.qualifications'), kind: 'textarea' },
      ]}
      initialRows={pack.keyPersonnel.map((row) => ({
        name: row.name,
        role: row.role,
        qualifications: row.qualifications ?? '',
        cv: row.cvDocumentId === null ? '' : String(row.cvDocumentId),
      }))}
      emptyRow={{ name: '', role: '', qualifications: '', cv: '' }}
      pending={save.pending}
      error={save.error}
      onSave={async (rows) => {
        const result = await save.mutate({
          params: { bidId: bid.id },
          body: {
            revisionId: pack.revisionId,
            keyPersonnel: rows.map((row) => ({
              name: text(row.name),
              role: text(row.role),
              qualifications: optional(row.qualifications),
              cvDocumentId: text(row.cv) === '' ? null : Number(text(row.cv)),
            })),
          },
        });
        toast.show(t('responses.rows.saved'), 'success');
        onSaved(result);
      }}
    />
  );
}

function ConsortiumEditor({
  bid,
  pack,
  canEdit,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly pack: BidDeclarations;
  readonly canEdit: boolean;
  readonly onSaved: Refresh;
}) {
  const toast = useToast();
  const [isConsortium, setIsConsortium] = useState(pack.isConsortium);
  const save = useApiMutation(saveConsortium);
  return (
    <RowsEditor
      title={t('responses.consortium.title')}
      subtitle={
        pack.leadMemberName === null
          ? t('responses.consortium.subtitle')
          : t('responses.consortium.lead', { name: pack.leadMemberName })
      }
      prefix="members"
      rowNoun={t('responses.consortium.noun')}
      emptyTitle={
        isConsortium ? t('responses.consortium.emptyMembers') : t('responses.consortium.single')
      }
      canEdit={canEdit}
      header={
        <Checkbox
          label={t('responses.consortium.isConsortium')}
          hint={t('responses.consortium.isConsortiumHint')}
          checked={isConsortium}
          disabled={!canEdit}
          onChange={setIsConsortium}
        />
      }
      headerDirty={isConsortium !== pack.isConsortium}
      onDiscard={() => setIsConsortium(pack.isConsortium)}
      fields={[
        { key: 'memberName', label: t('responses.consortium.name'), kind: 'text', required: true },
        { key: 'isLead', label: t('responses.consortium.isLead'), kind: 'checkbox' },
        {
          key: 'responsibilities',
          label: t('responses.consortium.responsibilities'),
          kind: 'textarea',
        },
      ]}
      initialRows={pack.consortiumMembers.map((row) => ({
        memberName: row.memberName,
        isLead: row.isLead,
        responsibilities: row.responsibilities ?? '',
        memberTenantId: row.memberTenantId === null ? '' : String(row.memberTenantId),
        authority:
          row.authorityEvidenceDocumentId === null ? '' : String(row.authorityEvidenceDocumentId),
      }))}
      emptyRow={{
        memberName: '',
        isLead: false,
        responsibilities: '',
        memberTenantId: '',
        authority: '',
      }}
      validate={(rows) => {
        if (!isConsortium) {
          return rows.length > 0 ? t('responses.consortium.membersWithout') : null;
        }
        if (rows.length < 2) return t('responses.consortium.twoMembers');
        return rows.filter((row) => row.isLead === true).length === 1
          ? null
          : t('responses.consortium.oneLead');
      }}
      pending={save.pending}
      error={save.error}
      onSave={async (rows) => {
        const result = await save.mutate({
          params: { bidId: bid.id },
          body: {
            revisionId: pack.revisionId,
            isConsortium,
            members: rows.map((row) => ({
              memberName: text(row.memberName),
              isLead: row.isLead === true,
              responsibilities: optional(row.responsibilities),
              memberTenantId:
                text(row.memberTenantId) === '' ? null : Number(text(row.memberTenantId)),
              authorityEvidenceDocumentId:
                text(row.authority) === '' ? null : Number(text(row.authority)),
            })),
          },
        });
        toast.show(t('responses.rows.saved'), 'success');
        onSaved(result);
      }}
    />
  );
}

function ExceptionsEditor({
  bid,
  pack,
  canEdit,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly pack: BidDeclarations;
  readonly canEdit: boolean;
  readonly onSaved: Refresh;
}) {
  const toast = useToast();
  const save = useApiMutation(saveExceptions);
  return (
    <RowsEditor
      title={t('responses.exceptions.title')}
      subtitle={t('responses.exceptions.subtitle')}
      prefix="exceptions"
      rowNoun={t('responses.exceptions.noun')}
      emptyTitle={t('responses.exceptions.empty')}
      canEdit={canEdit}
      fields={[
        { key: 'clauseRef', label: t('responses.exceptions.clause'), kind: 'text', required: true },
        {
          key: 'proposedChange',
          label: t('responses.exceptions.change'),
          kind: 'textarea',
          required: true,
        },
        { key: 'rationale', label: t('responses.exceptions.rationale'), kind: 'textarea' },
      ]}
      initialRows={pack.exceptions.map((row) => ({
        clauseRef: row.clauseRef,
        proposedChange: row.proposedChange,
        rationale: row.rationale ?? '',
      }))}
      emptyRow={{ clauseRef: '', proposedChange: '', rationale: '' }}
      pending={save.pending}
      error={save.error}
      onSave={async (rows) => {
        const result = await save.mutate({
          params: { bidId: bid.id },
          body: {
            revisionId: pack.revisionId,
            exceptions: rows.map((row) => ({
              clauseRef: text(row.clauseRef),
              proposedChange: text(row.proposedChange),
              rationale: optional(row.rationale),
            })),
          },
        });
        toast.show(t('responses.rows.saved'), 'success');
        onSaved(result);
      }}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------------

function DeclarationsContent({ bid }: { readonly bid: BidDetail }) {
  const query = useApiQuery(getDeclarations, { params: { bidId: bid.id }, query: {} });
  const [latest, setLatest] = useState<SaveDeclarationsResult | null>(null);
  const pack = latest?.declarations ?? query.data;
  if (pack === undefined) {
    return query.error !== null ? (
      <ErrorState error={query.error} onRetry={query.reload} />
    ) : (
      <SkeletonBlock lines={8} />
    );
  }
  const canEdit = pack.editable && bid.viewer.canEditResponse;
  const version = latest?.contentHash ?? `${pack.revisionId}`;
  const required: BidDeclarationsDeclarationType[] = pack.declarations
    .filter((row) => row.required)
    .map((row) => row.declarationType);
  const confirmed = pack.declarations.filter((row) => row.accepted === true).length;

  return (
    <>
      <Banner tone="info" title={t('responses.declarations.statementsTitle')}>
        <p>{t('responses.declarations.statementsDetail')}</p>
      </Banner>
      {!canEdit && (
        <Banner tone="info" title={t('responses.answer.readOnlyTitle')}>
          <p>
            {pack.editable
              ? t('responses.answer.noEditPermission')
              : t('responses.answer.readOnlyRevision', { no: pack.revisionNo })}
          </p>
        </Banner>
      )}
      {latest !== null && latest.invalidatedApprovalIds.length > 0 && (
        <Banner
          tone="warning"
          title={t('responses.common.approvalsInvalidated', {
            count: latest.invalidatedApprovalIds.length,
          })}
        >
          <p>{t('responses.common.approvalsInvalidatedHint')}</p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <DeclarationsForm
            key={`declarations-${version}`}
            bid={bid}
            pack={pack}
            canEdit={canEdit}
            onSaved={setLatest}
          />
          <EvidenceCard bid={bid} pack={pack} canEdit={canEdit} onSaved={setLatest} />
          <SubcontractorsEditor
            key={`subcontractors-${version}`}
            bid={bid}
            pack={pack}
            canEdit={canEdit}
            onSaved={setLatest}
          />
          <KeyPersonnelEditor
            key={`personnel-${version}`}
            bid={bid}
            pack={pack}
            canEdit={canEdit}
            onSaved={setLatest}
          />
          <ConsortiumEditor
            key={`consortium-${version}`}
            bid={bid}
            pack={pack}
            canEdit={canEdit}
            onSaved={setLatest}
          />
          <ExceptionsEditor
            key={`exceptions-${version}`}
            bid={bid}
            pack={pack}
            canEdit={canEdit}
            onSaved={setLatest}
          />
        </div>
        <div className="tiq-stack">
          <Card title={t('responses.declarations.partyTitle')}>
            <DetailList
              stacked
              items={[
                { label: t('responses.declarations.legalParty'), value: pack.legalParty.legalName },
                {
                  label: t('responses.declarations.revision'),
                  value: (
                    <span className="tiq-inline">
                      {t('responses.common.revisionNo', { no: pack.revisionNo })}
                      <StatusChip
                        enum="bid_revisions.status"
                        value={pack.revisionStatus}
                        size="sm"
                      />
                    </span>
                  ),
                },
                {
                  label: t('responses.declarations.validity'),
                  value: t('responses.pricing.days', { count: pack.bidValidityDays }),
                },
                {
                  label: t('responses.declarations.confirmed'),
                  value: (
                    <span className="tiq-inline">
                      {t('responses.declarations.confirmedCount', {
                        confirmed,
                        total: pack.declarations.length,
                      })}
                      {required.length > 0 && (
                        <Chip tone="info" size="sm">
                          {t('responses.declarations.requiredCount', { count: required.length })}
                        </Chip>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
          <AddendaCard addenda={pack.addenda} timeZone={bid.officialTimeZone} />
        </div>
      </div>
    </>
  );
}

export default function DeclarationsPage() {
  return (
    <ResponseWorkspace tab="declarations" title={t('responses.declarations.pageTitle')}>
      {(bid) => <DeclarationsContent bid={bid} />}
    </ResponseWorkspace>
  );
}
