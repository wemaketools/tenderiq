/**
 * The workspace fixtures agree with the rest of the demo world (single storyline):
 * - every in-app link of a task, notification, approval or document opens a real SPA route;
 * - every approval id another domain refers to resolves here with the same subject, version, status and dates;
 * - the AC-05 and AC-06 anchors show the facts the owning domains show on BUY-04 and BUY-13;
 * - the records the workspace names carry the owning domain's reference and title.
 */
import { describe, expect, it } from 'vitest';

import { ADDENDA } from '../clarifications/index.js';
import { CONTRACTS, CONTRACT_APPROVALS } from '../contracts/core.js';
import { APPROVALS, findFixtureApproval } from '../approvals.js';
import { DOCUMENTS } from '../documents.js';
import { NOTIFICATIONS } from '../notifications.js';
import { EXCLUSIONS } from '../opening.js';
import { TENDERS as PUBLICATION_TENDERS } from '../publication/tenders.js';
import { REQUESTS } from '../requests/requests.js';
import { STRATEGIES } from '../requests/strategies.js';
import { NEGOTIATIONS, PREFERRED_BIDDERS, PROCESS_DECISIONS, SHORTLISTS } from '../selection/index.js';
import { TASKS } from '../tasks.js';
import { MATERIAL_CHANGES, RELEASE_APPROVALS } from '../tenders/release.js';
import { TENDERS } from '../tenders/tenders.js';
import { matchesRoute, spaRoutePatterns } from './spa-routes.js';
import { RECORDS, uid } from './world.js';

const ROUTES = spaRoutePatterns();

describe('workspace links', () => {
  it('reads a route table that covers every feature area', () => {
    for (const pattern of ['/me/tasks', '/buyer/evaluation/tenders/:tenderId', '/supplier/organization', '/ops/support/cases/:caseId']) {
      expect(ROUTES).toContain(pattern);
    }
    expect(matchesRoute('/buyer/evaluation/3', ROUTES)).toBe(false);
  });

  it('opens a real page from every task source link', () => {
    const dead = TASKS.filter((task) => task.sourceLinkPath !== null && !matchesRoute(task.sourceLinkPath, ROUTES)).map(
      (task) => `${task.id} ${task.sourceLinkPath ?? ''}`,
    );
    expect(dead).toEqual([]);
  });

  it('opens a real page from every notification link', () => {
    const dead = NOTIFICATIONS.filter((row) => row.linkPath !== null && !matchesRoute(row.linkPath, ROUTES)).map(
      (row) => `${row.id} ${row.linkPath ?? ''}`,
    );
    expect(dead).toEqual([]);
  });

  it('opens a real page from every approval subject and document record link', () => {
    const dead = [
      ...APPROVALS.filter((approval) => !matchesRoute(approval.subjectLinkPath, ROUTES)).map((approval) => `approval ${approval.id}`),
      ...DOCUMENTS.flatMap((document) =>
        [document.relatedLinkPath, document.supplierLinkPath]
          .filter((link): link is string => link !== null && !matchesRoute(link, ROUTES))
          .map((link) => `document ${document.id} ${link}`),
      ),
    ];
    expect(dead).toEqual([]);
  });
});

