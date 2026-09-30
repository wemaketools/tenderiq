/**
 * Mock handlers of the policy contract (domain 02; `src/contracts/policy.ts`): ADM-06 policy profiles, ADM-07
 * custom fields and form definitions, ADM-08 templates and ADM-11 portal disclosure policy, plus the public
 * projection of the approved portal policy. Auto-discovered by the registry; nothing persists.
 */
import type { MockApp } from '../../app.js';
import { registerFields } from './fields.js';
import { registerPortal } from './portal.js';
import { registerProfiles } from './profiles.js';
import { registerTemplates } from './templates.js';

export function register(app: MockApp): void {
  registerProfiles(app);
  registerFields(app);
  registerTemplates(app);
  registerPortal(app);
}
