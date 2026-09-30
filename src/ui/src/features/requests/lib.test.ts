import { describe, expect, it } from 'vitest';

import type { StrategyDetail } from '@contracts/requests';

import {
  currencyFallback,
  requestNextAction,
  strategyBlocksTender,
  strategyNextAction,
} from './lib';
import { request, strategy } from './testing/data';

const approvedRfi: StrategyDetail = {
  ...strategy,
  id: 503,
  eventType: 'rfi',
  procedure: 'rfi',
  status: 'approved',
  rfiOutcome: {
    rfiTender: {
      id: 4,
      reference: 'T-2026-0004',
      title: 'Leak-detection market consultation',
      status: 'information_collected',
    },
    findingsSummary: 'Five respondents; survey takes 18–24 months.',
    reviewedBy: { userId: 4, fullName: 'Mpho Dikgang' },
    reviewedAt: '2026-06-25T10:00:00Z',
    nextStepDecision: 'Run an open tender for acoustic leak detection services.',
    nextEvent: {
      id: 9,
      reference: 'T-2026-0009',
      title: 'Acoustic leak detection services',
      status: 'under_assessment',
    },
    participationNote: 'RFI participation creates no award entitlement.',
  },
};

describe('requests next-action helpers', () => {
  it('points to the linked event once the RFI findings and next step are recorded (AC-39)', () => {
    expect(strategyNextAction(approvedRfi)).toBe('Follow the linked event T-2026-0009');
  });

  it('asks for the findings while an approved RFI has no reviewed outcome', () => {
    expect(strategyNextAction({ ...approvedRfi, rfiOutcome: null })).toBe(
      'Record the findings and the next-step decision',
    );
  });

  it('follows the linked tender of an approved tender strategy instead of asking to create one', () => {
    const tenderStrategy: StrategyDetail = {
      ...approvedRfi,
      eventType: 'rfq',
      procedure: 'invitation_only',
      rfiOutcome: null,
      tenders: [
        { id: 6, reference: 'T-2026-0006', title: 'Chlorine dosing equipment', status: 'open' },
      ],
    };
    expect(strategyNextAction(tenderStrategy)).toBe('Follow the linked event T-2026-0006');
  });

  it('holds an approved request until its strategy is approved (PRD §8.1)', () => {
    const approved = {
      ...request,
      status: 'approved' as const,
      strategy: { id: 506, revision: 1, procedure: 'open' as const, status: 'draft' as const },
    };
    expect(strategyBlocksTender(approved)).toBe(true);
    expect(requestNextAction(approved)).toBe(
      'Have the procurement strategy approved before creating the tender',
    );
    const ready = { ...approved, strategy: { ...approved.strategy, status: 'approved' as const } };
    expect(strategyBlocksTender(ready)).toBe(false);
    expect(requestNextAction(ready)).toBe('Create the tender from the approved strategy');
    expect(requestNextAction({ ...approved, strategy: null })).toBe(
      'Prepare the strategy and create the tender',
    );
  });

  it('falls back to the first known currency and never to a literal code', () => {
    expect(currencyFallback(null, 'ZAR', 'BWP')).toBe('ZAR');
    expect(currencyFallback(undefined, '', null)).toBe('');
  });
});
