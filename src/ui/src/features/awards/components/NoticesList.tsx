/**
 * BUY-28 outcome notices of one tender: intention-to-award, final award, unsuccessful outcome and standstill change
 * notices with their delivery and acknowledgment counts. Drafting a notice creates a DRAFT; issuing it is a
 * separate, confirmed step on the notice page.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  CreateOutcomeNoticeBody,
  DRAFTABLE_OUTCOME_NOTICE_TYPES,
  NOTICE_SORT_FIELDS,
  OUTCOME_NOTICE_TYPES,
  createOutcomeNotice,
  listOutcomeNotices,
} from '@contracts/awards';
import type {
  AwardOverview,
  DraftableOutcomeNoticeType,
  OutcomeNoticeSummary,
} from '@contracts/awards';
import type { FieldError } from '@contracts/common';
import { NOTICES_PERIOD_START_BASIS, NOTICES_STATUS } from '@contracts/enums';
import type { NoticesPeriodStartBasis } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  FilterBar,
  FormErrorSummary,
  SearchField,
  Select,
  StatusChip,
  TextArea,
  TextField,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { awardErrorMessage } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import { lotLabel, lotNosLabel } from '../lib/labels';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { awardPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

const DEFAULTS = {
  q: '',
  noticeType: '',
  status: '',
  issuedFrom: '',
  issuedTo: '',
  sort: 'issuedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export function NoticesList({ overview }: { readonly overview: AwardOverview }) {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const tenderId = overview.tender.tenderId;
  const canIssue = usePermission('notice.issue');
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-28', DEFAULTS);
  const [drafting, setDrafting] = useState(false);

  const query = useApiQuery(listOutcomeNotices, {
    params: { tenderId },
    query: compact({
      q: filters.q.trim(),
      noticeType: oneOf(filters.noticeType, OUTCOME_NOTICE_TYPES),
      status: oneOf(filters.status, NOTICES_STATUS),
      issuedFrom: dateOf(filters.issuedFrom),
      issuedTo: dateOf(filters.issuedTo),
      sort: sortOf(filters.sort, NOTICE_SORT_FIELDS, 'issuedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const filtered =
    filters.q !== '' ||
    filters.noticeType !== '' ||
    filters.status !== '' ||
    filters.issuedFrom !== '' ||
    filters.issuedTo !== '';

  const columns: DataTableColumn<OutcomeNoticeSummary>[] = [
    {
      id: 'title',
      header: t('awards.notices.col.title'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {t('awards.common.version', { no: row.version })} · {lotNosLabel(row.lotNos)}
          </span>
        </>
      ),
    },
    {
      id: 'noticeType',
      header: t('awards.notices.col.type'),
      sortable: true,
      cell: (row) => <StatusChip enum="notices.notice_type" value={row.noticeType} size="sm" />,
    },
    {
      id: 'status',
      header: t('awards.notices.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="notices.status" value={row.status} />,
    },
    {
      id: 'delivery',
      header: t('awards.notices.col.delivery'),
      cell: (row) => (
        <>
          <span>
            {t('awards.notices.delivered', {
              delivered: row.deliveredCount,
              total: row.recipientCount,
            })}
          </span>
          {row.failedCount > 0 && (
            <span className="tiq-cell-sub tiq-text-danger">
              {t('awards.notices.failed', { count: row.failedCount })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'acknowledged',
      header: t('awards.notices.col.acknowledged'),
      cell: (row) =>
        row.requiresAcknowledgment
          ? t('awards.notices.acknowledgedOf', {
              done: row.acknowledgedCount,
              total: row.recipientCount,
            })
          : t('awards.notices.noAcknowledgment'),
    },
    {
      id: 'issuedAt',
      header: t('awards.notices.col.issued'),
      sortable: true,
      cell: (row) =>
        row.issuedAt === null ? (
          <span className="tiq-text-muted">{t('awards.notices.notIssued')}</span>
        ) : (
          <>
            <span>{formatDateTime(row.issuedAt, timeZone)}</span>
            {row.issuedBy !== null && <span className="tiq-cell-sub">{row.issuedBy.fullName}</span>}
          </>
        ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      <FilterBar label={t('awards.notices.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('awards.common.search')}
          placeholder={t('awards.notices.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('awards.notices.filter.type')}
          placeholder={t('awards.notices.filter.allTypes')}
          value={filters.noticeType}
          options={OUTCOME_NOTICE_TYPES.map((value) => ({
            value,
            label: tEnum('notices.notice_type', value),
          }))}
          onChange={(noticeType) => setFilters({ noticeType, page: 1 })}
        />
        <Select
          label={t('awards.notices.filter.status')}
          placeholder={t('awards.common.allStatuses')}
          value={filters.status}
          options={NOTICES_STATUS.map((value) => ({
            value,
            label: tEnum('notices.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('awards.notices.filter.issuedFrom')}
          value={filters.issuedFrom}
          onChange={(issuedFrom) => setFilters({ issuedFrom, page: 1 })}
        />
        <DateInput
          label={t('awards.notices.filter.issuedTo')}
          value={filters.issuedTo}
          onChange={(issuedTo) => setFilters({ issuedTo, page: 1 })}
        />
      </FilterBar>
      <Card
        title={t('awards.notices.title')}
        subtitle={t('awards.notices.subtitle')}
        actions={
          canIssue ? (
            <Button icon="plus" onClick={() => setDrafting(true)}>
              {t('awards.notices.draft')}
            </Button>
          ) : undefined
        }
        flush
      >
        <DataTable
          caption={t('awards.notices.title')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.noticeId)}
          rowLabel={(row) => row.title}
          onRowClick={(row) => void navigate(awardPaths.notice(tenderId, row.noticeId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="mail"
              title={filtered ? t('awards.notices.emptyFiltered') : t('awards.notices.empty')}
              description={filtered ? undefined : t('awards.notices.emptyHint')}
            />
          }
          pagination={
            query.data === undefined
              ? undefined
              : {
                  page: query.data.page,
                  pageSize: query.data.pageSize,
                  total: query.data.total,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
      {drafting && <DraftNoticeDialog overview={overview} onClose={() => setDrafting(false)} />}
    </div>
  );
}

function DraftNoticeDialog({
  overview,
  onClose,
}: {
  readonly overview: AwardOverview;
  readonly onClose: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useApiMutation(createOutcomeNotice);
  const [noticeType, setNoticeType] = useState<DraftableOutcomeNoticeType>('intent_to_award');
  const [lotIds, setLotIds] = useState<readonly number[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(true);
  const [basis, setBasis] = useState<NoticesPeriodStartBasis | ''>('transmission');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, create.error, [
    'noticeType',
    'lotIds',
    'title',
    'body',
    'requiresAcknowledgment',
    'periodStartBasis',
  ]);

  const submit = async (): Promise<void> => {
    const request = {
      noticeType,
      lotIds: [...lotIds],
      title: title.trim(),
      body: body.trim(),
      requiresAcknowledgment,
      periodStartBasis: basis === '' ? undefined : basis,
    };
    const found = validateWith(CreateOutcomeNoticeBody, request);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      const record = await create.mutate({
        params: { tenderId: overview.tender.tenderId },
        body: request,
      });
      toast.show(t('awards.notices.drafted'), 'success');
      invalidateApiQueries('buyer.awards.listNotices');
      void navigate(awardPaths.notice(overview.tender.tenderId, record.noticeId), {
        state: { record },
      });
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('awards.notices.draftTitle')}
      description={t('awards.notices.draftHint')}
      onClose={onClose}
      dismissible={!create.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            {t('awards.common.cancel')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            loading={create.pending}
            onClick={() => void submit()}
          >
            {t('awards.notices.saveDraft')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-stack">
        <FormErrorSummary
          title={create.error === null ? null : awardErrorMessage(create.error)}
          errors={errors.other}
        />
        <Select
          label={t('awards.notices.field.type')}
          required
          value={noticeType}
          error={errors.forField('noticeType')}
          options={DRAFTABLE_OUTCOME_NOTICE_TYPES.map((value) => ({
            value,
            label: tEnum('notices.notice_type', value),
          }))}
          onChange={(value) => {
            const found = DRAFTABLE_OUTCOME_NOTICE_TYPES.find((item) => item === value);
            if (found !== undefined) setNoticeType(found);
          }}
        />
        <fieldset className="tiq-fieldset">
          <legend className="tiq-field-label">{t('awards.notices.field.lots')}</legend>
          <div className="tiq-check-list">
            {overview.lots.map((lot) => (
              <Checkbox
                key={lot.lot.lotId}
                label={lotLabel(lot.lot)}
                checked={lotIds.includes(lot.lot.lotId)}
                onChange={(checked) =>
                  setLotIds((current) =>
                    checked
                      ? [...current, lot.lot.lotId]
                      : current.filter((id) => id !== lot.lot.lotId),
                  )
                }
              />
            ))}
          </div>
          {errors.forField('lotIds') !== undefined && (
            <p className="tiq-field-error" role="alert">
              {errors.forField('lotIds')}
            </p>
          )}
        </fieldset>
        <TextField
          label={t('awards.notices.field.title')}
          required
          value={title}
          error={errors.forField('title')}
          onChange={setTitle}
        />
        <TextArea
          label={t('awards.notices.field.body')}
          hint={t('awards.notices.field.bodyHint')}
          required
          rows={6}
          value={body}
          error={errors.forField('body')}
          onChange={setBody}
        />
        <Checkbox
          label={t('awards.notices.field.requiresAck')}
          checked={requiresAcknowledgment}
          onChange={setRequiresAcknowledgment}
        />
        <Select
          label={t('awards.notices.field.basis')}
          hint={t('awards.notices.field.basisHint')}
          placeholder={t('awards.notices.field.noBasis')}
          value={basis}
          error={errors.forField('periodStartBasis')}
          options={NOTICES_PERIOD_START_BASIS.map((value) => ({
            value,
            label: tEnum('notices.period_start_basis', value),
          }))}
          onChange={(value) => {
            const found = NOTICES_PERIOD_START_BASIS.find((item) => item === value);
            setBasis(found ?? '');
          }}
        />
      </div>
    </Dialog>
  );
}
