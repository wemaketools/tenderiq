/**
 * Vitest setup for the SPA (jsdom + React Testing Library + jest-dom; brief §10).
 * - jest-dom matchers; DOM cleanup after each test.
 * - Browser APIs jsdom lacks: matchMedia (desktop width), ResizeObserver (Recharts), scrollTo (ScrollRestoration).
 *   WebCrypto (uploads) comes from Node 24.
 * - The API client adapters are reset after each test.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
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
