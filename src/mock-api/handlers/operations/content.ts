/**
 * Content handlers: product announcements and help content management (OPS-07), the in-app help centre and service
 * notices (COM-09) and the public service notices. Announcements never carry formal tender notices; drafts are
 * published only after review by someone other than their last editor.
 */
import type { AnnouncementsAudience, HelpArticlesAudience } from '../../../contracts/enums.js';
import { TENDER_REFERENCE_IN_TEXT, operationsEndpoints as api } from '../../../contracts/operations.js';
import type { Announcement, HelpArticleDetail, HelpArticleRow, MyHelpArticle, ServiceNotice } from '../../../contracts/operations.js';
import type { TenantKind } from '../../../contracts/common.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  ANNOUNCEMENTS,
  HELP_CENTRE_CONTACTS,
  MANAGED_HELP_ARTICLES,
  SERVICE_INCIDENTS,
  SERVICE_INCIDENT_IMPACTS,
} from '../../fixtures/operations/index.js';
import type { FixtureAnnouncement, FixtureManagedHelpArticle } from '../../fixtures/operations/index.js';
import { findTenantById, organizationLabel, personRef } from '../../persona.js';
import { isoNow, matchesText, personOrNull, sortRows, withinDates } from './views.js';

const DISTINCTION_NOTE =
  'Service notices are product and platform information. Formal tender notices, addenda and outcome letters are in your notification centre and on each tender.';
const BINDING_NOTE = 'General guidance never replaces the binding conditions stated in a particular notice or tender document.';

function announcementView(row: FixtureAnnouncement): Announcement {
  return {
    id: row.id,
    audience: row.audience,
    title: row.title,
    body: row.body,
    language: row.language,
    status: row.status,
    publishedAt: row.publishedAt,
    publishedBy: personOrNull(row.publishedByUserId),
    updatedAt: row.updatedAt,
    updatedBy: personRef(row.updatedByUserId),
  };
}

function helpRow(row: FixtureManagedHelpArticle): HelpArticleRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    audience: row.audience,
    language: row.language,
    status: row.status,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    updatedBy: personRef(row.updatedByUserId),
  };
}

function helpDetail(row: FixtureManagedHelpArticle): HelpArticleDetail {
  return { ...helpRow(row), bodyMarkdown: row.bodyMarkdown };
}

function myHelp(row: FixtureManagedHelpArticle): MyHelpArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    audience: row.audience,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt ?? row.updatedAt,
    updatedAt: row.updatedAt,
  };
}

/** Help audiences visible to a person with memberships of the given kinds. */
function helpAudiences(kinds: readonly TenantKind[]): HelpArticlesAudience[] {
  if (kinds.includes('operator')) return ['public', 'supplier', 'buyer', 'all'];
  const audiences: HelpArticlesAudience[] = ['public', 'all'];
  if (kinds.includes('buyer')) audiences.push('buyer');
  if (kinds.includes('supplier')) audiences.push('supplier');
  return audiences;
}

function announcementAudiences(kinds: readonly TenantKind[]): AnnouncementsAudience[] {
  if (kinds.includes('operator')) return ['all', 'buyers', 'suppliers', 'public'];
  const audiences: AnnouncementsAudience[] = ['all', 'public'];
  if (kinds.includes('buyer')) audiences.push('buyers');
  if (kinds.includes('supplier')) audiences.push('suppliers');
  return audiences;
}

function announcementNotice(row: FixtureAnnouncement): ServiceNotice {
  return {
    id: `announcement-${row.id}`,
    kind: 'announcement',
    title: row.title,
    body: row.body,
    publishedAt: row.publishedAt ?? row.updatedAt,
    incidentStatus: null,
    severity: null,
    resolvedAt: null,
    affectedOrganizations: [],
  };
}

function publishedAnnouncements(audiences: readonly AnnouncementsAudience[]): FixtureAnnouncement[] {
  return ANNOUNCEMENTS.filter((row) => row.status === 'published' && audiences.includes(row.audience));
}

