/**
 * Pricing projection of the bids mock (SUP-13): price schedules of the selected lots, line totals and group totals
 * from decimal strings (DD-32), and consistency findings. `priced`, `included` and `not_offered` are distinct from
 * a zero price; a line without a status is "not yet entered".
 */
import type { BidPricing, PriceLine, PricingIssue, PriceTotal, PricingTotals } from '../../../contracts/bids.js';
import { add, div, eq, gt, mul, round, sub, sum } from '../../../contracts/decimal.js';
import type { PricingItemsRecurrence } from '../../../contracts/enums.js';
import { BID_COMMERCIAL_TERMS, BID_PRICES, BID_PRICE_SCHEDULES } from '../../fixtures/bids/index.js';
import type { FixtureBid, FixtureBidTender, FixturePrice, FixtureRevision } from '../../fixtures/bids/index.js';

export interface PriceInput {
  readonly pricingItemId: number;
  readonly priceStatus: FixturePrice['priceStatus'];
  readonly unitPrice: string | null;
  readonly quantity: string | null;
  readonly currency: string | null;
  readonly taxRate: string | null;
  readonly discountAmount: string | null;
  readonly notes: string | null;
}

export interface TermsInput {
  readonly validityDays: number | null;
  readonly paymentTerms: string | null;
  readonly conditionalDiscounts: string | null;
  readonly assumptions: string | null;
}

function lotRefOf(tender: FixtureBidTender, lotId: number | null) {
  const lot = lotId === null ? undefined : tender.lots.find((row) => row.id === lotId);
  return lot === undefined ? null : { lotId: lot.id, lotNo: lot.lotNo, title: lot.title };
}

/** The schedules a bid prices: general ones and those of its selected lots. */
export function schedulesFor(tender: FixtureBidTender, lotIds: readonly number[]) {
  return BID_PRICE_SCHEDULES.filter((row) => row.tenderId === tender.id && (row.lotId === null || lotIds.includes(row.lotId)));
}

/** All pricing items of the tender (to tell "unknown item" from "item of an unselected lot"). */
export function tenderPricingItems(tender: FixtureBidTender) {
  return BID_PRICE_SCHEDULES.filter((row) => row.tenderId === tender.id).flatMap((schedule) =>
    schedule.items.map((item) => ({ item, lotId: schedule.lotId })),
  );
}

function money(amount: string, currency: string) {
  return { amount: round(amount, 2), currency };
}

function total(net: string, tax: string, currency: string): PriceTotal {
  return { net: money(net, currency), tax: money(tax, currency), gross: money(add(net, tax), currency) };
}

interface ComputedLine {
  readonly line: PriceLine;
  readonly net: string | null;
  readonly tax: string | null;
  readonly lotId: number | null;
}

function computeLine(
  item: (typeof BID_PRICE_SCHEDULES)[number]['items'][number],
  lotId: number | null,
  price: PriceInput | undefined,
): ComputedLine {
  const priced = price !== undefined && price.priceStatus === 'priced' && price.unitPrice !== null && price.quantity !== null;
  let net: string | null = null;
  let tax: string | null = null;
  if (priced) {
    net = round(sub(mul(price.quantity as string, price.unitPrice as string), price.discountAmount ?? '0'), 2);
    tax = round(div(mul(net, price.taxRate ?? '0'), '100', 6), 2);
  }
  return {
    lotId,
    net,
    tax,
    line: {
      pricingItemId: item.id,
      itemCode: item.itemCode,
      description: item.description,
      unit: item.unit,
      requestedQuantity: item.quantity,
      chargeType: item.chargeType,
      recurrence: item.recurrence,
      isOptional: item.isOptional,
      isProvisional: item.isProvisional,
      includeInEvaluation: item.includeInEvaluation,
      priceStatus: price?.priceStatus ?? null,
      unitPrice: price?.unitPrice ?? null,
      quantity: price?.quantity ?? null,
      currency: price?.currency ?? null,
      taxRate: price?.taxRate ?? null,
      discountAmount: price?.discountAmount ?? null,
      lineTotal: net === null || price?.currency === null || price?.currency === undefined ? null : money(net, price.currency),
      notes: price?.notes ?? null,
    },
  };
}

