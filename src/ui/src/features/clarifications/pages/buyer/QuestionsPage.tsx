/**
 * BUY-16 Tender Q&A: the question queue of the active buyer. Required information: questions, category, supplier
 * confidentiality, owner, response deadline, draft reply and publication status. Principal actions (assign, answer,
 * review, publish to the correct audience, escalate to an addendum) run on the question page.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { BuyerQuestionRow } from '@contracts/clarifications';
import type { QuestionsAudience, QuestionsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useActiveTenant, useAppDispatch, useScreenFilters } from '../../../../app/hooks';
import { navBadgeSet } from '../../../../app/slices/badges';
import {
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  Icon,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OverdueChip,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableSort } from '../../../../components/ui';
import { EMPTY_VALUE, formatCount, formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { BuyerTabs } from '../../components/BuyerTabs';
import { BuyerTenderSelect } from '../../components/BuyerTenderSelect';
import { useBuyerTenders } from '../../hooks';
import { buyerPaths, enumOptions, excerpt, isQuestionClosed, subjectLabel } from '../../lib';

const DEFAULT_FILTERS = {
  tender: '',
  status: '',
  audience: '',
  owner: '',
  late: false,
  from: '',
  to: '',
  q: '',
  page: 1,
  sort: 'submittedAt',
  dir: 'desc',
};

type SortField = 'submittedAt' | 'responseDueAt' | 'status' | 'tenderReference';

export default function QuestionsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const now = useNow();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-16', DEFAULT_FILTERS);
  const tenders = useBuyerTenders();
  const tenderId = filters.tender === '' ? undefined : Number(filters.tender);
  const owners = useApiQuery(
    clarificationsEndpoints.ownerCandidates,
    tenderId === undefined ? { query: {} } : { query: { tenderId } },
  );

  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(tenderId === undefined ? {} : { tenderId }),
    ...(filters.status === '' ? {} : { status: [filters.status as QuestionsStatus] }),
    ...(filters.audience === '' ? {} : { audience: [filters.audience as QuestionsAudience] }),
    ...(filters.owner === 'unassigned' ? { unassigned: true } : {}),
    ...(filters.owner !== '' && filters.owner !== 'unassigned'
      ? { ownerUserId: Number(filters.owner) }
      : {}),
    ...(filters.late ? { afterDeadline: true } : {}),
    ...(filters.from === '' ? {} : { submittedFrom: filters.from }),
    ...(filters.to === '' ? {} : { submittedTo: filters.to }),
  };
  const questions = useApiQuery(clarificationsEndpoints.questionsList, { query });

  const allTenders = tenders.data?.items;
  const scoped = (allTenders ?? []).filter(
    (tender) => tenderId === undefined || tender.tenderId === tenderId,
  );
  const selectedTender = tenderId === undefined ? undefined : scoped[0];
  const sum = (pick: (row: (typeof scoped)[number]) => number): number | null =>
    allTenders === undefined ? null : scoped.reduce((total, row) => total + pick(row), 0);
  const openTotal =
    allTenders === undefined
      ? null
      : allTenders.reduce((total, row) => total + row.openQuestions, 0);

  useEffect(() => {
    if (openTotal !== null) {
      dispatch(navBadgeSet({ id: 'buyer.clarifications', count: openTotal }));
    }
  }, [dispatch, openTotal]);

  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.tender !== '' ||
    filters.status !== '' ||
    filters.audience !== '' ||
    filters.owner !== '' ||
    filters.late ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.q !== '';

  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.questions.title')}
        subtitle={t('clarifications.questions.subtitle')}
        meta={
          selectedTender === undefined ? undefined : (
            <>
              <Reference value={selectedTender.reference} />
              <StatusChip enum="tenders.status" value={selectedTender.status} />
              {selectedTender.questionsDeadline !== null && (
                <OfficialDeadline
                  deadline={selectedTender.questionsDeadline}
                  variant="block"
                  label={t('clarifications.common.questionsDeadline')}
                  showRemaining
                />
              )}
              {selectedTender.submissionDeadline !== null && (
                <OfficialDeadline
                  deadline={selectedTender.submissionDeadline}
                  variant="block"
                  label={t('clarifications.common.submissionDeadline')}
                />
              )}
              <span>
                {t('clarifications.common.owner')}: {selectedTender.owner.fullName}
              </span>
            </>
          )
        }
      />
      <BuyerTabs />

      <FilterBar onClear={clearFilters} canClear={canClear}>
        <BuyerTenderSelect
          tenders={allTenders}
          value={filters.tender}
          onChange={(value) => update({ tender: value, owner: '' })}
          placeholder={t('clarifications.filters.allTenders')}
        />
        <Select
          label={t('clarifications.filters.status')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          placeholder={t('clarifications.filters.allStatuses')}
          options={enumOptions('questions.status')}
        />
        <Select
          label={t('clarifications.filters.audience')}
          value={filters.audience}
          onChange={(value) => update({ audience: value })}
          placeholder={t('clarifications.filters.allAudiences')}
          options={enumOptions('questions.audience')}
        />
        <Select
          label={t('clarifications.filters.owner')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          placeholder={t('clarifications.filters.allOwners')}
          options={[
            { value: 'unassigned', label: t('clarifications.common.unassigned') },
            ...(owners.data ?? []).map((owner) => ({
              value: String(owner.userId),
              label: owner.fullName,
            })),
          ]}
        />
        <DateInput
          label={t('clarifications.filters.submittedFrom')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('clarifications.filters.submittedTo')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
        <SearchField
          label={t('clarifications.filters.search')}
          placeholder={t('clarifications.questions.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Checkbox
          label={t('clarifications.filters.lateOnly')}
          checked={filters.late}
          onChange={(checked) => update({ late: checked })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('clarifications.questions.kpi.open')}
          icon="messageQuestion"
          value={formatCount(sum((row) => row.openQuestions))}
          hint={t('clarifications.questions.kpi.openHint')}
        />
        <KpiCard
          label={t('clarifications.questions.kpi.unassigned')}
          icon="userPlus"
          tone="warning"
          value={formatCount(sum((row) => row.unassignedQuestions))}
          hint={t('clarifications.questions.kpi.unassignedHint')}
        />
        <KpiCard
          label={t('clarifications.questions.kpi.late')}
          icon="alertTriangle"
          tone="danger"
          value={formatCount(sum((row) => row.lateQuestionsAwaitingDisposition))}
          hint={t('clarifications.questions.kpi.lateHint')}
        />
        <KpiCard
          label={t('clarifications.questions.kpi.addenda')}
          icon="fileText"
          tone="info"
          value={formatCount(sum((row) => row.addendaInProgress))}
          hint={t('clarifications.questions.kpi.addendaHint')}
          to={buyerPaths.addenda}
        />
      </KpiGrid>

      <Card
        flush
        title={t('clarifications.questions.queue')}
        subtitle={t('clarifications.questions.identityWithheld')}
      >
        <DataTable<BuyerQuestionRow>
          caption={t('clarifications.questions.queue')}
          rows={questions.data?.items}
          rowKey={(row) => String(row.id)}
          loading={questions.isFetching}
          error={questions.error}
          onRetry={questions.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(buyerPaths.question(row.id))}
          rowLabel={(row) => t('clarifications.questions.rowLabel', { id: row.id })}
          empty={
            <EmptyState
              compact
              icon="messageQuestion"
              title={t('clarifications.questions.empty')}
              description={t('clarifications.questions.emptyHint')}
            />
          }
          pagination={
            questions.data === undefined
              ? undefined
              : {
                  page: questions.data.page,
                  pageSize: questions.data.pageSize,
                  total: questions.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'question',
              header: t('clarifications.questions.col.question'),
              width: '30%',
              cell: (row) => (
                <>
                  <Reference value={`Q-${row.id}`} to={buyerPaths.question(row.id)} />
                  <div className="tiq-cell-sub" title={row.questionText}>
                    {excerpt(row.questionText)}
                  </div>
                </>
              ),
            },
            {
              id: 'tenderReference',
              header: t('clarifications.questions.col.tender'),
              sortable: true,
              cell: (row) => (
                <span title={row.tender.title}>
                  <Reference value={row.tender.reference} />
                </span>
              ),
            },
            {
              id: 'category',
              header: t('clarifications.questions.col.category'),
              cell: (row) => subjectLabel(row),
            },
            {
              id: 'supplier',
              header: t('clarifications.questions.col.supplier'),
              cell: (row) => (
                <span className="tiq-inline">
                  <Icon name="lock" />
                  {row.supplier.name}
                </span>
              ),
            },
            {
              id: 'owner',
              header: t('clarifications.questions.col.owner'),
              cell: (row) =>
                row.owner === null ? (
                  <span className="tiq-text-warning">{t('clarifications.common.unassigned')}</span>
                ) : (
                  row.owner.fullName
                ),
            },
            {
              id: 'submittedAt',
              header: t('clarifications.questions.col.submitted'),
              sortable: true,
              cell: (row) => (
                <>
                  {formatDateTime(row.submittedAt, timeZone)}
                  {row.afterDeadline && (
                    <div>
                      <Chip tone="danger" outlined size="sm">
                        {row.lateDisposition === null
                          ? t('clarifications.questions.lateUndecided')
                          : t(`clarifications.questions.late.${row.lateDisposition}`)}
                      </Chip>
                    </div>
                  )}
                </>
              ),
            },
            {
              id: 'responseDueAt',
              header: t('clarifications.questions.col.responseDue'),
              sortable: true,
              cell: (row) =>
                row.responseDueAt === null ? (
                  EMPTY_VALUE
                ) : (
                  <>
                    {formatDateTime(row.responseDueAt, timeZone)}
                    {!isQuestionClosed(row.status) &&
                      new Date(row.responseDueAt).getTime() < now && (
                        <div>
                          <OverdueChip />
                        </div>
                      )}
                  </>
                ),
            },
            {
              id: 'status',
              header: t('clarifications.questions.col.status'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <StatusChip enum="questions.status" value={row.status} />
                  {row.addendumNumber !== null && (
                    <span className="tiq-cell-sub">
                      {t('clarifications.common.addendumNo', { no: row.addendumNumber })}
                    </span>
                  )}
                </div>
              ),
            },
            {
              id: 'audience',
              header: t('clarifications.questions.col.publication'),
              cell: (row) => (
                <div className="tiq-stack">
                  <StatusChip enum="questions.audience" value={row.audience} size="sm" />
                  <span className="tiq-cell-sub">
                    {row.publishedAt === null
                      ? t('clarifications.questions.notPublished')
                      : row.status === 'answered_privately'
                        ? t('clarifications.questions.answeredPrivatelyOn', {
                            at: formatDateTime(row.publishedAt, timeZone),
                          })
                        : t('clarifications.questions.publishedOn', {
                            at: formatDateTime(row.publishedAt, timeZone),
                          })}
                  </span>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
