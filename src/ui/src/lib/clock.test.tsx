import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineEndpoint } from '@contracts/endpoint';

import { call } from '../api/client';
import { installFetch } from '../test/fetchMock';
import { clockNow, resetServerClock, syncServerClock } from './clock';
import { useNow } from './useNow';

const BROWSER_NOW = Date.parse('2026-09-30T06:00:00Z');
const DEMO_AS_OF = '2026-10-06T08:00:00Z';

const publicPing = defineEndpoint({
  id: 'public.test.clock',
  method: 'GET',
  path: '/api/v1/public/test-clock',
  audience: 'public',
  response: z.object({ ok: z.boolean() }),
  errors: [],
  screens: ['PUB-01'],
});

function NowProbe() {
  const now = useNow();
  return <output>{new Date(now).toISOString()}</output>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetServerClock();
});

describe('application clock', () => {
  it('runs from the server time once synced, so countdowns follow the storyline clock and not the browser', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(BROWSER_NOW);

    // Act
    syncServerClock(DEMO_AS_OF);
    vi.setSystemTime(BROWSER_NOW + 90_000);

    // Assert
    expect(new Date(clockNow()).toISOString()).toBe('2026-10-06T08:01:30.000Z');
  });

  it('ignores an unparsable server time and keeps the browser clock', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(BROWSER_NOW);

    // Act
    syncServerClock('not a time');

    // Assert
    expect(clockNow()).toBe(BROWSER_NOW);
  });

  it('returns to the browser clock on reset', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(BROWSER_NOW);
    syncServerClock(DEMO_AS_OF);

    // Act
    resetServerClock();

    // Assert
    expect(clockNow()).toBe(BROWSER_NOW);
  });

  it('re-renders useNow consumers when the clock is aligned with the server', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(BROWSER_NOW);
    render(<NowProbe />);
    expect(screen.getByRole('status')).toHaveTextContent('2026-09-30T06:00:00.000Z');

    // Act
    act(() => syncServerClock(DEMO_AS_OF));

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('2026-10-06T08:00:00.000Z');
  });

  it('aligns with the X-Server-Time header of any API response, public pages included', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(BROWSER_NOW);
    installFetch({
      'GET /api/v1/public/test-clock': () => ({
        body: { ok: true },
        headers: { 'x-server-time': DEMO_AS_OF },
      }),
    });

    // Act
    await call(publicPing, {});

    // Assert
    expect(new Date(clockNow()).toISOString()).toBe('2026-10-06T08:00:00.000Z');
  });
});
