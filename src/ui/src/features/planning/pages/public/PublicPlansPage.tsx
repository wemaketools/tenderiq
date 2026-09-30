/**
 * PUB-06 Procurement plans and advance notices (public). Required information: planned categories, indicative
 * timing, status and expression-of-interest instructions. Principal actions: follow future opportunities; the page
 * states that forecasts may change and are not invitations to submit a bid.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { PublicAdvanceNotice } from '@contracts/requests';

import { useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  QueryView,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableSort } from '../../../../components/ui';
import { browserTimeZone, formatInstantDate } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { planningPaths } from '../../lib';

/** Publication dates are shown as calendar dates in the reader's zone (no deadline is involved). */
const PUBLIC_ZONE = browserTimeZone();

export default function PublicPlansPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [buyer, setBuyer] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSort>({ key: 'publishedAt', dir: 'desc' });
  const summary = useApiQuery(requestEndpoints.getPublicPlanSummary, {
    query: buyer === '' ? {} : { buyerSlug: buyer },
  });
  const notices = useApiQuery(requestEndpoints.listPublicAdvanceNotices, {
    query: {
      page,
      pageSize: 25,
      sort: sort.key as 'publishedAt' | 'title',
      dir: sort.dir,
      ...(q.trim() === '' ? {} : { q: q.trim() }),
      ...(buyer === '' ? {} : { buyerSlug: buyer }),
      ...(category === '' ? {} : { categoryCode: category }),
    },
  });
  const buyers = summary.data?.buyers ?? [];
  const categories = new Map<string, string>();
  for (const entry of buyers) {
    for (const item of entry.categories) categories.set(item.code, item.name);
  }

  return (
    <div className="tiq-page">
      <PageHeader title={t('planning.public.title')} subtitle={t('planning.public.subtitle')} />
      <Banner tone="warning" title={t('planning.public.disclaimerTitle')}>
        <p>{t('planning.public.disclaimer')}</p>
      </Banner>

      <FilterBar
        label={t('planning.public.filters')}
        canClear={q !== '' || buyer !== '' || category !== ''}
        onClear={() => {
          setQ('');
          setBuyer('');
          setCategory('');
          setPage(1);
        }}
      >
        <SearchField
          label={t('planning.filters.search')}
          placeholder={t('planning.public.searchPlaceholder')}
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
        <Select
          label={t('planning.public.buyer')}
          value={buyer}
          onChange={(value) => {
            setBuyer(value);
            setPage(1);
          }}
          placeholder={t('planning.public.allBuyers')}
          options={buyers.map((entry) => ({ value: entry.buyer.slug, label: entry.buyer.name }))}
        />
        <Select
          label={t('planning.public.category')}
          value={category}
          onChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          placeholder={t('planning.public.allCategories')}
          options={[...categories.entries()].map(([code, name]) => ({ value: code, label: name }))}
        />
      </FilterBar>

      <QueryView
        query={summary}
        isEmpty={(data) => data.buyers.length === 0}
        empty={<EmptyState icon="calendar" title={t('planning.public.noPlans')} />}
      >
        {(data) => (
          <div className="tiq-grid tiq-grid--2">
            {data.buyers.map((entry) => (
              <Card
                key={entry.buyer.slug}
                title={entry.buyer.name}
                subtitle={t('planning.public.noticeCount', { count: entry.noticeCount })}
              >
                <ul className="tiq-stack" aria-label={t('planning.public.plannedCategories')}>
                  {entry.categories.map((item) => (
                    <li key={item.code}>
                      <strong>{item.name}</strong>{' '}
                      <Chip tone="neutral" size="sm">
                        {t('planning.public.noticeCount', { count: item.noticeCount })}
                      </Chip>
                      <div className="tiq-cell-sub">{item.timings.join(' · ')}</div>
                    </li>
                  ))}
                </ul>
                {entry.lastPublishedAt !== null && (
                  <p className="tiq-cell-sub">
                    {t('planning.public.lastPublished', {
                      date: formatInstantDate(entry.lastPublishedAt, PUBLIC_ZONE),
                    })}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </QueryView>

      <Card flush title={t('planning.public.table')}>
        <DataTable<PublicAdvanceNotice>
          caption={t('planning.public.table')}
          rows={notices.data?.items}
          rowKey={(row) => `${row.buyer.slug}-${row.id}`}
          loading={notices.isFetching}
          error={notices.error}
          onRetry={notices.reload}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          onRowClick={(row) => navigate(planningPaths.publicNotice(row.buyer.slug, row.id))}
          rowLabel={(row) => row.title}
          empty={<EmptyState compact icon="megaphone" title={t('planning.public.empty')} />}
          pagination={
            notices.data === undefined
              ? undefined
              : {
                  page: notices.data.page,
                  pageSize: notices.data.pageSize,
                  total: notices.data.total,
                  onPageChange: setPage,
                }
          }
          columns={[
            {
              id: 'title',
              header: t('planning.public.col.notice'),
              sortable: true,
              cell: (row) => (
                <>
                  <Link to={planningPaths.publicNotice(row.buyer.slug, row.id)}>{row.title}</Link>
                  <div className="tiq-cell-sub">{row.buyer.name}</div>
                </>
              ),
            },
            {
              id: 'category',
              header: t('planning.public.col.category'),
              cell: (row) => row.category?.name ?? '',
            },
            {
              id: 'timing',
              header: t('planning.public.col.timing'),
              cell: (row) => (
                <>
                  {row.indicativeTiming}
                  {row.estimatedValueBand !== null && (
                    <div className="tiq-cell-sub">{row.estimatedValueBand}</div>
                  )}
                </>
              ),
            },
            {
              id: 'planStatus',
              header: t('planning.public.col.status'),
              cell: (row) => (
                <StatusChip enum="plan_items.status" value={row.planStatus} size="sm" />
              ),
            },
            {
              id: 'eoi',
              header: t('planning.public.col.eoi'),
              cell: (row) => row.eoiInstructions ?? t('planning.public.noEoi'),
            },
            {
              id: 'publishedAt',
              header: t('planning.public.col.published'),
              sortable: true,
              cell: (row) => formatInstantDate(row.publishedAt, PUBLIC_ZONE),
            },
          ]}
        />
      </Card>
    </div>
  );
}
