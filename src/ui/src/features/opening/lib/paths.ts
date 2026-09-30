/**
 * In-app URLs of the opening feature (BUY-20, BUY-21, EVA-03 under `/buyer`; SUP-18 under `/supplier`).
 */
export const openingPaths = {
  hub: '/buyer/opening',
  tender: (tenderId: number): string => `/buyer/opening/tenders/${tenderId}`,
  session: (sessionId: number): string => `/buyer/opening/sessions/${sessionId}`,
  compliance: '/buyer/compliance',
  register: (tenderId: number): string => `/buyer/compliance/tenders/${tenderId}`,
  bid: (bidId: number): string => `/buyer/compliance/bids/${bidId}`,
  exclusion: (exclusionId: number): string => `/buyer/compliance/exclusions/${exclusionId}`,
  clarifications: '/buyer/bid-clarifications',
  clarification: (clarificationId: number): string =>
    `/buyer/bid-clarifications/${clarificationId}`,
  requests: '/supplier/assessment-requests',
  request: (requestId: number): string => `/supplier/assessment-requests/${requestId}`,
} as const;

/** A positive integer route parameter, or `null` when it is missing or malformed. */
export function idParam(value: string | undefined): number | null {
  if (value === undefined || !/^[1-9]\d{0,9}$/.test(value)) {
    return null;
  }
  return Number(value);
}
