/**
 * SUP-02 public registration endpoints and the requester's `/me` membership requests.
 *
 * - The duplicate check answers only "an organization with similar details exists" plus an opaque token; it never
 *   names or describes the other organization (SUP-02, BR-44).
 * - Registration returns separate statuses (pending organization, invited user, unverified contact, not assessed for
 *   qualification: AC-07) and never collects banking details (FR-02).
 * - Membership requests made with a token do not reveal the organization until it approves the request.
 * - A buyer-created provisional organization is claimed through its invitation link (`/register/claim/:token`): the
 *   claim page names the organization and the inviting buyer, masks the invited address, and claiming still leads
 *   through contact verification; the result is registered, not qualified (FR-02, DD-17, AC-07).
 */
import type { ClaimInvitationState, MyMembershipRequest } from '../../../contracts/suppliers.js';
import { BANKING_NOT_COLLECTED_NOTICE, suppliersEndpoints as api } from '../../../contracts/suppliers.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { PERSONAS } from '../../fixtures/platform.js';
import {
  CATEGORY_CATALOG,
  EXTERNAL_PEOPLE,
  REFERENCE_OPTIONS,
  findClaimInvitation,
  findExternalPerson,
  MEMBERSHIP_REQUESTS,
  SUPPLIER_ORGS,
  findCategory,
  findSupplierOrg,
  matchTokenOf,
  tenantOfMatchToken,
} from '../../fixtures/suppliers/index.js';
import type { FixtureClaimInvitation, FixtureMembershipRequest } from '../../fixtures/suppliers/index.js';
import { categoriesOf, instantOf, normalizeName, orgLabel, sortBy } from './shared.js';

/** The invitation state at `now`: a pending invitation past its expiry is expired. */
export function claimStateAt(invitation: FixtureClaimInvitation, now: Date): ClaimInvitationState {
  return invitation.state === 'pending' && Date.parse(invitation.expiresAt) < now.getTime() ? 'expired' : invitation.state;
}

/** `onkemetse.dube@kasane-drilling.example` → `o•••@kasane-drilling.example` (the domain stays readable). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at <= 0 ? '•••' : `${email.slice(0, 1)}•••${email.slice(at)}`;
}

const CLAIM_STATE_NOTES: Readonly<Record<Exclude<ClaimInvitationState, 'pending'>, string>> = {
  expired: 'This invitation has expired. Ask the buyer that invited you to send a new one, or register your organization yourself.',
  claimed: 'This organization has already been claimed. Sign in, or ask its administrator for access.',
  revoked: 'The buyer withdrew this invitation. Register your organization yourself if you still want to take part.',
};

/** The organization a registration resembles (same registration number or same normalized name), if any. */
export function findPossibleDuplicate(legalName: string, registrationNumber: string | undefined): number | undefined {
  const wanted = normalizeName(legalName);
  const match = SUPPLIER_ORGS.find((org) => {
    if (org.isProvisional || (org.status !== 'active' && org.status !== 'pending') || matchTokenOf(org.tenantId) === undefined) {
      return false;
    }
    if (registrationNumber !== undefined && registrationNumber !== '' && org.registrationNumber === registrationNumber) {
      return true;
    }
    const names = [org.legalName, ...(org.tradingName === null ? [] : [org.tradingName]), ...org.profile.tradingNames, ...org.legalNames.map((entry) => entry.legalName)];
    return names.some((name) => normalizeName(name) === wanted);
  });
  return match?.tenantId;
}

function isKnownEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return PERSONAS.some((persona) => persona.email.toLowerCase() === lower) || EXTERNAL_PEOPLE.some((person) => person.email.toLowerCase() === lower);
}

const DUPLICATE_MESSAGE =
  'An organization with similar details already exists on TenderIQ. You can request membership in it, or continue registering if your organization is a different legal entity.';

