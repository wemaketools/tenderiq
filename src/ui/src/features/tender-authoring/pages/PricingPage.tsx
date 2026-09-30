/**
 * BUY-10 — Pricing and commercial terms: pricing schedules with units, currencies, taxes, options (optional and
 * provisional items, one-time vs recurring charges, evaluation periods), accepted discounts and how they enter
 * comparison, the accepted price entries (priced, zero, included, not offered), bid validity and the draft contract
 * terms.
 * Principal actions: define the requested offer and its evaluation basis; review the affordability assumptions
 * (estimate against budget, per lot).
 */
import { useState } from 'react';

import { TENDER_TERMS_TERM_TYPE } from '@contracts/enums';
import type { TenderTermsTermType } from '@contracts/enums';
import { getPricing } from '@contracts/tenders';
import type { PricingItem, PricingSchedule, TenderTerm } from '@contracts/tenders';

import { useApiQuery } from '../../../api/hooks';
import {
  Button,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  MoneyText,
  OrDash,
  RestrictedState,
  SkeletonBlock,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { IssueChips, IssueList } from '../components/IssueList';

import {
  CommercialDialog,
  ItemDialog,
  ScheduleDialog,
  TermDialog,
} from '../components/PricingDialogs';
import { TenderHeader, TenderWorkspace } from '../components/TenderWorkspace';
import type { TenderWorkspaceContext } from '../components/TenderWorkspace';
import { scopeLabel } from '../lib/labels';
import { priceRuleItems } from '../lib/priceRules';
import { useOverlay } from '../lib/overlay';

export default function PricingPage() {
  return <TenderWorkspace>{(context) => <Pricing context={context} />}</TenderWorkspace>;
}

const AFFORDABILITY_TONE = {
  within_budget: 'success',
  exceeds_budget: 'danger',
  not_assessed: 'neutral',
} as const;

function Pricing({ context }: { readonly context: TenderWorkspaceContext }) {
  const { tender, canEdit } = context;
  const query = useApiQuery(getPricing, { params: { tenderId: tender.id } });
  const schedules = useOverlay<PricingSchedule>();
  const terms = useOverlay<TenderTerm>();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleEditing, setScheduleEditing] = useState<PricingSchedule | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemTarget, setItemTarget] = useState<{
    schedule: PricingSchedule;
    item: PricingItem | null;
  } | null>(null);
  const [termOpen, setTermOpen] = useState(false);
  const [termType, setTermType] = useState<TenderTermsTermType | null>(null);
  const [commercialOpen, setCommercialOpen] = useState(false);

  const data = query.data;
  const scheduleRows = data === undefined ? [] : schedules.apply(data.schedules);
  const termRows = data === undefined ? [] : terms.apply(data.terms);

  const itemColumns = (schedule: PricingSchedule): DataTableColumn<PricingItem>[] => [
    {
      id: 'code',
      header: t('tender-authoring.pricing.col.code'),
      cell: (row) => <span className="tiq-mono">{row.itemCode}</span>,
    },
    {
      id: 'description',
      header: t('tender-authoring.pricing.col.description'),
      cell: (row) => row.description,
    },
    { id: 'unit', header: t('tender-authoring.pricing.col.unit'), cell: (row) => row.unit },
    {
      id: 'quantity',
      header: t('tender-authoring.pricing.col.quantity'),
      numeric: true,
      cell: (row) => formatDecimalString(row.quantity),
    },
    {
      id: 'charge',
      header: t('tender-authoring.pricing.col.charge'),
      cell: (row) => (
        <>
          <span>{tEnum('pricing_items.charge_type', row.chargeType)}</span>
          {row.recurrence !== null && (
            <span className="tiq-cell-sub">
              {tEnum('pricing_items.recurrence', row.recurrence)}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'flags',
      header: t('tender-authoring.pricing.col.flags'),
      cell: (row) => (
        <span className="tiq-inline">
          {row.isOptional && (
            <Chip tone="info" size="sm">
              {t('tender-authoring.pricing.optional')}
            </Chip>
          )}
          {row.isProvisional && (
            <Chip tone="warning" size="sm">
              {t('tender-authoring.pricing.provisional')}
            </Chip>
          )}
          <Chip tone={row.includeInEvaluation ? 'success' : 'neutral'} size="sm">
            {row.includeInEvaluation
              ? t('tender-authoring.pricing.evaluated')
              : t('tender-authoring.pricing.notEvaluated')}
          </Chip>
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('tender-authoring.common.actions'),
      cell: (row) =>
        canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            icon="edit"
            aria-label={t('tender-authoring.pricing.editItem', { code: row.itemCode })}
            onClick={() => {
              setItemTarget({ schedule, item: row });
              setItemOpen(true);
            }}
          >
            {t('tender-authoring.common.edit')}
          </Button>
        ) : null,
    },
  ];

  const content = (() => {
    if (query.error !== null) {
      return query.error.kind === 'forbidden' ? (
        <RestrictedState />
      ) : (
        <ErrorState error={query.error} onRetry={query.reload} />
      );
    }
    if (data === undefined) return <SkeletonBlock lines={8} />;
    const affordability = data.affordability;
    const itemCount = scheduleRows.reduce((total, row) => total + row.items.length, 0);
    return (
      <>
        <KpiGrid>
          <KpiCard
            label={t('tender-authoring.pricing.kpi.schedules')}
            icon="table"
            value={scheduleRows.length}
            hint={t('tender-authoring.pricing.kpi.items', { count: itemCount })}
          />
          <KpiCard
            label={t('tender-authoring.fields.estimatedValue')}
            icon="coins"
            tone="info"
            value={<MoneyText value={affordability.estimatedValue} />}
          />
          <KpiCard
            label={t('tender-authoring.fields.budgetAmount')}
            icon="wallet"
            tone="accent"
            value={<MoneyText value={affordability.budgetAmount} />}
          />
          <KpiCard
            label={t('tender-authoring.pricing.kpi.headroom')}
            icon="scale"
            tone={affordability.status === 'exceeds_budget' ? 'danger' : 'success'}
            value={<MoneyText value={affordability.headroom} />}
            hint={t(`tender-authoring.pricing.affordability.${affordability.status}`)}
          />
        </KpiGrid>
        <IssueList issues={data.issues} label={t('tender-authoring.pricing.issues')} />
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack">
            {scheduleRows.length === 0 ? (
              <Card>
                <EmptyState
                  icon="table"
                  title={t('tender-authoring.pricing.noSchedules')}
                  description={t('tender-authoring.pricing.noSchedulesHint')}
                />
              </Card>
            ) : (
              scheduleRows.map((schedule) => (
                <Card
                  key={schedule.id}
                  title={schedule.name}
                  subtitle={`${scopeLabel(schedule.lot)} · ${
                    schedule.evaluationPeriods === null
                      ? t('tender-authoring.pricing.noPeriods')
                      : t('tender-authoring.pricing.periodsValue', {
                          count: schedule.evaluationPeriods,
                        })
                  }`}
                  flush
                  actions={
                    canEdit ? (
                      <span className="tiq-inline">
                        <Button
                          size="sm"
                          icon="plus"
                          aria-label={t('tender-authoring.pricing.addItemTo', {
                            name: schedule.name,
                          })}
                          onClick={() => {
                            setItemTarget({ schedule, item: null });
                            setItemOpen(true);
                          }}
                        >
                          {t('tender-authoring.pricing.addItem')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="edit"
                          aria-label={t('tender-authoring.pricing.editSchedule', {
                            name: schedule.name,
                          })}
                          onClick={() => {
                            setScheduleEditing(schedule);
                            setScheduleOpen(true);
                          }}
                        >
                          {t('tender-authoring.common.edit')}
                        </Button>
                      </span>
                    ) : undefined
                  }
                >
                  <div className="tiq-stack tiq-stack--spaced">
                    <DetailList
                      items={[
                        {
                          key: 'instructions',
                          label: t('tender-authoring.pricing.instructions'),
                          value: schedule.instructions,
                        },
                        {
                          key: 'tax',
                          label: t('tender-authoring.pricing.tax'),
                          value: schedule.taxTreatment,
                        },
                        {
                          key: 'issues',
                          label: t('tender-authoring.requirements.col.issues'),
                          value:
                            schedule.issues.length === 0 ? (
                              t('tender-authoring.common.none')
                            ) : (
                              <IssueChips issues={schedule.issues} />
                            ),
                        },
                      ]}
                    />
                    <DetailList stacked items={priceRuleItems(schedule)} />
                    <IssueList
                      issues={schedule.issues}
                      label={t('tender-authoring.pricing.scheduleIssues', { name: schedule.name })}
                    />
                  </div>
                  <DataTable
                    caption={t('tender-authoring.pricing.itemsCaption', { name: schedule.name })}
                    columns={itemColumns(schedule)}
                    rows={schedule.items}
                    rowKey={(row) => String(row.id)}
                    empty={
                      <EmptyState
                        compact
                        icon="list"
                        title={t('tender-authoring.pricing.noItems')}
                      />
                    }
                  />
                </Card>
              ))
            )}
          </div>
          <div className="tiq-stack">
            <Card
              title={t('tender-authoring.pricing.commercialTitle')}
              actions={
                canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="edit"
                    onClick={() => setCommercialOpen(true)}
                  >
                    {t('tender-authoring.common.edit')}
                  </Button>
                ) : undefined
              }
            >
              <DetailList
                stacked
                items={[
                  {
                    key: 'currency',
                    label: t('tender-authoring.pricing.currency'),
                    value: tender.currency,
                  },
                  {
                    key: 'accepted',
                    label: t('tender-authoring.pricing.accepted'),
                    value: tender.acceptedCurrencies.join(', '),
                  },
                  {
                    key: 'validity',
                    label: t('tender-authoring.pricing.validity'),
                    value:
                      tender.bidValidityDays === null
                        ? null
                        : t('tender-authoring.pricing.days', { count: tender.bidValidityDays }),
                  },
                  {
                    key: 'alternatives',
                    label: t('tender-authoring.fields.alternativesAllowed'),
                    value: tender.alternativesAllowed
                      ? t('tender-authoring.common.yes')
                      : t('tender-authoring.common.no'),
                  },
                ]}
              />
            </Card>
            <Card title={t('tender-authoring.pricing.affordabilityTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    key: 'status',
                    label: t('tender-authoring.pricing.affordabilityStatus'),
                    value: (
                      <Chip tone={AFFORDABILITY_TONE[affordability.status]} size="sm">
                        {t(`tender-authoring.pricing.affordability.${affordability.status}`)}
                      </Chip>
                    ),
                  },
                  ...affordability.lots.map((row) => ({
                    key: `lot-${row.lot.id}`,
                    label: scopeLabel(row.lot),
                    value: <MoneyText value={row.estimatedValue} />,
                  })),
                  {
                    key: 'assumptions',
                    label: t('tender-authoring.pricing.assumptions'),
                    value: affordability.assumptions,
                  },
                ]}
              />
            </Card>
            <Card
              title={t('tender-authoring.pricing.termsTitle')}
              subtitle={t('tender-authoring.pricing.termsSubtitle')}
            >
              <ul className="tiq-stack" aria-label={t('tender-authoring.pricing.termsTitle')}>
                {TENDER_TERMS_TERM_TYPE.map((type) => {
                  const term = termRows.find((row) => row.termType === type) ?? null;
                  return (
                    <li key={type} className="tiq-stack">
                      <span className="tiq-inline">
                        <strong>{tEnum('tender_terms.term_type', type)}</strong>
                        {term === null ? (
                          <Chip tone={type === 'draft_contract' ? 'danger' : 'neutral'} size="sm">
                            {t('tender-authoring.pricing.termMissing')}
                          </Chip>
                        ) : (
                          <span className="tiq-text-muted">
                            {formatDateTime(term.updatedAt, tender.officialTimeZone)}
                          </span>
                        )}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={term === null ? 'plus' : 'edit'}
                            aria-label={t('tender-authoring.pricing.editTerm', {
                              term: tEnum('tender_terms.term_type', type),
                            })}
                            onClick={() => {
                              setTermType(type);
                              setTermOpen(true);
                            }}
                          >
                            {term === null
                              ? t('tender-authoring.common.add')
                              : t('tender-authoring.common.edit')}
                          </Button>
                        )}
                      </span>
                      <OrDash>{term?.content ?? null}</OrDash>
                      {term?.document !== null && term?.document !== undefined && (
                        <span className="tiq-cell-sub">
                          {t('tender-authoring.pricing.termDocument', {
                            title: term.document.title,
                          })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      </>
    );
  })();

  return (
    <>
      <TenderHeader
        context={context}
        section="pricing"
        primaryAction={
          canEdit ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                setScheduleEditing(null);
                setScheduleOpen(true);
              }}
            >
              {t('tender-authoring.pricing.addSchedule')}
            </Button>
          ) : undefined
        }
      />
      {content}
      {canEdit && (
        <>
          <ScheduleDialog
            open={scheduleOpen}
            tenderId={tender.id}
            lots={tender.lots}
            schedule={scheduleEditing}
            onClose={() => setScheduleOpen(false)}
            onSaved={(result) => {
              schedules.put(result.schedule);
              context.reportChange(result.change);
            }}
          />
          <ItemDialog
            open={itemOpen}
            tenderId={tender.id}
            schedule={itemTarget?.schedule ?? null}
            item={itemTarget?.item ?? null}
            onClose={() => setItemOpen(false)}
            onSaved={(result) => {
              const schedule = scheduleRows.find((row) => row.id === result.scheduleId);
              if (schedule !== undefined) {
                const exists = schedule.items.some((row) => row.id === result.item.id);
                schedules.put({
                  ...schedule,
                  items: exists
                    ? schedule.items.map((row) => (row.id === result.item.id ? result.item : row))
                    : [...schedule.items, result.item],
                });
              }
              context.reportChange(result.change);
            }}
          />
          <TermDialog
            open={termOpen}
            tenderId={tender.id}
            termType={termType}
            term={termRows.find((row) => row.termType === termType) ?? null}
            onClose={() => setTermOpen(false)}
            onSaved={(result) => {
              terms.put(result.term);
              context.reportChange(result.change);
            }}
          />
          <CommercialDialog
            open={commercialOpen}
            tender={tender}
            onClose={() => setCommercialOpen(false)}
            onSaved={(result) => {
              context.setTender(result.tender);
              context.reportChange(result.change);
            }}
          />
        </>
      )}
    </>
  );
}
