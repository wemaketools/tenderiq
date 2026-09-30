/**
 * COM-09 Help, accessibility and service cases (signed in). Required information: guidance, terminology,
 * participation instructions, service notices, accessibility assistance and support cases. Actions: search guidance,
 * open a service case, request an accessibility accommodation, follow one's own cases. Service support cannot become
 * an informal bid-submission channel.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { MyHelpArticle, MySupportCase } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { HelpArticlesTopic, SupportCasesStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  SearchField,
  Select,
  StatusChip,
  Tabs,
  useToast,
} from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useCreateParam } from '../../../lib/useCreateParam';
import { AccommodationDialog } from '../components/AccommodationDialog';
import { ContactsCard, GlossaryCard } from '../components/ContactsCard';
import { OpenCaseDialog } from '../components/OpenCaseDialog';
import { ServiceNotices } from '../components/ServiceNotices';
import { helpPaths } from '../lib/paths';

type Tab = 'guidance' | 'notices' | 'cases' | 'contacts';

const OPEN_CASE: readonly SupportCasesStatus[] = [
  'open',
  'in_progress',
  'awaiting_customer',
  'routed_to_buyer',
];

export default function HelpCentrePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [tab, setTab] = useState<Tab>('guidance');
  const [accommodating, setAccommodating] = useState(false);
  const [caseRequested, setOpeningCase] = useCreateParam();
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-09', {
    q: '',
    topic: '',
    page: 1,
    caseStatus: '',
    casePage: 1,
  });
  const articles = useApiQuery(operationsEndpoints.listMyHelpArticles, {
    query: {
      page: filters.page,
      pageSize: 12,
      sort: 'title',
      dir: 'asc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(filters.topic === '' ? {} : { topic: [filters.topic as HelpArticlesTopic] }),
    },
  });
  const notices = useApiQuery(operationsEndpoints.listMyServiceNotices, {});
  const contacts = useApiQuery(operationsEndpoints.getMyHelpContacts, {});
  const cases = useApiQuery(operationsEndpoints.listMySupportCases, {
    query: {
      page: filters.casePage,
      pageSize: 25,
      sort: 'updatedAt',
      dir: 'desc',
      ...(filters.caseStatus === '' ? {} : { status: [filters.caseStatus as SupportCasesStatus] }),
    },
  });
  const allCases = useApiQuery(operationsEndpoints.listMySupportCases, {
    query: { pageSize: 100 },
  });
  const openCases =
    allCases.data === undefined
      ? null
      : formatCount(allCases.data.items.filter((row) => OPEN_CASE.includes(row.status)).length);
  const activeIncidents =
    notices.data === undefined
      ? null
      : formatCount(
          notices.data.items.filter(
            (notice) => notice.kind === 'incident' && notice.incidentStatus !== 'resolved',
          ).length,
        );

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('help.title')}
        subtitle={t('help.subtitle')}
        actions={
          <Button icon="users" onClick={() => setAccommodating(true)}>
            {t('help.accommodation.open')}
          </Button>
        }
      />
      <Banner tone="warning" title={t('help.notChannelTitle')}>
        <p>{t('help.notChannel')}</p>
      </Banner>
      <KpiGrid>
        <KpiCard
          label={t('help.kpi.articles')}
          icon="bookOpen"
          value={articles.data === undefined ? null : formatCount(articles.data.total)}
          hint={t('help.kpi.articlesHint')}
        />
        <KpiCard
          label={t('help.kpi.incidents')}
          icon="alertOctagon"
          tone="warning"
          value={activeIncidents}
          hint={t('help.kpi.incidentsHint')}
        />
        <KpiCard
          label={t('help.kpi.cases')}
          icon="lifeBuoy"
          tone="info"
          value={openCases}
          hint={t('help.kpi.casesHint')}
        />
        <KpiCard
          label={t('help.kpi.accessibility')}
          icon="users"
          tone="success"
          value={t('help.kpi.accessibilityValue')}
          hint={t('help.kpi.accessibilityHint')}
        />
      </KpiGrid>
      <Tabs
        label={t('help.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={[
          { id: 'guidance', label: t('help.tab.guidance') },
          { id: 'notices', label: t('help.tab.notices') },
          { id: 'cases', label: t('help.tab.cases') },
          { id: 'contacts', label: t('help.tab.contacts') },
        ]}
      >
        {tab === 'guidance' && (
          <>
            <FilterBar onClear={clearFilters} canClear={filters.q !== '' || filters.topic !== ''}>
              <SearchField
                label={t('ops.common.search')}
                placeholder={t('help.guidance.searchPlaceholder')}
                value={filters.q}
                onChange={(value) => setFilters({ q: value, page: 1 })}
              />
              <Select
                label={t('help.guidance.topic')}
                placeholder={t('ops.common.all')}
                value={filters.topic}
                onChange={(value) => setFilters({ topic: value, page: 1 })}
                options={enumOptions('help_articles.topic')}
              />
            </FilterBar>
            <Card flush title={t('help.guidance.title')} subtitle={t('help.guidance.binding')}>
              <DataTable<MyHelpArticle>
                caption={t('help.guidance.title')}
                rows={articles.data?.items}
                rowKey={(row) => String(row.id)}
                loading={articles.isFetching}
                error={articles.error}
                onRetry={articles.reload}
                rowHref={(row) => helpPaths.article(row.slug)}
                rowLabel={(row) => t('help.guidance.rowLabel', { title: row.title })}
                empty={
                  <EmptyState
                    compact
                    icon="bookOpen"
                    title={t('help.guidance.empty')}
                    description={t('help.guidance.emptyHint')}
                  />
                }
                pagination={
                  articles.data === undefined
                    ? undefined
                    : {
                        page: articles.data.page,
                        pageSize: articles.data.pageSize,
                        total: articles.data.total,
                        onPageChange: (page) => setFilters({ page }),
                      }
                }
                columns={[
                  {
                    id: 'title',
                    header: t('help.guidance.col.article'),
                    width: '50%',
                    cell: (row) => (
                      <>
                        <strong>{row.title}</strong>
                        <div className="tiq-cell-sub">{row.excerpt}</div>
                      </>
                    ),
                  },
                  {
                    id: 'topic',
                    header: t('help.guidance.topic'),
                    cell: (row) => (
                      <StatusChip enum="help_articles.topic" value={row.topic} size="sm" />
                    ),
                  },
                  {
                    id: 'audience',
                    header: t('help.guidance.audience'),
                    cell: (row) => (
                      <StatusChip enum="help_articles.audience" value={row.audience} size="sm" />
                    ),
                  },
                  {
                    id: 'updated',
                    header: t('help.guidance.updated'),
                    cell: (row) => formatDateTime(row.updatedAt, timeZone),
                  },
                ]}
              />
            </Card>
          </>
        )}
        {tab === 'notices' && (
          <QueryView query={notices}>
            {(data) => (
              <ServiceNotices list={data} timeZone={timeZone} title={t('help.tab.notices')} />
            )}
          </QueryView>
        )}
        {tab === 'cases' && (
          <>
            <FilterBar
              onClear={() => setFilters({ caseStatus: '', casePage: 1 })}
              canClear={filters.caseStatus !== ''}
            >
              <Select
                label={t('help.cases.col.status')}
                placeholder={t('ops.common.all')}
                value={filters.caseStatus}
                onChange={(value) => setFilters({ caseStatus: value, casePage: 1 })}
                options={enumOptions('support_cases.status')}
              />
            </FilterBar>
            <Card flush title={t('help.cases.title')} subtitle={t('help.cases.subtitle')}>
              <DataTable<MySupportCase>
                caption={t('help.cases.title')}
                rows={cases.data?.items}
                rowKey={(row) => String(row.id)}
                loading={cases.isFetching}
                error={cases.error}
                onRetry={cases.reload}
                rowHref={(row) => helpPaths.myCase(row.id)}
                rowLabel={(row) => t('help.cases.rowLabel', { reference: row.reference })}
                empty={
                  <EmptyState
                    compact
                    icon="lifeBuoy"
                    title={t('help.cases.empty')}
                    description={t('help.cases.emptyHint')}
                  />
                }
                pagination={
                  cases.data === undefined
                    ? undefined
                    : {
                        page: cases.data.page,
                        pageSize: cases.data.pageSize,
                        total: cases.data.total,
                        onPageChange: (page) => setFilters({ casePage: page }),
                      }
                }
                columns={[
                  {
                    id: 'case',
                    header: t('help.cases.col.case'),
                    width: '34%',
                    cell: (row) => (
                      <>
                        <span className="tiq-mono">{row.reference}</span>
                        <div className="tiq-cell-sub">{row.subject}</div>
                      </>
                    ),
                  },
                  {
                    id: 'organization',
                    header: t('help.cases.col.organization'),
                    cell: (row) => row.organization.tenantName,
                  },
                  {
                    id: 'category',
                    header: t('help.cases.col.category'),
                    cell: (row) => (
                      <StatusChip enum="support_cases.category" value={row.category} size="sm" />
                    ),
                  },
                  {
                    id: 'status',
                    header: t('help.cases.col.status'),
                    cell: (row) => <StatusChip enum="support_cases.status" value={row.status} />,
                  },
                  {
                    id: 'opened',
                    header: t('help.cases.col.opened'),
                    cell: (row) => formatDateTime(row.createdAt, timeZone),
                  },
                  {
                    id: 'updated',
                    header: t('help.cases.col.updated'),
                    cell: (row) => formatDateTime(row.updatedAt, timeZone),
                  },
                ]}
              />
            </Card>
          </>
        )}
        {tab === 'contacts' && (
          <QueryView query={contacts}>
            {(data) => (
              <div className="tiq-grid tiq-grid--2">
                <ContactsCard contacts={data} />
                <GlossaryCard contacts={data} />
              </div>
            )}
          </QueryView>
        )}
      </Tabs>

      {caseRequested && (
        <OpenCaseDialog
          onClose={() => setOpeningCase(false)}
          onOpened={(created) => {
            setOpeningCase(false);
            toast.show(t('help.cases.open.done', { reference: created.reference }), 'success');
            navigate(helpPaths.myCase(created.id));
          }}
        />
      )}
      {accommodating && (
        <AccommodationDialog
          onClose={() => setAccommodating(false)}
          onRequested={(created) => {
            setAccommodating(false);
            toast.show(t('help.accommodation.done', { reference: created.reference }), 'success');
            navigate(helpPaths.myCase(created.id));
          }}
        />
      )}
    </div>
  );
}
