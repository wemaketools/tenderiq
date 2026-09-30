/**
 * SUP-13 — Pricing and commercial offer: quantities, rates, one-time and recurring charges, taxes, currencies,
 * discounts, options, assumptions and totals, under the tender's pricing rules. Prices are restricted to pricing
 * personas (a contributor only sees whether pricing is complete). `priced`, `included` and `not offered` are distinct
 * from a zero price, and every amount is a decimal string (DD-32).
 */
import { useState } from 'react';

import { getPricing, getReadiness, savePricing } from '@contracts/bids';
import type { BidDetail, BidPricing, PriceLine, PriceTotal } from '@contracts/bids';
import { BID_PRICES_PRICE_STATUS } from '@contracts/enums';
import type { BidPricesPriceStatus } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  KpiCard,
  KpiGrid,
  NumberInput,
  ReadinessChecklist,
  RestrictedState,
  Select,
  SkeletonBlock,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { liveLineTotal } from '../lib/pricing';
import { toChecklistItems } from '../lib/readiness';
import { ResponseWorkspace } from '../components/ResponseWorkspace';
import { responseErrorMessage } from '../lib/errors';

interface LineDraft {
  readonly priceStatus: BidPricesPriceStatus | '';
  readonly unitPrice: string;
  readonly quantity: string;
  readonly currency: string;
  readonly taxRate: string;
  readonly discountAmount: string;
  readonly notes: string;
}

interface TermsDraft {
  readonly validityDays: string;
  readonly paymentTerms: string;
  readonly conditionalDiscounts: string;
  readonly assumptions: string;
}

interface PricingDraft {
  readonly lines: Readonly<Record<number, LineDraft>>;
  readonly terms: TermsDraft;
}

function lineDraftOf(line: PriceLine, currency: string): LineDraft {
  return {
    priceStatus: line.priceStatus ?? '',
    unitPrice: line.unitPrice ?? '',
    quantity: line.quantity ?? line.requestedQuantity,
    currency: line.currency ?? currency,
    taxRate: line.taxRate ?? '',
    discountAmount: line.discountAmount ?? '',
    notes: line.notes ?? '',
  };
}

function draftOf(pricing: BidPricing): PricingDraft {
  const lines: Record<number, LineDraft> = {};
  for (const schedule of pricing.schedules) {
    for (const line of schedule.lines) {
      lines[line.pricingItemId] = lineDraftOf(line, pricing.currency);
    }
  }
  return {
    lines,
    terms: {
      validityDays:
        pricing.commercialTerms.validityDays === null
          ? ''
          : String(pricing.commercialTerms.validityDays),
      paymentTerms: pricing.commercialTerms.paymentTerms ?? '',
      conditionalDiscounts: pricing.commercialTerms.conditionalDiscounts ?? '',
      assumptions: pricing.commercialTerms.assumptions ?? '',
    },
  };
}

function TotalRow({ label, total }: { readonly label: string; readonly total: PriceTotal }) {
  return (
    <DetailList
      items={[
        {
          key: `${label}-net`,
          label: t('responses.pricing.totals.net', { label }),
          value: formatMoney(total.net),
        },
        {
          key: `${label}-tax`,
          label: t('responses.pricing.totals.tax'),
          value: formatMoney(total.tax),
        },
        {
          key: `${label}-gross`,
          label: t('responses.pricing.totals.gross'),
          value: <strong>{formatMoney(total.gross)}</strong>,
        },
      ]}
    />
  );
}

