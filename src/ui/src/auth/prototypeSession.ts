/**
 * The prototype session (DD-50): the demo persona the user picked on the sign-in page, kept for the browser tab in
 * `sessionStorage` (a per-viewer convenience; nothing else is stored). The API client sends it as the bearer token,
 * and the in-browser mock API maps it to its fixture persona. There is no password and no credential.
 *
 * Storage can be unavailable (private windows, blocked site data): every access is guarded, and the session then
 * lasts until the page reloads.
 */

const STORAGE_KEY = 'tiq.prototype.persona';

type Listener = (email: string | null) => void;

const listeners = new Set<Listener>();
let fallback: string | null = null;

function readStorage(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
}

function writeStorage(email: string | null): void {
  fallback = email;
  try {
    if (email === null) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, email);
    }
  } catch {
    // Storage blocked: the in-memory fallback keeps the session for this page.
  }
}

/** The e-mail of the signed-in persona, or `null`. */
export function currentPersona(): string | null {
  return readStorage();
}

/** Signs in as a persona (its demo e-mail) and notifies the listeners. */
export function startPersonaSession(email: string): void {
  const normalized = email.trim().toLowerCase();
  writeStorage(normalized);
  for (const listener of listeners) listener(normalized);
}

/** Ends the persona session and notifies the listeners. */
export function endPersonaSession(): void {
  writeStorage(null);
  for (const listener of listeners) listener(null);
}

/** Calls `listener` on every sign-in and sign-out. Returns the unsubscribe function. */
export function onPersonaSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
