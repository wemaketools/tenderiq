/**
 * Public portal endpoints (PUB-01, PUB-02, PUB-03, PUB-07; FR-08; BR-15, BR-46; AC-01; DD-13, DD-22, DD-28).
 *
 * - No account is needed. Only `v_public_tenders` rows appear: `participation = 'open'`, the buyer's public portal
 *   is enabled, and the status is public-safe. Invitation-only and restricted events never appear, not even in
 *   counts or filter options (AC-01, BR-43).
 * - Closed and cancelled notices stay listed and are labelled by their status; `isAcceptingResponses` tells the
 *   SPA whether the response window is open.
 * - Public documents follow the buyer's `portal_settings.public_document_policy`: `registered` or `invitation`
 *   policies answer `DOCUMENT_REQUIRES_REGISTRATION` / `DOCUMENT_REQUIRES_INVITATION`.
 * - The one public write (register interest without an account) is rate limited per IP and e-mail hash
 *   (DD-28): `RATE_LIMITED` is a platform code.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { CalendarDate, Id, IdParam, Instant, LinkPath, Reference, Slug, TimeZone, issue, listQueryWithSort, pageOf, queryList } from '../common.js';
import { DownloadLink } from '../documents.js';
import { defineEndpoint } from '../endpoint.js';
import {
  HelpArticlesAudience,
  HelpArticlesTopic,
  TendersEventType,
  TendersProcedure,
  TendersStatus,
} from '../enums.js';
import { BuyerLabel, CatalogCode, CategoryLabel, PublicNotice, PublicNoticeSummary } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Guidance (help_articles, PUB-07)
// ---------------------------------------------------------------------------------------------------------

/** A help article row (`help_articles`, published, audience public or all). */
export const HelpArticleSummary = z.object({
  slug: Slug,
  title: z.string().min(1),
  topic: HelpArticlesTopic,
  audience: HelpArticlesAudience,
  language: z.string().min(2),
  excerpt: z.string().min(1),
  publishedAt: Instant,
  /** The platform's official time zone (`platform_settings`), in which the article dates render (DD-33). */
  officialTimeZone: TimeZone,
  linkPath: LinkPath,
});
export type HelpArticleSummary = z.infer<typeof HelpArticleSummary>;

/** A full help article. General guidance never overrides the binding conditions of a tender (PUB-07). */
export const HelpArticle = HelpArticleSummary.extend({
  bodyMarkdown: z.string().min(1),
  updatedAt: Instant,
  related: z.array(HelpArticleSummary),
});
export type HelpArticle = z.infer<typeof HelpArticle>;

export const GUIDANCE_SORT_FIELDS = ['title', 'topic', 'publishedAt'] as const;
export const GuidanceListQuery = listQueryWithSort(GUIDANCE_SORT_FIELDS).extend({
  topic: queryList(HelpArticlesTopic).optional(),
});
export type GuidanceListQuery = z.input<typeof GuidanceListQuery>;

export const GuidanceParams = z.object({ articleSlug: Slug });

// ---------------------------------------------------------------------------------------------------------
// Home (PUB-01)
// ---------------------------------------------------------------------------------------------------------

/** A buyer with an enabled public portal. */
export const PortalBuyerCard = BuyerLabel.extend({
  legalName: z.string().min(1),
  portalIntro: z.string().nullable(),
  openOpportunityCount: z.number().int().min(0),
  linkPath: LinkPath,
});
export type PortalBuyerCard = z.infer<typeof PortalBuyerCard>;

/** A released outcome teaser (the award notice itself is PUB-05). */
export const RecentOutcome = z.object({
  reference: Reference,
  buyer: BuyerLabel,
  title: z.string().min(1),
  status: TendersStatus,
  decidedAt: Instant,
  summary: z.string().min(1),
  linkPath: LinkPath,
});
export type RecentOutcome = z.infer<typeof RecentOutcome>;

/** A published advance notice teaser (`advance_notices`, PUB-06). Forecasts are not invitations to bid. */
export const AdvanceNoticeTeaser = z.object({
  advanceNoticeId: Id,
  buyer: BuyerLabel,
  title: z.string().min(1),
  summary: z.string().min(1),
  indicativeTiming: z.string().min(1),
  category: CategoryLabel,
  publishedAt: Instant,
  linkPath: LinkPath,
});
export type AdvanceNoticeTeaser = z.infer<typeof AdvanceNoticeTeaser>;

