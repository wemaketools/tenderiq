import { describe, expect, it } from 'vitest';

import { instantToWallTime, wallTimeToInstant, zoneOffsetMinutes } from './zonedTime';

describe('zoned wall time', () => {
  it('converts an official Gaborone wall time to the UTC instant', () => {
    expect(wallTimeToInstant({ date: '2026-10-14', time: '12:00' }, 'Africa/Gaborone')).toBe(
      '2026-10-14T10:00:00Z',
    );
  });

  it('respects daylight saving in zones that observe it', () => {
    expect(wallTimeToInstant({ date: '2026-07-01', time: '09:00' }, 'America/New_York')).toBe(
      '2026-07-01T13:00:00Z',
    );
    expect(wallTimeToInstant({ date: '2026-01-15', time: '09:00' }, 'America/New_York')).toBe(
      '2026-01-15T14:00:00Z',
    );
  });

  it('returns null for incomplete input', () => {
    expect(wallTimeToInstant({ date: '2026-10-14', time: '' }, 'UTC')).toBeNull();
    expect(wallTimeToInstant({ date: '', time: '10:00' }, 'UTC')).toBeNull();
  });

  it('round-trips an instant through its wall time', () => {
    const wall = instantToWallTime('2026-10-14T10:00:00Z', 'Africa/Gaborone');
    expect(wall).toEqual({ date: '2026-10-14', time: '12:00' });
    expect(wallTimeToInstant(wall, 'Africa/Gaborone')).toBe('2026-10-14T10:00:00Z');
    expect(zoneOffsetMinutes(Date.parse('2026-10-14T10:00:00Z'), 'Africa/Gaborone')).toBe(120);
  });
});