function myRequestView(row: FixtureMembershipRequest): MyMembershipRequest {
  const org = findSupplierOrg(row.tenantId);
  return {
    id: row.id,
    organizationName: row.status === 'approved' && org !== undefined ? (org.tradingName ?? org.legalName) : null,
    status: row.status,
    message: row.message,
    decisionNote: row.decisionNote,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

export function registerPublic(app: MockApp): void {
  mockRoute(app, api.categoryOptions, () => ({ items: CATEGORY_CATALOG.map((category) => ({ ...category })) }));

  mockRoute(app, api.duplicateCheck, ({ body }) => {
    const tenantId = findPossibleDuplicate(body.legalName, body.registrationNumber);
    const token = tenantId === undefined ? undefined : matchTokenOf(tenantId);
    return token === undefined
      ? { outcome: 'no_match', matchToken: null, message: 'No organization with similar details was found. You can continue registering.' }
      : { outcome: 'possible_duplicate', matchToken: token, message: DUPLICATE_MESSAGE };
  });

  mockRoute(app, api.register, ({ body, now, fail }) => {
    if (isKnownEmail(body.contact.email)) {
      return fail(409, 'EMAIL_ALREADY_REGISTERED', 'An account already uses this e-mail address. Sign in, or use a different address.');
    }
    const unknown = body.categories.filter((code) => findCategory(code) === undefined);
    if (unknown.length > 0) {
      return fail(422, 'CATEGORY_UNKNOWN', `Unknown categories: ${unknown.join(', ')}.`);
    }
    const duplicateOf = findPossibleDuplicate(body.legalName, body.registrationNumber);
    const token = duplicateOf === undefined ? undefined : matchTokenOf(duplicateOf);
    if (token !== undefined && body.continueDespiteMatchToken !== token) {
      return fail(409, 'POSSIBLE_DUPLICATE_UNACKNOWLEDGED', DUPLICATE_MESSAGE);
    }
    return {
      registrationId: 900,
      legalName: body.legalName,
      organizationStatus: 'pending',
      verificationStatus: 'unverified',
      userStatus: 'invited',
      membershipStatus: 'invited',
      verificationEmailStatus: 'pending',
      qualificationStatus: 'not_assessed',
      duplicateReviewRaised: token !== undefined,
      bankingCollected: false,
      nextSteps: [
        `Open the verification e-mail sent to ${body.contact.email} and set your password.`,
        'Complete the organization profile and add evidence to your library.',
        'Identity verification and any buyer qualification are separate reviews; registration alone does not qualify you.',
      ],
      submittedAt: instantOf(now),
    };
  });

  mockRoute(app, api.resendVerification, () => ({
    status: 'accepted',
    message: 'If a registration is waiting for verification at this address, a new verification e-mail is on its way.',
  }));

  mockRoute(app, api.requestMembershipPublic, ({ body, now, fail }) => {
    if (tenantOfMatchToken(body.matchToken) === undefined) {
      return fail(422, 'MATCH_TOKEN_INVALID', 'This match is no longer valid. Run the check again.');
    }
    if (isKnownEmail(body.email)) {
      return fail(409, 'EMAIL_ALREADY_REGISTERED', 'An account already uses this e-mail address. Sign in and request membership from your account.');
    }
    return {
      status: 'pending',
      message: 'Your request was sent to the organization administrator. You will receive an e-mail when it is decided.',
      submittedAt: instantOf(now),
    };
  });

  mockRoute(app, api.referenceOptions, () => ({
    countries: REFERENCE_OPTIONS.countries.map((option) => ({ ...option })),
    currencies: REFERENCE_OPTIONS.currencies.map((option) => ({ ...option })),
    defaultCountry: REFERENCE_OPTIONS.defaultCountry,
  }));

  mockRoute(app, api.getClaimInvitation, ({ params, now, notFound }) => {
    const invitation = findClaimInvitation(params.token);
    const org = invitation === undefined ? undefined : findSupplierOrg(invitation.supplierTenantId);
    const contact = invitation === undefined ? undefined : findExternalPerson(invitation.contactUserId);
    if (invitation === undefined || org === undefined || contact === undefined) {
      return notFound();
    }
    const state = claimStateAt(invitation, now);
    return {
      state,
      organization: {
        legalName: org.legalName,
        country: org.country,
        registrationNumber: org.registrationNumber,
        categories: categoriesOf(org.categories),
      },
      invitedBy: orgLabel(invitation.buyerTenantId),
      contactName: contact.fullName,
      emailHint: maskEmail(contact.email),
      expiresAt: invitation.expiresAt,
      stateNote: state === 'pending' ? null : CLAIM_STATE_NOTES[state],
      qualificationStatus: 'not_assessed',
      bankingNotice: BANKING_NOT_COLLECTED_NOTICE,
    };
  });

  mockRoute(app, api.claimOrganization, ({ params, body, now, notFound, fail }) => {
    const invitation = findClaimInvitation(params.token);
    const org = invitation === undefined ? undefined : findSupplierOrg(invitation.supplierTenantId);
    const contact = invitation === undefined ? undefined : findExternalPerson(invitation.contactUserId);
    if (invitation === undefined || org === undefined || contact === undefined) {
      return notFound();
    }
    const state = claimStateAt(invitation, now);
    if (state === 'expired') {
      return fail(410, 'INVITATION_EXPIRED', CLAIM_STATE_NOTES.expired);
    }
    if (state === 'claimed') {
      return fail(409, 'INVITATION_ALREADY_CLAIMED', CLAIM_STATE_NOTES.claimed);
    }
    if (state === 'revoked') {
      return fail(410, 'INVITATION_REVOKED', CLAIM_STATE_NOTES.revoked);
    }
    if (body.email.toLowerCase() !== contact.email.toLowerCase()) {
      return fail(422, 'CLAIM_EMAIL_MISMATCH', 'Use the e-mail address the invitation was sent to. The verification e-mail goes only there.');
    }
    const unknown = body.categories.filter((code) => findCategory(code) === undefined);
    if (unknown.length > 0) {
      return fail(422, 'CATEGORY_UNKNOWN', `Unknown categories: ${unknown.join(', ')}.`);
    }
    return {
      registrationId: org.tenantId,
      legalName: org.legalName,
      organizationStatus: 'pending',
      verificationStatus: 'unverified',
      userStatus: 'invited',
      membershipStatus: 'invited',
      verificationEmailStatus: 'pending',
      qualificationStatus: 'not_assessed',
      duplicateReviewRaised: false,
      bankingCollected: false,
      nextSteps: [
        `Open the verification e-mail sent to ${maskEmail(contact.email)} and set your password.`,
        `The record ${orgLabel(invitation.buyerTenantId).tenantName} created becomes your organization; complete the profile and add evidence to your library.`,
        'Identity verification and any buyer qualification are separate reviews; claiming the organization does not qualify it.',
      ],
      submittedAt: instantOf(now),
    };
  });

  // /me: the requester's own membership requests (DD-21 scope: the caller's own rows only).
  mockRoute(app, api.myMembershipRequests, ({ requirePersona, query, fixtures }) => {
    const persona = requirePersona();
    const rows = MEMBERSHIP_REQUESTS.filter((row) => row.userId === persona.userId).filter(
      (row) => query.status === undefined || query.status.includes(row.status),
    );
    const sorted = sortBy(rows, (row) => (query.sort === 'status' ? row.status : row.createdAt), query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted.map(myRequestView));
  });

  mockRoute(app, api.createMyMembershipRequest, ({ requirePersona, body, now, fail }) => {
    const persona = requirePersona();
    const tenantId = tenantOfMatchToken(body.matchToken);
    if (tenantId === undefined) {
      return fail(422, 'MATCH_TOKEN_INVALID', 'This match is no longer valid. Run the check again.');
    }
    const membership = persona.memberships.find((candidate) => candidate.tenantId === tenantId);
    if (membership?.status === 'active') {
      return fail(409, 'ALREADY_MEMBER', 'You are already a member of this organization.');
    }
    if (
      membership?.status === 'pending_approval' ||
      MEMBERSHIP_REQUESTS.some((row) => row.userId === persona.userId && row.tenantId === tenantId && row.status === 'pending')
    ) {
      return fail(409, 'MEMBERSHIP_REQUEST_PENDING', 'You already have a pending request for this organization.');
    }
    return {
      id: 900,
      organizationName: null,
      status: 'pending',
      message: body.message,
      decisionNote: null,
      decidedAt: null,
      createdAt: instantOf(now),
    };
  });

  mockRoute(app, api.withdrawMyMembershipRequest, ({ requirePersona, params, notFound, fail }) => {
    const persona = requirePersona();
    const row = MEMBERSHIP_REQUESTS.find((candidate) => candidate.id === params.requestId && candidate.userId === persona.userId);
    if (row === undefined) {
      return notFound();
    }
    if (row.status !== 'pending') {
      return fail(409, 'MEMBERSHIP_REQUEST_NOT_PENDING', 'Only a pending request can be withdrawn.');
    }
    return { ...myRequestView(row), status: 'withdrawn' };
  });
}
