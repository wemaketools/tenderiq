/**
 * The current time for rendering, refreshed on an interval. Components never call `Date.now()` during render
 * (React Compiler purity rule); they read it from here. The client clock is display help only: deadline logic is
 * always the server's (docs/technical/09-frontend.md §13 rule 7).
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
