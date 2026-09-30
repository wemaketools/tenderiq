/**
 * SUP-10 Tender questions and clarifications (overview): the tenders the supplier participates in with their question
 * deadlines, the supplier's own questions and replies, published answers, and the issued addenda that still need an
 * acknowledgment or a supplement/replacement of the submission (AC-10): an acknowledged addendum stays on the list
 * until its required action is complete. Suppliers never see other suppliers' private cases.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { SupplierAddendumRow, SupplierClarificationTender } from '@contracts/clarifications';
import type { QuestionsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useActiveTenant, useAppDispatch, useScreenFilters } from '../../../../app/hooks';
import { navBadgeSet } from '../../../../app/slices/badges';
import {
  Banner,
  Card,
  Checkbox,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableSort } from '../../../../components/ui';
import { EMPTY_VALUE, formatCount, formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { SupplierQuestionTable } from '../../components/SupplierQuestionTable';
import { enumOptions, supplierPaths } from '../../lib';

const DEFAULT_FILTERS = {
  tender: '',
  status: '',
  answered: false,
  q: '',
  page: 1,
  sort: 'submittedAt',
  dir: 'desc',
};

const TENDERS_REQUEST = { query: { pageSize: 100 } } as const;
const OPEN_ADDENDA_REQUEST = { query: { actionOutstanding: true, pageSize: 50 } } as const;

export default function SupplierClarificationsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-10', DEFAULT_FILTERS);
  const tenders = useApiQuery(clarificationsEndpoints.supplierTenders, TENDERS_REQUEST);
  const openAddenda = useApiQuery(
    clarificationsEndpoints.supplierAddendaList,
    OPEN_ADDENDA_REQUEST,
  );
  const tenderId = filters.tender === '' ? undefined : Number(filters.tender);
  const questions = useApiQuery(clarificationsEndpoints.supplierQuestionsList, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as 'submittedAt' | 'status' | 'tenderReference',
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(tenderId === undefined ? {} : { tenderId }),
      ...(filters.status === '' ? {} : { status: [filters.status as QuestionsStatus] }),
      ...(filters.answered ? { answered: true } : {}),
    },
  });

  const rows = tenders.data?.items;
  const sum = (pick: (row: SupplierClarificationTender) => number): number | null =>
    rows === undefined ? null : rows.reduce((total, row) => total + pick(row), 0);
  const actionOutstanding = sum((row) => row.addendaActionOutstanding);

  useEffect(() => {
    if (actionOutstanding !== null) {
      dispatch(navBadgeSet({ id: 'supplier.clarifications', count: actionOutstanding }));
    }
  }, [dispatch, actionOutstanding]);

  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.tender !== '' || filters.status !== '' || filters.answered || filters.q !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.supplier.title')}
        subtitle={t('clarifications.supplier.subtitle')}
      />

      {(openAddenda.data?.items.length ?? 0) > 0 && (
        <Banner
          tone="warning"
          title={t('clarifications.supplier.addendaBanner', {
            count: openAddenda.data?.items.length ?? 0,
          })}
        >
          <p>{t('clarifications.supplier.addendaBannerDetail')}</p>
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label={t('clarifications.supplier.kpi.own')}
          icon="messageQuestion"
          value={formatCount(sum((row) => row.ownQuestions))}
          hint={t('clarifications.supplier.kpi.ownHint')}
        />
        <KpiCard
          label={t('clarifications.supplier.kpi.awaiting')}
          icon="hourglass"
          tone="warning"
          value={formatCount(sum((row) => row.awaitingAnswer))}
          hint={t('clarifications.supplier.kpi.awaitingHint')}
        />
        <KpiCard
          label={t('clarifications.supplier.kpi.published')}
          icon="megaphone"
          tone="info"
          value={formatCount(sum((row) => row.publishedAnswers))}
          hint={t('clarifications.supplier.kpi.publishedHint')}
        />
        <KpiCard
          label={t('clarifications.supplier.kpi.addenda')}
          icon="clipboardCheck"
          tone="danger"
          value={formatCount(actionOutstanding)}
          hint={t('clarifications.supplier.kpi.addendaHint')}
        />
      </KpiGrid>

      <Card flush title={t('clarifications.supplier.addendaAction')}>
        <DataTable<SupplierAddendumRow>
          caption={t('clarifications.supplier.addendaAction')}
          rows={openAddenda.data?.items}
          rowKey={(row) => String(row.id)}
          loading={openAddenda.isFetching}
          error={openAddenda.error}
          onRetry={openAddenda.reload}
          onRowClick={(row) => navigate(supplierPaths.addendum(row.id))}
          rowLabel={(row) =>
            t('clarifications.addenda.rowLabel', {
              no: row.number,
              reference: row.tender.reference,
            })
          }
          empty={
            <EmptyState
              compact
              icon="checkCircle"
              title={t('clarifications.supplier.noAddendaAction')}
            />
          }
          columns={[
            {
              id: 'addendum',
              header: t('clarifications.addenda.col.addendum'),
              cell: (row) => (
                <>
                  <Reference
                    value={t('clarifications.common.addendumNo', { no: row.number })}
                    to={supplierPaths.addendum(row.id)}
                  />
                  <div className="tiq-cell-sub">{row.title}</div>
                </>
              ),
            },
            {
              id: 'tender',
              header: t('clarifications.addenda.col.tender'),
              cell: (row) => (
                <>
                  <Reference
                    value={row.tender.reference}
                    to={supplierPaths.tender(row.tender.tenderId)}
                  />
                  <div className="tiq-cell-sub">{row.buyer.name}</div>
                </>
              ),
            },
            {
              id: 'action',
              header: t('clarifications.supplierAddendum.requiredAction'),
              cell: (row) => (
                <StatusChip enum="addenda.existing_submission_action" value={row.requiredAction} />
              ),
            },
            {
              id: 'outstanding',
              header: t('clarifications.supplier.col.outstanding'),
              cell: (row) => <OutstandingItems row={row} timeZone={timeZone} />,
            },
            {
              id: 'deadline',
              header: t('clarifications.addenda.col.newDeadline'),
              cell: (row) =>
                row.newSubmissionDeadline === null ? (
                  <span className="tiq-text-muted">{t('clarifications.addenda.noDateChange')}</span>
                ) : (
                  <OfficialDeadline deadline={row.newSubmissionDeadline} showLocal={false} />
                ),
            },
            {
              id: 'issued',
              header: t('clarifications.addenda.col.issued'),
              cell: (row) => formatDateTime(row.issuedAt, timeZone),
            },
          ]}
        />
      </Card>

      <Card flush title={t('clarifications.supplier.tenders')}>
        <DataTable<SupplierClarificationTender>
          caption={t('clarifications.supplier.tenders')}
          rows={rows}
          rowKey={(row) => String(row.tenderId)}
          loading={tenders.isFetching}
          error={tenders.error}
          onRetry={tenders.reload}
          onRowClick={(row) => navigate(supplierPaths.tender(row.tenderId))}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          empty={
            <EmptyState
              compact
              icon="briefcase"
              title={t('clarifications.supplier.noTenders')}
              description={t('clarifications.supplier.noTendersHint')}
            />
          }
          columns={[
            {
              id: 'tender',
              header: t('clarifications.addenda.col.tender'),
              cell: (row) => (
                <>
                  <Reference value={row.reference} to={supplierPaths.tender(row.tenderId)} />
                  <div className="tiq-cell-sub">{row.title}</div>
                </>
              ),
            },
            {
              id: 'buyer',
              header: t('clarifications.supplier.col.buyer'),
              cell: (row) => row.buyer.name,
            },
            {
              id: 'questionsDeadline',
              header: t('clarifications.common.questionsDeadline'),
              cell: (row) =>
                row.questionsDeadline === null ? (
                  EMPTY_VALUE
                ) : (
                  <>
                    <OfficialDeadline deadline={row.questionsDeadline} showLocal={false} />
                    <div>
                      {row.acceptingQuestions ? (
                        <Chip tone="success" size="sm">
                          {t('clarifications.supplier.accepting')}
                        </Chip>
                      ) : (
                        <Chip tone="neutral" size="sm">
                          {t('clarifications.supplier.notAccepting')}
                        </Chip>
                      )}
                    </div>
                  </>
                ),
            },
            {
              id: 'submissionDeadline',
              header: t('clarifications.common.submissionDeadline'),
              cell: (row) =>
                row.submissionDeadline === null ? (
                  EMPTY_VALUE
                ) : (
                  <OfficialDeadline deadline={row.submissionDeadline} showLocal={false} />
                ),
            },
            {
              id: 'questions',
              header: t('clarifications.supplier.col.questions'),
              numeric: true,
              cell: (row) => (
                <>
                  {formatCount(row.ownQuestions)}
                  <div className="tiq-cell-sub">
                    {t('clarifications.supplier.awaiting', { count: row.awaitingAnswer })}
                  </div>
                </>
              ),
            },
            {
              id: 'answers',
              header: t('clarifications.supplier.col.answers'),
              numeric: true,
              cell: (row) => formatCount(row.publishedAnswers),
            },
            {
              id: 'addenda',
              header: t('clarifications.supplier.col.addenda'),
              numeric: true,
              cell: (row) =>
                row.addendaActionOutstanding > 0 ? (
                  <span className="tiq-text-danger">
                    {t('clarifications.supplier.actionDue', {
                      count: row.addendaActionOutstanding,
                    })}
                  </span>
                ) : (
                  <span className="tiq-text-muted">
                    {t('clarifications.supplier.allAcknowledged')}
                  </span>
                ),
            },
            {
              id: 'status',
              header: t('clarifications.addenda.col.status'),
              cell: (row) => <StatusChip enum="tenders.status" value={row.status} />,
            },
          ]}
        />
      </Card>

      <FilterBar
        onClear={clearFilters}
        canClear={canClear}
        label={t('clarifications.supplier.myQuestions')}
      >
        <Select
          label={t('clarifications.filters.tender')}
          value={filters.tender}
          onChange={(value) => update({ tender: value })}
          placeholder={t('clarifications.filters.allTenders')}
          options={(rows ?? []).map((row) => ({
            value: String(row.tenderId),
            label: `${row.reference} · ${row.title}`,
          }))}
        />
        <Select
          label={t('clarifications.filters.status')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          placeholder={t('clarifications.filters.allStatuses')}
          options={enumOptions('questions.status')}
        />
        <SearchField
          label={t('clarifications.filters.search')}
          placeholder={t('clarifications.supplier.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Checkbox
          label={t('clarifications.filters.answeredOnly')}
          checked={filters.answered}
          onChange={(checked) => update({ answered: checked })}
        />
      </FilterBar>

      <Card flush title={t('clarifications.supplier.myQuestions')}>
        <SupplierQuestionTable
          rows={questions.data?.items}
          loading={questions.isFetching}
          error={questions.error}
          onRetry={questions.reload}
          timeZone={timeZone}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onOpen={(row) => navigate(supplierPaths.question(row.id))}
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
        />
      </Card>
    </div>
  );
}

/** What an addendum still requires of the supplier: the acknowledgment and/or the submission action (AC-10). */
function OutstandingItems({
  row,
  timeZone,
}: {
  readonly row: SupplierAddendumRow;
  readonly timeZone: string;
}) {
  const acknowledgment = row.acknowledgmentRequired && row.acknowledgedAt === null;
  const submission =
    (row.requiredAction === 'supplement' || row.requiredAction === 'replace') &&
    !row.requiredActionCompleted;
  return (
    <div className="tiq-stack">
      {acknowledgment && (
        <Chip tone="warning" size="sm">
          {t('clarifications.supplier.outstanding.acknowledgment')}
        </Chip>
      )}
      {submission && (
        <Chip tone="danger" size="sm">
          {t(`clarifications.supplier.outstanding.${row.requiredAction}`)}
        </Chip>
      )}
      {row.acknowledgedAt !== null && (
        <span className="tiq-cell-sub">
          {t('clarifications.supplier.acknowledgedOn', {
            at: formatDateTime(row.acknowledgedAt, timeZone),
          })}
        </span>
      )}
    </div>
  );
}
