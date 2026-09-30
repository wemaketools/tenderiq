/** A scope being edited in a form (`scope_type`, `scope_id`; `scopeId` is null for the whole organization). */
import type { RoleAssignmentsScopeType } from '@contracts/enums';

export interface ScopeValue {
  readonly scopeType: RoleAssignmentsScopeType;
  readonly scopeId: number | null;
}

export const ORGANIZATION_SCOPE: ScopeValue = { scopeType: 'organization', scopeId: null };
