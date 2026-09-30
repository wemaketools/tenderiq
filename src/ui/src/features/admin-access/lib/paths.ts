/**
 * In-app paths of the users-and-access screens. The same screens serve `/buyer/admin/*` (ADM-03, ADM-04) and
 * `/supplier/admin/*` (SUP-04).
 */
export type AdminKind = 'buyer' | 'supplier';

export interface AccessPaths {
  /** The area landing page (opens the first screen the membership may use). */
  readonly home: string;
  readonly users: string;
  readonly user: (userId: number) => string;
  readonly roles: string;
  readonly role: (roleId: number) => string;
  readonly groups: string;
  readonly group: (groupId: number) => string;
}

export function accessPaths(kind: AdminKind): AccessPaths {
  const base = `/${kind}/admin/access`;
  return {
    home: base,
    users: `${base}/users`,
    user: (userId) => `${base}/users/${userId}`,
    roles: `${base}/roles`,
    role: (roleId) => `${base}/roles/${roleId}`,
    groups: `${base}/groups`,
    group: (groupId) => `${base}/groups/${groupId}`,
  };
}

/** Buyer-only access governance (ADM-04). */
export const buyerAccessPaths = {
  review: '/buyer/admin/access/review',
  conflicts: '/buyer/admin/access/conflicts',
  conflict: (declarationId: number) => `/buyer/admin/access/conflicts/${declarationId}`,
};

/** Supplier-only authority (SUP-04). */
export const supplierAccessPaths = {
  authority: '/supplier/admin/access/authority',
  assignments: '/supplier/admin/access/assignments',
};
