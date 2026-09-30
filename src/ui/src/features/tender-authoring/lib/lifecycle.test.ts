import { describe, expect, it } from 'vitest';

import { closedGateText, versionChipText } from './lifecycle';
import type { TenderLifecycle } from './lifecycle';

const draft: TenderLifecycle = {
  status: 'awaiting_release_approval',
  releasedAt: null,
  officialTimeZone: 'Africa/Gaborone',
  draftRevision: 3,
  currentVersionNo: 0,
};

describe('tender lifecycle wording', () => {
  it('keeps the publication gate and the draft revision while the package is authored', () => {
    expect(closedGateText(draft)).toBeNull();
    expect(versionChipText(draft)).toBe('Draft revision 3');
  });

  it('names the issued version and the official release time once the tender is open', () => {
    const open: TenderLifecycle = {
      ...draft,
      status: 'open',
      releasedAt: '2026-09-14T07:00:00Z',
      currentVersionNo: 2,
    };

    expect(versionChipText(open)).toBe('Issued version 2');
    expect(closedGateText(open)).toEqual({
      title: 'Released',
      detail:
        'Released on 14 Sep 2026, 09:00 (UTC+02:00) Africa/Gaborone. Issued version 2 is live; changes now go through an addendum (BR-16).',
    });
  });

  it('reports a cancelled tender as cancelled rather than ready for publication', () => {
    expect(closedGateText({ ...draft, status: 'cancelled' })?.title).toBe('Cancelled');
  });
});
