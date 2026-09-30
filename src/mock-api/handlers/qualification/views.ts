/**
 * Builders that turn qualification fixtures into contract rows (`src/contracts/qualification.ts`).
 *
 * Visibility rules applied here and in the handlers (PRD §4.3, DD-03):
 * - buyer rows are always of the active buyer tenant and never `draft` applications;
 * - supplier rows are always the supplier's own, without findings, financial reviews, screenings, triggers or
 *   internal decision reasons;
 * - `expired` is derived from `effectiveTo` against the request date (DD-13, DD-20).
 */
import type { NonNegativeMoney } from '../../../contracts/common.js';
import type { PersonRef } from '../../../contracts/common.js';
import type { QualificationCriteriaArea, VQualificationStatusEffectiveStatus } from '../../../contracts/enums.js';
import type {
  Answer,
  AreaCount,
  BuyerApplicationActions,
  BuyerApplicationDetail,
  BuyerApplicationRow,
  BuyerRef,
  CategoryRef,
  Completeness,
  Criterion,
  Decision,
  DecisionDetail,
  EvidenceSnapshot,
  EvidenceUpdate,
  Finding,
  FinancialReview,
  ImpactedBid,
  ImpactedContract,
  InfoRequest,
  ProgramDetail,
  ProgramRow,
  ProgramVersion,
  ProgramVersionRef,
  ReconsiderationRequest,
  Recommendation,
  Screening,
  StatusRow,
  SupplierApplicationDetail,
  SupplierApplicationRow,
  SupplierDecision,
  SupplierDecisionDetail,
  SupplierProgramDetail,
  SupplierProgramRow,
  SupplierRef,
  SupplierStatusRow,
  Trigger,
} from '../../../contracts/qualification.js';
import { QUALIFICATION_CRITERIA_AREA } from '../../../contracts/enums.js';
import { ROLE_TEMPLATES } from '../../../contracts/permissions.js';
import type { PermissionCode, RoleTemplateCode } from '../../../contracts/permissions.js';
import type {
  FxAnswer,
  FxApplication,
  FxCriterion,
  FxDecision,
  FxEvidenceCitation,
  FxFinancialReview,
  FxFinding,
  FxInfoRequest,
  FxProgram,
  FxProgramVersion,
  FxScreening,
  FxTrigger,
} from '../../fixtures/qualification/index.js';
import {
  EVIDENCE_UPDATES,
  FINANCIAL_REVIEWS,
  INTEGRITY_SCREENINGS,
  QUALIFICATION_ANSWERS,
  QUALIFICATION_APPLICATIONS,
  QUALIFICATION_CATEGORIES,
  QUALIFICATION_DECISIONS,
  QUALIFICATION_FINDINGS,
  QUALIFICATION_INFO_REQUESTS,
  QUALIFICATION_PROGRAMS,
  QUALIFICATION_RELATIONSHIPS,
  RECOMMENDATIONS,
  RECONSIDERATIONS,
  REASSESSMENT_TRIGGERS,
  activityOf,
  categoryWithDescendants,
  criteriaOf,
  evidenceDocumentIds,
  findEvidenceItem,
  findProgram,
  findProgramVersion,
  versionsOf,
} from '../../fixtures/qualification/index.js';
import { allPersonas, findTenantById, membershipPermissions, personRef } from '../../persona.js';
import type { CustomFieldContext, CustomFieldValues } from '../../../contracts/policy.js';
import { customFieldValuesOf, supplierVisibleValues } from '../../custom-fields.js';

/** The additional field values of an application (this command's values, else the recorded ones). */
export function applicationCustomValues(application: FxApplication): CustomFieldValues {
  return { ...(application.customFields ?? customFieldValuesOf(application.tenantId, 'qualification_application', application.id)) };
}

/** The core values the application form's conditional fields read (the scope category). */
export function applicationCustomContext(application: FxApplication): CustomFieldContext {
  return { category_code: QUALIFICATION_CATEGORIES.find((category) => category.id === application.scopeCategoryId)?.code ?? null };
}

// ---------------------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------------------

/** The calendar date of an instant in a time zone (`YYYY-MM-DD`). */
export function dateIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The context every builder needs: the request date in the official zone. */
export interface ViewContext {
  readonly now: Date;
  readonly today: string;
  readonly timeZone: string;
}

export function viewContext(now: Date, timeZone = 'Africa/Gaborone'): ViewContext {
  return { now, today: dateIn(now, timeZone), timeZone };
}

// ---------------------------------------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------------------------------------

export function categoryRef(categoryId: number): CategoryRef {
  const category = QUALIFICATION_CATEGORIES.find((candidate) => candidate.id === categoryId);
  if (category === undefined) {
    throw new Error(`Unknown qualification category ${categoryId}.`);
  }
  return { categoryId: category.id, code: category.code, name: category.name, parentId: category.parentId };
}

export function supplierRef(supplierTenantId: number): SupplierRef {
  const tenant = findTenantById(supplierTenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown supplier tenant ${supplierTenantId}.`);
  }
  return { supplierTenantId: tenant.id, name: tenant.name, legalName: tenant.legalName, slug: tenant.slug };
}

export function buyerRef(buyerTenantId: number): BuyerRef {
  const tenant = findTenantById(buyerTenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown buyer tenant ${buyerTenantId}.`);
  }
  return { buyerTenantId: tenant.id, name: tenant.name, slug: tenant.slug };
}

export function person(userId: number | null): PersonRef | null {
  return userId === null ? null : personRef(userId);
}

export function programOfVersion(programVersionId: number): { program: FxProgram; version: FxProgramVersion } {
  const version = findProgramVersion(programVersionId);
  const program = version === undefined ? undefined : findProgram(version.programId);
  if (version === undefined || program === undefined) {
    throw new Error(`Unknown program version ${programVersionId}.`);
  }
  return { program, version };
}

export function programVersionRef(programVersionId: number): ProgramVersionRef {
  const { program, version } = programOfVersion(programVersionId);
  return { programId: program.id, programName: program.name, programVersionId: version.id, versionNo: version.versionNo };
}

