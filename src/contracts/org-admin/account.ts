/**
 * Org-admin contract, account part: invitation acceptance (COM-01), organization and capacity selection beyond the
 * shell picker (COM-02) and the personal profile (COM-03). DD-21, DD-27, BR-02, FR-03.
 *
 * - `GET /public/invitations/:token` lets the invitation page explain an invitation before sign-in without exposing
 *   anything but the inviting organization, capacity, inviter and a masked e-mail.
 * - `POST /me/invitations/:token/accept` is the one route open to a user in status `invited` (DD-27). It activates
 *   the membership, and the user when needed.
 * - `/me/memberships` lists every membership of the caller (active, invited, pending approval, suspended, revoked),
 *   so COM-02 can explain a pending or suspended one without exposing the other organization.
 * - `/me/profile` holds name, language and display time zone. E-mail and phone changes need confirmation and are
 *   requested as contact changes (FR-03). Notification preferences are the notifications contract.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { CONTACT_CHANGE_STATUSES } from '../enums.js';

export { CONTACT_CHANGE_STATUSES };

import {
  Id,
  IdParam,
  Instant,
  OrganizationLabel,
  PersonRef,
  ReasonText,
  Slug,
  TenantKind,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { InvitationsStatus, MembershipsStatus, TenantsKind, UsersStatus } from '../enums.js';
import { PermissionCodeSchema } from '../permissions.js';
import { AccessItemStatus, AccessScope, InvitationToken, RoleAssignmentRow } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// COM-01 invitations
// ---------------------------------------------------------------------------------------------------------

export const InvitationTokenParams = z.object({ token: InvitationToken });

/** What the invitation page may show before sign-in (no personal data beyond a masked e-mail). */
export const InvitationPreview = z.object({
  organizationName: z.string().min(1),
  organizationKind: TenantKind,
  /** `memberships.title` the invitee will act in. */
  capacity: z.string().nullable(),
  roleNames: z.array(z.string().min(1)),
  invitedBy: z.string().min(1),
  /** `n***@kwu.co.bw`. */
  emailMasked: z.string().min(3),
  /** Stored status; `pending` past `expiresAt` is reported as `expired` (request-time check, DD-18). */
  status: InvitationsStatus,
  expiresAt: Instant,
  officialTimeZone: TimeZone,
});
export type InvitationPreview = z.infer<typeof InvitationPreview>;

export const previewInvitation = defineEndpoint({
  id: 'public.invitations.preview',
  method: 'GET',
  path: '/api/v1/public/invitations/:token',
  audience: 'public',
  params: InvitationTokenParams,
  response: InvitationPreview,
  errors: [],
  screens: ['COM-01'],
  summary: 'The inviting organization, capacity, inviter and state of an invitation link. Unknown tokens are 404.',
});

export const AcceptInvitationBody = z.object({
  /** COM-02: the invitee confirms the organization and capacity they will act in. */
  confirmCapacity: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the organization and capacity.') }),
});
export type AcceptInvitationBody = z.infer<typeof AcceptInvitationBody>;

/** One membership of the caller, labelled with its organization (COM-02). */
export const MyMembership = z.object({
  membershipId: Id,
  organization: OrganizationLabel,
  organizationSlug: Slug,
  capacity: z.string().nullable(),
  status: MembershipsStatus,
  roleNames: z.array(z.string().min(1)),
  joinedAt: Instant.nullable(),
  /** Invitation or membership request time for `invited` / `pending_approval`. */
  requestedAt: Instant.nullable(),
  endedAt: Instant.nullable(),
  /** Why the membership cannot be used, in terms that never expose another organization's data. */
  explanation: z.string().nullable(),
  canWithdraw: z.boolean(),
  canLeave: z.boolean(),
});
export type MyMembership = z.infer<typeof MyMembership>;

export const AcceptInvitationResult = z.object({
  invitationId: Id,
  membership: MyMembership,
  userActivated: z.boolean(),
});
export type AcceptInvitationResult = z.infer<typeof AcceptInvitationResult>;

export const acceptInvitation = defineEndpoint({
  id: 'me.invitations.accept',
  method: 'POST',
  path: '/api/v1/me/invitations/:token/accept',
  audience: 'me',
  params: InvitationTokenParams,
  body: AcceptInvitationBody,
  response: AcceptInvitationResult,
  errors: [
    'INVITATION_EXPIRED',
    'INVITATION_REVOKED',
    'INVITATION_ALREADY_ACCEPTED',
    'INVITATION_SUPERSEDED',
    'INVITATION_EMAIL_MISMATCH',
  ],
  screens: ['COM-01'],
  summary:
    'Accepts an invitation addressed to the caller: activates the membership (and the user when invited, DD-27).',
});

