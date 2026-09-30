/**
 * BUY-32 — Supplier relationship record: the buyer-specific profile, this buyer's assessments (qualification
 * decisions), history, risks, contacts, restrictions and performance (contracts), plus the evidence the supplier
 * shared with THIS buyer and its legal-identity changes. Other buyers' private assessments are never shown (BR-45).
 * Actions: maintain the relationship and contacts, request qualification, flag a possible duplicate.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { suppliersEndpoints } from '@contracts/suppliers';
import type {
  IdentityChange,
  QualificationScope,
  Relationship,
  RelationshipContact,
  RelationshipRecord,
  SharedEvidenceRow,
} from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
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
  ErrorState,
  Icon,
  KpiCard,
  KpiGrid,
  MoneyText,
  OrDash,
  PageHeader,
  SkeletonBlock,
  StatusChip,
  Tabs,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { StatusSeparation } from '../../supplier-org/components/StatusSeparation';
import {
  CategoryChips,
  DocumentLink,
  FreshnessChip,
  LocationList,
} from '../../supplier-org/components/SupplierBits';
import { useIdParam, useOfficialTimeZone } from '../../supplier-org/lib/hooks';
import { ContactDialog, UpdateRelationshipDialog } from '../components/RelationshipDialogs';
import {
  FlagDuplicateDialog,
  RequestQualificationDialog,
} from '../components/SupplierActionDialogs';
import { directoryPaths } from '../lib/paths';

const TABS = [
  'overview',
  'relationship',
  'qualification',
  'evidence',
  'identity',
  'contracts',
  'duplicates',
  'history',
] as const;
type TabId = (typeof TABS)[number];

export default function SupplierRecordPage() {
  const supplierTenantId = useIdParam('supplierTenantId');
  const query = useApiQuery(
    suppliersEndpoints.getRelationshipRecord,
    supplierTenantId === null ? null : { params: { supplierTenantId } },
  );
  const back = { to: directoryPaths.directory, label: t('supplier-directory.record.back') };
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('supplier-directory.record.title')} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : supplierTenantId === null ? (
          <Banner tone="error" title={t('supplier-directory.record.notFound')} />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }
  return <RecordView key={query.data.supplierTenantId} record={query.data} back={back} />;
}

type DialogState =
  | { readonly kind: 'relationship' }
  | { readonly kind: 'contact'; readonly contact: RelationshipContact | null }
  | { readonly kind: 'qualify' }
  | { readonly kind: 'flag' }
  | null;

/** A tab count, hidden when zero. */
function countOf(value: number): number | undefined {
  return value > 0 ? value : undefined;
}

function qualificationSummary(scopes: readonly QualificationScope[]): string {
  if (scopes.length === 0) return tEnum('v_qualification_status.effective_status', 'not_assessed');
  return scopes
    .map((scope) => tEnum('v_qualification_status.effective_status', scope.effectiveStatus))
    .join(', ');
}

