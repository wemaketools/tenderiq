/**
 * SUP-12 — Response answers and attachments: requirements by lot and section, answers, evidence references,
 * progress, assigned contributors and review comments. Lots are selected here; reused content is flagged for review
 * and deviations are identified; the completeness check separates blocking errors from warnings (FR-11).
 */
import { useNavigate } from 'react-router';

import { ANSWER_LIST_SORTS, getReadiness, listAnswers } from '@contracts/bids';
import type { BidAnswerRow, BidDetail, BidSection } from '@contracts/bids';
import {
  BID_ANSWERS_ENVELOPE,
  BID_ANSWERS_PROGRESS,
  REQUIREMENTS_TREATMENT,
} from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OrDash,
  SearchField,
  Select,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ProgressMeter } from '../components/ProgressMeter';
import { ReadinessPanel } from '../components/ReadinessPanel';
import { ResponseWorkspace } from '../components/ResponseWorkspace';
import { AddendaCard, LotSelectionCard, TeamCard } from '../components/WorkspaceCards';
import { compact, directionOf, fromDate, oneOf, sortOf, tableSort, toDate } from '../lib/lists';
import { responsePaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  section: '',
  lotId: '',
  envelope: '',
  progress: '',
  treatment: '',
  assignedToMe: false,
  deviationsOnly: false,
  reuseToReview: false,
  dueFrom: '',
  dueTo: '',
  sort: 'refCode',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function SectionsCard({ sections }: { readonly sections: readonly BidSection[] }) {
  const columns: DataTableColumn<BidSection>[] = [
    {
      id: 'section',
      header: t('responses.answers.sections.col.section'),
      cell: (row) => (
        <>
          <span>{row.section}</span>
          <span className="tiq-cell-sub">{tEnum('bid_answers.envelope', row.envelope)}</span>
        </>
      ),
    },
    {
      id: 'progress',
      header: t('responses.answers.sections.col.progress'),
      cell: (row) => <ProgressMeter progress={row.progress} />,
    },
    {
      id: 'review',
      header: t('responses.answers.sections.col.review'),
      numeric: true,
      cell: (row) => formatCount(row.progress.readyForReview),
    },
    {
      id: 'mandatory',
      header: t('responses.answers.sections.col.mandatoryOpen'),
      numeric: true,
      cell: (row) =>
        row.mandatoryOpen > 0 ? (
          <span className="tiq-text-danger">{formatCount(row.mandatoryOpen)}</span>
        ) : (
          formatCount(0)
        ),
    },
  ];
  return (
    <Card title={t('responses.answers.sections.title')} flush>
      <DataTable
        caption={t('responses.answers.sections.title')}
        columns={columns}
        rows={sections}
        rowKey={(row) => `${row.section}-${row.envelope}`}
        empty={<EmptyState compact title={t('responses.answers.sections.empty')} />}
      />
    </Card>
  );
}

function AnswersContent({
  bid,
  reloadBid,
}: {
  readonly bid: BidDetail;
  readonly reloadBid: () => void;
}) {
  const navigate = useNavigate();
  const timeZone = bid.officialTimeZone;
  const [filters, setFilters, clearFilters] = useScreenFilters(`SUP-12:${bid.id}`, DEFAULTS);
  const query = useApiQuery(listAnswers, {
    params: { bidId: bid.id },
    query: compact({
      q: filters.q.trim(),
      section: filters.section === '' ? undefined : filters.section,
      lotId: filters.lotId === '' ? undefined : Number(filters.lotId),
      envelope: oneOf(filters.envelope, BID_ANSWERS_ENVELOPE),
      progress: oneOf(filters.progress, BID_ANSWERS_PROGRESS),
      treatment: oneOf(filters.treatment, REQUIREMENTS_TREATMENT),
      assignedToMe: filters.assignedToMe,
      deviationsOnly: filters.deviationsOnly,
      reuseToReview: filters.reuseToReview,
      dueFrom: fromDate(filters.dueFrom),
      dueTo: toDate(filters.dueTo),
      sort: sortOf(filters.sort, ANSWER_LIST_SORTS, 'refCode'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const readiness = useApiQuery(getReadiness, { params: { bidId: bid.id }, query: {} });
  const page = query.data;

  const filtered =
    filters.q !== '' ||
    filters.section !== '' ||
    filters.lotId !== '' ||
    filters.envelope !== '' ||
    filters.progress !== '' ||
    filters.treatment !== '' ||
    filters.assignedToMe ||
    filters.deviationsOnly ||
    filters.reuseToReview ||
    filters.dueFrom !== '' ||
    filters.dueTo !== '';

  const readinessItems = readiness.data?.items ?? [];
  const reuseToReview =
    readinessItems.find((item) => item.code === 'REUSED_CONTENT_NOT_REVIEWED')?.count ?? 0;
  const deviations = readinessItems.find((item) => item.code === 'DEVIATION_DECLARED')?.count ?? 0;
  const mandatoryOpen = bid.sections.reduce((total, section) => total + section.mandatoryOpen, 0);

  const columns: DataTableColumn<BidAnswerRow>[] = [
    {
      id: 'refCode',
      header: t('responses.answers.col.ref'),
      sortable: true,
      cell: (row) => <span className="tiq-mono">{row.refCode}</span>,
    },
    {
      id: 'section',
      header: t('responses.answers.col.requirement'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.text}</span>
          <span className="tiq-cell-sub">
            {row.section}
            {row.lot === null ? '' : ` · ${t('responses.common.lotNo', { no: row.lot.lotNo })}`}
          </span>
        </>
      ),
    },
    {
      id: 'treatment',
      header: t('responses.answers.col.treatment'),
      cell: (row) => <StatusChip enum="requirements.treatment" value={row.treatment} size="sm" />,
    },
    {
      id: 'progress',
      header: t('responses.answers.col.progress'),
      sortable: true,
      cell: (row) => <StatusChip enum="bid_answers.progress" value={row.progress} />,
    },
    {
      id: 'assigned',
      header: t('responses.answers.col.assigned'),
      sortable: true,
      sortKey: 'dueAt',
      cell: (row) => (
        <>
          <OrDash>{row.assignedUser?.fullName}</OrDash>
          {row.dueAt !== null && (
            <span className="tiq-cell-sub">
              {t('responses.answers.due', { date: formatDateTime(row.dueAt, timeZone) })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'flags',
      header: t('responses.answers.col.flags'),
      cell: (row) => (
        <span className="tiq-inline">
          {row.isDeviation && (
            <Chip tone="warning" size="sm">
              {t('responses.answers.flag.deviation')}
            </Chip>
          )}
          {row.reuse !== null && row.reuse.reviewedAt === null && (
            <Chip tone="warning" size="sm" outlined>
              {t('responses.answers.flag.reuse')}
            </Chip>
          )}
          {row.addendumNumber !== null && (
            <Chip tone="info" size="sm">
              {t('responses.answers.flag.addendum', { no: row.addendumNumber })}
            </Chip>
          )}
          <span className="tiq-text-muted">
            {t('responses.answers.flag.documents', { count: row.documentCount })} ·{' '}
            {t('responses.answers.flag.comments', { count: row.commentCount })}
          </span>
        </span>
      ),
    },
    {
      id: 'updatedAt',
      header: t('responses.answers.col.updated'),
      sortable: true,
      cell: (row) =>
        row.updatedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{formatDateTime(row.updatedAt, timeZone)}</span>
            <span className="tiq-cell-sub">{row.updatedBy?.fullName ?? ''}</span>
          </>
        ),
    },
  ];

  return (
    <>
      <KpiGrid>
        <KpiCard
          label={t('responses.answers.kpi.complete')}
          icon="checkCircle"
          tone="success"
          value={t('responses.progress.label', {
            complete: bid.progress.complete,
            total: bid.progress.total,
          })}
          hint={t('responses.answers.kpi.completeHint', {
            review: bid.progress.readyForReview,
          })}
        />
        <KpiCard
          label={t('responses.answers.kpi.mandatoryOpen')}
          icon="alertOctagon"
          tone={mandatoryOpen > 0 ? 'danger' : 'success'}
          value={formatCount(mandatoryOpen)}
          hint={t('responses.answers.kpi.mandatoryOpenHint')}
        />
        <KpiCard
          label={t('responses.answers.kpi.reuse')}
          icon="copy"
          tone="warning"
          value={readiness.data === undefined ? '…' : formatCount(reuseToReview)}
          hint={t('responses.answers.kpi.reuseHint')}
        />
        <KpiCard
          label={t('responses.answers.kpi.deviations')}
          icon="flag"
          tone="info"
          value={readiness.data === undefined ? '…' : formatCount(deviations)}
          hint={t('responses.answers.kpi.deviationsHint')}
        />
      </KpiGrid>
      <FilterBar label={t('responses.answers.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('responses.common.search')}
          placeholder={t('responses.answers.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('responses.answers.filter.section')}
          placeholder={t('responses.common.all')}
          value={filters.section}
          options={bid.sections.map((section) => ({
            value: section.section,
            label: section.section,
          }))}
          onChange={(section) => setFilters({ section, page: 1 })}
        />
        <Select
          label={t('responses.answers.filter.lot')}
          placeholder={t('responses.common.all')}
          value={filters.lotId}
          options={bid.lotOptions.map((lot) => ({
            value: String(lot.lotId),
            label: t('responses.lots.option', { no: lot.lotNo, title: lot.title }),
          }))}
          onChange={(lotId) => setFilters({ lotId, page: 1 })}
        />
        <Select
          label={t('responses.answers.filter.envelope')}
          placeholder={t('responses.common.all')}
          value={filters.envelope}
          options={BID_ANSWERS_ENVELOPE.map((value) => ({
            value,
            label: tEnum('bid_answers.envelope', value),
          }))}
          onChange={(envelope) => setFilters({ envelope, page: 1 })}
        />
        <Select
          label={t('responses.answers.filter.progress')}
          placeholder={t('responses.common.all')}
          value={filters.progress}
          options={BID_ANSWERS_PROGRESS.map((value) => ({
            value,
            label: tEnum('bid_answers.progress', value),
          }))}
          onChange={(progress) => setFilters({ progress, page: 1 })}
        />
        <Select
          label={t('responses.answers.filter.treatment')}
          placeholder={t('responses.common.all')}
          value={filters.treatment}
          options={REQUIREMENTS_TREATMENT.map((value) => ({
            value,
            label: tEnum('requirements.treatment', value),
          }))}
          onChange={(treatment) => setFilters({ treatment, page: 1 })}
        />
        <DateInput
          label={t('responses.answers.filter.dueFrom')}
          value={filters.dueFrom}
          onChange={(dueFrom) => setFilters({ dueFrom, page: 1 })}
        />
        <DateInput
          label={t('responses.answers.filter.dueTo')}
          value={filters.dueTo}
          onChange={(dueTo) => setFilters({ dueTo, page: 1 })}
        />
        <Checkbox
          label={t('responses.answers.filter.assignedToMe')}
          checked={filters.assignedToMe}
          onChange={(assignedToMe) => setFilters({ assignedToMe, page: 1 })}
        />
        <Checkbox
          label={t('responses.answers.filter.deviations')}
          checked={filters.deviationsOnly}
          onChange={(deviationsOnly) => setFilters({ deviationsOnly, page: 1 })}
        />
        <Checkbox
          label={t('responses.answers.filter.reuse')}
          checked={filters.reuseToReview}
          onChange={(reuseToReview) => setFilters({ reuseToReview, page: 1 })}
        />
      </FilterBar>
      <Card
        flush
        title={
          page === undefined
            ? t('responses.answers.title')
            : t('responses.answers.revisionTitle', { no: page.revisionNo })
        }
        subtitle={
          page === undefined ? undefined : (
            <span className="tiq-inline">
              <StatusChip enum="bid_revisions.status" value={page.revisionStatus} size="sm" />
              {page.editable ? t('responses.answers.editable') : t('responses.answers.readOnly')}
            </span>
          )
        }
      >
        <DataTable
          caption={t('responses.answers.caption')}
          columns={columns}
          rows={page?.items}
          rowKey={(row) => String(row.requirementId)}
          rowLabel={(row) => `${row.refCode} ${row.text}`}
          onRowClick={(row) => void navigate(responsePaths.answer(bid.id, row.requirementId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={filtered ? t('responses.answers.emptyFiltered') : t('responses.answers.empty')}
              description={filtered ? undefined : t('responses.answers.emptyHint')}
            />
          }
          pagination={
            page === undefined
              ? undefined
              : {
                  page: page.page,
                  pageSize: page.pageSize,
                  total: page.total,
                  onPageChange: (next) => setFilters({ page: next }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
      <div className="tiq-grid tiq-grid--sidebar">
        {readiness.data !== undefined ? (
          <ReadinessPanel
            readiness={readiness.data}
            timeZone={timeZone}
            title={t('responses.answers.completeness')}
            actions={
              <Button size="sm" icon="refresh" onClick={readiness.reload}>
                {t('responses.readiness.check')}
              </Button>
            }
          />
        ) : readiness.error !== null ? (
          <Card title={t('responses.answers.completeness')}>
            <ErrorState error={readiness.error} onRetry={readiness.reload} />
          </Card>
        ) : (
          <Card title={t('responses.answers.completeness')}>
            <SkeletonBlock lines={4} />
          </Card>
        )}
        <div className="tiq-stack">
          <LotSelectionCard
            key={bid.lotOptions.map((lot) => `${lot.lotId}:${String(lot.selected)}`).join(',')}
            bid={bid}
            editable={page?.editable ?? false}
            revisionId={page?.revisionId ?? null}
            onSaved={() => {
              reloadBid();
              query.reload();
              readiness.reload();
            }}
          />
          <AddendaCard addenda={bid.addenda} timeZone={timeZone} />
        </div>
      </div>
      <div className="tiq-grid tiq-grid--sidebar">
        <SectionsCard sections={page?.sections ?? bid.sections} />
        <TeamCard team={bid.team} />
      </div>
    </>
  );
}

export default function AnswersPage() {
  return (
    <ResponseWorkspace tab="answers" title={t('responses.answers.pageTitle')}>
      {(bid, reloadBid) => <AnswersContent bid={bid} reloadBid={reloadBid} />}
    </ResponseWorkspace>
  );
}
