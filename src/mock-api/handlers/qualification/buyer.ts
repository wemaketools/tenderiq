/**
 * Buyer qualification handlers: programs (ADM-09), review queue (BUY-33), assessment (BUY-34), decisions and
 * monitoring (BUY-35).
 *
 * Every read is filtered to the active buyer tenant; draft applications are invisible (404) and never counted.
 * Commands validate the fixture state and answer with the declared business error or a static result
 * describing the outcome (new ids from 900). Nothing is persisted.
 */
import {
  approveProgramVersion,
  assessTrigger,
  assignApplication,
  checkEligibility,
  closeInfoRequest,
  createProgram,
  createProgramVersion,
  createTrigger,
  decideApplication,
  getApplication,
  getDecision,
  getFinancialReview,
  getProgram,
  getQualificationOptions,
  getQualificationSummary,
  getTrigger,
  listApplications,
  listDecisions,
  listPrograms,
  listScreenings,
  listStatuses,
  listTriggers,
  recommendOutcome,
  recordFinancialReview,
  recordFinding,
  requestInformation,
  requestRenewal,
  retireProgram,
  reviewScreening,
  saveProgramCriteria,
  supersedeDecision,
  updateProgram,
} from '../../../contracts/qualification.js';
import { BuyerApplicationStatus } from '../../../contracts/qualification.js';
import type { ProgramDetail } from '../../../contracts/qualification.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import type { FxApplication, FxDecision, FxProgram } from '../../fixtures/qualification/index.js';
import {
  INTEGRITY_SCREENINGS,
  QUALIFICATION_APPLICATIONS,
  QUALIFICATION_CATEGORIES,
  QUALIFICATION_CONFLICTS,
  QUALIFICATION_DECISIONS,
  QUALIFICATION_FINDINGS,
  QUALIFICATION_INFO_REQUESTS,
  QUALIFICATION_PROGRAMS,
  QUALIFICATION_RELATIONSHIPS,
  REASSESSMENT_TRIGGERS,
  RECONSIDERATION_WINDOW_DAYS,
  activityOf,
  categoryWithDescendants,
  criteriaOf,
  findCategory,
  versionsOf,
} from '../../fixtures/qualification/index.js';
import {
  PRIORITY_RANK,
  RISK_RANK,
  answersOf,
  areaCounts,
  buyerApplicationDetail,
  buyerApplicationRow,
  categoryRef,
  currentDecisionFor,
  currentDecisions,
  decisionDetail,
  decisionRoles,
  decisionRow,
  effectiveStatusOf,
  evidenceMissing,
  financialReviewRow,
  financialReviewsOf,
  findingRow,
  infoRequestRow,
  infoRequestsOf,
  isAssessable,
  hasOpenReconsideration,
  isOpenApplication,
  matchesText,
  membersWith,
  programDetail,
  programRow,
  renewalApplicationOf,
  scopeFitsProgram,
  screeningRow,
  sortBy,
  statusRows,
  supplierRef,
  triggerRow,
  unreviewedFlags,
  viewContext,
  withinDates,
  evidenceSnapshot,
  criterionRow,
  hasPermission,
} from './views.js';
import type { ViewContext } from './views.js';
import { personRef } from '../../persona.js';

const NEW_ID = 900;

const APPLICATION_PHRASE: Partial<Record<FxApplication['status'], string>> = {
  submitted: 'awaiting assignment',
  under_review: 'under review',
  more_info_required: 'awaiting more information from the supplier',
  decision_pending: 'awaiting a decision',
};

function isVisibleApplication(application: FxApplication, tenantId: number): boolean {
  return application.tenantId === tenantId && application.status !== 'draft';
}

function programOf(application: FxApplication): FxProgram {
  const program = QUALIFICATION_PROGRAMS.find((candidate) =>
    versionsOf(candidate.id).some((entry) => entry.id === application.programVersionId),
  );
  if (program === undefined) {
    throw new Error(`No program for application ${application.id}.`);
  }
  return program;
}

