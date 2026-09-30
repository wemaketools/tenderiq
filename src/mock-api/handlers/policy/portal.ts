/**
 * Mock handlers of the public portal and publication policy (ADM-11) and its public projection. The public endpoint
 * serves only the APPROVED settings; a pending proposal is never disclosed. Approving one's own proposal is blocked
 * (BR-07, 403 `SOD_SELF_APPROVAL_BLOCKED`) unless the documented alternative oversight applies.
 */
import {
  PORTAL_NOTICE_FIELDS,
  approvePortalProposal,
  getPortalPolicy,
  getPublicPortalPolicy,
  returnPortalProposal,
  savePortalProposal,
  submitPortalProposal,
  withdrawPortalProposal,
} from '../../../contracts/policy.js';
import type { PortalPolicy, PortalSettings, SavePortalProposalBody } from '../../../contracts/policy.js';
import { PUBLICATIONS_CHANNEL } from '../../../contracts/enums.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { PORTAL_POLICIES } from '../../fixtures/policy.js';
import type { FixturePortalHistory, FixturePortalPolicy, FixturePortalProposal } from '../../fixtures/policy.js';
import { findTenantById, findTenantBySlug, personRef } from '../../persona.js';
import type { TenantAccess } from '../../persona.js';
import { holds, selfApprovalFor } from './common.js';

type Fail = (status: number, code: string, detail?: string) => never;

const NEW_PROPOSAL_ID = 900;
const NEW_HISTORY_ID = 900;

const SETTING_LABELS: ReadonlyArray<[keyof PortalSettings, string]> = [
  ['publicPortalEnabled', 'Public portal enabled'],
  ['brandingDisplayName', 'Display name'],
  ['portalIntro', 'Portal introduction'],
  ['guidanceMarkdown', 'Supplier guidance'],
  ['showAdvanceNotices', 'Advance notices'],
  ['showAwards', 'Award notices'],
  ['showBidderCounts', 'Bidder counts'],
  ['discloseBidderIdentities', 'Bidder identities'],
  ['publicDocumentPolicy', 'Document access'],
  ['languages', 'Languages'],
  ['noticeFields', 'Notice fields'],
  ['channels', 'Channels'],
];

function changedSettings(approved: PortalSettings, proposed: PortalSettings): string[] {
  return SETTING_LABELS.filter(([key]) => JSON.stringify(approved[key]) !== JSON.stringify(proposed[key])).map(([, label]) => label);
}

function settingsFrom(input: SavePortalProposalBody['settings']): PortalSettings {
  const external = input.channels.includes('external_notice');
  return {
    publicPortalEnabled: input.publicPortalEnabled,
    brandingDisplayName: input.brandingDisplayName.trim(),
    portalIntro: input.portalIntro.trim(),
    guidanceMarkdown: input.guidanceMarkdown.trim(),
    showAdvanceNotices: input.showAdvanceNotices,
    showAwards: input.showAwards,
    showBidderCounts: input.showBidderCounts,
    discloseBidderIdentities: input.discloseBidderIdentities,
    publicDocumentPolicy: input.publicDocumentPolicy,
    languages: [...input.languages],
    noticeFields: PORTAL_NOTICE_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      mandatory: field.mandatory,
      visible: field.mandatory || input.visibleNoticeFields.includes(field.key),
    })),
    channels: PUBLICATIONS_CHANNEL.map((channel) => ({
      channel,
      enabled: channel === 'portal' || (channel === 'external_notice' && external),
      mandatory: channel === 'portal',
      description: channel === 'external_notice' && external ? (input.externalNoticeDescription ?? null) : null,
    })),
  };
}

const SUBJECT = 'proposal';

