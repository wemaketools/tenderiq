/**
 * Mock handlers of the org-admin contract (`src/contracts/org-admin.ts`): COM-01..03, ADM-01..05 and SUP-04
 * (FR-01, FR-03, PRD §5.3, §5.4; AC-02, AC-03, AC-04). Every list is filtered to the caller's tenant (or the
 * caller's own rows for `/me`), and every command validates against the fixture state and returns the outcome
 * without storing anything (architecture-plan §3.11).
 */
import type { MockApp } from '../../app.js';
import { registerAccess } from './access.js';
import { registerAccount } from './account.js';
import { registerAuthority } from './authority.js';
import { registerMembers } from './members.js';
import { registerOrganization } from './organization.js';
import { registerSupplier } from './supplier.js';

export function register(app: MockApp): void {
  registerAccount(app);
  registerMembers(app);
  registerOrganization(app);
  registerAccess(app);
  registerAuthority(app);
  registerSupplier(app);
}
