/**
 * Publication fixtures: every fixture parses against its contract schema, references resolve (tenants, personas,
 * tenders, lots, addenda, sessions, categories), document digests match their bytes, the storyline anchors hold,
 * and every read endpoint answers contract-valid data for every tender and persona of the demo world.
 */
import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  CategoryLabel,
  NoticeAddendum,
  NoticeCondition,
  NoticeLot,
  NoticeMilestone,
  NoticeVersion,
  PackageDocument,
  PublicationRow,
  ReleaseApprovalState,
  publicationEndpoints as ep,
} from '../../../contracts/publication.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from '../../handlers/publication/index.js';
import { participantRow, publicationRow } from '../../handlers/publication/projections.js';
import { findPersonaById, findTenantById } from '../../persona.js';
import { BID_TENDERS } from '../bids/index.js';
import { ADDENDA, SESSIONS } from '../clarifications/index.js';
import { PERSONAS } from '../platform.js';
import { TENDERS as OWNER_TENDERS } from '../tenders/index.js';
import {
  ADVANCE_NOTICES,
  CATEGORIES,
  DISMISSALS,
  HELP_ARTICLES,
  INTEGRATION_EXCEPTIONS,
  PARTICIPANTS,
  PUBLICATIONS,
  PURSUITS,
  QUALIFICATION_STATUSES,
  REGIONS,
  SAVED_SEARCHES,
  SUBSCRIPTIONS,
  SUPPLIER_PROFILES,
  TENDERS,
  WATCHLIST_ITEMS,
  documentBytes,
} from '../publication.js';

const categoryCodes = new Set(CATEGORIES.map((category) => category.code));

function isActiveMember(userId: number, tenantId: number): boolean {
  return findPersonaById(userId)?.memberships.some((membership) => membership.tenantId === tenantId && membership.status === 'active') === true;
}

describe('publication fixtures parse against the contract schemas', () => {
  it('parses every category', () => {
    for (const category of CATEGORIES) {
      expect(CategoryLabel.parse(category)).toEqual(category);
      expect(category.parentCode === null || categoryCodes.has(category.parentCode)).toBe(true);
    }
  });

  it('parses the notice parts of every tender', () => {
    for (const tender of TENDERS) {
      tender.lots.forEach((entry) => NoticeLot.parse(entry));
      tender.milestones.forEach((entry) => NoticeMilestone.parse(entry));
      tender.versions.forEach((entry) => NoticeVersion.parse(entry));
      tender.conditions.forEach((entry) => NoticeCondition.parse(entry));
      tender.addenda.forEach(({ acknowledgmentRequired: _required, ...entry }) => NoticeAddendum.parse(entry));
      tender.documents.forEach(({ accessRule: _rule, spec: _spec, ...entry }) => PackageDocument.parse(entry));
      ReleaseApprovalState.parse(tender.releaseApproval);
    }
  });

  it('projects every publication and participant to a contract-valid row', () => {
    for (const publication of PUBLICATIONS) {
      expect(() => PublicationRow.parse(publicationRow(publication))).not.toThrow();
    }
    for (const participant of PARTICIPANTS) {
      expect(participantRow(participant).id).toBe(participant.id);
    }
  });
});

