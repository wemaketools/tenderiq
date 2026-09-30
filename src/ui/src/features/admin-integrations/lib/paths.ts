/** URLs of the buyer service screens (ADM-15, ADM-16, ADM-17 and the support access authorization). */
export const servicePaths = {
  home: '/buyer/admin/service',
  integrations: '/buyer/admin/service/integrations',
  integration: (connectionId: number): string =>
    `/buyer/admin/service/integrations/${connectionId}`,
  exceptions: '/buyer/admin/service/exceptions',
  exception: (exceptionId: number): string => `/buyer/admin/service/exceptions/${exceptionId}`,
  imports: '/buyer/admin/service/imports',
  importBatch: (batchId: number): string => `/buyer/admin/service/imports/${batchId}`,
  subscription: '/buyer/admin/service/subscription',
  supportAccess: '/buyer/admin/service/support-access',
  supportGrant: (grantId: number): string => `/buyer/admin/service/support-access/${grantId}`,
} as const;
