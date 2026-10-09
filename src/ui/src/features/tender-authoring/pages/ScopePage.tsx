/**
 * BUY-09 — Scope, lots and requirements: requirements with quantities, locations, lots, applicability, response
 * instructions, mandatory status (gate vs rated vs information) and evidence. Principal actions: author and review;
 * identify contradictions and missing ownership (issue filter and KPI cards).
 */
import { useState } from 'react';

import { REQUIREMENTS_ENVELOPE, REQUIREMENTS_TREATMENT } from '@contracts/enums';
import {
  REQUIREMENT_ISSUE_FILTERS,
  REQUIREMENT_SORT_FIELDS,
  listLots,
  listRequirements,
  removeRequirement,
} from '@contracts/tenders';
import type { Lot, Requirement } from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { useCanCall } from '../../../auth/permissions';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  OfficialDeadline,
  OrDash,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { IssueChips, IssueList } from '../components/IssueList';
import { LotDialog } from '../components/LotDialog';
import { RequirementDialog } from '../components/RequirementDialog';
import { TenderHeader, TenderWorkspace } from '../components/TenderWorkspace';
import type { TenderWorkspaceContext } from '../components/TenderWorkspace';
import { withTenderMessage } from '../lib/errors';
import { scopeLabel } from '../lib/labels';
import { compact, directionOf, oneOf, positiveId, single, tableSort } from '../lib/lists';
import { useOverlay } from '../lib/overlay';

export default function ScopePage() {
  return <TenderWorkspace>{(context) => <Scope context={context} />}</TenderWorkspace>;
}