// ---------------------------------------------------------------------------------------------------------
// COM-02 memberships
// ---------------------------------------------------------------------------------------------------------

export const MY_MEMBERSHIP_SORTS = ['organization', 'status', 'joinedAt'] as const;

export const MyMembershipListQuery = listQueryWithSort(MY_MEMBERSHIP_SORTS).extend({
  status: queryList(MembershipsStatus).optional(),
  kind: queryList(TenantsKind).optional(),
});

export const MyMembershipSummary = z.object({
  active: z.number().int().min(0),
  pending: z.number().int().min(0),
  suspendedOrEnded: z.number().int().min(0),
  /** True when the caller belongs to at least one buyer AND one supplier: conflicts are routed for review (AC-02). */
  holdsBuyerAndSupplierMemberships: z.boolean(),
});

export const MyMembershipPage = pageOf(MyMembership).extend({ summary: MyMembershipSummary });
export type MyMembershipPage = z.infer<typeof MyMembershipPage>;

export const listMyMemberships = defineEndpoint({
  id: 'me.memberships.list',
  method: 'GET',
  path: '/api/v1/me/memberships',
  audience: 'me',
  query: MyMembershipListQuery,
  response: MyMembershipPage,
  errors: [],
  screens: ['COM-02', 'COM-03'],
  summary: 'Every membership of the caller with capacity, status and an explanation for unusable ones.',
});

export const MembershipParams = z.object({ membershipId: IdParam });

export const withdrawMembershipRequest = defineEndpoint({
  id: 'me.memberships.withdrawRequest',
  method: 'POST',
  path: '/api/v1/me/memberships/:membershipId/withdraw-request',
  audience: 'me',
  params: MembershipParams,
  body: z.object({ reason: ReasonText.optional() }),
  response: MyMembership,
  errors: ['MEMBERSHIP_NOT_PENDING'],
  screens: ['COM-02'],
  summary: 'Withdraws the caller’s own pending membership request or declines an invitation.',
});

export const LeaveMembershipBody = z.object({
  reason: ReasonText,
  confirmHistoryRetained: z.literal(true, {
    error: issue('CONFIRMATION_REQUIRED', 'Confirm that your past actions stay attributed to you.'),
  }),
});

export const leaveMembership = defineEndpoint({
  id: 'me.memberships.leave',
  method: 'POST',
  path: '/api/v1/me/memberships/:membershipId/leave',
  audience: 'me',
  params: MembershipParams,
  body: LeaveMembershipBody,
  response: MyMembership,
  errors: ['MEMBERSHIP_NOT_ACTIVE', 'LAST_ADMINISTRATOR', 'OPEN_WORK_EXISTS'],
  screens: ['COM-02', 'COM-03'],
  summary:
    'Ends the caller’s own membership. Refused for the last administrator or while formal work is still assigned (BR-38).',
});

// ---------------------------------------------------------------------------------------------------------
// COM-03 profile
// ---------------------------------------------------------------------------------------------------------

/** Contact details that need confirmation before they change (FR-03). */
export const CONTACT_CHANGE_FIELDS = ['email', 'phone'] as const;
export const ContactChangeField = z.enum(CONTACT_CHANGE_FIELDS);
export type ContactChangeField = z.infer<typeof ContactChangeField>;

export const ContactChangeStatus = z.enum(CONTACT_CHANGE_STATUSES);
export type ContactChangeStatus = z.infer<typeof ContactChangeStatus>;

export const ContactChange = z.object({
  changeId: Id,
  field: ContactChangeField,
  /** Masked new value (`t***@example.com`, `+267 7• ••• 321`). */
  newValueMasked: z.string().min(3),
  status: ContactChangeStatus,
  requestedAt: Instant,
  expiresAt: Instant,
  /** Where the confirmation link or code was sent (masked). */
  confirmationSentTo: z.string().min(3),
});
export type ContactChange = z.infer<typeof ContactChange>;

/** Locales offered in this release (English only, DD-37). */
export const SUPPORTED_LOCALES = ['en-BW', 'en-GB', 'en-ZA', 'en-US'] as const;
export const SupportedLocale = z.enum(SUPPORTED_LOCALES, {
  error: issue('UNSUPPORTED_LOCALE', 'Choose one of the offered languages.'),
});

export const MyProfile = z.object({
  userId: Id,
  email: z.email(),
  fullName: z.string().min(1),
  phone: z.string().nullable(),
  locale: z.string().min(2),
  displayTimeZone: TimeZone.nullable(),
  status: UsersStatus,
  lastSeenAt: Instant.nullable(),
  pendingContactChanges: z.array(ContactChange),
  /** Official time zones of the caller's active organizations (deadlines always show these, DD-33). */
  officialTimeZones: z.array(z.object({ organization: OrganizationLabel, timeZone: TimeZone })),
});
export type MyProfile = z.infer<typeof MyProfile>;