describe('publication fixtures are internally consistent', () => {
  it('uses the storyline references and the tender id convention', () => {
    for (const tender of TENDERS) {
      expect(tender.reference).toBe(`T-2026-${String(tender.id).padStart(4, '0')}`);
      expect(findTenantById(tender.tenantId)?.kind).toBe('buyer');
      expect(categoryCodes.has(tender.categoryCode)).toBe(true);
      expect(tender.regions.every((region) => REGIONS.includes(region))).toBe(true);
      expect(isActiveMember(tender.ownerUserId, tender.tenantId)).toBe(true);
      expect(tender.lots.every((entry) => entry.lotId === tender.id * 100 + entry.lotNo)).toBe(true);
      expect(tender.conditions.every((entry) => Math.floor(entry.conditionId / 10) === tender.id)).toBe(true);
      expect(tender.documents.every((document) => Math.floor((document.documentId - 7000) / 10) === tender.id)).toBe(true);
      expect(tender.sessions.every((session) => session.alternativeOfId === null || tender.sessions.some((entry) => entry.sessionId === session.alternativeOfId))).toBe(true);
      expect(tender.addenda.every((addendum) => tender.versions.some((version) => version.versionNo === addendum.resultingVersionNo))).toBe(true);
      expect(tender.versions.length).toBe(tender.currentVersionNo);
    }
  });

  it('publishes document sizes and digests of the exact downloadable bytes', () => {
    for (const document of TENDERS.flatMap((tender) => tender.documents)) {
      const bytes = documentBytes(document.spec);
      expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
      expect(bytes.length).toBe(document.sizeBytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(document.sha256);
    }
  });

  it('keeps participants on released tenders of their buyer with valid lots, addenda, sessions and actors', () => {
    const ids = new Set<number>();
    for (const participant of PARTICIPANTS) {
      const tender = TENDERS.find((entry) => entry.id === participant.tenderId);
      expect(tender, `participant ${participant.id}`).toBeDefined();
      if (tender === undefined) {
        continue;
      }
      expect(ids.has(participant.id)).toBe(false);
      ids.add(participant.id);
      expect(participant.id).toBe(tender.id * 100 + participant.supplierTenantId);
      expect(participant.tenantId).toBe(tender.tenantId);
      expect(tender.releasedAt).not.toBeNull();
      expect(findTenantById(participant.supplierTenantId)?.kind).toBe('supplier');
      expect(participant.selectedLotIds.every((lotId) => tender.lots.some((entry) => entry.lotId === lotId))).toBe(true);
      expect(participant.acknowledgments.every((ack) => tender.addenda.some((addendum) => addendum.addendumId === ack.subjectId))).toBe(true);
      expect(participant.acknowledgments.every((ack) => isActiveMember(ack.acknowledgedByUserId, participant.supplierTenantId))).toBe(true);
      expect(participant.sessionRegistrations.every((registration) => tender.sessions.some((session) => session.sessionId === registration.sessionId))).toBe(true);
      expect(participant.history.every((event) => event.actorUserId === null || isActiveMember(event.actorUserId, event.actorTenantId))).toBe(true);
      if (participant.confidentialityAcceptedByUserId !== null) {
        expect(isActiveMember(participant.confidentialityAcceptedByUserId, participant.supplierTenantId)).toBe(true);
      }
      if (participant.sharedNoBidReason !== null) {
        expect(participant.bidIntent).toBe('no_bid');
      }
    }
  });

  it('derives release dates, addenda, versions, deadlines, lots and sessions from the owning fixtures', () => {
    for (const tender of TENDERS) {
      const owner = OWNER_TENDERS.find((entry) => entry.id === tender.id);
      if (owner === undefined) {
        continue;
      }
      expect(tender.releasedAt, tender.reference).toBe(owner.releasedAt);
      const issued = ADDENDA.filter((addendum) => addendum.tenderId === tender.id && addendum.status === 'issued');
      expect(tender.addenda.map((addendum) => addendum.addendumId)).toEqual(issued.map((addendum) => addendum.id));
      expect(tender.versions[0]?.issuedAt ?? null).toBe(owner.releasedAt);
      expect(tender.sessions.map((session) => session.sessionId).sort()).toEqual(
        SESSIONS.filter((session) => session.tenderId === tender.id)
          .map((session) => session.id)
          .sort(),
      );
      const bidTender = BID_TENDERS.find((entry) => entry.id === tender.id);
      if (bidTender !== undefined && tender.releasedAt !== null) {
        expect(tender.currentVersionNo, tender.reference).toBe(bidTender.currentVersionNo);
        if (bidTender.rounds.length === 1) {
          expect(tender.submissionDeadline, tender.reference).toBe(bidTender.rounds[0]?.deadline);
        }
        // Every lot the bids (and hence the clarifications) fixtures cite, including a single Lot 1, is published.
        if (bidTender.lots.length > 0) {
          expect(tender.lots.map((entry) => `${entry.lotId}:${entry.stage}`), tender.reference).toEqual(
            bidTender.lots.map((entry) => `${entry.id}:${entry.stage}`),
          );
        }
      }
      for (const addendum of issued) {
        // An addendum's affected lots all resolve to published lots (PUB-04: no "affects all lots" by omission).
        expect(tender.addenda.find((entry) => entry.addendumId === addendum.id)?.affectedLotNos, `addendum ${addendum.id}`).toHaveLength(addendum.lotIds.length);
      }
      for (const document of tender.documents) {
        const addendum = tender.addenda.find((entry) => entry.number === document.addendumNo);
        expect(document.publishedAt).toBe(addendum?.issuedAt ?? tender.releasedAt ?? tender.scheduledReleaseAt);
      }
    }
  });

  it('keeps T-2026-0011 at version 2 after Addendum 1 with its two open lots and the 23 Oct deadline', () => {
    const tender = TENDERS.find((entry) => entry.id === 11);
    expect(tender).toMatchObject({ currentVersionNo: 2, submissionDeadline: '2026-10-23T10:00:00Z', releasedAt: '2026-09-16T07:00:00Z' });
    expect(tender?.addenda).toEqual([expect.objectContaining({ addendumId: 111, number: 1, issuedAt: '2026-09-20T07:00:00Z', affectedLotNos: [1] })]);
    expect(tender?.lots.map((entry) => [entry.lotId, entry.title, entry.stage])).toEqual([
      [1101, 'Council headquarters, Maun', 'open'],
      [1102, 'District clinics', 'open'],
    ]);
    expect(PARTICIPANTS.filter((participant) => participant.tenderId === 11).map((participant) => [participant.supplierTenantId, participant.selectedLotIds])).toEqual([
      [8, [1101, 1102]],
      [6, [1101]],
      [5, []],
    ]);
  });

  it('publishes every issued version on the portal at its issue date', () => {
    for (const tender of TENDERS) {
      for (const version of tender.versions) {
        const portal = PUBLICATIONS.find((row) => row.tenderId === tender.id && row.versionNo === version.versionNo && row.channel === 'portal');
        expect(portal?.publishedAt, `${tender.reference} v${version.versionNo}`).toBe(version.issuedAt);
      }
      const pairs = PUBLICATIONS.filter((row) => row.tenderId === tender.id).map((row) => `${row.versionNo}:${row.channel}`);
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });

  it('takes acknowledgments and session registrations from the clarifications fixtures (DD-42)', () => {
    for (const participant of PARTICIPANTS) {
      const expected = ADDENDA.filter((addendum) => addendum.tenderId === participant.tenderId && addendum.status === 'issued').flatMap((addendum) =>
        addendum.recipients
          .filter((recipient) => recipient.supplierTenantId === participant.supplierTenantId && recipient.acknowledgedAt !== null)
          .map((recipient) => `${addendum.id}@${recipient.acknowledgedAt ?? ''}`),
      );
      expect(participant.acknowledgments.map((ack) => `${ack.subjectId}@${ack.acknowledgedAt}`)).toEqual(expected);
      for (const ack of participant.acknowledgments) {
        const addendum = TENDERS.find((tender) => tender.id === participant.tenderId)?.addenda.find((entry) => entry.addendumId === ack.subjectId);
        expect(ack.acknowledgedAt >= (addendum?.issuedAt ?? '')).toBe(true);
      }
      const tender = TENDERS.find((entry) => entry.id === participant.tenderId);
      expect(participant.registeredAt >= (tender?.releasedAt ?? '')).toBe(true);
    }
  });

  it('keeps invitation-only and restricted events off the public portal (AC-01)', () => {
    const hidden = TENDERS.filter((tender) => tender.participation !== 'open');
    expect(hidden.map((tender) => tender.reference).sort()).toEqual(['T-2026-0006', 'T-2026-0009']);
    const invited = PARTICIPANTS.filter((participant) => participant.tenderId === 6 && participant.source === 'invited').map((participant) => participant.supplierTenantId);
    expect(invited.sort()).toEqual([4, 5]);
    expect(PARTICIPANTS.find((participant) => participant.id === 606)).toMatchObject({ source: 'access_request', accessStatus: 'requested', qualificationGate: 'not_met' });
  });

  it('links publications and exceptions within one buyer', () => {
    for (const publication of PUBLICATIONS) {
      const tender = TENDERS.find((entry) => entry.id === publication.tenderId);
      expect(tender?.tenantId).toBe(publication.tenantId);
      if (publication.exceptionId !== null) {
        const exception = INTEGRATION_EXCEPTIONS.find((entry) => entry.id === publication.exceptionId);
        expect(exception?.recordId).toBe(publication.id);
        expect(exception?.tenantId).toBe(publication.tenantId);
      }
    }
    expect(PUBLICATIONS.find((publication) => publication.id === 222)).toMatchObject({ status: 'failed', exceptionId: 901 });
    expect(INTEGRATION_EXCEPTIONS.find((exception) => exception.id === 901)?.status).toBe('open');
  });

  it('dates watchlist entries and pursuits after the tender release', () => {
    const releasedAt = (tenderId: number) => TENDERS.find((tender) => tender.id === tenderId)?.releasedAt ?? '9999';
    for (const item of WATCHLIST_ITEMS) {
      expect(item.addedAt >= releasedAt(item.tenderId), `watchlist ${item.id}`).toBe(true);
    }
    for (const pursuit of PURSUITS) {
      expect(pursuit.createdAt >= releasedAt(pursuit.tenderId), `pursuit ${pursuit.id}`).toBe(true);
    }
  });

  it('keeps pursuits, teams and notes inside the supplier organization', () => {
    for (const pursuit of PURSUITS) {
      expect(pursuit.id).toBe(pursuit.tenantId * 1000 + pursuit.tenderId);
      const tender = TENDERS.find((entry) => entry.id === pursuit.tenderId);
      expect(tender?.tenantId).toBe(pursuit.buyerTenantId);
      expect(pursuit.pursuitOwnerUserId === null || isActiveMember(pursuit.pursuitOwnerUserId, pursuit.tenantId)).toBe(true);
      expect(pursuit.team.every((member) => isActiveMember(member.userId, pursuit.tenantId))).toBe(true);
      expect(pursuit.team.every((member) => member.lotIds.every((lotId) => tender?.lots.some((entry) => entry.lotId === lotId)))).toBe(true);
      expect(pursuit.notes.every((note) => isActiveMember(note.authorUserId, pursuit.tenantId))).toBe(true);
      expect(PARTICIPANTS.some((participant) => participant.tenderId === pursuit.tenderId && participant.supplierTenantId === pursuit.tenantId)).toBe(true);
    }
  });

  it('keeps discovery rows owned by active members and pointing at known categories and buyers', () => {
    for (const row of [...SAVED_SEARCHES, ...WATCHLIST_ITEMS, ...SUBSCRIPTIONS, ...DISMISSALS]) {
      expect(isActiveMember(row.userId, row.tenantId)).toBe(true);
    }
    for (const search of SAVED_SEARCHES) {
      expect(search.catalogCodes.every((code) => categoryCodes.has(code))).toBe(true);
      expect(search.buyerTenantIds.every((id) => findTenantById(id)?.kind === 'buyer')).toBe(true);
    }
    for (const subscription of SUBSCRIPTIONS) {
      expect(subscription.catalogCode === null || categoryCodes.has(subscription.catalogCode)).toBe(true);
      expect(subscription.buyerTenantId === null || findTenantById(subscription.buyerTenantId)?.kind === 'buyer').toBe(true);
    }
    for (const profile of SUPPLIER_PROFILES) {
      expect(profile.catalogCodes.every((code) => categoryCodes.has(code))).toBe(true);
    }
    expect(QUALIFICATION_STATUSES.find((status) => status.supplierTenantId === 6)?.effectiveStatus).toBe('not_assessed');
    expect(ADVANCE_NOTICES.every((notice) => categoryCodes.has(notice.categoryCode))).toBe(true);
    expect(new Set(HELP_ARTICLES.map((article) => article.topic))).toEqual(
      new Set(['registration', 'qualification', 'submission', 'complaints', 'accessibility', 'evaluation', 'contracts', 'general']),
    );
  });
});

describe('every read endpoint answers contract-valid data for the whole demo world', () => {
  let api: TestMockApp;

  beforeAll(async () => {
    api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'publication', register }], now: () => new Date('2026-09-30T08:00:00Z') });
  });

  it('serves every buyer tender to its owner', async () => {
    for (const tender of TENDERS) {
      const owner = findPersonaById(tender.ownerUserId);
      const slug = findTenantById(tender.tenantId)?.slug ?? '';
      expect(owner).toBeDefined();
      const email = owner?.email ?? '';
      const calls = [
        await api.callAs(email, ep.publicationOverview, { tenant: slug, params: { tenderId: tender.id } }),
        await api.callAs(email, ep.listParticipants, { tenant: slug, params: { tenderId: tender.id }, query: { pageSize: 100 } }),
        await api.callAs(email, ep.participantSummary, { tenant: slug, params: { tenderId: tender.id } }),
        await api.callAs(email, ep.invitationCandidates, { tenant: slug, params: { tenderId: tender.id }, query: { includeParticipants: true } }),
        ...(await Promise.all(
          PARTICIPANTS.filter((participant) => participant.tenderId === tender.id).map((participant) =>
            api.callAs(email, ep.getParticipant, { tenant: slug, params: { tenderId: tender.id, participantId: participant.id } }),
          ),
        )),
      ];
      expect(calls.map((response) => response.status), tender.reference).toEqual(calls.map(() => 200));
    }
    for (const [email, slug] of [['tebogo.officer@tenderiq.local', 'kwu'], ['officer.odc@tenderiq.local', 'odc']] as const) {
      expect((await api.callAs(email, ep.listPublications, { tenant: slug, query: { pageSize: 100 } })).status).toBe(200);
    }
  });

  it('serves every supplier member its discovery, invitations, pursuits and workspaces', async () => {
    const supplierPersonas = PERSONAS.filter((persona) => persona.status === 'active').flatMap((persona) =>
      persona.memberships
        .filter((membership) => membership.status === 'active' && findTenantById(membership.tenantId)?.kind === 'supplier')
        .map((membership) => ({ email: persona.email, slug: findTenantById(membership.tenantId)?.slug ?? '', tenantId: membership.tenantId })),
    );
    expect(supplierPersonas.length).toBeGreaterThan(15);
    for (const { email, slug, tenantId } of supplierPersonas) {
      const list = await api.callAs(email, ep.listOpportunities, { tenant: slug, query: { pageSize: 100, includeDismissed: true } });
      expect(list.status, email).toBe(200);
      const tenderIds = (list.body as { items: Array<{ tender: { tenderId: number } }> }).items.map((row) => row.tender.tenderId);
      const reads = [
        await api.callAs(email, ep.opportunityFilters, { tenant: slug }),
        await api.callAs(email, ep.listInvitations, { tenant: slug, query: { pageSize: 100 } }),
        await api.callAs(email, ep.listPursuits, { tenant: slug, query: { pageSize: 100 } }),
        await api.callAs(email, ep.listWatchlist, { tenant: slug }),
        await api.callAs(email, ep.listSavedSearches, { tenant: slug }),
        await api.callAs(email, ep.listSubscriptions, { tenant: slug }),
        ...(await Promise.all(tenderIds.map((tenderId) => api.callAs(email, ep.opportunityWorkspace, { tenant: slug, params: { tenderId } })))),
        ...(await Promise.all(tenderIds.map((tenderId) => api.callAs(email, ep.getPursuit, { tenant: slug, params: { tenderId } })))),
        ...(await Promise.all(
          PARTICIPANTS.filter((participant) => participant.supplierTenantId === tenantId && (participant.source === 'invited' || participant.accessStatus !== 'not_required')).map(
            (participant) => api.callAs(email, ep.getInvitation, { tenant: slug, params: { participantId: participant.id } }),
          ),
        )),
      ];
      expect(reads.map((response) => response.status), email).toEqual(reads.map(() => 200));
    }
  });

  it('serves every public notice and guidance article', async () => {
    const search = await api.request('GET', '/api/v1/public/opportunities', { query: { pageSize: 100 } });
    const rows = (search.body as { items: Array<{ linkPath: string }> }).items;
    for (const row of rows) {
      const notice = await api.request('GET', `/api/v1/public${row.linkPath}`);
      expect(notice.status, row.linkPath).toBe(200);
    }
    for (const article of HELP_ARTICLES.filter((entry) => entry.status === 'published' && (entry.audience === 'public' || entry.audience === 'all'))) {
      expect((await api.request('GET', `/api/v1/public/guidance/${article.slug}`)).status).toBe(200);
    }
    for (const slug of ['kwu', 'odc']) {
      expect((await api.request('GET', `/api/v1/public/buyers/${slug}`)).status).toBe(200);
    }
    expect(api.logs.some((line) => line.includes('drift'))).toBe(false);
  });
});
