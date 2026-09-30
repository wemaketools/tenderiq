/**
 * SUP-04 — Tender assignments: who works on which pursuit, with which responsibility, which sections, whether
 * pricing is visible and when the work is due. Approver and signatory responsibilities need the matching authority
 * (AC-03: a contributor can complete assigned work but cannot submit). Assign a member or end an assignment.
 */
import { useState } from 'react';

import { PURSUIT_TEAM_MEMBERS_RESPONSIBILITY } from '@contracts/enums';
import type { PursuitTeamMembersResponsibility } from '@contracts/enums';
import { TENDER_ASSIGNMENT_SORTS, orgAdminEndpoints } from '@contracts/org-admin';
import type { TenderAssignmentRow } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  EmptyState,
  FilterBar,
  OfficialDeadline,
  PageHeader,
  SearchField,
  Select,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { PersonCell } from '../components/AccessBits';
import { MemberSelect } from '../components/Pickers';
import { dialogError } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import {
  booleanFilter,
  compact,
  directionOf,
  idFilter,
  isFiltered,
  oneOf,
  pagingOf,
  sortOf,
  tableSort,
} from '../lib/lists';

const DEFAULTS = {
  q: '',
  tenderId: '',
  responsibility: '',
  active: 'true',
  sort: 'dueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};
const FIELDS = ['userId', 'tenderId', 'responsibility', 'sectionScope', 'dueAt', 'canViewPricing'];

function AssignDialog({
  onClose,
  onDone,
}: {
  readonly onClose: () => void;
  readonly onDone: (row: TenderAssignmentRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const tenders = useApiQuery(orgAdminEndpoints.listAssignableTenders, {});
  const create = useApiMutation(orgAdminEndpoints.createTenderAssignment);
  const [userId, setUserId] = useState('');
  const [tenderId, setTenderId] = useState('');
  const [responsibility, setResponsibility] = useState<PursuitTeamMembersResponsibility | ''>('');
  const [sections, setSections] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [checked, setChecked] = useState(false);
  const server = formErrors(create.error, FIELDS);
  const tender = tenders.data?.items.find((item) => String(item.tenderId) === tenderId);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.assignments.assignTitle')}
      scope={
        tender === undefined
          ? t('admin-access.assignments.chooseTender')
          : `${tender.reference} ${tender.title}`
      }
      consequence={t('admin-access.assignments.assignConsequence')}
      confirmLabel={t('admin-access.assignments.assign')}
      pending={create.pending}
      error={dialogError(create.error, FIELDS)}
      onCancel={onClose}
      onConfirm={async () => {
        setChecked(true);
        if (userId === '' || tenderId === '' || responsibility === '') return;
        try {
          onDone(
            await create.mutate({
              body: {
                userId: Number(userId),
                tenderId: Number(tenderId),
                responsibility,
                sectionScope: sections
                  .split(',')
                  .map((item) => item.trim())
                  .filter((item) => item !== ''),
                dueAt,
                canViewPricing: pricing,
              },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        <MemberSelect
          label={t('admin-access.assignments.member')}
          value={userId}
          onChange={setUserId}
          error={
            checked && userId === ''
              ? t('admin-access.common.personRequired')
              : server.forField('userId')
          }
          required
        />
        <Select
          label={t('admin-access.assignments.col.tender')}
          value={tenderId}
          onChange={setTenderId}
          placeholder={t('admin-access.common.choose')}
          options={(tenders.data?.items ?? []).map((item) => ({
            value: String(item.tenderId),
            label: `${item.reference} ${item.title}`,
          }))}
          error={
            checked && tenderId === ''
              ? t('admin-access.assignments.tenderRequired')
              : server.forField('tenderId')
          }
          required
        />
        <Select
          label={t('admin-access.assignments.col.responsibility')}
          hint={t('admin-access.assignments.responsibilityHint')}
          value={responsibility}
          onChange={(value) => setResponsibility(value as PursuitTeamMembersResponsibility)}
          placeholder={t('admin-access.common.choose')}
          options={PURSUIT_TEAM_MEMBERS_RESPONSIBILITY.map((value) => ({
            value,
            label: tEnum('pursuit_team_members.responsibility', value),
          }))}
          error={
            checked && responsibility === ''
              ? t('admin-access.assignments.responsibilityRequired')
              : server.forField('responsibility')
          }
          required
        />
        <DateTimeInput
          label={t('admin-access.assignments.col.due')}
          value={dueAt}
          onChange={setDueAt}
          timeZone={timeZone}
          error={server.forField('dueAt')}
        />
        <TextField
          label={t('admin-access.assignments.sections')}
          hint={t('admin-access.assignments.sectionsHint')}
          value={sections}
          onChange={setSections}
          error={server.forField('sectionScope')}
          fieldClassName="tiq-form-full"
        />
        <Checkbox
          label={t('admin-access.assignments.pricing')}
          hint={t('admin-access.assignments.pricingHint')}
          checked={pricing}
          onChange={setPricing}
          error={server.forField('canViewPricing')}
        />
      </div>
    </ConfirmActionDialog>
  );
}

export default function TenderAssignmentsPage() {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-04:assignments', DEFAULTS);
  const [assigning, setAssigning] = useState(false);
  const [ending, setEnding] = useState<TenderAssignmentRow | null>(null);
  const [created, setCreated] = useState<readonly TenderAssignmentRow[]>([]);
  const [results, setResults] = useState<Readonly<Record<number, TenderAssignmentRow>>>({});
  const end = useApiMutation(orgAdminEndpoints.endTenderAssignment);
  const tenders = useApiQuery(orgAdminEndpoints.listAssignableTenders, {});
  const query = useApiQuery(orgAdminEndpoints.listTenderAssignments, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idFilter(filters.tenderId),
      responsibility: oneOf(filters.responsibility, PURSUIT_TEAM_MEMBERS_RESPONSIBILITY),
      active: booleanFilter(filters.active),
      sort: sortOf(filters.sort, TENDER_ASSIGNMENT_SORTS, 'dueAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const filtered = isFiltered(filters);
  const loaded = (query.data?.items ?? []).map((row) => results[row.assignmentId] ?? row);
  const rows = [
    ...created.filter((row) => !loaded.some((item) => item.assignmentId === row.assignmentId)),
    ...loaded,
  ];
  const columns: DataTableColumn<TenderAssignmentRow>[] = [
    {
      id: 'member',
      header: t('admin-access.assignments.member'),
      sortable: true,
      cell: (row) => <PersonCell name={row.member.fullName} sub={row.capacity} />,
    },
    {
      id: 'tender',
      header: t('admin-access.assignments.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <span>
            <span className="tiq-ref">{row.tender.reference}</span> {row.tender.title}
          </span>
          <span className="tiq-cell-sub">{row.tender.buyerName}</span>
          {row.tender.submissionDeadline !== null && (
            <OfficialDeadline
              deadline={row.tender.submissionDeadline}
              label={t('admin-access.assignments.deadline')}
              showLocal={false}
            />
          )}
        </>
      ),
    },
    {
      id: 'responsibility',
      header: t('admin-access.assignments.col.responsibility'),
      sortable: true,
      cell: (row) => tEnum('pursuit_team_members.responsibility', row.responsibility),
    },
    {
      id: 'sections',
      header: t('admin-access.assignments.col.sections'),
      cell: (row) => (
        <>
          <span>
            {row.sectionScope.length === 0
              ? t('admin-access.assignments.allSections')
              : row.sectionScope.join(', ')}
          </span>
          {row.lotLabels.length > 0 && (
            <span className="tiq-cell-sub">{row.lotLabels.join(', ')}</span>
          )}
        </>
      ),
    },
    {
      id: 'pricing',
      header: t('admin-access.assignments.col.pricing'),
      cell: (row) =>
        row.canViewPricing ? (
          <Chip tone="warning" size="sm" icon="eye">
            {t('admin-access.assignments.pricingVisible')}
          </Chip>
        ) : (
          <Chip tone="neutral-outlined" size="sm" icon="eyeOff">
            {t('admin-access.assignments.pricingHidden')}
          </Chip>
        ),
    },
    {
      id: 'dueAt',
      header: t('admin-access.assignments.col.due'),
      sortable: true,
      cell: (row) =>
        row.dueAt === null ? (
          '—'
        ) : (
          <OfficialDeadline deadline={{ at: row.dueAt, timeZone }} showLocal={false} />
        ),
    },
    {
      id: 'status',
      header: t('admin-access.member.col.status'),
      cell: (row) =>
        row.active ? (
          <PersonCell
            name={t('admin-access.common.active')}
            sub={t('admin-access.assignments.since', {
              date: formatInstantDate(row.assignedAt, timeZone),
            })}
          />
        ) : (
          <PersonCell
            name={t('admin-access.common.ended')}
            sub={row.endedAt === null ? null : formatInstantDate(row.endedAt, timeZone)}
          />
        ),
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) =>
        row.active ? (
          <div className="tiq-row-actions">
            <Button size="sm" onClick={() => setEnding(row)}>
              {t('admin-access.assignments.end')}
            </Button>
          </div>
        ) : (
          '—'
        ),
    },
  ];
  return (
    <AccessLayout>
      <PageHeader
        title={t('admin-access.assignments.title')}
        subtitle={t('admin-access.assignments.intro')}
        primaryAction={
          <Button variant="primary" icon="plus" onClick={() => setAssigning(true)}>
            {t('admin-access.assignments.assign')}
          </Button>
        }
      />
      <FilterBar
        label={t('admin-access.assignments.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.assignments.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.assignments.col.tender')}
          placeholder={t('admin-access.common.all')}
          value={filters.tenderId}
          options={(tenders.data?.items ?? []).map((item) => ({
            value: String(item.tenderId),
            label: item.reference,
          }))}
          onChange={(tenderId) => setFilters({ tenderId, page: 1 })}
        />
        <Select
          label={t('admin-access.assignments.col.responsibility')}
          placeholder={t('admin-access.common.all')}
          value={filters.responsibility}
          options={PURSUIT_TEAM_MEMBERS_RESPONSIBILITY.map((value) => ({
            value,
            label: tEnum('pursuit_team_members.responsibility', value),
          }))}
          onChange={(responsibility) => setFilters({ responsibility, page: 1 })}
        />
        <Select
          label={t('admin-access.member.col.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.active}
          options={[
            { value: 'true', label: t('admin-access.common.active') },
            { value: 'false', label: t('admin-access.common.ended') },
          ]}
          onChange={(active) => setFilters({ active, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-access.assignments.caption')}
          columns={columns}
          rows={query.data === undefined ? undefined : rows}
          rowKey={(row) => String(row.assignmentId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered
                  ? t('admin-access.assignments.emptyFiltered')
                  : t('admin-access.assignments.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {assigning && (
        <AssignDialog
          onClose={() => setAssigning(false)}
          onDone={(row) => {
            setCreated([row, ...created]);
            setAssigning(false);
            toast.show(t('admin-access.assignments.assigned'), 'success');
          }}
        />
      )}
      {ending !== null && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('admin-access.assignments.endTitle')}
          scope={`${ending.member.fullName} · ${ending.tender.reference}`}
          consequence={t('admin-access.assignments.endConsequence')}
          confirmLabel={t('admin-access.assignments.end')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          pending={end.pending}
          error={dialogError(end.error, [])}
          onCancel={() => {
            end.reset();
            setEnding(null);
          }}
          onConfirm={async ({ reason }) => {
            try {
              const row = await end.mutate({
                params: { assignmentId: ending.assignmentId },
                body: { reason },
              });
              setResults({ ...results, [row.assignmentId]: row });
              setEnding(null);
              toast.show(t('admin-access.assignments.ended'), 'success');
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </AccessLayout>
  );
}
