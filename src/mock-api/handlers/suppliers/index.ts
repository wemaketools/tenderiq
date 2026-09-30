/**
 * Mock handlers of the suppliers contract (`src/contracts/suppliers.ts`, domain 03): public registration (SUP-02),
 * the requester's membership requests, the supplier profile, identity changes and evidence library (SUP-03, SUP-05),
 * the buyer directory and relationship record (BUY-31, BUY-32) and the operator reviews (OPS-01).
 * Static fixtures only (`src/mock-api/fixtures/suppliers/**`); nothing is persisted.
 */
import type { MockApp } from '../../app.js';
import { registerBuyer } from './buyer.js';
import { registerOps } from './ops.js';
import { registerPublic } from './public.js';
import { registerSupplier } from './supplier.js';

export function register(app: MockApp): void {
  registerPublic(app);
  registerSupplier(app);
  registerBuyer(app);
  registerOps(app);
}
