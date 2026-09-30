/**
 * Requests domain mock handlers (05): procurement requests and funding decisions (BUY-02..04), the procurement plan
 * and advance notices (BUY-05, PUB-06), and market research and strategy (BUY-06). Static fixtures, nothing
 * persisted (architecture-plan §3.11).
 */
import type { MockApp } from '../../app.js';
import { registerPlanning } from './planning.js';
import { registerRequests } from './requests.js';
import { registerStrategies } from './strategies.js';

export function register(app: MockApp): void {
  registerRequests(app);
  registerPlanning(app);
  registerStrategies(app);
}
