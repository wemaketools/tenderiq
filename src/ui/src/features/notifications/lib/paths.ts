/** Routes of the notification screens. */
export const notificationPaths = {
  center: '/me/notifications',
  rules: '/buyer/admin/notification-rules',
  newRule: '/buyer/admin/notification-rules/new',
  rule: (ruleId: number) => `/buyer/admin/notification-rules/${ruleId}`,
} as const;
