import { describe, expect, it, vi } from 'vitest';

import { downloadBlob, downloadFromUrl, toCsv } from './download';
import { sha256Hex } from './hash';
import { readRememberedTenant, readStoredTheme, rememberTenant, storeTheme } from './storage';

describe('toCsv', () => {
  it('quotes separators, quotes and new lines', () => {
    expect(toCsv(['Ref', 'Title'], [['T-1', 'Pumps, valves "A"']])).toBe(
      'Ref,Title\r\nT-1,"Pumps, valves ""A"""',
    );
  });

  it('neutralizes spreadsheet formulas and empties missing values', () => {
    expect(toCsv(['A', 'B'], [['=SUM(A1)', null]])).toBe("A,B\r\n'=SUM(A1),");
  });
});

describe('downloads', () => {
  it('refuses non-http URLs', () => {
    expect(() => downloadFromUrl('javascript:alert(1)')).toThrow(/Refusing/);
  });

  it('clicks an anchor with the file name for http URLs and blobs', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:local/1');
    URL.revokeObjectURL = vi.fn();
    downloadFromUrl('/api/v1/files/1', 'report.xlsx');
    downloadBlob(new Blob(['x']), 'x.csv');
    expect(click).toHaveBeenCalledTimes(2);
  });
});

describe('sha256Hex', () => {
  it('returns the lowercase hex digest', async () => {
    const digest = await sha256Hex(new TextEncoder().encode('abc').buffer);
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('storage conveniences (DD-36)', () => {
  it('remembers the active tenant per user and ignores invalid values', () => {
    rememberTenant(7, 42);
    expect(readRememberedTenant(7)).toBe(42);
    expect(readRememberedTenant(8)).toBeNull();
    window.localStorage.setItem('tiq.activeTenant.9', 'not-a-number');
    expect(readRememberedTenant(9)).toBeNull();
    rememberTenant(7, null);
    expect(readRememberedTenant(7)).toBeNull();
  });

  it('stores only valid themes', () => {
    storeTheme('dark');
    expect(readStoredTheme()).toBe('dark');
    window.localStorage.setItem('tiq.theme', 'purple');
    expect(readStoredTheme()).toBeNull();
  });
});