function byNewest(items: ServiceNotice[]): ServiceNotice[] {
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function registerContent(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Announcements (OPS-07)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listAnnouncements, ({ query, fixtures }) => {
    const rows = ANNOUNCEMENTS.map(announcementView)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.audience === undefined || query.audience.includes(row.audience))
      .filter((row) => withinDates(row.publishedAt, query.publishedFrom, query.publishedTo))
      .filter((row) => matchesText(query.q, row.title, row.body));
    const sort = query.sort ?? 'updatedAt';
    const sorted = sortRows(rows, (row) => row[sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getAnnouncement, ({ params, notFound }) => {
    const row = ANNOUNCEMENTS.find((candidate) => candidate.id === params.announcementId);
    if (row === undefined) return notFound();
    return announcementView(row);
  });

  mockRoute(app, api.createAnnouncement, ({ body, requirePersona, now, fail }) => {
    if (TENDER_REFERENCE_IN_TEXT.test(body.title) || TENDER_REFERENCE_IN_TEXT.test(body.body)) {
      fail(422, 'FORMAL_NOTICE_NOT_ANNOUNCEMENT', 'Announcements cannot carry tender notices. Formal communications go through the tender’s notices.');
    }
    const at = isoNow(now);
    return {
      id: 900,
      audience: body.audience,
      title: body.title,
      body: body.body,
      language: body.language,
      status: 'draft',
      publishedAt: null,
      publishedBy: null,
      updatedAt: at,
      updatedBy: personRef(requirePersona().userId),
    };
  });

  mockRoute(app, api.updateAnnouncement, ({ params, body, requirePersona, now, notFound, fail }) => {
    const row = ANNOUNCEMENTS.find((candidate) => candidate.id === params.announcementId);
    if (row === undefined) return notFound();
    if (row.status !== 'draft') fail(409, 'ANNOUNCEMENT_NOT_DRAFT', 'Only a draft announcement can be edited. Archive it and write a new one.');
    const title = body.title ?? row.title;
    const text = body.body ?? row.body;
    if (TENDER_REFERENCE_IN_TEXT.test(title) || TENDER_REFERENCE_IN_TEXT.test(text)) {
      fail(422, 'FORMAL_NOTICE_NOT_ANNOUNCEMENT', 'Announcements cannot carry tender notices. Formal communications go through the tender’s notices.');
    }
    return announcementView({
      ...row,
      audience: body.audience ?? row.audience,
      title,
      body: text,
      language: body.language ?? row.language,
      updatedAt: isoNow(now),
      updatedByUserId: requirePersona().userId,
    });
  });

  mockRoute(app, api.publishAnnouncement, ({ params, requirePersona, now, notFound, fail }) => {
    const row = ANNOUNCEMENTS.find((candidate) => candidate.id === params.announcementId);
    if (row === undefined) return notFound();
    if (row.status !== 'draft') fail(409, 'ANNOUNCEMENT_NOT_DRAFT', 'Only a draft announcement can be published.');
    const persona = requirePersona();
    if (row.updatedByUserId === persona.userId) {
      fail(409, 'REVIEW_REQUIRED', 'Another operator must review and publish your announcement.');
    }
    if (TENDER_REFERENCE_IN_TEXT.test(row.title) || TENDER_REFERENCE_IN_TEXT.test(row.body)) {
      fail(422, 'FORMAL_NOTICE_NOT_ANNOUNCEMENT', 'Announcements cannot carry tender notices.');
    }
    return announcementView({ ...row, status: 'published', publishedAt: isoNow(now), publishedByUserId: persona.userId });
  });

  mockRoute(app, api.archiveAnnouncement, ({ params, notFound, fail }) => {
    const row = ANNOUNCEMENTS.find((candidate) => candidate.id === params.announcementId);
    if (row === undefined) return notFound();
    if (row.status === 'archived') fail(409, 'ANNOUNCEMENT_ARCHIVED', 'This announcement is already archived.');
    return announcementView({ ...row, status: 'archived' });
  });

  // ---------------------------------------------------------------------------------------------------
  // Help articles (OPS-07)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listHelpArticles, ({ query, fixtures }) => {
    const rows = MANAGED_HELP_ARTICLES.map(helpRow)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.topic === undefined || query.topic.includes(row.topic))
      .filter((row) => query.audience === undefined || query.audience.includes(row.audience))
      .filter((row) => query.language === undefined || row.language === query.language)
      .filter((row) => withinDates(row.updatedAt, query.updatedFrom, query.updatedTo))
      .filter((row) => matchesText(query.q, row.title, row.excerpt, row.slug));
    const sort = query.sort ?? 'title';
    const sorted = sortRows(rows, (row) => row[sort], query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getHelpArticle, ({ params, notFound }) => {
    const row = MANAGED_HELP_ARTICLES.find((candidate) => candidate.id === params.articleId);
    if (row === undefined) return notFound();
    return helpDetail(row);
  });

  mockRoute(app, api.createHelpArticle, ({ body, requirePersona, now, fail }) => {
    if (MANAGED_HELP_ARTICLES.some((row) => row.slug === body.slug)) fail(409, 'SLUG_TAKEN', 'Another article already uses this address.');
    return helpDetail({
      id: 900,
      slug: body.slug,
      title: body.title,
      topic: body.topic,
      audience: body.audience,
      language: body.language,
      status: 'draft',
      excerpt: body.excerpt,
      bodyMarkdown: body.bodyMarkdown,
      publishedAt: null,
      updatedAt: isoNow(now),
      updatedByUserId: requirePersona().userId,
    });
  });

  mockRoute(app, api.updateHelpArticle, ({ params, body, requirePersona, now, notFound, fail }) => {
    const row = MANAGED_HELP_ARTICLES.find((candidate) => candidate.id === params.articleId);
    if (row === undefined) return notFound();
    if (row.status === 'archived') fail(409, 'HELP_ARTICLE_ARCHIVED', 'An archived article cannot be edited.');
    if (body.slug !== undefined && body.slug !== row.slug && MANAGED_HELP_ARTICLES.some((other) => other.slug === body.slug)) {
      fail(409, 'SLUG_TAKEN', 'Another article already uses this address.');
    }
    return helpDetail({
      ...row,
      slug: body.slug ?? row.slug,
      title: body.title ?? row.title,
      topic: body.topic ?? row.topic,
      audience: body.audience ?? row.audience,
      language: body.language ?? row.language,
      excerpt: body.excerpt ?? row.excerpt,
      bodyMarkdown: body.bodyMarkdown ?? row.bodyMarkdown,
      // Editing a published article returns it to draft for review.
      status: 'draft',
      updatedAt: isoNow(now),
      updatedByUserId: requirePersona().userId,
    });
  });

  mockRoute(app, api.publishHelpArticle, ({ params, requirePersona, now, notFound, fail }) => {
    const row = MANAGED_HELP_ARTICLES.find((candidate) => candidate.id === params.articleId);
    if (row === undefined) return notFound();
    if (row.status !== 'draft') fail(409, 'HELP_ARTICLE_NOT_DRAFT', 'Only a draft article can be published.');
    if (row.updatedByUserId === requirePersona().userId) {
      fail(409, 'REVIEW_REQUIRED', 'Another operator must review and publish your article.');
    }
    return helpDetail({ ...row, status: 'published', publishedAt: isoNow(now) });
  });

  mockRoute(app, api.archiveHelpArticle, ({ params, notFound, fail }) => {
    const row = MANAGED_HELP_ARTICLES.find((candidate) => candidate.id === params.articleId);
    if (row === undefined) return notFound();
    if (row.status === 'archived') fail(409, 'HELP_ARTICLE_ARCHIVED', 'This article is already archived.');
    return helpDetail({ ...row, status: 'archived' });
  });

  // ---------------------------------------------------------------------------------------------------
  // Help centre (COM-09)
  // ---------------------------------------------------------------------------------------------------
  function callerKinds(memberships: ReadonlyArray<{ tenantId: number }>): TenantKind[] {
    return memberships.flatMap((membership) => {
      const tenant = findTenantById(membership.tenantId);
      return tenant === undefined ? [] : [tenant.kind];
    });
  }

  function visibleHelp(kinds: readonly TenantKind[]): FixtureManagedHelpArticle[] {
    const audiences = helpAudiences(kinds);
    return MANAGED_HELP_ARTICLES.filter((row) => row.status === 'published' && audiences.includes(row.audience));
  }

  mockRoute(app, api.listMyHelpArticles, ({ query, fixtures }) => {
    const rows = visibleHelp(callerKinds(fixtures.activeMemberships()))
      .map(myHelp)
      .filter((row) => query.topic === undefined || query.topic.includes(row.topic))
      .filter((row) => matchesText(query.q, row.title, row.excerpt));
    const sort = query.sort ?? 'title';
    const sorted = sortRows(rows, (row) => row[sort], query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getMyHelpArticle, ({ params, fixtures, notFound }) => {
    const visible = visibleHelp(callerKinds(fixtures.activeMemberships()));
    const row = visible.find((candidate) => candidate.slug === params.articleSlug);
    if (row === undefined) return notFound();
    return {
      ...myHelp(row),
      bodyMarkdown: row.bodyMarkdown,
      related: visible.filter((other) => other.id !== row.id && other.topic === row.topic).map(myHelp),
      bindingNote: BINDING_NOTE,
    };
  });

  mockRoute(app, api.getMyHelpContacts, () => ({ ...HELP_CENTRE_CONTACTS, glossary: [...HELP_CENTRE_CONTACTS.glossary] }));

  mockRoute(app, api.listMyServiceNotices, ({ fixtures }) => {
    const memberships = fixtures.activeMemberships();
    const tenantIds = memberships.map((membership) => membership.tenantId);
    const kinds = callerKinds(memberships);
    const incidents: ServiceNotice[] = SERVICE_INCIDENTS.flatMap((incident) => {
      if (incident.customerNotice === null) return [];
      const affected = [
        ...new Set(
          SERVICE_INCIDENT_IMPACTS.filter((impact) => impact.incidentId === incident.id && tenantIds.includes(impact.customerTenantId)).map(
            (impact) => impact.customerTenantId,
          ),
        ),
      ];
      if (affected.length === 0 && !incident.publicNotice && !kinds.includes('operator')) return [];
      return [
        {
          id: `incident-${incident.id}`,
          kind: 'incident' as const,
          title: incident.title,
          body: incident.customerNotice,
          publishedAt: incident.startedAt,
          incidentStatus: incident.status,
          severity: incident.severity,
          resolvedAt: incident.resolvedAt,
          affectedOrganizations: affected.map((tenantId) => organizationLabel(tenantId)),
        },
      ];
    });
    return {
      items: byNewest([...publishedAnnouncements(announcementAudiences(kinds)).map(announcementNotice), ...incidents]),
      distinctionNote: DISTINCTION_NOTE,
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Public
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listPublicServiceNotices, () => {
    const incidents: ServiceNotice[] = SERVICE_INCIDENTS.filter((incident) => incident.publicNotice && incident.customerNotice !== null).map(
      (incident) => ({
        id: `incident-${incident.id}`,
        kind: 'incident',
        title: incident.title,
        body: incident.customerNotice ?? incident.title,
        publishedAt: incident.startedAt,
        incidentStatus: incident.status,
        severity: incident.severity,
        resolvedAt: incident.resolvedAt,
        affectedOrganizations: [],
      }),
    );
    return {
      items: byNewest([...publishedAnnouncements(['all', 'public']).map(announcementNotice), ...incidents]),
      distinctionNote: DISTINCTION_NOTE,
    };
  });

  mockRoute(app, api.getPublicHelpContacts, () => ({ ...HELP_CENTRE_CONTACTS, glossary: [...HELP_CENTRE_CONTACTS.glossary] }));
}
