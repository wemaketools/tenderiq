/**
 * Mock handlers of the public portal (PUB-01, PUB-02, PUB-03, PUB-07; AC-01; DD-13, DD-22, DD-28).
 *
 * Only `v_public_tenders` rows are ever read here: invitation-only, restricted and unreleased events answer
 * exactly like unknown ones, and they never count in totals or filter options.
 */
import type { FilterOption, HelpArticleSummary, RecentOutcome } from '../../../contracts/publication.js';
import {
  downloadPublicDocument,
  getBuyerPortal,
  getPortalHome,
  getPublicGuidanceArticle,
  getPublicNotice,
  getPublicOpportunityFilters,
  listPublicGuidance,
  registerPublicInterest,
  searchPublicOpportunities,
} from '../../../contracts/publication.js';
import { enumLabel } from '../../../contracts/enums.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { ADVANCE_NOTICES, HELP_ARTICLES, OFFICIAL_TZ, PORTAL_SETTINGS, TENDERS } from '../../fixtures/publication.js';
import type { FixtureHelpArticle, FixtureTender } from '../../fixtures/publication.js';
import { findPersonaByEmail, findTenantBySlug } from '../../persona.js';
import {
  buyerLabel,
  categoryOf,
  inDateRange,
  isAcceptingResponses,
  isInvertedRange,
  isPubliclyVisible,
  isoInstant,
  matchesText,
  portalOf,
  publicNotice,
  publicSummary,
  sortRows,
  downloadLinkOf,
} from './projections.js';

const TOPIC_ORDER = ['registration', 'qualification', 'submission', 'complaints', 'accessibility', 'evaluation', 'contracts', 'general'];

function publicTenders(): FixtureTender[] {
  return TENDERS.filter(isPubliclyVisible);
}

function publicArticles(): FixtureHelpArticle[] {
  return HELP_ARTICLES.filter((article) => article.status === 'published' && (article.audience === 'public' || article.audience === 'all'));
}

function articleSummary(article: FixtureHelpArticle): HelpArticleSummary {
  if (article.publishedAt === null) {
    throw new Error(`Help article ${article.slug} is not published.`);
  }
  return {
    slug: article.slug,
    title: article.title,
    topic: article.topic,
    audience: article.audience,
    language: article.language,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    officialTimeZone: OFFICIAL_TZ,
    linkPath: `/guidance/${article.slug}`,
  };
}

function featuredGuidance(): HelpArticleSummary[] {
  return sortRows(publicArticles(), (article) => TOPIC_ORDER.indexOf(article.topic), 'asc')
    .slice(0, 6)
    .map(articleSummary);
}

function recentOutcomes(tenders: readonly FixtureTender[]): RecentOutcome[] {
  return sortRows(
    tenders.filter((tender) => tender.outcome !== null && tender.outcomeDecidedAt !== null && portalOf(tender.tenantId)?.showAwards === true),
    (tender) => tender.outcomeDecidedAt,
    'desc',
  ).map((tender) => {
    const buyer = buyerLabel(tender.tenantId);
    return {
      reference: tender.reference,
      buyer,
      title: tender.title,
      status: tender.status,
      decidedAt: tender.outcomeDecidedAt ?? '',
      summary: tender.outcome?.summary ?? '',
      linkPath: tender.outcome?.awardLinkPath ?? `/opportunities/${buyer.slug}/${tender.reference}`,
    };
  });
}

function advanceNotices(tenantIds: readonly number[]) {
  return ADVANCE_NOTICES.filter(
    (notice) => tenantIds.includes(notice.tenantId) && portalOf(notice.tenantId)?.showAdvanceNotices === true,
  ).map((notice) => ({
    advanceNoticeId: notice.id,
    buyer: buyerLabel(notice.tenantId),
    title: notice.title,
    summary: notice.summary,
    indicativeTiming: notice.indicativeTiming,
    category: categoryOf(notice.categoryCode),
    publishedAt: notice.publishedAt,
    linkPath: '/plans',
  }));
}

function buyerCard(tenantId: number, now: Date) {
  const portal = portalOf(tenantId);
  const label = buyerLabel(tenantId);
  const tenant = findTenantBySlug(label.slug);
  return {
    ...label,
    legalName: tenant?.legalName ?? label.name,
    portalIntro: portal?.portalIntro ?? null,
    openOpportunityCount: publicTenders().filter((tender) => tender.tenantId === tenantId && isAcceptingResponses(tender, now)).length,
    linkPath: `/b/${label.slug}`,
  };
}

