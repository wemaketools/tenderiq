/**
 * Public portal and publication policy (ADM-11; BR-15, BR-34, BR-46, PRD §4.3, §18.1; blueprint Migration 02
 * `org_settings` public fields and Migration 03 `portal_settings`; DD-13, DD-22).
 *
 * - The approved settings govern what the public portal discloses: advance notices, award notices, bidder counts,
 *   when bidder identities become public, who may download tender documents, languages, released branding and
 *   guidance, notice fields and publication channels.
 * - Changes are proposed, submitted and approved; until approval the portal keeps the approved settings. The
 *   approval history stays visible.
 * - Mandatory controls cannot be hidden: the mandatory notice fields and the portal channel are always shown
 *   (`MANDATORY_CONTROL_HIDDEN`). Eligibility never depends on a supplier's subscription (BR-46).
 * - `public.policy.portal` exposes only the APPROVED settings of a buyer, never a pending proposal.
 * - Whoever proposed a change cannot approve it (BR-07, `SOD_SELF_APPROVAL_BLOCKED`, 403) unless nobody else holds
 *   `org.portal.manage` and the organization documented alternative oversight; the note is then shown
 *   (`capabilities.alternativeOversightNote`) and the history records that the approval relied on it.
 *
 * Stage B storage mapping (blueprint amendment, see the policy domain follow-ups):
 * - Approved settings: `portal_settings` plus the added columns `visible_notice_fields text[]`, `channels text[]`
 *   and `external_notice_description text`; display name, intro, guidance and `public_portal_enabled` stay on
 *   `org_settings`.
 * - Proposals: a `portal_settings_proposals` table (tenant_id, status draft|in_review, settings jsonb in the
 *   `PortalSettings` shape, change_note, proposed_by, proposed_at, submitted_at, returned_reason) and an
 *   `approval_requests.subject_type` value `portal_settings` for the decision.
 * - History: `audit_log` entries of the proposal (approved, returned, withdrawn) with the proposer, the decider
 *   and whether alternative oversight applied.
 * - Alternative oversight: a `sod_policies` row with rule code `configuration_approval`.
 */
import { z } from 'zod';

import { Id, Instant, PersonRef, Slug, issue } from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  PolicyProfileVersionsStatus,
  PortalSettingsDiscloseBidderIdentities,
  PortalSettingsPublicDocumentPolicy,
  PublicationsChannel,
} from '../enums.js';
import { ReasonBody } from './profiles.js';
import { PORTAL_POLICY_READ } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Notice fields and channels
// ---------------------------------------------------------------------------------------------------------

/** The fields a public notice can show; mandatory ones can never be hidden (BR-11, BR-15, PRD §17.3). */
export const PORTAL_NOTICE_FIELDS = [
  { key: 'reference', label: 'Reference', mandatory: true },
  { key: 'title', label: 'Title', mandatory: true },
  { key: 'buyer_name', label: 'Buying organization', mandatory: true },
  { key: 'procedure', label: 'Procedure and participation', mandatory: true },
  { key: 'official_deadline', label: 'Official deadline with time zone', mandatory: true },
  { key: 'document_access', label: 'How to obtain the documents', mandatory: true },
  { key: 'clarification_route', label: 'Clarification route and question deadline', mandatory: true },
  { key: 'summary', label: 'Summary of scope', mandatory: false },
  { key: 'category', label: 'Category', mandatory: false },
  { key: 'lots', label: 'Lots', mandatory: false },
  { key: 'estimated_value', label: 'Estimated value', mandatory: false },
  { key: 'site_visits', label: 'Briefings and site visits', mandatory: false },
  { key: 'contact_person', label: 'Named contact person', mandatory: false },
  { key: 'evaluation_summary', label: 'Evaluation method summary', mandatory: false },
] as const;
export type PortalNoticeFieldKey = (typeof PORTAL_NOTICE_FIELDS)[number]['key'];
export const PORTAL_NOTICE_FIELD_KEYS = PORTAL_NOTICE_FIELDS.map((field) => field.key) as [
  PortalNoticeFieldKey,
  ...PortalNoticeFieldKey[],
];
export const PortalNoticeFieldKeySchema = z.enum(PORTAL_NOTICE_FIELD_KEYS);
/** The mandatory notice fields. */
export const MANDATORY_NOTICE_FIELD_KEYS: readonly PortalNoticeFieldKey[] = PORTAL_NOTICE_FIELDS.filter(
  (field) => field.mandatory,
).map((field) => field.key);
/** The portal channel is mandatory; an external notice channel is optional. */
export const MANDATORY_CHANNELS: readonly z.infer<typeof PublicationsChannel>[] = ['portal'];

