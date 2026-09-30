/**
 * BUY-01 and SUP-01 dashboard handlers. KPIs and panels are computed from the dashboard fixtures after the
 * dimension filters and the caller's permissions are applied: a panel the caller may not read is `restricted` with
 * no items and no count (BR-43). A supplier only ever sees its own rows.
 */
import { gt, lt, round, sum } from '../../../contracts/decimal.js';
import type { Money } from '../../../contracts/common.js';
import { TENDERS_STATUS } from '../../../contracts/enums.js';
import type { TendersStatus } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type {
  BuyerDashboard,
  BuyerDashboardKpiKey,
  SupplierDashboard,
  SupplierDashboardKpiKey,
} from '../../../contracts/reporting.js';
import { getBuyerDashboard, getSupplierDashboard } from '../../../contracts/reporting.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  CATEGORIES,
  DASHBOARD_APPROVALS,
  DASHBOARD_ATTENTION,
  DASHBOARD_COMPLAINTS,
  DASHBOARD_DEADLINES,
  DASHBOARD_KPI_DELTAS,
  DASHBOARD_OBLIGATIONS,
  DASHBOARD_RENEWALS,
  DASHBOARD_WORKLOAD_TASKS,
  DEPARTMENTS,
  LEGAL_ENTITIES,
  LINKS,
  OFFICIAL_TIME_ZONE,
  REPORTING_AS_OF,
  REPORTING_AS_OF_DATE,
  SUPPLIER_CONTRACT_TASKS,
  SUPPLIER_DEADLINES,
  SUPPLIER_EVIDENCE,
  SUPPLIER_INVITATIONS,
  SUPPLIER_KPI_DELTAS,
  SUPPLIER_OUTCOMES,
  SUPPLIER_PURSUITS,
  SUPPLIER_QUALIFICATIONS,
  TENDER_FACTS,
  contractFact,
  tenderFact,
} from '../../fixtures/reporting/index.js';
import type { FixtureTenderFact } from '../../fixtures/reporting/index.js';
import { findTenantById, personRef } from '../../persona.js';
import { hasAny } from './engine.js';

/** Statuses counted as active events (released and not yet decided). */
const ACTIVE_STATUSES: readonly TendersStatus[] = ['ready', 'open', 'closed', 'under_assessment', 'award_pending', 'partially_awarded'];
/** Statuses whose estimated value is still in the pipeline. */
const PIPELINE_OPEN: readonly TendersStatus[] = ['draft', 'awaiting_release_approval', ...ACTIVE_STATUSES];

const DAY_MS = 86_400_000;

function addDays(instant: string, days: number): string {
  return new Date(Date.parse(instant) + days * DAY_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS);
}

function sumMoney(values: readonly Money[], currency: string): Money {
  return { amount: values.length === 0 ? '0.00' : round(sum(values.map((value) => value.amount)), 2), currency };
}

function kpi<K extends string>(
  key: K,
  value: number,
  restricted: boolean,
  to: string | null,
  hint: string | null,
  delta: { direction: 'up' | 'down' | 'flat'; value: number; positive: boolean } | undefined,
) {
  return {
    key,
    value: restricted ? null : value,
    restricted,
    delta: restricted || delta === undefined ? null : { ...delta, comparedTo: 'last month' },
    hint: restricted ? null : hint,
    to: restricted ? null : to,
  };
}

