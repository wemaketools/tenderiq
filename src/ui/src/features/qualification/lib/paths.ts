/**
 * In-app paths of the qualification screens (ADM-09, BUY-33, BUY-34, BUY-35, SUP-20, SUP-24). The mock API's `link`
 * fields point at the same paths (`/buyer/qualification/applications/:id`, `/supplier/qualification/applications/:id`).
 */
export const buyerQualificationPaths = {
  queue: '/buyer/qualification',
  application: (applicationId: number): string =>
    `/buyer/qualification/applications/${applicationId}`,
  decide: (applicationId: number): string =>
    `/buyer/qualification/applications/${applicationId}/decision`,
  monitoring: '/buyer/qualification/monitoring',
  decision: (decisionId: number): string => `/buyer/qualification/decisions/${decisionId}`,
  trigger: (triggerId: number): string => `/buyer/qualification/triggers/${triggerId}`,
  programs: '/buyer/admin/qualification',
  newProgram: '/buyer/admin/qualification/new',
  program: (programId: number): string => `/buyer/admin/qualification/${programId}`,
} as const;

export const supplierQualificationPaths = {
  home: '/supplier/qualification',
  program: (programId: number): string => `/supplier/qualification/programs/${programId}`,
  application: (applicationId: number): string =>
    `/supplier/qualification/applications/${applicationId}`,
  decisions: '/supplier/qualification/decisions',
  decision: (decisionId: number): string => `/supplier/qualification/decisions/${decisionId}`,
} as const;
