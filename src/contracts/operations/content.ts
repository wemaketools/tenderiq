/**
 * Product announcements and help content (OPS-07) and the help centre of COM-09: in-app help articles, service
 * notices (announcements plus incident notices for the caller's organizations) and the public service notices.
 * Blueprint: `announcements`, `help_articles` (both [G]). Public guidance articles (PUB-07) are served by the
 * publication contract from the same `help_articles` rows.
 *
 * Rules the contract carries (Stage B enforces them):
 * - Product announcements are distinct from formal tender notices: an announcement never names a tender reference
 *   (`FORMAL_NOTICE_NOT_ANNOUNCEMENT`); formal communications go through the tender's notices (PRD §14.2, OPS-07).
 * - Only reviewed content is published: a draft is published by someone other than its last editor
 *   (`REVIEW_REQUIRED`), and general guidance never overrides the binding conditions of a tender (PUB-07).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  OrganizationLabel,
  PersonRef,
  Slug,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  ANNOUNCEMENTS_AUDIENCE,
  AnnouncementsAudience,
  AnnouncementsStatus,
  HELP_ARTICLES_AUDIENCE,
  HELP_ARTICLES_TOPIC,
  HelpArticlesAudience,
  HelpArticlesStatus,
  HelpArticlesTopic,
  ServiceIncidentsStatus,
} from '../enums.js';
import { ServiceIncidentSeverity, bodyText, choice, titleText } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------------------------------------

export const LANGUAGE_CODES = ['en'] as const;
export const LanguageCode = z.enum(LANGUAGE_CODES, { error: issue('LANGUAGE_UNSUPPORTED', 'English is the only language in this release.') });

/** One product announcement or service message (`announcements`). */
export const Announcement = z.object({
  id: Id,
  audience: AnnouncementsAudience,
  title: z.string().min(1),
  body: z.string().min(1),
  language: z.string().min(2),
  status: AnnouncementsStatus,
  publishedAt: Instant.nullable(),
  publishedBy: PersonRef.nullable(),
  updatedAt: Instant,
  updatedBy: PersonRef,
});
export type Announcement = z.infer<typeof Announcement>;

export const ANNOUNCEMENT_SORT_FIELDS = ['title', 'audience', 'status', 'publishedAt', 'updatedAt'] as const;
export const AnnouncementListQuery = listQueryWithSort(ANNOUNCEMENT_SORT_FIELDS).extend({
  status: queryList(AnnouncementsStatus).optional(),
  audience: queryList(AnnouncementsAudience).optional(),
  publishedFrom: CalendarDate.optional(),
  publishedTo: CalendarDate.optional(),
});
export type AnnouncementListQuery = z.input<typeof AnnouncementListQuery>;

export const AnnouncementParams = z.object({ announcementId: IdParam });

export const AnnouncementInput = z.object({
  audience: choice(ANNOUNCEMENTS_AUDIENCE, 'INVALID_AUDIENCE', 'Choose all, buyers, suppliers or public.'),
  title: titleText('TITLE_REQUIRED'),
  body: bodyText('BODY_REQUIRED', 8000),
  language: LanguageCode.default('en'),
});
export type AnnouncementInput = z.input<typeof AnnouncementInput>;

export const UpdateAnnouncementBody = AnnouncementInput.partial();
export type UpdateAnnouncementBody = z.input<typeof UpdateAnnouncementBody>;

// ---------------------------------------------------------------------------------------------------------
// Help articles
// ---------------------------------------------------------------------------------------------------------

/** A help article row for content management (all statuses). */
export const HelpArticleRow = z.object({
  id: Id,
  slug: Slug,
  title: z.string().min(1),
  topic: HelpArticlesTopic,
  audience: HelpArticlesAudience,
  language: z.string().min(2),
  status: HelpArticlesStatus,
  excerpt: z.string().min(1),
  publishedAt: Instant.nullable(),
  updatedAt: Instant,
  updatedBy: PersonRef,
});
export type HelpArticleRow = z.infer<typeof HelpArticleRow>;

