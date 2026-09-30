/**
 * URLs of the evaluation screens. Evaluations of one lot carry `?lotId=` (a multi-lot tender is evaluated per lot).
 */
const ROOT = '/buyer/evaluation';

function withLot(path: string, lotId: number | null | undefined): string {
  return lotId === null || lotId === undefined ? path : `${path}?lotId=${lotId}`;
}

export const evaluationPaths = {
  list: ROOT,
  assignments: `${ROOT}/assignments`,
  assignment: (assignmentId: number): string => `${ROOT}/assignments/${assignmentId}`,
  assessment: (assignmentId: number): string => `${ROOT}/assignments/${assignmentId}/assessment`,
  overview: (tenderId: number, lotId?: number | null): string =>
    withLot(`${ROOT}/tenders/${tenderId}`, lotId),
  commercial: (tenderId: number, lotId?: number | null): string =>
    withLot(`${ROOT}/tenders/${tenderId}/commercial`, lotId),
  moderation: (tenderId: number, lotId?: number | null): string =>
    withLot(`${ROOT}/tenders/${tenderId}/moderation`, lotId),
  results: (tenderId: number, lotId?: number | null): string =>
    withLot(`${ROOT}/tenders/${tenderId}/results`, lotId),
  /** The tender record (tenders domain). */
  tender: (tenderId: number): string => `/buyer/tenders/${tenderId}`,
  /** A document (workspace domain, `/me/documents/:id`). */
  document: (documentId: number): string => `/me/documents/${documentId}`,
};
