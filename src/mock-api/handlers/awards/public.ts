/**
 * Public award handlers (PUB-05): only published public award notices (DD-13 `v_public_awards`). Draft, approved
 * or withdrawn notices, unpublished contract schedules and losing bids never appear.
 */
import { downloadPublicAwardNotice, getPublicAward, listPublicAwards } from '../../../contracts/awards.js';
import type { PublicAwardDetail, PublicAwardRow } from '../../../contracts/awards.js';
import { formatMoney } from '../../../contracts/decimal.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { PUBLIC_NOTICES } from '../../fixtures/awards/index.js';
import { inDateRange, matchesText, sortRows } from './shared.js';

function publishedAwards(): PublicAwardDetail[] {
  return PUBLIC_NOTICES.filter((row) => row.notice.status === 'published').flatMap((row) =>
    row.publicDetail === null ? [] : [row.publicDetail],
  );
}

function toRow(detail: PublicAwardDetail): PublicAwardRow {
  const { officialTimeZone: _zone, content: _content, noticeFileName: _file, ...row } = detail;
  return row;
}

function findAward(buyerSlug: string, reference: string): PublicAwardDetail | undefined {
  return publishedAwards().find((row) => row.buyer.slug === buyerSlug && row.reference === reference);
}

/** The approved public edition as plain text. */
function noticeText(detail: PublicAwardDetail): string {
  const lines = [
    `${detail.buyer.name} — award notice`,
    `${detail.reference}: ${detail.title}`,
    `Published: ${detail.publishedAt} (official time zone ${detail.officialTimeZone})`,
    '',
    ...detail.lots.map((lot) => {
      const outcome = lot.outcome ?? 'no outcome yet';
      const supplierName = lot.supplierName === null ? '' : `, ${lot.supplierName}`;
      const value = lot.awardedValue === null ? '' : `, ${formatMoney(lot.awardedValue.amount, lot.awardedValue.currency)}`;
      return `Lot ${lot.lotNo} (${lot.title}): ${outcome}${supplierName}${value}`;
    }),
    '',
    detail.content,
  ];
  return lines.join('\n');
}

export function registerPublicRoutes(app: MockApp): void {
  mockRoute(app, listPublicAwards, ({ query, fixtures }) => {
    const rows = publishedAwards()
      .filter(
        (row) =>
          matchesText(query.q, row.reference, row.title, row.buyer.name, ...row.lots.map((lot) => lot.supplierName)) &&
          (query.buyerSlug === undefined || row.buyer.slug === query.buyerSlug) &&
          (query.outcome === undefined || row.lots.some((lot) => lot.outcome !== null && query.outcome?.includes(lot.outcome))) &&
          (query.eventType === undefined || query.eventType.includes(row.eventType)) &&
          inDateRange(row.publishedAt, query.publishedFrom, query.publishedTo),
      )
      .map(toRow);
    return fixtures.page(
      sortRows(
        rows,
        { publishedAt: (row) => row.publishedAt, reference: (row) => row.reference, title: (row) => row.title },
        query.sort,
        query.sort === undefined ? 'desc' : query.dir,
        'publishedAt',
      ),
    );
  });

  mockRoute(app, getPublicAward, ({ params, notFound }) => findAward(params.buyerSlug, params.reference) ?? notFound());

  mockRoute(app, downloadPublicAwardNotice, ({ params, notFound }) => {
    const detail = findAward(params.buyerSlug, params.reference);
    if (detail === undefined) {
      return notFound();
    }
    return { fileName: detail.noticeFileName, contentType: 'text/plain' as const, content: noticeText(detail) };
  });
}
