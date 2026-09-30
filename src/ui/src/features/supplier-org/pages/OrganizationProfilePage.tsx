/**
 * SUP-03 — Organization profile: legal and trading names, registrations, locations, categories, capacity overview,
 * ownership declarations and buyer-sharing choices, with the separate registration / verification / qualification
 * statuses (AC-07). Current information is maintained on the edit page; legal-identity changes are requested for
 * review and historical submissions keep their original representation. Supplier administrators also decide
 * membership requests here and resolve evidence the platform operator asked for before identity verification (SUP-02).
 */
import { useSearchParams } from 'react-router';

import { suppliersEndpoints } from '@contracts/suppliers';
import type { SupplierProfile } from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  OrDash,
  PageHeader,
  QueryView,
  StatusChip,
  Tabs,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { IdentityChangesPanel } from '../components/IdentityChangesPanel';
import { MembershipRequestsPanel } from '../components/MembershipRequestsPanel';
import { StatusSeparation } from '../components/StatusSeparation';
import { VerificationRequestsPanel } from '../components/VerificationRequestsPanel';
import { CategoryChips, LocationList } from '../components/SupplierBits';
import { languageName } from '../lib/organizationForm';
import { supplierOrgPaths } from '../lib/paths';
import { EVIDENCE_READ, PROFILE_MANAGE, USERS_MANAGE } from '../lib/permissions';

type TabId = 'profile' | 'identity' | 'sharing' | 'requests';

export default function OrganizationProfilePage() {
  const query = useApiQuery(suppliersEndpoints.getProfile, {});
  const canManage = usePermission(PROFILE_MANAGE);
  const canDecide = usePermission(USERS_MANAGE);
  const canSeeEvidence = usePermission(EVIDENCE_READ);
  const [search, setSearch] = useSearchParams();
  const requested = search.get('tab');
  const tabIds: TabId[] = [
    'profile',
    'identity',
    'sharing',
    ...(canDecide ? ['requests' as const] : []),
  ];
  const tab: TabId = tabIds.includes(requested as TabId) ? (requested as TabId) : 'profile';
  const profile = query.data;

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-org.profile.title')}
        subtitle={t('supplier-org.profile.intro')}
        meta={
          profile === undefined ? undefined : (
            <span className="tiq-inline">
              <strong>{profile.legalName}</strong>
              <StatusChip enum="tenants.status" value={profile.statuses.registration} />
              <StatusChip
                enum="tenants.verification_status"
                value={profile.statuses.verification}
              />
              {profile.pendingIdentityChangeCount > 0 && (
                <Chip tone="warning" icon="hourglass">
                  {t('supplier-org.profile.pendingChanges', {
                    count: profile.pendingIdentityChangeCount,
                  })}
                </Chip>
              )}
              <span className="tiq-text-muted">
                {t('supplier-org.profile.nextAction', { action: nextAction(profile) })}
              </span>
            </span>
          )
        }
        primaryAction={
          canManage ? (
            <ButtonLink to={supplierOrgPaths.editProfile} variant="primary" icon="edit">
              {t('supplier-org.profile.edit')}
            </ButtonLink>
          ) : undefined
        }
        actions={
          canManage ? (
            <ButtonLink to={supplierOrgPaths.newIdentityChange} icon="fileSignature">
              {t('supplier-org.profile.requestChange')}
            </ButtonLink>
          ) : undefined
        }
      />
      <QueryView query={query}>
        {(data) => (
          <>
            <StatusSeparation
              statuses={[
                {
                  id: 'registration',
                  label: t('supplier-org.statuses.registration'),
                  value: (
                    <span className="tiq-inline">
                      <StatusChip enum="tenants.status" value={data.statuses.registration} />
                      {data.statuses.isProvisional && (
                        <Chip tone="info">{t('supplier-org.statuses.provisional')}</Chip>
                      )}
                    </span>
                  ),
                  explanation: t('supplier-org.statuses.registrationHint'),
                },
                {
                  id: 'verification',
                  label: t('supplier-org.statuses.verification'),
                  value: (
                    <StatusChip
                      enum="tenants.verification_status"
                      value={data.statuses.verification}
                    />
                  ),
                  explanation: t('supplier-org.statuses.verificationHint'),
                },
                {
                  id: 'qualification',
                  label: t('supplier-org.statuses.qualification'),
                  value: t('supplier-org.statuses.qualificationSummary', {
                    qualified: data.statuses.qualification.qualifiedBuyerCount,
                    pending: data.statuses.qualification.pendingApplicationCount,
                  }),
                  explanation: data.statuses.qualification.note,
                },
              ]}
            />
            {(data.verificationRequests.length > 0 ||
              data.statuses.verification !== 'identity_verified') && (
              <VerificationRequestsPanel requests={data.verificationRequests} />
            )}
            <Tabs
              label={t('supplier-org.profile.tabs')}
              selected={tab}
              onSelect={(id) => setSearch({ tab: id }, { replace: true })}
              tabs={[
                { id: 'profile', label: t('supplier-org.profile.tab.profile') },
                {
                  id: 'identity',
                  label: t('supplier-org.profile.tab.identity'),
                  count:
                    data.pendingIdentityChangeCount > 0
                      ? data.pendingIdentityChangeCount
                      : undefined,
                },
                {
                  id: 'sharing',
                  label: t('supplier-org.profile.tab.sharing'),
                  count: data.buyerSharing.length,
                },
                ...(canDecide
                  ? [{ id: 'requests', label: t('supplier-org.profile.tab.requests') }]
                  : []),
              ]}
            >
              {tab === 'profile' && <ProfileDetails profile={data} />}
              {tab === 'identity' && <IdentityTab profile={data} />}
              {tab === 'sharing' && <SharingTab profile={data} canSeeEvidence={canSeeEvidence} />}
              {tab === 'requests' && canDecide && <MembershipRequestsPanel />}
            </Tabs>
          </>
        )}
      </QueryView>
    </div>
  );
}

