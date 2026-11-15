/**
 * localStorage for conveniences only (DD-36): the remembered active tenant per user, the last theme, the sidebar
 * width (DD-51) and the open sidebar sections (DD-48). Nothing here is trusted: the active tenant is re-validated by /me/context and the API
 * checks X-Tenant-Id on every call.
 * Every access is guarded, because storage can be unavailable (private mode, blocked site data).
 */

const PREFIX = 'tiq.';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(PREFIX + key);
    } else {
      window.localStorage.setItem(PREFIX + key, value);
    }
  } catch {
    // Storage unavailable: the convenience is simply lost.
  }
}

/** The tenant this user last worked in, or `null`. */
export function readRememberedTenant(userId: number): number | null {
  const raw = read(`activeTenant.${userId}`);
  if (raw === null || !/^[1-9]\d{0,15}$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

export function rememberTenant(userId: number, tenantId: number | null): void {
  write(`activeTenant.${userId}`, tenantId === null ? null : String(tenantId));
}

/** Whether the user chose the full sidebar in the icon rail; anything but "expanded" (or no value) means collapsed. */
export function readStoredSidebarExpanded(): boolean {
  return read('sidebar') === 'expanded';
}

export function storeSidebarExpanded(expanded: boolean): void {
  write('sidebar', expanded ? 'expanded' : 'collapsed');
}

export type StoredTheme = 'light' | 'dark';

/** The last applied theme, used before /me/context answers to avoid a flash. */
export function readStoredTheme(): StoredTheme | null {
  const raw = read('theme');
  return raw === 'light' || raw === 'dark' ? raw : null;
}

export function storeTheme(theme: StoredTheme): void {
  write('theme', theme);
}

/** Sidebar sections the user opened (`true`) or closed (`false`) (DD-48); unknown or malformed values are ignored. */
export function readNavSections(): Record<string, boolean> {
  const raw = read('nav.sections');
  if (raw === null) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
      ),
    );
  } catch {
    return {};
  }
}

export function storeNavSections(sections: Readonly<Record<string, boolean>>): void {
  write('nav.sections', JSON.stringify(sections));
}