/** A language code such as `en` or `tn` (BCP 47 primary tag). The UI itself is English only (DD-37). */
export const PortalLanguage = z.string().regex(/^[a-z]{2,3}$/, issue('INVALID_LANGUAGE', 'Use a language code such as en.'));

export const PortalNoticeField = z.object({
  key: PortalNoticeFieldKeySchema,
  label: z.string().min(1),
  mandatory: z.boolean(),
  visible: z.boolean(),
});
export type PortalNoticeField = z.infer<typeof PortalNoticeField>;

export const PortalChannel = z.object({
  channel: PublicationsChannel,
  enabled: z.boolean(),
  mandatory: z.boolean(),
  /** For the external notice channel: where notices are also advertised. */
  description: z.string().nullable(),
});
export type PortalChannel = z.infer<typeof PortalChannel>;

/** The disclosure settings themselves (`portal_settings` + the released `org_settings` public fields). */
export const PortalSettings = z.object({
  publicPortalEnabled: z.boolean(),
  brandingDisplayName: z.string().min(1),
  portalIntro: z.string(),
  guidanceMarkdown: z.string(),
  showAdvanceNotices: z.boolean(),
  showAwards: z.boolean(),
  showBidderCounts: z.boolean(),
  discloseBidderIdentities: PortalSettingsDiscloseBidderIdentities,
  publicDocumentPolicy: PortalSettingsPublicDocumentPolicy,
  languages: z.array(PortalLanguage).min(1),
  noticeFields: z.array(PortalNoticeField),
  channels: z.array(PortalChannel),
});
export type PortalSettings = z.infer<typeof PortalSettings>;

/** A proposed change awaiting submission or approval. Status is `draft` or `in_review`. */
export const PortalProposal = z.object({
  id: Id,
  status: PolicyProfileVersionsStatus,
  settings: PortalSettings,
  changeNote: z.string(),
  proposedBy: PersonRef,
  proposedAt: Instant,
  submittedAt: Instant.nullable(),
  returnedReason: z.string().nullable(),
  /** The setting names that differ from the approved settings. */
  changedSettings: z.array(z.string().min(1)),
});
export type PortalProposal = z.infer<typeof PortalProposal>;

/** One approved, returned or withdrawn change in the history. */
export const PortalPolicyHistoryEntry = z.object({
  id: Id,
  outcome: z.enum(['approved', 'returned', 'withdrawn']),
  summary: z.string().min(1),
  /** Who proposed the change, when known. */
  proposedBy: PersonRef.nullable(),
  /** Who decided (approved, returned) or withdrew it. */
  by: PersonRef,
  at: Instant,
  /** True when the proposer approved their own change under documented alternative oversight (BR-07). */
  underAlternativeOversight: z.boolean(),
});
export type PortalPolicyHistoryEntry = z.infer<typeof PortalPolicyHistoryEntry>;

/** What a change affects on the public portal now. */
export const PortalImpact = z.object({
  publicTenderCount: z.number().int().min(0),
  publishedAwardCount: z.number().int().min(0),
  advanceNoticeCount: z.number().int().min(0),
});

export const PortalPolicyCapabilities = z.object({
  canPropose: z.boolean(),
  canSubmit: z.boolean(),
  canApprove: z.boolean(),
  canReturn: z.boolean(),
  canWithdraw: z.boolean(),
  /** Why approval is blocked for this caller (e.g. they proposed the change, BR-07), or null. */
  approvalBlockedReason: z.string().nullable(),
  /**
   * The documented alternative oversight the caller's approval relies on, when the caller proposed the change and
   * nobody else holds `org.portal.manage`; null otherwise.
   */
  alternativeOversightNote: z.string().nullable(),
});

export const PortalPolicy = z.object({
  tenantId: Id,
  buyerSlug: Slug,
  approved: PortalSettings,
  approvedBy: PersonRef.nullable(),
  approvedAt: Instant.nullable(),
  proposal: PortalProposal.nullable(),
  impact: PortalImpact,
  history: z.array(PortalPolicyHistoryEntry),
  capabilities: PortalPolicyCapabilities,
});
export type PortalPolicy = z.infer<typeof PortalPolicy>;

