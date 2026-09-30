/**
 * Session fixtures: the personal profile members of `/api/v1/me/context` (`users.phone`, `locale`,
 * `display_time_zone`, `theme`, `last_seen_at`) per persona (COM-03). Identity, memberships and roles come from
 * `platform.ts`; a persona without an entry here uses `DEFAULT_SESSION_PROFILE`.
 *
 * `lastSeenAt` is the persona's previous sign-in before the storyline "now" (`demo-clock.ts`): after every
 * notification the persona has read or acknowledged.
 *
 * Static: `PUT /api/v1/me/theme` answers with the requested theme but changes nothing here (architecture-plan §0).
 */
import type { UsersTheme } from '../../contracts/enums.js';

export interface FixtureSessionProfile {
  readonly phone: string | null;
  readonly locale: string;
  /** Personal display zone for local-time help; `null` = the official zone only. */
  readonly displayTimeZone: string | null;
  readonly theme: UsersTheme;
  readonly lastSeenAt: string | null;
}

export const DEFAULT_SESSION_PROFILE: FixtureSessionProfile = Object.freeze({
  phone: null,
  locale: 'en-BW',
  displayTimeZone: null,
  theme: 'light',
  lastSeenAt: '2026-10-05T14:05:00Z',
});

/** Profiles that differ from the default, keyed by persona e-mail. */
export const SESSION_PROFILES: Readonly<Record<string, FixtureSessionProfile>> = Object.freeze({
  'tebogo.officer@tenderiq.local': {
    phone: '+267 71 234 567',
    locale: 'en-BW',
    displayTimeZone: 'Africa/Gaborone',
    theme: 'light',
    lastSeenAt: '2026-10-05T15:40:00Z',
  },
  'mpho.manager@tenderiq.local': {
    phone: '+267 72 118 004',
    locale: 'en-BW',
    displayTimeZone: 'Africa/Gaborone',
    theme: 'light',
    lastSeenAt: '2026-10-05T16:12:00Z',
  },
  'boitumelo.chair@tenderiq.local': {
    phone: null,
    locale: 'en-BW',
    displayTimeZone: 'Africa/Gaborone',
    theme: 'dark',
    lastSeenAt: '2026-10-05T14:55:00Z',
  },
  'ops.admin@tenderiq.local': {
    phone: '+267 390 0101',
    locale: 'en-GB',
    displayTimeZone: 'UTC',
    theme: 'dark',
    lastSeenAt: '2026-10-05T15:02:00Z',
  },
  'sam.dual@tenderiq.local': {
    phone: '+267 75 660 321',
    locale: 'en-BW',
    displayTimeZone: 'Africa/Johannesburg',
    theme: 'light',
    lastSeenAt: '2026-10-05T09:30:00Z',
  },
  'tsodilo.bidmanager@tenderiq.local': {
    phone: '+267 74 500 812',
    locale: 'en-BW',
    displayTimeZone: 'Africa/Gaborone',
    theme: 'light',
    lastSeenAt: '2026-10-05T14:15:00Z',
  },
  'former.officer@tenderiq.local': {
    phone: null,
    locale: 'en-BW',
    displayTimeZone: null,
    theme: 'light',
    lastSeenAt: '2026-06-30T15:45:00Z',
  },
});

/** The session profile of a persona e-mail. */
export function sessionProfileOf(email: string): FixtureSessionProfile {
  return SESSION_PROFILES[email] ?? DEFAULT_SESSION_PROFILE;
}
