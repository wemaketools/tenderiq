/**
 * Mock handlers of the reporting contract (`src/contracts/reporting.ts`): BUY-01 and SUP-01 dashboards, REP-01
 * reports, REP-02/ADM-13 definitions and exports, and COM-08 search with saved views. Static fixtures only; nothing
 * is persisted (architecture-plan §3.11).
 */
import type { MockApp } from '../../app.js';
import { registerDashboards } from './dashboard.js';
import { registerReports } from './reports.js';
import { registerSearch } from './search.js';

export function register(app: MockApp): void {
  registerDashboards(app);
  registerReports(app);
  registerSearch(app);
}
