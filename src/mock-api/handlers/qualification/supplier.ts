/**
 * Supplier qualification handlers: programs and applications (SUP-20), decisions and renewals (SUP-24).
 *
 * A supplier sees only its own applications and decisions, each labelled with the deciding buyer, and only the
 * programs of buyers it has a relationship with. Findings, financial reviews, screenings, triggers and internal
 * decision reasons never leave the buyer (PRD §4.3, §7.3; DD-03). Another supplier's record is simply not found.
 */
import {
  createSupplierApplication,
  getSupplierApplication,
  getSupplierDecision,
  getSupplierOverview,
  getSupplierProgram,
  listEvidenceCandidates,
  listSupplierApplications,
  listSupplierDecisions,
  listSupplierPrograms,
  requestReconsideration,
  respondToInfoRequest,
  saveSupplierAnswers,
  submitSupplierApplication,
  supplyDecisionEvidence,
  withdrawSupplierApplication,
} from '../../../contracts/qualification.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import type { FxAnswer, FxApplication, FxEvidenceItem } from '../../fixtures/qualification/index.js';
import {
  EVIDENCE_ITEMS,
  QUALIFICATION_APPLICATIONS,
  QUALIFICATION_DECISIONS,
  RECONSIDERATIONS,
  SUPPLIER_IDENTITIES,
  criteriaOf,
  findEvidenceItem,
} from '../../fixtures/qualification/index.js';
import { acceptCustomFields, customFieldIssues } from '../../custom-fields.js';
import { personRef } from '../../persona.js';
import {
  addDays,
  answersOf,
  applicationCustomContext,
  applicationCustomValues,
  buyersOfSupplier,
  completeness,
  effectiveStatusOf,
  evidenceMissing,
  evidenceSnapshot,
  infoRequestRow,
  infoRequestsOf,
  isOpenApplication,
  isReconsiderable,
  isReconsiderationWindowOpen,
  matchesText,
  programOfVersion,
  scopeFitsProgram,
  sortBy,
  supplierApplicationDetail,
  supplierApplicationRow,
  supplierDecisionDetail,
  supplierDecisionRow,
  supplierProgramDetail,
  supplierProgramRow,
  supplierRef,
  supplierStatusRows,
  viewContext,
  visibleProgramsForSupplier,
  withinDates,
} from './views.js';

const NEW_ID = 900;

function ownEvidence(supplierTenantId: number, evidenceItemId: number): FxEvidenceItem | undefined {
  const item = findEvidenceItem(evidenceItemId);
  return item?.supplierTenantId === supplierTenantId ? item : undefined;
}