function moneyExceeds(value: NonNegativeMoney | null, limit: NonNegativeMoney | null): boolean {
  if (value === null || limit === null) {
    return false;
  }
  return value.currency !== limit.currency || Number(value.amount) > Number(limit.amount);
}

/** Whether a scope (category and amount) fits within a program (category incl. descendants, max value). */
/** The program's category and every descendant (DD-26): the only valid scope categories. */
export function coveredCategoriesOf(program: FxProgram): CategoryRef[] {
  return categoryWithDescendants(program.categoryId).map((category) => categoryRef(category.id));
}

export function scopeFitsProgram(
  program: FxProgram,
  scopeCategoryId: number,
  scopeMaxValue: NonNegativeMoney | null,
): { categoryCovered: boolean; valueWithin: boolean } {
  const covered = categoryWithDescendants(program.categoryId).some((category) => category.id === scopeCategoryId);
  return { categoryCovered: covered, valueWithin: !moneyExceeds(scopeMaxValue, program.maxContractValue) };
}

// ---------------------------------------------------------------------------------------------------------
// People who can take qualification roles
// ---------------------------------------------------------------------------------------------------------

/** Active members of a buyer tenant holding a permission, with their capacity. */
export function membersWith(tenantId: number, code: PermissionCode): Array<PersonRef & { capacity: string | null }> {
  return allPersonas().flatMap((persona) => {
    if (persona.status !== 'active') {
      return [];
    }
    const membership = persona.memberships.find(
      (candidate) => candidate.tenantId === tenantId && candidate.status === 'active',
    );
    if (membership === undefined || !membershipPermissions(membership).includes(code)) {
      return [];
    }
    return [{ userId: persona.userId, fullName: persona.fullName, capacity: membership.capacity }];
  });
}

export function hasPermission(tenantId: number, userId: number, code: PermissionCode): boolean {
  return membersWith(tenantId, code).some((member) => member.userId === userId);
}

/** Role templates whose holders may decide qualification (`decision_role_code`). */
export function decisionRoles(): Array<{ code: string; name: string }> {
  return (Object.keys(ROLE_TEMPLATES) as RoleTemplateCode[])
    .filter((code) => {
      const permissions: readonly string[] = ROLE_TEMPLATES[code].permissions;
      return permissions.includes('qualification.decide');
    })
    .map((code) => ({ code, name: ROLE_TEMPLATES[code].name }));
}

export function roleName(code: string): string {
  const template = (Object.keys(ROLE_TEMPLATES) as RoleTemplateCode[]).find((candidate) => candidate === code);
  return template === undefined ? code : ROLE_TEMPLATES[template].name;
}

// ---------------------------------------------------------------------------------------------------------
// Programs (ADM-09, SUP-20)
// ---------------------------------------------------------------------------------------------------------

export function criterionRow(criterion: FxCriterion): Criterion {
  return {
    id: criterion.id,
    programVersionId: criterion.programVersionId,
    area: criterion.area,
    question: criterion.question,
    guidance: criterion.guidance,
    responseType: criterion.responseType,
    mandatory: criterion.mandatory,
    evidenceTypes: [...criterion.evidenceTypes],
    requiresNaReason: criterion.requiresNaReason,
    thresholdDescription: criterion.thresholdDescription,
    sortOrder: criterion.sortOrder,
  };
}

export function areaCounts(
  criteria: ReadonlyArray<{ readonly area: QualificationCriteriaArea; readonly mandatory: boolean }>,
): AreaCount[] {
  return QUALIFICATION_CRITERIA_AREA.flatMap((area) => {
    const inArea = criteria.filter((criterion) => criterion.area === area);
    return inArea.length === 0
      ? []
      : [{ area, criteria: inArea.length, mandatory: inArea.filter((criterion) => criterion.mandatory).length }];
  });
}

function visibleApplications(tenantId: number): FxApplication[] {
  return QUALIFICATION_APPLICATIONS.filter((application) => application.tenantId === tenantId && application.status !== 'draft');
}

export function programVersionRow(version: FxProgramVersion): ProgramVersion {
  const criteria = criteriaOf(version.id);
  return {
    id: version.id,
    programId: version.programId,
    versionNo: version.versionNo,
    status: version.status,
    changeNote: version.changeNote,
    approvedBy: person(version.approvedByUserId),
    approvedAt: version.approvedAt,
    createdAt: version.createdAt,
    criteriaCount: criteria.length,
    mandatoryCount: criteria.filter((criterion) => criterion.mandatory).length,
    applicationCount: visibleApplications(version.tenantId).filter((application) => application.programVersionId === version.id)
      .length,
  };
}

const OPEN_APPLICATION_STATUSES = ['submitted', 'under_review', 'more_info_required', 'decision_pending'] as const;

export function isOpenApplication(application: FxApplication): boolean {
  return (OPEN_APPLICATION_STATUSES as readonly string[]).includes(application.status);
}

export function programRow(program: FxProgram, context: ViewContext): ProgramRow {
  const versions = versionsOf(program.id);
  const current = versions.find((version) => version.id === program.currentVersionId) ?? null;
  const draft = versions.find((version) => version.status === 'draft') ?? null;
  const versionIds = versions.map((version) => version.id);
  const qualified = new Set(
    currentDecisions(program.tenantId, context)
      .filter(
        (entry) =>
          versionIds.includes(entry.decision.programVersionId) &&
          (entry.effectiveStatus === 'qualified' || entry.effectiveStatus === 'qualified_with_conditions'),
      )
      .map((entry) => entry.decision.supplierTenantId),
  );
  return {
    id: program.id,
    name: program.name,
    status: program.status,
    category: categoryRef(program.categoryId),
    coveredCategories: coveredCategoriesOf(program),
    geography: program.geography,
    maxContractValue: program.maxContractValue,
    validityMonths: program.validityMonths,
    renewalNoticeDays: program.renewalNoticeDays,
    requiresIndependentApproval: program.requiresIndependentApproval,
    owner: personRef(program.ownerUserId),
    currentVersion:
      current === null
        ? null
        : { id: current.id, versionNo: current.versionNo, status: current.status, approvedAt: current.approvedAt },
    draftVersionNo: draft?.versionNo ?? null,
    criteriaCount: criteriaOf(current?.id ?? draft?.id ?? 0).length,
    openApplicationCount: visibleApplications(program.tenantId).filter(
      (application) => versionIds.includes(application.programVersionId) && isOpenApplication(application),
    ).length,
    qualifiedSupplierCount: qualified.size,
    updatedAt: program.updatedAt,
  };
}

