import { describe, expect, it } from 'vitest';

import { ReleaseApprovalRequested, ReleaseReview } from '@contracts/tenders';

import { approvalRequested5, release5 } from '../test/data';
import { withReleaseApprovalRequested } from './overlay';

const review = ReleaseReview.parse(release5);
const requested = ReleaseApprovalRequested.parse(approvalRequested5);

describe('withReleaseApprovalRequested', () => {
  it('keeps the fetched release view unchanged when no approval was requested', () => {
    expect(withReleaseApprovalRequested(review, null)).toBe(review);
  });

  it('lays the pending approval, its readiness and its gate over the fetched view after a request', () => {
    // Act
    const view = withReleaseApprovalRequested(review, requested);

    // Assert
    expect(view.releaseApproval).toMatchObject({ approvalId: 900, status: 'pending' });
    expect(view.approvalHistory.map((row) => row.approvalId)).toEqual([900, 31, 30]);
    expect(view.gate.canRequestReleaseApproval).toBe(false);
    expect(view.gate.blockedReasons).not.toContain('No release approval covers revision 3.');
    expect(view.readiness.map((item) => item.code)).not.toContain('RELEASE_APPROVAL_INVALIDATED');
    expect(view.readiness.map((item) => item.code)).toContain('RELEASE_APPROVAL_PENDING');
    expect(view.checks).toBe(review.checks);
  });
});