/** The global public home (PUB-01). */
export const PortalHome = z.object({
  buyers: z.array(PortalBuyerCard),
  /** The most recently published notices still accepting responses. */
  openOpportunities: z.array(PublicNoticeSummary),
  openOpportunityCount: z.number().int().min(0),
  recentOutcomes: z.array(RecentOutcome),
  advanceNotices: z.array(AdvanceNoticeTeaser),
  guidance: z.array(HelpArticleSummary),
  languages: z.array(z.string().min(2)),
});
export type PortalHome = z.infer<typeof PortalHome>;

/** A buyer's public home at `/b/:buyerSlug` (PUB-01). */
export const BuyerPortal = z.object({
  buyer: PortalBuyerCard,
  officialTimeZone: z.string().min(1),
  showAdvanceNotices: z.boolean(),
  showAwards: z.boolean(),
  openOpportunities: z.array(PublicNoticeSummary),
  recentOutcomes: z.array(RecentOutcome),
  advanceNotices: z.array(AdvanceNoticeTeaser),
  guidance: z.array(HelpArticleSummary),
  /** The buyer's own participation guidance (`org_settings.guidance_markdown`). */
  guidanceMarkdown: z.string().nullable(),
  languages: z.array(z.string().min(2)),
});
export type BuyerPortal = z.infer<typeof BuyerPortal>;

export const BuyerSlugParams = z.object({ buyerSlug: Slug });

// ---------------------------------------------------------------------------------------------------------
// Search (PUB-02)
// ---------------------------------------------------------------------------------------------------------

export const PUBLIC_NOTICE_SORT_FIELDS = ['publishedAt', 'closingAt', 'title', 'buyer'] as const;

export const PublicOpportunityQuery = listQueryWithSort(PUBLIC_NOTICE_SORT_FIELDS).extend({
  buyer: queryList(Slug).optional(),
  category: queryList(CatalogCode).optional(),
  region: queryList(z.string().min(2).max(80)).optional(),
  procedure: queryList(TendersProcedure).optional(),
  eventType: queryList(TendersEventType).optional(),
  status: queryList(TendersStatus).optional(),
  publishedFrom: CalendarDate.optional(),
  publishedTo: CalendarDate.optional(),
  closingFrom: CalendarDate.optional(),
  closingTo: CalendarDate.optional(),
});
export type PublicOpportunityQuery = z.input<typeof PublicOpportunityQuery>;

export const PublicOpportunityPage = pageOf(PublicNoticeSummary);
export type PublicOpportunityPage = z.infer<typeof PublicOpportunityPage>;

/** A filter option with the count of visible public notices that carry it. */
export const FilterOption = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  count: z.number().int().min(0),
});
export type FilterOption = z.infer<typeof FilterOption>;

/** The filter options of the public search, counted over public notices only (AC-01, BR-43). */
export const PublicOpportunityFilters = z.object({
  buyers: z.array(FilterOption),
  categories: z.array(FilterOption),
  regions: z.array(FilterOption),
  procedures: z.array(FilterOption),
  eventTypes: z.array(FilterOption),
  statuses: z.array(FilterOption),
  total: z.number().int().min(0),
});
export type PublicOpportunityFilters = z.infer<typeof PublicOpportunityFilters>;

// ---------------------------------------------------------------------------------------------------------
// Notice (PUB-03)
// ---------------------------------------------------------------------------------------------------------

export const NoticeParams = z.object({ buyerSlug: Slug, reference: Reference });
export const NoticeDocumentParams = z.object({ buyerSlug: Slug, reference: Reference, documentId: IdParam });

/** Register interest without an account: the contact receives the registration route (DD-28 rate limited). */
export const PublicInterestBody = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, issue('CONTACT_NAME_REQUIRED', 'Enter your name.'))
    .max(120, issue('TEXT_TOO_LONG', 'At most 120 characters.')),
  email: z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.')).max(254, issue('TEXT_TOO_LONG', 'At most 254 characters.')),
  organizationName: z
    .string()
    .trim()
    .min(2, issue('ORGANIZATION_NAME_REQUIRED', 'Enter the legal name of your organization.'))
    .max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.')),
  consentToContact: z.literal(true, { error: issue('CONSENT_REQUIRED', 'Confirm that the buyer may contact you about this notice.') }),
});
export type PublicInterestBody = z.infer<typeof PublicInterestBody>;

/** The outcome of a public interest registration. */
export const PublicInterestReceipt = z.object({
  reference: Reference,
  buyer: BuyerLabel,
  receivedAt: Instant,
  /** What the visitor does next: register an organization or sign in to an existing one. */
  nextStep: z.enum(['register', 'sign_in']),
  nextStepPath: LinkPath,
});
export type PublicInterestReceipt = z.infer<typeof PublicInterestReceipt>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/public/portal: the global public home (PUB-01). */
export const getPortalHome = defineEndpoint({
  id: 'public.publication.home',
  method: 'GET',
  path: '/api/v1/public/portal',
  audience: 'public',
  response: PortalHome,
  errors: [],
  screens: ['PUB-01'],
  summary: 'Buyers with a public portal, open notices, recent outcomes, advance notices and guidance.',
});

