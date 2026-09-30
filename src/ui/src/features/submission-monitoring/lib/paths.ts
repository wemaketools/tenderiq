/** Routes of buyer submission monitoring and closing (BUY-19). */
export const monitoringPaths = {
  list: '/buyer/submissions',
  tender: (tenderId: number): string => `/buyer/submissions/${tenderId}`,
} as const;