function nextAction(profile: SupplierProfile): string {
  if (profile.verificationRequests.some((request) => request.status === 'open'))
    return t('supplier-org.profile.next.resolveEvidence');
  if (profile.statuses.verification === 'unverified')
    return t('supplier-org.profile.next.verifyContact');
  if (profile.statuses.verification === 'contact_verified')
    return t('supplier-org.profile.next.identity');
  if (profile.pendingIdentityChangeCount > 0) return t('supplier-org.profile.next.awaitReview');
  if (profile.statuses.qualification.qualifiedBuyerCount === 0)
    return t('supplier-org.profile.next.qualify');
  return t('supplier-org.profile.next.keepCurrent');
}

function ProfileDetails({ profile }: { readonly profile: SupplierProfile }) {
  const zone = profile.officialTimeZone;
  return (
    <div className="tiq-stack">
      <div className="tiq-grid tiq-grid--2">
        <Card
          title={t('supplier-org.profile.identityCard')}
          subtitle={t('supplier-org.profile.identityCardHint')}
        >
          <DetailList
            items={[
              { key: 'legal', label: t('supplier-org.fields.legalName'), value: profile.legalName },
              {
                key: 'trading',
                label: t('supplier-org.fields.tradingNames'),
                value: profile.tradingNames.join(', '),
              },
              {
                key: 'jurisdiction',
                label: t('supplier-org.fields.jurisdiction'),
                value: profile.registrationJurisdiction,
              },
              {
                key: 'number',
                label: t('supplier-org.fields.registrationNumber'),
                value: profile.registrationNumber,
              },
              {
                key: 'tax',
                label: t('supplier-org.fields.taxIdentifier'),
                value: profile.taxIdentifier,
              },
              {
                key: 'country',
                label: t('supplier-org.fields.country'),
                value: profile.country,
              },
              {
                key: 'currency',
                label: t('supplier-org.fields.currency'),
                value: profile.defaultCurrency,
              },
              {
                key: 'zone',
                label: t('supplier-org.fields.timeZone'),
                value: profile.officialTimeZone,
              },
            ]}
          />
        </Card>
        <Card title={t('supplier-org.profile.businessCard')}>
          <DetailList
            items={[
              {
                key: 'website',
                label: t('supplier-org.fields.website'),
                value: profile.website,
              },
              {
                key: 'description',
                label: t('supplier-org.fields.description'),
                value: profile.description,
              },
              {
                key: 'year',
                label: t('supplier-org.fields.yearEstablished'),
                value: profile.yearEstablished,
              },
              {
                key: 'employees',
                label: t('supplier-org.fields.employees'),
                value: profile.employeeCountBand,
              },
              {
                key: 'turnover',
                label: t('supplier-org.fields.turnover'),
                value: profile.annualTurnoverBand,
              },
              {
                key: 'contact',
                label: t('supplier-org.fields.primaryContact'),
                value: profile.primaryContact?.fullName ?? null,
              },
              {
                key: 'languages',
                label: t('supplier-org.fields.languages'),
                value: profile.preferredLanguages.map(languageName).join(', '),
              },
              {
                key: 'updated',
                label: t('supplier-org.profile.updatedAt'),
                value: formatDateTime(profile.updatedAt, zone),
              },
            ]}
          />
        </Card>
      </div>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('supplier-org.profile.capacityCard')}>
          <DetailList
            stacked
            items={[
              {
                key: 'capacity',
                label: t('supplier-org.fields.capacityOverview'),
                value: profile.capacityOverview,
              },
              {
                key: 'categories',
                label: t('supplier-org.fields.categories'),
                value: <CategoryChips categories={profile.categories} />,
              },
              {
                key: 'areas',
                label: t('supplier-org.fields.serviceAreas'),
                value: profile.serviceAreas.join(', '),
              },
            ]}
          />
        </Card>
        <Card
          title={t('supplier-org.profile.ownershipCard')}
          subtitle={t('supplier-org.profile.ownershipHint')}
        >
          <DetailList
            stacked
            items={[
              {
                key: 'ownership',
                label: t('supplier-org.fields.ownership'),
                value: profile.ownershipDisclosure,
              },
              {
                key: 'parent',
                label: t('supplier-org.fields.ultimateParent'),
                value: profile.ultimateParentName,
              },
            ]}
          />
        </Card>
      </div>
      <Card title={t('supplier-org.profile.locationsCard')}>
        <LocationList locations={profile.locations} />
      </Card>
      <Banner tone="info" title={t('supplier-org.banking.title')}>
        <p>{profile.bankingNotice}</p>
      </Banner>
    </div>
  );
}

