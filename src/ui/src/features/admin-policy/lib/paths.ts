/**
 * URLs of the policy administration screens (buyer area). Every link of the feature is built here so the routes
 * in `routes.tsx` and the links always agree.
 */
export const POLICY_ROOT = '/buyer/admin/policy';

export const policyPaths = {
  root: POLICY_ROOT,
  profiles: `${POLICY_ROOT}/profiles`,
  newProfile: `${POLICY_ROOT}/profiles/new`,
  profile: (profileId: number): string => `${POLICY_ROOT}/profiles/${profileId}`,
  version: (profileId: number, versionId: number): string =>
    `${POLICY_ROOT}/profiles/${profileId}/versions/${versionId}`,
  fields: `${POLICY_ROOT}/fields`,
  newField: `${POLICY_ROOT}/fields/new`,
  field: (fieldId: number): string => `${POLICY_ROOT}/fields/${fieldId}`,
  templates: `${POLICY_ROOT}/templates`,
  newTemplate: `${POLICY_ROOT}/templates/new`,
  template: (templateId: number): string => `${POLICY_ROOT}/templates/${templateId}`,
  portal: `${POLICY_ROOT}/portal`,
} as const;

/** Links to records of other domains shown in usage lists. */
export const tenderPath = (tenderId: number): string => `/buyer/tenders/${tenderId}`;
export const contractPath = (contractId: number): string => `/buyer/contracts/${contractId}`;
