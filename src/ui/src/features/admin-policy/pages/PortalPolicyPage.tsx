/**
 * ADM-11 — Public portal and publication policy: the released branding, notice fields, document access, public
 * awards, languages, guidance and channels the public portal applies now, a proposed change with its review
 * (save → submit → approve after a disclosure review, or return / withdraw), what the public currently sees, and
 * the approval history. Until approval the portal keeps the approved settings; mandatory controls cannot be hidden.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import {
  SavePortalProposalBody,
  approvePortalProposal,
  getPortalPolicy,
  getPublicPortalPolicy,
  returnPortalProposal,
  savePortalProposal,
  submitPortalProposal,
  withdrawPortalProposal,
} from '@contracts/policy';
import type { PortalPolicy } from '@contracts/policy';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  SkeletonBlock,
  StatusChip,
  Timeline,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { formatCount, formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { PolicyLayout } from '../components/PolicyLayout';
import { PortalSettingsForm, PortalSettingsView } from '../components/PortalSettings';
import { policyErrorMessage, withPolicyMessage } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import { portalNextAction } from '../lib/nextActions';
import { PORTAL_FIELDS, draftToProposal, settingsToDraft } from '../lib/portalDraft';
import type { PortalDraft } from '../lib/portalDraft';
import { errorLookup, validateWith } from '../lib/validation';

type Action = 'submit' | 'approve' | 'return' | 'withdraw' | null;

function PublicView({ buyerSlug }: { readonly buyerSlug: string }) {
  const timeZone = useOfficialTimeZone();
  const query = useApiQuery(getPublicPortalPolicy, { params: { buyerSlug } });
  if (query.data === undefined && query.error !== null) {
    return <ErrorState error={query.error} onRetry={query.reload} />;
  }
  if (query.data === undefined) return <SkeletonBlock lines={4} />;
  const view = query.data;
  return (
    <DetailList
      stacked
      items={[
        {
          key: 'portal',
          label: t('admin-policy.portal.public.portal'),
          value: view.publicPortalEnabled
            ? t('admin-policy.portal.public.online', { name: view.brandingDisplayName })
            : t('admin-policy.portal.public.offline'),
        },
        {
          key: 'fields',
          label: t('admin-policy.portal.public.fields'),
          value: t('admin-policy.portal.public.fieldsValue', {
            count: view.visibleNoticeFields.length,
          }),
        },
        {
          key: 'awards',
          label: t('admin-policy.portal.field.awards'),
          value: view.showAwards ? t('admin-policy.common.yes') : t('admin-policy.common.no'),
        },
        {
          key: 'identities',
          label: t('admin-policy.portal.field.identities'),
          value: tEnum('portal_settings.disclose_bidder_identities', view.discloseBidderIdentities),
        },
        {
          key: 'channels',
          label: t('admin-policy.portal.field.channels'),
          value: view.channels.map((channel) => tEnum('publications.channel', channel)).join(', '),
        },
        {
          key: 'approved',
          label: t('admin-policy.portal.public.since'),
          value: view.approvedAt === null ? null : formatDateTime(view.approvedAt, timeZone),
        },
      ]}
    />
  );
}

interface PortalViewProps {
  readonly policy: PortalPolicy;
  readonly onUpdated: (policy: PortalPolicy) => void;
}

function PortalView({ policy, onUpdated }: PortalViewProps) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const caps = policy.capabilities;
  const proposal = policy.proposal;
  const [editing, setEditing] = useState<PortalDraft | null>(null);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [action, setAction] = useState<Action>(null);
  const save = useApiMutation(savePortalProposal);
  const submit = useApiMutation(submitPortalProposal);
  const approve = useApiMutation(approvePortalProposal);
  const giveBack = useApiMutation(returnPortalProposal);
  const withdraw = useApiMutation(withdrawPortalProposal);
  const errors = errorLookup(clientErrors, save.error, PORTAL_FIELDS);
  const scope = t('admin-policy.portal.scope', { name: policy.approved.brandingDisplayName });
  const canEditProposal = caps.canPropose && proposal?.status !== 'in_review';

  const saveProposal = async (): Promise<void> => {
    if (editing === null) return;
    const body = draftToProposal(editing);
    const problems = validateWith(SavePortalProposalBody, body);
    setClientErrors(problems);
    if (problems.length > 0) return;
    try {
      onUpdated(await save.mutate({ body }));
      setEditing(null);
      toast.show(t('admin-policy.portal.saved'), 'success');
    } catch {
      // Shown above the form.
    }
  };

  const closeAction = (): void => {
    submit.reset();
    approve.reset();
    giveBack.reset();
    withdraw.reset();
    setAction(null);
  };

  const run = async (task: () => Promise<PortalPolicy>, message: string): Promise<void> => {
    try {
      onUpdated(await task());
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
        loading={save.pending}
        onClick={() => void saveProposal()}
      >
        {t('admin-policy.portal.saveProposal')}
      </Button>
    ) : caps.canApprove ? (
      <Button variant="primary" icon="checkCircle" onClick={() => setAction('approve')}>
        {t('admin-policy.portal.approve')}
      </Button>
    ) : caps.canSubmit ? (
      <Button variant="primary" icon="send" onClick={() => setAction('submit')}>
        {t('admin-policy.portal.submit')}
      </Button>
    ) : canEditProposal ? (
      <Button
        variant="primary"
        icon="edit"
        onClick={() =>
          setEditing(
            proposal === null
              ? settingsToDraft(policy.approved)
              : settingsToDraft(proposal.settings, proposal.changeNote),
          )
        }
      >
        {proposal === null
          ? t('admin-policy.portal.propose')
          : t('admin-policy.portal.editProposal')}
      </Button>
    ) : undefined;

  return (
    <>
      <UnsavedChangesGuard when={editing !== null} />
      <PageHeader
        title={t('admin-policy.portal.title')}
        subtitle={t('admin-policy.portal.intro')}
        meta={
          <span className="tiq-inline">
            <Chip tone={policy.approved.publicPortalEnabled ? 'success' : 'neutral'} icon="globe">
              {policy.approved.publicPortalEnabled
                ? t('admin-policy.portal.live')
                : t('admin-policy.portal.offline')}
            </Chip>
            {proposal !== null && (
              <span className="tiq-inline">
                <span>{t('admin-policy.portal.proposal')}</span>
                <StatusChip enum="policy_profile_versions.status" value={proposal.status} />
              </span>
            )}
            <span>
              <strong>{t('admin-policy.common.nextAction')}</strong> {portalNextAction(policy)}
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
                  save.reset();
                }}
              >
                {t('admin-policy.common.cancelEditing')}
              </Button>
            )}
            {editing === null && canEditProposal && proposal !== null && caps.canSubmit && (
              <Button
                icon="edit"
                onClick={() => setEditing(settingsToDraft(proposal.settings, proposal.changeNote))}
              >
                {t('admin-policy.portal.editProposal')}
              </Button>
            )}
            {editing === null && caps.canReturn && (
              <Button icon="arrowLeft" onClick={() => setAction('return')}>
                {t('admin-policy.portal.return')}
              </Button>
            )}
            {editing === null && caps.canWithdraw && (
              <Button variant="danger-soft" icon="x" onClick={() => setAction('withdraw')}>
                {t('admin-policy.portal.withdraw')}
              </Button>
            )}
          </>
        }
      />
      <KpiGrid>
        <KpiCard
          label={t('admin-policy.portal.kpi.tenders')}
          icon="megaphone"
          value={formatCount(policy.impact.publicTenderCount)}
          hint={t('admin-policy.portal.kpi.tendersHint')}
        />
        <KpiCard
          label={t('admin-policy.portal.kpi.awards')}
          icon="award"
          tone="success"
          value={formatCount(policy.impact.publishedAwardCount)}
          hint={t('admin-policy.portal.kpi.awardsHint')}
        />
        <KpiCard
          label={t('admin-policy.portal.kpi.advance')}
          icon="calendar"
          tone="info"
          value={formatCount(policy.impact.advanceNoticeCount)}
          hint={t('admin-policy.portal.kpi.advanceHint')}
        />
        <KpiCard
          label={t('admin-policy.portal.kpi.approved')}
          icon="shieldCheck"
          tone="warning"
          value={
            policy.approvedAt === null
              ? t('admin-policy.portal.kpi.never')
              : formatInstantDate(policy.approvedAt, timeZone)
          }
          hint={policy.approvedBy?.fullName}
        />
      </KpiGrid>
      {proposal !== null && editing === null && (
        <Banner
          tone={proposal.status === 'in_review' ? 'warning' : 'info'}
          title={
            proposal.status === 'in_review'
              ? t('admin-policy.portal.inReviewTitle')
              : t('admin-policy.portal.draftTitle')
          }
        >
          <p>
            {t('admin-policy.portal.proposalBy', {
              who: proposal.proposedBy.fullName,
              date: formatDateTime(proposal.proposedAt, timeZone),
            })}
          </p>
          {proposal.changeNote !== '' && <p>{proposal.changeNote}</p>}
          <p className="tiq-inline">
            <strong>{t('admin-policy.portal.changed')}</strong>
            {proposal.changedSettings.map((setting) => (
              <Chip key={setting} tone="warning" size="sm">
                {setting}
              </Chip>
            ))}
          </p>
          <p>{t('admin-policy.portal.untilApproved')}</p>
        </Banner>
      )}
      {proposal?.status === 'in_review' &&
        editing === null &&
        policy.capabilities.approvalBlockedReason !== null && (
          <Banner tone="warning" title={t('admin-policy.version.sodTitle')}>
            <p>{policy.capabilities.approvalBlockedReason}</p>
          </Banner>
        )}
      {proposal?.status === 'in_review' &&
        editing === null &&
        policy.capabilities.alternativeOversightNote !== null && (
          <Banner tone="info" title={t('admin-policy.common.oversightTitle')}>
            <p>{t('admin-policy.common.oversightBody')}</p>
            <p>{policy.capabilities.alternativeOversightNote}</p>
          </Banner>
        )}
      {proposal?.returnedReason != null && proposal.status === 'draft' && editing === null && (
        <Banner tone="warning" title={t('admin-policy.portal.returnedTitle')}>
          <p>{proposal.returnedReason}</p>
        </Banner>
      )}

      {editing !== null ? (
        <Card
          title={t('admin-policy.portal.editTitle')}
          subtitle={t('admin-policy.portal.editHint')}
        >
          {(errors.other.length > 0 || (save.error !== null && errors.count === 0)) && (
            <FormErrorSummary
              title={save.error === null ? null : policyErrorMessage(save.error)}
              errors={errors.other}
            />
          )}
          <PortalSettingsForm value={editing} onChange={setEditing} errors={errors} />
        </Card>
      ) : (
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack">
            <div className={proposal === null ? 'tiq-stack' : 'tiq-grid tiq-grid--2'}>
              <Card
                title={t('admin-policy.portal.approvedTitle')}
                subtitle={
                  policy.approvedAt === null
                    ? undefined
                    : t('admin-policy.common.byOn', {
                        who: policy.approvedBy?.fullName ?? t('admin-policy.common.unknownPerson'),
                        date: formatDateTime(policy.approvedAt, timeZone),
                      })
                }
              >
                <PortalSettingsView settings={policy.approved} />
              </Card>
              {proposal !== null && (
                <Card
                  title={t('admin-policy.portal.proposedTitle')}
                  subtitle={tEnum('policy_profile_versions.status', proposal.status)}
                >
                  <PortalSettingsView settings={proposal.settings} />
                </Card>
              )}
            </div>
          </div>
          <div className="tiq-stack">
            <Card
              title={t('admin-policy.portal.public.title')}
              subtitle={t('admin-policy.portal.public.hint')}
            >
              <PublicView buyerSlug={policy.buyerSlug} />
            </Card>
            <Card title={t('admin-policy.portal.history')}>
              {policy.history.length === 0 ? (
                <EmptyState compact title={t('admin-policy.portal.noHistory')} />
              ) : (
                <Timeline
                  label={t('admin-policy.portal.history')}
                  items={policy.history.map((entry) => ({
                    id: entry.id,
                    title: t(`admin-policy.portal.outcome.${entry.outcome}`),
                    detail: entry.underAlternativeOversight
                      ? `${entry.summary} ${t('admin-policy.portal.underOversight')}`
                      : entry.summary,
                    meta:
                      entry.proposedBy === null
                        ? t('admin-policy.common.byOn', {
                            who: entry.by.fullName,
                            date: formatDateTime(entry.at, timeZone),
                          })
                        : t('admin-policy.portal.historyMeta', {
                            proposer: entry.proposedBy.fullName,
                            who: entry.by.fullName,
                            date: formatDateTime(entry.at, timeZone),
                          }),
                    tone:
                      entry.outcome === 'approved'
                        ? 'success'
                        : entry.outcome === 'returned'
                          ? 'warning'
                          : undefined,
                  }))}
                />
              )}
            </Card>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={action === 'submit'}
        title={t('admin-policy.portal.submitTitle')}
        scope={scope}
        consequence={t('admin-policy.portal.submitConsequence')}
        confirmLabel={t('admin-policy.portal.submit')}
        pending={submit.pending}
        error={withPolicyMessage(submit.error)}
        onCancel={closeAction}
        onConfirm={() => run(() => submit.mutate({}), t('admin-policy.portal.submitted'))}
      />
      <ConfirmActionDialog
        open={action === 'approve'}
        title={t('admin-policy.portal.approveTitle')}
        scope={scope}
        consequence={t('admin-policy.portal.approveConsequence', {
          settings: proposal?.changedSettings.join(', ') ?? '',
          tenders: policy.impact.publicTenderCount,
        })}
        confirmLabel={t('admin-policy.portal.approve')}
        reason={{ label: t('admin-policy.common.approvalNote'), required: false }}
        acknowledgement={t('admin-policy.portal.disclosureAck')}
        pending={approve.pending}
        error={withPolicyMessage(approve.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          run(
            () =>
              approve.mutate({
                body: {
                  disclosureReviewed: true,
                  ...(reason === '' ? {} : { note: reason }),
                },
              }),
            t('admin-policy.portal.approved'),
          )
        }
      />
      <ConfirmActionDialog
        open={action === 'return'}
        title={t('admin-policy.portal.returnTitle')}
        scope={scope}
        consequence={t('admin-policy.portal.returnConsequence')}
        confirmLabel={t('admin-policy.portal.return')}
        reason={{ label: t('admin-policy.common.reasonLabel'), required: true }}
        pending={giveBack.pending}
        error={withPolicyMessage(giveBack.error)}
        onCancel={closeAction}
        onConfirm={({ reason }) =>
          run(() => giveBack.mutate({ body: { reason } }), t('admin-policy.portal.returned'))
        }
      />
      <ConfirmActionDialog
        open={action === 'withdraw'}
        tone="danger"
        title={t('admin-policy.portal.withdrawTitle')}
        scope={scope}
        consequence={t('admin-policy.portal.withdrawConsequence')}
        confirmLabel={t('admin-policy.portal.withdraw')}
        pending={withdraw.pending}
        error={withPolicyMessage(withdraw.error)}
        onCancel={closeAction}
        onConfirm={() => run(() => withdraw.mutate({}), t('admin-policy.portal.withdrawn'))}
      />
    </>
  );
}

export default function PortalPolicyPage() {
  const tenantId = useActiveTenant()?.tenantId ?? null;
  const [latest, setLatest] = useState<PortalPolicy | null>(null);
  const query = useApiQuery(getPortalPolicy, {});
  return (
    <PolicyLayout>
      {latest !== null && latest.tenantId === tenantId ? (
        <PortalView policy={latest} onUpdated={setLatest} />
      ) : (
        <QueryView query={query}>
          {(policy) => <PortalView policy={policy} onUpdated={setLatest} />}
        </QueryView>
      )}
    </PolicyLayout>
  );
}
