/**
 * BUY-15 Participants and document access: invited and interested suppliers, access requests, confidentiality
 * acceptance, the qualification gate, acknowledgments and delivery status. Actions: invite approved suppliers,
 * decide access, correct contacts (through the participant record), distribute pending invitations and remind
 * participants of outstanding conditions. The buyer never sees supplier drafts, pursuits or private notes: only
 * the bid intent a supplier chose to share (DD-41).
 */
import { useState } from 'react';

import {
  NOTICE_RECIPIENTS_DELIVERY_STATUS,
  PARTICIPANTS_ACCESS_STATUS,
  PARTICIPANTS_BID_INTENT,
  PARTICIPANTS_INVITATION_STATUS,
  PARTICIPANTS_QUALIFICATION_GATE,
  PARTICIPANTS_SOURCE,
} from '@contracts/enums';
import { PARTICIPANT_SORT_FIELDS, publicationEndpoints } from '@contracts/publication';
import type { ParticipantRow, ParticipantSummary } from '@contracts/publication';

import { invalidateApiQueries, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
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
  PageHeader,
  RestrictedState,
  SearchField,
  Select,
  SkeletonBlock,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessDecisionDialog, InviteDialog } from '../components/ParticipantDialogs';
import { DistributeDialog } from '../components/PublicationDialogs';
import { TenderPublicationHeader } from '../components/TenderPublicationHeader';
import { useIdParam, useOfficialTimeZone } from '../lib/hooks';
import {
  compact,
  dateOrUndefined,
  directionOf,
  oneOf,
  paginationOf,
  sortOf,
  tableSort,
} from '../lib/lists';
import { publicationPaths } from '../lib/paths';
import { DISTRIBUTE, PARTICIPANT_MANAGE } from '../lib/permissions';

const DEFAULTS = {
  q: '',
  source: '',
  invitationStatus: '',
  accessStatus: '',
  bidIntent: '',
  qualificationGate: '',
  deliveryStatus: '',
  outstandingAcknowledgments: false,
  registeredFrom: '',
  registeredTo: '',
  sort: 'supplier',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function ParticipantsPage() {
  const tenderId = useIdParam('tenderId');
  const summary = useApiQuery(
    publicationEndpoints.participantSummary,
    tenderId === null ? null : { params: { tenderId } },
  );

  if (tenderId === null || summary.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('publication.tender.notFoundTitle')}
          back={{ to: publicationPaths.register, label: t('publication.common.backToRegister') }}
        />
        <EmptyState
          icon="users"
          title={t('publication.tender.notFoundTitle')}
          description={t('publication.tender.notFound')}
        />
      </div>
    );
  }
  if (summary.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('publication.participants.loadingTitle')}
          back={{ to: publicationPaths.register, label: t('publication.common.backToRegister') }}
        />
        {summary.error === null ? (
          <SkeletonBlock lines={8} />
        ) : summary.error.kind === 'forbidden' ? (
          <RestrictedState description={t('publication.participants.restricted')} />
        ) : (
          <ErrorState error={summary.error} onRetry={summary.reload} />
        )}
      </div>
    );
  }
  return <ParticipantsView key={tenderId} summary={summary.data} reloadSummary={summary.reload} />;
}

function nextActionOf(summary: ParticipantSummary): string {
  if (summary.accessRequestsPending > 0) {
    return t('publication.next.decideAccess', { count: summary.accessRequestsPending });
  }
  if (summary.deliveryFailures > 0) {
    return t('publication.next.fixDelivery', { count: summary.deliveryFailures });
  }
  if (summary.invitationsPending > 0) {
    return t('publication.next.awaitInvitations', { count: summary.invitationsPending });
  }
  if (summary.acknowledgmentsOutstanding > 0) {
    return t('publication.next.remindAcknowledgments', {
      count: summary.acknowledgmentsOutstanding,
    });
  }
  return t('publication.next.monitor');
}

