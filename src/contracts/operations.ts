/**
 * Operations contract (domain 16): platform operations, integrations, imports, subscription and offboarding, help
 * and service cases. FR-22, PRD §16, §19, §20, §21, BR-46, BR-47; screens OPS-01..07, ADM-15..17, COM-09;
 * acceptance scenarios AC-33 (failed external publication stays unconfirmed until reconciled) and AC-36 (customer
 * exit with a live tender and contract under a continuity plan).
 *
 * The schemas live in `./operations/*.ts`; this module re-exports them and publishes the one endpoint map
 * `operationsEndpoints` (foundation-contract §1).
 */
import { contentRoutes } from './operations/content.js';
import { customerRoutes } from './operations/customers.js';
import { importRoutes } from './operations/imports.js';
import { incidentRoutes } from './operations/incidents.js';
import { integrationRoutes } from './operations/integrations.js';
import { peopleRoutes } from './operations/people.js';
import { subscriptionRoutes } from './operations/subscription.js';
import { supportRoutes } from './operations/support.js';

export * from './operations/shared.js';
export * from './operations/customers.js';
export * from './operations/support.js';
export * from './operations/incidents.js';
export * from './operations/content.js';
export * from './operations/integrations.js';
export * from './operations/imports.js';
export * from './operations/subscription.js';
export * from './operations/people.js';

/** Every endpoint of the operations domain. */
export const operationsEndpoints = {
  ...customerRoutes,
  ...supportRoutes,
  ...incidentRoutes,
  ...contentRoutes,
  ...integrationRoutes,
  ...importRoutes,
  ...subscriptionRoutes,
  ...peopleRoutes,
} as const;