describe('approval ids referenced by other domains', () => {
  it('resolves every tender release approval with the tenders domain facts', () => {
    for (const source of RELEASE_APPROVALS) {
      expect(findFixtureApproval(source.approvalId), `approval ${source.approvalId}`).toMatchObject({
        subjectType: 'tender_release',
        subjectId: source.tenderId,
        subjectVersion: source.subjectVersion,
        contentHash: source.contentHash,
        status: source.status,
        requestedByUserId: source.requestedBy,
        requestedAt: source.requestedAt,
        decidedAt: source.decidedAt,
        amount: source.amount === null ? null : { amount: source.amount, currency: 'BWP' },
      });
    }
  });

  it('resolves every release approval the publication screens link to', () => {
    for (const tender of PUBLICATION_TENDERS) {
      const reference = tender.releaseApproval;
      if (reference.approvalRequestId === null) continue;
      expect(findFixtureApproval(reference.approvalRequestId), `approval ${reference.approvalRequestId}`).toMatchObject({
        subjectType: 'tender_release',
        status: reference.status,
        subjectVersion: reference.subjectVersion,
      });
    }
  });

  it('resolves every procurement request and strategy approval with the requests domain facts', () => {
    for (const request of REQUESTS.filter((row) => row.approval !== null)) {
      const approval = findFixtureApproval(request.approval?.approvalId ?? 0);
      expect(approval, request.reference).toMatchObject({
        subjectType: 'procurement_request',
        subjectId: request.id,
        subjectReference: request.reference,
        status: request.approval?.status,
        requestedAt: request.approval?.requestedAt,
        dueAt: request.approval?.dueAt,
        requestedByUserId: request.requesterUserId,
      });
      expect(approval?.title).toContain(request.title);
    }
    for (const strategy of STRATEGIES.filter((row) => row.approval !== null)) {
      expect(findFixtureApproval(strategy.approval?.approvalId ?? 0), strategy.title).toMatchObject({
        subjectType: 'strategy',
        subjectId: strategy.id,
        status: strategy.approval?.status,
        decidedAt: strategy.approval?.decidedAt,
      });
    }
  });

  it('resolves every exclusion, selection, award, addendum and linked contract approval', () => {
    for (const exclusion of EXCLUSIONS.filter((row) => row.approvalRequestId !== null)) {
      expect(findFixtureApproval(exclusion.approvalRequestId ?? 0), `exclusion ${exclusion.id}`).toMatchObject({
        subjectType: 'exclusion',
        subjectId: exclusion.id,
        status: exclusion.approvalStatus,
        requestedAt: exclusion.proposedAt,
      });
    }
    const selection = [
      ...SHORTLISTS.map((row) => ({ type: 'shortlist', id: row.shortlistId, row })),
      ...PREFERRED_BIDDERS.map((row) => ({ type: 'preferred_bidder', id: row.preferredBidderId, row })),
      ...NEGOTIATIONS.map((row) => ({ type: 'negotiation_mandate', id: row.negotiationId, row })),
      ...PROCESS_DECISIONS.map((row) => ({ type: 'process_decision', id: row.processDecisionId, row })),
    ];
    for (const { type, id, row } of selection) {
      if (row.approval === null) continue;
      expect(findFixtureApproval(row.approval.approvalRequestId), `${type} ${id}`).toMatchObject({
        subjectType: type,
        subjectId: id,
        subjectVersion: row.version,
        contentHash: row.contentHash,
        status: row.approval.status,
        requestedAt: row.approval.requestedAt,
        decidedAt: row.approval.decidedAt,
      });
    }
    for (const addendum of ADDENDA.filter((row) => row.approvalRequestId !== null)) {
      expect(findFixtureApproval(addendum.approvalRequestId ?? 0)).toMatchObject({ subjectType: 'addendum', subjectId: addendum.id });
    }
    for (const approval of CONTRACT_APPROVALS.filter((row) => row.inApprovalWorkspace)) {
      expect(findFixtureApproval(approval.id)).toMatchObject({ title: approval.title, status: approval.status });
    }
  });

  it('holds exactly one row per approval id', () => {
    const ids = APPROVALS.map((approval) => approval.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('AC-05 and AC-06 anchors', () => {
  it('shows PR-2026-0003 as approval 305: total commitment routed from the manager to the Chief Executive (AC-05)', () => {
    const request = REQUESTS.find((row) => row.reference === 'PR-2026-0003' && row.tenantId === RECORDS.pr3.tenantId);
    const approval = findFixtureApproval(305);

    expect(request?.approval?.approvalId).toBe(305);
    expect(approval).toMatchObject({
      title: 'Approve PR-2026-0003 Northern wellfield pipeline extension',
      amount: { amount: '5120000.00', currency: 'BWP' },
      status: 'pending',
      routing: { reason: 'authority_exceeded', skippedUserId: uid('mpho.manager'), routedToUserId: uid('keabetswe.approver') },
    });
    expect(approval?.snapshotFacts.find((fact) => fact.key === 'estimatedValue')?.value).toBe('BWP 4,850,000.00');
    expect(approval?.steps.map((step) => [step.approverUserId, step.status])).toEqual([
      [uid('mpho.manager'), 'skipped'],
      [uid('keabetswe.approver'), 'pending'],
    ]);
  });

  it('shows approval 31 as the approved revision 2 of T-2026-0005, invalidated by revision 3, with 30 as its history (AC-06)', () => {
    const approval = findFixtureApproval(31);
    const changes = MATERIAL_CHANGES.filter((change) => change.invalidatedApprovalId === 31);

    expect(approval).toMatchObject({
      status: 'invalidated',
      subjectVersion: 2,
      currentSubjectVersion: TENDERS.find((tender) => tender.id === 5)?.draftRevision,
      decidedAt: '2026-09-25T12:10:00Z',
      invalidatedAt: '2026-09-28T09:14:00Z',
      steps: [expect.objectContaining({ decidedByUserId: uid('mpho.manager'), status: 'approved' })],
    });
    expect(approval?.invalidation?.changes.map((change) => [change.before, change.after])).toEqual(
      changes.map((change) => [change.fromValue, change.toValue]),
    );
    expect(approval?.invalidation?.changes.map((change) => change.after)).toContain('BWP 1,920,000.00');
    expect(findFixtureApproval(30)).toMatchObject({ subjectType: 'tender_release', subjectId: 5, status: 'returned', subjectVersion: 1 });
  });

  it('pins the evidence of approval 31 to the specification version of revision 2, not the later one', () => {
    const specification = DOCUMENTS.find((document) => document.id === 203);
    const pinned = findFixtureApproval(31)?.evidence[0];
    const version = specification?.versions.find((candidate) => candidate.id === pinned?.versionId);

    expect(version?.versionNo).toBe(2);
    expect(specification?.versions.at(-1)?.versionNo).toBe(3);
  });
});

describe('records named by the workspace', () => {
  it('carry the owning domain reference, title and organization', () => {
    for (const record of Object.values(RECORDS)) {
      const owner =
        record.type === 'tender'
          ? TENDERS.find((row) => row.id === record.id)
          : record.type === 'procurement_request'
            ? REQUESTS.find((row) => row.id === record.id)
            : CONTRACTS.find((row) => row.id === record.id);
      expect(owner, record.reference).toMatchObject({ reference: record.reference, title: record.title, tenantId: record.tenantId });
    }
  });
});
