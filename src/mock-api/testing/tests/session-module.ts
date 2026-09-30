/** The session handler module, for tests that build the app with explicit modules. */
import type { HandlerModule } from '../../app.js';
import { register } from '../../handlers/session.js';

export const sessionModule: HandlerModule = { name: 'session', register };