export const HelpArticleDetail = HelpArticleRow.extend({
  bodyMarkdown: z.string().min(1),
});
export type HelpArticleDetail = z.infer<typeof HelpArticleDetail>;

export const HELP_SORT_FIELDS = ['title', 'topic', 'audience', 'status', 'publishedAt', 'updatedAt'] as const;
export const HelpArticleListQuery = listQueryWithSort(HELP_SORT_FIELDS).extend({
  status: queryList(HelpArticlesStatus).optional(),
  topic: queryList(HelpArticlesTopic).optional(),
  audience: queryList(HelpArticlesAudience).optional(),
  language: z.string().min(2).max(8).optional(),
  updatedFrom: CalendarDate.optional(),
  updatedTo: CalendarDate.optional(),
});
export type HelpArticleListQuery = z.input<typeof HelpArticleListQuery>;

export const HelpArticleParams = z.object({ articleId: IdParam });

export const HelpArticleInput = z.object({
  slug: z.string({ error: issue('SLUG_REQUIRED', 'Enter the article address, for example submitting-a-bid.') }).pipe(Slug),
  title: titleText('TITLE_REQUIRED'),
  topic: choice(HELP_ARTICLES_TOPIC, 'INVALID_TOPIC', 'Choose the guidance topic of the article.'),
  audience: choice(HELP_ARTICLES_AUDIENCE, 'INVALID_AUDIENCE', 'Choose public, supplier, buyer or all.'),
  language: LanguageCode.default('en'),
  excerpt: z
    .string({ error: issue('EXCERPT_REQUIRED', 'A one-line summary is required.') })
    .trim()
    .min(10, issue('EXCERPT_REQUIRED', 'At least 10 characters.'))
    .max(300, issue('TEXT_TOO_LONG', 'At most 300 characters.')),
  bodyMarkdown: bodyText('BODY_REQUIRED', 40000),
});
export type HelpArticleInput = z.input<typeof HelpArticleInput>;

export const UpdateHelpArticleBody = HelpArticleInput.partial();
export type UpdateHelpArticleBody = z.input<typeof UpdateHelpArticleBody>;

// ---------------------------------------------------------------------------------------------------------
// COM-09 help centre and service notices
// ---------------------------------------------------------------------------------------------------------

/** An in-app help article (published; audience matches the caller's organizations). */
export const MyHelpArticle = z.object({
  id: Id,
  slug: Slug,
  title: z.string().min(1),
  topic: HelpArticlesTopic,
  audience: HelpArticlesAudience,
  excerpt: z.string().min(1),
  publishedAt: Instant,
  updatedAt: Instant,
});
export type MyHelpArticle = z.infer<typeof MyHelpArticle>;

export const MyHelpArticleDetail = MyHelpArticle.extend({
  bodyMarkdown: z.string().min(1),
  related: z.array(MyHelpArticle),
  /** General guidance never overrides the binding conditions of a particular notice. */
  bindingNote: z.string().min(1),
});
export type MyHelpArticleDetail = z.infer<typeof MyHelpArticleDetail>;

export const MyHelpListQuery = listQueryWithSort(['title', 'topic', 'publishedAt'] as const).extend({
  topic: queryList(HelpArticlesTopic).optional(),
});
export type MyHelpListQuery = z.input<typeof MyHelpListQuery>;

export const MyHelpArticleParams = z.object({ articleSlug: Slug });

/** A service notice for the help centre: a product announcement or an incident notice. */
export const ServiceNotice = z.object({
  id: z.string().min(1),
  kind: z.enum(['announcement', 'incident']),
  title: z.string().min(1),
  body: z.string().min(1),
  publishedAt: Instant,
  /** Incident fields (`null` for announcements). */
  incidentStatus: ServiceIncidentsStatus.nullable(),
  severity: ServiceIncidentSeverity.nullable(),
  resolvedAt: Instant.nullable(),
  /** The caller's organizations the incident affected (always empty for announcements and public notices). */
  affectedOrganizations: z.array(OrganizationLabel),
});
export type ServiceNotice = z.infer<typeof ServiceNotice>;