export function registerBuyer(app: MockApp): void {
  // -------------------------------------------------------------------------------------------------------
  // Summary and options
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, getQualificationSummary, ({ requireTenant, now }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const applications = QUALIFICATION_APPLICATIONS.filter((application) => isVisibleApplication(application, tenant.id));
    const decisions = currentDecisions(tenant.id, context);
    const horizon = new Date(now.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
    return {
      byStatus: BuyerApplicationStatus.options.map((status) => ({
        status,
        count: applications.filter((application) => application.status === status).length,
      })),
      unassigned: applications.filter(
        (application) => isOpenApplication(application) && application.assessorUserId === null,
      ).length,
      overdue: applications.filter(
        (application) =>
          isOpenApplication(application) && application.dueAt !== null && application.dueAt < now.toISOString(),
      ).length,
      highRisk: applications.filter((application) => isOpenApplication(application) && application.riskLevel === 'high')
        .length,
      openInfoRequests: QUALIFICATION_INFO_REQUESTS.filter(
        (request) => request.tenantId === tenant.id && request.status === 'open',
      ).length,
      renewalsInQueue: applications.filter(
        (application) => isOpenApplication(application) && application.renewalOfDecisionId !== null,
      ).length,
      decisionsExpiringIn90Days: decisions.filter(
        (entry) =>
          entry.effectiveStatus !== 'expired' &&
          entry.decision.effectiveTo !== null &&
          entry.decision.effectiveTo <= horizon,
      ).length,
      expiredDecisions: decisions.filter((entry) => entry.effectiveStatus === 'expired').length,
      openTriggers: REASSESSMENT_TRIGGERS.filter((trigger) => trigger.tenantId === tenant.id && trigger.status === 'open')
        .length,
      unreviewedScreeningFlags: INTEGRITY_SCREENINGS.filter(
        (screening) => screening.tenantId === tenant.id && screening.result !== 'no_match' && screening.reviewedAt === null,
      ).length,
      openReconsiderations: QUALIFICATION_DECISIONS.filter(
        (decision) => decision.tenantId === tenant.id && hasOpenReconsideration(decision),
      ).length,
      asOf: now.toISOString(),
    };
  });

  mockRoute(app, getQualificationOptions, ({ requireTenant }) => {
    const { tenant } = requireTenant();
    const workload = (userId: number, field: 'assessorUserId' | 'financialReviewerUserId'): number =>
      QUALIFICATION_APPLICATIONS.filter(
        (application) =>
          application.tenantId === tenant.id && isOpenApplication(application) && application[field] === userId,
      ).length;
    const decided = (userId: number): number =>
      QUALIFICATION_APPLICATIONS.filter(
        (application) => application.tenantId === tenant.id && application.status === 'decision_pending',
      ).length * (hasPermission(tenant.id, userId, 'qualification.decide') ? 1 : 0);
    return {
      categories: QUALIFICATION_CATEGORIES.filter((category) => category.tenantId === tenant.id).map((category) =>
        categoryRef(category.id),
      ),
      assessors: membersWith(tenant.id, 'qualification.review').map((member) => ({
        ...member,
        openAssignments: workload(member.userId, 'assessorUserId'),
      })),
      financialReviewers: membersWith(tenant.id, 'qualification.financial_review').map((member) => ({
        ...member,
        openAssignments: workload(member.userId, 'financialReviewerUserId'),
      })),
      deciders: membersWith(tenant.id, 'qualification.decide').map((member) => ({
        ...member,
        openAssignments: decided(member.userId),
      })),
      programOwners: membersWith(tenant.id, 'qualification.program.manage').map(({ userId, fullName }) => ({
        userId,
        fullName,
      })),
      decisionRoles: decisionRoles(),
      currencies: tenant.defaultCurrency === null ? ['BWP'] : [tenant.defaultCurrency],
      officialTimeZone: tenant.officialTimeZone,
    };
  });

  // -------------------------------------------------------------------------------------------------------
  // Programs (ADM-09)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, listPrograms, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const rows = QUALIFICATION_PROGRAMS.filter((program) => program.tenantId === tenant.id)
      .filter((program) => query.status === undefined || query.status.includes(program.status))
      .filter(
        (program) =>
          query.categoryId === undefined ||
          categoryWithDescendants(program.categoryId).some((category) => category.id === query.categoryId),
      )
      .filter((program) => query.ownerUserId === undefined || program.ownerUserId === query.ownerUserId)
      .filter((program) => withinDates(program.updatedAt, query.updatedFrom, query.updatedTo))
      .map((program) => programRow(program, context))
      .filter((row) => matchesText(query.q, row.name, row.category.code, row.category.name, row.geography));
    const sorted =
      query.sort === undefined
        ? sortBy(rows, (row) => row.name, 'asc')
        : sortBy(
            rows,
            (row) =>
              query.sort === 'status'
                ? row.status
                : query.sort === 'updatedAt'
                  ? row.updatedAt
                  : query.sort === 'openApplicationCount'
                    ? row.openApplicationCount
                    : row.name,
            query.dir,
          );
    return fixtures.page(sorted);
  });

  function programOrNotFound(tenantId: number, programId: number, notFound: (detail?: string) => never): FxProgram {
    const program = QUALIFICATION_PROGRAMS.find((candidate) => candidate.id === programId && candidate.tenantId === tenantId);
    return program ?? notFound('No such qualification program.');
  }

  mockRoute(app, getProgram, ({ requireTenant, params, query, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const program = programOrNotFound(tenant.id, params.programId, notFound);
    if (query.versionId !== undefined && !versionsOf(program.id).some((version) => version.id === query.versionId)) {
      fail(404, 'PROGRAM_VERSION_NOT_FOUND', 'This version does not belong to the program.');
    }
    return programDetail(program, viewContext(now, tenant.officialTimeZone), query.versionId ?? null);
  });

  function checkProgramFields(
    tenantId: number,
    fields: {
      name?: string | undefined;
      categoryId?: number | undefined;
      ownerUserId?: number | undefined;
      decisionRoleCode?: string | undefined;
    },
    excludeProgramId: number | null,
    fail: (status: number, code: string, detail?: string) => never,
  ): void {
    if (
      fields.name !== undefined &&
      QUALIFICATION_PROGRAMS.some(
        (program) =>
          program.tenantId === tenantId &&
          program.id !== excludeProgramId &&
          program.name.toLowerCase() === fields.name?.toLowerCase(),
      )
    ) {
      fail(409, 'PROGRAM_NAME_DUPLICATE', 'A program with this name already exists.');
    }
    if (fields.categoryId !== undefined && findCategory(tenantId, fields.categoryId) === undefined) {
      fail(422, 'CATEGORY_NOT_FOUND', 'The category is not one of this organization’s categories.');
    }
    if (fields.ownerUserId !== undefined && !hasPermission(tenantId, fields.ownerUserId, 'qualification.program.manage')) {
      fail(422, 'OWNER_NOT_ELIGIBLE', 'The owner must be able to manage qualification programs.');
    }
    if (fields.decisionRoleCode !== undefined && !decisionRoles().some((role) => role.code === fields.decisionRoleCode)) {
      fail(422, 'DECISION_ROLE_UNKNOWN', 'The deciding role must hold the qualification decision permission.');
    }
  }

  mockRoute(app, createProgram, ({ requireTenant, body, now, fail }) => {
    const { tenant } = requireTenant();
    checkProgramFields(tenant.id, body, null, fail);
    const context = viewContext(now, tenant.officialTimeZone);
    const created = now.toISOString();
    const program: FxProgram = {
      id: NEW_ID,
      tenantId: tenant.id,
      name: body.name,
      description: body.description ?? '',
      categoryId: body.categoryId,
      geography: body.geography,
      maxContractValue: body.maxContractValue,
      validityMonths: body.validityMonths,
      renewalNoticeDays: body.renewalNoticeDays,
      reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
      decisionRoleCode: body.decisionRoleCode,
      requiresIndependentApproval: body.requiresIndependentApproval,
      status: 'draft',
      currentVersionId: null,
      ownerUserId: body.ownerUserId,
      monitoredTriggerTypes: body.monitoredTriggerTypes,
      createdAt: created,
      updatedAt: created,
    };
    const detail = programDetail(program, context, null);
    return {
      ...detail,
      description: body.description,
      versions: [
        {
          id: NEW_ID,
          programId: NEW_ID,
          versionNo: 1,
          status: 'draft',
          changeNote: 'Initial criteria.',
          approvedBy: null,
          approvedAt: null,
          createdAt: created,
          criteriaCount: 0,
          mandatoryCount: 0,
          applicationCount: 0,
        },
      ],
      draftVersionNo: 1,
      shownVersionId: NEW_ID,
    };
  });

  mockRoute(app, updateProgram, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const program = programOrNotFound(tenant.id, params.programId, notFound);
    if (program.status === 'retired') {
      fail(409, 'PROGRAM_RETIRED', 'A retired program cannot be changed.');
    }
    checkProgramFields(tenant.id, body, program.id, fail);
    const updated: FxProgram = {
      ...program,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.description === undefined ? {} : { description: body.description ?? '' }),
      ...(body.categoryId === undefined ? {} : { categoryId: body.categoryId }),
      ...(body.geography === undefined ? {} : { geography: body.geography }),
      ...(body.maxContractValue === undefined ? {} : { maxContractValue: body.maxContractValue }),
      ...(body.validityMonths === undefined ? {} : { validityMonths: body.validityMonths }),
      ...(body.renewalNoticeDays === undefined ? {} : { renewalNoticeDays: body.renewalNoticeDays }),
      ...(body.decisionRoleCode === undefined ? {} : { decisionRoleCode: body.decisionRoleCode }),
      ...(body.requiresIndependentApproval === undefined
        ? {}
        : { requiresIndependentApproval: body.requiresIndependentApproval }),
      ...(body.ownerUserId === undefined ? {} : { ownerUserId: body.ownerUserId }),
      ...(body.monitoredTriggerTypes === undefined ? {} : { monitoredTriggerTypes: body.monitoredTriggerTypes }),
      updatedAt: now.toISOString(),
    };
    const detail = programDetail(updated, viewContext(now, tenant.officialTimeZone), null);
    return body.description === null ? { ...detail, description: null } : detail;
  });

  mockRoute(app, createProgramVersion, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const program = programOrNotFound(tenant.id, params.programId, notFound);
    if (program.status === 'retired') {
      fail(409, 'PROGRAM_RETIRED', 'A retired program cannot be revised.');
    }
    const versions = versionsOf(program.id);
    if (versions.some((version) => version.status === 'draft')) {
      fail(409, 'DRAFT_VERSION_EXISTS', 'Finish or approve the existing draft revision first.');
    }
    const sourceId = body.copyFromVersionId ?? program.currentVersionId;
    if (sourceId === null || !versions.some((version) => version.id === sourceId)) {
      return fail(404, 'PROGRAM_VERSION_NOT_FOUND', 'The version to copy does not belong to this program.');
    }
    const context = viewContext(now, tenant.officialTimeZone);
    const detail = programDetail(program, context, sourceId);
    const nextNo = Math.max(...versions.map((version) => version.versionNo)) + 1;
    const copied = criteriaOf(sourceId).map((criterion, index) => ({
      ...criterionRow(criterion),
      id: NEW_ID * 100 + index + 1,
      programVersionId: NEW_ID,
    }));
    return {
      ...detail,
      draftVersionNo: nextNo,
      versions: [
        {
          id: NEW_ID,
          programId: program.id,
          versionNo: nextNo,
          status: 'draft',
          changeNote: body.changeNote,
          approvedBy: null,
          approvedAt: null,
          createdAt: now.toISOString(),
          criteriaCount: copied.length,
          mandatoryCount: copied.filter((criterion) => criterion.mandatory).length,
          applicationCount: 0,
        },
        ...detail.versions,
      ],
      shownVersionId: NEW_ID,
      criteria: copied,
    };
  });

  function versionOrNotFound(programId: number, versionId: number, fail: (s: number, c: string, d?: string) => never) {
    const version = versionsOf(programId).find((candidate) => candidate.id === versionId);
    return version ?? fail(404, 'PROGRAM_VERSION_NOT_FOUND', 'This version does not belong to the program.');
  }

  mockRoute(app, saveProgramCriteria, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const program = programOrNotFound(tenant.id, params.programId, notFound);
    const version = versionOrNotFound(program.id, params.versionId, fail);
    if (version.status !== 'draft') {
      fail(409, 'VERSION_NOT_DRAFT', 'Approved and retired versions are never edited; open a new revision.');
    }
    const detail: ProgramDetail = programDetail(program, viewContext(now, tenant.officialTimeZone), version.id);
    const criteria = body.criteria.map((criterion, index) => ({
      ...criterion,
      id: version.id * 100 + index + 1,
      programVersionId: version.id,
    }));
    return {
      ...detail,
      criteria,
      areaCounts: areaCounts(criteria),
      versions: detail.versions.map((entry) =>
        entry.id === version.id
          ? {
              ...entry,
              criteriaCount: criteria.length,
              mandatoryCount: criteria.filter((criterion) => criterion.mandatory).length,
            }
          : entry,
      ),
    };
  });

  mockRoute(app, approveProgramVersion, ({ requireTenant, params, persona, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const program = programOrNotFound(tenant.id, params.programId, notFound);
    const version = versionOrNotFound(program.id, params.versionId, fail);
    if (version.status !== 'draft') {
      fail(409, 'VERSION_NOT_DRAFT', 'Only a draft version can be approved.');
    }
    const criteria = criteriaOf(version.id);
    const missing = (['corporate', 'financial', 'integrity'] as const).filter(
      (area) => !criteria.some((criterion) => criterion.area === area && criterion.mandatory),
    );
    if (missing.length > 0) {
      fail(422, 'MANDATORY_AREA_MISSING', `Add a mandatory criterion for: ${missing.join(', ')}.`);
    }
    const approvedAt = now.toISOString();
    const approver = persona === null ? null : personRef(persona.userId);
    const updated: FxProgram = { ...program, status: 'active', currentVersionId: version.id, updatedAt: approvedAt };
    const detail = programDetail(updated, viewContext(now, tenant.officialTimeZone), version.id);
    return {
      ...detail,
      currentVersion: { id: version.id, versionNo: version.versionNo, status: 'approved', approvedAt },
      draftVersionNo: null,
      versions: detail.versions.map((entry) =>
        entry.id === version.id
          ? { ...entry, status: 'approved' as const, approvedBy: approver, approvedAt }
          : entry.status === 'approved'
            ? { ...entry, status: 'retired' as const }
            : entry,
      ),
    };
  });

  mockRoute(app, retireProgram, ({ requireTenant, params, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const program = programOrNotFound(tenant.id, params.programId, notFound);
    if (program.status === 'retired') {
      fail(409, 'PROGRAM_RETIRED', 'The program is already retired.');
    }
    const versionIds = versionsOf(program.id).map((version) => version.id);
    const open = QUALIFICATION_APPLICATIONS.filter(
      (application) =>
        application.tenantId === tenant.id &&
        versionIds.includes(application.programVersionId) &&
        isOpenApplication(application),
    );
    if (open.length > 0) {
      fail(
        409,
        'PROGRAM_HAS_OPEN_APPLICATIONS',
        `Decide or close ${open.length} open application(s) first: ${open.map((a) => a.reference).join(', ')}.`,
      );
    }
    const updated: FxProgram = { ...program, status: 'retired', updatedAt: now.toISOString() };
    return programDetail(updated, viewContext(now, tenant.officialTimeZone), null);
  });

  // -------------------------------------------------------------------------------------------------------
  // Review queue and assessment (BUY-33, BUY-34)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, listApplications, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const rows = QUALIFICATION_APPLICATIONS.filter((application) => isVisibleApplication(application, tenant.id))
      .filter((application) => query.programId === undefined || programOf(application).id === query.programId)
      .filter(
        (application) =>
          query.categoryId === undefined ||
          categoryWithDescendants(query.categoryId).some((category) => category.id === application.scopeCategoryId),
      )
      .filter(
        (application) =>
          query.assessorUserId === undefined || application.assessorUserId === query.assessorUserId,
      )
      .filter(
        (application) =>
          query.financialReviewerUserId === undefined ||
          application.financialReviewerUserId === query.financialReviewerUserId,
      )
      .filter((application) => query.unassigned !== true || application.assessorUserId === null)
      .filter(
        (application) =>
          query.renewal === undefined || (application.renewalOfDecisionId !== null) === query.renewal,
      )
      .map((application) => buyerApplicationRow(application, context))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.riskLevel === undefined || (row.riskLevel !== null && query.riskLevel.includes(row.riskLevel)))
      .filter((row) => query.priority === undefined || query.priority.includes(row.priority))
      .filter((row) => query.overdue === undefined || row.overdue === query.overdue)
      .filter((row) => withinDates(row.submittedAt, query.submittedFrom, query.submittedTo))
      .filter((row) => withinDates(row.dueAt?.at ?? null, query.dueFrom, query.dueTo))
      .filter((row) =>
        matchesText(query.q, row.reference, row.supplier.name, row.supplier.legalName, row.program.programName, row.scopeCategory.code),
      );
    const key = (row: (typeof rows)[number]): string | number | null => {
      switch (query.sort) {
        case 'reference':
          return row.reference;
        case 'supplierName':
          return row.supplier.name;
        case 'dueAt':
          return row.dueAt?.at ?? null;
        case 'priority':
          return PRIORITY_RANK[row.priority] ?? 0;
        case 'riskLevel':
          return row.riskLevel === null ? null : (RISK_RANK[row.riskLevel] ?? 0);
        case 'status':
          return row.status;
        default:
          return row.submittedAt;
      }
    };
    return fixtures.page(sortBy(rows, key, query.sort === undefined ? 'desc' : query.dir));
  });

  function applicationOrNotFound(tenantId: number, applicationId: number, notFound: (detail?: string) => never) {
    const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.id === applicationId);
    if (application === undefined || !isVisibleApplication(application, tenantId)) {
      return notFound('No such qualification application.');
    }
    return application;
  }

  mockRoute(app, getApplication, ({ requireTenant, requirePersona, params, now, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    return buyerApplicationDetail(
      application,
      viewContext(now, tenant.officialTimeZone),
      permissions,
      requirePersona().userId,
    );
  });

  mockRoute(app, assignApplication, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    if (!(application.status === 'submitted' || isAssessable(application))) {
      fail(409, 'APPLICATION_NOT_ASSIGNABLE', `An application in status ${application.status} cannot be reassigned.`);
    }
    if (!hasPermission(tenant.id, body.assessorUserId, 'qualification.review')) {
      fail(422, 'ASSESSOR_NOT_ELIGIBLE', 'The assessor must hold the qualification review permission.');
    }
    if (
      body.financialReviewerUserId !== null &&
      !hasPermission(tenant.id, body.financialReviewerUserId, 'qualification.financial_review')
    ) {
      fail(422, 'FINANCIAL_REVIEWER_NOT_ELIGIBLE', 'The financial reviewer must hold the financial review permission.');
    }
    const hasFinancialCriteria = criteriaOf(application.programVersionId).some((criterion) => criterion.area === 'financial');
    if (body.riskLevel === 'high' && hasFinancialCriteria && body.financialReviewerUserId === null) {
      fail(422, 'FINANCIAL_REVIEWER_REQUIRED', 'High-risk applications need a specialist financial reviewer.');
    }
    const conflicted = [body.assessorUserId, body.financialReviewerUserId].find((userId) =>
      QUALIFICATION_CONFLICTS.some(
        (conflict) =>
          conflict.tenantId === tenant.id &&
          conflict.userId === userId &&
          conflict.supplierTenantId === application.supplierTenantId,
      ),
    );
    if (conflicted !== undefined && conflicted !== null) {
      fail(409, 'ASSIGNEE_CONFLICT_DECLARED', `${personRef(conflicted).fullName} has declared a conflict with this supplier.`);
    }
    if (body.dueAt <= now.toISOString()) {
      fail(422, 'DUE_DATE_IN_PAST', 'The due date must be in the future.');
    }
    const assigned: FxApplication = {
      ...application,
      assessorUserId: body.assessorUserId,
      financialReviewerUserId: body.financialReviewerUserId,
      dueAt: body.dueAt,
      priority: body.priority,
      riskLevel: body.riskLevel,
      status: application.status === 'submitted' ? 'under_review' : application.status,
      updatedAt: now.toISOString(),
    };
    return buyerApplicationRow(assigned, viewContext(now, tenant.officialTimeZone));
  });

  mockRoute(app, getFinancialReview, ({ requireTenant, requirePersona, params, now, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    const context = viewContext(now, tenant.officialTimeZone);
    const criteria = criteriaOf(application.programVersionId).filter((criterion) => criterion.area === 'financial');
    const criterionIds = criteria.map((criterion) => criterion.id);
    const answers = answersOf(application.id).filter((answer) => criterionIds.includes(answer.criterionId));
    return {
      applicationId: application.id,
      reference: application.reference ?? '',
      supplier: supplierRef(application.supplierTenantId),
      financialReviewer:
        application.financialReviewerUserId === null ? null : personRef(application.financialReviewerUserId),
      financialCriteria: criteria.map(criterionRow),
      financialEvidence: answers.flatMap((answer) => answer.evidence.map((citation) => evidenceSnapshot(citation, context))),
      reviews: financialReviewsOf(application.id).map(financialReviewRow),
      infoRequests: infoRequestsOf(application.id)
        .filter((request) => request.criterionId !== null && criterionIds.includes(request.criterionId))
        .map((request) => infoRequestRow(request, context)),
      canRecord:
        permissions.includes('qualification.financial_review') &&
        application.financialReviewerUserId === requirePersona().userId &&
        isAssessable(application),
    };
  });

  mockRoute(app, recordFinancialReview, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    const caller = requirePersona();
    if (!isAssessable(application)) {
      fail(409, 'APPLICATION_NOT_UNDER_REVIEW', 'Financial reviews are recorded while the application is under review.');
    }
    if (application.financialReviewerUserId !== caller.userId) {
      fail(403, 'NOT_ASSIGNED_FINANCIAL_REVIEWER', 'Only the assigned financial reviewer records this review.');
    }
    const context = viewContext(now, tenant.officialTimeZone);
    if (body.financialPeriodEnd > context.today) {
      fail(422, 'FINANCIAL_PERIOD_IN_FUTURE', 'The financial period cannot end in the future.');
    }
    if (
      body.isConsolidated &&
      (body.parentSupportEvidence ?? '').trim() === '' &&
      (body.conclusion === 'adequate' || body.conclusion === 'adequate_with_limitations')
    ) {
      fail(
        422,
        'PARENT_SUPPORT_REQUIRED',
        'Consolidated group figures cannot qualify a subsidiary without the parent support the program requires.',
      );
    }
    return {
      id: NEW_ID,
      applicationId: application.id,
      reviewer: personRef(caller.userId),
      financialPeriodEnd: body.financialPeriodEnd,
      reportingCurrency: body.reportingCurrency,
      isConsolidated: body.isConsolidated,
      source: body.source,
      turnover: body.turnover,
      currentRatio: body.currentRatio,
      debtToEquity: body.debtToEquity,
      parentSupportEvidence: body.parentSupportEvidence,
      materialQualifications: body.materialQualifications,
      conclusion: body.conclusion,
      rationale: body.rationale,
      reviewedAt: now.toISOString(),
    };
  });

  mockRoute(app, recordFinding, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant, permissions } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    const caller = requirePersona();
    if (!isAssessable(application)) {
      fail(409, 'APPLICATION_NOT_UNDER_REVIEW', 'Findings are recorded while the application is under review.');
    }
    const criterion = criteriaOf(application.programVersionId).find((candidate) => candidate.id === params.criterionId);
    if (criterion === undefined) {
      return fail(422, 'CRITERION_NOT_IN_VERSION', 'The criterion is not part of the version this application uses.');
    }
    if (!permissions.includes('qualification.review') && criterion.area !== 'financial') {
      fail(403, 'FINDING_OUTSIDE_ASSIGNMENT', 'Financial reviewers record findings on financial criteria only.');
    }
    if (application.assessorUserId !== caller.userId && application.financialReviewerUserId !== caller.userId) {
      fail(403, 'NOT_ASSIGNED_ASSESSOR', 'Only the assigned assessor or financial reviewer records findings.');
    }
    const answer = answersOf(application.id).find((candidate) => candidate.criterionId === criterion.id);
    if (body.finding === 'meets' && (answer === undefined || evidenceMissing(criterion, answer))) {
      fail(422, 'MISSING_EVIDENCE_NOT_A_PASS', 'Mandatory evidence is missing: the criterion cannot be recorded as met.');
    }
    if (body.finding === 'not_applicable' && answer?.applicability !== 'not_applicable') {
      fail(422, 'NA_NOT_DECLARED', 'The supplier did not declare this criterion not applicable.');
    }
    const existing = QUALIFICATION_FINDINGS.find(
      (finding) => finding.applicationId === application.id && finding.criterionId === criterion.id,
    );
    return findingRow({
      id: existing?.id ?? NEW_ID,
      tenantId: tenant.id,
      applicationId: application.id,
      criterionId: criterion.id,
      assessorUserId: caller.userId,
      finding: body.finding,
      rationale: body.rationale,
      evidenceRefs: body.evidenceRefs,
      flagOnly: false,
      recordedAt: now.toISOString(),
    });
  });

  mockRoute(app, requestInformation, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    const caller = requirePersona();
    if (!isAssessable(application)) {
      fail(409, 'APPLICATION_NOT_UNDER_REVIEW', 'Information is requested while the application is under review.');
    }
    if (application.assessorUserId !== caller.userId && application.financialReviewerUserId !== caller.userId) {
      fail(403, 'NOT_ASSIGNED_ASSESSOR', 'Only the assigned assessor or financial reviewer asks the supplier.');
    }
    if (
      body.criterionId !== null &&
      !criteriaOf(application.programVersionId).some((criterion) => criterion.id === body.criterionId)
    ) {
      fail(422, 'CRITERION_NOT_IN_VERSION', 'The criterion is not part of the version this application uses.');
    }
    if (body.dueAt <= now.toISOString()) {
      fail(422, 'DUE_DATE_IN_PAST', 'The due date must be in the future.');
    }
    return {
      infoRequest: infoRequestRow(
        {
          id: NEW_ID,
          tenantId: tenant.id,
          applicationId: application.id,
          criterionId: body.criterionId,
          question: body.question,
          requestedByUserId: caller.userId,
          requestedAt: now.toISOString(),
          dueAt: body.dueAt,
          status: 'open',
          responseText: null,
          respondedByUserId: null,
          respondedAt: null,
          responseEvidence: [],
        },
        viewContext(now, tenant.officialTimeZone),
      ),
      applicationStatus: 'more_info_required',
    };
  });

  mockRoute(app, closeInfoRequest, ({ requireTenant, params, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    const request = infoRequestsOf(application.id).find((candidate) => candidate.id === params.infoRequestId);
    if (request === undefined) {
      return fail(404, 'INFO_REQUEST_NOT_FOUND', 'No such information request on this application.');
    }
    if (request.status === 'closed') {
      fail(409, 'INFO_REQUEST_CLOSED', 'The information request is already closed.');
    }
    const stillOpen = infoRequestsOf(application.id).some(
      (candidate) => candidate.id !== request.id && candidate.status === 'open',
    );
    return {
      infoRequest: infoRequestRow({ ...request, status: 'closed' }, viewContext(now, tenant.officialTimeZone)),
      applicationStatus: stillOpen ? 'more_info_required' : 'under_review',
    };
  });

  mockRoute(app, recommendOutcome, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    const caller = requirePersona();
    if (application.assessorUserId !== caller.userId) {
      fail(403, 'NOT_ASSIGNED_ASSESSOR', 'Only the assigned assessor recommends an outcome.');
    }
    if (application.status !== 'under_review') {
      fail(409, 'APPLICATION_NOT_UNDER_REVIEW', `An application in status ${application.status} cannot be recommended.`);
    }
    if (infoRequestsOf(application.id).some((request) => request.status === 'open')) {
      fail(409, 'OPEN_INFO_REQUESTS', 'Close or receive answers to open information requests first.');
    }
    if (application.financialReviewerUserId !== null && financialReviewsOf(application.id).length === 0) {
      fail(409, 'FINANCIAL_REVIEW_REQUIRED', 'The assigned financial reviewer has not recorded a review yet.');
    }
    const criteria = criteriaOf(application.programVersionId);
    const findings = QUALIFICATION_FINDINGS.filter((finding) => finding.applicationId === application.id);
    const answers = answersOf(application.id);
    const incomplete = criteria.filter(
      (criterion) =>
        !findings.some((finding) => finding.criterionId === criterion.id) &&
        (criterion.mandatory || answers.some((answer) => answer.criterionId === criterion.id)),
    );
    if (incomplete.length > 0) {
      fail(409, 'FINDINGS_INCOMPLETE', `${incomplete.length} criteria have no finding yet.`);
    }
    if (unreviewedFlags(tenant.id, application.supplierTenantId).length > 0) {
      fail(409, 'SCREENING_UNREVIEWED', 'A screening match must be reviewed by a person before recommending (BR-48).');
    }
    const program = programOf(application);
    const fit = scopeFitsProgram(program, body.scopeCategoryId, body.scopeMaxValue);
    if (!fit.categoryCovered || !fit.valueWithin || findCategory(tenant.id, body.scopeCategoryId) === undefined) {
      fail(422, 'SCOPE_EXCEEDS_PROGRAM', 'The proposed scope is outside the program’s category or value limit.');
    }
    return {
      applicationId: application.id,
      status: 'decision_pending',
      recommendation: {
        proposedOutcome: body.proposedOutcome,
        scopeCategory: categoryRef(body.scopeCategoryId),
        scopeMaxValue: body.scopeMaxValue,
        scopeGeography: body.scopeGeography,
        conditions: body.conditions,
        allowedActivities: body.allowedActivities,
        blockedGate: body.blockedGate,
        rationale: body.rationale,
        recommendedBy: personRef(caller.userId),
        recommendedAt: now.toISOString(),
        approvalRequestId: null,
        approvalStatus: null,
      },
    };
  });

  function newDecisionDetail(
    base: FxDecision,
    context: ViewContext,
  ): ReturnType<typeof decisionDetail> {
    const detail = decisionDetail(base, context, true);
    return { ...detail, history: [historyEntry(base, context), ...detail.history.filter((entry) => entry.id !== base.id)] };
  }

  function historyEntry(decision: FxDecision, context: ViewContext): ReturnType<typeof decisionDetail>['history'][number] {
    const row = decisionRow(decision, context);
    return {
      id: row.id,
      outcome: row.outcome,
      effectiveStatus: row.effectiveStatus,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      decidedAt: row.decidedAt,
      supersededById: row.supersededById,
      supersedeReason: row.supersedeReason,
      program: row.program,
    };
  }

  mockRoute(app, decideApplication, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = applicationOrNotFound(tenant.id, params.applicationId, notFound);
    const caller = requirePersona();
    if (application.status !== 'decision_pending') {
      fail(409, 'APPLICATION_NOT_DECISION_PENDING', `An application in status ${application.status} cannot be decided.`);
    }
    const program = programOf(application);
    if (program.requiresIndependentApproval && application.assessorUserId === caller.userId) {
      fail(403, 'SELF_APPROVAL_BLOCKED', 'The assessor cannot also decide: this program requires independent approval.');
    }
    if (findCategory(tenant.id, body.scopeCategoryId) === undefined) {
      fail(422, 'CATEGORY_NOT_FOUND', 'The scope category is not one of this organization’s categories.');
    }
    const fit = scopeFitsProgram(program, body.scopeCategoryId, body.scopeMaxValue);
    if (!fit.categoryCovered || !fit.valueWithin) {
      fail(422, 'SCOPE_EXCEEDS_PROGRAM', 'The decided scope is outside the program’s category or value limit.');
    }
    const decidedAt = now.toISOString();
    const decision: FxDecision = {
      id: NEW_ID,
      tenantId: tenant.id,
      supplierTenantId: application.supplierTenantId,
      applicationId: application.id,
      programVersionId: application.programVersionId,
      outcome: body.outcome,
      scopeCategoryId: body.scopeCategoryId,
      scopeMaxValue: body.scopeMaxValue,
      scopeGeography: body.scopeGeography,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      reassessmentDate: body.reassessmentDate,
      conditions: body.conditions,
      allowedActivities: body.allowedActivities,
      blockedGate: body.blockedGate,
      reasons: body.reasons,
      supplierExplanation: body.supplierExplanation,
      appealRoute: body.appealRoute,
      reviewerUserId: application.assessorUserId,
      approverUserId: caller.userId,
      approvalRequestId: null,
      decidedAt,
      supersededById: null,
      supersedeReason: null,
      supplierNotifiedAt: body.notifySupplier ? decidedAt : null,
      renewalRequestedAt: null,
    };
    return newDecisionDetail(decision, viewContext(now, tenant.officialTimeZone));
  });

  // -------------------------------------------------------------------------------------------------------
  // Screenings
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, listScreenings, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = INTEGRITY_SCREENINGS.filter((screening) => screening.tenantId === tenant.id)
      .filter((screening) => query.supplierTenantId === undefined || screening.supplierTenantId === query.supplierTenantId)
      .filter((screening) => query.result === undefined || query.result.includes(screening.result))
      .filter((screening) => query.checkType === undefined || query.checkType.includes(screening.checkType))
      .filter(
        (screening) =>
          query.unreviewed !== true || (screening.result !== 'no_match' && screening.reviewedAt === null),
      )
      .map(screeningRow)
      .filter((row) => matchesText(query.q, row.supplier.name, row.source, row.matchDetail));
    const key = (row: (typeof rows)[number]): string =>
      query.sort === 'supplierName' ? row.supplier.name : query.sort === 'result' ? row.result : row.checkedAt;
    return fixtures.page(sortBy(rows, key, query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, reviewScreening, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const screening = INTEGRITY_SCREENINGS.find(
      (candidate) => candidate.id === params.screeningId && candidate.tenantId === tenant.id,
    );
    if (screening === undefined) {
      return notFound('No such screening.');
    }
    if (screening.reviewedAt !== null) {
      fail(409, 'SCREENING_ALREADY_REVIEWED', 'This screening result was already reviewed.');
    }
    return screeningRow({
      ...screening,
      reviewedByUserId: requirePersona().userId,
      reviewedAt: now.toISOString(),
      disposition: body.disposition,
      effect: body.raiseTrigger ? `${body.effect} A reassessment trigger was raised.` : body.effect,
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // Statuses, eligibility and decisions (BUY-35)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, listStatuses, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const rows = statusRows(tenant.id, context)
      .filter((row) => query.effectiveStatus === undefined || query.effectiveStatus.includes(row.effectiveStatus))
      .filter((row) => query.programId === undefined || row.program.programId === query.programId)
      .filter(
        (row) =>
          query.categoryId === undefined ||
          row.scopeCategory?.categoryId === query.categoryId ||
          row.programCategory.categoryId === query.categoryId,
      )
      .filter((row) => query.supplierTenantId === undefined || row.supplier.supplierTenantId === query.supplierTenantId)
      .filter((row) => query.expiringBefore === undefined || (row.effectiveTo !== null && row.effectiveTo <= query.expiringBefore))
      .filter((row) => query.withOpenTriggers !== true || row.openTriggerCount > 0)
      .filter((row) => matchesText(query.q, row.supplier.name, row.supplier.legalName, row.program.programName));
    const key = (row: (typeof rows)[number]): string | null => {
      switch (query.sort) {
        case 'programName':
          return row.program.programName;
        case 'effectiveStatus':
          return row.effectiveStatus;
        case 'effectiveTo':
          return row.effectiveTo;
        default:
          return `${row.supplier.name} ${row.program.programName}`;
      }
    };
    return fixtures.page(sortBy(rows, key, query.dir));
  });

  mockRoute(app, checkEligibility, ({ requireTenant, query, now, fail }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const evaluatedAt = query.at ?? context.today;
    const related = QUALIFICATION_RELATIONSHIPS.some(
      (relationship) => relationship.buyerTenantId === tenant.id && relationship.supplierTenantId === query.supplierTenantId,
    );
    if (!related) {
      return fail(404, 'SUPPLIER_NOT_FOUND', 'No relationship with this supplier.');
    }
    const category = findCategory(tenant.id, query.categoryId);
    if (category === undefined) {
      return fail(422, 'CATEGORY_NOT_FOUND', 'No such category.');
    }
    const supplier = supplierRef(query.supplierTenantId);
    const programs = QUALIFICATION_PROGRAMS.filter(
      (program) =>
        program.tenantId === tenant.id &&
        program.status === 'active' &&
        categoryWithDescendants(program.categoryId).some((covered) => covered.id === category.id),
    );
    const base = { supplier, category: categoryRef(category.id), evaluatedAt };
    const program = programs[0];
    if (program === undefined) {
      return {
        ...base,
        gate: 'not_required' as const,
        effectiveStatus: 'not_assessed' as const,
        decisionId: null,
        program: null,
        blockedGate: null,
        explanation: `No qualification program covers ${category.code}; the participation gate does not apply.`,
      };
    }
    const atContext: ViewContext = { ...context, today: evaluatedAt };
    const current = currentDecisionFor(tenant.id, query.supplierTenantId, program.id, atContext);
    const programSummary = { programId: program.id, programName: program.name };
    if (current === null) {
      const inProgress = QUALIFICATION_APPLICATIONS.find(
        (application) =>
          application.tenantId === tenant.id &&
          application.supplierTenantId === query.supplierTenantId &&
          programOf(application).id === program.id &&
          isOpenApplication(application),
      );
      return {
        ...base,
        gate: inProgress === undefined ? ('not_met' as const) : ('pending' as const),
        effectiveStatus: 'not_assessed' as const,
        decisionId: null,
        program: programSummary,
        blockedGate: null,
        explanation:
          inProgress === undefined
            ? `Registered — not qualified for ${category.code}. No application under ${program.name}.`
            : `Registered — not qualified for ${category.code}. Application ${inProgress.reference ?? ''} is ${APPLICATION_PHRASE[inProgress.status] ?? 'in progress'}.`,
      };
    }
    const decision = current.decision;
    const inScope = categoryWithDescendants(decision.scopeCategoryId).some((covered) => covered.id === category.id);
    const amountWithin =
      query.amount === undefined ||
      decision.scopeMaxValue === null ||
      ((query.currency ?? decision.scopeMaxValue.currency) === decision.scopeMaxValue.currency &&
        Number(query.amount) <= Number(decision.scopeMaxValue.amount));
    const status = effectiveStatusOf(decision, evaluatedAt);
    const qualified = status === 'qualified' || status === 'qualified_with_conditions';
    const blocksParticipation = decision.blockedGate === 'invitation' || decision.blockedGate === 'submission';
    const met = qualified && inScope && amountWithin && !blocksParticipation;
    const explanation = !qualified
      ? `Qualification is ${status.replaceAll('_', ' ')} for ${program.name}; the gate is not met.`
      : !inScope
        ? `Qualified only for ${categoryRef(decision.scopeCategoryId).code}; registered — not qualified for ${category.code}.`
        : !amountWithin
          ? `The value exceeds the qualified limit of ${decision.scopeMaxValue?.currency ?? ''} ${decision.scopeMaxValue?.amount ?? ''}.`
          : blocksParticipation
            ? `Conditional qualification blocks the ${decision.blockedGate} gate until the conditions are met.`
            : decision.blockedGate !== 'none'
              ? `Participation allowed; the ${decision.blockedGate.replaceAll('_', ' ')} gate stays blocked until the conditions are met.`
              : `Qualified for ${categoryRef(decision.scopeCategoryId).code} until ${decision.effectiveTo ?? 'further notice'}.`;
    return {
      ...base,
      gate: met ? ('met' as const) : ('not_met' as const),
      effectiveStatus: status,
      decisionId: decision.id,
      program: programSummary,
      blockedGate: decision.blockedGate,
      explanation,
    };
  });

  mockRoute(app, listDecisions, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const rows = QUALIFICATION_DECISIONS.filter((decision) => decision.tenantId === tenant.id)
      .filter((decision) => query.includeSuperseded === true || decision.supersededById === null)
      .filter((decision) => query.supplierTenantId === undefined || decision.supplierTenantId === query.supplierTenantId)
      .filter((decision) => query.outcome === undefined || query.outcome.includes(decision.outcome))
      .filter((decision) => withinDates(decision.decidedAt, query.decidedFrom, query.decidedTo))
      .map((decision) => decisionRow(decision, context))
      .filter((row) => query.programId === undefined || row.program.programId === query.programId)
      .filter((row) => matchesText(query.q, row.supplier.name, row.applicationReference, row.program.programName));
    const key = (row: (typeof rows)[number]): string | null => {
      switch (query.sort) {
        case 'effectiveFrom':
          return row.effectiveFrom;
        case 'effectiveTo':
          return row.effectiveTo;
        case 'supplierName':
          return row.supplier.name;
        default:
          return row.decidedAt;
      }
    };
    return fixtures.page(sortBy(rows, key, query.sort === undefined ? 'desc' : query.dir));
  });

  function decisionOrNotFound(tenantId: number, decisionId: number, notFound: (detail?: string) => never): FxDecision {
    const decision = QUALIFICATION_DECISIONS.find((candidate) => candidate.id === decisionId && candidate.tenantId === tenantId);
    return decision ?? notFound('No such qualification decision.');
  }

  mockRoute(app, getDecision, ({ requireTenant, params, now, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const decision = decisionOrNotFound(tenant.id, params.decisionId, notFound);
    return decisionDetail(
      decision,
      viewContext(now, tenant.officialTimeZone),
      permissions.includes('qualification.decide'),
    );
  });

  mockRoute(app, supersedeDecision, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const previous = decisionOrNotFound(tenant.id, params.decisionId, notFound);
    if (previous.supersededById !== null) {
      fail(409, 'DECISION_ALREADY_SUPERSEDED', `Decision ${previous.id} was already superseded by ${previous.supersededById}.`);
    }
    if (
      body.triggerId !== null &&
      !REASSESSMENT_TRIGGERS.some(
        (trigger) => trigger.id === body.triggerId && trigger.tenantId === tenant.id && trigger.decisionId === previous.id,
      )
    ) {
      fail(422, 'TRIGGER_NOT_FOUND', 'The reassessment trigger does not concern this decision.');
    }
    if (findCategory(tenant.id, body.scopeCategoryId) === undefined) {
      fail(422, 'CATEGORY_NOT_FOUND', 'The scope category is not one of this organization’s categories.');
    }
    const program = QUALIFICATION_PROGRAMS.find((candidate) =>
      versionsOf(candidate.id).some((version) => version.id === previous.programVersionId),
    );
    if (program === undefined) {
      return notFound('The program of this decision no longer exists.');
    }
    const fit = scopeFitsProgram(program, body.scopeCategoryId, body.scopeMaxValue);
    if (!fit.categoryCovered || !fit.valueWithin) {
      fail(422, 'SCOPE_EXCEEDS_PROGRAM', 'The decided scope is outside the program’s category or value limit.');
    }
    const context = viewContext(now, tenant.officialTimeZone);
    const decidedAt = now.toISOString();
    const next: FxDecision = {
      ...previous,
      id: NEW_ID,
      outcome: body.outcome,
      scopeCategoryId: body.scopeCategoryId,
      scopeMaxValue: body.scopeMaxValue,
      scopeGeography: body.scopeGeography,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      reassessmentDate: body.reassessmentDate,
      conditions: body.conditions,
      allowedActivities: body.allowedActivities,
      blockedGate: body.blockedGate,
      reasons: body.reasons,
      supplierExplanation: body.supplierExplanation,
      appealRoute: body.appealRoute,
      approverUserId: requirePersona().userId,
      approvalRequestId: null,
      decidedAt,
      supersededById: null,
      supersedeReason: null,
      supplierNotifiedAt: body.notifySupplier ? decidedAt : null,
      renewalRequestedAt: null,
    };
    const detail = newDecisionDetail(next, context);
    const supersededPrevious = { ...previous, supersededById: NEW_ID, supersedeReason: body.supersedeReason };
    return {
      ...detail,
      history: detail.history.map((entry) => (entry.id === previous.id ? historyEntry(supersededPrevious, context) : entry)),
    };
  });

  mockRoute(app, requestRenewal, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const decision = decisionOrNotFound(tenant.id, params.decisionId, notFound);
    const context = viewContext(now, tenant.officialTimeZone);
    const status = effectiveStatusOf(decision, context.today);
    if (
      decision.supersededById !== null ||
      !(status === 'qualified' || status === 'qualified_with_conditions' || status === 'expired')
    ) {
      fail(409, 'DECISION_NOT_RENEWABLE', 'Only a current qualified or expired decision can be renewed.');
    }
    const renewal = renewalApplicationOf(decision);
    if (decision.renewalRequestedAt !== null || (renewal !== undefined && isOpenApplication(renewal))) {
      fail(409, 'RENEWAL_ALREADY_REQUESTED', 'A renewal was already requested or received for this decision.');
    }
    if (body.dueAt <= now.toISOString()) {
      fail(422, 'DUE_DATE_IN_PAST', 'The due date must be in the future.');
    }
    return {
      decisionId: decision.id,
      supplier: supplierRef(decision.supplierTenantId),
      requestedAt: now.toISOString(),
      dueAt: { at: body.dueAt, timeZone: tenant.officialTimeZone },
      message: body.message,
    };
  });

  // -------------------------------------------------------------------------------------------------------
  // Reassessment triggers (BR-25, AC-09)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, listTriggers, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const rows = REASSESSMENT_TRIGGERS.filter((trigger) => trigger.tenantId === tenant.id)
      .filter((trigger) => query.status === undefined || query.status.includes(trigger.status))
      .filter((trigger) => query.triggerType === undefined || query.triggerType.includes(trigger.triggerType))
      .filter((trigger) => query.supplierTenantId === undefined || trigger.supplierTenantId === query.supplierTenantId)
      .filter((trigger) => withinDates(trigger.detectedAt, query.detectedFrom, query.detectedTo))
      .map((trigger) => triggerRow(trigger, context))
      .filter((row) => query.programId === undefined || row.program?.programId === query.programId)
      .filter(
        (row) => query.withImpacts !== true || row.impactedBids.length > 0 || row.impactedContracts.length > 0,
      )
      .filter((row) => matchesText(query.q, row.supplier.name, row.summary, row.sourceLabel));
    const key = (row: (typeof rows)[number]): string | null => {
      switch (query.sort) {
        case 'lapsesOn':
          return row.lapsesOn;
        case 'supplierName':
          return row.supplier.name;
        case 'status':
          return row.status;
        default:
          return row.detectedAt;
      }
    };
    return fixtures.page(sortBy(rows, key, query.sort === undefined ? 'desc' : query.dir));
  });

  function triggerOrNotFound(tenantId: number, triggerId: number, notFound: (detail?: string) => never) {
    const trigger = REASSESSMENT_TRIGGERS.find((candidate) => candidate.id === triggerId && candidate.tenantId === tenantId);
    return trigger ?? notFound('No such reassessment trigger.');
  }

  mockRoute(app, getTrigger, ({ requireTenant, params, now, notFound }) => {
    const { tenant } = requireTenant();
    return triggerRow(triggerOrNotFound(tenant.id, params.triggerId, notFound), viewContext(now, tenant.officialTimeZone));
  });

  mockRoute(app, createTrigger, ({ requireTenant, body, now, fail }) => {
    const { tenant } = requireTenant();
    const decision = QUALIFICATION_DECISIONS.find(
      (candidate) =>
        candidate.id === body.decisionId &&
        candidate.tenantId === tenant.id &&
        candidate.supplierTenantId === body.supplierTenantId,
    );
    if (decision === undefined) {
      return fail(404, 'DECISION_NOT_FOUND', 'No such decision for this supplier.');
    }
    if (decision.supersededById !== null) {
      fail(409, 'DECISION_NOT_CURRENT', 'Reassess the current decision, not a superseded one.');
    }
    if (
      REASSESSMENT_TRIGGERS.some(
        (trigger) =>
          trigger.tenantId === tenant.id &&
          trigger.decisionId === decision.id &&
          trigger.triggerType === body.triggerType &&
          trigger.status === 'open',
      )
    ) {
      fail(409, 'TRIGGER_ALREADY_OPEN', 'An open trigger of this type already exists for the decision.');
    }
    const activity = activityOf(tenant.id, decision.supplierTenantId);
    return triggerRow(
      {
        id: NEW_ID,
        tenantId: tenant.id,
        supplierTenantId: decision.supplierTenantId,
        decisionId: decision.id,
        triggerType: body.triggerType,
        sourceType: 'manual',
        sourceId: null,
        sourceLabel: 'Raised by the buyer',
        summary: body.summary,
        detectedAt: now.toISOString(),
        lapsesOn: null,
        status: 'open',
        assessedByUserId: null,
        assessedAt: null,
        disposition: null,
        activeBidsReviewed: false,
        activeContractsReviewed: false,
        resultingDecisionId: null,
        taskId: null,
        impactedTenderIds: activity.bids.map((bid) => bid.tenderId),
        impactedContractIds: activity.contracts.map((contract) => contract.contractId),
      },
      viewContext(now, tenant.officialTimeZone),
    );
  });

  mockRoute(app, assessTrigger, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const trigger = triggerOrNotFound(tenant.id, params.triggerId, notFound);
    if (trigger.status !== 'open') {
      fail(409, 'TRIGGER_ALREADY_CLOSED', `The trigger is already ${trigger.status.replaceAll('_', ' ')}.`);
    }
    const context = viewContext(now, tenant.officialTimeZone);
    const row = triggerRow(trigger, context);
    if (
      (row.impactedBids.length > 0 && !body.activeBidsReviewed) ||
      (row.impactedContracts.length > 0 && !body.activeContractsReviewed)
    ) {
      fail(409, 'IMPACT_REVIEW_REQUIRED', 'Confirm the review of every impacted active bid and contract (AC-09).');
    }
    if (body.resultingStatus === 'action_taken' && body.resultingDecisionId === null) {
      fail(422, 'RESULTING_DECISION_REQUIRED', 'Record the decision taken before closing the trigger as action taken.');
    }
    if (
      body.resultingDecisionId !== null &&
      body.resultingDecisionId !== NEW_ID &&
      !QUALIFICATION_DECISIONS.some(
        (decision) => decision.id === body.resultingDecisionId && decision.tenantId === tenant.id,
      )
    ) {
      fail(404, 'DECISION_NOT_FOUND', 'The resulting decision does not exist.');
    }
    return triggerRow(
      {
        ...trigger,
        status: body.resultingStatus,
        disposition: body.disposition,
        activeBidsReviewed: body.activeBidsReviewed,
        activeContractsReviewed: body.activeContractsReviewed,
        resultingDecisionId: body.resultingDecisionId,
        assessedByUserId: requirePersona().userId,
        assessedAt: now.toISOString(),
      },
      context,
    );
  });
}