function view(policy: FixturePortalPolicy, access: TenantAccess, userId: number): PortalPolicy {
  const tenant = findTenantById(policy.tenantId);
  if (tenant === undefined) throw new Error(`Portal policy for unknown tenant ${policy.tenantId}.`);
  const manage = holds(access, 'org.portal.manage');
  const proposal = policy.proposal;
  const inReview = proposal?.status === 'in_review';
  const decision =
    manage && proposal !== null && inReview ? selfApprovalFor(access, userId, proposal.proposedBy, 'org.portal.manage', SUBJECT) : null;
  return {
    tenantId: policy.tenantId,
    buyerSlug: tenant.slug,
    approved: policy.approved,
    approvedBy: policy.approvedBy === null ? null : personRef(policy.approvedBy),
    approvedAt: policy.approvedAt,
    proposal:
      proposal === null
        ? null
        : {
            id: proposal.id,
            status: proposal.status,
            settings: proposal.settings,
            changeNote: proposal.changeNote,
            proposedBy: personRef(proposal.proposedBy),
            proposedAt: proposal.proposedAt,
            submittedAt: proposal.submittedAt,
            returnedReason: proposal.returnedReason,
            changedSettings: changedSettings(policy.approved, proposal.settings),
          },
    impact: policy.impact,
    history: [...policy.history]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((entry) => ({
        id: entry.id,
        outcome: entry.outcome,
        summary: entry.summary,
        proposedBy: entry.proposedBy === null ? null : personRef(entry.proposedBy),
        by: personRef(entry.by),
        at: entry.at,
        underAlternativeOversight: entry.underAlternativeOversight,
      })),
    capabilities: {
      canPropose: manage && (proposal === null || proposal.status === 'draft'),
      canSubmit: manage && proposal?.status === 'draft',
      canApprove: manage && inReview && decision !== null && decision.allowed,
      canReturn: manage && inReview,
      canWithdraw: manage && proposal !== null,
      approvalBlockedReason: decision?.blockedReason ?? null,
      alternativeOversightNote: decision?.oversightNote ?? null,
    },
  };
}

function historyEntry(
  outcome: FixturePortalHistory['outcome'],
  summary: string,
  proposal: FixturePortalProposal,
  by: number,
  at: string,
  underAlternativeOversight = false,
): FixturePortalHistory {
  return { id: NEW_HISTORY_ID, outcome, summary, proposedBy: proposal.proposedBy, by, at, underAlternativeOversight };
}

