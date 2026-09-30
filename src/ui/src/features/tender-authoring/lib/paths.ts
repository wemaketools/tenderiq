/**
 * In-app paths of the tender authoring screens (BUY-07..BUY-13). The section pages match `TENDER_SECTION_PAGES` of
 * the contract, which the mock API uses for readiness and outstanding-decision links.
 */
import { tenderSectionPath } from '@contracts/tenders';
import type { TenderSection } from '@contracts/tenders';

export const tenderPaths = {
  register: '/buyer/tenders',
  create: '/buyer/tenders/new',
  overview: (tenderId: number): string => `/buyer/tenders/${tenderId}`,
  scope: (tenderId: number): string => `/buyer/tenders/${tenderId}/scope`,
  pricing: (tenderId: number): string => `/buyer/tenders/${tenderId}/pricing`,
  evaluation: (tenderId: number): string => `/buyer/tenders/${tenderId}/evaluation`,
  timetable: (tenderId: number): string => `/buyer/tenders/${tenderId}/timetable`,
  release: (tenderId: number): string => `/buyer/tenders/${tenderId}/release`,
  section: (tenderId: number, section: TenderSection): string =>
    tenderSectionPath(tenderId, section),
  approval: (approvalId: number): string => `/me/approvals/${approvalId}`,
};
