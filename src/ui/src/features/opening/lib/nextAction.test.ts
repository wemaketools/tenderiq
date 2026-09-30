import { describe, expect, it } from 'vitest';

import type { OpeningSessionRow, TenderOpeningOverview } from '@contracts/opening';

import { overview } from '../test/data';
import { tenderNextAction } from './nextAction';

function sessionRow(quorum: OpeningSessionRow['quorum']): OpeningSessionRow {
  return {
    id: 180,
    tenderId: 8,
    tenderReference: 'T-2026-0008',
    tenderTitle: 'Pipeline valves bulk supply',
    lot: null,
    envelope: 'qualification',
    status: 'awaiting_quorum',
    scheduledAt: { at: '2026-09-30T08:00:00Z', timeZone: 'Africa/Gaborone' },
    openedAt: null,
    openingOfficer: { userId: 15, fullName: 'Oratile Baitse' },
    quorum,
    envelopesOpened: 0,
    publicReleaseApproved: false,
  };
}

function withSession(quorum: OpeningSessionRow['quorum']): TenderOpeningOverview {
  return { ...overview(), sessions: [sessionRow(quorum)] };
}

describe('tenderNextAction (BUY-20 next required action)', () => {
  it('asks for presence while the stage awaits a quorum that is not met', () => {
    const next = tenderNextAction(withSession({ required: 2, confirmed: 1, met: false }));

    expect(next).toBe('The participants must confirm presence for the Qualification stage.');
  });

  it('moves on to the opening once the quorum of the stage session is met', () => {
    const next = tenderNextAction(withSession({ required: 2, confirmed: 2, met: true }));

    expect(next).toBe('The opening officer opens the Qualification stage at the scheduled time.');
  });

  it('names the price gate when only the commercial stage is left', () => {
    const base = overview();
    const stages = base.stages.map((stage) =>
      stage.envelope === 'commercial' ? stage : { ...stage, state: 'opened' as const },
    );

    expect(tenderNextAction({ ...base, stages })).toBe(
      'The evaluation chair must release the price gate before the Commercial stage opens.',
    );
  });
});
