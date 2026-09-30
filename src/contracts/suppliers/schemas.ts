/**
 * Suppliers contract schemas: registration, organization profile, legal-identity changes, the evidence library,
 * the buyer directory and relationship record, and the operator duplicate / identity reviews
 * (PRD §5.2 FR-02, BR-03, BR-44, BR-45; SUP-02, SUP-03, SUP-05, BUY-31, BUY-32; blueprint Migration 05).
 *
 * Field names mirror the blueprint columns in camelCase (`supplier_profiles`, `supplier_locations`,
 * `supplier_categories`, `supplier_membership_requests`, `supplier_identity_changes`, `supplier_legal_names`,
 * `duplicate_candidates`, `supplier_merges`, `buyer_supplier_relationships`, `relationship_contacts`,
 * `evidence_items`, `evidence_shares`, `evidence_submissions`, and the `tenants` identity columns).
 *
 * Binding rules the schemas encode:
 * - Registration, contact verification, membership approval, identity verification and qualification are separate
 *   statuses (FR-02, BR-03, AC-07): `RegistrationStatuses` never collapses them.
 * - A possible duplicate discloses nothing but its existence and an opaque match token (SUP-02).
 * - Buyer responses are built only from the buyer's own relationship, contacts and qualification decisions, and from
 *   evidence the supplier shared with THAT buyer (BR-45, DD-03). Supplier responses never contain [R] data.
 * - Financial evidence is visible only to `supplier.financial.view` on the supplier side and to
 *   `qualification.financial_review` on the buyer side (PRD §4.3); otherwise rows are redacted (`restricted`).
 * - Banking details are never collected here (FR-02): `bankingCollected` is always false with an explanation.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { CLAIM_INVITATION_STATES, EVIDENCE_FRESHNESS, VERIFICATION_REQUEST_STATUSES } from '../enums.js';

export { CLAIM_INVITATION_STATES, EVIDENCE_FRESHNESS, VERIFICATION_REQUEST_STATUSES };

import {
  CalendarDate,
  CurrencyCode,
  Id,
  Instant,
  NonNegativeMoney,
  OrganizationLabel,
  PersonRef,
  ReasonText,
  Reference,
  Slug,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
  QueryBoolean,
} from '../common.js';
import {
  BuyerSupplierRelationshipsRiskRating,
  BuyerSupplierRelationshipsStatus,
  ContractsStatus,
  DuplicateCandidatesDetectedReason,
  DuplicateCandidatesStatus,
  EvidenceItemsEvidenceType,
  EvidenceItemsSensitivity,
  EvidenceItemsStatus,
  EvidenceItemsVerificationStatus,
  EvidenceSubmissionsContextType,
  InvitationsStatus,
  MembershipsStatus,
  PerformanceReviewsOverallRating,
  PerformanceReviewsStatus,
  SupplierIdentityChangesChangeType,
  SupplierIdentityChangesStatus,
  SupplierMembershipRequestsStatus,
  TenantsStatus,
  TenantsVerificationStatus,
  UsersStatus,
  VQualificationStatusEffectiveStatus,
} from '../enums.js';

// ---------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------

/** Evidence expiring within this many days is `expiring_soon` (reminder window; BR-25, AC-09). */
export const EVIDENCE_EXPIRY_WARNING_DAYS = 60;

/** The explanation shown wherever banking details might be expected (FR-02, PRD §18.1). */
export const BANKING_NOT_COLLECTED_NOTICE =
  'TenderIQ does not collect banking details for registration or tender participation. A buyer requests them separately, only for an authorized payment purpose after award.';

/**
 * Derived freshness of an evidence edition at request time: `expired` after `expiresAt`, `expiring_soon` within
 * `EVIDENCE_EXPIRY_WARNING_DAYS`, `no_expiry` without an expiry date, else `current`. A contract-defined value
 * (no blueprint column); reported for enums.ts as `evidence_items.freshness`.
 */
export const EvidenceFreshness = z.enum(EVIDENCE_FRESHNESS);
export type EvidenceFreshness = z.infer<typeof EvidenceFreshness>;

// ---------------------------------------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------------------------------------

const Text = (max: number, code = 'TEXT_TOO_LONG') =>
  z
    .string()
    .trim()
    .max(max, issue(code, `At most ${max} characters.`));

const RequiredText = (max: number, requiredCode: string, requiredMessage: string) =>
  z
    .string({ error: issue(requiredCode, requiredMessage) })
    .trim()
    .min(1, issue(requiredCode, requiredMessage))
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));

/** ISO 3166-1 alpha-2 country code (`tenants.country char(2)`). */
export const CountryCode = z
  .string({ error: issue('INVALID_COUNTRY', 'Use a two-letter country code such as BW.') })
  .regex(/^[A-Z]{2}$/, issue('INVALID_COUNTRY', 'Use a two-letter country code such as BW.'));

/** `category_catalog.code`, for example `WTR-PUMP`. */
export const CatalogCode = z
  .string({ error: issue('INVALID_CATEGORY', 'Choose a category.') })
  .regex(/^[A-Z]{2,6}(-[A-Z0-9]{2,8})*$/, issue('INVALID_CATEGORY', 'Not a category code.'));

/** An e-mail address. */
export const Email = z
  .string({ error: issue('EMAIL_REQUIRED', 'An e-mail address is required.') })
  .trim()
  .toLowerCase()
  .pipe(z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.')));

/** A phone number in a lenient international format. */
export const Phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,24}$/, issue('INVALID_PHONE', 'Enter a phone number such as +267 390 1234.'));

/** A working-language tag such as `en` or `tn` (`tenants.working_languages`, `supplier_profiles.preferred_languages`). */
export const LanguageTag = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, issue('INVALID_LANGUAGE', 'Use a language code such as en.'));

/** Opaque token naming a possible duplicate organization without disclosing it (SUP-02). */
export const MatchToken = z
  .string({ error: issue('MATCH_TOKEN_REQUIRED', 'Run the duplicate check first.') })
  .regex(/^dup_[A-Za-z0-9]{8,64}$/, issue('MATCH_TOKEN_INVALID', 'This match is no longer valid. Run the check again.'));

/** A catalog category (`category_catalog`). */
export const CategoryOption = z.object({
  code: CatalogCode,
  name: z.string().min(1),
  parentCode: CatalogCode.nullable(),
  description: z.string().nullable(),
});
export type CategoryOption = z.infer<typeof CategoryOption>;

/** One entry of a reference list (a country or a currency) with its display name. */
export const ReferenceOption = z.object({ code: z.string().min(1), name: z.string().min(1) });
export type ReferenceOption = z.infer<typeof ReferenceOption>;

/**
 * Reference lists for the supplier forms (SUP-02, SUP-03, SUP-05, BUY-31). Stage B serves them from platform
 * configuration: the countries the platform operates in (`tenants.country`), the ISO 4217 currencies accepted for
 * evidence (`evidence_items.coverage_currency`, `reporting_currency`) and the deployment's default country. UI code
 * never hard-codes them.
 */
export const ReferenceOptions = z.object({
  countries: z.array(ReferenceOption).min(1),
  currencies: z.array(ReferenceOption).min(1),
  defaultCountry: CountryCode,
});
export type ReferenceOptions = z.infer<typeof ReferenceOptions>;

/** A category attached to a supplier (`supplier_categories` joined to `category_catalog`). */
export const SupplierCategory = z.object({
  catalogCode: CatalogCode,
  name: z.string().min(1),
  parentCode: CatalogCode.nullable(),
});
export type SupplierCategory = z.infer<typeof SupplierCategory>;

