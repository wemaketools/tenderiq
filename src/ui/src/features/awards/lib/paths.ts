/** In-app URLs of the award screens (buyer area). */
export const awardPaths = {
  register: '/buyer/awards',
  closeoutRegister: '/buyer/closeout',
  file: (tenderId: number): string => `/buyer/awards/${tenderId}`,
  recommendation: (tenderId: number, recommendationId: number): string =>
    `/buyer/awards/${tenderId}/recommendations/${recommendationId}`,
  notices: (tenderId: number): string => `/buyer/awards/${tenderId}/notices`,
  notice: (tenderId: number, noticeId: number): string =>
    `/buyer/awards/${tenderId}/notices/${noticeId}`,
  closeout: (tenderId: number): string => `/buyer/awards/${tenderId}/closeout`,
  debriefs: '/buyer/award-cases',
  debrief: (debriefId: number): string => `/buyer/award-cases/debriefs/${debriefId}`,
  complaints: '/buyer/award-cases/complaints',
  complaint: (complaintId: number): string => `/buyer/award-cases/complaints/${complaintId}`,
  tender: (tenderId: number): string => `/buyer/tenders/${tenderId}`,
  contract: (contractId: number): string => `/buyer/contracts/${contractId}`,
} as const;