export function registerSupplier(app: MockApp): void {
  mockRoute(app, getSupplierOverview, ({ requireTenant, now }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const identity = SUPPLIER_IDENTITIES.find((candidate) => candidate.supplierTenantId === tenant.id);
    const statuses = supplierStatusRows(tenant.id, context);
    const horizon = addDays(context.today, 60);
    const decisions = QUALIFICATION_DECISIONS.filter(
      (decision) => decision.supplierTenantId === tenant.id && decision.supersededById === null,
    );
    const cited = new Map<number, number[]>();
    for (const decision of decisions) {
      for (const answer of answersOf(decision.applicationId)) {
        for (const citation of answer.evidence) {
          cited.set(citation.evidenceItemId, [...(cited.get(citation.evidenceItemId) ?? []), decision.id]);
        }
      }
    }
    const expiring = EVIDENCE_ITEMS.filter(
      (item) =>
        item.supplierTenantId === tenant.id &&
        (item.status === 'current' || item.status === 'expired') &&
        item.expiresAt !== null &&
        item.expiresAt <= horizon,
    ).sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''));
    return {
      supplier: supplierRef(tenant.id),
      registrationStatus: tenant.status,
      verificationStatus: identity?.verificationStatus ?? 'unverified',
      statuses,
      openInfoRequests: QUALIFICATION_APPLICATIONS.filter((application) => application.supplierTenantId === tenant.id)
        .flatMap((application) => infoRequestsOf(application.id))
        .filter((request) => request.status === 'open').length,
      expiringEvidence: expiring.map((item) => ({
        evidenceItemId: item.id,
        title: item.title,
        evidenceType: item.evidenceType,
        expiresAt: item.expiresAt ?? context.today,
        citedByDecisionIds: [...new Set(cited.get(item.id) ?? [])],
      })),
    };
  });

  mockRoute(app, listSupplierPrograms, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const rows = visibleProgramsForSupplier(tenant.id)
      .filter((program) => query.buyerTenantId === undefined || program.tenantId === query.buyerTenantId)
      .map((program) => supplierProgramRow(program, tenant.id, context))
      .filter(
        (row) =>
          query.categoryCode === undefined ||
          row.coveredCategories.some((category) => category.code === query.categoryCode),
      )
      .filter((row) => query.myStatus === undefined || query.myStatus.includes(row.myStatus))
      .filter((row) => matchesText(query.q, row.name, row.buyer.name, row.category.code, row.category.name));
    const key = (row: (typeof rows)[number]): string =>
      query.sort === 'buyerName' ? `${row.buyer.name} ${row.name}` : row.name;
    return fixtures.page(sortBy(rows, key, query.dir));
  });

  mockRoute(app, getSupplierProgram, ({ requireTenant, params, now, notFound }) => {
    const { tenant } = requireTenant();
    const program = visibleProgramsForSupplier(tenant.id).find((candidate) => candidate.id === params.programId);
    if (program === undefined) {
      return notFound('No such qualification program.');
    }
    return supplierProgramDetail(program, tenant.id, viewContext(now, tenant.officialTimeZone));
  });

  mockRoute(app, listSupplierApplications, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const rows = QUALIFICATION_APPLICATIONS.filter((application) => application.supplierTenantId === tenant.id)
      .filter((application) => query.status === undefined || query.status.includes(application.status))
      .filter((application) => query.buyerTenantId === undefined || application.tenantId === query.buyerTenantId)
      .filter(
        (application) =>
          query.programId === undefined || programOfVersion(application.programVersionId).program.id === query.programId,
      )
      .filter((application) => withinDates(application.updatedAt, query.updatedFrom, query.updatedTo))
      .map((application) => supplierApplicationRow(application, context))
      .filter((row) => matchesText(query.q, row.reference, row.program.programName, row.buyer.name, row.scopeCategory.code));
    const key = (row: (typeof rows)[number]): string | null => {
      switch (query.sort) {
        case 'reference':
          return row.reference;
        case 'submittedAt':
          return row.submittedAt;
        case 'status':
          return row.status;
        default:
          return row.updatedAt;
      }
    };
    return fixtures.page(sortBy(rows, key, query.sort === undefined ? 'desc' : query.dir));
  });

  function ownApplication(supplierTenantId: number, applicationId: number, notFound: (detail?: string) => never) {
    const application = QUALIFICATION_APPLICATIONS.find(
      (candidate) => candidate.id === applicationId && candidate.supplierTenantId === supplierTenantId,
    );
    return application ?? notFound('No such qualification application.');
  }

  mockRoute(app, getSupplierApplication, ({ requireTenant, params, now, notFound }) => {
    const { tenant } = requireTenant();
    const application = ownApplication(tenant.id, params.applicationId, notFound);
    return supplierApplicationDetail(application, viewContext(now, tenant.officialTimeZone));
  });

  mockRoute(app, createSupplierApplication, ({ requireTenant, body, now, fail }) => {
    const { tenant } = requireTenant();
    const program = visibleProgramsForSupplier(tenant.id).find((candidate) => candidate.id === body.programId);
    if (program === undefined || program.currentVersionId === null) {
      return fail(422, 'PROGRAM_NOT_OPEN', 'The program is not open for applications.');
    }
    if (
      QUALIFICATION_APPLICATIONS.some(
        (application) =>
          application.supplierTenantId === tenant.id &&
          programOfVersion(application.programVersionId).program.id === program.id &&
          (application.status === 'draft' || isOpenApplication(application)),
      )
    ) {
      fail(409, 'APPLICATION_ALREADY_OPEN', 'An application for this program is already in progress.');
    }
    const fit = scopeFitsProgram(program, body.scopeCategoryId, body.scopeMaxValue);
    if (!fit.categoryCovered) {
      fail(422, 'SCOPE_OUTSIDE_PROGRAM', 'The category is not covered by this program.');
    }
    if (!fit.valueWithin) {
      fail(422, 'SCOPE_EXCEEDS_PROGRAM', 'The requested value exceeds the program’s maximum contract value.');
    }
    if (body.renewalOfDecisionId !== null) {
      const decision = QUALIFICATION_DECISIONS.find(
        (candidate) => candidate.id === body.renewalOfDecisionId && candidate.supplierTenantId === tenant.id,
      );
      if (
        decision === undefined ||
        decision.supersededById !== null ||
        programOfVersion(decision.programVersionId).program.id !== program.id
      ) {
        fail(409, 'DECISION_NOT_RENEWABLE', 'Only your current decision under this program can be renewed.');
      }
    }
    const createdAt = now.toISOString();
    const draft: FxApplication = {
      id: NEW_ID,
      tenantId: program.tenantId,
      supplierTenantId: tenant.id,
      programVersionId: program.currentVersionId,
      reference: null,
      status: 'draft',
      scopeCategoryId: body.scopeCategoryId,
      scopeMaxValue: body.scopeMaxValue,
      scopeGeography: body.scopeGeography,
      submittedAt: null,
      submittedByUserId: null,
      assessorUserId: null,
      financialReviewerUserId: null,
      dueAt: null,
      priority: 'normal',
      riskLevel: null,
      renewalOfDecisionId: body.renewalOfDecisionId,
      withdrawnReason: null,
      createdAt,
      updatedAt: createdAt,
    };
    return supplierApplicationDetail(draft, viewContext(now, tenant.officialTimeZone));
  });

  mockRoute(app, saveSupplierAnswers, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = ownApplication(tenant.id, params.applicationId, notFound);
    if (application.status !== 'draft') {
      fail(409, 'APPLICATION_NOT_EDITABLE', 'Submitted answers are kept as submitted; respond to information requests instead.');
    }
    const criteria = criteriaOf(application.programVersionId);
    const caller = requirePersona();
    const savedAt = now.toISOString();
    const replacements: FxAnswer[] = body.answers.map((input, index) => {
      const criterion = criteria.find((candidate) => candidate.id === input.criterionId);
      if (criterion === undefined) {
        return fail(422, 'CRITERION_NOT_IN_VERSION', `Criterion ${input.criterionId} is not part of this application.`);
      }
      const items = input.evidenceItemIds.map((id) => {
        const item = ownEvidence(tenant.id, id);
        if (item === undefined) {
          return fail(422, 'EVIDENCE_NOT_FOUND', `Evidence item ${id} is not in your library.`);
        }
        if (!criterion.evidenceTypes.includes(item.evidenceType)) {
          return fail(422, 'EVIDENCE_TYPE_MISMATCH', `“${item.title}” is not an accepted evidence type for this criterion.`);
        }
        return item;
      });
      const position = criteria.indexOf(criterion) + 1;
      return {
        id: application.id * 100 + position,
        tenantId: application.tenantId,
        applicationId: application.id,
        criterionId: criterion.id,
        applicability: input.applicability,
        naReason: input.naReason,
        answerText: input.answerText,
        answerNumber: input.answerNumber,
        answerDate: input.answerDate,
        answerBool: input.answerBool,
        updatedByUserId: caller.userId,
        updatedAt: savedAt,
        evidence: items.map((item, itemIndex) => ({
          evidenceSubmissionId: NEW_ID * 1000 + index * 10 + itemIndex,
          evidenceItemId: item.id,
          submittedAt: savedAt,
        })),
      };
    });
    const context = viewContext(now, tenant.officialTimeZone);
    const customFields = acceptCustomFields(
      application.tenantId,
      'qualification_application',
      body.customFields,
      applicationCustomValues(application),
      applicationCustomContext(application),
      'supplier',
    );
    const detail = supplierApplicationDetail({ ...application, updatedAt: savedAt, customFields }, context);
    return {
      ...detail,
      items: detail.items.map((item) => {
        const replacement = replacements.find((answer) => answer.criterionId === item.criterion.id);
        if (replacement === undefined) {
          return item;
        }
        const criterion = criteria.find((candidate) => candidate.id === item.criterion.id);
        return {
          ...item,
          answer: {
            id: replacement.id,
            applicability: replacement.applicability,
            naReason: replacement.naReason,
            answerText: replacement.answerText,
            answerNumber: replacement.answerNumber,
            answerDate: replacement.answerDate,
            answerBool: replacement.answerBool,
            updatedBy: personRef(caller.userId),
            updatedAt: savedAt,
          },
          evidence: replacement.evidence.map((citation) => evidenceSnapshot(citation, context)),
          evidenceMissing: criterion === undefined ? false : evidenceMissing(criterion, replacement),
        };
      }),
    };
  });

  mockRoute(app, listEvidenceCandidates, ({ requireTenant, params, now, notFound }) => {
    const { tenant } = requireTenant();
    const application = ownApplication(tenant.id, params.applicationId, notFound);
    const context = viewContext(now, tenant.officialTimeZone);
    const criteria = criteriaOf(application.programVersionId);
    const soon = addDays(context.today, 30);
    return {
      items: EVIDENCE_ITEMS.filter((item) => item.supplierTenantId === tenant.id && item.status === 'current')
        .map((item) => ({
          evidenceItemId: item.id,
          evidenceType: item.evidenceType,
          title: item.title,
          issuer: item.issuer,
          periodEnd: item.periodEnd,
          expiresAt: item.expiresAt,
          status: item.status,
          verificationStatus: item.verificationStatus,
          criterionIds: criteria
            .filter((criterion) => criterion.evidenceTypes.includes(item.evidenceType))
            .map((criterion) => criterion.id),
          expiringSoon: item.expiresAt !== null && item.expiresAt <= soon,
        }))
        .filter((candidate) => candidate.criterionIds.length > 0),
    };
  });

  mockRoute(app, submitSupplierApplication, ({ requireTenant, requirePersona, params, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = ownApplication(tenant.id, params.applicationId, notFound);
    if (application.status !== 'draft') {
      fail(409, 'APPLICATION_NOT_DRAFT', 'Only a draft application can be submitted.');
    }
    const context = viewContext(now, tenant.officialTimeZone);
    const readiness = completeness(application, context);
    if (readiness.mandatoryUnanswered > 0) {
      fail(422, 'MANDATORY_ANSWERS_MISSING', `${readiness.mandatoryUnanswered} mandatory criteria are unanswered.`);
    }
    if (readiness.mandatoryEvidenceMissing > 0) {
      fail(422, 'MANDATORY_EVIDENCE_MISSING', `${readiness.mandatoryEvidenceMissing} mandatory criteria have no evidence.`);
    }
    if (readiness.naWithoutReason > 0) {
      fail(422, 'NA_REASON_MISSING', 'Every “not applicable” answer needs a reason.');
    }
    const missingCustom = customFieldIssues(
      application.tenantId,
      'qualification_application',
      applicationCustomValues(application),
      applicationCustomContext(application),
      true,
      'supplier',
    );
    if (missingCustom.length > 0) {
      fail(422, 'MANDATORY_ANSWERS_MISSING', `Complete the additional information: ${missingCustom.map((issue) => issue.message).join(' ')}`);
    }
    if (readiness.expiredEvidence > 0) {
      fail(409, 'EVIDENCE_EXPIRED', `${readiness.expiredEvidence} cited evidence items have expired; attach current editions.`);
    }
    const submittedAt = now.toISOString();
    const year = submittedAt.slice(0, 4);
    const submitted: FxApplication = {
      ...application,
      status: 'submitted',
      reference: `QA-${year}-0${NEW_ID}`,
      submittedAt,
      submittedByUserId: requirePersona().userId,
      updatedAt: submittedAt,
    };
    return supplierApplicationDetail(submitted, context);
  });

  mockRoute(app, withdrawSupplierApplication, ({ requireTenant, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = ownApplication(tenant.id, params.applicationId, notFound);
    if (application.status === 'decided' || application.status === 'withdrawn') {
      fail(409, 'APPLICATION_NOT_WITHDRAWABLE', `An application in status ${application.status} cannot be withdrawn.`);
    }
    return supplierApplicationDetail(
      { ...application, status: 'withdrawn', withdrawnReason: body.reason, updatedAt: now.toISOString() },
      viewContext(now, tenant.officialTimeZone),
    );
  });

  mockRoute(app, respondToInfoRequest, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const application = ownApplication(tenant.id, params.applicationId, notFound);
    const request = infoRequestsOf(application.id).find((candidate) => candidate.id === params.infoRequestId);
    if (request === undefined) {
      return fail(404, 'INFO_REQUEST_NOT_FOUND', 'No such information request on this application.');
    }
    if (request.status !== 'open') {
      fail(409, 'INFO_REQUEST_NOT_OPEN', 'This information request is no longer open.');
    }
    const respondedAt = now.toISOString();
    const evidence = body.evidenceItemIds.map((id, index) => {
      if (ownEvidence(tenant.id, id) === undefined) {
        return fail(422, 'EVIDENCE_NOT_FOUND', `Evidence item ${id} is not in your library.`);
      }
      return { evidenceSubmissionId: NEW_ID * 1000 + index, evidenceItemId: id, submittedAt: respondedAt };
    });
    const stillOpen = infoRequestsOf(application.id).some(
      (candidate) => candidate.id !== request.id && candidate.status === 'open',
    );
    return {
      infoRequest: infoRequestRow(
        {
          ...request,
          status: 'answered',
          responseText: body.responseText,
          respondedByUserId: requirePersona().userId,
          respondedAt,
          responseEvidence: evidence,
        },
        viewContext(now, tenant.officialTimeZone),
      ),
      applicationStatus: stillOpen ? 'more_info_required' : 'under_review',
    };
  });

  mockRoute(app, listSupplierDecisions, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const context = viewContext(now, tenant.officialTimeZone);
    const buyers = buyersOfSupplier(tenant.id);
    const rows = QUALIFICATION_DECISIONS.filter(
      (decision) => decision.supplierTenantId === tenant.id && buyers.includes(decision.tenantId),
    )
      .filter((decision) => query.includeSuperseded === true || decision.supersededById === null)
      .filter((decision) => query.buyerTenantId === undefined || decision.tenantId === query.buyerTenantId)
      .filter(
        (decision) =>
          query.effectiveStatus === undefined || query.effectiveStatus.includes(effectiveStatusOf(decision, context.today)),
      )
      .filter(
        (decision) =>
          query.expiringBefore === undefined || (decision.effectiveTo !== null && decision.effectiveTo <= query.expiringBefore),
      )
      .map((decision) => supplierDecisionRow(decision, context))
      .filter((row) => matchesText(query.q, row.buyer.name, row.program.programName, row.applicationReference));
    const key = (row: (typeof rows)[number]): string | null => {
      switch (query.sort) {
        case 'effectiveTo':
          return row.effectiveTo;
        case 'buyerName':
          return row.buyer.name;
        default:
          return row.decidedAt;
      }
    };
    return fixtures.page(sortBy(rows, key, query.sort === undefined ? 'desc' : query.dir));
  });

  function ownDecision(supplierTenantId: number, decisionId: number, notFound: (detail?: string) => never) {
    const decision = QUALIFICATION_DECISIONS.find(
      (candidate) => candidate.id === decisionId && candidate.supplierTenantId === supplierTenantId,
    );
    return decision ?? notFound('No such qualification decision.');
  }

  mockRoute(app, getSupplierDecision, ({ requireTenant, params, now, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const decision = ownDecision(tenant.id, params.decisionId, notFound);
    return supplierDecisionDetail(
      decision,
      viewContext(now, tenant.officialTimeZone),
      permissions.includes('supplier.qualification.apply'),
    );
  });

  mockRoute(app, requestReconsideration, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const decision = ownDecision(tenant.id, params.decisionId, notFound);
    if (!isReconsiderable(decision)) {
      fail(409, 'DECISION_NOT_RECONSIDERABLE', 'Only a current decision that restricts you can be reconsidered.');
    }
    if (RECONSIDERATIONS.some((candidate) => candidate.decisionId === decision.id)) {
      fail(409, 'RECONSIDERATION_ALREADY_REQUESTED', 'A reconsideration of this decision is already under review.');
    }
    if (!isReconsiderationWindowOpen(decision, now)) {
      fail(
        409,
        'RECONSIDERATION_WINDOW_CLOSED',
        'The reconsideration window stated in this decision has closed. Use the escalation route in its appeal terms.',
      );
    }
    for (const id of body.evidenceItemIds) {
      if (ownEvidence(tenant.id, id) === undefined) {
        fail(422, 'EVIDENCE_NOT_FOUND', `Evidence item ${id} is not in your library.`);
      }
    }
    return {
      decisionId: decision.id,
      grounds: body.grounds,
      requestedAt: now.toISOString(),
      requestedBy: personRef(requirePersona().userId),
      evidenceItemIds: body.evidenceItemIds,
      appealRoute: decision.appealRoute,
      resolvedByDecisionId: null,
    };
  });

  mockRoute(app, supplyDecisionEvidence, ({ requireTenant, requirePersona, params, body, now, notFound, fail }) => {
    const { tenant } = requireTenant();
    const decision = ownDecision(tenant.id, params.decisionId, notFound);
    if (decision.supersededById !== null) {
      fail(409, 'DECISION_SUPERSEDED', 'This decision was superseded; supply evidence for the current one.');
    }
    const item = ownEvidence(tenant.id, body.evidenceItemId);
    if (item === undefined) {
      return fail(422, 'EVIDENCE_NOT_FOUND', 'The evidence item is not in your library.');
    }
    const context = viewContext(now, tenant.officialTimeZone);
    if (item.status !== 'current' || (item.expiresAt !== null && item.expiresAt < context.today)) {
      fail(409, 'EVIDENCE_NOT_CURRENT', 'Supply a current, unexpired evidence item.');
    }
    return {
      id: NEW_ID,
      decisionId: decision.id,
      evidenceItemId: item.id,
      title: item.title,
      expiresAt: item.expiresAt,
      note: body.note,
      submittedAt: now.toISOString(),
      submittedBy: personRef(requirePersona().userId),
    };
  });
}