export const ServiceNoticeList = z.object({
  items: z.array(ServiceNotice),
  /** Product announcements are not formal tender notices; formal notices are in the notification centre. */
  distinctionNote: z.string().min(1),
});
export type ServiceNoticeList = z.infer<typeof ServiceNoticeList>;

/** The support and accessibility contacts shown in the help centre (PRD §19). */
export const HelpCentreContacts = z.object({
  serviceHours: z.string().min(1),
  submissionPeriodSupport: z.string().min(1),
  accessibilityAssistance: z.string().min(1),
  incidentEscalation: z.string().min(1),
  notASubmissionChannel: z.string().min(1),
  glossary: z.array(z.object({ term: z.string().min(1), definition: z.string().min(1) })),
});
export type HelpCentreContacts = z.infer<typeof HelpCentreContacts>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const CONTENT_READ = ['ops.content.manage', 'ops.oversight.view'] as const;

export const listAnnouncements = defineEndpoint({
  id: 'ops.operations.announcements.list',
  method: 'GET',
  path: '/api/v1/ops/announcements',
  audience: 'ops',
  permission: CONTENT_READ,
  query: AnnouncementListQuery,
  response: pageOf(Announcement),
  errors: [],
  screens: ['OPS-07'],
});

export const getAnnouncement = defineEndpoint({
  id: 'ops.operations.announcements.get',
  method: 'GET',
  path: '/api/v1/ops/announcements/:announcementId',
  audience: 'ops',
  permission: CONTENT_READ,
  params: AnnouncementParams,
  response: Announcement,
  errors: [],
  screens: ['OPS-07'],
});

export const createAnnouncement = defineEndpoint({
  id: 'ops.operations.announcements.create',
  method: 'POST',
  path: '/api/v1/ops/announcements',
  audience: 'ops',
  permission: 'ops.content.manage',
  body: AnnouncementInput,
  response: Announcement,
  idempotent: true,
  errors: ['FORMAL_NOTICE_NOT_ANNOUNCEMENT'],
  screens: ['OPS-07'],
});

export const updateAnnouncement = defineEndpoint({
  id: 'ops.operations.announcements.update',
  method: 'PATCH',
  path: '/api/v1/ops/announcements/:announcementId',
  audience: 'ops',
  permission: 'ops.content.manage',
  params: AnnouncementParams,
  body: UpdateAnnouncementBody,
  response: Announcement,
  errors: ['ANNOUNCEMENT_NOT_DRAFT', 'FORMAL_NOTICE_NOT_ANNOUNCEMENT'],
  screens: ['OPS-07'],
});

export const publishAnnouncement = defineEndpoint({
  id: 'ops.operations.announcements.publish',
  method: 'POST',
  path: '/api/v1/ops/announcements/:announcementId/publish',
  audience: 'ops',
  permission: 'ops.content.manage',
  params: AnnouncementParams,
  response: Announcement,
  errors: ['ANNOUNCEMENT_NOT_DRAFT', 'REVIEW_REQUIRED', 'FORMAL_NOTICE_NOT_ANNOUNCEMENT'],
  screens: ['OPS-07'],
});

export const archiveAnnouncement = defineEndpoint({
  id: 'ops.operations.announcements.archive',
  method: 'POST',
  path: '/api/v1/ops/announcements/:announcementId/archive',
  audience: 'ops',
  permission: 'ops.content.manage',
  params: AnnouncementParams,
  response: Announcement,
  errors: ['ANNOUNCEMENT_ARCHIVED'],
  screens: ['OPS-07'],
});

export const listHelpArticles = defineEndpoint({
  id: 'ops.operations.helpArticles.list',
  method: 'GET',
  path: '/api/v1/ops/help-articles',
  audience: 'ops',
  permission: CONTENT_READ,
  query: HelpArticleListQuery,
  response: pageOf(HelpArticleRow),
  errors: [],
  screens: ['OPS-07'],
});

export const getHelpArticle = defineEndpoint({
  id: 'ops.operations.helpArticles.get',
  method: 'GET',
  path: '/api/v1/ops/help-articles/:articleId',
  audience: 'ops',
  permission: CONTENT_READ,
  params: HelpArticleParams,
  response: HelpArticleDetail,
  errors: [],
  screens: ['OPS-07'],
});

