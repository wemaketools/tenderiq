/**
 * Session client (the `session` contract): the SPA boot context and the theme preference.
 */
import { getSessionContext, updateTheme } from '@contracts/session';
import type { SessionContext } from '@contracts/session';
import type { UsersTheme } from '@contracts/enums';

import { call } from './client';

/** GET /api/v1/me/context, optionally with the effective permissions in one tenant. */
export function fetchSessionContext(tenantId?: number): Promise<SessionContext> {
  return call(getSessionContext, { query: tenantId === undefined ? {} : { tenantId } });
}

/** PUT /api/v1/me/theme. */
export async function saveTheme(theme: UsersTheme): Promise<UsersTheme> {
  const response = await call(updateTheme, { body: { theme } });
  return response.theme;
}
