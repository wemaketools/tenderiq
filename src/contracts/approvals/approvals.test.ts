import { describe, expect, it } from 'vitest';

import { ApprovalDetail, ApprovalEvidence, ApprovalRouting, MyApprovalListQuery } from '../approvals.js';

describe('approvals contract extensions (COM-05)', () => {
  it('parses the involvement and request-date filters of the inbox', () => {
    expect(MyApprovalListQuery.parse({ involvement: ['approver', 'delegate'], requestedFrom: '2026-10-01' })).toMatchObject({
      involvement: ['approver', 'delegate'],
      requestedFrom: '2026-10-01',
    });
  });

  it('describes the AC-05 routing hint with both limits', () => {
    const routing = {
      reason: 'authority_exceeded',
      skipped: { userId: 4, fullName: 'Mpho Dikgang' },
      skippedCapacity: 'Procurement Manager',
      skippedLimit: { amount: '2000000.00', currency: 'BWP' },
      routedTo: { userId: 18, fullName: 'Keabetswe Nkwe' },
      routedToCapacity: 'Chief Executive (Award Approver)',
      routedToLimit: { amount: '10000000.00', currency: 'BWP' },
      routedAt: '2026-09-30T07:30:05Z',
      note: null,
    };
    expect(ApprovalRouting.parse(routing)).toEqual(routing);
  });

  it('keeps the COM-05 extensions optional for existing consumers', () => {
    const shape = ApprovalDetail.shape;
    for (const key of ['versionSnapshot', 'routing', 'invalidation', 'relatedApprovals', 'conditionsPermitted'] as const) {
      expect(shape[key].safeParse(undefined).success).toBe(true);
    }
  });

  it('pins evidence to the exact version decided on (BR-10)', () => {
    const evidence = {
      documentId: 203,
      versionId: 2032,
      title: 'Technical specification',
      classification: 'buyer_internal',
      versionNo: 2,
      latestVersionNo: 3,
      isRedactedCopy: false,
    };
    expect(ApprovalEvidence.parse(evidence)).toEqual(evidence);
    const { versionId: _omitted, ...withoutVersion } = evidence;
    expect(ApprovalEvidence.safeParse(withoutVersion).success).toBe(false);
  });
});
