/**
 * Test kit for the publication, public-portal and opportunities pages: typed copies of recorded, contract-valid
 * responses (parsed with the contract so drift fails loudly), session states per persona and a fetch installer.
 */
import { publicationEndpoints as E } from '@contracts/publication';
import type { PermissionCode } from '@contracts/permissions';
import { listTenders } from '@contracts/tenders';

import { installFetch } from '../../../test/fetchMock';
import type { MockHandler } from '../../../test/fetchMock';
import { makeMembership, makeTenant, signedInSession, stateWith } from '../../../test/fixtures';
import { RESPONSES } from './responses';

const clone = <T>(value: T): unknown => JSON.parse(JSON.stringify(value)) as unknown;

export const data = {
  portalHome: () => E.portalHome.response.parse(clone(RESPONSES.portalHome)),
  buyerPortal: () => E.buyerPortal.response.parse(clone(RESPONSES.buyerPortal)),
  publicSearch: () => E.searchPublic.response.parse(clone(RESPONSES.publicSearch)),
  publicFilters: () => E.publicFilters.response.parse(clone(RESPONSES.publicFilters)),
  publicNotice: () => E.publicNotice.response.parse(clone(RESPONSES.publicNotice)),
  publicNotice11: () => E.publicNotice.response.parse(clone(RESPONSES.publicNotice11)),
  guidance: () => E.publicGuidance.response.parse(clone(RESPONSES.guidance)),
  guidanceArticle: () => E.publicGuidanceArticle.response.parse(clone(RESPONSES.guidanceArticle)),
  publications: () => E.listPublications.response.parse(clone(RESPONSES.publications)),
  tenders: () => listTenders.response.parse(clone(RESPONSES.tenders)),
  overview2: () => E.publicationOverview.response.parse(clone(RESPONSES.overview2)),
  overview13: () => E.publicationOverview.response.parse(clone(RESPONSES.overview13)),
  summary2: () => E.participantSummary.response.parse(clone(RESPONSES.summary2)),
  participants2: () => E.listParticipants.response.parse(clone(RESPONSES.participants2)),
  participant605: () => E.getParticipant.response.parse(clone(RESPONSES.participant605)),
  candidates2: () => E.invitationCandidates.response.parse(clone(RESPONSES.candidates2)),
  opportunities: () => E.listOpportunities.response.parse(clone(RESPONSES.opportunities)),
  opportunityFilters: () =>
    E.opportunityFilters.response.parse(clone(RESPONSES.opportunityFilters)),
  watchlist: () => E.listWatchlist.response.parse(clone(RESPONSES.watchlist)),
  savedSearches: () => E.listSavedSearches.response.parse(clone(RESPONSES.savedSearches)),
  subscriptions: () => E.listSubscriptions.response.parse(clone(RESPONSES.subscriptions)),
  invitations: () => E.listInvitations.response.parse(clone(RESPONSES.invitations)),
  invitation206: () => E.getInvitation.response.parse(clone(RESPONSES.invitation206)),
  workspace6: () => E.opportunityWorkspace.response.parse(clone(RESPONSES.workspace6)),
  workspace11: () => E.opportunityWorkspace.response.parse(clone(RESPONSES.workspace11)),
  pursuit6: () => E.getPursuit.response.parse(clone(RESPONSES.pursuit6)),
  pursuits: () => E.listPursuits.response.parse(clone(RESPONSES.pursuits)),
  teamCandidates: () => E.pursuitTeamCandidates.response.parse(clone(RESPONSES.teamCandidates)),
};

export function pageOf<T>(items: readonly T[]) {
  return { items: [...items], total: items.length, page: 1, pageSize: 25 };
}

export const BUYER_ALL: readonly PermissionCode[] = [
  'tender.view',
  'tender.publish',
  'tender.participants.manage',
];
export const SUPPLIER_ALL: readonly PermissionCode[] = [
  'supplier.opportunities.view',
  'supplier.pursuit.manage',
  'supplier.response.edit',
  'supplier.notices.acknowledge',
];

export function buyerState(permissions: readonly PermissionCode[] = BUYER_ALL) {
  return stateWith(signedInSession({ activeTenant: makeTenant({}, permissions) }));
}

export function supplierState(permissions: readonly PermissionCode[] = SUPPLIER_ALL) {
  return stateWith(
    signedInSession({
      authUserEmail: 'tsodilo.bidmanager@tenderiq.local',
      memberships: [
        makeMembership({
          tenantId: 4,
          tenantKind: 'supplier',
          tenantName: 'Tsodilo Engineering',
          tenantSlug: 'tsodilo',
          capacity: 'Bid Manager',
        }),
      ],
      activeTenant: makeTenant(
        {
          tenantId: 4,
          kind: 'supplier',
          name: 'Tsodilo Engineering',
          slug: 'tsodilo',
          capacity: 'Bid Manager',
        },
        permissions,
      ),
    }),
  );
}

/** Installs the routes, answering JSON bodies. */
export function routes(table: Record<string, MockHandler | object>) {
  const handlers: Record<string, MockHandler> = {};
  for (const [key, value] of Object.entries(table)) {
    handlers[key] = typeof value === 'function' ? (value as MockHandler) : () => ({ body: value });
  }
  return installFetch(handlers);
}
