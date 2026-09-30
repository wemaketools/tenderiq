/**
 * Subscribes to a CSS media query (DD-36 shell breakpoints: icon rail below 1280px, drawer below 768px).
 */
import { useCallback, useSyncExternalStore } from 'react';

export const DRAWER_QUERY = '(max-width: 767px)';
export const RAIL_QUERY = '(max-width: 1279px)';

function media(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = media(query);
      if (list === null) {
        return () => undefined;
      }
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => media(query)?.matches ?? false,
    () => false,
  );
}
