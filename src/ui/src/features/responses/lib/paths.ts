/**
 * Routes of the supplier response workspace (SUP-12..SUP-17). The mock API's readiness links use the same paths
 * (`/supplier/responses/:bidId/<tab>`).
 */
export const responsePaths = {
  list: '/supplier/responses',
  listForTender: (tenderId: number): string => `/supplier/responses?tenderId=${tenderId}`,
  workspace: (bidId: number): string => `/supplier/responses/${bidId}`,
  answers: (bidId: number): string => `/supplier/responses/${bidId}/answers`,
  answer: (bidId: number, requirementId: number): string =>
    `/supplier/responses/${bidId}/answers/${requirementId}`,
  pricing: (bidId: number): string => `/supplier/responses/${bidId}/pricing`,
  declarations: (bidId: number): string => `/supplier/responses/${bidId}/declarations`,
  review: (bidId: number): string => `/supplier/responses/${bidId}/review`,
  submit: (bidId: number): string => `/supplier/responses/${bidId}/submit`,
  history: (bidId: number): string => `/supplier/responses/${bidId}/receipts`,
  receipts: '/supplier/receipts',
  receipt: (receiptId: number): string => `/supplier/receipts/${receiptId}`,
} as const;
