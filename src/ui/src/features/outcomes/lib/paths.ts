/** In-app URLs of the supplier outcome, complaint and public award screens. */
export const outcomePaths = {
  outcomes: '/supplier/outcomes',
  outcome: (tenderId: number): string => `/supplier/outcomes/${tenderId}`,
  complaints: '/supplier/complaints',
  newComplaint: (tenderId?: number): string =>
    tenderId === undefined
      ? '/supplier/complaints/new'
      : `/supplier/complaints/new?tenderId=${tenderId}`,
  complaint: (complaintId: number): string => `/supplier/complaints/${complaintId}`,
  publicAwards: '/awards',
  publicAward: (buyerSlug: string, reference: string): string =>
    `/awards/${encodeURIComponent(buyerSlug)}/${encodeURIComponent(reference)}`,
  document: (documentId: number): string => `/me/documents/${documentId}`,
} as const;