export function registerPortal(app: MockApp): void {
  function policyOf(access: TenantAccess, notFound: (detail?: string) => never): FixturePortalPolicy {
    const policy = PORTAL_POLICIES.find((row) => row.tenantId === access.tenant.id);
    if (policy === undefined) return notFound('This organization has no public portal policy.');
    return policy;
  }

  function proposalOf(policy: FixturePortalPolicy, fail: Fail): FixturePortalProposal {
    if (policy.proposal === null) return fail(404, 'PORTAL_PROPOSAL_NOT_FOUND', 'There is no proposed change.');
    return policy.proposal;
  }

  mockRoute(app, getPortalPolicy, ({ requireTenant, requirePersona, notFound }) => {
    const access = requireTenant();
    return view(policyOf(access, notFound), access, requirePersona().userId);
  });

  mockRoute(app, savePortalProposal, ({ requireTenant, requirePersona, body, now, notFound, fail }) => {
    const access = requireTenant();
    const policy = policyOf(access, notFound);
    if (policy.proposal?.status === 'in_review') {
      return fail(409, 'PORTAL_PROPOSAL_IN_REVIEW', 'A proposal is in review; decide or return it before proposing another change.');
    }
    const settings = settingsFrom(body.settings);
    if (changedSettings(policy.approved, settings).length === 0) {
      return fail(409, 'PORTAL_PROPOSAL_UNCHANGED', 'The proposal does not change the approved settings.');
    }
    const at = now.toISOString();
    const userId = requirePersona().userId;
    const proposal: FixturePortalProposal = {
      id: policy.proposal?.id ?? NEW_PROPOSAL_ID,
      status: 'draft',
      settings,
      changeNote: body.changeNote,
      proposedBy: userId,
      proposedAt: at,
      submittedAt: null,
      returnedReason: null,
    };
    return view({ ...policy, proposal }, access, userId);
  });

  mockRoute(app, submitPortalProposal, ({ requireTenant, requirePersona, now, notFound, fail }) => {
    const access = requireTenant();
    const policy = policyOf(access, notFound);
    const proposal = proposalOf(policy, fail);
    if (proposal.status !== 'draft') return fail(409, 'PORTAL_PROPOSAL_NOT_DRAFT', 'The proposal is already in review.');
    return view(
      { ...policy, proposal: { ...proposal, status: 'in_review', submittedAt: now.toISOString(), returnedReason: null } },
      access,
      requirePersona().userId,
    );
  });

  mockRoute(app, approvePortalProposal, ({ requireTenant, requirePersona, now, notFound, fail }) => {
    const access = requireTenant();
    const policy = policyOf(access, notFound);
    const proposal = proposalOf(policy, fail);
    if (proposal.status !== 'in_review') return fail(409, 'PORTAL_PROPOSAL_NOT_IN_REVIEW', 'Submit the proposal before approving it.');
    const userId = requirePersona().userId;
    const decision = selfApprovalFor(access, userId, proposal.proposedBy, 'org.portal.manage', SUBJECT);
    if (!decision.allowed) return fail(403, 'SOD_SELF_APPROVAL_BLOCKED', decision.blockedReason ?? undefined);
    const at = now.toISOString();
    const oversight = decision.oversightNote !== null;
    const summary = `Approved: ${changedSettings(policy.approved, proposal.settings).join(', ')}.`;
    return view(
      {
        ...policy,
        approved: proposal.settings,
        approvedBy: userId,
        approvedAt: at,
        proposal: null,
        history: [historyEntry('approved', summary, proposal, userId, at, oversight), ...policy.history],
      },
      access,
      userId,
    );
  });

  mockRoute(app, returnPortalProposal, ({ requireTenant, requirePersona, body, now, notFound, fail }) => {
    const access = requireTenant();
    const policy = policyOf(access, notFound);
    const proposal = proposalOf(policy, fail);
    if (proposal.status !== 'in_review') return fail(409, 'PORTAL_PROPOSAL_NOT_IN_REVIEW', 'Only a proposal in review can be returned.');
    const userId = requirePersona().userId;
    const at = now.toISOString();
    return view(
      {
        ...policy,
        proposal: { ...proposal, status: 'draft', returnedReason: body.reason },
        history: [historyEntry('returned', `Returned: ${body.reason}`, proposal, userId, at), ...policy.history],
      },
      access,
      userId,
    );
  });

  mockRoute(app, withdrawPortalProposal, ({ requireTenant, requirePersona, now, notFound, fail }) => {
    const access = requireTenant();
    const policy = policyOf(access, notFound);
    const proposal = proposalOf(policy, fail);
    const userId = requirePersona().userId;
    return view(
      {
        ...policy,
        proposal: null,
        history: [
          historyEntry('withdrawn', 'Proposed change withdrawn; the approved settings stay in force.', proposal, userId, now.toISOString()),
          ...policy.history,
        ],
      },
      access,
      userId,
    );
  });

  mockRoute(app, getPublicPortalPolicy, ({ params, notFound }) => {
    const buyer = findTenantBySlug(params.buyerSlug);
    const policy = buyer === undefined ? undefined : PORTAL_POLICIES.find((row) => row.tenantId === buyer.id);
    if (buyer === undefined || buyer.kind !== 'buyer' || buyer.status !== 'active' || policy === undefined) {
      return notFound('No public buyer portal at this address.');
    }
    const settings = policy.approved;
    return {
      buyerSlug: buyer.slug,
      buyerName: buyer.name,
      publicPortalEnabled: settings.publicPortalEnabled,
      brandingDisplayName: settings.brandingDisplayName,
      portalIntro: settings.portalIntro,
      guidanceMarkdown: settings.guidanceMarkdown,
      showAdvanceNotices: settings.showAdvanceNotices,
      showAwards: settings.showAwards,
      showBidderCounts: settings.showBidderCounts,
      discloseBidderIdentities: settings.discloseBidderIdentities,
      publicDocumentPolicy: settings.publicDocumentPolicy,
      languages: [...settings.languages],
      visibleNoticeFields: settings.noticeFields.filter((field) => field.visible).map((field) => field.key),
      channels: settings.channels.filter((channel) => channel.enabled).map((channel) => channel.channel),
      approvedAt: policy.approvedAt,
    };
  });
}