function ParticipantsView({
  summary,
  reloadSummary,
}: {
  readonly summary: ParticipantSummary;
  readonly reloadSummary: () => void;
}) {
  const toast = useToast();
  const organizationZone = useOfficialTimeZone();
  const timeZone = summary.tender.submissionDeadline?.timeZone ?? organizationZone;
  const canManagePermission = usePermission(PARTICIPANT_MANAGE);
  const canDistributePermission = usePermission(DISTRIBUTE);
  const canInvite = canManagePermission && summary.capabilities.canInvite;
  const canManage = canManagePermission && summary.capabilities.canManage;
  const [filters, setFilters, clearFilters] = useScreenFilters(
    `BUY-15:${summary.tender.tenderId}`,
    DEFAULTS,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [decideFor, setDecideFor] = useState<ParticipantRow | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [distributeIds, setDistributeIds] = useState<readonly number[] | null>(null);
  const [updated, setUpdated] = useState<ReadonlyMap<number, ParticipantRow>>(new Map());
  const [added, setAdded] = useState<readonly ParticipantRow[]>([]);

  const tenderId = summary.tender.tenderId;
  const query = useApiQuery(publicationEndpoints.listParticipants, {
    params: { tenderId },
    query: compact({
      q: filters.q.trim(),
      source: oneOf(filters.source, PARTICIPANTS_SOURCE),
      invitationStatus: oneOf(filters.invitationStatus, PARTICIPANTS_INVITATION_STATUS),
      accessStatus: oneOf(filters.accessStatus, PARTICIPANTS_ACCESS_STATUS),
      bidIntent: oneOf(filters.bidIntent, PARTICIPANTS_BID_INTENT),
      qualificationGate: oneOf(filters.qualificationGate, PARTICIPANTS_QUALIFICATION_GATE),
      deliveryStatus: oneOf(filters.deliveryStatus, NOTICE_RECIPIENTS_DELIVERY_STATUS),
      outstandingAcknowledgments: filters.outstandingAcknowledgments,
      registeredFrom: dateOrUndefined(filters.registeredFrom),
      registeredTo: dateOrUndefined(filters.registeredTo),
      sort: sortOf(filters.sort, PARTICIPANT_SORT_FIELDS, 'supplier'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const rows =
    query.data === undefined
      ? undefined
      : [
          ...added.filter((row) => !query.data?.items.some((item) => item.id === row.id)),
          ...query.data.items,
        ].map((row) => updated.get(row.id) ?? row);

  const filtered =
    filters.q !== '' ||
    filters.source !== '' ||
    filters.invitationStatus !== '' ||
    filters.accessStatus !== '' ||
    filters.bidIntent !== '' ||
    filters.qualificationGate !== '' ||
    filters.deliveryStatus !== '' ||
    filters.outstandingAcknowledgments ||
    filters.registeredFrom !== '' ||
    filters.registeredTo !== '';

  const selectOptions = <T extends string>(
    values: readonly T[],
    name: Parameters<typeof tEnum>[0],
  ) => values.map((value) => ({ value, label: tEnum(name, value) }));

  const confidentialityRequired = summary.conditions.some(
    (condition) => condition.conditionType === 'confidentiality_undertaking',
  );

  const columns: DataTableColumn<ParticipantRow>[] = [
    {
      id: 'supplier',
      header: t('publication.participants.col.supplier'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          <span className="tiq-cell-sub">{row.supplier.legalName}</span>
          <span className="tiq-cell-sub">{tEnum('participants.source', row.source)}</span>
        </>
      ),
    },
    {
      id: 'invitationStatus',
      header: t('publication.participants.col.invitation'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip
            enum="participants.invitation_status"
            value={row.invitationStatus}
            size="sm"
          />
          {row.invitedContactName !== null && (
            <span className="tiq-cell-sub">
              {row.invitedContactName} · {row.invitedContactEmail}
            </span>
          )}
          {row.invitedAt !== null && (
            <span className="tiq-cell-sub">{formatDateTime(row.invitedAt, timeZone)}</span>
          )}
        </>
      ),
    },
    {
      id: 'accessStatus',
      header: t('publication.participants.col.access'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="participants.access_status" value={row.accessStatus} size="sm" />
          {row.accessDecidedAt !== null && (
            <span className="tiq-cell-sub">{formatDateTime(row.accessDecidedAt, timeZone)}</span>
          )}
        </>
      ),
    },
    {
      id: 'conditions',
      header: t('publication.participants.col.conditions'),
      cell: (row) => (
        <>
          {!confidentialityRequired ? null : row.confidentialityAcceptedAt === null ? (
            <span className="tiq-text-warning">
              {t('publication.participants.confidentialityOutstanding')}
            </span>
          ) : (
            <span className="tiq-text-success">
              {t('publication.participants.acceptedOn', {
                at: formatDateTime(row.confidentialityAcceptedAt, timeZone),
              })}
            </span>
          )}
          <StatusChip
            enum="participants.qualification_gate"
            value={row.qualificationGate}
            size="sm"
          />
        </>
      ),
    },
    {
      id: 'acknowledgments',
      header: t('publication.participants.col.acknowledgments'),
      cell: (row) => (
        <>
          {row.acknowledgments.required === 0 ? (
            <span className="tiq-text-muted">{t('publication.participants.noAcks')}</span>
          ) : (
            <Chip
              tone={
                row.acknowledgments.acknowledged < row.acknowledgments.required
                  ? 'warning'
                  : 'success'
              }
              size="sm"
            >
              {t('publication.participants.ackValue', {
                done: row.acknowledgments.acknowledged,
                required: row.acknowledgments.required,
              })}
            </Chip>
          )}
          {row.deliveryStatus === null ? (
            <OrDash>{null}</OrDash>
          ) : (
            <StatusChip
              enum="notice_recipients.delivery_status"
              value={row.deliveryStatus}
              size="sm"
            />
          )}
        </>
      ),
    },
    {
      id: 'bidIntent',
      header: t('publication.participants.col.intent'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="participants.bid_intent" value={row.bidIntent} size="sm" />
          {row.sharedNoBidReason !== null && (
            <span className="tiq-cell-sub">{row.sharedNoBidReason}</span>
          )}
        </>
      ),
    },
    {
      id: 'registeredAt',
      header: t('publication.participants.col.registered'),
      sortable: true,
      cell: (row) => formatDateTime(row.registeredAt, timeZone),
    },
    {
      id: 'actions',
      header: <span className="tiq-visually-hidden">{t('publication.register.col.actions')}</span>,
      cell: (row) => (
        <div className="tiq-row-actions">
          {canManage && row.accessStatus === 'requested' && (
            <Button
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setDecideFor(row);
              }}
            >
              {t('publication.actions.decideAccess')}
            </Button>
          )}
          <ButtonLink
            size="sm"
            variant="ghost"
            to={publicationPaths.participant(tenderId, row.id)}
            onClick={(event) => event.stopPropagation()}
          >
            {t('publication.actions.open')}
          </ButtonLink>
        </div>
      ),
    },
  ];

  const selectedIds = [...selected].map(Number);

  return (
    <div className="tiq-page">
      <TenderPublicationHeader
        tender={summary.tender}
        section="participants"
        nextAction={nextActionOf(summary)}
        counts={{ participants: summary.total }}
        primaryAction={
          canInvite ? (
            <Button variant="primary" icon="userPlus" onClick={() => setInviteOpen(true)}>
              {t('publication.actions.invite')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canDistributePermission && summary.invitationsPending > 0 && (
              <Button icon="send" onClick={() => setDistributeIds([])}>
                {t('publication.actions.distribute', { count: summary.invitationsPending })}
              </Button>
            )}
            <Button
              icon="refresh"
              onClick={() => {
                reloadSummary();
                query.reload();
              }}
            >
              {t('publication.actions.refresh')}
            </Button>
          </>
        }
      />
      <Banner tone="info">
        <p>{t('publication.participants.privacyNote')}</p>
      </Banner>

      <FilterBar
        label={t('publication.participants.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('publication.common.search')}
          placeholder={t('publication.participants.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('publication.participants.filter.source')}
          placeholder={t('publication.common.all')}
          value={filters.source}
          options={selectOptions(PARTICIPANTS_SOURCE, 'participants.source')}
          onChange={(source) => setFilters({ source, page: 1 })}
        />
        <Select
          label={t('publication.participants.filter.invitation')}
          placeholder={t('publication.common.all')}
          value={filters.invitationStatus}
          options={selectOptions(PARTICIPANTS_INVITATION_STATUS, 'participants.invitation_status')}
          onChange={(invitationStatus) => setFilters({ invitationStatus, page: 1 })}
        />
        <Select
          label={t('publication.participants.filter.access')}
          placeholder={t('publication.common.all')}
          value={filters.accessStatus}
          options={selectOptions(PARTICIPANTS_ACCESS_STATUS, 'participants.access_status')}
          onChange={(accessStatus) => setFilters({ accessStatus, page: 1 })}
        />
        <Select
          label={t('publication.participants.filter.qualification')}
          placeholder={t('publication.common.all')}
          value={filters.qualificationGate}
          options={selectOptions(
            PARTICIPANTS_QUALIFICATION_GATE,
            'participants.qualification_gate',
          )}
          onChange={(qualificationGate) => setFilters({ qualificationGate, page: 1 })}
        />
        <Select
          label={t('publication.participants.filter.delivery')}
          placeholder={t('publication.common.all')}
          value={filters.deliveryStatus}
          options={selectOptions(
            NOTICE_RECIPIENTS_DELIVERY_STATUS,
            'notice_recipients.delivery_status',
          )}
          onChange={(deliveryStatus) => setFilters({ deliveryStatus, page: 1 })}
        />
        <Select
          label={t('publication.participants.filter.intent')}
          placeholder={t('publication.common.all')}
          value={filters.bidIntent}
          options={selectOptions(PARTICIPANTS_BID_INTENT, 'participants.bid_intent')}
          onChange={(bidIntent) => setFilters({ bidIntent, page: 1 })}
        />
        <DateInput
          label={t('publication.participants.filter.registeredFrom')}
          value={filters.registeredFrom}
          onChange={(registeredFrom) => setFilters({ registeredFrom, page: 1 })}
        />
        <DateInput
          label={t('publication.participants.filter.registeredTo')}
          value={filters.registeredTo}
          onChange={(registeredTo) => setFilters({ registeredTo, page: 1 })}
        />
        <Checkbox
          label={t('publication.participants.filter.outstanding')}
          checked={filters.outstandingAcknowledgments}
          onChange={(value) => setFilters({ outstandingAcknowledgments: value, page: 1 })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('publication.participants.kpi.total')}
          icon="users"
          value={formatCount(summary.total)}
          hint={summary.bySource
            .map((item) => `${tEnum('participants.source', item.source)}: ${item.count}`)
            .join(' · ')}
        />
        <KpiCard
          label={t('publication.participants.kpi.access')}
          icon="key"
          tone={summary.accessRequestsPending > 0 ? 'warning' : 'success'}
          value={formatCount(summary.accessRequestsPending)}
          hint={t('publication.participants.kpi.accessHint', {
            invitations: summary.invitationsPending,
          })}
        />
        <KpiCard
          label={t('publication.participants.kpi.conditions')}
          icon="clipboardCheck"
          tone={
            summary.acknowledgmentsOutstanding + summary.confidentialityOutstanding > 0
              ? 'warning'
              : 'success'
          }
          value={formatCount(
            summary.acknowledgmentsOutstanding + summary.confidentialityOutstanding,
          )}
          hint={t('publication.participants.kpi.conditionsHint', {
            acknowledgments: summary.acknowledgmentsOutstanding,
            confidentiality: summary.confidentialityOutstanding,
            gate: summary.qualificationGateNotMet,
          })}
        />
        <KpiCard
          label={t('publication.participants.kpi.delivery')}
          icon="alertTriangle"
          tone={summary.deliveryFailures > 0 ? 'danger' : 'success'}
          value={formatCount(summary.deliveryFailures)}
          hint={t('publication.participants.kpi.deliveryHint', {
            intends: summary.intendsToBid,
            noBid: summary.noBid,
          })}
        />
      </KpiGrid>

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('publication.participants.conditionsTitle')}>
          {summary.conditions.length === 0 ? (
            <EmptyState
              compact
              icon="clipboard"
              title={t('publication.participants.noConditions')}
            />
          ) : (
            <ul className="tiq-stack">
              {summary.conditions.map((condition) => (
                <li key={condition.conditionId} className="tiq-inline">
                  <Chip tone={condition.blocking ? 'danger' : 'neutral'} size="sm">
                    {condition.blocking
                      ? t('publication.common.blocking')
                      : t('publication.common.informational')}
                  </Chip>
                  <span>
                    <strong>
                      {tEnum('participation_conditions.condition_type', condition.conditionType)}
                    </strong>
                    {': '}
                    {condition.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('publication.participants.ackTitle')}>
          {summary.acknowledgmentSubjects.length === 0 ? (
            <EmptyState
              compact
              icon="checkSquare"
              title={t('publication.participants.noAckSubjects')}
            />
          ) : (
            <ul className="tiq-stack">
              {summary.acknowledgmentSubjects.map((subject) => (
                <li key={`${subject.subjectType}:${subject.subjectId}`} className="tiq-inline">
                  <Chip
                    tone={subject.acknowledgedCount < subject.requiredCount ? 'warning' : 'success'}
                    size="sm"
                  >
                    {t('publication.participants.ackValue', {
                      done: subject.acknowledgedCount,
                      required: subject.requiredCount,
                    })}
                  </Chip>
                  <span>{subject.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card flush title={t('publication.participants.tableTitle')}>
        <DataTable
          caption={t('publication.participants.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.supplier.legalName}
          rowHref={(row) => publicationPaths.participant(tenderId, row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          selection={
            canDistributePermission
              ? {
                  selected,
                  onChange: setSelected,
                  actions: (
                    <Button size="sm" icon="send" onClick={() => setDistributeIds(selectedIds)}>
                      {t('publication.actions.distributeSelected', { count: selectedIds.length })}
                    </Button>
                  ),
                }
              : undefined
          }
          empty={
            <EmptyState
              compact
              icon="users"
              title={
                filtered
                  ? t('publication.participants.emptyFiltered')
                  : t('publication.participants.empty')
              }
              description={filtered ? undefined : t('publication.participants.emptyHint')}
            />
          }
          pagination={paginationOf(query.data, setFilters)}
        />
      </Card>

      <InviteDialog
        open={inviteOpen}
        tender={summary.tender}
        timeZone={timeZone}
        onClose={() => setInviteOpen(false)}
        onDone={(row) => {
          setInviteOpen(false);
          setAdded((current) => [row, ...current]);
          toast.show(
            t('publication.participants.invited', { supplier: row.supplier.legalName }),
            'success',
          );
          invalidateApiQueries('buyer.publication.');
        }}
      />
      <AccessDecisionDialog
        tender={summary.tender}
        participant={decideFor}
        onClose={() => setDecideFor(null)}
        onDone={(row) => {
          setDecideFor(null);
          setUpdated((current) => new Map(current).set(row.id, row));
          toast.show(
            t('publication.participants.accessDecided', {
              supplier: row.supplier.legalName,
              status: tEnum('participants.access_status', row.accessStatus),
            }),
            'success',
          );
        }}
      />
      {distributeIds !== null && (
        <DistributeDialog
          open
          tender={summary.tender}
          pendingCount={summary.invitationsPending}
          participantIds={distributeIds.length === 0 ? undefined : distributeIds}
          onClose={() => setDistributeIds(null)}
          onDone={(outcome) => {
            setDistributeIds(null);
            setSelected(new Set());
            setUpdated((current) => {
              const next = new Map(current);
              for (const row of outcome.participants) next.set(row.id, row);
              return next;
            });
            toast.show(outcome.message, 'success');
            invalidateApiQueries('buyer.publication.');
          }}
        />
      )}
    </div>
  );
}
