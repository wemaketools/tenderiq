/**
 * Operations fixtures: product announcements (OPS-07), the managed help articles (OPS-07, COM-09) and the help
 * centre contacts (PRD §19).
 *
 * Help articles are the same `help_articles` rows the publication domain serves as public guidance (PUB-07): they
 * are built from its `HELP_ARTICLES` fixture (by slug, in order, ids 1..n) plus one archived article, so the public
 * guidance, the in-app help centre and the operator content screen show one world.
 */
import type { AnnouncementsAudience, AnnouncementsStatus, HelpArticlesAudience, HelpArticlesStatus, HelpArticlesTopic } from '../../../contracts/enums.js';
import { HELP_ARTICLES } from '../publication/catalog.js';
import { OPS_USERS } from './customers.js';

export interface FixtureAnnouncement {
  readonly id: number;
  readonly audience: AnnouncementsAudience;
  readonly title: string;
  readonly body: string;
  readonly language: string;
  readonly status: AnnouncementsStatus;
  readonly publishedAt: string | null;
  readonly publishedByUserId: number | null;
  readonly updatedAt: string;
  readonly updatedByUserId: number;
}

export const ANNOUNCEMENTS: readonly FixtureAnnouncement[] = Object.freeze([
  {
    id: 1,
    audience: 'all',
    title: 'Official deadlines now show the UTC offset',
    body: 'Every official deadline now reads like "14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone", with your local time shown as help only. The official time zone of each event still decides.',
    language: 'en',
    status: 'published',
    publishedAt: '2026-09-01T06:00:00Z',
    publishedByUserId: OPS_USERS.opsAdmin,
    updatedAt: '2026-08-30T14:00:00Z',
    updatedByUserId: OPS_USERS.supportAgent,
  },
  {
    id: 2,
    audience: 'suppliers',
    title: 'Planned maintenance on Sunday 4 October, 02:00–03:00',
    body: 'The platform will be unavailable on Sunday 4 October 2026 between 02:00 and 03:00 (UTC+02:00) Africa/Gaborone. No event closes during this window.',
    language: 'en',
    status: 'published',
    publishedAt: '2026-09-27T07:00:00Z',
    publishedByUserId: OPS_USERS.opsAdmin,
    updatedAt: '2026-09-26T16:30:00Z',
    updatedByUserId: OPS_USERS.supportAgent,
  },
  {
    id: 3,
    audience: 'buyers',
    title: 'Evaluator training sessions in October',
    body: 'Two online sessions on independent scoring, conflict declarations and moderation run on 13 and 20 October 2026. Ask your organization administrator to register evaluators.',
    language: 'en',
    status: 'published',
    publishedAt: '2026-09-22T06:00:00Z',
    publishedByUserId: OPS_USERS.opsAdmin,
    updatedAt: '2026-09-21T12:00:00Z',
    updatedByUserId: OPS_USERS.opsAdmin,
  },
  {
    id: 4,
    audience: 'public',
    title: 'Accessibility improvements to the public portal',
    body: 'Opportunity pages now support high-contrast mode and every document list announces file type and size to screen readers.',
    language: 'en',
    status: 'draft',
    publishedAt: null,
    publishedByUserId: null,
    updatedAt: '2026-09-29T09:10:00Z',
    updatedByUserId: OPS_USERS.supportAgent,
  },
  {
    id: 5,
    audience: 'all',
    title: 'Welcome to the TenderIQ pilot',
    body: 'TenderIQ is live for pilot customers. Suppliers register free of charge and can respond to every eligible competition.',
    language: 'en',
    status: 'archived',
    publishedAt: '2026-01-12T06:00:00Z',
    publishedByUserId: OPS_USERS.opsAdmin,
    updatedAt: '2026-06-30T08:00:00Z',
    updatedByUserId: OPS_USERS.opsAdmin,
  },
] satisfies FixtureAnnouncement[]);

export interface FixtureManagedHelpArticle {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly topic: HelpArticlesTopic;
  readonly audience: HelpArticlesAudience;
  readonly language: string;
  readonly status: HelpArticlesStatus;
  readonly excerpt: string;
  readonly bodyMarkdown: string;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly updatedByUserId: number;
}

export const MANAGED_HELP_ARTICLES: readonly FixtureManagedHelpArticle[] = Object.freeze([
  ...HELP_ARTICLES.map((article, index) => ({
    id: index + 1,
    slug: article.slug,
    title: article.title,
    topic: article.topic,
    audience: article.audience,
    language: article.language,
    status: article.status,
    excerpt: article.excerpt,
    bodyMarkdown: article.bodyMarkdown,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    updatedByUserId: article.status === 'draft' ? OPS_USERS.supportAgent : OPS_USERS.opsAdmin,
  })),
  {
    id: HELP_ARTICLES.length + 1,
    slug: 'registering-by-paper-form-2025',
    title: 'Registering by paper form (2025)',
    topic: 'registration',
    audience: 'public',
    language: 'en',
    status: 'archived',
    excerpt: 'The paper registration route used before the pilot. Replaced by online registration.',
    bodyMarkdown: '## Archived\n\nPaper registration closed on 31 Dec 2025. Register online instead.',
    publishedAt: '2025-06-01T08:00:00Z',
    updatedAt: '2026-01-12T08:00:00Z',
    updatedByUserId: OPS_USERS.opsAdmin,
  },
]);

/** Help centre contacts and glossary (PRD §19; COM-09 "terminology"). */
export const HELP_CENTRE_CONTACTS = Object.freeze({
  serviceHours: 'Monday to Friday, 07:30–17:00 (UTC+02:00) Africa/Gaborone, excluding Botswana public holidays.',
  submissionPeriodSupport:
    'On the last working day before an official deadline, support is staffed until the deadline passes. Support can help with the platform but cannot extend a deadline.',
  accessibilityAssistance:
    'Request an accessible document, sign-language interpreter, extended session time or assisted site access from the help centre. We reply within one working day.',
  incidentEscalation:
    'Service incidents are published under Service notices with their timing. The responsible buyer decides any deadline change after an incident.',
  notASubmissionChannel:
    'Support is never a submission channel: bids, offers, complaints and clarification questions must go through the official route of the notice. Documents sent to support are not forwarded to the buyer.',
  glossary: [
    { term: 'Official deadline', definition: 'The closing instant of an event in its official time zone. Your local time is shown as help only.' },
    { term: 'Receipt', definition: 'The official evidence that a complete submission was accepted, with its exact time.' },
    { term: 'Addendum', definition: 'A formal change to a published tender, sent to every eligible participant.' },
    { term: 'Qualification', definition: 'A buyer’s decision that a supplier may take part in a category of work, for a stated scope and period.' },
    { term: 'Standstill period', definition: 'The waiting time after an intent-to-award notice during which the contract cannot be signed.' },
    { term: 'Support access grant', definition: 'Time-limited, read-only access that a customer authorizes so support can investigate a case.' },
  ],
});
