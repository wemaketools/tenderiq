/** Routes of the personal inbox (COM-04, COM-05). */
export const INBOX_PATHS = {
  tasks: '/me/tasks',
  approvals: '/me/approvals',
  approval: (id: number) => `/me/approvals/${id}`,
  /** COM-07 opened on one exact version (the version an approval decided on). */
  documentVersion: (documentId: number, versionId: number) =>
    `/me/documents/${documentId}?version=${versionId}`,
} as const;
