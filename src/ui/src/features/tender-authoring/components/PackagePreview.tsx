/**
 * The package exactly as a participating supplier or the public would see it once released (BUY-13): the notice,
 * lots, disclosed dates, requirements, pricing schedules, evaluation rules, participation conditions, terms and the
 * documents of that audience. What is withheld (estimates, budget, team, internal documents and dates) is listed.
 */
import { useState } from 'react';

import { previewPackage } from '@contracts/tenders';
import type { PackagePreview as Preview, PreviewAudience } from '@contracts/tenders';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  OfficialDeadline,
  QueryView,
  StatusChip,
  Tabs,
} from '../../../components/ui';
import { formatCalendarDate, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { currenciesText, languageName, languageNames } from '../lib/labels';
import { priceRuleItems } from '../lib/priceRules';

const lotText = (lotNo: number | null): string =>
  lotNo === null
    ? t('tender-authoring.common.wholeTender')
    : t('tender-authoring.common.lotNo', { no: lotNo });

function PreviewBody({ preview }: { readonly preview: Preview }) {
  if (!preview.visible || preview.notice === null) {
    return (
      <Banner tone="info" title={t('tender-authoring.preview.hiddenTitle')}>
        <p>{t(`tender-authoring.preview.hidden.${preview.hiddenReason ?? 'invitation_only'}`)}</p>
      </Banner>
    );
  }
  const notice = preview.notice;
  const permitted = Object.entries(notice.permitted)
    .filter(([, allowed]) => allowed)
    .map(([key]) => t(`tender-authoring.preview.permitted.${key}`));
  return (
    <div className="tiq-stack tiq-stack--spaced">
      <DetailList
        items={[
          {
            key: 'ref',
            label: t('tender-authoring.fields.reference'),
            value: <span className="tiq-ref">{notice.reference}</span>,
          },
          {
            key: 'buyer',
            label: t('tender-authoring.preview.buyer'),
            value:
              notice.contractingEntity === null
                ? notice.buyerName
                : `${notice.buyerName} · ${notice.contractingEntity}`,
          },
          {
            key: 'eventType',
            label: t('tender-authoring.fields.eventType'),
            value: tEnum('tenders.event_type', notice.eventType),
          },
          {
            key: 'procedure',
            label: t('tender-authoring.fields.procedure'),
            value: tEnum('tenders.procedure', notice.procedure),
          },
          {
            key: 'participation',
            label: t('tender-authoring.fields.participation'),
            value: tEnum('tenders.participation', notice.participation),
          },
          {
            key: 'category',
            label: t('tender-authoring.fields.category'),
            value: notice.category?.name ?? null,
          },
          {
            key: 'currency',
            label: t('tender-authoring.preview.currencies'),
            value: currenciesText(notice.currency, notice.acceptedCurrencies),
          },
          {
            key: 'languages',
            label: t('tender-authoring.preview.languages'),
            value: languageNames(notice.acceptedLanguages),
          },
          {
            key: 'validity',
            label: t('tender-authoring.pricing.validity'),
            value:
              notice.bidValidityDays === null
                ? null
                : t('tender-authoring.pricing.days', { count: notice.bidValidityDays }),
          },
          {
            key: 'award',
            label: t('tender-authoring.fields.awardModel'),
            value: tEnum('tenders.award_model', notice.awardModel),
          },
          {
            key: 'permitted',
            label: t('tender-authoring.preview.permittedLabel'),
            value:
              permitted.length === 0 ? t('tender-authoring.common.none') : permitted.join(', '),
          },
        ]}
      />
      <p>{notice.summary ?? t('tender-authoring.overview.noSummary')}</p>
      <DetailList
        stacked
        items={[
          {
            key: 'eligibility',
            label: t('tender-authoring.fields.eligibilitySummary'),
            value: notice.eligibilitySummary,
          },
          {
            key: 'delivery',
            label: t('tender-authoring.fields.deliveryRequirements'),
            value: notice.deliveryRequirements,
          },
          {
            key: 'submission',
            label: t('tender-authoring.timetable.submissionRules'),
            value: notice.submissionRules,
          },
          {
            key: 'late',
            label: t('tender-authoring.timetable.lateRule'),
            value: notice.lateMaterialRule,
          },
          {
            key: 'channel',
            label: t('tender-authoring.timetable.channel'),
            value: notice.communicationChannelNote,
          },
        ]}
      />
      {preview.milestones.length > 0 && (
        <DetailList
          stacked
          items={preview.milestones.map((row) => ({
            key: `${row.milestone}-${row.lotNo ?? 'tender'}`,
            label: `${tEnum('tender_milestones.milestone', row.milestone)} · ${lotText(row.lotNo)}`,
            value: <OfficialDeadline deadline={row.deadline} showLocal={false} />,
          }))}
        />
      )}
      {preview.lots.length > 0 && (
        <DataTable
          caption={t('tender-authoring.preview.lots')}
          columns={[
            { id: 'no', header: t('tender-authoring.lots.col.no'), cell: (row) => row.lotNo },
            {
              id: 'title',
              header: t('tender-authoring.lots.col.title'),
              cell: (row) => (
                <>
                  <span>{row.title}</span>
                  <span className="tiq-cell-sub">{row.description ?? ''}</span>
                </>
              ),
            },
            {
              id: 'quantity',
              header: t('tender-authoring.lots.quantity'),
              cell: (row) => row.quantityDescription ?? '',
            },
            {
              id: 'delivery',
              header: t('tender-authoring.lots.location'),
              cell: (row) =>
                [
                  row.deliveryLocation,
                  row.deliveryDate === null ? null : formatCalendarDate(row.deliveryDate),
                ]
                  .filter((value) => value !== null)
                  .join(' · '),
            },
          ]}
          rows={preview.lots}
          rowKey={(row) => String(row.lotNo)}
        />
      )}
      {preview.requirements.length > 0 && (
        <DataTable
          caption={t('tender-authoring.preview.requirements')}
          columns={[
            {
              id: 'ref',
              header: t('tender-authoring.requirements.col.ref'),
              cell: (row) => (
                <>
                  <span className="tiq-mono">{row.refCode}</span>
                  <span className="tiq-cell-sub">{lotText(row.lotNo)}</span>
                </>
              ),
            },
            {
              id: 'text',
              header: t('tender-authoring.requirements.col.text'),
              cell: (row) => (
                <>
                  <span>{row.text}</span>
                  <span className="tiq-cell-sub">
                    {row.evidenceRequired ?? row.responseInstructions ?? ''}
                  </span>
                </>
              ),
            },
            {
              id: 'treatment',
              header: t('tender-authoring.requirements.col.treatment'),
              cell: (row) => (
                <StatusChip enum="requirements.treatment" value={row.treatment} size="sm" />
              ),
            },
            {
              id: 'envelope',
              header: t('tender-authoring.requirements.col.envelope'),
              cell: (row) => tEnum('requirements.envelope', row.envelope),
            },
          ]}
          rows={preview.requirements}
          rowKey={(row) => row.refCode}
        />
      )}
      {preview.pricingSchedules.map((schedule) => (
        <div key={schedule.name} className="tiq-stack">
          <DataTable
            caption={`${schedule.name} · ${lotText(schedule.lotNo)}`}
            columns={[
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
              {
                id: 'unit',
                header: t('tender-authoring.pricing.col.unit'),
                cell: (row) => row.unit,
              },
              {
                id: 'quantity',
                header: t('tender-authoring.pricing.col.quantity'),
                numeric: true,
                cell: (row) => formatDecimalString(row.quantity),
              },
              {
                id: 'charge',
                header: t('tender-authoring.pricing.col.charge'),
                cell: (row) => tEnum('pricing_items.charge_type', row.chargeType),
              },
            ]}
            rows={schedule.items}
            rowKey={(row) => row.itemCode}
          />
          <DetailList
            stacked
            items={[
              {
                key: 'instructions',
                label: t('tender-authoring.pricing.instructions'),
                value: schedule.instructions,
              },
              ...priceRuleItems(schedule),
            ]}
          />
        </div>
      ))}
      {preview.evaluation !== null && (
        <DetailList
          stacked
          items={[
            {
              key: 'criteria',
              label: t('tender-authoring.plan.criteria'),
              value: preview.evaluation.criteria
                .map((row) => `${row.code} ${row.name} (${formatDecimalString(row.maxPoints)})`)
                .join('; '),
            },
            {
              key: 'price',
              label: t('tender-authoring.plan.priceMethod'),
              value: tEnum('evaluation_plans.price_method', preview.evaluation.priceMethod),
            },
            {
              key: 'threshold',
              label: t('tender-authoring.plan.thresholdScope'),
              value: `${tEnum('evaluation_plans.threshold_scope', preview.evaluation.thresholdScope)}${preview.evaluation.nonPriceThreshold === null ? '' : ` · ${formatDecimalString(preview.evaluation.nonPriceThreshold)}`}`,
            },
            {
              key: 'ties',
              label: t('tender-authoring.plan.tieRules'),
              value: preview.evaluation.tieBreakRules
                .map((row) => tEnum('tie_break_rules.rule', row.rule))
                .join(' → '),
            },
          ]}
        />
      )}
      {preview.participationConditions.length > 0 && (
        <ul className="tiq-stack" aria-label={t('tender-authoring.conditions.title')}>
          {preview.participationConditions.map((row) => (
            <li key={`${row.conditionType}-${row.description}`}>
              <strong>{tEnum('participation_conditions.condition_type', row.conditionType)}</strong>
              : {row.description}
            </li>
          ))}
        </ul>
      )}
      {preview.terms.length > 0 && (
        <DetailList
          stacked
          items={preview.terms.map((row) => ({
            key: row.termType,
            label: tEnum('tender_terms.term_type', row.termType),
            value: row.content,
          }))}
        />
      )}
      <DataTable
        caption={t('tender-authoring.preview.documents')}
        columns={[
          {
            id: 'title',
            header: t('tender-authoring.release.docs.title'),
            cell: (row) => (
              <>
                <span>{row.title}</span>
                <span className="tiq-cell-sub">{row.fileName}</span>
              </>
            ),
          },
          {
            id: 'classification',
            header: t('tender-authoring.release.docs.classification'),
            cell: (row) => (
              <StatusChip enum="documents.classification" value={row.classification} size="sm" />
            ),
          },
          {
            id: 'language',
            header: t('tender-authoring.release.docs.language'),
            cell: (row) => languageName(row.language),
          },
          {
            id: 'precedence',
            header: t('tender-authoring.release.docs.precedence'),
            cell: (row) => row.precedence ?? '',
          },
        ]}
        rows={preview.documents}
        rowKey={(row) => String(row.documentId)}
        empty={<EmptyState compact icon="file" title={t('tender-authoring.preview.noDocuments')} />}
      />
      <div className="tiq-stack">
        <span className="tiq-text-muted">{t('tender-authoring.preview.withheld')}</span>
        <span className="tiq-inline" data-testid="withheld">
          {preview.withheld.map((item) => (
            <Chip key={item} tone="neutral" size="sm" icon="eyeOff">
              {item}
            </Chip>
          ))}
        </span>
      </div>
    </div>
  );
}

export function PackagePreviewCard({ tenderId }: { readonly tenderId: number }) {
  const [audience, setAudience] = useState<PreviewAudience>('supplier');
  const query = useApiQuery(previewPackage, { params: { tenderId }, query: { audience } });
  return (
    <Card
      title={t('tender-authoring.preview.title')}
      subtitle={t('tender-authoring.preview.subtitle')}
    >
      <Tabs
        label={t('tender-authoring.preview.audience')}
        selected={audience}
        onSelect={(id) => setAudience(id === 'public' ? 'public' : 'supplier')}
        tabs={[
          { id: 'supplier', label: t('tender-authoring.preview.supplier') },
          { id: 'public', label: t('tender-authoring.preview.public') },
        ]}
      >
        <QueryView query={query}>{(data) => <PreviewBody preview={data} />}</QueryView>
      </Tabs>
    </Card>
  );
}
