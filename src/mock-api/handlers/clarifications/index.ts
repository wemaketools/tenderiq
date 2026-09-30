/**
 * Mock handlers of the clarifications contract (`src/contracts/clarifications.ts`; FR-10; BUY-16..18, SUP-10,
 * SUP-11, PUB-04; AC-10). Auto-discovered by the registry.
 */
import type { MockApp } from '../../app.js';
import { registerBuyer } from './buyer.js';
import { registerPublic } from './public.js';
import { registerSupplier } from './supplier.js';

export function register(app: MockApp): void {
  registerBuyer(app);
  registerSupplier(app);
  registerPublic(app);
}
