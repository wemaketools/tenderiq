/**
 * Vitest setup for the SPA (jsdom + React Testing Library + jest-dom; brief §10).
 * - jest-dom matchers; DOM cleanup after each test.
 * - Browser APIs jsdom lacks: matchMedia (desktop width), ResizeObserver (Recharts), scrollTo (ScrollRestoration).
 *   WebCrypto (uploads) comes from Node 24.
 * - Every test runs on a fixed browser clock (the storyline "as of"); only `Date` is faked, so timers stay real.
 * - The API client adapters are reset after each test, and the application clock returns to the browser clock
 *   (a test that loaded a session or an API response with a server time never shifts the next test's clock).
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { resetServerClock } from '../lib/clock';

/** The browser clock of every test: the storyline "as of" of the fixtures, so deadlines and expiries in test data keep their meaning. */
const TEST_NOW = '2026-10-06T08:00:00Z';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(TEST_NOW), toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  resetServerClock();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof globalThis.crypto?.subtle === 'undefined') {
  throw new Error(
    'The test environment needs WebCrypto (crypto.subtle); run the SPA tests on Node 24.',
  );
}

window.scrollTo = () => undefined;