/** The public projection of the APPROVED settings (PUB screens and the publication domain). */
export const PublicPortalPolicy = z.object({
  buyerSlug: Slug,
  buyerName: z.string().min(1),
  publicPortalEnabled: z.boolean(),
  brandingDisplayName: z.string().min(1),
  portalIntro: z.string(),
  guidanceMarkdown: z.string(),
  showAdvanceNotices: z.boolean(),
  showAwards: z.boolean(),
  showBidderCounts: z.boolean(),
  discloseBidderIdentities: PortalSettingsDiscloseBidderIdentities,
  publicDocumentPolicy: PortalSettingsPublicDocumentPolicy,
  languages: z.array(PortalLanguage),
  visibleNoticeFields: z.array(PortalNoticeFieldKeySchema),
  channels: z.array(PublicationsChannel),
  approvedAt: Instant.nullable(),
});
export type PublicPortalPolicy = z.infer<typeof PublicPortalPolicy>;

// ---------------------------------------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------------------------------------

export const PortalSettingsInput = z
  .object({
    publicPortalEnabled: z.boolean(),
    brandingDisplayName: z.string().trim().min(2, issue('DISPLAY_NAME_REQUIRED', 'Give the public display name.')).max(200),
    portalIntro: z.string().trim().max(4000),
    guidanceMarkdown: z.string().trim().max(20_000),
    showAdvanceNotices: z.boolean(),
    showAwards: z.boolean(),
    showBidderCounts: z.boolean(),
    discloseBidderIdentities: PortalSettingsDiscloseBidderIdentities,
    publicDocumentPolicy: PortalSettingsPublicDocumentPolicy,
    languages: z
      .array(PortalLanguage)
      .min(1, issue('LANGUAGE_REQUIRED', 'Choose at least one portal language.'))
      .refine((codes) => new Set(codes).size === codes.length, issue('DUPLICATE_LANGUAGE', 'Each language may appear once.')),
    /** The notice fields to show. Every mandatory field must be included. */
    visibleNoticeFields: z.array(PortalNoticeFieldKeySchema),
    /** The channels to use. The portal channel must be included. */
    channels: z.array(PublicationsChannel).min(1),
    externalNoticeDescription: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((value, context) => {
    const hidden = MANDATORY_NOTICE_FIELD_KEYS.filter((key) => !value.visibleNoticeFields.includes(key));
    if (hidden.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['visibleNoticeFields'],
        message: issue('MANDATORY_CONTROL_HIDDEN', `Mandatory notice fields cannot be hidden: ${hidden.join(', ')}.`),
      });
    }
    if (!MANDATORY_CHANNELS.every((channel) => value.channels.includes(channel))) {
      context.addIssue({
        code: 'custom',
        path: ['channels'],
        message: issue('MANDATORY_CONTROL_HIDDEN', 'The portal channel is mandatory.'),
      });
    }
    if (value.channels.includes('external_notice') && (value.externalNoticeDescription ?? '').length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['externalNoticeDescription'],
        message: issue('EXTERNAL_CHANNEL_DESCRIPTION_REQUIRED', 'Name where external notices are advertised.'),
      });
    }
    if (value.showBidderCounts === false && value.discloseBidderIdentities === 'after_opening') {
      context.addIssue({
        code: 'custom',
        path: ['discloseBidderIdentities'],
        message: issue('DISCLOSURE_INCONSISTENT', 'Publishing bidder names after opening also discloses how many bid; show bidder counts too.'),
      });
    }
  });
export type PortalSettingsInput = z.input<typeof PortalSettingsInput>;

export const SavePortalProposalBody = z.object({
  settings: PortalSettingsInput,
  changeNote: z.string().trim().min(3, issue('CHANGE_NOTE_REQUIRED', 'Explain the change.')).max(2000),
});
export type SavePortalProposalBody = z.input<typeof SavePortalProposalBody>;

export const ApprovePortalProposalBody = z.object({
  /** Confirms the public-facing content was reviewed for confidentiality and personal data (BR-34). */
  disclosureReviewed: z.literal(true, { error: issue('DISCLOSURE_REVIEW_REQUIRED', 'Confirm the disclosure review.') }),
  note: z.string().trim().max(2000).optional(),
});
export type ApprovePortalProposalBody = z.input<typeof ApprovePortalProposalBody>;