export const createHelpArticle = defineEndpoint({
  id: 'ops.operations.helpArticles.create',
  method: 'POST',
  path: '/api/v1/ops/help-articles',
  audience: 'ops',
  permission: 'ops.content.manage',
  body: HelpArticleInput,
  response: HelpArticleDetail,
  idempotent: true,
  errors: ['SLUG_TAKEN'],
  screens: ['OPS-07'],
});

export const updateHelpArticle = defineEndpoint({
  id: 'ops.operations.helpArticles.update',
  method: 'PATCH',
  path: '/api/v1/ops/help-articles/:articleId',
  audience: 'ops',
  permission: 'ops.content.manage',
  params: HelpArticleParams,
  body: UpdateHelpArticleBody,
  response: HelpArticleDetail,
  errors: ['HELP_ARTICLE_ARCHIVED', 'SLUG_TAKEN'],
  screens: ['OPS-07'],
});

export const publishHelpArticle = defineEndpoint({
  id: 'ops.operations.helpArticles.publish',
  method: 'POST',
  path: '/api/v1/ops/help-articles/:articleId/publish',
  audience: 'ops',
  permission: 'ops.content.manage',
  params: HelpArticleParams,
  response: HelpArticleDetail,
  errors: ['HELP_ARTICLE_NOT_DRAFT', 'REVIEW_REQUIRED'],
  screens: ['OPS-07'],
});

export const archiveHelpArticle = defineEndpoint({
  id: 'ops.operations.helpArticles.archive',
  method: 'POST',
  path: '/api/v1/ops/help-articles/:articleId/archive',
  audience: 'ops',
  permission: 'ops.content.manage',
  params: HelpArticleParams,
  response: HelpArticleDetail,
  errors: ['HELP_ARTICLE_ARCHIVED'],
  screens: ['OPS-07'],
});

export const listMyHelpArticles = defineEndpoint({
  id: 'me.operations.help.list',
  method: 'GET',
  path: '/api/v1/me/help-articles',
  audience: 'me',
  query: MyHelpListQuery,
  response: pageOf(MyHelpArticle),
  errors: [],
  screens: ['COM-09'],
});

export const getMyHelpArticle = defineEndpoint({
  id: 'me.operations.help.get',
  method: 'GET',
  path: '/api/v1/me/help-articles/:articleSlug',
  audience: 'me',
  params: MyHelpArticleParams,
  response: MyHelpArticleDetail,
  errors: [],
  screens: ['COM-09'],
});

export const getMyHelpContacts = defineEndpoint({
  id: 'me.operations.help.contacts',
  method: 'GET',
  path: '/api/v1/me/help-contacts',
  audience: 'me',
  response: HelpCentreContacts,
  errors: [],
  screens: ['COM-09'],
});

export const listMyServiceNotices = defineEndpoint({
  id: 'me.operations.serviceNotices.list',
  method: 'GET',
  path: '/api/v1/me/service-notices',
  audience: 'me',
  response: ServiceNoticeList,
  errors: [],
  screens: ['COM-09'],
});

export const listPublicServiceNotices = defineEndpoint({
  id: 'public.operations.serviceNotices.list',
  method: 'GET',
  path: '/api/v1/public/service-notices',
  audience: 'public',
  response: ServiceNoticeList,
  errors: [],
  screens: ['COM-09'],
  summary: 'Public product announcements and platform incident notices, without any customer or event detail.',
});

export const getPublicHelpContacts = defineEndpoint({
  id: 'public.operations.help.contacts',
  method: 'GET',
  path: '/api/v1/public/help-contacts',
  audience: 'public',
  response: HelpCentreContacts,
  errors: [],
  screens: ['COM-09'],
});

export const contentRoutes = {
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  listHelpArticles,
  getHelpArticle,
  createHelpArticle,
  updateHelpArticle,
  publishHelpArticle,
  archiveHelpArticle,
  listMyHelpArticles,
  getMyHelpArticle,
  getMyHelpContacts,
  listMyServiceNotices,
  listPublicServiceNotices,
  getPublicHelpContacts,
} as const;