function PricingEditor({
  bid,
  pricing,
  onSaved,
}: {
  readonly bid: BidDetail;
  readonly pricing: BidPricing;
  readonly onSaved: (pricing: BidPricing) => void;
}) {
  const toast = useToast();
  const initial = draftOf(pricing);
  const [draft, setDraft] = useState<PricingDraft>(initial);
  const [invalidated, setInvalidated] = useState(0);
  const save = useApiMutation(savePricing);
  const canEdit = pricing.editable && bid.viewer.canEditPricing;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const knownFields = ['lines', 'commercialTerms'];
  const errors = formErrors(save.error, knownFields);

  const lineIndex = new Map<number, number>();
  let index = 0;
  for (const schedule of pricing.schedules) {
    for (const line of schedule.lines) {
      if (draft.lines[line.pricingItemId]?.priceStatus !== '') {
        lineIndex.set(line.pricingItemId, index);
        index += 1;
      }
    }
  }
  const lineError = (pricingItemId: number, field: string): string | undefined => {
    const position = lineIndex.get(pricingItemId);
    return position === undefined ? undefined : errors.forField(`lines.${position}.${field}`);
  };

  const setLine = (pricingItemId: number, values: Partial<LineDraft>): void => {
    setDraft((current) => {
      const existing = current.lines[pricingItemId];
      if (existing === undefined) return current;
      const next: LineDraft = { ...existing, ...values };
      const cleaned: LineDraft =
        next.priceStatus === 'priced' ? next : { ...next, unitPrice: '', discountAmount: '' };
      return { ...current, lines: { ...current.lines, [pricingItemId]: cleaned } };
    });
  };
  const setTerms = (values: Partial<TermsDraft>): void =>
    setDraft((current) => ({ ...current, terms: { ...current.terms, ...values } }));

  const submit = async (): Promise<void> => {
    const lines = pricing.schedules.flatMap((schedule) =>
      schedule.lines.flatMap((line) => {
        const value = draft.lines[line.pricingItemId];
        if (value === undefined || value.priceStatus === '') return [];
        const priced = value.priceStatus === 'priced';
        return [
          {
            pricingItemId: line.pricingItemId,
            priceStatus: value.priceStatus,
            unitPrice: priced && value.unitPrice !== '' ? value.unitPrice : null,
            quantity: value.quantity === '' ? null : value.quantity,
            currency: value.currency === '' ? null : value.currency,
            taxRate: value.taxRate === '' ? null : value.taxRate,
            discountAmount: priced && value.discountAmount !== '' ? value.discountAmount : null,
            notes: value.notes.trim() === '' ? null : value.notes.trim(),
          },
        ];
      }),
    );
    try {
      const result = await save.mutate({
        params: { bidId: bid.id },
        body: {
          revisionId: pricing.revisionId,
          lines,
          commercialTerms: {
            validityDays: draft.terms.validityDays === '' ? null : Number(draft.terms.validityDays),
            paymentTerms: draft.terms.paymentTerms.trim() === '' ? null : draft.terms.paymentTerms,
            conditionalDiscounts:
              draft.terms.conditionalDiscounts.trim() === ''
                ? null
                : draft.terms.conditionalDiscounts,
            assumptions: draft.terms.assumptions.trim() === '' ? null : draft.terms.assumptions,
          },
        },
      });
      setInvalidated(result.invalidatedApprovalIds.length);
      toast.show(t('responses.pricing.saved'), 'success');
      onSaved(result.pricing);
    } catch {
      // Shown in the summary.
    }
  };

  const statusOptions = BID_PRICES_PRICE_STATUS.map((value) => ({
    value,
    label: tEnum('bid_prices.price_status', value),
  }));
  const currencyOptions = pricing.acceptedCurrencies.map((code) => ({ value: code, label: code }));

  const columnsFor = (): DataTableColumn<PriceLine>[] => [
    {
      id: 'item',
      header: t('responses.pricing.col.item'),
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.itemCode}</span>
          <span className="tiq-cell-sub">{row.description}</span>
          <span className="tiq-inline">
            <Chip tone="neutral" size="sm">
              {tEnum('pricing_items.charge_type', row.chargeType)}
              {row.recurrence === null
                ? ''
                : ` · ${tEnum('pricing_items.recurrence', row.recurrence)}`}
            </Chip>
            {row.isOptional && (
              <Chip tone="info" size="sm">
                {t('responses.pricing.optional')}
              </Chip>
            )}
            {row.isProvisional && (
              <Chip tone="info" size="sm" outlined>
                {t('responses.pricing.provisional')}
              </Chip>
            )}
            {!row.includeInEvaluation && (
              <Chip tone="neutral" size="sm" outlined>
                {t('responses.pricing.notEvaluated')}
              </Chip>
            )}
          </span>
        </>
      ),
    },
    {
      id: 'requested',
      header: t('responses.pricing.col.requested'),
      numeric: true,
      cell: (row) => `${row.requestedQuantity} ${row.unit}`,
    },
    {
      id: 'status',
      header: t('responses.pricing.col.status'),
      cell: (row) => {
        const value = draft.lines[row.pricingItemId];
        return (
          <Select
            label={
              <span className="tiq-visually-hidden">
                {t('responses.pricing.statusFor', { item: row.itemCode })}
              </span>
            }
            placeholder={t('responses.pricing.notEntered')}
            value={value?.priceStatus ?? ''}
            disabled={!canEdit}
            options={statusOptions}
            onChange={(priceStatus) =>
              setLine(row.pricingItemId, { priceStatus: priceStatus as LineDraft['priceStatus'] })
            }
            error={lineError(row.pricingItemId, 'priceStatus')}
          />
        );
      },
    },
    {
      id: 'unitPrice',
      header: t('responses.pricing.col.quantityPrice'),
      cell: (row) => {
        const value = draft.lines[row.pricingItemId];
        const quantity = (
          <NumberInput
            label={
              <span className="tiq-visually-hidden">
                {t('responses.pricing.quantityFor', { item: row.itemCode })}
              </span>
            }
            value={value?.quantity ?? ''}
            places={4}
            disabled={!canEdit || value?.priceStatus === ''}
            onChange={(quantity) => setLine(row.pricingItemId, { quantity })}
            error={lineError(row.pricingItemId, 'quantity')}
          />
        );
        if (value !== undefined && value.priceStatus !== 'priced' && value.priceStatus !== '') {
          return (
            <div className="tiq-stack">
              {quantity}
              <Chip tone={value.priceStatus === 'included' ? 'success' : 'neutral'} size="sm">
                {tEnum('bid_prices.price_status', value.priceStatus)}
              </Chip>
            </div>
          );
        }
        return (
          <div className="tiq-stack">
            {quantity}
            <div className="tiq-inline">
              <NumberInput
                label={
                  <span className="tiq-visually-hidden">
                    {t('responses.pricing.unitPriceFor', { item: row.itemCode })}
                  </span>
                }
                value={value?.unitPrice ?? ''}
                places={2}
                disabled={!canEdit || value?.priceStatus !== 'priced'}
                onChange={(unitPrice) => setLine(row.pricingItemId, { unitPrice })}
                error={lineError(row.pricingItemId, 'unitPrice')}
              />
              <Select
                label={
                  <span className="tiq-visually-hidden">
                    {t('responses.pricing.currencyFor', { item: row.itemCode })}
                  </span>
                }
                value={value?.currency ?? pricing.currency}
                disabled={!canEdit || value?.priceStatus !== 'priced'}
                options={currencyOptions}
                onChange={(currency) => setLine(row.pricingItemId, { currency })}
                error={lineError(row.pricingItemId, 'currency')}
              />
            </div>
          </div>
        );
      },
    },
    {
      id: 'tax',
      header: t('responses.pricing.col.taxDiscount'),
      cell: (row) => {
        const value = draft.lines[row.pricingItemId];
        return (
          <div className="tiq-stack">
            <NumberInput
              label={
                <span className="tiq-visually-hidden">
                  {t('responses.pricing.taxFor', { item: row.itemCode })}
                </span>
              }
              value={value?.taxRate ?? ''}
              places={2}
              suffix="%"
              disabled={!canEdit || value?.priceStatus !== 'priced'}
              onChange={(taxRate) => setLine(row.pricingItemId, { taxRate })}
              error={lineError(row.pricingItemId, 'taxRate')}
            />
            <NumberInput
              label={
                <span className="tiq-visually-hidden">
                  {t('responses.pricing.discountFor', { item: row.itemCode })}
                </span>
              }
              value={value?.discountAmount ?? ''}
              places={2}
              disabled={!canEdit || value?.priceStatus !== 'priced'}
              onChange={(discountAmount) => setLine(row.pricingItemId, { discountAmount })}
              error={lineError(row.pricingItemId, 'discountAmount')}
            />
          </div>
        );
      },
    },
    {
      id: 'total',
      header: t('responses.pricing.col.total'),
      numeric: true,
      cell: (row) => {
        const value = draft.lines[row.pricingItemId];
        if (value === undefined || value.priceStatus === '') {
          return <span className="tiq-text-warning">{t('responses.pricing.missing')}</span>;
        }
        if (value.priceStatus !== 'priced') {
          return tEnum('bid_prices.price_status', value.priceStatus);
        }
        const total = liveLineTotal(value);
        return total === null
          ? t('responses.pricing.incomplete')
          : formatMoney({ amount: total, currency: value.currency || pricing.currency });
      },
    },
  ];

  return (
    <>
      <UnsavedChangesGuard when={dirty} />
      {!canEdit && (
        <Banner tone="info" title={t('responses.pricing.readOnlyTitle')}>
          <p>
            {pricing.editable
              ? t('responses.pricing.readOnlyPermission')
              : t('responses.pricing.readOnlyRevision', { no: pricing.revisionNo })}
          </p>
        </Banner>
      )}
      {pricing.schedules.map((schedule) => (
        <Card
          key={schedule.scheduleId}
          flush
          title={schedule.title}
          subtitle={
            schedule.lot === null
              ? t('responses.pricing.allLots')
              : t('responses.lots.option', { no: schedule.lot.lotNo, title: schedule.lot.title })
          }
        >
          <DataTable
            caption={schedule.title}
            columns={columnsFor()}
            rows={schedule.lines}
            rowKey={(row) => String(row.pricingItemId)}
            empty={<EmptyState compact title={t('responses.pricing.noLines')} />}
          />
        </Card>
      ))}
      <Card
        title={t('responses.pricing.terms.title')}
        subtitle={t('responses.pricing.terms.subtitle', { days: pricing.bidValidityDays })}
      >
        <fieldset className="tiq-form-grid" disabled={!canEdit}>
          <legend className="tiq-visually-hidden">{t('responses.pricing.terms.title')}</legend>
          <TextField
            label={t('responses.pricing.terms.validity')}
            required
            inputMode="numeric"
            value={draft.terms.validityDays}
            onChange={(validityDays) => setTerms({ validityDays: validityDays.replace(/\D/g, '') })}
            error={errors.forField('commercialTerms.validityDays')}
          />
          <TextArea
            label={t('responses.pricing.terms.payment')}
            value={draft.terms.paymentTerms}
            rows={2}
            onChange={(paymentTerms) => setTerms({ paymentTerms })}
            error={errors.forField('commercialTerms.paymentTerms')}
          />
          <TextArea
            label={t('responses.pricing.terms.discounts')}
            value={draft.terms.conditionalDiscounts}
            rows={2}
            onChange={(conditionalDiscounts) => setTerms({ conditionalDiscounts })}
            error={errors.forField('commercialTerms.conditionalDiscounts')}
          />
          <TextArea
            label={t('responses.pricing.terms.assumptions')}
            value={draft.terms.assumptions}
            rows={2}
            onChange={(assumptions) => setTerms({ assumptions })}
            error={errors.forField('commercialTerms.assumptions')}
          />
        </fieldset>
        {canEdit && (
          <div className="tiq-inline tiq-stack--spaced">
            <Button
              variant="primary"
              loading={save.pending}
              disabled={!dirty}
              onClick={() => void submit()}
            >
              {t('responses.pricing.save')}
            </Button>
            <Button disabled={!dirty || save.pending} onClick={() => setDraft(initial)}>
              {t('responses.answer.discard')}
            </Button>
            <span className="tiq-text-muted">{t('responses.answer.saveIsNotSubmit')}</span>
          </div>
        )}
        {invalidated > 0 && (
          <Banner
            tone="warning"
            title={t('responses.common.approvalsInvalidated', { count: invalidated })}
          >
            <p>{t('responses.common.approvalsInvalidatedHint')}</p>
          </Banner>
        )}
        {save.error !== null && (
          <FormErrorSummary title={responseErrorMessage(save.error)} errors={errors.other} />
        )}
      </Card>
    </>
  );
}

