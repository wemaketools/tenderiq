/**
 * SUP-07 Invitations and access requests: the inviting buyer, the event, the intended legal supplier, confidentiality
 * conditions, the response status and access decisions. Answers are given by an authorized representative on the
 * invitation record; restricted document access is requested here or from the opportunity workspace.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { PARTICIPANTS_ACCESS_STATUS, PARTICIPANTS_INVITATION_STATUS } from '@contracts/enums';
import { INVITATION_SORT_FIELDS, publicationEndpoints } from '@contracts/publication';
import type { InvitationRow } from '@contracts/publication';

import { invalidateApiQueries, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  compact,
  dateOrUndefined,
  directionOf,
  idOrUndefined,
  oneOf,
  paginationOf,
  sortOf,
  tableSort,
} from '../../publication/lib/lists';
import { opportunityPaths } from '../../publication/lib/paths';
import { NOTICES_ACKNOWLEDGE } from '../../publication/lib/permissions';
import { RequestAccessDialog } from '../components/ParticipationDialogs';

const DEFAULTS = {
  q: '',
  kind: '',
  invitationStatus: '',
  accessStatus: '',
  buyer: '',
  awaitingResponse: false,
  closingFrom: '',
  closingTo: '',
  sort: 'closingAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

const KINDS = ['invitation', 'access_request'] as const;

export default function InvitationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const canAnswer = usePermission(NOTICES_ACKNOWLEDGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-07', DEFAULTS);
  const [chooseOpen, setChooseOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [requestFor, setRequestFor] = useState<{
    tenderId: number;
    reference: string;
    title: string;
  } | null>(null);

  const query = useApiQuery(publicationEndpoints.listInvitations, {
    query: compact({
      q: filters.q.trim(),
      kind: oneOf(filters.kind, KINDS),
      invitationStatus: oneOf(filters.invitationStatus, PARTICIPANTS_INVITATION_STATUS),
      accessStatus: oneOf(filters.accessStatus, PARTICIPANTS_ACCESS_STATUS),
      buyer: idOrUndefined(filters.buyer) === undefined ? undefined : [Number(filters.buyer)],
      awaitingResponse: filters.awaitingResponse,
      closingFrom: dateOrUndefined(filters.closingFrom),
      closingTo: dateOrUndefined(filters.closingTo),
      sort: sortOf(filters.sort, INVITATION_SORT_FIELDS, 'closingAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(publicationEndpoints.listInvitations, { query: { pageSize: 100 } });
  const opportunities = useApiQuery(
    publicationEndpoints.listOpportunities,
    chooseOpen ? { query: { procedure: ['restricted'], pageSize: 100 } } : null,
  );
  const filterOptions = useApiQuery(publicationEndpoints.opportunityFilters, {});

  const all = overview.data?.items ?? [];
  const kpi = (value: number): string => (overview.data === undefined ? '…' : formatCount(value));
  const restricted = overview.error?.kind === 'forbidden';
  const requestable = (opportunities.data?.items ?? []).filter(
    (row) =>
      row.isAcceptingResponses &&
      (row.participation === null ||
        row.participation.accessStatus === 'not_required' ||
        row.participation.accessStatus === 'denied'),
  );

  const filtered =
    filters.q !== '' ||
    filters.kind !== '' ||
    filters.invitationStatus !== '' ||
    filters.accessStatus !== '' ||
    filters.buyer !== '' ||
    filters.awaitingResponse ||
    filters.closingFrom !== '' ||
    filters.closingTo !== '';

  const columns: DataTableColumn<InvitationRow>[] = [
    {
      id: 'tender',
      header: t('opportunities.invitations.col.event'),
      cell: (row) => (
        <>
          <Reference
            value={row.tender.reference}
            to={opportunityPaths.invitation(row.participantId)}
          />
          <span className="tiq-cell-sub">{row.tender.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('tenders.participation', row.tender.participation)}
          </span>
        </>
      ),
    },
    {
      id: 'buyer',
      header: t('opportunities.invitations.col.buyer'),
      sortable: true,
      cell: (row) => row.buyer.name,
    },
    {
      id: 'kind',
      header: t('opportunities.invitations.col.kind'),
      cell: (row) => (
        <>
          <span>{t(`opportunities.invitations.kind.${row.kind}`)}</span>
          {row.awaitingResponse && (
            <Chip tone="warning" size="sm">
              {t('opportunities.invitations.awaiting')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('opportunities.invitations.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          {row.kind === 'invitation' ? (
            <StatusChip
              enum="participants.invitation_status"
              value={row.invitationStatus}
              size="sm"
            />
          ) : (
            <StatusChip enum="participants.access_status" value={row.accessStatus} size="sm" />
          )}
          {row.invitedContactName !== null && (
            <span className="tiq-cell-sub">
              {t('opportunities.invitations.contact', {
                name: row.invitedContactName,
                email: row.invitedContactEmail ?? '',
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'confidentiality',
      header: t('opportunities.invitations.col.confidentiality'),
      cell: (row) =>
        !row.confidentialityRequired ? (
          <span className="tiq-text-muted">{t('opportunities.invitations.notRequired')}</span>
        ) : row.confidentialityAcceptedAt === null ? (
          <Chip tone="warning" size="sm">
            {t('opportunities.invitations.outstanding')}
          </Chip>
        ) : (
          <span className="tiq-text-success">
            {t('opportunities.invitations.acceptedOn', {
              at: formatDateTime(row.confidentialityAcceptedAt, row.buyer.officialTimeZone),
            })}
          </span>
        ),
    },
    {
      id: 'invitedAt',
      header: t('opportunities.invitations.col.dates'),
      sortable: true,
      cell: (row) => (
        <>
          <OrDash>
            {row.invitedAt !== null
              ? t('opportunities.invitations.invitedOn', {
                  at: formatDateTime(row.invitedAt, row.buyer.officialTimeZone),
                })
              : row.accessRequestedAt !== null
                ? t('opportunities.invitations.requestedOn', {
                    at: formatDateTime(row.accessRequestedAt, row.buyer.officialTimeZone),
                  })
                : null}
          </OrDash>
          {row.invitationExpiresAt !== null && (
            <span className="tiq-cell-sub">
              {t('opportunities.invitations.expires', {
                at: formatOfficialTime(row.invitationExpiresAt, row.buyer.officialTimeZone),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'closingAt',
      header: t('opportunities.discover.col.closing'),
      sortable: true,
      cell: (row) =>
        row.closingAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.closingAt} showLocal={false} />
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('opportunities.invitations.title')}
        subtitle={t('opportunities.invitations.intro')}
        primaryAction={
          canAnswer ? (
            <Button variant="primary" icon="key" onClick={() => setChooseOpen(true)}>
              {t('opportunities.access.requestAction')}
            </Button>
          ) : undefined
        }
      />
      <FilterBar
        label={t('opportunities.invitations.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('opportunities.common.search')}
          placeholder={t('opportunities.invitations.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('opportunities.invitations.col.kind')}
          placeholder={t('opportunities.common.all')}
          value={filters.kind}
          options={KINDS.map((value) => ({
            value,
            label: t(`opportunities.invitations.kind.${value}`),
          }))}
          onChange={(kind) => setFilters({ kind, page: 1 })}
        />
        <Select
          label={t('opportunities.invitations.invitationStatus')}
          placeholder={t('opportunities.common.all')}
          value={filters.invitationStatus}
          options={PARTICIPANTS_INVITATION_STATUS.map((value) => ({
            value,
            label: tEnum('participants.invitation_status', value),
          }))}
          onChange={(invitationStatus) => setFilters({ invitationStatus, page: 1 })}
        />
        <Select
          label={t('opportunities.invitations.accessStatus')}
          placeholder={t('opportunities.common.all')}
          value={filters.accessStatus}
          options={PARTICIPANTS_ACCESS_STATUS.map((value) => ({
            value,
            label: tEnum('participants.access_status', value),
          }))}
          onChange={(accessStatus) => setFilters({ accessStatus, page: 1 })}
        />
        <Select
          label={t('opportunities.invitations.col.buyer')}
          placeholder={t('opportunities.common.all')}
          value={filters.buyer}
          options={(filterOptions.data?.buyers ?? []).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(buyer) => setFilters({ buyer, page: 1 })}
        />
        <DateInput
          label={t('opportunities.discover.closingFrom')}
          value={filters.closingFrom}
          onChange={(closingFrom) => setFilters({ closingFrom, page: 1 })}
        />
        <DateInput
          label={t('opportunities.discover.closingTo')}
          value={filters.closingTo}
          onChange={(closingTo) => setFilters({ closingTo, page: 1 })}
        />
        <Checkbox
          label={t('opportunities.invitations.awaitingOnly')}
          checked={filters.awaitingResponse}
          onChange={(awaitingResponse) => setFilters({ awaitingResponse, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('opportunities.invitations.kpi.awaiting')}
          icon="mail"
          tone="warning"
          value={kpi(all.filter((row) => row.awaitingResponse).length)}
          hint={t('opportunities.invitations.kpi.awaitingHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.invitations.kpi.access')}
          icon="key"
          tone="info"
          value={kpi(all.filter((row) => row.accessStatus === 'requested').length)}
          hint={t('opportunities.invitations.kpi.accessHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.invitations.kpi.accepted')}
          icon="checkCircle"
          tone="success"
          value={kpi(
            all.filter(
              (row) => row.invitationStatus === 'accepted' || row.accessStatus === 'granted',
            ).length,
          )}
          hint={t('opportunities.invitations.kpi.acceptedHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.invitations.kpi.confidentiality')}
          icon="lock"
          tone="danger"
          value={kpi(
            all.filter(
              (row) => row.confidentialityRequired && row.confidentialityAcceptedAt === null,
            ).length,
          )}
          hint={t('opportunities.invitations.kpi.confidentialityHint')}
          restricted={restricted}
        />
      </KpiGrid>
      <Card flush title={t('opportunities.invitations.tableTitle')}>
        <DataTable
          caption={t('opportunities.invitations.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.participantId)}
          rowLabel={(row) => `${row.tender.reference} ${row.tender.title}`}
          onRowClick={(row) => void navigate(opportunityPaths.invitation(row.participantId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="mail"
              title={
                filtered
                  ? t('opportunities.invitations.emptyFiltered')
                  : t('opportunities.invitations.empty')
              }
              description={filtered ? undefined : t('opportunities.invitations.emptyHint')}
            />
          }
          pagination={paginationOf(query.data, setFilters)}
        />
      </Card>

      <Dialog
        open={chooseOpen}
        title={t('opportunities.access.chooseTitle')}
        description={t('opportunities.access.chooseIntro')}
        onClose={() => {
          setChooseOpen(false);
          setChoice('');
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setChooseOpen(false);
                setChoice('');
              }}
            >
              {t('opportunities.actions.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={choice === ''}
              onClick={() => {
                const row = requestable.find((item) => String(item.tender.tenderId) === choice);
                if (row === undefined) return;
                setChooseOpen(false);
                setChoice('');
                setRequestFor(row.tender);
              }}
            >
              {t('opportunities.actions.continue')}
            </Button>
          </>
        }
      >
        {opportunities.data !== undefined && requestable.length === 0 ? (
          <EmptyState compact icon="key" title={t('opportunities.access.noneRequestable')} />
        ) : (
          <Select
            label={t('opportunities.access.tender')}
            placeholder={t('opportunities.access.chooseTender')}
            value={choice}
            onChange={setChoice}
            options={requestable.map((row) => ({
              value: String(row.tender.tenderId),
              label: `${row.tender.reference} · ${row.tender.title} (${row.buyer.name})`,
            }))}
          />
        )}
      </Dialog>
      <RequestAccessDialog
        tender={requestFor}
        onClose={() => setRequestFor(null)}
        onDone={(participation, tender) => {
          setRequestFor(null);
          toast.show(
            t('opportunities.access.requested', {
              reference: tender.reference,
              status: tEnum('participants.access_status', participation.accessStatus),
            }),
            'success',
          );
          invalidateApiQueries('supplier.invitations.');
        }}
      />
    </div>
  );
}