function IdentityTab({ profile }: { readonly profile: SupplierProfile }) {
  return (
    <div className="tiq-stack">
      <Card
        title={t('supplier-org.identity.historyTitle')}
        subtitle={t('supplier-org.identity.historyHint')}
      >
        {profile.legalNameHistory.length === 0 ? (
          <EmptyState compact title={t('supplier-org.identity.noHistory')} />
        ) : (
          <DetailList
            items={profile.legalNameHistory.map((entry) => ({
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
        )}
      </Card>
      <IdentityChangesPanel />
    </div>
  );
}

function SharingTab({
  profile,
  canSeeEvidence,
}: {
  readonly profile: SupplierProfile;
  readonly canSeeEvidence: boolean;
}) {
  type Row = SupplierProfile['buyerSharing'][number];
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'buyer',
      header: t('supplier-org.sharing.col.buyer'),
      cell: (row) => row.buyer.tenantName,
    },
    {
      id: 'count',
      header: t('supplier-org.sharing.col.items'),
      numeric: true,
      cell: (row) => formatCount(row.sharedItemCount),
    },
    {
      id: 'kind',
      header: t('supplier-org.sharing.col.kind'),
      cell: (row) => tEnum('tenants.kind', row.buyer.tenantKind),
    },
  ];
  return (
    <div className="tiq-stack">
      <Banner tone="info" title={t('supplier-org.sharing.title')}>
        <p>{t('supplier-org.sharing.explanation')}</p>
      </Banner>
      <Card
        flush
        title={t('supplier-org.sharing.cardTitle')}
        actions={
          canSeeEvidence ? (
            <ButtonLink to={supplierOrgPaths.evidence} size="sm" icon="folder">
              {t('supplier-org.sharing.manage')}
            </ButtonLink>
          ) : undefined
        }
      >
        <DataTable
          caption={t('supplier-org.sharing.caption')}
          columns={columns}
          rows={profile.buyerSharing}
          rowKey={(row) => String(row.buyer.tenantId)}
          empty={
            <EmptyState
              compact
              title={t('supplier-org.sharing.empty')}
              description={<OrDash>{t('supplier-org.sharing.emptyHint')}</OrDash>}
            />
          }
        />
      </Card>
    </div>
  );
}
