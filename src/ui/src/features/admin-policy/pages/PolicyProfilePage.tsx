/**
 * ADM-06 — one procurement policy profile: its version history (draft → in review → approved → retired), which
 * version is current for new work, how many tenders use each version, and the profile-level actions (draft the
 * next version, retire the profile).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { createPolicyVersion, getPolicyProfile, retirePolicyProfile } from '@contracts/policy';
import type {
  PolicyProfileDetail,
  PolicyVersionDetail,
  PolicyVersionSummary,
} from '@contracts/policy';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { PolicyLayout } from '../components/PolicyLayout';
import { withPolicyMessage } from '../lib/errors';
import { useCommandResult, useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { profileNextAction } from '../lib/nextActions';
import { policyPaths } from '../lib/paths';

type Dialog = 'draft' | 'retire' | null;

interface ProfileViewProps {
  readonly profile: PolicyProfileDetail;
  readonly onUpdated: (profile: PolicyProfileDetail) => void;
}

function ProfileView({ profile, onUpdated }: ProfileViewProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [baseVersionId, setBaseVersionId] = useState('');
  const [drafted, setDrafted] = useState<PolicyVersionDetail | null>(null);
  const draft = useApiMutation(createPolicyVersion);
  const retire = useApiMutation(retirePolicyProfile);

  useEffect(() => {
    if (drafted !== null) {
      void navigate(policyPaths.version(drafted.profileId, drafted.id), {
        state: { record: drafted },
      });
    }
  }, [drafted, navigate]);

  const baseOptions = profile.versions
    .filter((version) => version.status === 'approved' || version.status === 'retired')
    .map((version) => ({
      value: String(version.id),
      label: t('admin-policy.profile.baseOption', {
        no: version.versionNo,
        status: t(`admin-policy.versionStatus.${version.status}`),
      }),
    }));

  const columns: DataTableColumn<PolicyVersionSummary>[] = [
    {
      id: 'version',
      header: t('admin-policy.profile.col.version'),
      cell: (row) => (
        <span className="tiq-inline">
          <span>{t('admin-policy.common.versionNo', { no: row.versionNo })}</span>
          {row.isCurrent && (
            <Chip tone="accent" size="sm">
              {t('admin-policy.common.current')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('admin-policy.profile.col.status'),
      cell: (row) => <StatusChip enum="policy_profile_versions.status" value={row.status} />,
    },
    {
      id: 'created',
      header: t('admin-policy.profile.col.created'),
      cell: (row) => (
        <>
          <OrDash>{row.createdBy?.fullName}</OrDash>
          <span className="tiq-cell-sub">{formatInstantDate(row.createdAt, timeZone)}</span>
        </>
      ),
    },
    {
      id: 'submitted',
      header: t('admin-policy.profile.col.submitted'),
      cell: (row) => (
        <>
          <OrDash>{row.submittedBy?.fullName}</OrDash>
          {row.submittedAt !== null && (
            <span className="tiq-cell-sub">{formatInstantDate(row.submittedAt, timeZone)}</span>
          )}
        </>
      ),
    },
    {
      id: 'approved',
      header: t('admin-policy.profile.col.approved'),
      cell: (row) => (
        <>
          <OrDash>{row.approvedBy?.fullName}</OrDash>
          {row.approvedAt !== null && (
            <span className="tiq-cell-sub">{formatInstantDate(row.approvedAt, timeZone)}</span>
          )}
        </>
      ),
    },
    {
      id: 'effective',
      header: t('admin-policy.profile.col.effective'),
      cell: (row) => (
        <OrDash>
          {row.effectiveFrom === null ? null : formatDateTime(row.effectiveFrom, timeZone)}
        </OrDash>
      ),
    },
    {
      id: 'retired',
      header: t('admin-policy.profile.col.retired'),
      cell: (row) => (
        <OrDash>
          {row.retiredAt === null ? null : formatInstantDate(row.retiredAt, timeZone)}
        </OrDash>
      ),
    },
    {
      id: 'usage',
      header: t('admin-policy.profile.col.usage'),
      numeric: true,
      cell: (row) => formatCount(row.usageCount),
    },
  ];

  const current = profile.currentVersion;
  const pending = profile.pendingVersion;

  return (
    <>
      <PageHeader
        title={profile.name}
        subtitle={profile.description === '' ? undefined : profile.description}
        back={{ to: policyPaths.profiles, label: t('admin-policy.profiles.back') }}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="policy_profiles.status" value={profile.status} />
            {current !== null && (
              <span>{t('admin-policy.profile.currentIs', { no: current.versionNo })}</span>
            )}
            <span>
              <strong>{t('admin-policy.common.nextAction')}</strong> {profileNextAction(profile)}
            </span>
          </span>
        }
        primaryAction={
          profile.capabilities.canDraftVersion ? (
            <Button variant="primary" icon="plus" onClick={() => setDialog('draft')}>
              {t('admin-policy.profile.draftVersion')}
            </Button>
          ) : undefined
        }
        actions={
          profile.capabilities.canRetire ? (
            <Button variant="danger-soft" icon="archive" onClick={() => setDialog('retire')}>
              {t('admin-policy.profile.retire')}
            </Button>
          ) : undefined
        }
      />
      {profile.status === 'retired' && (
        <Banner tone="warning" title={t('admin-policy.profile.retiredTitle')}>
          <p>
            {t('admin-policy.profile.retiredBody', {
              date:
                profile.retiredAt === null ? '' : formatInstantDate(profile.retiredAt, timeZone),
            })}
          </p>
          {profile.retirementReason !== null && (
            <p>
              <strong>{t('admin-policy.common.reason')}</strong> {profile.retirementReason}
            </p>
          )}
        </Banner>
      )}
      <KpiGrid>
        <KpiCard
          label={t('admin-policy.profile.kpi.current')}
          icon="shieldCheck"
          value={
            current === null
              ? t('admin-policy.profile.kpi.noCurrent')
              : t('admin-policy.common.versionNo', { no: current.versionNo })
          }
          hint={
            current?.effectiveFrom == null
              ? undefined
              : t('admin-policy.profiles.effectiveFrom', {
                  date: formatInstantDate(current.effectiveFrom, timeZone),
                })
          }
        />
        <KpiCard
          label={t('admin-policy.profile.kpi.pending')}
          icon="clipboardCheck"
          tone="warning"
          value={
            pending === null
              ? t('admin-policy.profile.kpi.noPending')
              : t('admin-policy.common.versionNo', { no: pending.versionNo })
          }
          hint={pending === null ? undefined : t(`admin-policy.versionStatus.${pending.status}`)}
        />
        <KpiCard
          label={t('admin-policy.profile.kpi.versions')}
          icon="history"
          tone="info"
          value={formatCount(profile.versionCount)}
        />
        <KpiCard
          label={t('admin-policy.profile.kpi.usage')}
          icon="fileText"
          tone="success"
          value={formatCount(profile.usageCount)}
          hint={t('admin-policy.profile.kpi.usageHint')}
        />
      </KpiGrid>
      <Card
        flush
        title={t('admin-policy.profile.versions')}
        subtitle={t('admin-policy.profile.versionsHint')}
      >
        <DataTable
          caption={t('admin-policy.profile.versions')}
          columns={columns}
          rows={profile.versions}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => t('admin-policy.common.versionNo', { no: row.versionNo })}
          rowHref={(row) => policyPaths.version(profile.id, row.id)}
          empty={<EmptyState compact title={t('admin-policy.profile.noVersions')} />}
        />
      </Card>

      <ConfirmActionDialog
        open={dialog === 'draft'}
        title={t('admin-policy.profile.draftTitle')}
        scope={profile.name}
        consequence={t('admin-policy.profile.draftConsequence')}
        confirmLabel={t('admin-policy.profile.draftConfirm')}
        pending={draft.pending}
        error={withPolicyMessage(draft.error)}
        onCancel={() => {
          draft.reset();
          setDialog(null);
        }}
        onConfirm={async () => {
          try {
            const version = await draft.mutate({
              params: { profileId: profile.id },
              body: baseVersionId === '' ? {} : { fromVersionId: Number(baseVersionId) },
            });
            toast.show(t('admin-policy.profile.drafted', { no: version.versionNo }), 'success');
            setDialog(null);
            setDrafted(version);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('admin-policy.profile.baseVersion')}
          hint={t('admin-policy.profile.baseVersionHint')}
          placeholder={t('admin-policy.profile.baseCurrent')}
          value={baseVersionId}
          options={baseOptions}
          onChange={setBaseVersionId}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'retire'}
        tone="danger"
        title={t('admin-policy.profile.retireTitle')}
        scope={profile.name}
        consequence={t('admin-policy.profile.retireConsequence', {
          count: profile.usageCount,
        })}
        confirmLabel={t('admin-policy.profile.retireConfirm')}
        reason={{ label: t('admin-policy.common.reasonLabel'), required: true }}
        pending={retire.pending}
        error={withPolicyMessage(retire.error)}
        onCancel={() => {
          retire.reset();
          setDialog(null);
        }}
        onConfirm={async ({ reason }) => {
          try {
            const updated = await retire.mutate({
              params: { profileId: profile.id },
              body: { reason },
            });
            onUpdated(updated);
            toast.show(t('admin-policy.profile.retired', { name: updated.name }), 'success');
            setDialog(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </>
  );
}

export default function PolicyProfilePage() {
  const profileId = useIdParam('profileId');
  const [latest, setLatest] = useCommandResult<PolicyProfileDetail>(profileId);
  const query = useApiQuery(
    getPolicyProfile,
    profileId === null ? null : { params: { profileId } },
  );
  return (
    <PolicyLayout>
      {profileId === null ? (
        <EmptyState title={t('admin-policy.common.notFound')} />
      ) : latest !== null ? (
        <ProfileView profile={latest} onUpdated={setLatest} />
      ) : (
        <QueryView query={query}>
          {(profile) => <ProfileView profile={profile} onUpdated={setLatest} />}
        </QueryView>
      )}
    </PolicyLayout>
  );
}
