/**
 * The handler modules the mock API mounts, in the stable alphabetical order of `registry-discovery.ts` (DD-50).
 *
 * A static list, because the browser prototype cannot read the `handlers/` directory. `handler-modules.test.ts`
 * fails when this list and the modules on disk differ, so a new handler module must be added here.
 */
import type { HandlerModule } from './registry.js';
import { register as approvalsHandlers } from './handlers/approvals/index.js';
import { register as auditHandlers } from './handlers/audit/index.js';
import { register as awardsHandlers } from './handlers/awards/index.js';
import { register as bidsHandlers } from './handlers/bids/index.js';
import { register as calendarsHandlers } from './handlers/calendars/index.js';
import { register as clarificationsHandlers } from './handlers/clarifications/index.js';
import { register as contractsHandlers } from './handlers/contracts/index.js';
import { register as documentsHandlers } from './handlers/documents/index.js';
import { register as evaluationHandlers } from './handlers/evaluation/index.js';
import { register as notificationRulesHandlers } from './handlers/notification-rules/index.js';
import { register as notificationsHandlers } from './handlers/notifications/index.js';
import { register as openingHandlers } from './handlers/opening/index.js';
import { register as operationsHandlers } from './handlers/operations/index.js';
import { register as orgAdminHandlers } from './handlers/org-admin/index.js';
import { register as policyHandlers } from './handlers/policy/index.js';
import { register as publicationHandlers } from './handlers/publication/index.js';
import { register as qualificationHandlers } from './handlers/qualification/index.js';
import { register as recordsHandlers } from './handlers/records/index.js';
import { register as reportingHandlers } from './handlers/reporting/index.js';
import { register as requestsHandlers } from './handlers/requests/index.js';
import { register as selectionHandlers } from './handlers/selection/index.js';
import { register as sessionHandlers } from './handlers/session.js';
import { register as suppliersHandlers } from './handlers/suppliers/index.js';
import { register as tasksHandlers } from './handlers/tasks/index.js';
import { register as tendersHandlers } from './handlers/tenders/index.js';

export const HANDLER_MODULES: readonly HandlerModule[] = [
  { name: 'approvals/index', register: approvalsHandlers },
  { name: 'audit/index', register: auditHandlers },
  { name: 'awards/index', register: awardsHandlers },
  { name: 'bids/index', register: bidsHandlers },
  { name: 'calendars/index', register: calendarsHandlers },
  { name: 'clarifications/index', register: clarificationsHandlers },
  { name: 'contracts/index', register: contractsHandlers },
  { name: 'documents/index', register: documentsHandlers },
  { name: 'evaluation/index', register: evaluationHandlers },
  { name: 'notification-rules/index', register: notificationRulesHandlers },
  { name: 'notifications/index', register: notificationsHandlers },
  { name: 'opening/index', register: openingHandlers },
  { name: 'operations/index', register: operationsHandlers },
  { name: 'org-admin/index', register: orgAdminHandlers },
  { name: 'policy/index', register: policyHandlers },
  { name: 'publication/index', register: publicationHandlers },
  { name: 'qualification/index', register: qualificationHandlers },
  { name: 'records/index', register: recordsHandlers },
  { name: 'reporting/index', register: reportingHandlers },
  { name: 'requests/index', register: requestsHandlers },
  { name: 'selection/index', register: selectionHandlers },
  { name: 'session', register: sessionHandlers },
  { name: 'suppliers/index', register: suppliersHandlers },
  { name: 'tasks/index', register: tasksHandlers },
  { name: 'tenders/index', register: tendersHandlers },
];