function countOptions(values: ReadonlyArray<{ value: string; label: string }>): FilterOption[] {
  const counts = new Map<string, FilterOption>();
  for (const entry of values) {
    const existing = counts.get(entry.value);
    counts.set(entry.value, { value: entry.value, label: entry.label, count: (existing?.count ?? 0) + 1 });
  }
  return sortRows([...counts.values()], (option) => option.label, 'asc');
}

export function registerPublic(app: MockApp): void {
  mockRoute(app, getPortalHome, ({ now }) => {
    const tenders = publicTenders();
    const open = sortRows(
      tenders.filter((tender) => isAcceptingResponses(tender, now)),
      (tender) => tender.releasedAt,
      'desc',
    );
    const buyers = PORTAL_SETTINGS.filter((settings) => settings.publicPortalEnabled).map((settings) => settings.tenantId);
    return {
      buyers: buyers.map((tenantId) => buyerCard(tenantId, now)),
      openOpportunities: open.slice(0, 6).map((tender) => publicSummary(tender, now)),
      openOpportunityCount: open.length,
      recentOutcomes: recentOutcomes(tenders).slice(0, 4),
      advanceNotices: advanceNotices(buyers),
      guidance: featuredGuidance(),
      languages: ['en'],
    };
  });

  mockRoute(app, getBuyerPortal, ({ params, now, fail }) => {
    const tenant = findTenantBySlug(params.buyerSlug);
    const portal = tenant === undefined ? undefined : portalOf(tenant.id);
    if (tenant === undefined || tenant.kind !== 'buyer' || portal === undefined || !portal.publicPortalEnabled) {
      return fail(404, 'PORTAL_NOT_AVAILABLE', 'This buyer has no public portal.');
    }
    const tenders = publicTenders().filter((tender) => tender.tenantId === tenant.id);
    return {
      buyer: buyerCard(tenant.id, now),
      officialTimeZone: tenant.officialTimeZone,
      showAdvanceNotices: portal.showAdvanceNotices,
      showAwards: portal.showAwards,
      openOpportunities: sortRows(
        tenders.filter((tender) => isAcceptingResponses(tender, now)),
        (tender) => tender.releasedAt,
        'desc',
      ).map((tender) => publicSummary(tender, now)),
      recentOutcomes: recentOutcomes(tenders),
      advanceNotices: advanceNotices([tenant.id]),
      guidance: featuredGuidance(),
      guidanceMarkdown: portal.guidanceMarkdown,
      languages: [...portal.languages],
    };
  });

  mockRoute(app, searchPublicOpportunities, ({ query, now, fail, fixtures }) => {
    if (isInvertedRange(query.publishedFrom, query.publishedTo) || isInvertedRange(query.closingFrom, query.closingTo)) {
      return fail(422, 'INVALID_DATE_RANGE', 'The start date must not be after the end date.');
    }
    const rows = publicTenders()
      .filter((tender) => query.buyer === undefined || query.buyer.includes(buyerLabel(tender.tenantId).slug))
      .filter((tender) => {
        if (query.category === undefined) {
          return true;
        }
        const parent = categoryOf(tender.categoryCode).parentCode;
        return query.category.includes(tender.categoryCode) || (parent !== null && query.category.includes(parent));
      })
      .filter((tender) => query.region === undefined || tender.regions.some((region) => query.region?.includes(region)))
      .filter((tender) => query.procedure === undefined || query.procedure.includes(tender.procedure))
      .filter((tender) => query.eventType === undefined || query.eventType.includes(tender.eventType))
      .filter((tender) => query.status === undefined || query.status.includes(tender.status))
      .filter((tender) => inDateRange(tender.releasedAt, query.publishedFrom, query.publishedTo))
      .filter((tender) => inDateRange(tender.submissionDeadline, query.closingFrom, query.closingTo))
      .filter((tender) => matchesText(query.q, tender.reference, tender.title, tender.summary, buyerLabel(tender.tenantId).name));
    const sort = query.sort ?? 'publishedAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    const sorted = sortRows(
      rows,
      (tender) =>
        sort === 'closingAt'
          ? tender.submissionDeadline
          : sort === 'title'
            ? tender.title
            : sort === 'buyer'
              ? buyerLabel(tender.tenantId).name
              : tender.releasedAt,
      dir,
    );
    return fixtures.page(sorted.map((tender) => publicSummary(tender, now)));
  });

  mockRoute(app, getPublicOpportunityFilters, () => {
    const tenders = publicTenders();
    return {
      buyers: countOptions(tenders.map((tender) => ({ value: buyerLabel(tender.tenantId).slug, label: buyerLabel(tender.tenantId).name }))),
      categories: countOptions(tenders.map((tender) => ({ value: tender.categoryCode, label: categoryOf(tender.categoryCode).name }))),
      regions: countOptions(tenders.flatMap((tender) => tender.regions.map((region) => ({ value: region, label: region })))),
      procedures: countOptions(tenders.map((tender) => ({ value: tender.procedure, label: enumLabel('tenders.procedure', tender.procedure) }))),
      eventTypes: countOptions(tenders.map((tender) => ({ value: tender.eventType, label: enumLabel('tenders.event_type', tender.eventType) }))),
      statuses: countOptions(tenders.map((tender) => ({ value: tender.status, label: enumLabel('tenders.status', tender.status) }))),
      total: tenders.length,
    };
  });

  function visibleNotice(buyerSlug: string, reference: string): FixtureTender | undefined {
    const tenant = findTenantBySlug(buyerSlug);
    if (tenant === undefined) {
      return undefined;
    }
    return publicTenders().find((tender) => tender.tenantId === tenant.id && tender.reference === reference);
  }

  mockRoute(app, getPublicNotice, ({ params, now, fail }) => {
    const tender = visibleNotice(params.buyerSlug, params.reference);
    if (tender === undefined) {
      return fail(404, 'NOTICE_NOT_FOUND', 'No public notice has this reference.');
    }
    return publicNotice(tender, now);
  });

  mockRoute(app, downloadPublicDocument, ({ params, now, fail }) => {
    const tender = visibleNotice(params.buyerSlug, params.reference);
    if (tender === undefined) {
      return fail(404, 'NOTICE_NOT_FOUND', 'No public notice has this reference.');
    }
    const document = tender.documents.find((entry) => entry.documentId === params.documentId && entry.accessRule === 'public');
    if (document === undefined) {
      return fail(404, 'DOCUMENT_NOT_FOUND', 'This notice has no public document with this id.');
    }
    const policy = portalOf(tender.tenantId)?.publicDocumentPolicy ?? 'public';
    if (policy === 'registered') {
      return fail(403, 'DOCUMENT_REQUIRES_REGISTRATION', 'Sign in as a registered supplier to download the documents of this buyer.');
    }
    if (policy === 'invitation') {
      return fail(403, 'DOCUMENT_REQUIRES_INVITATION', 'This buyer releases documents to invited suppliers only.');
    }
    return downloadLinkOf(document, now);
  });

  mockRoute(app, registerPublicInterest, ({ params, body, now, fail }) => {
    const tender = visibleNotice(params.buyerSlug, params.reference);
    if (tender === undefined) {
      return fail(404, 'NOTICE_NOT_FOUND', 'No public notice has this reference.');
    }
    if (!isAcceptingResponses(tender, now)) {
      return fail(409, 'NOTICE_NOT_OPEN', 'This notice no longer accepts expressions of interest.');
    }
    const known = findPersonaByEmail(body.email) !== undefined;
    return {
      reference: tender.reference,
      buyer: buyerLabel(tender.tenantId),
      receivedAt: isoInstant(now),
      nextStep: known ? ('sign_in' as const) : ('register' as const),
      nextStepPath: known ? '/signin' : '/register',
    };
  });

  mockRoute(app, listPublicGuidance, ({ query, fixtures }) => {
    const rows = publicArticles()
      .filter((article) => query.topic === undefined || query.topic.includes(article.topic))
      .filter((article) => matchesText(query.q, article.title, article.excerpt, article.bodyMarkdown));
    const sort = query.sort ?? 'topic';
    const sorted = sortRows(
      rows,
      (article) => (sort === 'title' ? article.title : sort === 'publishedAt' ? article.publishedAt : TOPIC_ORDER.indexOf(article.topic)),
      query.dir,
    );
    return fixtures.page(sorted.map(articleSummary));
  });

  mockRoute(app, getPublicGuidanceArticle, ({ params, fail }) => {
    const article = publicArticles().find((entry) => entry.slug === params.articleSlug);
    if (article === undefined) {
      return fail(404, 'ARTICLE_NOT_FOUND', 'No published guidance article has this address.');
    }
    return {
      ...articleSummary(article),
      bodyMarkdown: article.bodyMarkdown,
      updatedAt: article.updatedAt,
      related: publicArticles()
        .filter((entry) => entry.slug !== article.slug && entry.topic === article.topic)
        .concat(publicArticles().filter((entry) => entry.slug !== article.slug && entry.topic !== article.topic))
        .slice(0, 3)
        .map(articleSummary),
    };
  });
}
