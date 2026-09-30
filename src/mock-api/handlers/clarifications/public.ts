/**
 * Public edition of a tender's clarifications (PUB-04, DD-13, DD-22): only tenders on the public portal, only
 * answers published with audience `public` (sanitized, no questioner identity) and only issued addenda.
 * An invitation-only or unknown tender is simply not found.
 */
import { clarificationsEndpoints as api } from '../../../contracts/clarifications.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { ADDENDA, CLARIFICATION_TENDERS, QUESTIONS } from '../../fixtures/clarifications/index.js';
import { findTenantBySlug } from '../../persona.js';
import { affectedLots, deadline, matchesText, requirementChanges, sharedAnswer, sortBy } from './projections.js';

export function registerPublic(app: MockApp): void {
  mockRoute(app, api.publicEdition, ({ params, query, notFound }) => {
    const buyer = findTenantBySlug(params.buyerSlug);
    const tender =
      buyer === undefined || buyer.kind !== 'buyer' || buyer.status !== 'active'
        ? undefined
        : CLARIFICATION_TENDERS.find((row) => row.tenantId === buyer.id && row.reference === params.ref && row.onPublicPortal);
    if (buyer === undefined || tender === undefined) {
      return notFound();
    }
    const questions = QUESTIONS.filter(
      (question) => question.tenderId === tender.id && question.status === 'published' && question.audience === 'public',
    )
      .filter((question) => query.lotId === undefined || question.lotId === query.lotId)
      .map(sharedAnswer)
      .filter((answer) => matchesText(query.q, answer.sanitizedQuestion, answer.answerText, answer.requirement?.refCode));
    const addenda = ADDENDA.filter((addendum) => addendum.tenderId === tender.id && addendum.status === 'issued')
      .filter((addendum) => query.lotId === undefined || addendum.lotIds.includes(query.lotId))
      .filter((addendum) => matchesText(query.q, addendum.title, addendum.changeDescription))
      .flatMap((addendum) =>
        addendum.issuedAt === null || addendum.resultingVersionNo === null
          ? []
          : [
              {
                addendumId: addendum.id,
                number: addendum.number,
                title: addendum.title,
                changeDescription: addendum.changeDescription,
                materiality: addendum.materiality,
                changesScope: addendum.changesScope,
                changesTerms: addendum.changesTerms,
                changesSubmission: addendum.changesSubmission,
                changesEvaluation: addendum.changesEvaluation,
                issuedAt: addendum.issuedAt,
                resultingVersionNo: addendum.resultingVersionNo,
                newSubmissionDeadline: deadline(addendum.newSubmissionDeadline, tender.officialTimeZone),
                affectedLots: affectedLots(tender, addendum.lotIds),
                requirementChanges: requirementChanges(tender, addendum).map(({ id: _id, requirementId: _requirementId, ...change }) => change),
              },
            ],
      );
    const released = [...questions.map((answer) => answer.publishedAt), ...addenda.map((addendum) => addendum.issuedAt)].sort();
    return {
      tender: {
        reference: tender.reference,
        title: tender.title,
        buyer: { slug: buyer.slug, name: buyer.name },
        status: tender.status,
        officialTimeZone: tender.officialTimeZone,
        currentVersionNo: tender.currentVersionNo,
        submissionDeadline: deadline(tender.submissionDeadline, tender.officialTimeZone),
        lots: tender.lots.map((lot) => ({ lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title })),
      },
      questions: sortBy(questions, (answer) => answer.publishedAt, 'desc'),
      addenda: sortBy(addenda, (addendum) => addendum.number, 'desc'),
      editionAt: released[released.length - 1] ?? null,
    };
  });
}
