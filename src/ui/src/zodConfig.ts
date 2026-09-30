/**
 * Zod runs without its `new Function` fast path (DD-30). Zod v4 probes `new Function` on first use; under the
 * production CSP (no 'unsafe-eval') the probe is caught but the browser still reports a `script-src eval`
 * violation. Imported first by main.tsx, so the setting is in place before any schema parses.
 */
import { z } from 'zod';

z.config({ jitless: true });
