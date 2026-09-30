/**
 * The suppliers fixtures agree with the other domains of the demo world: the contracts a buyer sees on BUY-31/BUY-32
 * are the contracts domain's (same ids, references, titles, statuses and performance), and the evidence library is
 * the single source of the evidence items the qualification applications and bid answers cite (same ids, owners and
 * content), with every formal submission recorded where SUP-05 shows it.
 */
import { describe, expect, it } from 'vitest';

import { BIDS, BID_EVIDENCE, BID_REVISIONS } from '../bids/responses.js';
import { CONTRACTS, CONTRACT_REVIEWS } from '../contracts/index.js';
import { TENANT_IDS } from '../platform.js';
import { QUALIFICATION_ANSWERS, QUALIFICATION_APPLICATIONS, QUALIFICATION_INFO_REQUESTS } from '../qualification/applications.js';
import { EVIDENCE_ITEMS as QUALIFICATION_EVIDENCE } from '../qualification/world.js';
import { EVIDENCE_ITEMS, EVIDENCE_SUBMISSIONS, RELATIONSHIP_CONTRACTS, findSupplierOrg } from './index.js';

const itemOf = (id: number) => EVIDENCE_ITEMS.find((item) => item.id === id);

describe('contracts on the supplier records match the contracts domain', () => {
  it('pairs each storyline contract reference with the contracts-domain id, buyer and supplier', () => {
    const expected: readonly (readonly [number, string, number, number])[] = [
      [1, 'C-2026-0001', TENANT_IDS.kwu, TENANT_IDS.tsodilo],
      [2, 'C-2026-0002', TENANT_IDS.kwu, TENANT_IDS.tsodilo],
      [3, 'C-2026-0003', TENANT_IDS.kwu, TENANT_IDS.tsodilo],
      [8, 'C-2026-0004', TENANT_IDS.kwu, TENANT_IDS.tsodilo],
      [4, 'C-2025-0007', TENANT_IDS.kwu, TENANT_IDS['gaborone-meter']],
      [5, 'C-2025-0003', TENANT_IDS.kwu, TENANT_IDS['serowe-ict']],
      [6, 'C-2025-0005', TENANT_IDS.kwu, TENANT_IDS['chobe-pipe']],
      [7, 'C-2025-0004', TENANT_IDS.odc, TENANT_IDS['limpopo-env']],
    ];
    for (const [contractId, reference, buyer, supplier] of expected) {
      expect(RELATIONSHIP_CONTRACTS.find((row) => row.contractId === contractId), reference).toMatchObject({
        reference,
        tenantId: buyer,
        supplierTenantId: supplier,
      });
    }
  });

  it('shows every contract of the contracts domain with the same id, reference, title and status', () => {
    expect(RELATIONSHIP_CONTRACTS).toHaveLength(CONTRACTS.length);
    for (const contract of CONTRACTS) {
      expect(RELATIONSHIP_CONTRACTS.find((row) => row.contractId === contract.id), contract.reference).toMatchObject({
        tenantId: contract.tenantId,
        supplierTenantId: contract.supplierTenantId,
        reference: contract.reference,
        title: contract.title,
        status: contract.status,
      });
    }
  });

  it('summarizes the latest performance review with an outcome, including the disputed fleet review', () => {
    const fleet = RELATIONSHIP_CONTRACTS.find((row) => row.reference === 'C-2026-0001');
    expect(fleet?.performance).toMatchObject({ overallRating: 'partially_meets', supplierDisputes: true, supplierResponded: true, status: 'supplier_responded' });
    for (const row of RELATIONSHIP_CONTRACTS) {
      if (row.performance !== null) {
        const review = CONTRACT_REVIEWS.find((candidate) => candidate.id === row.performance?.reviewId);
        expect(review?.contractId, row.reference).toBe(row.contractId);
        expect(review?.status).not.toBe('draft');
        expect(review?.overallRating).toBe(row.performance.overallRating);
      }
    }
  });
});

