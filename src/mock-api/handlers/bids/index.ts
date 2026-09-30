/**
 * Mock handlers of the bids contract (`src/contracts/bids.ts`): supplier response preparation, internal approval,
 * submission, receipts and withdrawal (SUP-12..SUP-17) and buyer submission monitoring and closing (BUY-19).
 * Auto-discovered by the registry; handlers are pure functions over `fixtures/bids` and never persist anything.
 */
import type { MockApp } from '../../app.js';
import { registerBuyerRoutes } from './buyer.js';
import { registerSupplierRoutes } from './supplier.js';

export function register(app: MockApp): void {
  registerSupplierRoutes(app);
  registerBuyerRoutes(app);
}