/** A supplier location (`supplier_locations`). */
export const SupplierLocation = z.object({
  id: Id,
  name: z.string().min(1),
  address: z.string().min(1),
  region: z.string().nullable(),
  country: CountryCode,
  isRegisteredOffice: z.boolean(),
});
export type SupplierLocation = z.infer<typeof SupplierLocation>;

/** A location in a write body (no id: the set replaces the current locations). */
export const SupplierLocationInput = z.object({
  name: RequiredText(200, 'LOCATION_NAME_REQUIRED', 'Name the location.'),
  address: RequiredText(500, 'LOCATION_ADDRESS_REQUIRED', 'Enter the address.'),
  region: Text(120).optional(),
  country: CountryCode,
  isRegisteredOffice: z.boolean(),
});
export type SupplierLocationInput = z.infer<typeof SupplierLocationInput>;

function oneRegisteredOffice(locations: readonly { isRegisteredOffice: boolean }[]): boolean {
  return locations.filter((location) => location.isRegisteredOffice).length === 1;
}

const LocationsInput = z
  .array(SupplierLocationInput)
  .min(1, issue('REGISTERED_OFFICE_REQUIRED', 'Add the registered office.'))
  .max(20, issue('TOO_MANY_LOCATIONS', 'At most 20 locations.'))
  .refine(oneRegisteredOffice, issue('REGISTERED_OFFICE_REQUIRED', 'Mark exactly one location as the registered office.'));

const CategoriesInput = z
  .array(CatalogCode)
  .min(1, issue('CATEGORY_REQUIRED', 'Choose at least one category.'))
  .max(30, issue('TOO_MANY_CATEGORIES', 'At most 30 categories.'))
  .refine((codes) => new Set(codes).size === codes.length, issue('DUPLICATE_CATEGORY', 'Each category once.'));

const StringList = (max: number, itemMax: number) =>
  z.array(RequiredText(itemMax, 'VALUE_REQUIRED', 'Enter a value.')).max(max, issue('TOO_MANY_VALUES', `At most ${max} values.`));

/** An organization legal name valid over a period (`supplier_legal_names`). */
export const LegalNameEntry = z.object({
  legalName: z.string().min(1),
  validFrom: CalendarDate,
  validTo: CalendarDate.nullable(),
});
export type LegalNameEntry = z.infer<typeof LegalNameEntry>;

/**
 * The separate statuses of a supplier organization (FR-02, BR-03, AC-07). Registration is never qualification:
 * `qualification` is summarized per buyer and says so explicitly.
 */
export const RegistrationStatuses = z.object({
  /** `tenants.status`: pending until the registration is complete, then active. */
  registration: TenantsStatus,
  /** `tenants.verification_status`: unverified → contact_verified → identity_verified. */
  verification: TenantsVerificationStatus,
  /** Whether the organization is a buyer-created provisional record not yet claimed (FR-02). */
  isProvisional: z.boolean(),
  /** Qualification is decided by each buyer, for a scope and period (BR-24); counts only this supplier's own decisions. */
  qualification: z.object({
    qualifiedBuyerCount: z.number().int().min(0),
    pendingApplicationCount: z.number().int().min(0),
    note: z.string().min(1),
  }),
});
export type RegistrationStatuses = z.infer<typeof RegistrationStatuses>;

/** A supplier-visible document reference (the file itself is read through the documents contract). */
export const EvidenceDocumentRef = z.object({
  documentId: Id,
  fileName: z.string().min(1),
  versionNo: z.number().int().min(1),
});
export type EvidenceDocumentRef = z.infer<typeof EvidenceDocumentRef>;

// ---------------------------------------------------------------------------------------------------------
// SUP-02: public registration and membership requests
// ---------------------------------------------------------------------------------------------------------

/** Input of the duplicate check (also embedded in the registration body). */
export const DuplicateCheckBody = z.object({
  legalName: RequiredText(300, 'LEGAL_NAME_REQUIRED', 'Enter the legal name.'),
  registrationJurisdiction: Text(120).optional(),
  registrationNumber: Text(80).optional(),
  country: CountryCode,
  contactEmail: Email,
});
export type DuplicateCheckBody = z.infer<typeof DuplicateCheckBody>;

/**
 * The duplicate check result. It discloses NOTHING about the other organization: only that one with similar details
 * exists, and an opaque token to request membership in it (SUP-02, BR-44).
 */
export const DuplicateCheckResult = z.object({
  outcome: z.enum(['no_match', 'possible_duplicate']),
  matchToken: MatchToken.nullable(),
  message: z.string().min(1),
});
export type DuplicateCheckResult = z.infer<typeof DuplicateCheckResult>;

/** Public supplier registration (FR-02, ADR-0012, DD-27). Banking details are deliberately absent. */
export const RegistrationBody = z.object({
  legalName: RequiredText(300, 'LEGAL_NAME_REQUIRED', 'Enter the legal name.'),
  tradingNames: StringList(10, 300).default([]),
  country: CountryCode,
  registrationJurisdiction: RequiredText(120, 'JURISDICTION_REQUIRED', 'Enter the registration jurisdiction.'),
  registrationNumber: RequiredText(80, 'REGISTRATION_NUMBER_REQUIRED', 'Enter the registration number.'),
  taxIdentifier: Text(80).optional(),
  website: z.url(issue('INVALID_URL', 'Enter a web address such as https://example.co.bw.')).optional(),
  contact: z.object({
    fullName: RequiredText(200, 'CONTACT_NAME_REQUIRED', 'Enter your full name.'),
    email: Email,
    phone: Phone.optional(),
    jobTitle: Text(120).optional(),
  }),
  locations: LocationsInput,
  categories: CategoriesInput,
  serviceAreas: StringList(20, 120).default([]),
  preferredLanguages: z.array(LanguageTag).min(1, issue('LANGUAGE_REQUIRED', 'Choose at least one language.')),
  /** Set when the registrant saw the possible-duplicate notice and chose to continue (SUP-02). */
  continueDespiteMatchToken: MatchToken.optional(),
  acceptTerms: z.literal(true, { error: issue('TERMS_REQUIRED', 'Accept the terms of use to register.') }),
});
export type RegistrationBody = z.infer<typeof RegistrationBody>;
export type RegistrationBodyInput = z.input<typeof RegistrationBody>;

/**
 * Outcome of a registration: every status stays separate (BR-03). Stage B creates the tenant (`pending`), the user
 * (`invited`), the pending membership and the profile in one transaction, then sends the Auth invite (DD-27).
 */
export const RegistrationResult = z.object({
  registrationId: Id,
  legalName: z.string().min(1),
  organizationStatus: TenantsStatus,
  verificationStatus: TenantsVerificationStatus,
  userStatus: UsersStatus,
  membershipStatus: MembershipsStatus,
  /** `invitations.status` of the verification e-mail: `send_failed` offers a retry (DD-27). */
  verificationEmailStatus: InvitationsStatus,
  /** Always `not_assessed`: registration is not qualification (AC-07). */
  qualificationStatus: VQualificationStatusEffectiveStatus,
  /** True when a possible duplicate was recorded for operator review (never merged automatically, BR-44). */
  duplicateReviewRaised: z.boolean(),
  bankingCollected: z.literal(false),
  nextSteps: z.array(z.string().min(1)).min(1),
  submittedAt: Instant,
});
export type RegistrationResult = z.infer<typeof RegistrationResult>;

