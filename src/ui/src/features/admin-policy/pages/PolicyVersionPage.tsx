/**
 * ADM-06 — one version of a procurement policy profile: its rules (procedures, thresholds, gates, exceptions,
 * publication, opening, waiting periods and complaint rules), the tenders and strategies that use it (frozen at
 * release or only proposed, BR-09 / AC-06), what it changes against another version, and the lifecycle actions:
 * edit and submit a draft, approve or return a version in review (never your own submission, BR-07), retire an
 * approved version that is no longer current. An approved version is immutable.
 */
import { useState } from 'react';

import {
  UpdatePolicyVersionBody,
  approvePolicyVersion,
  comparePolicyVersions,
  getPolicyProfile,
  getPolicyVersion,
  retirePolicyVersion,
  returnPolicyVersion,
  submitPolicyVersion,
  updatePolicyVersion,
} from '@contracts/policy';
import type {
  PolicyStrategyUsage,
  PolicyTenderUsage,
  PolicyVersionDetail,
} from '@contracts/policy';
import type { FieldError } from '@contracts/common';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  OrDash,
  PageHeader,
  QueryView,
  ReadinessChecklist,
  Reference,
  Select,
  SkeletonBlock,
  StatusChip,
  Stepper,
  Tabs,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { PolicyLayout } from '../components/PolicyLayout';
