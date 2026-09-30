/**
 * URLs of the buyer supplier directory (BUY-31), the relationship record (BUY-32) and the operator supplier reviews
 * (registrations, duplicates, legal-identity changes). Routes and links are built from here so they agree.
 */
export const DIRECTORY_ROOT = '/buyer/suppliers';

export const directoryPaths = {
  directory: DIRECTORY_ROOT,
  record: (supplierTenantId: number, tab?: string): string =>
    tab === undefined
      ? `${DIRECTORY_ROOT}/${supplierTenantId}`
      : `${DIRECTORY_ROOT}/${supplierTenantId}?tab=${tab}`,
  contract: (contractId: number): string => `/buyer/contracts/${contractId}`,
  registrations: '/ops/supplier-registrations',
  duplicates: '/ops/supplier-duplicates',
  duplicate: (candidateId: number): string => `/ops/supplier-duplicates/${candidateId}`,
  identityChanges: '/ops/supplier-identity-changes',
  identityChange: (changeId: number): string => `/ops/supplier-identity-changes/${changeId}`,
  document: (documentId: number): string => `/me/documents/${documentId}`,
} as const;

export const directoryRoutes = {
  directory: 'suppliers',
  record: 'suppliers/:supplierTenantId',
  registrations: 'supplier-registrations',
  duplicates: 'supplier-duplicates',
  duplicate: 'supplier-duplicates/:candidateId',
  identityChanges: 'supplier-identity-changes',
  identityChange: 'supplier-identity-changes/:changeId',
} as const;