export const ResendVerificationBody = z.object({ email: Email });
/** Always the same answer whether or not the address is registered (no account discovery, brief §5.7). */
export const ResendVerificationResult = z.object({ status: z.literal('accepted'), message: z.string().min(1) });

/** A public request to join an existing organization found by the duplicate check. */
export const PublicMembershipRequestBody = z.object({
  matchToken: MatchToken,
  fullName: RequiredText(200, 'CONTACT_NAME_REQUIRED', 'Enter your full name.'),
  email: Email,
  phone: Phone.optional(),
  message: RequiredText(2000, 'MESSAGE_REQUIRED', 'Tell the organization administrator who you are and why you need access.'),
});
export type PublicMembershipRequestBody = z.infer<typeof PublicMembershipRequestBody>;

/** A signed-in person's request to join an existing organization. */
export const MeMembershipRequestBody = z.object({
  matchToken: MatchToken,
  message: RequiredText(2000, 'MESSAGE_REQUIRED', 'Tell the organization administrator who you are and why you need access.'),
});
export type MeMembershipRequestBody = z.infer<typeof MeMembershipRequestBody>;

/** Acknowledgement of a public membership request: it names no organization (SUP-02). */
export const PublicMembershipRequestResult = z.object({
  status: SupplierMembershipRequestsStatus,
  message: z.string().min(1),
  submittedAt: Instant,
});

/**
 * State of a claim invitation for a buyer-created provisional organization (FR-02, DD-17). Stage B stores it as an
 * `invitations` row of the provisional tenant (the first administrator's invitation); the link carries only the token,
 * the database only its hash.
 */
export const ClaimInvitationState = z.enum(CLAIM_INVITATION_STATES);
export type ClaimInvitationState = z.infer<typeof ClaimInvitationState>;

/** An opaque claim token (the value of `/register/claim/:token`). */
export const ClaimToken = z
  .string()
  .regex(/^clm_[A-Za-z0-9]{8,64}$/, issue('CLAIM_TOKEN_INVALID', 'This invitation link is not valid. Check the link in the e-mail.'));

/**
 * What the invited contact sees before claiming (SUP-02 "claim an invited organization"). It names the organization
 * the buyer recorded and the inviting buyer, and masks the invited address; it never shows the buyer's internal notes
 * or assessments (BR-45).
 */
export const ClaimInvitationView = z.object({
  state: ClaimInvitationState,
  organization: z.object({
    legalName: z.string().min(1),
    country: CountryCode,
    registrationNumber: z.string().nullable(),
    categories: z.array(SupplierCategory),
  }),
  invitedBy: OrganizationLabel,
  contactName: z.string().min(1),
  /** The invited address with the local part masked (`o•••@kasane-drilling.example`). */
  emailHint: z.string().min(1),
  expiresAt: Instant,
  /** Why the invitation cannot be used (expired, claimed or revoked), else null. */
  stateNote: z.string().nullable(),
  /** Always `not_assessed`: claiming completes registration, it is not qualification (AC-07). */
  qualificationStatus: VQualificationStatusEffectiveStatus,
  bankingNotice: z.string().min(1),
});
export type ClaimInvitationView = z.infer<typeof ClaimInvitationView>;

/** Claiming a provisional organization completes its registration (the same rules as RegistrationBody). */
export const ClaimOrganizationBody = z.object({
  fullName: RequiredText(200, 'CONTACT_NAME_REQUIRED', 'Enter your full name.'),
  /** Must be the invited address: the verification e-mail goes only there. */
  email: Email,
  phone: Phone.optional(),
  jobTitle: Text(120).optional(),
  registrationJurisdiction: RequiredText(120, 'JURISDICTION_REQUIRED', 'Enter the registration jurisdiction.'),
  registrationNumber: RequiredText(80, 'REGISTRATION_NUMBER_REQUIRED', 'Enter the registration number.'),
  locations: LocationsInput,
  categories: CategoriesInput,
  preferredLanguages: z.array(LanguageTag).min(1, issue('LANGUAGE_REQUIRED', 'Choose at least one language.')),
  acceptTerms: z.literal(true, { error: issue('TERMS_REQUIRED', 'Accept the terms of use to register.') }),
});
export type ClaimOrganizationBody = z.infer<typeof ClaimOrganizationBody>;
export type ClaimOrganizationBodyInput = z.input<typeof ClaimOrganizationBody>;

/** The requester's own view of a membership request (`supplier_membership_requests`, COM-02 / SUP-02). */
export const MyMembershipRequest = z.object({
  id: Id,
  /** Disclosed only once the organization approved the request (a token-based request names no organization). */
  organizationName: z.string().min(1).nullable(),
  status: SupplierMembershipRequestsStatus,
  message: z.string(),
  decisionNote: z.string().nullable(),
  decidedAt: Instant.nullable(),
  createdAt: Instant,
});
export type MyMembershipRequest = z.infer<typeof MyMembershipRequest>;

export const MyMembershipRequestListQuery = listQueryWithSort(['createdAt', 'status'] as const).extend({
  status: queryList(SupplierMembershipRequestsStatus).optional(),
});

/** A membership request seen by the supplier administrator (SUP-04 / SUP-02). */
export const MembershipRequestRow = z.object({
  id: Id,
  requester: z.object({ userId: Id, fullName: z.string().min(1), email: z.string().min(1) }),
  message: z.string(),
  status: SupplierMembershipRequestsStatus,
  decidedBy: PersonRef.nullable(),
  decidedAt: Instant.nullable(),
  decisionNote: z.string().nullable(),
  createdAt: Instant,
});
export type MembershipRequestRow = z.infer<typeof MembershipRequestRow>;

export const MembershipRequestListQuery = listQueryWithSort(['createdAt', 'status'] as const).extend({
  status: queryList(SupplierMembershipRequestsStatus).optional(),
  createdFrom: CalendarDate.optional(),
  createdTo: CalendarDate.optional(),
});

export const DecideMembershipRequestBody = z
  .object({
    decision: z.enum(['approved', 'rejected'], { error: issue('DECISION_REQUIRED', 'Approve or reject the request.') }),
    capacity: Text(120).optional(),
    decisionNote: Text(2000).optional(),
  })
  .refine((body) => body.decision !== 'approved' || (body.capacity ?? '').length > 0, {
    message: issue('CAPACITY_REQUIRED', 'Name the capacity the person will act in.'),
    path: ['capacity'],
  })
  .refine((body) => body.decision !== 'rejected' || (body.decisionNote ?? '').length > 0, {
    message: issue('DECISION_NOTE_REQUIRED', 'Explain the rejection to the requester.'),
    path: ['decisionNote'],
  });
export type DecideMembershipRequestBody = z.infer<typeof DecideMembershipRequestBody>;

// ---------------------------------------------------------------------------------------------------------
// Identity verification: missing evidence requested by the operator (SUP-02 "resolve missing evidence", DD-27)
// ---------------------------------------------------------------------------------------------------------

/**
 * Status of an operator request for missing identity evidence. A contract-defined value: Stage B needs a
 * `supplier_verification_requests [T]` table (tenant = supplier; reason, evidence_types text[], due_date, status,
 * requested_by, requested_at, responded_by, responded_at, response_note) and `supplier_verification_request_items`
 * (request_id, evidence_item_id); reported as a blueprint follow-up.
 */
export const VerificationRequestStatus = z.enum(VERIFICATION_REQUEST_STATUSES);
export type VerificationRequestStatus = z.infer<typeof VerificationRequestStatus>;

