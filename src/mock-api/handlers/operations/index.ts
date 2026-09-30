/**
 * Mock handlers of the operations contract (domain 16; `src/contracts/operations.ts`): OPS-01..07 operator area,
 * ADM-15..17 buyer integrations, imports and subscription, and the COM-09 help centre and service cases.
 * Auto-discovered by the registry; nothing persists.
 */
import type { MockApp } from '../../app.js';
import { registerContent } from './content.js';
import { registerCustomers } from './customers.js';
import { registerImports } from './imports.js';
import { registerIncidents } from './incidents.js';
import { registerIntegrations } from './integrations.js';
import { registerPeople } from './people.js';
import { registerSubscription } from './subscription.js';
import { registerSupport } from './support.js';

export function register(app: MockApp): void {
  registerCustomers(app);
  registerSupport(app);
  registerIncidents(app);
  registerContent(app);
  registerIntegrations(app);
  registerImports(app);
  registerSubscription(app);
  registerPeople(app);
}