/** Builds the pricing view of a revision from explicit prices and terms (fixture rows or a command body). */
export function buildPricing(
  bid: FixtureBid,
  tender: FixtureBidTender,
  revision: FixtureRevision,
  editable: boolean,
  priceRows: readonly PriceInput[],
  termsRow: TermsInput,
): BidPricing {
  const currency = tender.currency;
  const computed: ComputedLine[] = [];
  const schedules = schedulesFor(tender, bid.lotIds).map((schedule) => {
    const lines = schedule.items.map((item) => {
      const result = computeLine(item, schedule.lotId, priceRows.find((row) => row.pricingItemId === item.id));
      computed.push(result);
      return result.line;
    });
    return { scheduleId: schedule.id, title: schedule.title, lot: lotRefOf(tender, schedule.lotId), lines };
  });

  const inCurrency = computed.filter((row) => row.net !== null && row.line.currency === currency);
  const group = (rows: ComputedLine[]): PriceTotal =>
    total(sum(rows.map((row) => row.net ?? '0')), sum(rows.map((row) => row.tax ?? '0')), currency);
  const oneTimeRows = inCurrency.filter((row) => row.line.chargeType === 'one_time' && !row.line.isOptional);
  const recurrences = [...new Set(inCurrency.filter((row) => row.line.chargeType === 'recurring').map((row) => row.line.recurrence))].filter(
    (value): value is PricingItemsRecurrence => value !== null,
  );
  const totals: PricingTotals = {
    oneTime: group(oneTimeRows),
    recurring: recurrences.map((recurrence) => ({
      recurrence,
      ...group(inCurrency.filter((row) => row.line.chargeType === 'recurring' && row.line.recurrence === recurrence && !row.line.isOptional)),
    })),
    optionalOneTime: group(inCurrency.filter((row) => row.line.chargeType === 'one_time' && row.line.isOptional)),
    byLot: bid.lotIds.flatMap((lotId) => {
      const lot = lotRefOf(tender, lotId);
      return lot === null ? [] : [{ lot, oneTime: group(oneTimeRows.filter((row) => row.lotId === lotId)) }];
    }),
    pricedCount: computed.filter((row) => row.line.priceStatus === 'priced').length,
    includedCount: computed.filter((row) => row.line.priceStatus === 'included').length,
    notOfferedCount: computed.filter((row) => row.line.priceStatus === 'not_offered').length,
    missingCount: computed.filter((row) => row.line.priceStatus === null).length,
  };

  const issues: PricingIssue[] = [];
  for (const { line } of computed) {
    const ref = { pricingItemId: line.pricingItemId, itemCode: line.itemCode };
    if (line.priceStatus === null && !line.isOptional) {
      issues.push({ code: 'PRICE_MISSING', severity: 'blocking', ...ref });
    }
    if (line.priceStatus === 'not_offered' && !line.isOptional) {
      issues.push({ code: 'MANDATORY_ITEM_NOT_OFFERED', severity: 'blocking', ...ref });
    }
    if (line.priceStatus === 'priced' && line.currency !== null && !tender.acceptedCurrencies.includes(line.currency)) {
      issues.push({ code: 'CURRENCY_NOT_ACCEPTED', severity: 'blocking', ...ref });
    }
    if (line.priceStatus === 'priced' && line.quantity !== null && !eq(line.quantity, line.requestedQuantity)) {
      issues.push({ code: 'QUANTITY_DIFFERS', severity: 'warning', ...ref });
    }
    if (
      line.priceStatus === 'priced' &&
      line.discountAmount !== null &&
      line.unitPrice !== null &&
      line.quantity !== null &&
      gt(line.discountAmount, mul(line.unitPrice, line.quantity))
    ) {
      issues.push({ code: 'DISCOUNT_EXCEEDS_LINE', severity: 'blocking', ...ref });
    }
  }
  if (termsRow.validityDays === null) {
    issues.push({ code: 'VALIDITY_TOO_SHORT', severity: 'blocking', pricingItemId: null, itemCode: null });
  } else if (termsRow.validityDays < tender.bidValidityDays) {
    issues.push({ code: 'VALIDITY_TOO_SHORT', severity: 'warning', pricingItemId: null, itemCode: null });
  }

  const firstRecurring = totals.recurring[0];
  return {
    bidId: bid.id,
    revisionId: revision.id,
    revisionNo: revision.revisionNo,
    revisionStatus: revision.status,
    editable,
    currency,
    acceptedCurrencies: [...tender.acceptedCurrencies],
    bidValidityDays: tender.bidValidityDays,
    schedules,
    commercialTerms: {
      validityDays: termsRow.validityDays,
      paymentTerms: termsRow.paymentTerms,
      conditionalDiscounts: termsRow.conditionalDiscounts,
      assumptions: termsRow.assumptions,
      totalOneTime: totals.pricedCount === 0 ? null : totals.oneTime.gross,
      totalRecurringPerPeriod: firstRecurring === undefined ? null : firstRecurring.gross,
      currency,
    },
    totals,
    issues,
  };
}

export function fixturePrices(revisionId: number): PriceInput[] {
  return BID_PRICES.filter((row) => row.revisionId === revisionId);
}

export function fixtureTerms(revisionId: number, tender: FixtureBidTender): TermsInput {
  const row = BID_COMMERCIAL_TERMS.find((terms) => terms.revisionId === revisionId);
  return row ?? { validityDays: tender.bidValidityDays, paymentTerms: null, conditionalDiscounts: null, assumptions: null };
}

/** The pricing view of a revision as stored in the fixtures. */
export function pricingOf(bid: FixtureBid, tender: FixtureBidTender, revision: FixtureRevision, editable: boolean): BidPricing {
  return buildPricing(bid, tender, revision, editable, fixturePrices(revision.id), fixtureTerms(revision.id, tender));
}
