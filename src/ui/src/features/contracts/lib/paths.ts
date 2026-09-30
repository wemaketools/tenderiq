/**
 * In-app paths of the contract screens (CON-01 … CON-11 under `/buyer/contracts`, SUP-23 under
 * `/supplier/contracts`).
 */
const BUYER = '/buyer/contracts';
const SUPPLIER = '/supplier/contracts';

export const contractPaths = {
  register: BUYER,
  create: `${BUYER}/new`,
  overview: (id: number): string => `${BUYER}/${id}`,
  preparation: (id: number): string => `${BUYER}/${id}/preparation`,
  signature: (id: number): string => `${BUYER}/${id}/signature`,
  handover: (id: number): string => `${BUYER}/${id}/handover`,
  milestones: (id: number): string => `${BUYER}/${id}/milestones`,
  obligation: (id: number, obligationId: number): string =>
    `${BUYER}/${id}/obligations/${obligationId}`,
  performance: (id: number): string => `${BUYER}/${id}/performance`,
  financials: (id: number): string => `${BUYER}/${id}/financials`,
  changes: (id: number): string => `${BUYER}/${id}/changes`,
  renewals: (id: number): string => `${BUYER}/${id}/renewals`,
  closeout: (id: number): string => `${BUYER}/${id}/closeout`,
  approval: (approvalId: number): string => `/me/approvals/${approvalId}`,
  supplierList: SUPPLIER,
  supplierContract: (id: number): string => `${SUPPLIER}/${id}`,
} as const;