/** GET /api/v1/public/buyers/:buyerSlug: one buyer's public home (PUB-01). */
export const getBuyerPortal = defineEndpoint({
  id: 'public.publication.buyerHome',
  method: 'GET',
  path: '/api/v1/public/buyers/:buyerSlug',
  audience: 'public',
  params: BuyerSlugParams,
  response: BuyerPortal,
  errors: ['PORTAL_NOT_AVAILABLE'],
  screens: ['PUB-01'],
  summary: 'A buyer portal; unknown buyers and disabled portals answer PORTAL_NOT_AVAILABLE (404).',
});

/** GET /api/v1/public/opportunities: search public notices (PUB-02). */
export const searchPublicOpportunities = defineEndpoint({
  id: 'public.publication.search',
  method: 'GET',
  path: '/api/v1/public/opportunities',
  audience: 'public',
  query: PublicOpportunityQuery,
  response: PublicOpportunityPage,
  errors: ['INVALID_DATE_RANGE'],
  screens: ['PUB-02', 'PUB-01'],
  summary: 'Public notices only; default sort is newest published first.',
});

/** GET /api/v1/public/opportunity-filters: filter options counted over public notices (PUB-02). */
export const getPublicOpportunityFilters = defineEndpoint({
  id: 'public.publication.filters',
  method: 'GET',
  path: '/api/v1/public/opportunity-filters',
  audience: 'public',
  response: PublicOpportunityFilters,
  errors: [],
  screens: ['PUB-02'],
});

/** GET /api/v1/public/opportunities/:buyerSlug/:reference: the public notice (PUB-03, DD-22). */
export const getPublicNotice = defineEndpoint({
  id: 'public.publication.notice',
  method: 'GET',
  path: '/api/v1/public/opportunities/:buyerSlug/:reference',
  audience: 'public',
  params: NoticeParams,
  response: PublicNotice,
  errors: ['NOTICE_NOT_FOUND'],
  screens: ['PUB-03'],
  summary: 'Invitation-only, restricted and unreleased events answer NOTICE_NOT_FOUND exactly like unknown ones (AC-01).',
});

/** GET …/documents/:documentId/download: a public document of a public notice (PUB-03). */
export const downloadPublicDocument = defineEndpoint({
  id: 'public.publication.documentDownload',
  method: 'GET',
  path: '/api/v1/public/opportunities/:buyerSlug/:reference/documents/:documentId/download',
  audience: 'public',
  params: NoticeDocumentParams,
  response: DownloadLink,
  errors: ['NOTICE_NOT_FOUND', 'DOCUMENT_NOT_FOUND', 'DOCUMENT_REQUIRES_REGISTRATION', 'DOCUMENT_REQUIRES_INVITATION'],
  screens: ['PUB-03'],
});

/** POST …/interest: register interest without an account (PUB-03, DD-28). */
export const registerPublicInterest = defineEndpoint({
  id: 'public.publication.registerInterest',
  method: 'POST',
  path: '/api/v1/public/opportunities/:buyerSlug/:reference/interest',
  audience: 'public',
  params: NoticeParams,
  body: PublicInterestBody,
  response: PublicInterestReceipt,
  status: 201,
  idempotent: true,
  errors: ['NOTICE_NOT_FOUND', 'NOTICE_NOT_OPEN'],
  screens: ['PUB-03'],
});

/** GET /api/v1/public/guidance: published participation guidance (PUB-07). */
export const listPublicGuidance = defineEndpoint({
  id: 'public.publication.guidance',
  method: 'GET',
  path: '/api/v1/public/guidance',
  audience: 'public',
  query: GuidanceListQuery,
  response: pageOf(HelpArticleSummary),
  errors: [],
  screens: ['PUB-07', 'PUB-01'],
});

/** GET /api/v1/public/guidance/:articleSlug: one guidance article (PUB-07). */
export const getPublicGuidanceArticle = defineEndpoint({
  id: 'public.publication.guidanceArticle',
  method: 'GET',
  path: '/api/v1/public/guidance/:articleSlug',
  audience: 'public',
  params: GuidanceParams,
  response: HelpArticle,
  errors: ['ARTICLE_NOT_FOUND'],
  screens: ['PUB-07'],
});
