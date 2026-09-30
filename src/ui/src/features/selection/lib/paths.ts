/**
 * In-app paths of the selection screens: the buyer workspace under `/buyer/selection` (BUY-22..BUY-25, BUY-27) and
 * the supplier assessment appointments and negotiation screens (SUP-18 invites, SUP-19).
 */
const BUYER = '/buyer/selection';
const SUPPLIER = '/supplier';

function withTender(path: string, tenderId: number | null | undefined): string {
  return tenderId === null || tenderId === undefined ? path : `${path}?tenderId=${tenderId}`;
}

export const selectionPaths = {
  home: BUYER,
  tender: (tenderId: number) => `${BUYER}/tenders/${tenderId}`,
  assessments: `${BUYER}/assessments`,
  newSession: (tenderId?: number | null) => withTender(`${BUYER}/assessments/new`, tenderId),
  session: (sessionId: number) => `${BUYER}/assessments/${sessionId}`,
  references: `${BUYER}/references`,
  shortlists: `${BUYER}/shortlists`,
  newShortlist: (tenderId?: number | null) => withTender(`${BUYER}/shortlists/new`, tenderId),
  shortlist: (shortlistId: number) => `${BUYER}/shortlists/${shortlistId}`,
  preferredBidders: `${BUYER}/preferred-bidders`,
  newPreferredBidder: (tenderId?: number | null) =>
    withTender(`${BUYER}/preferred-bidders/new`, tenderId),
  preferredBidder: (id: number) => `${BUYER}/preferred-bidders/${id}`,
  diligence: `${BUYER}/due-diligence`,
  diligenceCase: (caseId: number) => `${BUYER}/due-diligence/${caseId}`,
  negotiations: `${BUYER}/negotiations`,
  newNegotiation: (tenderId?: number | null) => withTender(`${BUYER}/negotiations/new`, tenderId),
  negotiation: (negotiationId: number) => `${BUYER}/negotiations/${negotiationId}`,
  finalOffers: `${BUYER}/final-offers`,
  newFinalOffer: (tenderId?: number | null) => withTender(`${BUYER}/final-offers/new`, tenderId),
  finalOffer: (roundId: number) => `${BUYER}/final-offers/${roundId}`,
  supplierInvites: `${SUPPLIER}/assessment-invites`,
  supplierNegotiations: `${SUPPLIER}/negotiations`,
  supplierNegotiation: (negotiationId: number) => `${SUPPLIER}/negotiations/${negotiationId}`,
  supplierFinalOffer: (roundId: number) => `${SUPPLIER}/final-offers/${roundId}`,
} as const;
