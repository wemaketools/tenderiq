/**
 * In-app paths of the publication domain: buyer publication and participants (BUY-14, BUY-15), the public portal
 * (PUB-01, PUB-02, PUB-03, PUB-07) and the supplier opportunity screens (SUP-06..SUP-09). The mock API returns the
 * same paths in its `linkPath` fields (DD-22: public notice URLs carry the buyer slug and the reference).
 */
export const publicationPaths = {
  register: '/buyer/publications',
  tender: (tenderId: number): string => `/buyer/tenders/${tenderId}/publication`,
  participants: (tenderId: number): string => `/buyer/tenders/${tenderId}/participants`,
  participant: (tenderId: number, participantId: number): string =>
    `/buyer/tenders/${tenderId}/participants/${participantId}`,
  tenderOverview: (tenderId: number): string => `/buyer/tenders/${tenderId}`,
  approval: (approvalId: number): string => `/me/approvals/${approvalId}`,
  task: (taskId: number): string => `/me/tasks/${taskId}`,
} as const;

export const portalPaths = {
  home: '/',
  buyer: (buyerSlug: string): string => `/b/${buyerSlug}`,
  search: '/opportunities',
  notice: (buyerSlug: string, reference: string): string =>
    `/opportunities/${buyerSlug}/${reference}`,
  guidance: '/guidance',
  article: (articleSlug: string): string => `/guidance/${articleSlug}`,
  plans: '/plans',
  awards: '/awards',
  signIn: '/signin',
  register: '/register',
} as const;

export type DiscoveryTab = 'discover' | 'watchlist' | 'searches' | 'subscriptions';

export const opportunityPaths = {
  discovery: '/supplier/opportunities',
  discoveryTab: (tab: DiscoveryTab): string =>
    tab === 'discover' ? '/supplier/opportunities' : `/supplier/opportunities?tab=${tab}`,
  find: (buyerSlug: string, reference: string): string =>
    `/supplier/opportunities/find/${buyerSlug}/${reference}`,
  workspace: (tenderId: number): string => `/supplier/opportunities/${tenderId}`,
  pursuit: (tenderId: number): string => `/supplier/opportunities/${tenderId}/pursuit`,
  invitations: '/supplier/invitations',
  invitation: (participantId: number): string => `/supplier/invitations/${participantId}`,
  pursuits: '/supplier/pursuits',
  responsesForTender: (tenderId: number): string => `/supplier/responses?tenderId=${tenderId}`,
  clarifications: (tenderId: number): string => `/supplier/clarifications/tenders/${tenderId}`,
  briefing: (sessionId: number): string => `/supplier/briefings/${sessionId}`,
} as const;