export const PublicPortalParams = z.object({ buyerSlug: Slug });

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/buyer/policy/portal (ADM-11): approved settings, any proposal, history and impact. */
export const getPortalPolicy = defineEndpoint({
  id: 'buyer.policy.getPortal',
  method: 'GET',
  path: '/api/v1/buyer/policy/portal',
  audience: 'buyer',
  permission: PORTAL_POLICY_READ,
  response: PortalPolicy,
  errors: [],
  screens: ['ADM-11'],
});

/** PUT /api/v1/buyer/policy/portal/proposal: creates or replaces the DRAFT proposal. */
export const savePortalProposal = defineEndpoint({
  id: 'buyer.policy.savePortalProposal',
  method: 'PUT',
  path: '/api/v1/buyer/policy/portal/proposal',
  audience: 'buyer',
  permission: 'org.portal.manage',
  body: SavePortalProposalBody,
  response: PortalPolicy,
  errors: ['PORTAL_PROPOSAL_IN_REVIEW', 'PORTAL_PROPOSAL_UNCHANGED'],
  screens: ['ADM-11'],
});

/** POST /api/v1/buyer/policy/portal/proposal/submit: draft → in review. */
export const submitPortalProposal = defineEndpoint({
  id: 'buyer.policy.submitPortalProposal',
  method: 'POST',
  path: '/api/v1/buyer/policy/portal/proposal/submit',
  audience: 'buyer',
  permission: 'org.portal.manage',
  response: PortalPolicy,
  errors: ['PORTAL_PROPOSAL_NOT_FOUND', 'PORTAL_PROPOSAL_NOT_DRAFT'],
  screens: ['ADM-11'],
});

/** POST …/portal/proposal/approve: the proposal becomes the approved disclosure settings. */
export const approvePortalProposal = defineEndpoint({
  id: 'buyer.policy.approvePortalProposal',
  method: 'POST',
  path: '/api/v1/buyer/policy/portal/proposal/approve',
  audience: 'buyer',
  permission: 'org.portal.manage',
  body: ApprovePortalProposalBody,
  response: PortalPolicy,
  errors: ['PORTAL_PROPOSAL_NOT_FOUND', 'PORTAL_PROPOSAL_NOT_IN_REVIEW', 'SOD_SELF_APPROVAL_BLOCKED'],
  screens: ['ADM-11'],
});

/** POST …/portal/proposal/return: in review → draft with the reviewer's reason. */
export const returnPortalProposal = defineEndpoint({
  id: 'buyer.policy.returnPortalProposal',
  method: 'POST',
  path: '/api/v1/buyer/policy/portal/proposal/return',
  audience: 'buyer',
  permission: 'org.portal.manage',
  body: ReasonBody,
  response: PortalPolicy,
  errors: ['PORTAL_PROPOSAL_NOT_FOUND', 'PORTAL_PROPOSAL_NOT_IN_REVIEW'],
  screens: ['ADM-11'],
});

/** DELETE /api/v1/buyer/policy/portal/proposal: withdraws the proposal; the approved settings stay. */
export const withdrawPortalProposal = defineEndpoint({
  id: 'buyer.policy.withdrawPortalProposal',
  method: 'DELETE',
  path: '/api/v1/buyer/policy/portal/proposal',
  audience: 'buyer',
  permission: 'org.portal.manage',
  response: PortalPolicy,
  errors: ['PORTAL_PROPOSAL_NOT_FOUND'],
  screens: ['ADM-11'],
});

/** GET /api/v1/public/portal-policies/:buyerSlug: the approved disclosure settings of a buyer's public portal. */
export const getPublicPortalPolicy = defineEndpoint({
  id: 'public.policy.portal',
  method: 'GET',
  path: '/api/v1/public/portal-policies/:buyerSlug',
  audience: 'public',
  params: PublicPortalParams,
  response: PublicPortalPolicy,
  errors: [],
  screens: ['PUB-01', 'ADM-11'],
});

export const portalRoutes = {
  getPortalPolicy,
  savePortalProposal,
  submitPortalProposal,
  approvePortalProposal,
  returnPortalProposal,
  withdrawPortalProposal,
  getPublicPortalPolicy,
} as const;