describe('the evidence library is the single source of evidence items', () => {
  it('holds every item the qualification domain cites, with the same owner and content', () => {
    for (const cited of QUALIFICATION_EVIDENCE) {
      const item = itemOf(cited.id);
      expect(item, `item ${cited.id}`).toBeDefined();
      expect(item).toMatchObject({
        tenantId: cited.supplierTenantId,
        evidenceType: cited.evidenceType,
        title: cited.title,
        issuer: cited.issuer,
        periodStart: cited.periodStart,
        periodEnd: cited.periodEnd,
        reportingCurrency: cited.reportingCurrency,
        isConsolidated: cited.isConsolidated,
        coverage: cited.coverageAmount,
        expiresAt: cited.expiresAt,
        status: cited.status,
        verificationStatus: cited.verificationStatus,
      });
      if (cited.evidenceType !== 'registration') {
        expect(item, `item ${cited.id}`).toMatchObject({ referenceNumber: cited.referenceNumber, validFrom: cited.validFrom });
      }
      if (cited.status === 'replaced') {
        expect(item?.replacedById, `item ${cited.id}`).not.toBeNull();
      }
    }
  });

  it('records every evidence citation of a submitted qualification application as a formal submission', () => {
    for (const application of QUALIFICATION_APPLICATIONS) {
      const citations = [
        ...QUALIFICATION_ANSWERS.filter((answer) => answer.applicationId === application.id).flatMap((answer) => answer.evidence),
        ...QUALIFICATION_INFO_REQUESTS.filter((request) => request.applicationId === application.id).flatMap((request) => request.responseEvidence),
      ];
      for (const citation of citations) {
        const item = itemOf(citation.evidenceItemId);
        expect(item?.tenantId, `${application.reference ?? 'draft'} item ${citation.evidenceItemId}`).toBe(application.supplierTenantId);
        const recorded = EVIDENCE_SUBMISSIONS.filter(
          (submission) => submission.contextType === 'qualification_application' && submission.contextId === application.id && submission.evidenceItemId === citation.evidenceItemId,
        );
        if (application.submittedAt === null) {
          expect(recorded).toHaveLength(0);
        } else {
          expect(recorded, `${application.reference ?? ''} item ${citation.evidenceItemId}`).toHaveLength(1);
          expect(recorded[0]).toMatchObject({ tenantId: application.tenantId, contextReference: application.reference });
          expect((item?.createdAt ?? '9999') <= citation.submittedAt).toBe(true);
        }
      }
    }
  });

  it('records every submitted bid evidence snapshot and owns every item a bid answer cites', () => {
    for (const snapshot of BID_EVIDENCE) {
      const revision = BID_REVISIONS.find((candidate) => candidate.id === snapshot.revisionId);
      const bid = BIDS.find((candidate) => candidate.id === revision?.bidId);
      expect(itemOf(snapshot.evidenceItemId)?.tenantId, `revision ${snapshot.revisionId} item ${snapshot.evidenceItemId}`).toBe(bid?.supplierTenantId);
      if (snapshot.evidenceSubmissionId !== null && revision?.submittedAt !== null) {
        expect(EVIDENCE_SUBMISSIONS.find((submission) => submission.id === snapshot.evidenceSubmissionId)).toMatchObject({
          contextType: 'bid_revision',
          contextId: snapshot.revisionId,
          evidenceItemId: snapshot.evidenceItemId,
          tenantId: bid?.buyerTenantId,
        });
      }
    }
  });

  it('shows Tsodilo the evidence QA-2026-0002 formally used, as the qualification screens do', () => {
    const application = QUALIFICATION_APPLICATIONS.find((candidate) => candidate.reference === 'QA-2026-0002' && candidate.tenantId === TENANT_IDS.kwu);
    const used = EVIDENCE_SUBMISSIONS.filter((submission) => submission.contextId === application?.id && submission.contextType === 'qualification_application')
      .map((submission) => submission.evidenceItemId)
      .sort();
    const cited = [...new Set(QUALIFICATION_ANSWERS.filter((answer) => answer.applicationId === application?.id).flatMap((answer) => answer.evidence.map((entry) => entry.evidenceItemId)))].sort();
    expect(used).toEqual(cited);
    expect(itemOf(401)).toMatchObject({ referenceNumber: findSupplierOrg(TENANT_IDS.tsodilo)?.registrationNumber });
    expect(itemOf(404)).toMatchObject({ issuer: 'Hollard Insurance Botswana', coverage: { amount: '10000000.00', currency: 'BWP' } });
  });
});