export function registerDashboards(app: MockApp): void {
  mockRoute(app, getBuyerDashboard, ({ requireTenant, query, fail }) => {
    const { tenant, permissions } = requireTenant();
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      fail(422, 'INVALID_DATE_RANGE', 'The start date must be on or before the end date.');
    }
    if (query.minValue !== undefined && query.maxValue !== undefined && gt(query.minValue, query.maxValue)) {
      fail(422, 'INVALID_VALUE_RANGE', 'The minimum value must not exceed the maximum value.');
    }
    const currency = tenant.defaultCurrency ?? 'BWP';
    const stages = query.stage ?? [];
    const dimensional =
      query.legalEntityId !== undefined ||
      query.departmentId !== undefined ||
      query.categoryId !== undefined ||
      query.ownerUserId !== undefined ||
      query.minValue !== undefined ||
      query.maxValue !== undefined ||
      stages.length > 0;
    const anyFilter = dimensional || query.from !== undefined || query.to !== undefined;

    const tenantTenders = TENDER_FACTS.filter((row) => row.tenantId === tenant.id && row.status !== 'archived');
    const matches = (row: FixtureTenderFact): boolean => {
      if (query.legalEntityId !== undefined && row.legalEntityId !== query.legalEntityId) return false;
      if (query.departmentId !== undefined && row.departmentId !== query.departmentId) return false;
      if (query.categoryId !== undefined && row.categoryId !== query.categoryId) return false;
      if (query.ownerUserId !== undefined && row.ownerUserId !== query.ownerUserId) return false;
      if (stages.length > 0 && !stages.includes(row.status)) return false;
      if (query.minValue !== undefined || query.maxValue !== undefined) {
        if (row.estimatedValue === null) return false;
        if (query.minValue !== undefined && lt(row.estimatedValue.amount, query.minValue)) return false;
        if (query.maxValue !== undefined && gt(row.estimatedValue.amount, query.maxValue)) return false;
      }
      if (query.from !== undefined && row.lastActivityOn < query.from) return false;
      if (query.to !== undefined && row.openedOn > query.to) return false;
      return true;
    };
    const tenders = tenantTenders.filter(matches);
    const tenderIds = new Set(tenders.map((row) => row.id));
    const inScope = (tenderId: number | null): boolean => (tenderId === null ? !dimensional : tenderIds.has(tenderId));
    const can = (codes: readonly PermissionCode[]): boolean => hasAny(permissions, codes);
    const delta = (key: BuyerDashboardKpiKey) =>
      anyFilter ? undefined : DASHBOARD_KPI_DELTAS.find((row) => row.tenantId === tenant.id && row.key === key);

    const canTenders = can(['tender.view']);
    const canContracts = can(['contract.view']);
    const canComplaints = can(['complaint.manage', 'tender.view']);
    const canApprovals = can(['tender.view', 'approval.decide', 'request.view_all', 'contract.view']);

    const active = tenders.filter((row) => ACTIVE_STATUSES.includes(row.status));
    const horizon = addDays(REPORTING_AS_OF, 7);
    const deadlines = DASHBOARD_DEADLINES.filter((row) => row.tenantId === tenant.id && tenderIds.has(row.tenderId) && row.at >= REPORTING_AS_OF).sort((a, b) =>
      a.at.localeCompare(b.at),
    );
    const closingSoon = new Set(deadlines.filter((row) => row.milestone === 'submission_deadline' && row.at <= horizon).map((row) => row.tenderId));
    const approvals = DASHBOARD_APPROVALS.filter((row) => row.tenantId === tenant.id && can(row.visibleWith) && inScope(row.tenderId));
    const complaints = DASHBOARD_COMPLAINTS.filter((row) => row.tenantId === tenant.id && row.open && tenderIds.has(row.tenderId));
    const onlyComplaint = complaints.length === 1 ? complaints[0] : undefined;
    const complaintsLink =
      complaints.length === 0 ? null : onlyComplaint === undefined ? LINKS.buyerComplaints() : LINKS.buyerComplaint(onlyComplaint.complaintId);
    const renewals = DASHBOARD_RENEWALS.filter(
      (row) => row.tenantId === tenant.id && !row.decided && inScope(row.tenderId) && daysBetween(REPORTING_AS_OF_DATE, row.noticeWindowOpensOn) <= 90,
    );
    const overdue = DASHBOARD_OBLIGATIONS.filter((row) => row.tenantId === tenant.id && row.status === 'overdue' && inScope(row.tenderId));

    const pipelineTenders = tenders.filter((row) => PIPELINE_OPEN.includes(row.status));
    const withValue = pipelineTenders.flatMap((row) => (row.estimatedValue === null ? [] : [row.estimatedValue]));
    const missingEstimates = tenders.filter((row) => row.estimatedValue === null);

    const pipelineByStage = TENDERS_STATUS.flatMap((stage) => {
      const inStage = tenders.filter((row) => row.status === stage);
      if (inStage.length === 0) {
        return [];
      }
      return [
        {
          stage,
          count: inStage.length,
          estimatedValue: sumMoney(inStage.flatMap((row) => (row.estimatedValue === null ? [] : [row.estimatedValue])), currency),
          to: LINKS.buyerTenders(stage),
        },
      ];
    });

    const ownerIds = new Set<number>([
      ...active.map((row) => row.ownerUserId),
      ...DASHBOARD_WORKLOAD_TASKS.filter((row) => row.tenantId === tenant.id).map((row) => row.userId),
    ]);
    const workload = [...ownerIds]
      .filter((userId) => query.ownerUserId === undefined || userId === query.ownerUserId)
      .map((userId) => {
        const tasks = DASHBOARD_WORKLOAD_TASKS.find((row) => row.tenantId === tenant.id && row.userId === userId);
        return {
          owner: personRef(userId),
          activeEvents: active.filter((row) => row.ownerUserId === userId).length,
          openTasks: tasks?.openTasks ?? 0,
          overdueTasks: tasks?.overdueTasks ?? 0,
          pendingApprovals: tasks?.pendingApprovals ?? 0,
          to: LINKS.buyerTenders(),
        };
      })
      .sort((a, b) => b.activeEvents - a.activeEvents || a.owner.fullName.localeCompare(b.owner.fullName));

    const dashboard: BuyerDashboard = {
      asOf: REPORTING_AS_OF,
      currency,
      timeZone: tenant.officialTimeZone,
      appliedFilters: {
        from: query.from ?? null,
        to: query.to ?? null,
        legalEntityId: query.legalEntityId ?? null,
        departmentId: query.departmentId ?? null,
        categoryId: query.categoryId ?? null,
        ownerUserId: query.ownerUserId ?? null,
        stages: [...stages],
        minValue: query.minValue ?? null,
        maxValue: query.maxValue ?? null,
      },
      filterOptions: {
        legalEntities: LEGAL_ENTITIES.filter((row) => row.tenantId === tenant.id).map(({ id, label, code }) => ({ id, label, code })),
        departments: DEPARTMENTS.filter((row) => row.tenantId === tenant.id).map(({ id, label, code }) => ({ id, label, code })),
        categories: CATEGORIES.filter((row) => row.tenantId === tenant.id).map(({ id, label, code }) => ({ id, label, code })),
        owners: canTenders ? [...new Set(tenantTenders.map((row) => row.ownerUserId))].map((userId) => personRef(userId)) : [],
        stages: TENDERS_STATUS.filter((stage) => tenantTenders.some((row) => row.status === stage)),
      },
      kpis: [
        kpi('active_events', active.length, !canTenders, LINKS.buyerTenders('open'), `${active.length} of ${tenders.length} events in scope`, delta('active_events')),
        kpi('pending_approvals', approvals.length, !canApprovals, LINKS.tasks(), 'Awaiting a decision', delta('pending_approvals')),
        kpi('closing_within_7_days', closingSoon.size, !canTenders, LINKS.buyerTenders('open'), 'Submission deadlines in the next 7 days', delta('closing_within_7_days')),
        kpi('open_complaints', complaints.length, !canComplaints, complaintsLink, 'Complaints not yet resolved', delta('open_complaints')),
        kpi('renewals_within_90_days', renewals.length, !canContracts, LINKS.buyerContracts(), 'Renewal notice windows opening within 90 days', delta('renewals_within_90_days')),
        kpi('overdue_obligations', overdue.length, !canContracts, LINKS.buyerContracts(), 'Contract obligations past due', delta('overdue_obligations')),
      ],
      pipelineValue: canTenders ? sumMoney(withValue, currency) : null,
      pipelineByStage: { restricted: !canTenders, items: canTenders ? pipelineByStage : [] },
      deadlines: {
        restricted: !canTenders,
        items: canTenders
          ? deadlines.slice(0, 8).map((row) => {
              const tender = tenderFact(row.tenderId);
              return {
                tenderId: tender.id,
                reference: tender.reference,
                title: tender.title,
                milestone: row.milestone,
                lotLabel: row.lotLabel,
                deadline: { at: row.at, timeZone: OFFICIAL_TIME_ZONE },
                owner: personRef(tender.ownerUserId),
                to: LINKS.buyerTender(tender.id),
              };
            })
          : [],
      },
      workload: { restricted: !canTenders, items: canTenders ? workload : [] },
      approvals: {
        restricted: !canApprovals,
        items: canApprovals
          ? approvals.map((row) => ({
              approvalId: row.approvalId,
              title: row.title,
              subjectType: row.subjectType,
              amount: row.amount,
              requestedBy: personRef(row.requestedBy),
              requestedAt: row.requestedAt,
              dueAt: row.dueAt,
              overdue: row.dueAt !== null && row.dueAt < REPORTING_AS_OF,
              to: LINKS.approval(row.approvalId),
            }))
          : [],
      },
      renewals: {
        restricted: !canContracts,
        items: canContracts
          ? renewals.map((row) => {
              const contract = contractFact(row.contractId);
              return {
                contractId: contract.id,
                reference: contract.reference,
                title: contract.title,
                supplierName: findTenantById(contract.supplierTenantId)?.legalName ?? '',
                optionType: row.optionType,
                noticeWindowOpensOn: row.noticeWindowOpensOn,
                decisionDueOn: row.decisionDueOn,
                decided: row.decided,
                to: LINKS.buyerContract(contract.id),
              };
            })
          : [],
      },
      attention: DASHBOARD_ATTENTION.filter((row) => row.tenantId === tenant.id && can(row.visibleWith) && inScope(row.tenderId)).map(
        ({ key, label, detail, count, tone, to }) => ({ key, label, detail, count, tone, to }),
      ),
      completeness: {
        complete: missingEstimates.length === 0,
        note:
          missingEstimates.length === 0
            ? null
            : `${missingEstimates.length} event without an estimated value (${missingEstimates.map((row) => row.reference).join(', ')}) is not included in the pipeline value; it is not counted as zero.`,
      },
    };
    return dashboard;
  });

  mockRoute(app, getSupplierDashboard, ({ requireTenant }) => {
    const { tenant, permissions } = requireTenant();
    const can = (codes: readonly PermissionCode[]): boolean => hasAny(permissions, codes);
    const canOpportunities = can(['supplier.opportunities.view']);
    const canQualification = can(['supplier.qualification.apply']);
    const canEvidence = can(['supplier.evidence.manage']);
    const canOutcomes = can(['supplier.outcomes.view']);
    const canContracts = can(['supplier.contract.participate']);
    const own = <T extends { supplierTenantId: number }>(rows: readonly T[]): T[] => rows.filter((row) => row.supplierTenantId === tenant.id);
    const buyerOf = (tenderId: number) => {
      const buyer = findTenantById(tenderFact(tenderId).tenantId);
      return { tenantId: buyer?.id ?? 0, name: buyer?.name ?? '', slug: buyer?.slug ?? '' };
    };
    const delta = (key: SupplierDashboardKpiKey) => SUPPLIER_KPI_DELTAS.find((row) => row.supplierTenantId === tenant.id && row.key === key);
    const horizon = addDays(REPORTING_AS_OF, 7);

    const invitations = own(SUPPLIER_INVITATIONS);
    const pursuits = own(SUPPLIER_PURSUITS);
    const deadlines = own(SUPPLIER_DEADLINES)
      .filter((row) => row.at >= REPORTING_AS_OF)
      .sort((a, b) => a.at.localeCompare(b.at));
    const evidence = own(SUPPLIER_EVIDENCE)
      .map((row) => ({ ...row, daysRemaining: daysBetween(REPORTING_AS_OF_DATE, row.expiresAt) }))
      .filter((row) => row.daysRemaining <= 90)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
    const contractTasks = own(SUPPLIER_CONTRACT_TASKS).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    const openInvitations = invitations.filter((row) => row.invitationStatus === 'invited' || row.invitationStatus === 'accepted');
    const activePursuits = pursuits.filter((row) => row.active && row.decision === 'bid');
    /** SUP-01 lists open work only: pursuits of events that are still active (BR-18 status per row). */
    const activePursuitRows = pursuits.filter((row) => row.active);

    const dashboard: SupplierDashboard = {
      asOf: REPORTING_AS_OF,
      timeZone: tenant.officialTimeZone,
      kpis: [
        kpi('open_invitations', openInvitations.length, !canOpportunities, LINKS.supplierInvitations(), 'Invitations awaiting or accepted', delta('open_invitations')),
        kpi('active_pursuits', activePursuits.length, !canOpportunities, LINKS.supplierOpportunities(), 'Events you decided to bid on', delta('active_pursuits')),
        kpi('submitted_responses', pursuits.filter((row) => row.submissionState === 'submitted').length, !canOpportunities, null, 'Responses with an official receipt', delta('submitted_responses')),
        kpi('deadlines_within_7_days', deadlines.filter((row) => row.at <= horizon).length, !canOpportunities, null, 'Deadlines in the next 7 days', delta('deadlines_within_7_days')),
        kpi('expiring_evidence', evidence.filter((row) => row.daysRemaining <= 30).length, !canEvidence, null, 'Expired or expiring within 30 days', delta('expiring_evidence')),
        kpi(
          'open_contract_tasks',
          contractTasks.filter((row) => !['accepted', 'waived', 'cancelled'].includes(row.status)).length,
          !canContracts,
          null,
          'Obligations and milestones to act on',
          delta('open_contract_tasks'),
        ),
      ],
      invitations: {
        restricted: !canOpportunities,
        items: canOpportunities
          ? invitations.map((row) => {
              const tender = tenderFact(row.tenderId);
              return {
                tenderId: tender.id,
                reference: tender.reference,
                title: tender.title,
                buyer: buyerOf(tender.id),
                invitationStatus: row.invitationStatus,
                closingAt: row.closingAt === null ? null : { at: row.closingAt, timeZone: OFFICIAL_TIME_ZONE },
                to: LINKS.supplierOpportunity(tender.id),
              };
            })
          : [],
      },
      pursuits: {
        restricted: !canOpportunities,
        items: canOpportunities
          ? activePursuitRows.map((row) => {
              const tender = tenderFact(row.tenderId);
              return {
                tenderId: tender.id,
                reference: tender.reference,
                title: tender.title,
                buyer: buyerOf(tender.id),
                decision: row.decision,
                submissionState: row.submissionState,
                latestRevisionStatus: row.latestRevisionStatus,
                bidId: row.bidId,
                effectiveReceiptNo: row.effectiveReceiptNo,
                closingAt: row.closingAt === null ? null : { at: row.closingAt, timeZone: OFFICIAL_TIME_ZONE },
                to: row.bidId === null ? LINKS.supplierOpportunity(tender.id) : LINKS.supplierResponse(row.bidId),
              };
            })
          : [],
      },
      deadlines: {
        restricted: !canOpportunities,
        items: canOpportunities
          ? deadlines.map((row) => {
              const tender = tenderFact(row.tenderId);
              return {
                tenderId: tender.id,
                reference: tender.reference,
                title: tender.title,
                buyerName: buyerOf(tender.id).name,
                milestone: row.milestone,
                deadline: { at: row.at, timeZone: OFFICIAL_TIME_ZONE },
                to: LINKS.supplierOpportunity(tender.id),
              };
            })
          : [],
      },
      qualifications: {
        restricted: !canQualification,
        items: canQualification
          ? own(SUPPLIER_QUALIFICATIONS).map((row) => ({
              programName: row.programName,
              buyerName: findTenantById(row.buyerTenantId)?.name ?? '',
              status: row.status,
              scopeLabel: row.scopeLabel,
              effectiveTo: row.effectiveTo,
              conditions: row.conditions,
              to: LINKS.supplierQualification(),
            }))
          : [],
      },
      expiringEvidence: {
        restricted: !canEvidence,
        items: canEvidence
          ? evidence.map((row) => ({
              evidenceId: row.evidenceId,
              title: row.title,
              evidenceType: row.evidenceType,
              expiresAt: row.expiresAt,
              daysRemaining: row.daysRemaining,
              sharedWith: [...row.sharedWith],
              to: LINKS.supplierEvidence(row.evidenceId),
            }))
          : [],
      },
      outcomes: {
        restricted: !canOutcomes,
        items: canOutcomes
          ? own(SUPPLIER_OUTCOMES).map((row) => {
              const tender = tenderFact(row.tenderId);
              return {
                tenderId: tender.id,
                reference: tender.reference,
                title: tender.title,
                buyerName: buyerOf(tender.id).name,
                lotLabel: row.lotLabel,
                outcome: row.outcome,
                outcomeStatus: row.outcomeStatus,
                successful: row.successful,
                noticeIssuedAt: row.noticeIssuedAt,
                standstillEndsAt: row.standstillEndsAt === null ? null : { at: row.standstillEndsAt, timeZone: OFFICIAL_TIME_ZONE },
                to: LINKS.supplierOutcome(tender.id),
              };
            })
          : [],
      },
      contractTasks: {
        restricted: !canContracts,
        items: canContracts
          ? contractTasks.map((row) => {
              const contract = contractFact(row.contractId);
              return {
                contractId: contract.id,
                contractReference: contract.reference,
                contractTitle: contract.title,
                buyerName: findTenantById(contract.tenantId)?.name ?? '',
                obligationTitle: row.obligationTitle,
                kind: row.kind,
                status: row.status,
                dueOn: row.dueOn,
                to: LINKS.supplierContract(contract.id),
              };
            })
          : [],
      },
    };
    return dashboard;
  });
}