import { PolicyRulesForm, PolicyRulesView } from '../components/PolicyRules';
import { policyErrorMessage, withPolicyMessage } from '../lib/errors';
import { useCommandResult, useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { draftReadiness, versionNextAction, versionSteps } from '../lib/nextActions';
import { policyPaths, tenderPath } from '../lib/paths';
import { draftToRules, rulesToDraft } from '../lib/rulesDraft';
import type { RulesDraft } from '../lib/rulesDraft';
import { errorLookup, validateWith } from '../lib/validation';

type Action = 'submit' | 'approve' | 'return' | 'retire' | null;
type Tab = 'rules' | 'usage' | 'changes';

const RULE_FIELDS = [
  'rules.permittedProcedures',
  'rules.bafoPermitted',
  'rules.thresholds',
  'rules.approvalRouteNote',
  'rules.lateSubmissionPolicy',
  'rules.openingQuorum',
  'rules.minResponseDays',
  'rules.questionDeadlineDaysBeforeClose',
  'rules.standstillLength',
  'rules.standstillDayType',
  'rules.complaintWindowDays',
];

function UsageTab({ version }: { readonly version: PolicyVersionDetail }) {
  const timeZone = useOfficialTimeZone();
  const tenderColumns: DataTableColumn<PolicyTenderUsage>[] = [
    {
      id: 'reference',
      header: t('admin-policy.version.usage.reference'),
      cell: (row) => <Reference value={row.reference} to={tenderPath(row.tenderId)} />,
    },
    { id: 'title', header: t('admin-policy.version.usage.title'), cell: (row) => row.title },
    {
      id: 'status',
      header: t('admin-policy.version.usage.status'),
      cell: (row) => <StatusChip enum="tenders.status" value={row.status} />,
    },
    {
      id: 'frozen',
      header: t('admin-policy.version.usage.binding'),
      cell: (row) =>
        row.frozen ? (
          <Chip tone="success" icon="lock">
            {t('admin-policy.version.usage.frozen')}
          </Chip>
        ) : (
          <Chip tone="info">{t('admin-policy.version.usage.proposed')}</Chip>
        ),
    },
    {
      id: 'released',
      header: t('admin-policy.version.usage.released'),
      cell: (row) => (
        <OrDash>{row.releasedAt === null ? null : formatDateTime(row.releasedAt, timeZone)}</OrDash>
      ),
    },
  ];
  const strategyColumns: DataTableColumn<PolicyStrategyUsage>[] = [
    { id: 'title', header: t('admin-policy.version.usage.strategy'), cell: (row) => row.title },
    {
      id: 'request',
      header: t('admin-policy.version.usage.request'),
      cell: (row) => <OrDash>{row.requestReference}</OrDash>,
    },
    {
      id: 'status',
      header: t('admin-policy.version.usage.status'),
      cell: (row) => <StatusChip enum="procurement_strategies.status" value={row.status} />,
    },
  ];
  return (
    <div className="tiq-stack">
      <Banner tone="info">
        <p>{t('admin-policy.version.usage.explain')}</p>
      </Banner>
      <Card flush title={t('admin-policy.version.usage.tenders')} headingLevel={3}>
        <DataTable
          caption={t('admin-policy.version.usage.tenders')}
          columns={tenderColumns}
          rows={version.tenders}
          rowKey={(row) => String(row.tenderId)}
          empty={<EmptyState compact title={t('admin-policy.version.usage.noTenders')} />}
        />
      </Card>
      <Card flush title={t('admin-policy.version.usage.strategies')} headingLevel={3}>
        <DataTable
          caption={t('admin-policy.version.usage.strategies')}
          columns={strategyColumns}
          rows={version.strategies}
          rowKey={(row) => String(row.strategyId)}
          empty={<EmptyState compact title={t('admin-policy.version.usage.noStrategies')} />}
        />
      </Card>
    </div>
  );
}

function ChangesTab({ version }: { readonly version: PolicyVersionDetail }) {
  const [against, setAgainst] = useState('');
  const profile = useApiQuery(getPolicyProfile, { params: { profileId: version.profileId } });
  const comparison = useApiQuery(comparePolicyVersions, {
    params: { profileId: version.profileId, versionId: version.id },
    query: against === '' ? {} : { against: Number(against) },
  });
  const options = (profile.data?.versions ?? [])
    .filter((candidate) => candidate.id !== version.id)
    .map((candidate) => ({
      value: String(candidate.id),
      label: t('admin-policy.profile.baseOption', {
        no: candidate.versionNo,
        status: t(`admin-policy.versionStatus.${candidate.status}`),
      }),
    }));
  return (
    <div className="tiq-stack">
      <div className="tiq-form-grid">
        <Select
          label={t('admin-policy.version.changes.against')}
          placeholder={t('admin-policy.version.changes.againstCurrent')}
          value={against}
          options={options}
          onChange={setAgainst}
        />
      </div>
      {comparison.error?.code === 'NO_BASE_VERSION' ? (
        <EmptyState
          compact
          title={t('admin-policy.version.changes.noBase')}
          description={t('admin-policy.version.changes.noBaseHint')}
        />
      ) : comparison.data === undefined && comparison.error !== null ? (
        <ErrorState error={comparison.error} onRetry={comparison.reload} />
      ) : comparison.data === undefined ? (
        <SkeletonBlock lines={3} />
      ) : (
        <Card
          flush
          headingLevel={3}
          title={t('admin-policy.version.changes.title', {
            base: comparison.data.base.versionNo,
            target: comparison.data.target.versionNo,
          })}
        >
          <DataTable
            caption={t('admin-policy.version.changes.caption')}
            columns={[
              {
                id: 'rule',
                header: t('admin-policy.version.changes.rule'),
                cell: (row) => row.rule,
              },
              {
                id: 'before',
                header: t('admin-policy.version.changes.before', {
                  no: comparison.data.base.versionNo,
                }),
                cell: (row) => row.before,
              },
              {
                id: 'after',
                header: t('admin-policy.version.changes.after', {
                  no: comparison.data.target.versionNo,
                }),
                cell: (row) => row.after,
              },
            ]}
            rows={comparison.data.changes}
            rowKey={(row) => row.rule}
            empty={<EmptyState compact title={t('admin-policy.version.changes.none')} />}
          />
        </Card>
      )}
    </div>
  );
}

interface VersionViewProps {
  readonly version: PolicyVersionDetail;
  readonly onUpdated: (version: PolicyVersionDetail) => void;
}

function VersionView({ version, onUpdated }: VersionViewProps) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const currency = useActiveTenant()?.defaultCurrency ?? 'BWP';
  const [tab, setTab] = useState<Tab>('rules');
  const [action, setAction] = useState<Action>(null);
  const [editing, setEditing] = useState<RulesDraft | null>(null);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const update = useApiMutation(updatePolicyVersion);
  const submit = useApiMutation(submitPolicyVersion);
  const approve = useApiMutation(approvePolicyVersion);
  const giveBack = useApiMutation(returnPolicyVersion);
  const retire = useApiMutation(retirePolicyVersion);
  const caps = version.capabilities;
  const params = { profileId: version.profileId, versionId: version.id };
  const label = t('admin-policy.version.label', {
    profile: version.profileName,
    no: version.versionNo,
  });
  const errors = errorLookup(clientErrors, update.error, RULE_FIELDS);

  const saveDraft = async (): Promise<void> => {
    if (editing === null) return;
    const body = { rules: draftToRules(editing) };
    const problems = validateWith(UpdatePolicyVersionBody, body);
    setClientErrors(problems);
    if (problems.length > 0) return;
    try {
      const saved = await update.mutate({ params, body });
      onUpdated(saved);
      setEditing(null);
      toast.show(t('admin-policy.version.savedDraft'), 'success');
    } catch {
      // Shown above the form.
    }
  };

  const closeAction = (): void => {
    submit.reset();
    approve.reset();
    giveBack.reset();
    retire.reset();
    setAction(null);
  };

  const run = async (task: () => Promise<PolicyVersionDetail>, message: string): Promise<void> => {
    try {
      const result = await task();
      onUpdated(result);
      toast.show(message, 'success');
      setAction(null);
    } catch {
      // Shown in the dialog.
    }
  };

  const primary =
    editing !== null ? (
      <Button
        variant="primary"
        icon="check"
        loading={update.pending}
        onClick={() => void saveDraft()}
      >
        {t('admin-policy.version.saveDraft')}
      </Button>
    ) : caps.canApprove ? (
      <Button variant="primary" icon="checkCircle" onClick={() => setAction('approve')}>
        {t('admin-policy.version.approve')}
      </Button>
    ) : caps.canSubmit ? (
      <Button variant="primary" icon="send" onClick={() => setAction('submit')}>
        {t('admin-policy.version.submit')}
      </Button>
    ) : undefined;

  return (
    <>
      <UnsavedChangesGuard when={editing !== null} />
      <PageHeader
        title={label}
        back={{
          to: policyPaths.profile(version.profileId),
          label: t('admin-policy.version.back', { profile: version.profileName }),
        }}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="policy_profile_versions.status" value={version.status} />
            {version.isCurrent && (
              <Chip tone="accent">{t('admin-policy.common.currentForNewWork')}</Chip>
            )}
            {version.effectiveFrom !== null && (
              <span>
                {t('admin-policy.version.effectiveFrom', {
                  date: formatDateTime(version.effectiveFrom, timeZone),
                })}
              </span>
            )}
            <span>
              <strong>{t('admin-policy.common.nextAction')}</strong> {versionNextAction(version)}
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
                  update.reset();
                }}
              >
                {t('admin-policy.common.cancelEditing')}
              </Button>
            )}
            {editing === null && caps.canEdit && (
              <Button icon="edit" onClick={() => setEditing(rulesToDraft(version.rules))}>
                {t('admin-policy.version.edit')}
              </Button>
            )}
            {editing === null && caps.canReturn && (
              <Button icon="arrowLeft" onClick={() => setAction('return')}>
                {t('admin-policy.version.return')}
              </Button>
            )}
            {editing === null && caps.canRetire && (
              <Button variant="danger-soft" icon="archive" onClick={() => setAction('retire')}>
                {t('admin-policy.version.retire')}
              </Button>
            )}
            {version.approvalRequestId !== null && (
              <ButtonLink to={`/me/approvals/${version.approvalRequestId}`} icon="externalLink">
                {t('admin-policy.version.approvalRecord')}
              </ButtonLink>
            )}
          </>
        }
      />
      <Card>
        <Stepper steps={versionSteps(version.status)} label={t('admin-policy.version.lifecycle')} />
      </Card>
      {version.status === 'approved' && (
        <Banner tone="info" title={t('admin-policy.version.immutableTitle')}>
          <p>{t('admin-policy.version.immutable')}</p>
        </Banner>
      )}
      {version.status === 'retired' && (
        <Banner tone="warning" title={t('admin-policy.version.retiredTitle')}>
          <p>{t('admin-policy.version.retiredBody')}</p>
        </Banner>
      )}
      {version.status === 'draft' && version.returnedReason !== null && (
        <Banner tone="warning" title={t('admin-policy.version.returnedTitle')}>
          <p>{version.returnedReason}</p>
        </Banner>
      )}
      {version.status === 'in_review' && caps.approvalBlockedReason !== null && (
        <Banner tone="warning" title={t('admin-policy.version.sodTitle')}>
          <p>{caps.approvalBlockedReason}</p>
        </Banner>
      )}
      {version.status === 'in_review' && caps.alternativeOversightNote !== null && (
        <Banner tone="info" title={t('admin-policy.common.oversightTitle')}>
          <p>{t('admin-policy.common.oversightBody')}</p>
          <p>{caps.alternativeOversightNote}</p>
        </Banner>
      )}
      {version.status === 'in_review' && (
        <Card title={t('admin-policy.version.reviewTitle')} headingLevel={3}>
          <p>
            {t('admin-policy.version.reviewBody', {
              who: version.submittedBy?.fullName ?? t('admin-policy.common.unknownPerson'),
              date:
                version.submittedAt === null ? '' : formatDateTime(version.submittedAt, timeZone),
            })}
          </p>
        </Card>
      )}

      {editing !== null ? (
        <Card title={t('admin-policy.version.editTitle')}>
          {(errors.other.length > 0 || (update.error !== null && errors.count === 0)) && (
            <FormErrorSummary
              title={update.error === null ? null : policyErrorMessage(update.error)}
              errors={errors.other}
            />
          )}
          <PolicyRulesForm
            value={editing}
            onChange={setEditing}
            errors={errors}
            defaultCurrency={currency}
          />
        </Card>
      ) : (
        <Tabs
          label={t('admin-policy.version.tabs')}
          selected={tab}
          onSelect={(id) => setTab(id as Tab)}
          tabs={[
            { id: 'rules', label: t('admin-policy.version.tab.rules') },
            {
              id: 'usage',
              label: t('admin-policy.version.tab.usage'),
              count: version.tenders.length + version.strategies.length,
            },
            { id: 'changes', label: t('admin-policy.version.tab.changes') },
          ]}
        >
          {tab === 'rules' && (
            <div className="tiq-stack">
              {version.status === 'draft' && (
                <ReadinessChecklist
                  label={t('admin-policy.readiness.title')}
                  items={draftReadiness(version)}
                />
              )}
              <PolicyRulesView rules={version.rules} />
            </div>
          )}
          {tab === 'usage' && <UsageTab version={version} />}
          {tab === 'changes' && <ChangesTab version={version} />}
        </Tabs>
      )}

      <ConfirmActionDialog
        open={action === 'submit'}
        title={t('admin-policy.version.submitTitle')}
        scope={label}
        consequence={t('admin-policy.version.submitConsequence')}
        confirmLabel={t('admin-policy.version.submit')}
        reason={{ label: t('admin-policy.common.noteForApprover'), required: false }}
        pending={submit.pending}
        error={withPolicyMessage(submit.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          run(
            () => submit.mutate({ params, body: reason === '' ? {} : { note: reason } }),
            t('admin-policy.version.submitted'),
          )
        }
      />
      <ConfirmActionDialog
        open={action === 'approve'}
        title={t('admin-policy.version.approveTitle')}
        scope={label}
        consequence={t('admin-policy.version.approveConsequence', {
          count: version.tenders.filter((row) => row.frozen).length,
        })}
        confirmLabel={t('admin-policy.version.approve')}
        reason={{ label: t('admin-policy.common.approvalNote'), required: false }}
        acknowledgement={t('admin-policy.version.approveAck')}
        pending={approve.pending}
        error={withPolicyMessage(approve.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          run(
            () =>
              approve.mutate({
                params,
                body: {
                  ...(effectiveFrom === null ? {} : { effectiveFrom }),
                  ...(reason === '' ? {} : { note: reason }),
                },
              }),
            t('admin-policy.version.approved'),
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
        title={t('admin-policy.version.returnTitle')}
        scope={label}
        consequence={t('admin-policy.version.returnConsequence')}
        confirmLabel={t('admin-policy.version.return')}
        reason={{ label: t('admin-policy.common.reasonLabel'), required: true }}
        pending={giveBack.pending}
        error={withPolicyMessage(giveBack.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          run(
            () => giveBack.mutate({ params, body: { reason } }),
            t('admin-policy.version.returned'),
          )
        }
      />
      <ConfirmActionDialog
        open={action === 'retire'}
        tone="danger"
        title={t('admin-policy.version.retireTitle')}
        scope={label}
        consequence={t('admin-policy.version.retireConsequence', {
          count: version.tenders.filter((row) => row.frozen).length,
        })}
        confirmLabel={t('admin-policy.version.retire')}
        reason={{ label: t('admin-policy.common.reasonLabel'), required: true }}
        pending={retire.pending}
        error={withPolicyMessage(retire.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          run(
            () => retire.mutate({ params, body: { reason } }),
            t('admin-policy.version.retiredToast'),
          )
        }
      />
    </>
  );
}

export default function PolicyVersionPage() {
  const profileId = useIdParam('profileId');
  const versionId = useIdParam('versionId');
  const [latest, setLatest] = useCommandResult<PolicyVersionDetail>(versionId);
  const query = useApiQuery(
    getPolicyVersion,
    profileId === null || versionId === null ? null : { params: { profileId, versionId } },
  );
  return (
    <PolicyLayout>
      {profileId === null || versionId === null ? (
        <EmptyState title={t('admin-policy.common.notFound')} />
      ) : latest !== null ? (
        <VersionView version={latest} onUpdated={setLatest} />
      ) : (
        <QueryView query={query}>
          {(version) => <VersionView version={version} onUpdated={setLatest} />}
        </QueryView>
      )}
    </PolicyLayout>
  );
}
