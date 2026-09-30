/**
 * Publication domain: shapes shared by the public portal, the buyer publication/participant screens and the
 * supplier opportunity screens (PRD §7.5, §7.6; FR-08, FR-09; BR-14, BR-15, BR-46; blueprint Migration 07
 * `publications`, Migration 08 `participants` … `notice_subscriptions`, Migration 13 `help_articles`,
 * `integration_exceptions`, Migration 03 `portal_settings`).
 *
 * Field names mirror the blueprint columns in camelCase. Public shapes never carry internal values (estimates,
 * budgets), supplier identities or restricted documents (PRD §4.3, DD-13 `v_public_tenders`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { READINESS_CHECK_STATUS } from '../enums.js';

export { READINESS_CHECK_STATUS };

import { Id, Instant, LinkPath, OfficialDeadline, Reference, Slug, TimeZone, issue } from '../common.js';
import { Sha256 } from '../documents.js';
import {
  AddendaExistingSubmissionAction,
  AddendaMateriality,
  DocumentsClassification,
  LotsStage,
  ParticipationConditionsConditionType,
  PortalSettingsPublicDocumentPolicy,
  TenderMilestonesMilestone,
  TendersEventType,
  TendersParticipation,
  TendersProcedure,
  TendersStatus,
} from '../enums.js';

// ---------------------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------------------

/**
 * The buyer organization of a notice (`tenants` id, slug and display name) with its official time zone
 * (`org_settings.official_time_zone`): every date of a buyer's notices, outcomes and forecasts renders in it (DD-33).
 */
export const BuyerLabel = z.object({
  tenantId: Id,
  slug: Slug,
  name: z.string().min(1),
  officialTimeZone: TimeZone,
});
export type BuyerLabel = z.infer<typeof BuyerLabel>;

/** A shared-taxonomy category code such as `WTR-PUMP` (`category_catalog.code`). */
export const CatalogCode = z
  .string()
  .regex(/^[A-Z]{2,6}(-[A-Z0-9]{2,10}){0,3}$/, issue('INVALID_CATEGORY', 'Use a catalog code such as WTR-PUMP.'));
export type CatalogCode = z.infer<typeof CatalogCode>;

/** A category from the shared taxonomy (`category_catalog`). */
export const CategoryLabel = z.object({
  code: CatalogCode,
  name: z.string().min(1),
  parentCode: CatalogCode.nullable(),
});
export type CategoryLabel = z.infer<typeof CategoryLabel>;

/** A region of delivery used by search filters and supplier matching. */
export const RegionName = z
  .string()
  .trim()
  .min(2, issue('INVALID_REGION', 'Use a region name.'))
  .max(80, issue('INVALID_REGION', 'At most 80 characters.'));

/** A tender row label used by buyer and supplier lists. */
export const TenderLabel = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
  eventType: TendersEventType,
  procedure: TendersProcedure,
  participation: TendersParticipation,
});
export type TenderLabel = z.infer<typeof TenderLabel>;

// ---------------------------------------------------------------------------------------------------------
// Notice content (public and supplier)
// ---------------------------------------------------------------------------------------------------------

/** A lot as published (`lots`): never the internal estimated value. */
export const NoticeLot = z.object({
  lotId: Id,
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  quantityDescription: z.string().nullable(),
  deliveryLocation: z.string().nullable(),
  stage: LotsStage,
  /** `lots.submission_deadline` when the lot has its own (DD-15); `null` = the tender's. */
  submissionDeadline: OfficialDeadline.nullable(),
  outcomeReason: z.string().nullable(),
});
export type NoticeLot = z.infer<typeof NoticeLot>;

/** A disclosed milestone (`tender_milestones` with `is_disclosed = true`), in official time. */
export const NoticeMilestone = z.object({
  milestone: TenderMilestonesMilestone,
  lotNo: z.number().int().min(1).nullable(),
  at: OfficialDeadline,
  note: z.string().nullable(),
});
export type NoticeMilestone = z.infer<typeof NoticeMilestone>;

/** An issued addendum as the amendment history shows it (`addenda` with `status = 'issued'`). */
export const NoticeAddendum = z.object({
  addendumId: Id,
  number: z.number().int().min(1),
  title: z.string().min(1),
  changeDescription: z.string().min(1),
  materiality: AddendaMateriality,
  issuedAt: Instant,
  resultingVersionNo: z.number().int().min(1),
  newSubmissionDeadline: OfficialDeadline.nullable(),
  affectedLotNos: z.array(z.number().int().min(1)),
  existingSubmissionAction: AddendaExistingSubmissionAction,
});
export type NoticeAddendum = z.infer<typeof NoticeAddendum>;

/** An issued version of the tender package (`tender_versions`). */
export const NoticeVersion = z.object({
  versionNo: z.number().int().min(1),
  issuedAt: Instant,
  changeSummary: z.string().min(1),
  addendumNo: z.number().int().min(1).nullable(),
});
export type NoticeVersion = z.infer<typeof NoticeVersion>;