type SortField = (typeof REQUIREMENT_SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  lot: '',
  section: '',
  treatment: '',
  envelope: '',
  owner: '',
  issue: '',
  sort: 'sortOrder',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function Scope({ context }: { readonly context: TenderWorkspaceContext }) {
  const { tender, canEdit } = context;
  const toast = useToast();
  // DD-49: a panel the membership cannot load is left out, and its query is not made.
  const canListLots = useCanCall(listLots);
  const canListRequirements = useCanCall(listRequirements);
  const lotsQuery = useApiQuery(listLots, canListLots ? { params: { tenderId: tender.id } } : null);
  const lots = useOverlay<Lot>();
  const requirements = useOverlay<Requirement>();
  const [lotEditing, setLotEditing] = useState<Lot | null>(null);
  const [lotOpen, setLotOpen] = useState(false);
  const [reqEditing, setReqEditing] = useState<Requirement | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [removing, setRemoving] = useState<Requirement | null>(null);
  const remove = useApiMutation(removeRequirement);
  const [filters, setFilters, clearFilters] = useScreenFilters(`BUY-09:${tender.id}`, DEFAULTS);

  const query = useApiQuery(
    listRequirements,
    canListRequirements
      ? {
          params: { tenderId: tender.id },
          query: compact({
            q: filters.q.trim(),
            lotId: positiveId(filters.lot),
            tenderLevel: filters.lot === 'tender' ? true : undefined,
            section: filters.section,
            treatment: oneOf(filters.treatment, REQUIREMENTS_TREATMENT),
            envelope: oneOf(filters.envelope, REQUIREMENTS_ENVELOPE),
            ownerUserId: positiveId(filters.owner),
            issue: single(filters.issue, REQUIREMENT_ISSUE_FILTERS),
            sort: single<SortField>(filters.sort, REQUIREMENT_SORT_FIELDS) ?? 'sortOrder',
            dir: directionOf(filters.dir),
            page: filters.page,
            pageSize: filters.pageSize,
          }),
        }
      : null,
  );
  const showLots = canListLots && lotsQuery.error?.kind !== 'forbidden';
  const showRequirements = canListRequirements && query.error?.kind !== 'forbidden';
  const summary = query.data?.summary;
  const filtered = [
    filters.q,
    filters.lot,
    filters.section,
    filters.treatment,
    filters.envelope,
    filters.owner,
    filters.issue,
  ].some((value) => value !== '');
  const lotRows = lotsQuery.data === undefined ? undefined : lots.apply(lotsQuery.data.lots);
  const ownerOptions = (() => {
    const seen = new Map<number, string>();
    for (const row of query.data?.items ?? []) {
      if (row.owner !== null) seen.set(row.owner.userId, row.owner.fullName);
    }
    return [...seen.entries()].map(([value, label]) => ({ value: String(value), label }));
  })();

  const confirmRemove = async (): Promise<void> => {
    if (removing === null) return;
    try {
      const result = await remove.mutate({
        params: { tenderId: tender.id, requirementId: removing.id },
      });
      requirements.remove(result.removedId);
      context.reportChange(result.change);
      toast.show(t('tender-authoring.requirements.removed', { code: removing.refCode }), 'success');
      setRemoving(null);
      remove.reset();
    } catch {
      // Shown in the dialog.
    }
  };

  const lotColumns: DataTableColumn<Lot>[] = [
    { id: 'lotNo', header: t('tender-authoring.lots.col.no'), cell: (row) => row.lotNo },
    {
      id: 'title',
      header: t('tender-authoring.lots.col.title'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {row.description ?? t('tender-authoring.common.none')}
          </span>
        </>
      ),
    },
    {
      id: 'quantity',
      header: t('tender-authoring.lots.quantity'),
      cell: (row) => (
        <>
          <OrDash>{row.quantityDescription}</OrDash>
          <span className="tiq-cell-sub">
            {[
              row.deliveryLocation,
              row.deliveryDate === null ? null : formatCalendarDate(row.deliveryDate),
            ]
              .filter((value) => value !== null)
              .join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'value',
      header: t('tender-authoring.lots.col.value'),
      numeric: true,
      cell: (row) => <MoneyText value={row.estimatedValue} />,
    },
    {
      id: 'owner',
      header: t('tender-authoring.lots.col.owner'),
      cell: (row) =>
        row.owner === null ? (
          <Chip tone="danger" size="sm">
            {t('tender-authoring.lots.noOwner')}
          </Chip>
        ) : (
          row.owner.fullName
        ),
    },
    {
      id: 'deadline',
      header: t('tender-authoring.lots.col.deadline'),
      cell: (row) =>
        row.submissionDeadline === null ? (
          <span className="tiq-text-muted">{t('tender-authoring.lots.tenderDeadline')}</span>
        ) : (
          <OfficialDeadline deadline={row.submissionDeadline} showLocal={false} />
        ),
    },
    {
      id: 'content',
      header: t('tender-authoring.lots.col.content'),
      cell: (row) => (
        <>
          <span>{t('tender-authoring.lots.requirements', { count: row.requirementCount })}</span>
          <span className="tiq-cell-sub">
            {t('tender-authoring.lots.schedules', { count: row.pricingScheduleCount })}
          </span>
        </>
      ),
    },
    {
      id: 'stage',
      header: t('tender-authoring.lots.col.stage'),
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="lots.stage" value={row.stage} size="sm" />
          <IssueChips issues={row.issues} />
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('tender-authoring.common.actions'),
      cell: (row) =>
        canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            icon="edit"
            aria-label={t('tender-authoring.lots.editTitle', { no: row.lotNo })}
            onClick={() => {
              setLotEditing(row);
              setLotOpen(true);
            }}
          >
            {t('tender-authoring.common.edit')}
          </Button>
        ) : null,
    },
  ];

  const reqColumns: DataTableColumn<Requirement>[] = [
    {
      id: 'refCode',
      header: t('tender-authoring.requirements.col.ref'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.refCode}</span>
          <span className="tiq-cell-sub">{row.section}</span>
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
            {scopeLabel(row.lot)}
            {row.applicability === null ? '' : ` · ${row.applicability}`}
          </span>
        </>
      ),
    },
    {
      id: 'owner',
      header: t('tender-authoring.requirements.col.owner'),
      cell: (row) =>
        row.owner === null ? (
          <Chip tone="danger" size="sm" icon="alertTriangle">
            {t('tender-authoring.requirements.noOwner')}
          </Chip>
        ) : (
          row.owner.fullName
        ),
    },
    {
      id: 'response',
      header: t('tender-authoring.requirements.col.response'),
      cell: (row) => (
        <>
          <span>
            {tEnum('requirements.response_type', row.responseType)}
            {row.choices.length === 0 ? '' : ` (${row.choices.join(', ')})`}
          </span>
          <span className="tiq-cell-sub">
            {row.evidenceRequired ??
              row.responseInstructions ??
              t('tender-authoring.requirements.noEvidence')}
          </span>
        </>
      ),
    },
    {
      id: 'treatment',
      header: t('tender-authoring.requirements.col.treatment'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="requirements.treatment" value={row.treatment} size="sm" />
          <span className="tiq-cell-sub">
            {t('tender-authoring.requirements.ifMissing', {
              consequence: tEnum('requirements.missing_consequence', row.missingConsequence),
            })}
          </span>
        </>
      ),
    },
    {
      id: 'envelope',
      header: t('tender-authoring.requirements.col.envelope'),
      cell: (row) => (
        <>
          <span>{tEnum('requirements.envelope', row.envelope)}</span>
          <span className="tiq-cell-sub">
            {row.criterion === null ? '' : `${row.criterion.code} ${row.criterion.name}`}
          </span>
        </>
      ),
    },
    {
      id: 'issues',
      header: t('tender-authoring.requirements.col.issues'),
      cell: (row) =>
        row.issues.length === 0 ? (
          <Chip tone="success" size="sm">
            {t('tender-authoring.requirements.consistent')}
          </Chip>
        ) : (
          <span className="tiq-stack">
            <IssueChips issues={row.issues} />
            {row.issues.map((issue) => (
              <span key={`${issue.code}-${issue.field ?? ''}`} className="tiq-cell-sub">
                {issue.message}
              </span>
            ))}
          </span>
        ),
    },
    {
      id: 'actions',
      header: t('tender-authoring.common.actions'),
      cell: (row) =>
        canEdit ? (
          <span className="tiq-inline">
            <Button
              size="sm"
              variant="ghost"
              icon="edit"
              aria-label={t('tender-authoring.requirements.editTitle', { code: row.refCode })}
              onClick={() => {
                setReqEditing(row);
                setReqOpen(true);
              }}
            >
              {t('tender-authoring.common.edit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              aria-label={t('tender-authoring.requirements.removeTitle', { code: row.refCode })}
              onClick={() => setRemoving(row)}
            >
              {t('tender-authoring.common.remove')}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <TenderHeader
        context={context}
        section="scope"
        primaryAction={
          canEdit ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                setReqEditing(null);
                setReqOpen(true);
              }}
            >
              {t('tender-authoring.requirements.add')}
            </Button>
          ) : undefined
        }
        actions={
          canEdit ? (
            <Button
              icon="layers"
              onClick={() => {
                setLotEditing(null);
                setLotOpen(true);
              }}
            >
              {t('tender-authoring.lots.add')}
            </Button>
          ) : undefined
        }
      />
      {showRequirements && (
        <FilterBar
          label={t('tender-authoring.requirements.filters')}
          onClear={clearFilters}
          canClear={filtered}
        >
          <Select
            label={t('tender-authoring.requirements.col.lot')}
            placeholder={t('tender-authoring.requirements.filter.allLots')}
            value={filters.lot}
            options={[
              { value: 'tender', label: t('tender-authoring.common.wholeTender') },
              ...tender.lots.map((lot) => ({ value: String(lot.id), label: scopeLabel(lot) })),
            ]}
            onChange={(lot) => setFilters({ lot, page: 1 })}
          />
          <Select
            label={t('tender-authoring.requirements.col.section')}
            placeholder={t('tender-authoring.requirements.filter.allSections')}
            value={filters.section}
            options={(query.data?.sections ?? []).map((value) => ({ value, label: value }))}
            onChange={(section) => setFilters({ section, page: 1 })}
          />
          <Select
            label={t('tender-authoring.requirements.col.treatment')}
            placeholder={t('tender-authoring.requirements.filter.allTreatments')}
            value={filters.treatment}
            options={REQUIREMENTS_TREATMENT.map((value) => ({
              value,
              label: tEnum('requirements.treatment', value),
            }))}
            onChange={(treatment) => setFilters({ treatment, page: 1 })}
          />
          <Select
            label={t('tender-authoring.requirements.col.envelope')}
            placeholder={t('tender-authoring.requirements.filter.allEnvelopes')}
            value={filters.envelope}
            options={REQUIREMENTS_ENVELOPE.map((value) => ({
              value,
              label: tEnum('requirements.envelope', value),
            }))}
            onChange={(envelope) => setFilters({ envelope, page: 1 })}
          />
          <Select
            label={t('tender-authoring.requirements.col.owner')}
            placeholder={t('tender-authoring.requirements.filter.allOwners')}
            value={filters.owner}
            options={ownerOptions}
            onChange={(owner) => setFilters({ owner, page: 1 })}
          />
          <Select
            label={t('tender-authoring.requirements.filter.issue')}
            placeholder={t('tender-authoring.requirements.filter.allIssues')}
            value={filters.issue}
            options={REQUIREMENT_ISSUE_FILTERS.map((value) => ({
              value,
              label: t(`tender-authoring.requirements.issueFilter.${value}`),
            }))}
            onChange={(issue) => setFilters({ issue, page: 1 })}
          />
          <SearchField
            label={t('tender-authoring.requirements.filter.search')}
            placeholder={t('tender-authoring.requirements.filter.searchPlaceholder')}
            value={filters.q}
            onChange={(q) => setFilters({ q, page: 1 })}
          />
        </FilterBar>
      )}
      {showRequirements && (
        <KpiGrid>
          <KpiCard
            label={t('tender-authoring.requirements.kpi.total')}
            icon="listChecks"
            value={summary === undefined ? '…' : formatCount(summary.total)}
            hint={
              summary === undefined
                ? undefined
                : t('tender-authoring.requirements.kpi.totalHint', {
                    gates: summary.mandatoryGates,
                    rated: summary.rated,
                    info: summary.informationOnly,
                  })
            }
          />
          <KpiCard
            label={t('tender-authoring.requirements.kpi.gates')}
            icon="shieldCheck"
            tone="info"
            value={summary === undefined ? '…' : formatCount(summary.mandatoryGates)}
            hint={t('tender-authoring.requirements.kpi.gatesHint')}
          />
          <KpiCard
            label={t('tender-authoring.requirements.kpi.missingOwner')}
            icon="user"
            tone={summary !== undefined && summary.missingOwner > 0 ? 'danger' : 'success'}
            value={summary === undefined ? '…' : formatCount(summary.missingOwner)}
            hint={t('tender-authoring.requirements.kpi.missingOwnerHint')}
          />
          <KpiCard
            label={t('tender-authoring.requirements.kpi.contradictions')}
            icon="alertTriangle"
            tone={summary !== undefined && summary.contradictions > 0 ? 'danger' : 'success'}
            value={summary === undefined ? '…' : formatCount(summary.contradictions)}
            hint={t('tender-authoring.requirements.kpi.contradictionsHint')}
          />
        </KpiGrid>
      )}
      {showLots && (
        <Card
          title={t('tender-authoring.lots.title', { count: lotRows?.length ?? tender.lots.length })}
          subtitle={
            lotsQuery.data === undefined
              ? undefined
              : t('tender-authoring.lots.subtitle', {
                  model: tEnum('tenders.award_model', lotsQuery.data.awardModel),
                  max: lotsQuery.data.maxLotsPerSupplier ?? t('tender-authoring.lots.noMax'),
                  partial: lotsQuery.data.partialBidsAllowed
                    ? t('tender-authoring.common.yes')
                    : t('tender-authoring.common.no'),
                })
          }
          flush
        >
          <DataTable
            caption={t('tender-authoring.lots.caption')}
            columns={lotColumns}
            rows={lotRows}
            rowKey={(row) => String(row.id)}
            loading={lotsQuery.isFetching}
            error={lotsQuery.error}
            onRetry={lotsQuery.reload}
            empty={<EmptyState compact icon="layers" title={t('tender-authoring.lots.empty')} />}
          />
        </Card>
      )}
      {showLots && lotRows !== undefined && (
        <IssueList
          issues={lotRows.flatMap((lot) => lot.issues)}
          label={t('tender-authoring.lots.issues')}
        />
      )}
      {showRequirements && (
        <Card title={t('tender-authoring.requirements.title')} flush>
          <DataTable
            caption={t('tender-authoring.requirements.caption')}
            columns={reqColumns}
            rows={query.data === undefined ? undefined : requirements.apply(query.data.items)}
            rowKey={(row) => String(row.id)}
            loading={query.isFetching}
            error={query.error}
            onRetry={query.reload}
            sort={tableSort(filters.sort, filters.dir)}
            onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
            empty={
              <EmptyState
                compact
                icon="listChecks"
                title={
                  filtered
                    ? t('tender-authoring.requirements.emptyFiltered')
                    : t('tender-authoring.requirements.empty')
                }
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
      )}
      {canEdit && (
        <LotDialog
          open={lotOpen}
          tenderId={tender.id}
          timeZone={tender.officialTimeZone}
          currency={tender.currency}
          lot={lotEditing}
          onClose={() => setLotOpen(false)}
          onSaved={(result) => {
            lots.put(result.lot);
            context.reportChange(result.change);
          }}
        />
      )}
      {canEdit && (
        <RequirementDialog
          open={reqOpen}
          tenderId={tender.id}
          lots={tender.lots}
          requirement={reqEditing}
          onClose={() => setReqOpen(false)}
          onSaved={(result) => {
            requirements.put(result.requirement);
            context.reportChange(result.change);
          }}
        />
      )}
      <ConfirmActionDialog
        open={removing !== null}
        tone="danger"
        title={t('tender-authoring.requirements.removeTitle', { code: removing?.refCode ?? '' })}
        scope={
          removing === null ? '' : `${tender.reference} · ${removing.refCode} ${removing.text}`
        }
        consequence={t('tender-authoring.requirements.removeResult')}
        confirmLabel={t('tender-authoring.common.remove')}
        onConfirm={() => confirmRemove()}
        onCancel={() => {
          setRemoving(null);
          remove.reset();
        }}
        pending={remove.pending}
        error={withTenderMessage(remove.error)}
      />
    </>
  );
}