function RecordView({
  record,
  back,
}: {
  readonly record: RelationshipRecord;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const zone = useOfficialTimeZone();
  const toast = useToast();
  const canManage = usePermission('supplier.relationship.manage');
  const canFlag = usePermission('supplier.duplicates.review');
  const [search, setSearch] = useSearchParams();
  const requested = search.get('tab');
  const tab: TabId = (TABS as readonly string[]).includes(requested ?? '')
    ? (requested as TabId)
    : 'overview';
  const [relationship, setRelationship] = useState<Relationship | null>(record.relationship);
  const [contacts, setContacts] = useState<readonly RelationshipContact[]>(record.contacts);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const supplierRef = { supplierTenantId: record.supplierTenantId, legalName: record.legalName };

  const next = record.isProvisional
    ? t('supplier-directory.record.next.claim')
    : relationship === null
      ? t('supplier-directory.record.next.relationship')
      : record.qualification.every((scope) => scope.effectiveStatus === 'not_assessed')
        ? t('supplier-directory.record.next.qualify')
        : record.evidence.expiredCount > 0
          ? t('supplier-directory.record.next.expired')
          : record.evidence.expiringSoonCount > 0
            ? t('supplier-directory.record.next.expiring')
            : t('supplier-directory.record.next.none');

  const done = (message: string): void => {
    setDialog(null);
    setOutcome(message);
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={record.legalName}
        back={back}
        meta={
          <span className="tiq-inline">
            {relationship === null ? (
              <Chip tone="neutral">{t('supplier-directory.list.noRelationship')}</Chip>
            ) : (
              <StatusChip enum="buyer_supplier_relationships.status" value={relationship.status} />
            )}
            <StatusChip enum="tenants.verification_status" value={record.verificationStatus} />
            {record.isProvisional && (
              <Chip tone="info">{t('supplier-directory.list.provisional')}</Chip>
            )}
            <span>
              {t('supplier-directory.record.qualificationMeta', {
                value: qualificationSummary(record.qualification),
              })}
            </span>
            <span className="tiq-text-muted">
              {t('supplier-directory.record.nextLabel', { next })}
            </span>
          </span>
        }
        primaryAction={
          canManage ? (
            <Button
              variant="primary"
              icon="edit"
              onClick={() => setDialog({ kind: 'relationship' })}
            >
              {relationship === null
                ? t('supplier-directory.record.startRelationship')
                : t('supplier-directory.record.updateRelationship')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canManage && (
              <Button icon="clipboardCheck" onClick={() => setDialog({ kind: 'qualify' })}>
                {t('supplier-directory.list.requestQualification')}
              </Button>
            )}
            {canFlag && (
              <Button icon="flag" onClick={() => setDialog({ kind: 'flag' })}>
                {t('supplier-directory.list.flagDuplicate')}
              </Button>
            )}
          </>
        }
      />
      <Banner tone="info" title={t('supplier-directory.record.segregationTitle')}>
        <p>{record.segregationNotice}</p>
      </Banner>
      {outcome !== null && (
        <Banner
          tone="success"
          title={t('supplier-directory.list.doneTitle')}
          actions={
            <Button size="sm" onClick={() => setOutcome(null)}>
              {t('ui.action.dismiss')}
            </Button>
          }
        >
          <p>{outcome}</p>
        </Banner>
      )}
      <Tabs
        label={t('supplier-directory.record.tabs')}
        selected={tab}
        onSelect={(id) => setSearch({ tab: id }, { replace: true })}
        tabs={TABS.map((id) => ({
          id,
          label: t(`supplier-directory.record.tab.${id}`),
          count: countOf(
            id === 'evidence'
              ? record.sharedEvidence.length
              : id === 'identity'
                ? record.identityChanges.length
                : id === 'contracts'
                  ? record.contracts.length
                  : id === 'duplicates'
                    ? record.duplicateFlags.length
                    : 0,
          ),
        }))}
      >
        {tab === 'overview' && <OverviewTab record={record} />}
        {tab === 'relationship' && (
          <RelationshipTab
            relationship={relationship}
            contacts={contacts}
            canManage={canManage}
            zone={zone}
            onEditContact={(contact) => setDialog({ kind: 'contact', contact })}
          />
        )}
        {tab === 'qualification' && <QualificationTab record={record} />}
        {tab === 'evidence' && <EvidenceTab record={record} zone={zone} />}
        {tab === 'identity' && <IdentityTab record={record} zone={zone} />}
        {tab === 'contracts' && <ContractsTab record={record} />}
        {tab === 'duplicates' && <DuplicatesTab record={record} zone={zone} />}
        {tab === 'history' && (
          <Card title={t('supplier-directory.record.historyTitle')}>
            {record.history.length === 0 ? (
              <EmptyState compact title={t('supplier-directory.record.noHistory')} />
            ) : (
              <Timeline
                label={t('supplier-directory.record.historyTitle')}
                items={record.history.map((event) => ({
                  id: event.id,
                  title: event.summary,
                  meta: [
                    formatDateTime(event.at, zone),
                    event.actor?.fullName ?? t('supplier-directory.record.system'),
                    t(`supplier-directory.record.event.${event.eventType}`),
                  ].join(' · '),
                  tone:
                    event.eventType === 'status_changed' || event.eventType === 'risk_changed'
                      ? 'warning'
                      : 'neutral',
                }))}
              />
            )}
          </Card>
        )}
      </Tabs>

      {dialog?.kind === 'relationship' && (
        <UpdateRelationshipDialog
          supplierTenantId={record.supplierTenantId}
          supplierName={record.legalName}
          relationship={relationship}
          ownerOptions={record.ownerOptions}
          onClose={() => setDialog(null)}
          onDone={(result) => {
            setRelationship(result);
            done(t('supplier-directory.relationship.saved'));
            toast.show(t('supplier-directory.relationship.saved'), 'success');
          }}
        />
      )}
      {dialog?.kind === 'contact' && (
        <ContactDialog
          supplierTenantId={record.supplierTenantId}
          contact={dialog.contact}
          onClose={() => setDialog(null)}
          onDone={(saved) => {
            setContacts((current) => {
              const others = current
                .filter((row) => row.id !== saved.id)
                .map((row) => (saved.isPrimary ? { ...row, isPrimary: false } : row));
              return [...others, saved];
            });
            done(t('supplier-directory.contacts.saved', { name: saved.name }));
          }}
        />
      )}
      {dialog?.kind === 'qualify' && (
        <RequestQualificationDialog
          supplier={supplierRef}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === 'flag' && (
        <FlagDuplicateDialog supplier={supplierRef} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}

function ClaimInvitationCard({
  invitation,
}: {
  readonly invitation: NonNullable<RelationshipRecord['claimInvitation']>;
}) {
  const zone = useOfficialTimeZone();
  return (
    <Card
      title={t('supplier-directory.claim.title')}
      subtitle={t('supplier-directory.claim.hint')}
      actions={
        invitation.state === 'pending' ? (
          <ButtonLink to={invitation.claimPath} size="sm" icon="externalLink">
            {t('supplier-directory.claim.open')}
          </ButtonLink>
        ) : undefined
      }
    >
      <DetailList
        items={[
          {
            key: 'state',
            label: t('supplier-directory.claim.state'),
            value: (
              <Chip tone={invitation.state === 'pending' ? 'info' : 'warning'}>
                {t(`supplier-directory.claim.states.${invitation.state}`)}
              </Chip>
            ),
          },
          {
            key: 'contact',
            label: t('supplier-directory.claim.contact'),
            value: invitation.contactName,
          },
          { key: 'email', label: t('supplier-directory.claim.email'), value: invitation.email },
          {
            key: 'sent',
            label: t('supplier-directory.claim.sent'),
            value: t('supplier-directory.claim.sentValue', {
              at: formatDateTime(invitation.sentAt, zone),
              count: invitation.sentCount,
            }),
          },
          {
            key: 'expires',
            label: t('supplier-directory.claim.expires'),
            value: formatDateTime(invitation.expiresAt, zone),
          },
          {
            key: 'link',
            label: t('supplier-directory.claim.link'),
            value: <code>{invitation.claimPath}</code>,
          },
        ]}
      />
    </Card>
  );
}

function OverviewTab({ record }: { readonly record: RelationshipRecord }) {
  return (
    <div className="tiq-stack">
      {record.claimInvitation !== null && (
        <ClaimInvitationCard invitation={record.claimInvitation} />
      )}
      <StatusSeparation
        statuses={[
          {
            id: 'registration',
            label: t('supplier-org.statuses.registration'),
            value: <StatusChip enum="tenants.status" value={record.registrationStatus} />,
            explanation: record.isProvisional
              ? t('supplier-directory.record.provisionalHint')
              : t('supplier-org.statuses.registrationHint'),
          },
          {
            id: 'verification',
            label: t('supplier-org.statuses.verification'),
            value: (
              <StatusChip enum="tenants.verification_status" value={record.verificationStatus} />
            ),
            explanation: t('supplier-org.statuses.verificationHint'),
          },
          {
            id: 'qualification',
            label: t('supplier-directory.record.yourQualification'),
            value: qualificationSummary(record.qualification),
            explanation: t('supplier-directory.record.yourQualificationHint'),
          },
        ]}
      />
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('supplier-directory.record.identityCard')}>
          <DetailList
            items={[
              { key: 'legal', label: t('supplier-org.fields.legalName'), value: record.legalName },
              {
                key: 'trading',
                label: t('supplier-org.fields.tradingNames'),
                value: record.tradingNames.join(', '),
              },
              {
                key: 'registration',
                label: t('supplier-org.fields.registrationNumber'),
                value: record.registrationNumber,
              },
              {
                key: 'jurisdiction',
                label: t('supplier-org.fields.jurisdiction'),
                value: record.registrationJurisdiction,
              },
              { key: 'country', label: t('supplier-org.fields.country'), value: record.country },
              {
                key: 'created',
                label: t('supplier-directory.record.createdByYou'),
                value: record.createdByThisBuyer
                  ? t('supplier-directory.record.yes')
                  : t('supplier-directory.record.no'),
              },
            ]}
          />
        </Card>
        <Card title={t('supplier-directory.record.businessCard')}>
          <DetailList
            items={[
              { key: 'website', label: t('supplier-org.fields.website'), value: record.website },
              {
                key: 'description',
                label: t('supplier-org.fields.description'),
                value: record.description,
              },
              {
                key: 'year',
                label: t('supplier-org.fields.yearEstablished'),
                value: record.yearEstablished,
              },
              {
                key: 'ownership',
                label: t('supplier-org.fields.ownership'),
                value: record.ownershipDisclosure,
              },
              {
                key: 'parent',
                label: t('supplier-org.fields.ultimateParent'),
                value: record.ultimateParentName,
              },
              {
                key: 'areas',
                label: t('supplier-org.fields.serviceAreas'),
                value: record.serviceAreas.join(', '),
              },
            ]}
          />
        </Card>
      </div>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('supplier-org.fields.categories')}>
          <CategoryChips categories={record.categories} />
        </Card>
        <Card title={t('supplier-org.profile.locationsCard')}>
          <LocationList locations={record.locations} />
        </Card>
      </div>
    </div>
  );
}

function RelationshipTab({
  relationship,
  contacts,
  canManage,
  zone,
  onEditContact,
}: {
  readonly relationship: Relationship | null;
  readonly contacts: readonly RelationshipContact[];
  readonly canManage: boolean;
  readonly zone: string;
  readonly onEditContact: (contact: RelationshipContact | null) => void;
}) {
  const columns: DataTableColumn<RelationshipContact>[] = [
    {
      id: 'name',
      header: t('supplier-directory.contacts.name'),
      cell: (row) => (
        <>
          <span className="tiq-inline">
            {row.name}
            {row.isPrimary && (
              <Chip tone="accent" size="sm">
                {t('supplier-directory.contacts.primaryChip')}
              </Chip>
            )}
          </span>
          <span className="tiq-cell-sub">{row.roleLabel}</span>
        </>
      ),
    },
    {
      id: 'email',
      header: t('supplier-directory.contacts.email'),
      cell: (row) => row.email ?? <OrDash>{null}</OrDash>,
    },
    {
      id: 'phone',
      header: t('supplier-directory.contacts.phone'),
      cell: (row) => row.phone ?? <OrDash>{null}</OrDash>,
    },
    {
      id: 'active',
      header: t('supplier-directory.contacts.state'),
      cell: (row) =>
        row.active ? (
          <Chip tone="success" size="sm">
            {t('supplier-directory.contacts.activeChip')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('supplier-directory.contacts.inactiveChip')}
          </Chip>
        ),
    },
    {
      id: 'actions',
      header: t('supplier-directory.list.col.actions'),
      cell: (row) =>
        canManage ? (
          <Button size="sm" icon="edit" onClick={() => onEditContact(row)}>
            {t('supplier-directory.contacts.edit')}
          </Button>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];
  return (
    <div className="tiq-stack">
      <Card
        title={t('supplier-directory.relationship.cardTitle')}
        subtitle={t('supplier-directory.relationship.cardHint')}
      >
        {relationship === null ? (
          <EmptyState
            compact
            title={t('supplier-directory.relationship.none')}
            description={t('supplier-directory.relationship.noneHint')}
          />
        ) : (
          <DetailList
            items={[
              {
                key: 'status',
                label: t('supplier-directory.relationship.status'),
                value: (
                  <StatusChip
                    enum="buyer_supplier_relationships.status"
                    value={relationship.status}
                  />
                ),
              },
              {
                key: 'risk',
                label: t('supplier-directory.relationship.risk'),
                value: (
                  <StatusChip
                    enum="buyer_supplier_relationships.risk_rating"
                    value={relationship.riskRating}
                  />
                ),
              },
              {
                key: 'owner',
                label: t('supplier-directory.relationship.owner'),
                value: relationship.owner?.fullName ?? t('supplier-directory.list.unassigned'),
              },
              {
                key: 'restriction',
                label: t('supplier-directory.relationship.restriction'),
                value: relationship.restrictionNote,
              },
              {
                key: 'notes',
                label: t('supplier-directory.relationship.internalNotes'),
                value: relationship.internalNotes,
              },
              {
                key: 'engaged',
                label: t('supplier-directory.relationship.firstEngaged'),
                value:
                  relationship.firstEngagedAt === null
                    ? null
                    : formatDateTime(relationship.firstEngagedAt, zone),
              },
              {
                key: 'updated',
                label: t('supplier-directory.relationship.updated'),
                value: formatDateTime(relationship.updatedAt, zone),
              },
            ]}
          />
        )}
      </Card>
      <Card
        flush
        title={t('supplier-directory.contacts.title')}
        subtitle={t('supplier-directory.contacts.internal')}
        actions={
          canManage && relationship !== null ? (
            <Button size="sm" icon="plus" onClick={() => onEditContact(null)}>
              {t('supplier-directory.contacts.add')}
            </Button>
          ) : undefined
        }
      >
        <DataTable
          caption={t('supplier-directory.contacts.title')}
          columns={columns}
          rows={contacts}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('supplier-directory.contacts.empty')} />}
        />
      </Card>
    </div>
  );
}

function QualificationTab({ record }: { readonly record: RelationshipRecord }) {
  const columns: DataTableColumn<QualificationScope>[] = [
    {
      id: 'program',
      header: t('supplier-directory.qualification.program'),
      cell: (row) => row.programName,
    },
    {
      id: 'status',
      header: t('supplier-directory.qualification.status'),
      cell: (row) => (
        <StatusChip enum="v_qualification_status.effective_status" value={row.effectiveStatus} />
      ),
    },
    {
      id: 'scope',
      header: t('supplier-directory.qualification.scope'),
      cell: (row) =>
        row.effectiveStatus === 'not_assessed' ? (
          <span className="tiq-text-muted">{t('supplier-directory.qualification.noDecision')}</span>
        ) : (
          <>
            <span>
              {row.scopeCategory?.name ?? t('supplier-directory.qualification.anyCategory')}
            </span>
            {row.scopeGeography !== null && (
              <span className="tiq-cell-sub">{row.scopeGeography}</span>
            )}
          </>
        ),
    },
    {
      id: 'max',
      header: t('supplier-directory.qualification.maxValue'),
      numeric: true,
      cell: (row) =>
        row.scopeMaxValue === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <MoneyText value={row.scopeMaxValue} />
        ),
    },
    {
      id: 'validity',
      header: t('supplier-directory.qualification.validity'),
      cell: (row) =>
        row.effectiveFrom === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          t('supplier-org.evidence.range', {
            from: formatCalendarDate(row.effectiveFrom),
            to: row.effectiveTo === null ? '—' : formatCalendarDate(row.effectiveTo),
          })
        ),
    },
    {
      id: 'conditions',
      header: t('supplier-directory.qualification.conditions'),
      cell: (row) =>
        row.conditions === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-cell-sub">{row.conditions}</span>
        ),
    },
  ];
  return (
    <div className="tiq-stack">
      <Banner tone="info" title={t('supplier-org.statuses.notQualificationTitle')}>
        <p>{t('supplier-directory.qualification.note')}</p>
      </Banner>
      <Card flush title={t('supplier-directory.qualification.title')}>
        <DataTable
          caption={t('supplier-directory.qualification.title')}
          columns={columns}
          rows={record.qualification}
          rowKey={(row) => String(row.programId)}
          empty={
            <EmptyState
              compact
              title={t('supplier-directory.qualification.empty')}
              description={t('supplier-directory.qualification.emptyHint')}
            />
          }
        />
      </Card>
      <Card title={t('supplier-directory.qualification.programsTitle')}>
        {record.requestablePrograms.length === 0 ? (
          <EmptyState compact title={t('supplier-directory.qualification.noPrograms')} />
        ) : (
          <ul className="tiq-stack">
            {record.requestablePrograms.map((program) => (
              <li key={program.programId}>
                {program.name}
                {program.category !== null && (
                  <span className="tiq-text-muted"> · {program.category.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function EvidenceTab({
  record,
  zone,
}: {
  readonly record: RelationshipRecord;
  readonly zone: string;
}) {
  const columns: DataTableColumn<SharedEvidenceRow>[] = [
    {
      id: 'title',
      header: t('supplier-org.evidence.col.title'),
      cell: (row) =>
        row.restricted ? (
          <span className="tiq-inline">
            <Icon name="lock" />
            <span>{row.title}</span>
          </span>
        ) : (
          <>
            <span>{row.title}</span>
            <span className="tiq-cell-sub">
              {[row.issuer, row.referenceNumber].filter((part) => part !== null).join(' · ')}
            </span>
          </>
        ),
    },
    {
      id: 'type',
      header: t('supplier-org.evidence.col.type'),
      cell: (row) => tEnum('evidence_items.evidence_type', row.evidenceType),
    },
    {
      id: 'period',
      header: t('supplier-org.evidence.col.period'),
      cell: (row) =>
        row.periodStart !== null && row.periodEnd !== null ? (
          t('supplier-org.evidence.range', {
            from: formatCalendarDate(row.periodStart),
            to: formatCalendarDate(row.periodEnd),
          })
        ) : row.coverage !== null ? (
          <MoneyText value={row.coverage} />
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
    {
      id: 'expiry',
      header: t('supplier-org.evidence.col.expires'),
      cell: (row) => (
        <span className="tiq-stack">
          <span>
            {row.expiresAt === null
              ? t('supplier-org.evidence.noExpiry')
              : formatCalendarDate(row.expiresAt)}
          </span>
          <FreshnessChip value={row.freshness} size="sm" />
        </span>
      ),
    },
    {
      id: 'verification',
      header: t('supplier-org.evidenceDetail.verification'),
      cell: (row) => (
        <StatusChip
          enum="evidence_items.verification_status"
          value={row.verificationStatus}
          size="sm"
        />
      ),
    },
    {
      id: 'document',
      header: t('supplier-org.evidenceDetail.col.document'),
      cell: (row) =>
        row.restricted ? (
          <span className="tiq-text-muted">{t('supplier-directory.evidence.restricted')}</span>
        ) : (
          <DocumentLink document={row.document} />
        ),
    },
    {
      id: 'shared',
      header: t('supplier-org.evidenceDetail.col.shared'),
      cell: (row) => formatDateTime(row.sharedAt, zone),
    },
  ];
  const restricted = record.sharedEvidence.some((row) => row.restricted);
  return (
    <div className="tiq-stack">
      <KpiGrid>
        <KpiCard
          label={t('supplier-directory.evidence.shared')}
          icon="folder"
          value={formatCount(record.evidence.sharedCount)}
        />
        <KpiCard
          label={t('supplier-directory.evidence.expiring')}
          icon="hourglass"
          tone="warning"
          value={formatCount(record.evidence.expiringSoonCount)}
        />
        <KpiCard
          label={t('supplier-directory.evidence.expiredCount')}
          icon="alertTriangle"
          tone="danger"
          value={formatCount(record.evidence.expiredCount)}
        />
        <KpiCard
          label={t('supplier-directory.evidence.nextExpiry')}
          icon="calendar"
          tone="info"
          value={
            record.evidence.nextExpiry === null
              ? t('supplier-org.evidence.noExpiry')
              : formatCalendarDate(record.evidence.nextExpiry)
          }
        />
      </KpiGrid>
      {restricted && (
        <Banner tone="info" title={t('supplier-directory.evidence.restrictedTitle')}>
          <p>{t('supplier-directory.evidence.restrictedText')}</p>
        </Banner>
      )}
      <Card
        flush
        title={t('supplier-directory.evidence.title')}
        subtitle={t('supplier-directory.evidence.hint')}
      >
        <DataTable
          caption={t('supplier-directory.evidence.title')}
          columns={columns}
          rows={record.sharedEvidence}
          rowKey={(row) => String(row.evidenceItemId)}
          empty={<EmptyState compact title={t('supplier-directory.evidence.empty')} />}
        />
      </Card>
    </div>
  );
}

function IdentityTab({
  record,
  zone,
}: {
  readonly record: RelationshipRecord;
  readonly zone: string;
}) {
  const columns: DataTableColumn<IdentityChange>[] = [
    {
      id: 'type',
      header: t('supplier-org.identity.col.type'),
      cell: (row) => tEnum('supplier_identity_changes.change_type', row.changeType),
    },
    {
      id: 'values',
      header: t('supplier-org.identity.col.values'),
      cell: (row) => (
        <>
          <span>{row.proposedValue}</span>
          <span className="tiq-cell-sub">
            {t('supplier-org.identity.previous', { value: row.previousValue ?? '—' })}
          </span>
        </>
      ),
    },
    {
      id: 'reason',
      header: t('supplier-org.change.reason'),
      cell: (row) => <span className="tiq-cell-sub">{row.reason}</span>,
    },
    {
      id: 'status',
      header: t('supplier-org.identity.col.status'),
      cell: (row) => <StatusChip enum="supplier_identity_changes.status" value={row.status} />,
    },
    {
      id: 'submitted',
      header: t('supplier-org.identity.col.submitted'),
      cell: (row) => formatDateTime(row.submittedAt, zone),
    },
    {
      id: 'effective',
      header: t('supplier-org.identity.col.effective'),
      cell: (row) =>
        row.effectiveAt === null ? <OrDash>{null}</OrDash> : formatDateTime(row.effectiveAt, zone),
    },
    {
      id: 'evidence',
      header: t('supplier-org.change.evidenceTitle'),
      cell: (row) => <DocumentLink document={row.evidenceDocument} />,
    },
  ];
  return (
    <div className="tiq-stack">
      <Card
        title={t('supplier-org.identity.historyTitle')}
        subtitle={t('supplier-directory.identity.hint')}
      >
        <DetailList
          items={record.legalNameHistory.map((entry) => ({
            key: `${entry.legalName}-${entry.validFrom}`,
            label: entry.legalName,
            value:
              entry.validTo === null
                ? t('supplier-org.identity.since', { from: formatCalendarDate(entry.validFrom) })
                : t('supplier-org.identity.between', {
                    from: formatCalendarDate(entry.validFrom),
                    to: formatCalendarDate(entry.validTo),
                  }),
          }))}
        />
      </Card>
      <Card
        flush
        title={t('supplier-directory.identity.title')}
        subtitle={t('supplier-directory.identity.review')}
      >
        <DataTable
          caption={t('supplier-directory.identity.title')}
          columns={columns}
          rows={record.identityChanges}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('supplier-org.identity.empty')} />}
        />
      </Card>
    </div>
  );
}

function ContractsTab({ record }: { readonly record: RelationshipRecord }) {
  type Row = RelationshipRecord['contracts'][number];
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'reference',
      header: t('supplier-directory.contracts.reference'),
      cell: (row) => (
        <Link to={directoryPaths.contract(row.contractId)} className="tiq-ref">
          {row.reference}
        </Link>
      ),
    },
    { id: 'title', header: t('supplier-directory.contracts.titleCol'), cell: (row) => row.title },
    {
      id: 'status',
      header: t('supplier-directory.contracts.status'),
      cell: (row) => <StatusChip enum="contracts.status" value={row.status} />,
    },
    {
      id: 'performance',
      header: t('supplier-directory.contracts.performance'),
      cell: (row) => <PerformanceCell performance={row.performance} />,
    },
  ];
  const reviewed = record.contracts.filter((row) => row.performance !== null);
  const disputed = reviewed.filter((row) => row.performance?.supplierDisputes === true);
  return (
    <Card
      flush
      title={t('supplier-directory.contracts.title')}
      subtitle={t('supplier-directory.contracts.hint')}
      actions={
        record.contracts.length === 0 ? undefined : (
          <span className="tiq-inline">
            <Chip tone="neutral">
              {t('supplier-directory.contracts.reviewedCount', {
                count: reviewed.length,
                total: record.contracts.length,
              })}
            </Chip>
            {disputed.length > 0 && (
              <Chip tone="warning" icon="alertTriangle">
                {t('supplier-directory.contracts.disputedCount', { count: disputed.length })}
              </Chip>
            )}
          </span>
        )
      }
    >
      <DataTable
        caption={t('supplier-directory.contracts.title')}
        columns={columns}
        rows={record.contracts}
        rowKey={(row) => String(row.contractId)}
        empty={<EmptyState compact title={t('supplier-directory.contracts.empty')} />}
      />
    </Card>
  );
}

function PerformanceCell({
  performance,
}: {
  readonly performance: RelationshipRecord['contracts'][number]['performance'];
}) {
  if (performance === null) {
    return <span className="tiq-text-muted">{t('supplier-directory.contracts.noReview')}</span>;
  }
  return (
    <span className="tiq-stack">
      <span className="tiq-inline">
        <StatusChip
          enum="performance_reviews.overall_rating"
          value={performance.overallRating}
          size="sm"
        />
        {performance.supplierDisputes ? (
          <Chip tone="warning" size="sm" icon="alertTriangle">
            {t('supplier-directory.contracts.disputed')}
          </Chip>
        ) : (
          <StatusChip enum="performance_reviews.status" value={performance.status} size="sm" />
        )}
      </span>
      <span className="tiq-cell-sub">
        {t('supplier-directory.contracts.period', {
          from: formatCalendarDate(performance.periodStart),
          to: formatCalendarDate(performance.periodEnd),
          count: performance.reviewCount,
        })}
      </span>
    </span>
  );
}

function DuplicatesTab({
  record,
  zone,
}: {
  readonly record: RelationshipRecord;
  readonly zone: string;
}) {
  type Row = RelationshipRecord['duplicateFlags'][number];
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'other',
      header: t('supplier-directory.duplicates.other'),
      cell: (row) => (
        <Link to={directoryPaths.record(row.otherSupplier.supplierTenantId)}>
          {row.otherSupplier.legalName}
        </Link>
      ),
    },
    {
      id: 'reason',
      header: t('supplier-directory.duplicates.reason'),
      cell: (row) => tEnum('duplicate_candidates.detected_reason', row.detectedReason),
    },
    {
      id: 'status',
      header: t('supplier-directory.duplicates.status'),
      cell: (row) => <StatusChip enum="duplicate_candidates.status" value={row.status} />,
    },
    {
      id: 'note',
      header: t('supplier-directory.duplicates.note'),
      cell: (row) => row.note ?? <OrDash>{null}</OrDash>,
    },
    {
      id: 'created',
      header: t('supplier-directory.duplicates.created'),
      cell: (row) => formatDateTime(row.createdAt, zone),
    },
  ];
  return (
    <Card
      flush
      title={t('supplier-directory.duplicates.title')}
      subtitle={t('supplier-directory.duplicates.hint')}
    >
      <DataTable
        caption={t('supplier-directory.duplicates.title')}
        columns={columns}
        rows={record.duplicateFlags}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState compact title={t('supplier-directory.duplicates.empty')} />}
      />
    </Card>
  );
}