export function programDetail(program: FxProgram, context: ViewContext, shownVersionId: number | null): ProgramDetail {
  const versions = versionsOf(program.id);
  const shown =
    shownVersionId ?? versions.find((version) => version.status === 'draft')?.id ?? program.currentVersionId ?? null;
  const criteria = shown === null ? [] : criteriaOf(shown);
  return {
    ...programRow(program, context),
    description: program.description,
    decisionRoleCode: program.decisionRoleCode,
    decisionRoleName: roleName(program.decisionRoleCode),
    assessors: membersWith(program.tenantId, 'qualification.review').map(({ userId, fullName }) => ({ userId, fullName })),
    financialReviewers: membersWith(program.tenantId, 'qualification.financial_review').map(({ userId, fullName }) => ({
      userId,
      fullName,
    })),
    deciders: membersWith(program.tenantId, 'qualification.decide').map(({ userId, fullName }) => ({ userId, fullName })),
    monitoredTriggerTypes: [...program.monitoredTriggerTypes],
    versions: versions.map(programVersionRow),
    shownVersionId: shown,
    criteria: criteria.map(criterionRow),
    areaCounts: areaCounts(criteria),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Decisions and statuses (DD-13)
// ---------------------------------------------------------------------------------------------------------

export function effectiveStatusOf(decision: FxDecision, today: string): VQualificationStatusEffectiveStatus {
  if (decision.effectiveTo !== null && decision.effectiveTo < today) {
    return 'expired';
  }
  return decision.outcome;
}

/** The latest non-superseded decision per (supplier, program) of a buyer tenant. */
export function currentDecisions(
  tenantId: number,
  context: ViewContext,
): Array<{ decision: FxDecision; programId: number; effectiveStatus: VQualificationStatusEffectiveStatus }> {
  const latest = new Map<string, FxDecision>();
  for (const decision of QUALIFICATION_DECISIONS) {
    if (decision.tenantId !== tenantId || decision.supersededById !== null) {
      continue;
    }
    const programId = programOfVersion(decision.programVersionId).program.id;
    const key = `${decision.supplierTenantId}:${programId}`;
    const existing = latest.get(key);
    if (
      existing === undefined ||
      decision.effectiveFrom > existing.effectiveFrom ||
      (decision.effectiveFrom === existing.effectiveFrom && decision.id > existing.id)
    ) {
      latest.set(key, decision);
    }
  }
  return [...latest.values()].map((decision) => ({
    decision,
    programId: programOfVersion(decision.programVersionId).program.id,
    effectiveStatus: effectiveStatusOf(decision, context.today),
  }));
}

export function currentDecisionFor(
  tenantId: number,
  supplierTenantId: number,
  programId: number,
  context: ViewContext,
): { decision: FxDecision; effectiveStatus: VQualificationStatusEffectiveStatus } | null {
  return (
    currentDecisions(tenantId, context).find(
      (entry) => entry.decision.supplierTenantId === supplierTenantId && entry.programId === programId,
    ) ?? null
  );
}

function applicationInProgress(tenantId: number, supplierTenantId: number, programId: number, includeDrafts: boolean) {
  return (
    QUALIFICATION_APPLICATIONS.filter(
      (application) =>
        application.tenantId === tenantId &&
        application.supplierTenantId === supplierTenantId &&
        programOfVersion(application.programVersionId).program.id === programId &&
        (isOpenApplication(application) || (includeDrafts && application.status === 'draft')),
    ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

function bidRow(bid: ReturnType<typeof activityOf>['bids'][number], audience: 'buyer' | 'supplier'): ImpactedBid {
  return {
    tenderId: bid.tenderId,
    reference: bid.reference,
    title: bid.title,
    tenderStatus: bid.tenderStatus,
    submissionState: bid.submissionState,
    qualificationGate: bid.qualificationGate,
    nextGate: bid.nextGate,
    link: audience === 'buyer' ? `/buyer/tenders/${bid.tenderId}` : `/supplier/opportunities/${bid.tenderId}`,
  };
}

function contractRow(contract: ReturnType<typeof activityOf>['contracts'][number]): ImpactedContract {
  return {
    contractId: contract.contractId,
    reference: contract.reference,
    title: contract.title,
    status: contract.status,
    link: `/buyer/contracts/${contract.contractId}`,
  };
}

function openTriggerCount(tenantId: number, supplierTenantId: number, decisionId: number | null): number {
  return REASSESSMENT_TRIGGERS.filter(
    (trigger) =>
      trigger.tenantId === tenantId &&
      trigger.supplierTenantId === supplierTenantId &&
      trigger.status === 'open' &&
      (decisionId === null || trigger.decisionId === decisionId),
  ).length;
}

function reconsiderationOf(decision: FxDecision): ReconsiderationRequest | null {
  const request = RECONSIDERATIONS.find((candidate) => candidate.decisionId === decision.id);
  if (request === undefined) {
    return null;
  }
  return {
    decisionId: request.decisionId,
    grounds: request.grounds,
    requestedAt: request.requestedAt,
    requestedBy: personRef(request.requestedByUserId),
    evidenceItemIds: [...request.evidenceItemIds],
    appealRoute: decision.appealRoute,
    resolvedByDecisionId: decision.supersededById,
  };
}

function evidenceUpdatesOf(decision: FxDecision): EvidenceUpdate[] {
  return EVIDENCE_UPDATES.filter((update) => update.decisionId === decision.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((update) => {
      const item = findEvidenceItem(update.evidenceItemId);
      return {
        id: update.id,
        decisionId: update.decisionId,
        evidenceItemId: update.evidenceItemId,
        title: item?.title ?? 'Evidence item',
        expiresAt: item?.expiresAt ?? null,
        note: update.note,
        submittedAt: update.submittedAt,
        submittedBy: personRef(update.submittedByUserId),
      };
    });
}

/** A reconsideration is open while the decision it challenges is still current. */
export function hasOpenReconsideration(decision: FxDecision): boolean {
  return decision.supersededById === null && RECONSIDERATIONS.some((request) => request.decisionId === decision.id);
}

export function decisionRow(decision: FxDecision, context: ViewContext): Decision {
  const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.id === decision.applicationId);
  return {
    id: decision.id,
    applicationId: decision.applicationId,
    applicationReference: application?.reference ?? 'QA-UNKNOWN',
    supplier: supplierRef(decision.supplierTenantId),
    program: programVersionRef(decision.programVersionId),
    outcome: decision.outcome,
    effectiveStatus: effectiveStatusOf(decision, context.today),
    scopeCategory: categoryRef(decision.scopeCategoryId),
    scopeMaxValue: decision.scopeMaxValue,
    scopeGeography: decision.scopeGeography,
    effectiveFrom: decision.effectiveFrom,
    effectiveTo: decision.effectiveTo,
    reassessmentDate: decision.reassessmentDate,
    conditions: decision.conditions,
    allowedActivities: decision.allowedActivities,
    blockedGate: decision.blockedGate,
    reasons: decision.reasons,
    supplierExplanation: decision.supplierExplanation,
    appealRoute: decision.appealRoute,
    reviewer: person(decision.reviewerUserId),
    approver: person(decision.approverUserId),
    approvalRequestId: decision.approvalRequestId,
    decidedAt: decision.decidedAt,
    supersededById: decision.supersededById,
    supersedeReason: decision.supersedeReason,
    supplierNotifiedAt: decision.supplierNotifiedAt,
    openReconsideration: hasOpenReconsideration(decision),
    evidenceUpdateCount: EVIDENCE_UPDATES.filter((update) => update.decisionId === decision.id).length,
  };
}

export function triggerRow(trigger: FxTrigger, context: ViewContext): Trigger {
  const decision = trigger.decisionId === null ? undefined : QUALIFICATION_DECISIONS.find((d) => d.id === trigger.decisionId);
  const activity = activityOf(trigger.tenantId, trigger.supplierTenantId);
  return {
    id: trigger.id,
    triggerType: trigger.triggerType,
    supplier: supplierRef(trigger.supplierTenantId),
    program: decision === undefined ? null : programVersionRef(decision.programVersionId),
    decisionId: trigger.decisionId,
    decisionEffectiveStatus: decision === undefined ? null : effectiveStatusOf(decision, context.today),
    sourceType: trigger.sourceType,
    sourceId: trigger.sourceId,
    sourceLabel: trigger.sourceLabel,
    summary: trigger.summary,
    detectedAt: trigger.detectedAt,
    lapsesOn: trigger.lapsesOn,
    status: trigger.status,
    assessedBy: person(trigger.assessedByUserId),
    assessedAt: trigger.assessedAt,
    disposition: trigger.disposition,
    activeBidsReviewed: trigger.activeBidsReviewed,
    activeContractsReviewed: trigger.activeContractsReviewed,
    resultingDecisionId: trigger.resultingDecisionId,
    taskId: trigger.taskId,
    impactedBids: activity.bids.filter((bid) => trigger.impactedTenderIds.includes(bid.tenderId)).map((bid) => bidRow(bid, 'buyer')),
    impactedContracts: activity.contracts
      .filter((contract) => trigger.impactedContractIds.includes(contract.contractId))
      .map(contractRow),
  };
}

export function evidenceSnapshot(citation: FxEvidenceCitation, context: ViewContext): EvidenceSnapshot {
  const item = findEvidenceItem(citation.evidenceItemId);
  if (item === undefined) {
    throw new Error(`Unknown evidence item ${citation.evidenceItemId}.`);
  }
  return {
    evidenceSubmissionId: citation.evidenceSubmissionId,
    evidenceItemId: item.id,
    evidenceType: item.evidenceType,
    title: item.title,
    issuer: item.issuer,
    referenceNumber: item.referenceNumber,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    reportingCurrency: item.reportingCurrency,
    isConsolidated: item.isConsolidated,
    coverageAmount: item.coverageAmount,
    validFrom: item.validFrom,
    expiresAt: item.expiresAt,
    verificationStatus: item.verificationStatus,
    ...evidenceDocumentIds(item.id),
    fileName: item.fileName,
    submittedAt: citation.submittedAt,
    expiredSinceSubmission: item.expiresAt !== null && item.expiresAt < context.today,
    replacedSinceSubmission: item.status === 'replaced',
  };
}

function decisionEvidence(decision: FxDecision, context: ViewContext, windowDays: number): EvidenceSnapshot[] {
  const horizon = addDays(context.today, windowDays);
  return QUALIFICATION_ANSWERS.filter((answer) => answer.applicationId === decision.applicationId)
    .flatMap((answer) => answer.evidence)
    .map((citation) => evidenceSnapshot(citation, context))
    .filter((snapshot) => snapshot.expiresAt !== null && snapshot.expiresAt <= horizon);
}

export function renewalApplicationOf(decision: FxDecision): FxApplication | undefined {
  return QUALIFICATION_APPLICATIONS.find((application) => application.renewalOfDecisionId === decision.id);
}

function historyOf(decision: FxDecision): FxDecision[] {
  const programId = programOfVersion(decision.programVersionId).program.id;
  return QUALIFICATION_DECISIONS.filter(
    (candidate) =>
      candidate.tenantId === decision.tenantId &&
      candidate.supplierTenantId === decision.supplierTenantId &&
      programOfVersion(candidate.programVersionId).program.id === programId,
  ).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
}

export function decisionDetail(decision: FxDecision, context: ViewContext, canDecide: boolean): DecisionDetail {
  const program = programOfVersion(decision.programVersionId).program;
  const activity = activityOf(decision.tenantId, decision.supplierTenantId);
  const renewal = renewalApplicationOf(decision);
  return {
    ...decisionRow(decision, context),
    history: historyOf(decision).map((entry) => {
      const row = decisionRow(entry, context);
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
    }),
    triggers: REASSESSMENT_TRIGGERS.filter(
      (trigger) => trigger.decisionId === decision.id || trigger.resultingDecisionId === decision.id,
    ).map((trigger) => triggerRow(trigger, context)),
    impactedBids: activity.bids.map((bid) => bidRow(bid, 'buyer')),
    impactedContracts: activity.contracts.map(contractRow),
    expiringEvidence: decisionEvidence(decision, context, program.renewalNoticeDays),
    programCoveredCategories: coveredCategoriesOf(program),
    reconsideration: reconsiderationOf(decision),
    evidenceUpdates: evidenceUpdatesOf(decision),
    renewalApplicationId: renewal?.id ?? null,
    renewalRequestedAt: decision.renewalRequestedAt,
    canSupersede: canDecide && decision.supersededById === null,
  };
}

export function statusRows(tenantId: number, context: ViewContext): StatusRow[] {
  const programs = QUALIFICATION_PROGRAMS.filter((program) => program.tenantId === tenantId && program.status === 'active');
  const suppliers = QUALIFICATION_RELATIONSHIPS.filter(
    (relationship) => relationship.buyerTenantId === tenantId && relationship.status === 'active',
  ).map((relationship) => relationship.supplierTenantId);
  const rows: StatusRow[] = [];
  for (const program of programs) {
    for (const supplierTenantId of suppliers) {
      const current = currentDecisionFor(tenantId, supplierTenantId, program.id, context);
      const inProgress = applicationInProgress(tenantId, supplierTenantId, program.id, false);
      const decision = current?.decision ?? null;
      rows.push({
        supplier: supplierRef(supplierTenantId),
        program: { programId: program.id, programName: program.name },
        programCategory: categoryRef(program.categoryId),
        effectiveStatus: current?.effectiveStatus ?? 'not_assessed',
        decisionId: decision?.id ?? null,
        outcome: decision?.outcome ?? null,
        scopeCategory: decision === null ? null : categoryRef(decision.scopeCategoryId),
        scopeMaxValue: decision?.scopeMaxValue ?? null,
        effectiveFrom: decision?.effectiveFrom ?? null,
        effectiveTo: decision?.effectiveTo ?? null,
        reassessmentDate: decision?.reassessmentDate ?? null,
        conditions: decision?.conditions ?? null,
        blockedGate: decision?.blockedGate ?? null,
        expiresInDays: decision?.effectiveTo == null ? null : daysBetween(context.today, decision.effectiveTo),
        openTriggerCount: decision === null ? 0 : openTriggerCount(tenantId, supplierTenantId, decision.id),
        applicationInProgress:
          inProgress === null || inProgress.reference === null || inProgress.status === 'draft'
            ? null
            : { applicationId: inProgress.id, reference: inProgress.reference, status: inProgress.status },
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------------------------------------

export function answerRow(answer: FxAnswer): Answer {
  return {
    id: answer.id,
    applicability: answer.applicability,
    naReason: answer.naReason,
    answerText: answer.answerText,
    answerNumber: answer.answerNumber,
    answerDate: answer.answerDate,
    answerBool: answer.answerBool,
    updatedBy: person(answer.updatedByUserId),
    updatedAt: answer.updatedAt,
  };
}

export function answersOf(applicationId: number): FxAnswer[] {
  return QUALIFICATION_ANSWERS.filter((answer) => answer.applicationId === applicationId);
}

/** Mandatory evidence expected but not provided (never a pass). */
export function evidenceMissing(criterion: FxCriterion, answer: FxAnswer | undefined): boolean {
  if (!criterion.mandatory || criterion.responseType !== 'document') {
    return false;
  }
  if (answer?.applicability === 'not_applicable') {
    return false;
  }
  return (answer?.evidence.length ?? 0) === 0;
}

export function completeness(application: FxApplication, context: ViewContext): Completeness {
  const criteria = criteriaOf(application.programVersionId);
  const answers = answersOf(application.id);
  const answerFor = (criterion: FxCriterion) => answers.find((answer) => answer.criterionId === criterion.id);
  return {
    criteriaTotal: criteria.length,
    answered: criteria.filter((criterion) => answerFor(criterion) !== undefined).length,
    mandatoryUnanswered: criteria.filter((criterion) => criterion.mandatory && answerFor(criterion) === undefined).length,
    mandatoryEvidenceMissing: criteria.filter(
      (criterion) => answerFor(criterion) !== undefined && evidenceMissing(criterion, answerFor(criterion)),
    ).length,
    naWithoutReason: answers.filter(
      (answer) => answer.applicability === 'not_applicable' && (answer.naReason ?? '').trim() === '',
    ).length,
    expiredEvidence: answers
      .flatMap((answer) => answer.evidence)
      .filter((citation) => {
        const item = findEvidenceItem(citation.evidenceItemId);
        return item?.expiresAt != null && item.expiresAt < context.today;
      }).length,
  };
}

export function infoRequestsOf(applicationId: number): FxInfoRequest[] {
  return QUALIFICATION_INFO_REQUESTS.filter((request) => request.applicationId === applicationId).sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt),
  );
}

export function infoRequestRow(request: FxInfoRequest, context: ViewContext): InfoRequest {
  const criterion = request.criterionId === null ? undefined : criteriaOf(programVersionOfApplication(request.applicationId)).find((c) => c.id === request.criterionId);
  const requestedBy = personRef(request.requestedByUserId);
  return {
    id: request.id,
    applicationId: request.applicationId,
    criterionId: request.criterionId,
    criterionQuestion: criterion?.question ?? null,
    area: criterion?.area ?? null,
    question: request.question,
    requestedBy,
    requestedAt: request.requestedAt,
    dueAt: { at: request.dueAt, timeZone: context.timeZone },
    status: request.status,
    responseText: request.responseText,
    respondedBy: person(request.respondedByUserId),
    respondedAt: request.respondedAt,
    responseEvidence: request.responseEvidence.map((citation) => evidenceSnapshot(citation, context)),
  };
}

function programVersionOfApplication(applicationId: number): number {
  const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.id === applicationId);
  if (application === undefined) {
    throw new Error(`Unknown application ${applicationId}.`);
  }
  return application.programVersionId;
}

export function findingRow(finding: FxFinding): Finding {
  return {
    id: finding.id,
    criterionId: finding.criterionId,
    finding: finding.finding,
    rationale: finding.rationale,
    evidenceRefs: finding.evidenceRefs,
    flagOnly: finding.flagOnly,
    assessor: personRef(finding.assessorUserId),
    recordedAt: finding.recordedAt,
  };
}

export function screeningRow(screening: FxScreening): Screening {
  return {
    id: screening.id,
    supplier: supplierRef(screening.supplierTenantId),
    checkType: screening.checkType,
    source: screening.source,
    checkedAt: screening.checkedAt,
    result: screening.result,
    matchDetail: screening.matchDetail,
    reviewedBy: person(screening.reviewedByUserId),
    reviewedAt: screening.reviewedAt,
    disposition: screening.disposition,
    effect: screening.effect,
  };
}

export function unreviewedFlags(tenantId: number, supplierTenantId: number): FxScreening[] {
  return INTEGRITY_SCREENINGS.filter(
    (screening) =>
      screening.tenantId === tenantId &&
      screening.supplierTenantId === supplierTenantId &&
      screening.result !== 'no_match' &&
      screening.reviewedAt === null,
  );
}

export function financialReviewRow(review: FxFinancialReview): FinancialReview {
  return {
    id: review.id,
    applicationId: review.applicationId,
    reviewer: personRef(review.reviewerUserId),
    financialPeriodEnd: review.financialPeriodEnd,
    reportingCurrency: review.reportingCurrency,
    isConsolidated: review.isConsolidated,
    source: review.source,
    turnover: review.turnover,
    currentRatio: review.currentRatio,
    debtToEquity: review.debtToEquity,
    parentSupportEvidence: review.parentSupportEvidence,
    materialQualifications: review.materialQualifications,
    conclusion: review.conclusion,
    rationale: review.rationale,
    reviewedAt: review.reviewedAt,
  };
}

export function financialReviewsOf(applicationId: number): FxFinancialReview[] {
  return FINANCIAL_REVIEWS.filter((review) => review.applicationId === applicationId);
}

export function decisionOfApplication(applicationId: number): FxDecision | undefined {
  return QUALIFICATION_DECISIONS.filter((decision) => decision.applicationId === applicationId).sort((a, b) => a.id - b.id)[0];
}

export function buyerApplicationRow(application: FxApplication, context: ViewContext): BuyerApplicationRow {
  if (application.status === 'draft' || application.reference === null || application.submittedAt === null) {
    throw new Error(`Application ${application.id} is a draft and never reaches a buyer view.`);
  }
  const { program } = programOfVersion(application.programVersionId);
  const current = currentDecisionFor(application.tenantId, application.supplierTenantId, program.id, context);
  const dueAt = application.dueAt === null ? null : { at: application.dueAt, timeZone: context.timeZone };
  return {
    id: application.id,
    reference: application.reference,
    supplier: supplierRef(application.supplierTenantId),
    program: programVersionRef(application.programVersionId),
    scopeCategory: categoryRef(application.scopeCategoryId),
    scopeMaxValue: application.scopeMaxValue,
    status: application.status,
    riskLevel: application.riskLevel,
    priority: application.priority,
    assessor: person(application.assessorUserId),
    financialReviewer: person(application.financialReviewerUserId),
    submittedAt: application.submittedAt,
    dueAt,
    overdue: isOpenApplication(application) && application.dueAt !== null && application.dueAt < context.now.toISOString(),
    completeness: completeness(application, context),
    renewalOfDecisionId: application.renewalOfDecisionId,
    currentDecisionExpiresInDays:
      current?.decision.effectiveTo == null ? null : daysBetween(context.today, current.decision.effectiveTo),
    openInfoRequestCount: infoRequestsOf(application.id).filter((request) => request.status === 'open').length,
    screeningFlagCount: unreviewedFlags(application.tenantId, application.supplierTenantId).length,
    link: `/buyer/qualification/applications/${application.id}`,
  };
}

export function recommendationRow(applicationId: number): Recommendation | null {
  const recommendation = RECOMMENDATIONS.find((candidate) => candidate.applicationId === applicationId);
  if (recommendation === undefined) {
    return null;
  }
  return {
    proposedOutcome: recommendation.proposedOutcome,
    scopeCategory: categoryRef(recommendation.scopeCategoryId),
    scopeMaxValue: recommendation.scopeMaxValue,
    scopeGeography: recommendation.scopeGeography,
    conditions: recommendation.conditions,
    allowedActivities: recommendation.allowedActivities,
    blockedGate: recommendation.blockedGate,
    rationale: recommendation.rationale,
    recommendedBy: personRef(recommendation.recommendedByUserId),
    recommendedAt: recommendation.recommendedAt,
    approvalRequestId: null,
    approvalStatus: null,
  };
}

const ASSESSABLE = ['under_review', 'more_info_required'] as const;

export function isAssessable(application: FxApplication): boolean {
  return (ASSESSABLE as readonly string[]).includes(application.status);
}

export function buyerActions(
  application: FxApplication,
  permissions: readonly PermissionCode[],
  userId: number,
): BuyerApplicationActions {
  const review = permissions.includes('qualification.review');
  const financial = permissions.includes('qualification.financial_review');
  const decide = permissions.includes('qualification.decide');
  const assigned = application.assessorUserId === userId || application.financialReviewerUserId === userId;
  return {
    canAssign: review && (application.status === 'submitted' || isAssessable(application)),
    canRecordFindings: (review || financial) && assigned && isAssessable(application),
    canRequestInfo: (review || financial) && assigned && isAssessable(application),
    canViewFinancialReview: financial || decide,
    canRecordFinancialReview: financial && application.financialReviewerUserId === userId && isAssessable(application),
    canRecommend: review && application.assessorUserId === userId && application.status === 'under_review',
    canDecide: decide && application.status === 'decision_pending',
  };
}

export function buyerApplicationDetail(
  application: FxApplication,
  context: ViewContext,
  permissions: readonly PermissionCode[],
  userId: number,
): BuyerApplicationDetail {
  const row = buyerApplicationRow(application, context);
  const { program } = programOfVersion(application.programVersionId);
  const answers = answersOf(application.id);
  const findings = QUALIFICATION_FINDINGS.filter((finding) => finding.applicationId === application.id);
  const requests = infoRequestsOf(application.id);
  const current = currentDecisionFor(application.tenantId, application.supplierTenantId, program.id, context);
  return {
    ...row,
    submittedBy: personRef(application.submittedByUserId ?? application.assessorUserId ?? 0),
    scopeGeography: application.scopeGeography,
    requiresIndependentApproval: program.requiresIndependentApproval,
    programCoveredCategories: coveredCategoriesOf(program),
    items: criteriaOf(application.programVersionId).map((criterion) => {
      const answer = answers.find((candidate) => candidate.criterionId === criterion.id);
      const finding = findings.find((candidate) => candidate.criterionId === criterion.id);
      return {
        criterion: criterionRow(criterion),
        answer: answer === undefined ? null : answerRow(answer),
        evidence: (answer?.evidence ?? []).map((citation) => evidenceSnapshot(citation, context)),
        evidenceMissing: answer !== undefined && evidenceMissing(criterion, answer),
        finding: finding === undefined ? null : findingRow(finding),
        openInfoRequestIds: requests
          .filter((request) => request.criterionId === criterion.id && request.status === 'open')
          .map((request) => request.id),
      };
    }),
    infoRequests: requests.map((request) => infoRequestRow(request, context)),
    generalFindings: findings.filter((finding) => finding.criterionId === null).map(findingRow),
    screenings: INTEGRITY_SCREENINGS.filter(
      (screening) => screening.tenantId === application.tenantId && screening.supplierTenantId === application.supplierTenantId,
    ).map(screeningRow),
    recommendation: recommendationRow(application.id),
    decisionId: decisionOfApplication(application.id)?.id ?? null,
    currentStatus: current?.effectiveStatus ?? 'not_assessed',
    financialReviewRecorded: financialReviewsOf(application.id).length > 0,
    customFields: applicationCustomValues(application),
    actions: buyerActions(application, permissions, userId),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Supplier views (SUP-20, SUP-24)
// ---------------------------------------------------------------------------------------------------------

export function buyersOfSupplier(supplierTenantId: number): number[] {
  return QUALIFICATION_RELATIONSHIPS.filter((relationship) => relationship.supplierTenantId === supplierTenantId).map(
    (relationship) => relationship.buyerTenantId,
  );
}

export function supplierStatusRows(supplierTenantId: number, context: ViewContext): SupplierStatusRow[] {
  const rows: SupplierStatusRow[] = [];
  for (const buyerTenantId of buyersOfSupplier(supplierTenantId)) {
    const programs = QUALIFICATION_PROGRAMS.filter(
      (program) => program.tenantId === buyerTenantId && program.status === 'active',
    );
    for (const program of programs) {
      const current = currentDecisionFor(buyerTenantId, supplierTenantId, program.id, context);
      const inProgress = applicationInProgress(buyerTenantId, supplierTenantId, program.id, true);
      rows.push({
        buyer: buyerRef(buyerTenantId),
        program: { programId: program.id, programName: program.name },
        programCategory: categoryRef(program.categoryId),
        coveredCategories: categoryWithDescendants(program.categoryId).map((category) => categoryRef(category.id)),
        effectiveStatus: current?.effectiveStatus ?? 'not_assessed',
        decisionId: current?.decision.id ?? null,
        scopeCategory: current === null ? null : categoryRef(current.decision.scopeCategoryId),
        scopeMaxValue: current?.decision.scopeMaxValue ?? null,
        effectiveTo: current?.decision.effectiveTo ?? null,
        blockedGate: current?.decision.blockedGate ?? null,
        applicationInProgress:
          inProgress === null
            ? null
            : { applicationId: inProgress.id, reference: inProgress.reference, status: inProgress.status },
      });
    }
  }
  return rows;
}

export function visibleProgramsForSupplier(supplierTenantId: number): FxProgram[] {
  const buyers = buyersOfSupplier(supplierTenantId);
  return QUALIFICATION_PROGRAMS.filter(
    (program) => buyers.includes(program.tenantId) && program.status === 'active' && program.currentVersionId !== null,
  );
}

export function supplierProgramRow(program: FxProgram, supplierTenantId: number, context: ViewContext): SupplierProgramRow {
  const current = findProgramVersion(program.currentVersionId ?? 0);
  if (current === undefined || current.approvedAt === null) {
    throw new Error(`Program ${program.id} has no approved current version.`);
  }
  const criteria = criteriaOf(current.id);
  const decision = currentDecisionFor(program.tenantId, supplierTenantId, program.id, context);
  const inProgress = applicationInProgress(program.tenantId, supplierTenantId, program.id, true);
  return {
    id: program.id,
    buyer: buyerRef(program.tenantId),
    name: program.name,
    description: program.description,
    category: categoryRef(program.categoryId),
    coveredCategories: categoryWithDescendants(program.categoryId).map((category) => categoryRef(category.id)),
    geography: program.geography,
    maxContractValue: program.maxContractValue,
    validityMonths: program.validityMonths,
    currentVersion: { programVersionId: current.id, versionNo: current.versionNo, approvedAt: current.approvedAt },
    criteriaCount: criteria.length,
    areaCounts: areaCounts(criteria),
    myStatus: decision?.effectiveStatus ?? 'not_assessed',
    myApplicationInProgress:
      inProgress === null ? null : { applicationId: inProgress.id, reference: inProgress.reference, status: inProgress.status },
  };
}

export function supplierProgramDetail(
  program: FxProgram,
  supplierTenantId: number,
  context: ViewContext,
): SupplierProgramDetail {
  return {
    ...supplierProgramRow(program, supplierTenantId, context),
    criteria: criteriaOf(program.currentVersionId ?? 0).map(criterionRow),
    renewalNoticeDays: program.renewalNoticeDays,
    requiresIndependentApproval: program.requiresIndependentApproval,
  };
}

export function supplierApplicationRow(application: FxApplication, context: ViewContext): SupplierApplicationRow {
  const requests = infoRequestsOf(application.id).filter((request) => request.status === 'open');
  const next = [...requests].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  return {
    id: application.id,
    reference: application.reference,
    buyer: buyerRef(application.tenantId),
    program: programVersionRef(application.programVersionId),
    scopeCategory: categoryRef(application.scopeCategoryId),
    scopeMaxValue: application.scopeMaxValue,
    status: application.status,
    submittedAt: application.submittedAt,
    updatedAt: application.updatedAt,
    completeness: completeness(application, context),
    openInfoRequestCount: requests.length,
    nextDueAt: next === undefined ? null : { at: next.dueAt, timeZone: context.timeZone },
    renewalOfDecisionId: application.renewalOfDecisionId,
    decisionId: decisionOfApplication(application.id)?.id ?? null,
    link: `/supplier/qualification/applications/${application.id}`,
  };
}

export function supplierApplicationDetail(application: FxApplication, context: ViewContext): SupplierApplicationDetail {
  const answers = answersOf(application.id);
  const requests = infoRequestsOf(application.id);
  const open = application.status !== 'decided' && application.status !== 'withdrawn';
  return {
    ...supplierApplicationRow(application, context),
    scopeGeography: application.scopeGeography,
    submittedBy: person(application.submittedByUserId),
    items: criteriaOf(application.programVersionId).map((criterion) => {
      const answer = answers.find((candidate) => candidate.criterionId === criterion.id);
      return {
        criterion: criterionRow(criterion),
        answer: answer === undefined ? null : answerRow(answer),
        evidence: (answer?.evidence ?? []).map((citation) => evidenceSnapshot(citation, context)),
        evidenceMissing: answer !== undefined && evidenceMissing(criterion, answer),
        openInfoRequestIds: requests
          .filter((request) => request.criterionId === criterion.id && request.status === 'open')
          .map((request) => request.id),
      };
    }),
    infoRequests: requests.map((request) => infoRequestRow(request, context)),
    withdrawnReason: application.withdrawnReason,
    canEdit: application.status === 'draft',
    canSubmit: application.status === 'draft',
    canWithdraw: open,
    customFields: supplierVisibleValues(application.tenantId, 'qualification_application', applicationCustomValues(application)),
  };
}

export function renewalDueFrom(decision: FxDecision): string | null {
  if (decision.effectiveTo === null) {
    return null;
  }
  const program = programOfVersion(decision.programVersionId).program;
  return addDays(decision.effectiveTo, -program.renewalNoticeDays);
}

export function supplierDecisionRow(decision: FxDecision, context: ViewContext): SupplierDecision {
  const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.id === decision.applicationId);
  return {
    id: decision.id,
    buyer: buyerRef(decision.tenantId),
    applicationId: decision.applicationId,
    applicationReference: application?.reference ?? 'QA-UNKNOWN',
    program: programVersionRef(decision.programVersionId),
    outcome: decision.outcome,
    effectiveStatus: effectiveStatusOf(decision, context.today),
    scopeCategory: categoryRef(decision.scopeCategoryId),
    scopeMaxValue: decision.scopeMaxValue,
    scopeGeography: decision.scopeGeography,
    effectiveFrom: decision.effectiveFrom,
    effectiveTo: decision.effectiveTo,
    reassessmentDate: decision.reassessmentDate,
    renewalDueFrom: renewalDueFrom(decision),
    conditions: decision.conditions,
    allowedActivities: decision.allowedActivities,
    blockedGate: decision.blockedGate,
    supplierExplanation: decision.supplierExplanation,
    appealRoute: decision.appealRoute,
    decidedAt: decision.decidedAt,
    supersededById: decision.supersededById,
    current: decision.supersededById === null,
  };
}

export function isReconsiderable(decision: FxDecision): boolean {
  return decision.supersededById === null && decision.outcome !== 'qualified' && decision.outcome !== 'withdrawn';
}

export function supplierDecisionDetail(
  decision: FxDecision,
  context: ViewContext,
  canApply: boolean,
): SupplierDecisionDetail {
  const program = programOfVersion(decision.programVersionId).program;
  const renewal = renewalApplicationOf(decision);
  const reconsideration = reconsiderationOf(decision);
  const row = supplierDecisionRow(decision, context);
  const dueFrom = row.renewalDueFrom;
  const renewable =
    row.current &&
    (row.effectiveStatus === 'qualified' ||
      row.effectiveStatus === 'qualified_with_conditions' ||
      row.effectiveStatus === 'expired') &&
    (dueFrom === null || dueFrom <= context.today) &&
    (renewal === undefined || renewal.status === 'decided' || renewal.status === 'withdrawn');
  return {
    ...row,
    history: historyOf(decision).map((entry) => {
      const historic = supplierDecisionRow(entry, context);
      return {
        id: historic.id,
        outcome: historic.outcome,
        effectiveStatus: historic.effectiveStatus,
        effectiveFrom: historic.effectiveFrom,
        effectiveTo: historic.effectiveTo,
        decidedAt: historic.decidedAt,
        supersededById: historic.supersededById,
      };
    }),
    expiringEvidence: decisionEvidence(decision, context, program.renewalNoticeDays),
    evidenceUpdates: evidenceUpdatesOf(decision),
    reconsideration,
    renewalApplicationId: renewal?.id ?? null,
    renewalRequestedAt: decision.renewalRequestedAt,
    canRequestReconsideration: canApply && isReconsiderable(decision) && reconsideration === null,
    canSupplyEvidence: canApply && decision.supersededById === null,
    canRenew: canApply && renewable,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Sorting and filtering helpers
// ---------------------------------------------------------------------------------------------------------

export function sortBy<T>(rows: T[], key: (row: T) => string | number | null, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === right) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    if (right === null) {
      return -1;
    }
    return (left < right ? -1 : 1) * factor;
  });
}

export function matchesText(query: string | undefined, ...values: Array<string | null | undefined>): boolean {
  if (query === undefined || query.trim() === '') {
    return true;
  }
  const needle = query.trim().toLowerCase();
  return values.some((value) => value !== null && value !== undefined && value.toLowerCase().includes(needle));
}

export function withinDates(value: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  if (value === null) {
    return false;
  }
  const date = value.slice(0, 10);
  return (from === undefined || date >= from) && (to === undefined || date <= to);
}

export const PRIORITY_RANK: Record<string, number> = { low: 1, normal: 2, high: 3, urgent: 4 };
export const RISK_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