/** An evidence edition the supplier supplied in answer to a verification request. */
export const VerificationEvidenceRef = z.object({
  evidenceItemId: Id,
  evidenceType: EvidenceItemsEvidenceType,
  title: z.string().min(1),
});
export type VerificationEvidenceRef = z.infer<typeof VerificationEvidenceRef>;

/** An operator request for identity evidence that is missing or unclear (registration is still not qualification). */
export const VerificationRequest = z.object({
  id: Id,
  status: VerificationRequestStatus,
  reason: z.string().min(1),
  evidenceTypes: z.array(EvidenceItemsEvidenceType).min(1),
  dueDate: CalendarDate.nullable(),
  /** Always the platform operations team, never an individual operator's name. */
  requestedBy: z.string().min(1),
  requestedAt: Instant,
  response: z
    .object({
      respondedBy: PersonRef,
      respondedAt: Instant,
      note: z.string().nullable(),
      evidence: z.array(VerificationEvidenceRef).min(1),
    })
    .nullable(),
});
export type VerificationRequest = z.infer<typeof VerificationRequest>;

/** The operator asks the registrant for missing identity evidence. */
export const RequestVerificationEvidenceBody = z.object({
  reason: RequiredText(2000, 'REASON_REQUIRED', 'Explain what is missing or unclear.'),
  evidenceTypes: z
    .array(EvidenceItemsEvidenceType)
    .min(1, issue('EVIDENCE_TYPE_REQUIRED', 'Choose at least one kind of evidence.'))
    .refine((types) => new Set(types).size === types.length, issue('DUPLICATE_EVIDENCE_TYPE', 'Each kind of evidence once.')),
  dueDate: CalendarDate.nullable(),
});
export type RequestVerificationEvidenceBody = z.infer<typeof RequestVerificationEvidenceBody>;

/** The supplier answers with evidence from its library (current editions only). */
export const RespondVerificationRequestBody = z.object({
  evidenceItemIds: z
    .array(Id)
    .min(1, issue('EVIDENCE_REQUIRED', 'Choose the evidence that answers the request.'))
    .max(20, issue('TOO_MANY_VALUES', 'At most 20 items.'))
    .refine((ids) => new Set(ids).size === ids.length, issue('DUPLICATE_EVIDENCE', 'Each item once.')),
  note: Text(2000).nullable(),
});
export type RespondVerificationRequestBody = z.infer<typeof RespondVerificationRequestBody>;

// ---------------------------------------------------------------------------------------------------------
// SUP-03: organization profile
// ---------------------------------------------------------------------------------------------------------

/** The supplier's own organization profile (`tenants` identity + `supplier_profiles` + locations + categories). */
export const SupplierProfile = z.object({
  tenantId: Id,
  slug: Slug,
  legalName: z.string().min(1),
  tradingName: z.string().nullable(),
  country: CountryCode,
  registrationJurisdiction: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  taxIdentifier: z.string().nullable(),
  defaultCurrency: CurrencyCode.nullable(),
  officialTimeZone: z.string().min(1),
  statuses: RegistrationStatuses,
  tradingNames: z.array(z.string()),
  website: z.string().nullable(),
  description: z.string().nullable(),
  yearEstablished: z.number().int().min(1800).max(2100).nullable(),
  employeeCountBand: z.string().nullable(),
  annualTurnoverBand: z.string().nullable(),
  capacityOverview: z.string().nullable(),
  ownershipDisclosure: z.string().nullable(),
  ultimateParentName: z.string().nullable(),
  serviceAreas: z.array(z.string()),
  preferredLanguages: z.array(LanguageTag),
  primaryContact: PersonRef.nullable(),
  locations: z.array(SupplierLocation),
  categories: z.array(SupplierCategory),
  legalNameHistory: z.array(LegalNameEntry),
  pendingIdentityChangeCount: z.number().int().min(0),
  /** Operator requests for missing identity evidence, newest first (open ones need an answer). */
  verificationRequests: z.array(VerificationRequest),
  /** Active members of the organization who may be named the primary contact. */
  memberOptions: z.array(PersonRef),
  /** Active evidence shares per buyer (the buyer-sharing choices of SUP-03). */
  buyerSharing: z.array(z.object({ buyer: OrganizationLabel, sharedItemCount: z.number().int().min(0) })),
  bankingCollected: z.literal(false),
  bankingNotice: z.string().min(1),
  updatedAt: Instant,
});
export type SupplierProfile = z.infer<typeof SupplierProfile>;

/**
 * Profile update. Legal name, registration and ownership changes are NOT editable here: they go through a reviewed
 * identity change (FR-02). There are no banking fields.
 */