function PricingSummary({ pricing }: { readonly pricing: BidPricing }) {
  const { totals } = pricing;
  return (
    <div className="tiq-grid tiq-grid--2">
      <Card
        title={t('responses.pricing.totals.title')}
        subtitle={t('responses.pricing.totals.subtitle')}
      >
        <div className="tiq-stack">
          <strong>{t('responses.pricing.totals.oneTime')}</strong>
          <TotalRow label={t('responses.pricing.totals.oneTime')} total={totals.oneTime} />
          {totals.recurring.map((row) => (
            <div key={row.recurrence} className="tiq-stack">
              <strong>
                {t('responses.pricing.totals.recurring', {
                  recurrence: tEnum('pricing_items.recurrence', row.recurrence),
                })}
              </strong>
              <TotalRow label={tEnum('pricing_items.recurrence', row.recurrence)} total={row} />
            </div>
          ))}
          <strong>{t('responses.pricing.totals.optional')}</strong>
          <p className="tiq-text-muted">{t('responses.pricing.totals.optionalHint')}</p>
          <TotalRow label={t('responses.pricing.totals.optional')} total={totals.optionalOneTime} />
          {totals.byLot.length > 0 && (
            <DetailList
              stacked
              items={totals.byLot.map((row) => ({
                key: String(row.lot.lotId),
                label: t('responses.lots.option', { no: row.lot.lotNo, title: row.lot.title }),
                value: formatMoney(row.oneTime.gross),
              }))}
            />
          )}
        </div>
      </Card>
      <Card title={t('responses.pricing.issues.title')}>
        {pricing.issues.length === 0 ? (
          <EmptyState compact icon="checkCircle" title={t('responses.pricing.issues.none')} />
        ) : (
          <ReadinessChecklist
            label={t('responses.pricing.issues.title')}
            items={pricing.issues.map((issue, position) => ({
              id: `${issue.code}-${issue.pricingItemId ?? 'terms'}-${position}`,
              status: issue.severity,
              label: t(`responses.pricing.issue.${issue.code}`),
              detail: issue.itemCode ?? undefined,
            }))}
          />
        )}
      </Card>
    </div>
  );
}

