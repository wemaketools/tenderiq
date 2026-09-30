/**
 * The supplier and public views of a tender package (BUY-13 "review the supplier/public view").
 *
 * Buyer-internal content never appears: estimates, budget, team, buyer-internal documents and undisclosed internal
 * dates are withheld (PRD §4.3). The public sees the notice, lots, disclosed dates and public documents of an open
 * or restricted event, and nothing of an invitation-only event. Participating suppliers see the full issued package.
 */
import type { PackagePreview, PreviewAudience } from '../../../contracts/tenders.js';
import { LEGAL_ENTITIES, PACKAGE_DOCUMENTS, TENDER_TERMS } from '../../fixtures/tenders/index.js';
import { categoryRef, tenantName } from './model.js';
import type { TenderState } from './model.js';

export function previewOf(state: TenderState, audience: PreviewAudience): PackagePreview {
  const { tender } = state;
  const lotNo = (lotId: number | null): number | null => state.lots.find((lot) => lot.id === lotId)?.lotNo ?? null;
  const publicView = audience === 'public';
  const invitationOnly = tender.participation === 'invitation_only';
  const restricted = tender.participation === 'restricted';
  const visible = !(publicView && invitationOnly);
  const hiddenReason = publicView && invitationOnly ? 'invitation_only' : publicView && restricted ? 'restricted_access_required' : null;
  const documents = PACKAGE_DOCUMENTS.filter(
    (doc) =>
      doc.tenderId === tender.id &&
      (doc.classification === 'public' || (!publicView && doc.classification === 'participating_suppliers')),
  );
  const internalDocuments = PACKAGE_DOCUMENTS.filter(
    (doc) => doc.tenderId === tender.id && doc.classification !== 'public' && doc.classification !== 'participating_suppliers',
  ).length;
  const undisclosed = state.milestones.filter((row) => !row.isDisclosed).length;
  const fullPackage = visible && !publicView;
  const plan = state.plans[0];
  const withheld = [
    'Estimated value and budget',
    'Tender team and reviewers',
    ...(internalDocuments > 0 ? [`Buyer-internal documents (${internalDocuments})`] : []),
    ...(undisclosed > 0 ? [`Internal dates not disclosed to suppliers (${undisclosed})`] : []),
    ...(publicView ? ['Requirements, pricing schedules, evaluation rules and terms (participating suppliers only)'] : []),
  ];
  if (!visible) {
    return {
      tenderId: tender.id,
      audience,
      draftRevision: tender.draftRevision,
      visible: false,
      hiddenReason,
      notice: null,
      lots: [],
      milestones: [],
      requirements: [],
      pricingSchedules: [],
      evaluation: null,
      participationConditions: [],
      terms: [],
      documents: [],
      withheld: ['The whole package: this event is by invitation only and is never shown publicly.'],
    };
  }
  return {
    tenderId: tender.id,
    audience,
    draftRevision: tender.draftRevision,
    visible: true,
    hiddenReason,
    notice: {
      reference: tender.reference,
      title: tender.title,
      summary: tender.summary,
      buyerName: tenantName(tender.tenantId),
      contractingEntity: LEGAL_ENTITIES.find((row) => row.id === tender.legalEntityId)?.name ?? null,
      eventType: tender.eventType,
      procedure: tender.procedure,
      participation: tender.participation,
      category: categoryRef(tender.categoryId),
      currency: tender.currency,
      acceptedCurrencies: [...tender.acceptedCurrencies],
      acceptedLanguages: [...tender.acceptedLanguages],
      bidValidityDays: tender.bidValidityDays,
      awardModel: tender.awardModel,
      eligibilitySummary: tender.eligibilitySummary,
      deliveryRequirements: tender.deliveryRequirements,
      submissionRules: tender.submissionRules,
      lateMaterialRule: tender.lateMaterialRule,
      communicationChannelNote: tender.communicationChannelNote,
      permitted: {
        partialBids: tender.partialBidsAllowed,
        alternatives: tender.alternativesAllowed,
        negotiation: tender.negotiationPermitted,
        demonstrations: tender.demonstrationsPermitted,
        references: tender.referencesPermitted,
        finalOffers: tender.bafoPermitted,
      },
    },
    lots: state.lots.map((lot) => ({
      lotNo: lot.lotNo,
      title: lot.title,
      description: lot.description,
      quantityDescription: lot.quantityDescription,
      deliveryLocation: lot.deliveryLocation,
      deliveryDate: lot.deliveryDate,
    })),
    milestones: state.milestones
      .filter((row) => row.isDisclosed)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((row) => ({ milestone: row.milestone, lotNo: lotNo(row.lotId), deadline: { at: row.at, timeZone: tender.officialTimeZone } })),
    requirements: fullPackage
      ? [...state.requirements]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((row) => ({
            refCode: row.refCode,
            section: row.section,
            lotNo: lotNo(row.lotId),
            text: row.text,
            responseType: row.responseType,
            choices: [...row.choices],
            responseInstructions: row.responseInstructions,
            evidenceRequired: row.evidenceRequired,
            treatment: row.treatment,
            envelope: row.envelope,
            missingConsequence: row.missingConsequence,
          }))
      : [],
    pricingSchedules: fullPackage
      ? state.schedules.map((schedule) => ({
          name: schedule.name,
          lotNo: lotNo(schedule.lotId),
          instructions: schedule.instructions,
          taxTreatment: schedule.taxTreatment,
          evaluationPeriods: schedule.evaluationPeriods,
          discountsAccepted: [...schedule.discountsAccepted],
          discountEvaluationNote: schedule.discountEvaluationNote,
          priceEntries: [...schedule.priceEntries],
          items: schedule.items.map(({ id: _id, sortOrder: _sortOrder, ...item }) => ({ ...item })),
        }))
      : [],
    evaluation:
      fullPackage && plan !== undefined
        ? {
            criteria: plan.criteria.map((row) => ({
              code: row.code,
              name: row.name,
              maxPoints: row.maxPoints,
              isPrice: row.isPrice,
              minScore: row.minScore,
            })),
            priceMethod: plan.priceMethod,
            priceFormulaNote: plan.priceFormulaNote,
            zeroPriceTreatment: plan.zeroPriceTreatment,
            missingPriceTreatment: plan.missingPriceTreatment,
            thresholdScope: plan.thresholdScope,
            nonPriceThreshold: plan.nonPriceThreshold,
            tieBreakRules: plan.tieBreakRules.map((rule) => ({
              sequence: rule.sequence,
              rule: rule.rule,
              criterionCode: plan.criteria.find((row) => row.id === rule.criterionId)?.code ?? null,
            })),
          }
        : null,
    participationConditions: state.conditions.map((row) => ({
      conditionType: row.conditionType,
      description: row.description,
      blocking: row.blocking,
    })),
    terms: fullPackage
      ? TENDER_TERMS.filter((row) => row.tenderId === tender.id).map((row) => ({ termType: row.termType, content: row.content }))
      : [],
    documents: documents.map((doc) => ({
      documentId: doc.documentId,
      title: doc.title,
      fileName: doc.fileName,
      classification: doc.classification,
      language: doc.language,
      precedence: doc.precedence,
    })),
    withheld,
  };
}