export const UpdateProfileBody = z.object({
  tradingNames: StringList(10, 300),
  website: z.url(issue('INVALID_URL', 'Enter a web address such as https://example.co.bw.')).nullable(),
  description: Text(4000).nullable(),
  yearEstablished: z
    .number()
    .int(issue('INVALID_YEAR', 'Enter a year.'))
    .min(1800, issue('INVALID_YEAR', 'Enter a year after 1800.'))
    .max(2100, issue('INVALID_YEAR', 'Enter a valid year.'))
    .nullable(),
  employeeCountBand: Text(40).nullable(),
  annualTurnoverBand: Text(40).nullable(),
  capacityOverview: Text(4000).nullable(),
  serviceAreas: StringList(20, 120),
  preferredLanguages: z.array(LanguageTag).min(1, issue('LANGUAGE_REQUIRED', 'Choose at least one language.')),
  primaryContactUserId: Id.nullable(),
  locations: LocationsInput,
  categories: CategoriesInput,
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

// ---------------------------------------------------------------------------------------------------------
// Legal-identity changes (SUP-03, BUY-32, operator review)
// ---------------------------------------------------------------------------------------------------------

/** A legal-identity change request (`supplier_identity_changes`). */
export const IdentityChange = z.object({
  id: Id,
  changeType: SupplierIdentityChangesChangeType,
  previousValue: z.string().nullable(),
  proposedValue: z.string().min(1),
  /**
   * The supplier's explanation of the change. The blueprint has no column for it yet: Stage B needs
   * `supplier_identity_changes.reason text not null` (blueprint follow-up); `decision_note` is the reviewer's text.
   */
  reason: z.string().min(1),
  evidenceDocument: EvidenceDocumentRef.nullable(),
  status: SupplierIdentityChangesStatus,
  submittedBy: PersonRef,
  submittedAt: Instant,
  reviewedBy: PersonRef.nullable(),
  reviewedAt: Instant.nullable(),
  effectiveAt: Instant.nullable(),
  decisionNote: z.string().nullable(),
});
export type IdentityChange = z.infer<typeof IdentityChange>;

export const IdentityChangeListQuery = listQueryWithSort(['submittedAt', 'status', 'changeType'] as const).extend({
  status: queryList(SupplierIdentityChangesStatus).optional(),
  changeType: queryList(SupplierIdentityChangesChangeType).optional(),
  submittedFrom: CalendarDate.optional(),
  submittedTo: CalendarDate.optional(),
});

export const CreateIdentityChangeBody = z.object({
  changeType: SupplierIdentityChangesChangeType,
  proposedValue: RequiredText(500, 'PROPOSED_VALUE_REQUIRED', 'Enter the new value.'),
  reason: RequiredText(4000, 'REASON_REQUIRED', 'Explain the change.'),
  evidenceDocumentId: Id.nullable(),
  requestedEffectiveDate: CalendarDate.optional(),
});
export type CreateIdentityChangeBody = z.infer<typeof CreateIdentityChangeBody>;

/** An identity change with the operator's review context. */
export const OpsIdentityChangeRow = IdentityChange.extend({
  supplier: z.object({ tenantId: Id, legalName: z.string().min(1), slug: Slug, status: TenantsStatus }),
});
export type OpsIdentityChangeRow = z.infer<typeof OpsIdentityChangeRow>;

export const OpsIdentityChangeDetail = OpsIdentityChangeRow.extend({
  legalNameHistory: z.array(LegalNameEntry),
  otherChanges: z.array(IdentityChange),
  /** Formal submissions made under the current identity; they keep their original representation (BR-44). */
  historicSubmissionCount: z.number().int().min(0),
  consequence: z.string().min(1),
});
export type OpsIdentityChangeDetail = z.infer<typeof OpsIdentityChangeDetail>;

export const OpsIdentityChangeListQuery = IdentityChangeListQuery.extend({
  supplierTenantId: z.coerce.number().int().positive().optional(),
});

export const DecideIdentityChangeBody = z
  .object({
    decision: z.enum(['approved', 'rejected'], { error: issue('DECISION_REQUIRED', 'Approve or reject the change.') }),
    effectiveDate: CalendarDate.optional(),
    decisionNote: ReasonText,
  })
  .refine((body) => body.decision !== 'approved' || body.effectiveDate !== undefined, {
    message: issue('EFFECTIVE_DATE_REQUIRED', 'Enter the date from which the change applies.'),
    path: ['effectiveDate'],
  });
export type DecideIdentityChangeBody = z.infer<typeof DecideIdentityChangeBody>;

// ---------------------------------------------------------------------------------------------------------
// SUP-05: evidence library
// ---------------------------------------------------------------------------------------------------------

/** An active or withdrawn share of an evidence edition with one buyer (`evidence_shares`). */
export const EvidenceShare = z.object({
  id: Id,
  buyer: OrganizationLabel,
  sharedAt: Instant,
  sharedBy: PersonRef,
  withdrawnAt: Instant.nullable(),
  withdrawnBy: PersonRef.nullable(),
});
export type EvidenceShare = z.infer<typeof EvidenceShare>;

/** Where an edition was formally submitted (`evidence_submissions`): immutable, survives withdrawal (FR-02, BR-25). */
export const EvidenceSubmission = z.object({
  id: Id,
  evidenceItemId: Id,
  editionNo: z.number().int().min(1),
  buyer: OrganizationLabel,
  contextType: EvidenceSubmissionsContextType,
  contextId: Id,
  contextReference: z.string().min(1),
  contextTitle: z.string().min(1),
  submittedAt: Instant,
});
export type EvidenceSubmission = z.infer<typeof EvidenceSubmission>;

/** One evidence edition in the supplier's library (`evidence_items`). */
export const EvidenceItem = z.object({
  id: Id,
  evidenceType: EvidenceItemsEvidenceType,
  title: z.string().min(1),
  issuer: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  periodStart: CalendarDate.nullable(),
  periodEnd: CalendarDate.nullable(),
  reportingCurrency: CurrencyCode.nullable(),
  isConsolidated: z.boolean().nullable(),
  coverage: NonNegativeMoney.nullable(),
  validFrom: CalendarDate.nullable(),
  expiresAt: CalendarDate.nullable(),
  status: EvidenceItemsStatus,
  freshness: EvidenceFreshness,
  verificationStatus: EvidenceItemsVerificationStatus,
  sensitivity: EvidenceItemsSensitivity,
  /**
   * Edition number within its lineage (1 = first edition). Derived, not stored: Stage B counts the
   * `evidence_items.replaced_by_id` chain that ends at this row.
   */
  editionNo: z.number().int().min(1),
  /** The edition this one replaced. Derived: the row whose `replaced_by_id` is this id. */
  replacesId: Id.nullable(),
  /** `evidence_items.replaced_by_id`. */
  replacedById: Id.nullable(),
  document: EvidenceDocumentRef.nullable(),
  activeShares: z.array(z.object({ shareId: Id, buyer: OrganizationLabel, sharedAt: Instant })),
  submissionCount: z.number().int().min(0),
  createdBy: PersonRef,
  createdAt: Instant,
  updatedAt: Instant,
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const EvidenceDetail = EvidenceItem.extend({
  /** Every edition of the lineage, newest first (this item included). */
  editions: z.array(
    z.object({
      id: Id,
      editionNo: z.number().int().min(1),
      status: EvidenceItemsStatus,
      validFrom: CalendarDate.nullable(),
      expiresAt: CalendarDate.nullable(),
      document: EvidenceDocumentRef.nullable(),
      createdAt: Instant,
    }),
  ),
  shares: z.array(EvidenceShare),
  /** Formal submissions of ANY edition of the lineage, with the edition used. */
  submissions: z.array(EvidenceSubmission),
});
export type EvidenceDetail = z.infer<typeof EvidenceDetail>;

export const EVIDENCE_SORT_FIELDS = ['title', 'evidenceType', 'expiresAt', 'createdAt', 'status'] as const;

export const EvidenceListQuery = listQueryWithSort(EVIDENCE_SORT_FIELDS).extend({
  evidenceType: queryList(EvidenceItemsEvidenceType).optional(),
  status: queryList(EvidenceItemsStatus).optional(),
  freshness: queryList(EvidenceFreshness).optional(),
  sensitivity: queryList(EvidenceItemsSensitivity).optional(),
  sharedWithBuyerId: z.coerce.number().int().positive().optional(),
  createdBy: z.coerce.number().int().positive().optional(),
  expiresFrom: CalendarDate.optional(),
  expiresTo: CalendarDate.optional(),
  /** Include replaced editions (default: only the latest edition of each lineage). */
  includeHistory: QueryBoolean.optional(),
});
export type EvidenceListQuery = z.output<typeof EvidenceListQuery>;

/** The library list: a page plus whether financial rows were withheld from this caller (PRD §4.3, BR-43). */
export const EvidencePage = pageOf(EvidenceItem).extend({
  financialRestricted: z.boolean(),
  summary: z.object({
    current: z.number().int().min(0),
    expiringSoon: z.number().int().min(0),
    expired: z.number().int().min(0),
    withdrawn: z.number().int().min(0),
  }),
});
export type EvidencePage = z.infer<typeof EvidencePage>;

const evidenceFieldsBase = {
  title: RequiredText(300, 'TITLE_REQUIRED', 'Enter a title.'),
  issuer: Text(300).nullable(),
  referenceNumber: Text(120).nullable(),
  periodStart: CalendarDate.nullable(),
  periodEnd: CalendarDate.nullable(),
  reportingCurrency: CurrencyCode.nullable(),
  isConsolidated: z.boolean().nullable(),
  coverage: NonNegativeMoney.nullable(),
  validFrom: CalendarDate.nullable(),
  expiresAt: CalendarDate.nullable(),
  documentId: Id,
};

type EvidenceShape = {
  evidenceType?: string;
  periodStart: string | null;
  periodEnd: string | null;
  reportingCurrency: string | null;
  validFrom: string | null;
  expiresAt: string | null;
  coverage: unknown;
};

function withEvidenceRules<T extends z.ZodType<EvidenceShape>>(schema: T) {
  return schema
    .refine((body) => body.periodStart === null || body.periodEnd === null || body.periodStart <= body.periodEnd, {
      message: issue('PERIOD_INVALID', 'The period must end after it starts.'),
      path: ['periodEnd'],
    })
    .refine((body) => body.validFrom === null || body.expiresAt === null || body.validFrom < body.expiresAt, {
      message: issue('EXPIRY_BEFORE_START', 'The expiry date must be after the start of validity.'),
      path: ['expiresAt'],
    })
    .refine(
      (body) =>
        body.evidenceType !== 'financial_statement' ||
        (body.periodStart !== null && body.periodEnd !== null && body.reportingCurrency !== null),
      {
        message: issue('REPORTING_PERIOD_REQUIRED', 'Financial statements need the reporting period and currency.'),
        path: ['periodEnd'],
      },
    )
    .refine((body) => body.evidenceType !== 'insurance' || (body.coverage !== null && body.expiresAt !== null), {
      message: issue('COVERAGE_REQUIRED', 'Insurance needs the coverage amount and the expiry date.'),
      path: ['coverage'],
    });
}

export const CreateEvidenceBody = withEvidenceRules(
  z.object({
    evidenceType: EvidenceItemsEvidenceType,
    sensitivity: EvidenceItemsSensitivity,
    ...evidenceFieldsBase,
  }),
);
export type CreateEvidenceBody = z.infer<typeof CreateEvidenceBody>;

/** Replace prospectively: a new edition; formal submissions of the old edition stay unchanged (FR-02). */
export const ReplaceEvidenceBody = withEvidenceRules(
  z.object({
    ...evidenceFieldsBase,
    reason: RequiredText(2000, 'REASON_REQUIRED', 'Explain why the evidence is replaced.'),
  }),
);
export type ReplaceEvidenceBody = z.infer<typeof ReplaceEvidenceBody>;

/** Renew: a new edition with a new validity period, same type and issuer. */
export const RenewEvidenceBody = z
  .object({
    validFrom: CalendarDate,
    expiresAt: CalendarDate,
    referenceNumber: Text(120).nullable(),
    coverage: NonNegativeMoney.nullable(),
    documentId: Id,
  })
  .refine((body) => body.validFrom < body.expiresAt, {
    message: issue('EXPIRY_BEFORE_START', 'The expiry date must be after the start of validity.'),
    path: ['expiresAt'],
  });
export type RenewEvidenceBody = z.infer<typeof RenewEvidenceBody>;

/** The outcome of replace or renew: the superseded edition and the new one. */
export const EvidenceEditionResult = z.object({
  previous: EvidenceItem,
  current: EvidenceItem,
  /** The shares carried to the new edition (sharing continues for the same buyers). */
  carriedShareCount: z.number().int().min(0),
  /** Formal submissions that keep the previous edition (never rewritten). */
  retainedSubmissionCount: z.number().int().min(0),
});
export type EvidenceEditionResult = z.infer<typeof EvidenceEditionResult>;

export const WithdrawEvidenceBody = z.object({ reason: ReasonText });

export const WithdrawEvidenceResult = z.object({
  item: EvidenceItem,
  endedShareCount: z.number().int().min(0),
  retainedSubmissionCount: z.number().int().min(0),
});

export const ShareEvidenceBody = z.object({ buyerTenantId: Id });

export const WithdrawShareBody = z.object({ reason: Text(2000).optional() });

/** The outcome of withdrawing future sharing: earlier formal submissions remain in the buyer's record (FR-02). */
export const WithdrawShareResult = z.object({
  share: EvidenceShare,
  retainedSubmissionCount: z.number().int().min(0),
  message: z.string().min(1),
});

/** A buyer the supplier may share evidence with. */
export const SharingBuyer = z.object({
  buyer: OrganizationLabel,
  slug: Slug,
  sharedItemCount: z.number().int().min(0),
  hasParticipated: z.boolean(),
});
export type SharingBuyer = z.infer<typeof SharingBuyer>;

// ---------------------------------------------------------------------------------------------------------
// BUY-31 / BUY-32: directory and relationship record (buyer-specific only, BR-45)
// ---------------------------------------------------------------------------------------------------------

/** This buyer's relationship (`buyer_supplier_relationships`, [R]: never reachable by the supplier). */
export const Relationship = z.object({
  id: Id,
  status: BuyerSupplierRelationshipsStatus,
  riskRating: BuyerSupplierRelationshipsRiskRating,
  owner: PersonRef.nullable(),
  restrictionNote: z.string().nullable(),
  internalNotes: z.string().nullable(),
  firstEngagedAt: Instant.nullable(),
  updatedAt: Instant,
});
export type Relationship = z.infer<typeof Relationship>;

/** A relationship contact (`relationship_contacts`, [R]). */
export const RelationshipContact = z.object({
  id: Id,
  name: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  roleLabel: z.string().nullable(),
  isPrimary: z.boolean(),
  active: z.boolean(),
});
export type RelationshipContact = z.infer<typeof RelationshipContact>;

/** This buyer's qualification standing for one program (`v_qualification_status`, DD-13). */
export const QualificationScope = z.object({
  programId: Id,
  programName: z.string().min(1),
  effectiveStatus: VQualificationStatusEffectiveStatus,
  scopeCategory: SupplierCategory.nullable(),
  scopeMaxValue: NonNegativeMoney.nullable(),
  scopeGeography: z.string().nullable(),
  effectiveFrom: CalendarDate.nullable(),
  effectiveTo: CalendarDate.nullable(),
  conditions: z.string().nullable(),
});
export type QualificationScope = z.infer<typeof QualificationScope>;

/** Freshness of the evidence shared with THIS buyer only. */
export const EvidenceFreshnessSummary = z.object({
  sharedCount: z.number().int().min(0),
  expiringSoonCount: z.number().int().min(0),
  expiredCount: z.number().int().min(0),
  nextExpiry: CalendarDate.nullable(),
  worst: EvidenceFreshness.nullable(),
});
export type EvidenceFreshnessSummary = z.infer<typeof EvidenceFreshnessSummary>;

/**
 * The latest performance review of a contract that has an outcome (`performance_reviews` of this buyer's contract;
 * drafts are left out). `supplierDisputes` mirrors `performance_reviews.supplier_disputes`.
 */
export const ContractPerformanceSummary = z.object({
  reviewId: Id,
  periodStart: CalendarDate,
  periodEnd: CalendarDate,
  status: PerformanceReviewsStatus,
  overallRating: PerformanceReviewsOverallRating,
  supplierResponded: z.boolean(),
  supplierDisputes: z.boolean(),
  /** Reviews of this contract with an outcome, including this one. */
  reviewCount: z.number().int().min(1),
});
export type ContractPerformanceSummary = z.infer<typeof ContractPerformanceSummary>;

/** A contract between this buyer and the supplier (`contracts` of this buyer tenant), with its performance. */
export const RelationshipContract = z.object({
  contractId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: ContractsStatus,
  performance: ContractPerformanceSummary.nullable(),
});
export type RelationshipContract = z.infer<typeof RelationshipContract>;

/** One BUY-31 row. */
export const DirectoryRow = z.object({
  supplierTenantId: Id,
  legalName: z.string().min(1),
  tradingName: z.string().nullable(),
  slug: Slug,
  country: CountryCode,
  registrationStatus: TenantsStatus,
  verificationStatus: TenantsVerificationStatus,
  isProvisional: z.boolean(),
  categories: z.array(SupplierCategory),
  relationship: Relationship.omit({ internalNotes: true }).nullable(),
  primaryContact: RelationshipContact.pick({ name: true, email: true, phone: true }).nullable(),
  qualification: z.array(QualificationScope),
  contractCount: z.number().int().min(0),
  evidence: EvidenceFreshnessSummary,
  /** An open duplicate flag this buyer raised. */
  duplicateFlagged: z.boolean(),
});
export type DirectoryRow = z.infer<typeof DirectoryRow>;

export const DIRECTORY_SORT_FIELDS = ['legalName', 'relationshipStatus', 'firstEngagedAt', 'nextEvidenceExpiry', 'riskRating'] as const;

export const DirectoryListQuery = listQueryWithSort(DIRECTORY_SORT_FIELDS).extend({
  /** Category filter: a catalog code, including its descendants (DD-26). */
  category: queryList(CatalogCode).optional(),
  relationshipStatus: queryList(z.enum([...BuyerSupplierRelationshipsStatus.options, 'none'])).optional(),
  qualificationStatus: queryList(VQualificationStatusEffectiveStatus).optional(),
  riskRating: queryList(BuyerSupplierRelationshipsRiskRating).optional(),
  evidenceFreshness: queryList(EvidenceFreshness).optional(),
  verificationStatus: queryList(TenantsVerificationStatus).optional(),
  ownerUserId: z.coerce.number().int().positive().optional(),
  hasContracts: QueryBoolean.optional(),
  provisionalOnly: QueryBoolean.optional(),
  engagedFrom: CalendarDate.optional(),
  engagedTo: CalendarDate.optional(),
});
export type DirectoryListQuery = z.output<typeof DirectoryListQuery>;

export const DirectoryPage = pageOf(DirectoryRow).extend({
  /** Active members of this buyer who may own a relationship (the owner filter). */
  ownerOptions: z.array(PersonRef),
  summary: z.object({
    active: z.number().int().min(0),
    qualified: z.number().int().min(0),
    restrictedOrSuspended: z.number().int().min(0),
    evidenceExpiring: z.number().int().min(0),
  }),
});
export type DirectoryPage = z.infer<typeof DirectoryPage>;

/** Evidence shared with this buyer, as the buyer sees it (financial rows redacted without the financial review right). */
export const SharedEvidenceRow = z.object({
  evidenceItemId: Id,
  evidenceType: EvidenceItemsEvidenceType,
  sensitivity: EvidenceItemsSensitivity,
  /** True when the caller lacks the right to see this financial evidence: descriptive fields are null. */
  restricted: z.boolean(),
  title: z.string().min(1),
  issuer: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  periodStart: CalendarDate.nullable(),
  periodEnd: CalendarDate.nullable(),
  reportingCurrency: CurrencyCode.nullable(),
  coverage: NonNegativeMoney.nullable(),
  validFrom: CalendarDate.nullable(),
  expiresAt: CalendarDate.nullable(),
  status: EvidenceItemsStatus,
  freshness: EvidenceFreshness,
  verificationStatus: EvidenceItemsVerificationStatus,
  editionNo: z.number().int().min(1),
  document: EvidenceDocumentRef.nullable(),
  sharedAt: Instant,
});
export type SharedEvidenceRow = z.infer<typeof SharedEvidenceRow>;

/**
 * A relationship history entry (buyer-internal). No blueprint table holds it: Stage B reads the `audit_log` rows of
 * this buyer tenant whose subject is the `buyer_supplier_relationships` row or its `relationship_contacts`, plus this
 * buyer's `duplicate_candidates` and qualification requests for the supplier, mapped to `eventType`.
 */
export const RelationshipEvent = z.object({
  id: Id,
  at: Instant,
  eventType: z.enum([
    'relationship_created',
    'status_changed',
    'risk_changed',
    'owner_changed',
    'contact_changed',
    'qualification_requested',
    'duplicate_flagged',
    'identity_change_reviewed',
    'note',
  ]),
  summary: z.string().min(1),
  actor: PersonRef.nullable(),
});
export type RelationshipEvent = z.infer<typeof RelationshipEvent>;

/** A duplicate flag this buyer raised (`duplicate_candidates`, only the rows with `raised_by_tenant_id` = buyer). */
export const BuyerDuplicateFlag = z.object({
  id: Id,
  otherSupplier: z.object({ supplierTenantId: Id, legalName: z.string().min(1) }),
  detectedReason: DuplicateCandidatesDetectedReason,
  status: DuplicateCandidatesStatus,
  note: z.string().nullable(),
  createdAt: Instant,
});

/** A qualification program the buyer can ask this supplier to apply to. */
export const RequestableProgram = z.object({
  programId: Id,
  name: z.string().min(1),
  category: SupplierCategory.nullable(),
});

/**
 * The claim invitation of a provisional supplier created by THIS buyer (FR-02, DD-17). The link lets the buyer pass
 * the invitation on through another channel when the e-mail did not arrive; claiming still requires the invited
 * address, which receives the verification e-mail.
 */
export const ProvisionalClaimInvitation = z.object({
  state: ClaimInvitationState,
  contactName: z.string().min(1),
  email: z.string().min(1),
  sentAt: Instant,
  sentCount: z.number().int().min(0),
  expiresAt: Instant,
  claimPath: z.string().regex(/^\/register\/claim\/clm_[A-Za-z0-9]{8,64}$/),
});
export type ProvisionalClaimInvitation = z.infer<typeof ProvisionalClaimInvitation>;

/** BUY-32: the buyer-specific relationship record. Never another buyer's assessments (BR-45). */
export const RelationshipRecord = z.object({
  supplierTenantId: Id,
  legalName: z.string().min(1),
  tradingNames: z.array(z.string()),
  slug: Slug,
  country: CountryCode,
  registrationJurisdiction: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  registrationStatus: TenantsStatus,
  verificationStatus: TenantsVerificationStatus,
  isProvisional: z.boolean(),
  createdByThisBuyer: z.boolean(),
  /** Present only for a provisional record this buyer created. */
  claimInvitation: ProvisionalClaimInvitation.nullable(),
  website: z.string().nullable(),
  description: z.string().nullable(),
  yearEstablished: z.number().int().nullable(),
  ownershipDisclosure: z.string().nullable(),
  ultimateParentName: z.string().nullable(),
  serviceAreas: z.array(z.string()),
  locations: z.array(SupplierLocation),
  categories: z.array(SupplierCategory),
  legalNameHistory: z.array(LegalNameEntry),
  identityChanges: z.array(IdentityChange),
  relationship: Relationship.nullable(),
  contacts: z.array(RelationshipContact),
  qualification: z.array(QualificationScope),
  requestablePrograms: z.array(RequestableProgram),
  contracts: z.array(RelationshipContract),
  sharedEvidence: z.array(SharedEvidenceRow),
  evidence: EvidenceFreshnessSummary,
  duplicateFlags: z.array(BuyerDuplicateFlag),
  history: z.array(RelationshipEvent),
  /** Active members of this buyer who may own the relationship. */
  ownerOptions: z.array(PersonRef),
  /** Fixed statement of the BR-45 boundary shown on the record. */
  segregationNotice: z.string().min(1),
});
export type RelationshipRecord = z.infer<typeof RelationshipRecord>;

export const UpdateRelationshipBody = z
  .object({
    status: BuyerSupplierRelationshipsStatus,
    riskRating: BuyerSupplierRelationshipsRiskRating,
    relationshipOwnerUserId: Id.nullable(),
    restrictionNote: Text(2000).nullable(),
    internalNotes: Text(4000).nullable(),
    changeReason: RequiredText(2000, 'REASON_REQUIRED', 'Explain the change.'),
  })
  .refine(
    (body) => (body.status !== 'restricted' && body.status !== 'suspended') || (body.restrictionNote ?? '').length > 0,
    { message: issue('RESTRICTION_NOTE_REQUIRED', 'State what is restricted and why.'), path: ['restrictionNote'] },
  );
export type UpdateRelationshipBody = z.infer<typeof UpdateRelationshipBody>;

export const RelationshipContactBody = z.object({
  name: RequiredText(200, 'CONTACT_NAME_REQUIRED', 'Enter the contact name.'),
  email: Email.nullable(),
  phone: Phone.nullable(),
  roleLabel: Text(120).nullable(),
  isPrimary: z.boolean(),
  active: z.boolean(),
});
export type RelationshipContactBody = z.infer<typeof RelationshipContactBody>;

/** Buyer-created provisional supplier record with an invitation to claim it (FR-02, DD-17). */
export const CreateProvisionalSupplierBody = z.object({
  legalName: RequiredText(300, 'LEGAL_NAME_REQUIRED', 'Enter the legal name.'),
  country: CountryCode,
  registrationNumber: Text(80).optional(),
  contactName: RequiredText(200, 'CONTACT_NAME_REQUIRED', 'Enter the contact name.'),
  contactEmail: Email,
  categories: CategoriesInput,
  message: Text(2000).optional(),
});
export type CreateProvisionalSupplierBody = z.infer<typeof CreateProvisionalSupplierBody>;

export const ProvisionalSupplierResult = z.object({
  supplierTenantId: Id,
  legalName: z.string().min(1),
  isProvisional: z.literal(true),
  registrationStatus: TenantsStatus,
  invitationStatus: InvitationsStatus,
  relationship: Relationship,
  message: z.string().min(1),
});

export const RequestQualificationBody = z.object({
  programId: Id,
  message: Text(2000).optional(),
  dueDate: CalendarDate.optional(),
});

export const QualificationRequestResult = z.object({
  supplierTenantId: Id,
  programId: Id,
  programName: z.string().min(1),
  requestedAt: Instant,
  message: z.string().min(1),
});

export const FlagDuplicateBody = z.object({
  otherSupplierTenantId: Id,
  detectedReason: DuplicateCandidatesDetectedReason,
  note: RequiredText(2000, 'NOTE_REQUIRED', 'Explain why these records may be the same organization.'),
});

export const FlagDuplicateResult = z.object({
  id: Id,
  status: DuplicateCandidatesStatus,
  message: z.string().min(1),
  createdAt: Instant,
});

// ---------------------------------------------------------------------------------------------------------
// Operator: duplicate review and registrations (BR-44, DD-27)
// ---------------------------------------------------------------------------------------------------------

/** A supplier organization as the operator compares it (identity metadata only, never procurement content). */
export const OpsSupplierSummary = z.object({
  tenantId: Id,
  legalName: z.string().min(1),
  slug: Slug,
  status: TenantsStatus,
  verificationStatus: TenantsVerificationStatus,
  isProvisional: z.boolean(),
  createdBy: OrganizationLabel.nullable(),
  country: CountryCode,
  registrationNumber: z.string().nullable(),
  emailDomain: z.string().nullable(),
  memberCount: z.number().int().min(0),
  createdAt: Instant,
});
export type OpsSupplierSummary = z.infer<typeof OpsSupplierSummary>;

/** A merge record (`supplier_merges`): records are never re-pointed (BR-44). */
export const SupplierMerge = z.object({
  id: Id,
  survivingTenantId: Id,
  mergedTenantId: Id,
  approvedBy: PersonRef,
  reason: z.string().min(1),
  mergedAt: Instant,
});

/** A duplicate candidate (`duplicate_candidates`, [G]). */
export const DuplicateCandidate = z.object({
  id: Id,
  tenantA: OpsSupplierSummary,
  tenantB: OpsSupplierSummary,
  detectedReason: DuplicateCandidatesDetectedReason,
  status: DuplicateCandidatesStatus,
  raisedBy: OrganizationLabel.nullable(),
  reviewedBy: PersonRef.nullable(),
  reviewedAt: Instant.nullable(),
  note: z.string().nullable(),
  createdAt: Instant,
});
export type DuplicateCandidate = z.infer<typeof DuplicateCandidate>;

export const DuplicateDetail = DuplicateCandidate.extend({
  merge: SupplierMerge.nullable(),
  /** The fields that match or differ, for the side-by-side review. */
  comparison: z.array(z.object({ field: z.string().min(1), valueA: z.string().nullable(), valueB: z.string().nullable(), matches: z.boolean() })),
  guidance: z.string().min(1),
});
export type DuplicateDetail = z.infer<typeof DuplicateDetail>;

export const DuplicateListQuery = listQueryWithSort(['createdAt', 'status', 'detectedReason'] as const).extend({
  status: queryList(DuplicateCandidatesStatus).optional(),
  detectedReason: queryList(DuplicateCandidatesDetectedReason).optional(),
  createdFrom: CalendarDate.optional(),
  createdTo: CalendarDate.optional(),
});

export const DecideDuplicateBody = z
  .object({
    decision: z.enum(['not_duplicate', 'merged', 'escalated'], { error: issue('DECISION_REQUIRED', 'Choose a decision.') }),
    survivingTenantId: Id.optional(),
    reason: ReasonText,
  })
  .refine((body) => body.decision !== 'merged' || body.survivingTenantId !== undefined, {
    message: issue('SURVIVING_TENANT_REQUIRED', 'Choose the organization that survives the merge.'),
    path: ['survivingTenantId'],
  });
export type DecideDuplicateBody = z.infer<typeof DecideDuplicateBody>;

export const DecideDuplicateResult = z.object({
  candidate: DuplicateCandidate,
  merge: SupplierMerge.nullable(),
  message: z.string().min(1),
});

/** A registration awaiting completion (DD-27: abandoned registrations stay visible and can be closed). */
export const OpsRegistrationRow = z.object({
  tenantId: Id,
  legalName: z.string().min(1),
  country: CountryCode,
  registrationNumber: z.string().nullable(),
  registrant: z.object({ fullName: z.string().min(1), email: z.string().min(1) }),
  status: TenantsStatus,
  verificationStatus: TenantsVerificationStatus,
  verificationEmailStatus: InvitationsStatus,
  verificationEmailSentCount: z.number().int().min(0),
  possibleDuplicate: z.boolean(),
  categories: z.array(SupplierCategory),
  /** The latest request for missing identity evidence, else null. */
  evidenceRequest: z
    .object({
      id: Id,
      status: VerificationRequestStatus,
      reason: z.string().min(1),
      evidenceTypes: z.array(EvidenceItemsEvidenceType).min(1),
      dueDate: CalendarDate.nullable(),
      requestedAt: Instant,
      respondedAt: Instant.nullable(),
    })
    .nullable(),
  createdAt: Instant,
  lastActivityAt: Instant,
});
export type OpsRegistrationRow = z.infer<typeof OpsRegistrationRow>;

export const RegistrationListQuery = listQueryWithSort(['createdAt', 'legalName', 'lastActivityAt'] as const).extend({
  status: queryList(TenantsStatus).optional(),
  verificationStatus: queryList(TenantsVerificationStatus).optional(),
  verificationEmailStatus: queryList(InvitationsStatus).optional(),
  possibleDuplicate: QueryBoolean.optional(),
  createdFrom: CalendarDate.optional(),
  createdTo: CalendarDate.optional(),
});

export const CloseRegistrationBody = z.object({ reason: ReasonText });

export const VerifyIdentityBody = z.object({
  evidenceNote: RequiredText(2000, 'EVIDENCE_NOTE_REQUIRED', 'Record which registry or documents confirmed the identity.'),
});
