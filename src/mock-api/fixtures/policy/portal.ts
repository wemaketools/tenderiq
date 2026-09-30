/**
 * Public portal and publication policy (ADM-11). KWU has approved settings plus a proposal in review that would
 * show bidder counts and publish bidder names after opening. ODC has approved settings and no proposal. Supplier
 * and operator tenants have no portal (portal_settings is a buyer configuration).
 *
 * Actors follow the permission model: only the organization administrator of each buyer holds
 * `org.portal.manage`, so every proposal and decision is theirs, and each approval of their own proposal relies on
 * the documented alternative oversight in `./governance.ts` (BR-07), recorded as `underAlternativeOversight`.
 */
import type { PortalSettings } from '../../../contracts/policy.js';
import { PORTAL_NOTICE_FIELDS } from '../../../contracts/policy.js';
import type { PolicyProfileVersionsStatus } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

export interface FixturePortalProposal {
  readonly id: number;
  readonly status: Extract<PolicyProfileVersionsStatus, 'draft' | 'in_review'>;
  readonly settings: PortalSettings;
  readonly changeNote: string;
  readonly proposedBy: number;
  readonly proposedAt: string;
  readonly submittedAt: string | null;
  readonly returnedReason: string | null;
}

export interface FixturePortalHistory {
  readonly id: number;
  readonly outcome: 'approved' | 'returned' | 'withdrawn';
  readonly summary: string;
  readonly proposedBy: number | null;
  readonly by: number;
  readonly at: string;
  readonly underAlternativeOversight: boolean;
}

export interface FixturePortalPolicy {
  readonly tenantId: number;
  readonly approved: PortalSettings;
  readonly approvedBy: number | null;
  readonly approvedAt: string | null;
  readonly proposal: FixturePortalProposal | null;
  readonly impact: { readonly publicTenderCount: number; readonly publishedAwardCount: number; readonly advanceNoticeCount: number };
  readonly history: readonly FixturePortalHistory[];
}

function noticeFields(hidden: readonly string[]): PortalSettings['noticeFields'] {
  return PORTAL_NOTICE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    mandatory: field.mandatory,
    visible: field.mandatory || !hidden.includes(field.key),
  }));
}

const KWU_APPROVED: PortalSettings = {
  publicPortalEnabled: true,
  brandingDisplayName: 'Kalahari Water Utilities',
  portalIntro:
    'Kalahari Water Utilities buys pumps, pipes, meters, treatment chemicals, works and services for water supply across Botswana. Browse open opportunities, procurement plans and award notices below.',
  guidanceMarkdown:
    '## Taking part\n\n1. Register your organization on TenderIQ (free of charge).\n2. Apply for qualification where a tender requires it.\n3. Ask questions before the question deadline; answers are published to every participant.\n4. Submit before the official deadline. Late submissions are not accepted.\n\nAll deadlines are stated in the official time zone Africa/Gaborone.',
  showAdvanceNotices: true,
  showAwards: true,
  showBidderCounts: false,
  discloseBidderIdentities: 'after_award',
  publicDocumentPolicy: 'registered',
  languages: ['en'],
  noticeFields: noticeFields(['estimated_value', 'contact_person']),
  channels: [
    { channel: 'portal', enabled: true, mandatory: true, description: null },
    { channel: 'external_notice', enabled: true, mandatory: false, description: 'Daily News (Botswana), tenders section' },
  ],
};

const KWU_PROPOSED: PortalSettings = {
  ...KWU_APPROVED,
  showBidderCounts: true,
  discloseBidderIdentities: 'after_opening',
  languages: ['en', 'tn'],
  noticeFields: noticeFields(['estimated_value']),
};

const ODC_APPROVED: PortalSettings = {
  publicPortalEnabled: true,
  brandingDisplayName: 'Okavango District Council',
  portalIntro: 'Okavango District Council procurement opportunities for council services and facilities.',
  guidanceMarkdown: '## Taking part\n\nRegister on TenderIQ, then submit your quotation before the official deadline (Africa/Gaborone).',
  showAdvanceNotices: false,
  showAwards: true,
  showBidderCounts: true,
  discloseBidderIdentities: 'after_award',
  publicDocumentPolicy: 'public',
  languages: ['en'],
  noticeFields: noticeFields(['lots', 'site_visits', 'evaluation_summary']),
  channels: [
    { channel: 'portal', enabled: true, mandatory: true, description: null },
    { channel: 'external_notice', enabled: false, mandatory: false, description: null },
  ],
};

export const PORTAL_POLICIES: readonly FixturePortalPolicy[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    approved: KWU_APPROVED,
    approvedBy: 3,
    approvedAt: '2026-05-12T09:00:00Z',
    proposal: {
      id: 12,
      status: 'in_review',
      settings: KWU_PROPOSED,
      changeNote:
        'Show how many bids each tender received and publish bidder names once envelopes are opened, as recommended by the internal audit review; add Setswana to the portal languages.',
      proposedBy: 3,
      proposedAt: '2026-09-18T08:30:00Z',
      submittedAt: '2026-09-18T09:00:00Z',
      returnedReason: null,
    },
    impact: { publicTenderCount: 7, publishedAwardCount: 2, advanceNoticeCount: 2 },
    history: [
      {
        id: 11, outcome: 'approved', summary: 'Award notices shown; tender documents limited to registered suppliers.',
        proposedBy: 3, by: 3, at: '2026-05-12T09:00:00Z', underAlternativeOversight: true,
      },
      {
        id: 10, outcome: 'withdrawn', summary: 'Proposal to show estimated values withdrawn after Internal Audit advised that budget figures are internal.',
        proposedBy: 3, by: 3, at: '2026-04-28T14:00:00Z', underAlternativeOversight: false,
      },
      {
        id: 9, outcome: 'approved', summary: 'Portal launched with advance notices and the Daily News external channel.',
        proposedBy: 3, by: 3, at: '2025-12-01T08:00:00Z', underAlternativeOversight: true,
      },
    ],
  },
  {
    tenantId: TENANT_IDS.odc,
    approved: ODC_APPROVED,
    approvedBy: 22,
    approvedAt: '2026-02-02T10:30:00Z',
    proposal: null,
    impact: { publicTenderCount: 1, publishedAwardCount: 0, advanceNoticeCount: 0 },
    history: [
      { id: 20, outcome: 'approved', summary: 'Council portal launched.', proposedBy: 22, by: 22, at: '2026-02-02T10:30:00Z', underAlternativeOversight: true },
    ],
  },
]);