/** A tender document with its current confirmed version (`documents` + `document_versions`). */
export const PackageDocument = z.object({
  documentId: Id,
  versionId: Id,
  title: z.string().min(1),
  classification: DocumentsClassification,
  language: z.string().min(2),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  sha256: Sha256,
  versionNo: z.number().int().min(1),
  precedence: z.number().int().min(1).nullable(),
  publishedAt: Instant,
  /** The addendum that issued this version, when it came from one. */
  addendumNo: z.number().int().min(1).nullable(),
});
export type PackageDocument = z.infer<typeof PackageDocument>;

/** A disclosed participation or document-access condition (`participation_conditions`, BR-15). */
export const NoticeCondition = z.object({
  conditionId: Id,
  conditionType: ParticipationConditionsConditionType,
  description: z.string().min(1),
  blocking: z.boolean(),
});
export type NoticeCondition = z.infer<typeof NoticeCondition>;

/** The public notice row of a search result (`v_public_tenders`, DD-13). */
export const PublicNoticeSummary = z.object({
  reference: Reference,
  buyer: BuyerLabel,
  title: z.string().min(1),
  summary: z.string().nullable(),
  eventType: TendersEventType,
  procedure: TendersProcedure,
  category: CategoryLabel,
  regions: z.array(z.string().min(1)),
  status: TendersStatus,
  /** True only while the response window is open (status `open` and the deadline is in the future). */
  isAcceptingResponses: z.boolean(),
  publishedAt: Instant,
  closingAt: OfficialDeadline.nullable(),
  lotCount: z.number().int().min(0),
  currentVersionNo: z.number().int().min(1),
  amendmentCount: z.number().int().min(0),
  lastAmendedAt: Instant.nullable(),
  /** `/opportunities/:buyerSlug/:ref` (DD-22). */
  linkPath: LinkPath,
});
export type PublicNoticeSummary = z.infer<typeof PublicNoticeSummary>;

/** The released outcome of a notice, when there is one. */
export const NoticeOutcome = z.object({
  summary: z.string().min(1),
  /** `/awards/:buyerSlug/:ref` when an award notice is published (PUB-05); `null` otherwise. */
  awardLinkPath: LinkPath.nullable(),
});
export type NoticeOutcome = z.infer<typeof NoticeOutcome>;

/** The cancellation of a notice. */
export const NoticeCancellation = z.object({
  cancelledAt: Instant,
  reason: z.string().min(1),
});
export type NoticeCancellation = z.infer<typeof NoticeCancellation>;

/** The routes into participation the notice offers (PUB-03). */
export const ParticipationRoutes = z.object({
  registerInterest: z.boolean(),
  requestAccess: z.boolean(),
  startParticipation: z.boolean(),
});
export type ParticipationRoutes = z.infer<typeof ParticipationRoutes>;

/** A public notice page (PUB-03): scope, lots, eligibility, deadlines, documents, amendments and status. */
export const PublicNotice = PublicNoticeSummary.extend({
  officialTimeZone: TimeZone,
  eligibilitySummary: z.string().nullable(),
  deliveryRequirements: z.string().nullable(),
  submissionRules: z.string().nullable(),
  /** The official contact channel (`tenders.communication_channel_note`). */
  communicationChannelNote: z.string().nullable(),
  acceptedLanguages: z.array(z.string().min(2)),
  lots: z.array(NoticeLot),
  milestones: z.array(NoticeMilestone),
  /** Public documents only (`classification = 'public'`); restricted documents are never listed. */
  documents: z.array(PackageDocument),
  /** `portal_settings.public_document_policy` of the buyer. */
  documentPolicy: PortalSettingsPublicDocumentPolicy,
  /** How many further documents require access approval or registration (never their titles). */
  restrictedDocumentCount: z.number().int().min(0),
  conditions: z.array(NoticeCondition),
  addenda: z.array(NoticeAddendum),
  versions: z.array(NoticeVersion),
  cancellation: NoticeCancellation.nullable(),
  outcome: NoticeOutcome.nullable(),
  participationRoutes: ParticipationRoutes,
  /** `/clarifications/:buyerSlug/:ref` (PUB-04). */
  clarificationsLinkPath: LinkPath,
});
export type PublicNotice = z.infer<typeof PublicNotice>;

// ---------------------------------------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------------------------------------

/** The state of one readiness check (the ReadinessChecklist statuses). */
export const ReadinessCheckStatus = z.enum(READINESS_CHECK_STATUS);
export type ReadinessCheckStatus = z.infer<typeof ReadinessCheckStatus>;

/** One readiness check, with a stable id the SPA uses to link to the fixing action. */
export const ReadinessCheck = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  status: ReadinessCheckStatus,
  detail: z.string().nullable(),
});
export type ReadinessCheck = z.infer<typeof ReadinessCheck>;
