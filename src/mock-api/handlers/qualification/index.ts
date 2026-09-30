/**
 * Mock handlers of the qualification contract (`src/contracts/qualification.ts`; domain 04: ADM-09, SUP-20,
 * SUP-24, BUY-33, BUY-34, BUY-35; AC-07, AC-08, AC-09). Static fixtures only; nothing is persisted.
 */
import type { MockApp } from '../../app.js';
import { registerBuyer } from './buyer.js';
import { registerSupplier } from './supplier.js';

export function register(app: MockApp): void {
  registerBuyer(app);
  registerSupplier(app);
}
