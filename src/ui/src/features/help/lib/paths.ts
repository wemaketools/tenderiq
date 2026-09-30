/** URLs of the help centre (COM-09). */
export const helpPaths = {
  home: '/me/help',
  article: (slug: string): string => `/me/help/articles/${slug}`,
  myCase: (caseId: number): string => `/me/help/cases/${caseId}`,
  publicStatus: '/service-status',
} as const;