export const getMyProfile = defineEndpoint({
  id: 'me.profile.get',
  method: 'GET',
  path: '/api/v1/me/profile',
  audience: 'me',
  response: MyProfile,
  errors: [],
  screens: ['COM-03'],
});

export const UpdateMyProfileBody = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, issue('NAME_REQUIRED', 'Enter your full name.'))
    .max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.')),
  locale: SupportedLocale,
  displayTimeZone: TimeZone.nullable(),
});
export type UpdateMyProfileBody = z.infer<typeof UpdateMyProfileBody>;

export const updateMyProfile = defineEndpoint({
  id: 'me.profile.update',
  method: 'PUT',
  path: '/api/v1/me/profile',
  audience: 'me',
  body: UpdateMyProfileBody,
  response: MyProfile,
  errors: [],
  screens: ['COM-03'],
  summary: 'Updates name, language and personal display time zone. Official deadlines keep their official zone.',
});

export const RequestContactChangeBody = z
  .object({
    field: ContactChangeField,
    newValue: z.string().trim().min(3, issue('CONTACT_REQUIRED', 'Enter the new contact detail.')).max(254),
  })
  .superRefine((value, context) => {
    if (value.field === 'email' && !z.email().safeParse(value.newValue).success) {
      context.addIssue({ code: 'custom', path: ['newValue'], message: issue('INVALID_EMAIL', 'Enter a valid e-mail address.') });
    }
    if (value.field === 'phone' && !/^\+?[0-9 ()-]{7,20}$/.test(value.newValue)) {
      context.addIssue({
        code: 'custom',
        path: ['newValue'],
        message: issue('INVALID_PHONE', 'Enter a phone number with its country code, such as +267 71 234 567.'),
      });
    }
  });
export type RequestContactChangeBody = z.infer<typeof RequestContactChangeBody>;

export const requestContactChange = defineEndpoint({
  id: 'me.profile.requestContactChange',
  method: 'POST',
  path: '/api/v1/me/profile/contact-changes',
  audience: 'me',
  body: RequestContactChangeBody,
  response: ContactChange,
  idempotent: true,
  errors: ['CONTACT_CHANGE_PENDING', 'SAME_AS_CURRENT', 'EMAIL_IN_USE'],
  screens: ['COM-03'],
  summary: 'Starts a confirmed e-mail or phone change; nothing changes until the confirmation succeeds (FR-03).',
});

export const ContactChangeParams = z.object({ changeId: IdParam });

export const cancelContactChange = defineEndpoint({
  id: 'me.profile.cancelContactChange',
  method: 'POST',
  path: '/api/v1/me/profile/contact-changes/:changeId/cancel',
  audience: 'me',
  params: ContactChangeParams,
  response: ContactChange,
  errors: ['CONTACT_CHANGE_NOT_PENDING'],
  screens: ['COM-03'],
});

/** One direct grant, restriction or delegation of the caller, as shown on the profile. */
export const MyAccessItem = z.object({
  id: Id,
  description: z.string().min(1),
  permissionCode: PermissionCodeSchema.nullable(),
  scope: AccessScope.nullable(),
  startsAt: Instant,
  endsAt: Instant.nullable(),
  status: AccessItemStatus,
  counterpart: PersonRef.nullable(),
});
export type MyAccessItem = z.infer<typeof MyAccessItem>;

/** The caller's personal access in one active organization (COM-03 "personal access settings"). */
export const MyAccessInOrganization = z.object({
  organization: OrganizationLabel,
  capacity: z.string().nullable(),
  roles: z.array(RoleAssignmentRow),
  directGrants: z.array(MyAccessItem),
  restrictions: z.array(MyAccessItem),
  delegationsGiven: z.array(MyAccessItem),
  delegationsReceived: z.array(MyAccessItem),
});
export type MyAccessInOrganization = z.infer<typeof MyAccessInOrganization>;

export const MyAccessSummary = z.object({ organizations: z.array(MyAccessInOrganization) });
export type MyAccessSummary = z.infer<typeof MyAccessSummary>;

export const getMyAccessSummary = defineEndpoint({
  id: 'me.profile.access',
  method: 'GET',
  path: '/api/v1/me/access-summary',
  audience: 'me',
  response: MyAccessSummary,
  errors: [],
  screens: ['COM-03'],
  summary: 'Roles, direct grants, restrictions and delegations of the caller in every active organization.',
});