function PricingContent({ bid }: { readonly bid: BidDetail }) {
  const [saved, setSaved] = useState<BidPricing | null>(null);
  const query = useApiQuery(
    getPricing,
    bid.viewer.canViewPricing ? { params: { bidId: bid.id }, query: {} } : null,
  );
  const readiness = useApiQuery(
    getReadiness,
    bid.viewer.canViewPricing ? null : { params: { bidId: bid.id }, query: {} },
  );

  if (!bid.viewer.canViewPricing || query.error?.kind === 'forbidden') {
    const pricingItems = toChecklistItems(
      (readiness.data?.items ?? []).filter((item) => item.category === 'pricing'),
    );
    return (
      <div className="tiq-grid tiq-grid--sidebar">
        <RestrictedState
          title={t('responses.pricing.restrictedTitle')}
          description={t('responses.pricing.restrictedDescription')}
        />
        <Card title={t('responses.pricing.completenessTitle')}>
          {readiness.data === undefined ? (
            readiness.error !== null ? (
              <ErrorState error={readiness.error} onRetry={readiness.reload} />
            ) : (
              <SkeletonBlock lines={3} />
            )
          ) : (
            <ReadinessChecklist
              label={t('responses.pricing.completenessTitle')}
              items={pricingItems}
            />
          )}
        </Card>
      </div>
    );
  }

  const pricing = saved ?? query.data;
  if (pricing === undefined) {
    return query.error !== null ? (
      <ErrorState error={query.error} onRetry={query.reload} />
    ) : (
      <SkeletonBlock lines={8} />
    );
  }

  const { totals } = pricing;
  return (
    <>
      <KpiGrid>
        <KpiCard
          label={t('responses.pricing.kpi.total')}
          icon="coins"
          value={formatMoney(totals.oneTime.gross)}
          hint={t('responses.pricing.kpi.totalHint')}
        />
        <KpiCard
          label={t('responses.pricing.kpi.priced')}
          icon="checkCircle"
          tone="success"
          value={formatCount(totals.pricedCount)}
          hint={t('responses.pricing.kpi.pricedHint', {
            included: totals.includedCount,
            notOffered: totals.notOfferedCount,
          })}
        />
        <KpiCard
          label={t('responses.pricing.kpi.missing')}
          icon="alertTriangle"
          tone={totals.missingCount > 0 ? 'danger' : 'success'}
          value={formatCount(totals.missingCount)}
          hint={t('responses.pricing.kpi.missingHint')}
        />
        <KpiCard
          label={t('responses.pricing.kpi.validity')}
          icon="calendar"
          tone="info"
          value={
            pricing.commercialTerms.validityDays === null
              ? null
              : t('responses.pricing.days', { count: pricing.commercialTerms.validityDays })
          }
          hint={t('responses.pricing.kpi.validityHint', { days: pricing.bidValidityDays })}
        />
      </KpiGrid>
      <PricingEditor
        key={`${pricing.revisionId}-${JSON.stringify(pricing.totals.oneTime)}`}
        bid={bid}
        pricing={pricing}
        onSaved={setSaved}
      />
      <PricingSummary pricing={pricing} />
    </>
  );
}

export default function PricingPage() {
  return (
    <ResponseWorkspace tab="pricing" title={t('responses.pricing.pageTitle')}>
      {(bid) => <PricingContent bid={bid} />}
    </ResponseWorkspace>
  );
}
