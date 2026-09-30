/**
 * Every enumeration and lifecycle state of TenderIQ, defined ONCE for the SPA, the mock API and the backend
 * (architecture-plan §3.6, §3.10; ADR 0004).
 *
 * - Each blueprint CHECK list (docs/plan/schema-blueprint.md) is mirrored here and named after its
 *   `table.column`: `TENDERS_STATUS` (the `as const` array), `TendersStatus` (the zod enum) and the
 *   `TendersStatus` TypeScript type. A unit test parses the blueprint and fails on any difference.
 * - A few enumerations are defined by the contracts because the blueprint stores them as free text or
 *   derives them (see "Contract-defined enumerations"). They are listed in `CONTRACT_DEFINED_ENUMS`.
 * - Write variants (DD-40): `framework_calloff` stays in the database CHECK lists for the future but is never
 *   offered by an enum used in a write body. Use the `*_WRITE` variants in request schemas.
 * - Display: `enumLabel()` gives the English label (the SPA wraps it with `t()` per DD-37) and `enumTone()` the
 *   StatusChip tone (`.tiq-chip` tones: info, accent, success, danger, neutral, neutral-outlined, warning).
 *
 * Pure module: zod only (architecture-plan §3.10).
 */
import { z } from 'zod';

/** StatusChip tones available in the design system (docs/technical/09-frontend.md §3, DD-34). */
export const CHIP_TONES = [
  'info',
  'accent',
  'success',
  'danger',
  'neutral',
  'neutral-outlined',
  'warning',
] as const;
export const ChipTone = z.enum(CHIP_TONES);
export type ChipTone = (typeof CHIP_TONES)[number];

// ---------------------------------------------------------------------------------------------------------
// Blueprint CHECK lists, in migration order
// ---------------------------------------------------------------------------------------------------------

// Migration 01 (platform_core)
/** `tenants.kind` */
export const TENANTS_KIND = ['buyer', 'supplier', 'operator'] as const;
export const TenantsKind = z.enum(TENANTS_KIND);
export type TenantsKind = (typeof TENANTS_KIND)[number];
/** `tenants.status` */
export const TENANTS_STATUS = ['pending', 'active', 'suspended', 'offboarding', 'closed'] as const;
export const TenantsStatus = z.enum(TENANTS_STATUS);
export type TenantsStatus = (typeof TENANTS_STATUS)[number];
/** `tenants.verification_status` */
export const TENANTS_VERIFICATION_STATUS = ['unverified', 'contact_verified', 'identity_verified'] as const;
export const TenantsVerificationStatus = z.enum(TENANTS_VERIFICATION_STATUS);
export type TenantsVerificationStatus = (typeof TENANTS_VERIFICATION_STATUS)[number];
/** `tenants.onboarding_stage` */
export const TENANTS_ONBOARDING_STAGE = [
  'setup',
  'configuring',
  'pilot',
  'live',
  'offboarding',
  'closed',
] as const;
export const TenantsOnboardingStage = z.enum(TENANTS_ONBOARDING_STAGE);
export type TenantsOnboardingStage = (typeof TENANTS_ONBOARDING_STAGE)[number];
/** `users.status` */
export const USERS_STATUS = ['invited', 'active', 'suspended', 'deactivated'] as const;
export const UsersStatus = z.enum(USERS_STATUS);
export type UsersStatus = (typeof USERS_STATUS)[number];
/** `users.theme` */
export const USERS_THEME = ['light', 'dark'] as const;
export const UsersTheme = z.enum(USERS_THEME);
export type UsersTheme = (typeof USERS_THEME)[number];
/** `memberships.status` */
export const MEMBERSHIPS_STATUS = ['invited', 'pending_approval', 'active', 'suspended', 'revoked'] as const;
export const MembershipsStatus = z.enum(MEMBERSHIPS_STATUS);
export type MembershipsStatus = (typeof MEMBERSHIPS_STATUS)[number];
/** `invitations.status` */
export const INVITATIONS_STATUS = [
  'pending',
  'send_failed',
  'accepted',
  'expired',
  'revoked',
  'reissued',
] as const;
export const InvitationsStatus = z.enum(INVITATIONS_STATUS);
export type InvitationsStatus = (typeof INVITATIONS_STATUS)[number];
/** `permissions.tenant_kind` */
export const PERMISSIONS_TENANT_KIND = ['buyer', 'supplier', 'operator', 'any'] as const;
export const PermissionsTenantKind = z.enum(PERMISSIONS_TENANT_KIND);
export type PermissionsTenantKind = (typeof PERMISSIONS_TENANT_KIND)[number];
/** `role_assignments.scope_type` */
export const ROLE_ASSIGNMENTS_SCOPE_TYPE = [
  'organization',
  'legal_entity',
  'department',
  'category',
  'project',
  'tender',
  'lot',
  'contract',
] as const;
export const RoleAssignmentsScopeType = z.enum(ROLE_ASSIGNMENTS_SCOPE_TYPE);
export type RoleAssignmentsScopeType = (typeof ROLE_ASSIGNMENTS_SCOPE_TYPE)[number];
/** `access_restrictions.restriction_type` */
export const ACCESS_RESTRICTIONS_RESTRICTION_TYPE = [
  'suspension',
  'conflict',
  'confidentiality',
  'other',
] as const;
export const AccessRestrictionsRestrictionType = z.enum(ACCESS_RESTRICTIONS_RESTRICTION_TYPE);
export type AccessRestrictionsRestrictionType = (typeof ACCESS_RESTRICTIONS_RESTRICTION_TYPE)[number];
/** `audit_log.sensitivity` */
export const AUDIT_LOG_SENSITIVITY = ['normal', 'restricted'] as const;
export const AuditLogSensitivity = z.enum(AUDIT_LOG_SENSITIVITY);
export type AuditLogSensitivity = (typeof AUDIT_LOG_SENSITIVITY)[number];
/** `job_run.trigger` */
export const JOB_RUN_TRIGGER = ['cron', 'queue', 'manual'] as const;
export const JobRunTrigger = z.enum(JOB_RUN_TRIGGER);
export type JobRunTrigger = (typeof JOB_RUN_TRIGGER)[number];
/** `job_run.environment` */
export const JOB_RUN_ENVIRONMENT = ['local', 'dev', 'preview', 'staging', 'production'] as const;
export const JobRunEnvironment = z.enum(JOB_RUN_ENVIRONMENT);
export type JobRunEnvironment = (typeof JOB_RUN_ENVIRONMENT)[number];
/** `job_run.status` */
export const JOB_RUN_STATUS = ['running', 'succeeded', 'failed'] as const;
export const JobRunStatus = z.enum(JOB_RUN_STATUS);
export type JobRunStatus = (typeof JOB_RUN_STATUS)[number];

// Migration 02 (org_structure)
/** `funding_sources.source_type` */
export const FUNDING_SOURCES_SOURCE_TYPE = [
  'operating_budget',
  'capital_budget',
  'grant',
  'donor',
  'other',
] as const;
export const FundingSourcesSourceType = z.enum(FUNDING_SOURCES_SOURCE_TYPE);
export type FundingSourcesSourceType = (typeof FUNDING_SOURCES_SOURCE_TYPE)[number];
/** `calendars.status` */
export const CALENDARS_STATUS = ['draft', 'approved', 'retired'] as const;
export const CalendarsStatus = z.enum(CALENDARS_STATUS);
export type CalendarsStatus = (typeof CALENDARS_STATUS)[number];
/** `committees.purpose` */
export const COMMITTEES_PURPOSE = [
  'evaluation',
  'award',
  'opening',
  'complaints',
  'policy',
  'other',
] as const;
export const CommitteesPurpose = z.enum(COMMITTEES_PURPOSE);
export type CommitteesPurpose = (typeof COMMITTEES_PURPOSE)[number];
/** `committee_members.member_role` */
export const COMMITTEE_MEMBERS_MEMBER_ROLE = ['chair', 'member', 'alternate', 'secretary'] as const;
export const CommitteeMembersMemberRole = z.enum(COMMITTEE_MEMBERS_MEMBER_ROLE);
export type CommitteeMembersMemberRole = (typeof COMMITTEE_MEMBERS_MEMBER_ROLE)[number];
/** `authority_limits.subject_type` */
export const AUTHORITY_LIMITS_SUBJECT_TYPE = ['user', 'role', 'committee'] as const;
export const AuthorityLimitsSubjectType = z.enum(AUTHORITY_LIMITS_SUBJECT_TYPE);
export type AuthorityLimitsSubjectType = (typeof AUTHORITY_LIMITS_SUBJECT_TYPE)[number];
/** `authority_limits.decision_type` */
export const AUTHORITY_LIMITS_DECISION_TYPE = [
  'request_approval',
  'funding_confirmation',
  'strategy_approval',
  'release_approval',
  'exclusion_approval',
  'shortlist_approval',
  'preferred_bidder_approval',
  'award_approval',
  'contract_approval',
  'contract_signature',
  'change_approval',
  'renewal_approval',
  'qualification_decision',
  'late_submission_exception',
  'negotiation_mandate',
  'disposal_approval',
] as const;
export const AuthorityLimitsDecisionType = z.enum(AUTHORITY_LIMITS_DECISION_TYPE);
export type AuthorityLimitsDecisionType = (typeof AUTHORITY_LIMITS_DECISION_TYPE)[number];
/** `sod_policies.rule_code` */
export const SOD_POLICIES_RULE_CODE = [
  'draft_vs_final_approval',
  'submission_custody_vs_opening',
  'evaluation_vs_award_approval',
  'supplier_assessment_vs_exception_approval',
  'requester_vs_request_approval',
] as const;
export const SodPoliciesRuleCode = z.enum(SOD_POLICIES_RULE_CODE);
export type SodPoliciesRuleCode = (typeof SOD_POLICIES_RULE_CODE)[number];
/** `sod_policies.mode` */
export const SOD_POLICIES_MODE = ['enforced', 'alternative_oversight'] as const;
export const SodPoliciesMode = z.enum(SOD_POLICIES_MODE);
export type SodPoliciesMode = (typeof SOD_POLICIES_MODE)[number];
/** `conflict_declarations.subject_type` */
export const CONFLICT_DECLARATIONS_SUBJECT_TYPE = [
  'tender',
  'lot',
  'qualification_application',
  'contract',
  'complaint',
] as const;
export const ConflictDeclarationsSubjectType = z.enum(CONFLICT_DECLARATIONS_SUBJECT_TYPE);
export type ConflictDeclarationsSubjectType = (typeof CONFLICT_DECLARATIONS_SUBJECT_TYPE)[number];
/** `conflict_declarations.nature` */
export const CONFLICT_DECLARATIONS_NATURE = [
  'financial_interest',
  'personal_relationship',
  'prior_employment',
  'bid_preparation',
  'other',
] as const;
export const ConflictDeclarationsNature = z.enum(CONFLICT_DECLARATIONS_NATURE);
export type ConflictDeclarationsNature = (typeof CONFLICT_DECLARATIONS_NATURE)[number];
/** `conflict_declarations.disposition` */
export const CONFLICT_DECLARATIONS_DISPOSITION = [
  'pending_review',
  'cleared',
  'mitigated',
  'recused',
  'reassigned',
] as const;
export const ConflictDeclarationsDisposition = z.enum(CONFLICT_DECLARATIONS_DISPOSITION);
export type ConflictDeclarationsDisposition = (typeof CONFLICT_DECLARATIONS_DISPOSITION)[number];

// Migration 03 (policy_templates)
/** `policy_profiles.status` */
export const POLICY_PROFILES_STATUS = ['active', 'retired'] as const;
export const PolicyProfilesStatus = z.enum(POLICY_PROFILES_STATUS);
export type PolicyProfilesStatus = (typeof POLICY_PROFILES_STATUS)[number];
/** `policy_profile_versions.status` */
export const POLICY_PROFILE_VERSIONS_STATUS = ['draft', 'in_review', 'approved', 'retired'] as const;
export const PolicyProfileVersionsStatus = z.enum(POLICY_PROFILE_VERSIONS_STATUS);
export type PolicyProfileVersionsStatus = (typeof POLICY_PROFILE_VERSIONS_STATUS)[number];
/** `policy_profile_versions.late_submission_policy` */
export const POLICY_PROFILE_VERSIONS_LATE_SUBMISSION_POLICY = ['reject', 'exception_route'] as const;
export const PolicyProfileVersionsLateSubmissionPolicy = z.enum(POLICY_PROFILE_VERSIONS_LATE_SUBMISSION_POLICY);
export type PolicyProfileVersionsLateSubmissionPolicy = (typeof POLICY_PROFILE_VERSIONS_LATE_SUBMISSION_POLICY)[number];
/** `policy_profile_versions.standstill_day_type` */
export const POLICY_PROFILE_VERSIONS_STANDSTILL_DAY_TYPE = ['calendar', 'working'] as const;
export const PolicyProfileVersionsStandstillDayType = z.enum(POLICY_PROFILE_VERSIONS_STANDSTILL_DAY_TYPE);
export type PolicyProfileVersionsStandstillDayType = (typeof POLICY_PROFILE_VERSIONS_STANDSTILL_DAY_TYPE)[number];
/** `custom_fields.entity_type` */
export const CUSTOM_FIELDS_ENTITY_TYPE = [
  'procurement_request',
  'tender',
  'qualification_application',
  'contract',
] as const;
export const CustomFieldsEntityType = z.enum(CUSTOM_FIELDS_ENTITY_TYPE);
export type CustomFieldsEntityType = (typeof CUSTOM_FIELDS_ENTITY_TYPE)[number];
/** `custom_fields.field_type` */
export const CUSTOM_FIELDS_FIELD_TYPE = ['text', 'number', 'date', 'boolean', 'choice'] as const;
export const CustomFieldsFieldType = z.enum(CUSTOM_FIELDS_FIELD_TYPE);
export type CustomFieldsFieldType = (typeof CUSTOM_FIELDS_FIELD_TYPE)[number];
/** `custom_fields.required_mode` */
export const CUSTOM_FIELDS_REQUIRED_MODE = ['optional', 'required', 'conditional'] as const;
export const CustomFieldsRequiredMode = z.enum(CUSTOM_FIELDS_REQUIRED_MODE);
export type CustomFieldsRequiredMode = (typeof CUSTOM_FIELDS_REQUIRED_MODE)[number];
/** `custom_fields.audience` */
export const CUSTOM_FIELDS_AUDIENCE = ['buyer_internal', 'supplier_visible', 'public'] as const;
export const CustomFieldsAudience = z.enum(CUSTOM_FIELDS_AUDIENCE);
export type CustomFieldsAudience = (typeof CUSTOM_FIELDS_AUDIENCE)[number];
/** `templates.kind` */
export const TEMPLATES_KIND = [
  'tender_package',
  'questionnaire',
  'criteria_set',
  'clause',
  'letter',
  'checklist',
  'contract',
] as const;
export const TemplatesKind = z.enum(TEMPLATES_KIND);
export type TemplatesKind = (typeof TEMPLATES_KIND)[number];
/** `templates.audience` */
export const TEMPLATES_AUDIENCE = ['buyer_internal', 'supplier_visible', 'public'] as const;
export const TemplatesAudience = z.enum(TEMPLATES_AUDIENCE);
export type TemplatesAudience = (typeof TEMPLATES_AUDIENCE)[number];
/** `templates.status` */
export const TEMPLATES_STATUS = ['draft', 'in_review', 'approved', 'retired'] as const;
export const TemplatesStatus = z.enum(TEMPLATES_STATUS);
export type TemplatesStatus = (typeof TEMPLATES_STATUS)[number];
/** `portal_settings.disclose_bidder_identities` */
export const PORTAL_SETTINGS_DISCLOSE_BIDDER_IDENTITIES = ['never', 'after_award', 'after_opening'] as const;
export const PortalSettingsDiscloseBidderIdentities = z.enum(PORTAL_SETTINGS_DISCLOSE_BIDDER_IDENTITIES);
export type PortalSettingsDiscloseBidderIdentities = (typeof PORTAL_SETTINGS_DISCLOSE_BIDDER_IDENTITIES)[number];
/** `portal_settings.public_document_policy` */
export const PORTAL_SETTINGS_PUBLIC_DOCUMENT_POLICY = ['public', 'registered', 'invitation'] as const;
export const PortalSettingsPublicDocumentPolicy = z.enum(PORTAL_SETTINGS_PUBLIC_DOCUMENT_POLICY);
export type PortalSettingsPublicDocumentPolicy = (typeof PORTAL_SETTINGS_PUBLIC_DOCUMENT_POLICY)[number];
/** `retention_classes.record_class` */
export const RETENTION_CLASSES_RECORD_CLASS = [
  'tender',
  'bid',
  'financial_evidence',
  'communication',
  'evaluation',
  'contract',
  'complaint',
  'personal_account',
  'audit',
] as const;
export const RetentionClassesRecordClass = z.enum(RETENTION_CLASSES_RECORD_CLASS);
export type RetentionClassesRecordClass = (typeof RETENTION_CLASSES_RECORD_CLASS)[number];
/** `retention_classes.trigger_event` */
export const RETENTION_CLASSES_TRIGGER_EVENT = [
  'event_closed',
  'contract_closed',
  'complaint_closed',
  'account_deactivated',
  'record_created',
] as const;
export const RetentionClassesTriggerEvent = z.enum(RETENTION_CLASSES_TRIGGER_EVENT);
export type RetentionClassesTriggerEvent = (typeof RETENTION_CLASSES_TRIGGER_EVENT)[number];
/** `retention_classes.disposition` */
export const RETENTION_CLASSES_DISPOSITION = ['destroy', 'archive', 'review'] as const;
export const RetentionClassesDisposition = z.enum(RETENTION_CLASSES_DISPOSITION);
export type RetentionClassesDisposition = (typeof RETENTION_CLASSES_DISPOSITION)[number];

// Migration 04 (shared_services)
/** `approval_requests.subject_type` */
export const APPROVAL_REQUESTS_SUBJECT_TYPE = [
  'procurement_request',
  'funding',
  'strategy',
  'tender_release',
  'addendum',
  'exclusion',
  'shortlist',
  'preferred_bidder',
  'negotiation_mandate',
  'final_offer_round',
  'award',
  'contract',
  'contract_signature',
  'contract_change',
  'renewal',
  'qualification_decision',
  'late_submission_exception',
  'policy_profile',
  'template',
  'disposal',
  'process_decision',
  'hold_release',
  'obligation_waiver',
  'security_release',
  'dispute_decision',
  'contract_difference',
  'final_award',
] as const;
export const ApprovalRequestsSubjectType = z.enum(APPROVAL_REQUESTS_SUBJECT_TYPE);
export type ApprovalRequestsSubjectType = (typeof APPROVAL_REQUESTS_SUBJECT_TYPE)[number];
/** `approval_requests.status` */
export const APPROVAL_REQUESTS_STATUS = [
  'pending',
  'approved',
  'approved_with_conditions',
  'returned',
  'rejected',
  'withdrawn',
  'invalidated',
  'expired',
] as const;
export const ApprovalRequestsStatus = z.enum(APPROVAL_REQUESTS_STATUS);
export type ApprovalRequestsStatus = (typeof APPROVAL_REQUESTS_STATUS)[number];
/** `approval_requests.route_mode` */
export const APPROVAL_REQUESTS_ROUTE_MODE = ['sequential', 'parallel_all', 'committee_quorum'] as const;
export const ApprovalRequestsRouteMode = z.enum(APPROVAL_REQUESTS_ROUTE_MODE);
export type ApprovalRequestsRouteMode = (typeof APPROVAL_REQUESTS_ROUTE_MODE)[number];
/** `approval_steps.status` */
export const APPROVAL_STEPS_STATUS = [
  'pending',
  'approved',
  'approved_with_conditions',
  'returned',
  'rejected',
  'skipped',
  'invalidated',
] as const;
export const ApprovalStepsStatus = z.enum(APPROVAL_STEPS_STATUS);
export type ApprovalStepsStatus = (typeof APPROVAL_STEPS_STATUS)[number];
/** `tasks.task_type` */
export const TASKS_TASK_TYPE = [
  'approval',
  'review',
  'assessment',
  'evaluation',
  'acknowledgment',
  'delivery_exception',
  'action',
  'reminder',
  'escalation',
  'reassignment',
] as const;
export const TasksTaskType = z.enum(TASKS_TASK_TYPE);
export type TasksTaskType = (typeof TASKS_TASK_TYPE)[number];
/** `tasks.priority` */
export const TASKS_PRIORITY = ['low', 'normal', 'high', 'urgent'] as const;
export const TasksPriority = z.enum(TASKS_PRIORITY);
export type TasksPriority = (typeof TASKS_PRIORITY)[number];
/** `tasks.status` */
export const TASKS_STATUS = [
  'open',
  'in_progress',
  'completed',
  'returned',
  'cancelled',
  'reassigned',
] as const;
export const TasksStatus = z.enum(TASKS_STATUS);
export type TasksStatus = (typeof TASKS_STATUS)[number];
/** `notifications.category` */
export const NOTIFICATIONS_CATEGORY = ['formal_notice', 'task', 'reminder', 'system', 'promotional'] as const;
export const NotificationsCategory = z.enum(NOTIFICATIONS_CATEGORY);
export type NotificationsCategory = (typeof NOTIFICATIONS_CATEGORY)[number];
/** `notification_deliveries.channel` */
export const NOTIFICATION_DELIVERIES_CHANNEL = ['in_app', 'email'] as const;
export const NotificationDeliveriesChannel = z.enum(NOTIFICATION_DELIVERIES_CHANNEL);
export type NotificationDeliveriesChannel = (typeof NOTIFICATION_DELIVERIES_CHANNEL)[number];
/** `notification_deliveries.status` */
export const NOTIFICATION_DELIVERIES_STATUS = ['queued', 'delivered', 'failed', 'not_configured'] as const;
export const NotificationDeliveriesStatus = z.enum(NOTIFICATION_DELIVERIES_STATUS);
export type NotificationDeliveriesStatus = (typeof NOTIFICATION_DELIVERIES_STATUS)[number];
/** `user_notification_preferences.digest` */
export const USER_NOTIFICATION_PREFERENCES_DIGEST = ['none', 'daily', 'weekly'] as const;
export const UserNotificationPreferencesDigest = z.enum(USER_NOTIFICATION_PREFERENCES_DIGEST);
export type UserNotificationPreferencesDigest = (typeof USER_NOTIFICATION_PREFERENCES_DIGEST)[number];
/** `notices.notice_type` */
export const NOTICES_NOTICE_TYPE = [
  'tender_issued',
  'invitation',
  'addendum',
  'deadline_change',
  'clarification_published',
  'cancellation',
  'exclusion',
  'shortlist_outcome',
  'preferred_bidder',
  'intent_to_award',
  'final_award',
  'unsuccessful_outcome',
  'standstill_change',
  'complaint_update',
  'contract_notice',
  'service_incident',
  'qualification_decision',
  'other',
] as const;
export const NoticesNoticeType = z.enum(NOTICES_NOTICE_TYPE);
export type NoticesNoticeType = (typeof NOTICES_NOTICE_TYPE)[number];
/** `notices.status` */
export const NOTICES_STATUS = ['draft', 'approved', 'issued', 'withdrawn'] as const;
export const NoticesStatus = z.enum(NOTICES_STATUS);
export type NoticesStatus = (typeof NOTICES_STATUS)[number];
/** `notices.period_start_basis` */
export const NOTICES_PERIOD_START_BASIS = [
  'publication',
  'transmission',
  'receipt',
  'acknowledgment',
] as const;
export const NoticesPeriodStartBasis = z.enum(NOTICES_PERIOD_START_BASIS);
export type NoticesPeriodStartBasis = (typeof NOTICES_PERIOD_START_BASIS)[number];
/** `notice_recipients.delivery_status` */
export const NOTICE_RECIPIENTS_DELIVERY_STATUS = ['pending', 'delivered', 'failed'] as const;
export const NoticeRecipientsDeliveryStatus = z.enum(NOTICE_RECIPIENTS_DELIVERY_STATUS);
export type NoticeRecipientsDeliveryStatus = (typeof NOTICE_RECIPIENTS_DELIVERY_STATUS)[number];
/** `documents.classification` */
export const DOCUMENTS_CLASSIFICATION = [
  'public',
  'participating_suppliers',
  'supplier_private',
  'buyer_internal',
  'restricted_assessment',
  'commercially_confidential',
  'sealed',
] as const;
export const DocumentsClassification = z.enum(DOCUMENTS_CLASSIFICATION);
export type DocumentsClassification = (typeof DOCUMENTS_CLASSIFICATION)[number];
/** `documents.status` */
export const DOCUMENTS_STATUS = [
  'draft',
  'approved',
  'published',
  'submitted',
  'superseded',
  'signed',
  'redacted',
  'withdrawn',
] as const;
export const DocumentsStatus = z.enum(DOCUMENTS_STATUS);
export type DocumentsStatus = (typeof DOCUMENTS_STATUS)[number];
/** `document_versions.upload_status` */
export const DOCUMENT_VERSIONS_UPLOAD_STATUS = ['pending', 'confirmed', 'rejected'] as const;
export const DocumentVersionsUploadStatus = z.enum(DOCUMENT_VERSIONS_UPLOAD_STATUS);
export type DocumentVersionsUploadStatus = (typeof DOCUMENT_VERSIONS_UPLOAD_STATUS)[number];
/** `comments.visibility` */
export const COMMENTS_VISIBILITY = ['buyer_internal', 'supplier_internal'] as const;
export const CommentsVisibility = z.enum(COMMENTS_VISIBILITY);
export type CommentsVisibility = (typeof COMMENTS_VISIBILITY)[number];
/** `holds.subject_type` */
export const HOLDS_SUBJECT_TYPE = [
  'tender',
  'lot',
  'contract',
  'qualification_application',
  'record_class',
  'record',
] as const;
export const HoldsSubjectType = z.enum(HOLDS_SUBJECT_TYPE);
export type HoldsSubjectType = (typeof HOLDS_SUBJECT_TYPE)[number];
/** `holds.hold_type` */
export const HOLDS_HOLD_TYPE = [
  'procurement_hold',
  'complaint_hold',
  'suspension',
  'legal_hold',
  'investigation_hold',
] as const;
export const HoldsHoldType = z.enum(HOLDS_HOLD_TYPE);
export type HoldsHoldType = (typeof HOLDS_HOLD_TYPE)[number];

// Migration 05 (suppliers_qualification)
/** `supplier_membership_requests.status` */
export const SUPPLIER_MEMBERSHIP_REQUESTS_STATUS = ['pending', 'approved', 'rejected', 'withdrawn'] as const;
export const SupplierMembershipRequestsStatus = z.enum(SUPPLIER_MEMBERSHIP_REQUESTS_STATUS);
export type SupplierMembershipRequestsStatus = (typeof SUPPLIER_MEMBERSHIP_REQUESTS_STATUS)[number];
/** `supplier_identity_changes.change_type` */
export const SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE = [
  'legal_name',
  'registration',
  'ownership',
  'merger',
  'succession',
  'representation_transfer',
  'admin_recovery',
] as const;
export const SupplierIdentityChangesChangeType = z.enum(SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE);
export type SupplierIdentityChangesChangeType = (typeof SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE)[number];
/** `supplier_identity_changes.status` */
export const SUPPLIER_IDENTITY_CHANGES_STATUS = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
] as const;
export const SupplierIdentityChangesStatus = z.enum(SUPPLIER_IDENTITY_CHANGES_STATUS);
export type SupplierIdentityChangesStatus = (typeof SUPPLIER_IDENTITY_CHANGES_STATUS)[number];
/** `duplicate_candidates.detected_reason` */
export const DUPLICATE_CANDIDATES_DETECTED_REASON = [
  'similar_name',
  'same_registration_number',
  'same_email_domain',
  'import_match',
] as const;
export const DuplicateCandidatesDetectedReason = z.enum(DUPLICATE_CANDIDATES_DETECTED_REASON);
export type DuplicateCandidatesDetectedReason = (typeof DUPLICATE_CANDIDATES_DETECTED_REASON)[number];
/** `duplicate_candidates.status` */
export const DUPLICATE_CANDIDATES_STATUS = ['open', 'not_duplicate', 'merged', 'escalated'] as const;
export const DuplicateCandidatesStatus = z.enum(DUPLICATE_CANDIDATES_STATUS);
export type DuplicateCandidatesStatus = (typeof DUPLICATE_CANDIDATES_STATUS)[number];
/** `buyer_supplier_relationships.status` */
export const BUYER_SUPPLIER_RELATIONSHIPS_STATUS = [
  'prospective',
  'active',
  'restricted',
  'suspended',
  'inactive',
] as const;
export const BuyerSupplierRelationshipsStatus = z.enum(BUYER_SUPPLIER_RELATIONSHIPS_STATUS);
export type BuyerSupplierRelationshipsStatus = (typeof BUYER_SUPPLIER_RELATIONSHIPS_STATUS)[number];
/** `buyer_supplier_relationships.risk_rating` */
export const BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING = ['low', 'medium', 'high', 'not_assessed'] as const;
export const BuyerSupplierRelationshipsRiskRating = z.enum(BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING);
export type BuyerSupplierRelationshipsRiskRating = (typeof BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING)[number];
/** `evidence_items.evidence_type` */
export const EVIDENCE_ITEMS_EVIDENCE_TYPE = [
  'registration',
  'financial_statement',
  'credit_report',
  'certificate',
  'insurance',
  'license',
  'reference',
  'declaration',
  'policy',
  'bond',
  'other',
] as const;
export const EvidenceItemsEvidenceType = z.enum(EVIDENCE_ITEMS_EVIDENCE_TYPE);
export type EvidenceItemsEvidenceType = (typeof EVIDENCE_ITEMS_EVIDENCE_TYPE)[number];
/** `evidence_items.status` */
export const EVIDENCE_ITEMS_STATUS = ['current', 'replaced', 'withdrawn', 'expired'] as const;
export const EvidenceItemsStatus = z.enum(EVIDENCE_ITEMS_STATUS);
export type EvidenceItemsStatus = (typeof EVIDENCE_ITEMS_STATUS)[number];
/** `evidence_items.verification_status` */
export const EVIDENCE_ITEMS_VERIFICATION_STATUS = [
  'supplier_provided',
  'independently_verified',
  'verification_failed',
] as const;
export const EvidenceItemsVerificationStatus = z.enum(EVIDENCE_ITEMS_VERIFICATION_STATUS);
export type EvidenceItemsVerificationStatus = (typeof EVIDENCE_ITEMS_VERIFICATION_STATUS)[number];
/** `evidence_items.sensitivity` */
export const EVIDENCE_ITEMS_SENSITIVITY = ['general', 'financial', 'commercially_sensitive'] as const;
export const EvidenceItemsSensitivity = z.enum(EVIDENCE_ITEMS_SENSITIVITY);
export type EvidenceItemsSensitivity = (typeof EVIDENCE_ITEMS_SENSITIVITY)[number];
/** `evidence_submissions.context_type` */
export const EVIDENCE_SUBMISSIONS_CONTEXT_TYPE = [
  'qualification_application',
  'bid_revision',
  'due_diligence',
  'contract_obligation',
] as const;
export const EvidenceSubmissionsContextType = z.enum(EVIDENCE_SUBMISSIONS_CONTEXT_TYPE);
export type EvidenceSubmissionsContextType = (typeof EVIDENCE_SUBMISSIONS_CONTEXT_TYPE)[number];
/** `qualification_programs.status` */
export const QUALIFICATION_PROGRAMS_STATUS = ['draft', 'active', 'retired'] as const;
export const QualificationProgramsStatus = z.enum(QUALIFICATION_PROGRAMS_STATUS);
export type QualificationProgramsStatus = (typeof QUALIFICATION_PROGRAMS_STATUS)[number];
/** `qualification_program_versions.status` */
export const QUALIFICATION_PROGRAM_VERSIONS_STATUS = ['draft', 'approved', 'retired'] as const;
export const QualificationProgramVersionsStatus = z.enum(QUALIFICATION_PROGRAM_VERSIONS_STATUS);
export type QualificationProgramVersionsStatus = (typeof QUALIFICATION_PROGRAM_VERSIONS_STATUS)[number];
/** `qualification_criteria.area` */
export const QUALIFICATION_CRITERIA_AREA = [
  'corporate',
  'financial',
  'capability',
  'quality',
  'insurance',
  'regulatory',
  'integrity',
  'social_environmental',
  'references',
] as const;
export const QualificationCriteriaArea = z.enum(QUALIFICATION_CRITERIA_AREA);
export type QualificationCriteriaArea = (typeof QUALIFICATION_CRITERIA_AREA)[number];
/** `qualification_criteria.response_type` */
export const QUALIFICATION_CRITERIA_RESPONSE_TYPE = ['text', 'yes_no', 'number', 'document', 'date'] as const;
export const QualificationCriteriaResponseType = z.enum(QUALIFICATION_CRITERIA_RESPONSE_TYPE);
export type QualificationCriteriaResponseType = (typeof QUALIFICATION_CRITERIA_RESPONSE_TYPE)[number];
/** `qualification_applications.status` */
export const QUALIFICATION_APPLICATIONS_STATUS = [
  'draft',
  'submitted',
  'under_review',
  'more_info_required',
  'decision_pending',
  'decided',
  'withdrawn',
] as const;
export const QualificationApplicationsStatus = z.enum(QUALIFICATION_APPLICATIONS_STATUS);
export type QualificationApplicationsStatus = (typeof QUALIFICATION_APPLICATIONS_STATUS)[number];
/** `qualification_applications.risk_level` */
export const QUALIFICATION_APPLICATIONS_RISK_LEVEL = ['low', 'medium', 'high'] as const;
export const QualificationApplicationsRiskLevel = z.enum(QUALIFICATION_APPLICATIONS_RISK_LEVEL);
export type QualificationApplicationsRiskLevel = (typeof QUALIFICATION_APPLICATIONS_RISK_LEVEL)[number];
/** `qualification_answers.applicability` */
export const QUALIFICATION_ANSWERS_APPLICABILITY = ['applicable', 'not_applicable'] as const;
export const QualificationAnswersApplicability = z.enum(QUALIFICATION_ANSWERS_APPLICABILITY);
export type QualificationAnswersApplicability = (typeof QUALIFICATION_ANSWERS_APPLICABILITY)[number];
/** `qualification_info_requests.status` */
export const QUALIFICATION_INFO_REQUESTS_STATUS = ['open', 'answered', 'closed'] as const;
export const QualificationInfoRequestsStatus = z.enum(QUALIFICATION_INFO_REQUESTS_STATUS);
export type QualificationInfoRequestsStatus = (typeof QUALIFICATION_INFO_REQUESTS_STATUS)[number];
/** `qualification_findings.finding` */
export const QUALIFICATION_FINDINGS_FINDING = [
  'meets',
  'does_not_meet',
  'clarification_needed',
  'not_applicable',
] as const;
export const QualificationFindingsFinding = z.enum(QUALIFICATION_FINDINGS_FINDING);
export type QualificationFindingsFinding = (typeof QUALIFICATION_FINDINGS_FINDING)[number];
/** `financial_reviews.conclusion` */
export const FINANCIAL_REVIEWS_CONCLUSION = [
  'adequate',
  'adequate_with_limitations',
  'inadequate',
  'unclear',
] as const;
export const FinancialReviewsConclusion = z.enum(FINANCIAL_REVIEWS_CONCLUSION);
export type FinancialReviewsConclusion = (typeof FINANCIAL_REVIEWS_CONCLUSION)[number];
/** `qualification_decisions.outcome` */
export const QUALIFICATION_DECISIONS_OUTCOME = [
  'qualified',
  'qualified_with_conditions',
  'not_qualified',
  'suspended',
  'expired',
  'withdrawn',
] as const;
export const QualificationDecisionsOutcome = z.enum(QUALIFICATION_DECISIONS_OUTCOME);
export type QualificationDecisionsOutcome = (typeof QUALIFICATION_DECISIONS_OUTCOME)[number];
/** `qualification_decisions.blocked_gate` */
export const QUALIFICATION_DECISIONS_BLOCKED_GATE = [
  'none',
  'invitation',
  'submission',
  'award',
  'contract_start',
] as const;
export const QualificationDecisionsBlockedGate = z.enum(QUALIFICATION_DECISIONS_BLOCKED_GATE);
export type QualificationDecisionsBlockedGate = (typeof QUALIFICATION_DECISIONS_BLOCKED_GATE)[number];
/** `reassessment_triggers.trigger_type` */
export const REASSESSMENT_TRIGGERS_TRIGGER_TYPE = [
  'evidence_expiry',
  'ownership_change',
  'financial_change',
  'insurance_expired',
  'adverse_finding',
  'poor_performance',
  'manual',
] as const;
export const ReassessmentTriggersTriggerType = z.enum(REASSESSMENT_TRIGGERS_TRIGGER_TYPE);
export type ReassessmentTriggersTriggerType = (typeof REASSESSMENT_TRIGGERS_TRIGGER_TYPE)[number];
/** `reassessment_triggers.status` */
export const REASSESSMENT_TRIGGERS_STATUS = ['open', 'assessed', 'action_taken', 'dismissed'] as const;
export const ReassessmentTriggersStatus = z.enum(REASSESSMENT_TRIGGERS_STATUS);
export type ReassessmentTriggersStatus = (typeof REASSESSMENT_TRIGGERS_STATUS)[number];
/** `integrity_screenings.check_type` */
export const INTEGRITY_SCREENINGS_CHECK_TYPE = [
  'sanctions',
  'debarment',
  'adverse_media',
  'registry',
] as const;
export const IntegrityScreeningsCheckType = z.enum(INTEGRITY_SCREENINGS_CHECK_TYPE);
export type IntegrityScreeningsCheckType = (typeof INTEGRITY_SCREENINGS_CHECK_TYPE)[number];
/** `integrity_screenings.result` */
export const INTEGRITY_SCREENINGS_RESULT = ['no_match', 'possible_match', 'confirmed_restriction'] as const;
export const IntegrityScreeningsResult = z.enum(INTEGRITY_SCREENINGS_RESULT);
export type IntegrityScreeningsResult = (typeof INTEGRITY_SCREENINGS_RESULT)[number];

// Migration 06 (requests_planning)
/** `procurement_projects.status` */
export const PROCUREMENT_PROJECTS_STATUS = ['planning', 'active', 'completed', 'cancelled'] as const;
export const ProcurementProjectsStatus = z.enum(PROCUREMENT_PROJECTS_STATUS);
export type ProcurementProjectsStatus = (typeof PROCUREMENT_PROJECTS_STATUS)[number];
/** `procurement_requests.need_type` */
export const PROCUREMENT_REQUESTS_NEED_TYPE = ['new_expenditure', 'replacement', 'extension'] as const;
export const ProcurementRequestsNeedType = z.enum(PROCUREMENT_REQUESTS_NEED_TYPE);
export type ProcurementRequestsNeedType = (typeof PROCUREMENT_REQUESTS_NEED_TYPE)[number];
/** `procurement_requests.funding_status` */
export const PROCUREMENT_REQUESTS_FUNDING_STATUS = [
  'none',
  'indicative',
  'approved_budget',
  'firm_commitment',
] as const;
export const ProcurementRequestsFundingStatus = z.enum(PROCUREMENT_REQUESTS_FUNDING_STATUS);
export type ProcurementRequestsFundingStatus = (typeof PROCUREMENT_REQUESTS_FUNDING_STATUS)[number];
/** `procurement_requests.priority` */
export const PROCUREMENT_REQUESTS_PRIORITY = ['low', 'normal', 'high', 'critical'] as const;
export const ProcurementRequestsPriority = z.enum(PROCUREMENT_REQUESTS_PRIORITY);
export type ProcurementRequestsPriority = (typeof PROCUREMENT_REQUESTS_PRIORITY)[number];
/** `procurement_requests.status` */
export const PROCUREMENT_REQUESTS_STATUS = [
  'draft',
  'submitted',
  'under_review',
  'information_requested',
  'approved',
  'rejected',
  'withdrawn',
  'deferred',
  'converted',
  'routed_to_existing',
  'rescinded',
  'closed',
] as const;
export const ProcurementRequestsStatus = z.enum(PROCUREMENT_REQUESTS_STATUS);
export type ProcurementRequestsStatus = (typeof PROCUREMENT_REQUESTS_STATUS)[number];
/** `request_links.link_type` */
export const REQUEST_LINKS_LINK_TYPE = [
  'combined_into',
  'split_into',
  'related_purchase',
  'option_of',
] as const;
export const RequestLinksLinkType = z.enum(REQUEST_LINKS_LINK_TYPE);
export type RequestLinksLinkType = (typeof REQUEST_LINKS_LINK_TYPE)[number];
/** `request_info_requests.status` */
export const REQUEST_INFO_REQUESTS_STATUS = ['open', 'answered', 'withdrawn'] as const;
export const RequestInfoRequestsStatus = z.enum(REQUEST_INFO_REQUESTS_STATUS);
export type RequestInfoRequestsStatus = (typeof REQUEST_INFO_REQUESTS_STATUS)[number];
/** `plan_items.status` */
export const PLAN_ITEMS_STATUS = [
  'planned',
  'scheduled',
  'in_progress',
  'released',
  'deferred',
  'cancelled',
] as const;
export const PlanItemsStatus = z.enum(PLAN_ITEMS_STATUS);
export type PlanItemsStatus = (typeof PLAN_ITEMS_STATUS)[number];
/** `advance_notices.status` */
export const ADVANCE_NOTICES_STATUS = ['draft', 'published', 'withdrawn'] as const;
export const AdvanceNoticesStatus = z.enum(ADVANCE_NOTICES_STATUS);
export type AdvanceNoticesStatus = (typeof ADVANCE_NOTICES_STATUS)[number];
/** `procurement_strategies.event_type` */
export const PROCUREMENT_STRATEGIES_EVENT_TYPE = ['rfi', 'rfq', 'rfp', 'tender'] as const;
export const ProcurementStrategiesEventType = z.enum(PROCUREMENT_STRATEGIES_EVENT_TYPE);
export type ProcurementStrategiesEventType = (typeof PROCUREMENT_STRATEGIES_EVENT_TYPE)[number];
/** `procurement_strategies.procedure` */
export const PROCUREMENT_STRATEGIES_PROCEDURE = [
  'rfi',
  'open',
  'restricted',
  'invitation_only',
  'multi_stage',
  'direct',
  'framework_calloff',
] as const;
export const ProcurementStrategiesProcedure = z.enum(PROCUREMENT_STRATEGIES_PROCEDURE);
export type ProcurementStrategiesProcedure = (typeof PROCUREMENT_STRATEGIES_PROCEDURE)[number];
/** `procurement_strategies.award_model` */
export const PROCUREMENT_STRATEGIES_AWARD_MODEL = ['single', 'per_lot', 'multiple'] as const;
export const ProcurementStrategiesAwardModel = z.enum(PROCUREMENT_STRATEGIES_AWARD_MODEL);
export type ProcurementStrategiesAwardModel = (typeof PROCUREMENT_STRATEGIES_AWARD_MODEL)[number];
/** `procurement_strategies.status` */
export const PROCUREMENT_STRATEGIES_STATUS = [
  'draft',
  'awaiting_approval',
  'approved',
  'returned',
  'superseded',
] as const;
export const ProcurementStrategiesStatus = z.enum(PROCUREMENT_STRATEGIES_STATUS);
export type ProcurementStrategiesStatus = (typeof PROCUREMENT_STRATEGIES_STATUS)[number];
/** `market_research_entries.source_type` */
export const MARKET_RESEARCH_ENTRIES_SOURCE_TYPE = [
  'supplier_consultation',
  'desk_research',
  'rfi_response',
  'price_benchmark',
  'other',
] as const;
export const MarketResearchEntriesSourceType = z.enum(MARKET_RESEARCH_ENTRIES_SOURCE_TYPE);
export type MarketResearchEntriesSourceType = (typeof MARKET_RESEARCH_ENTRIES_SOURCE_TYPE)[number];
/** `fairness_reviews.subject_type` */
export const FAIRNESS_REVIEWS_SUBJECT_TYPE = ['strategy', 'tender'] as const;
export const FairnessReviewsSubjectType = z.enum(FAIRNESS_REVIEWS_SUBJECT_TYPE);
export type FairnessReviewsSubjectType = (typeof FAIRNESS_REVIEWS_SUBJECT_TYPE)[number];
/** `fairness_reviews.outcome` */
export const FAIRNESS_REVIEWS_OUTCOME = [
  'pending',
  'no_issue',
  'mitigated',
  'excluded_from_drafting',
] as const;
export const FairnessReviewsOutcome = z.enum(FAIRNESS_REVIEWS_OUTCOME);
export type FairnessReviewsOutcome = (typeof FAIRNESS_REVIEWS_OUTCOME)[number];

// Migration 07 (tenders)
/** `tenders.event_type` */
export const TENDERS_EVENT_TYPE = ['rfi', 'rfq', 'rfp', 'tender'] as const;
export const TendersEventType = z.enum(TENDERS_EVENT_TYPE);
export type TendersEventType = (typeof TENDERS_EVENT_TYPE)[number];
/** `tenders.participation` */
export const TENDERS_PARTICIPATION = ['open', 'invitation_only', 'restricted'] as const;
export const TendersParticipation = z.enum(TENDERS_PARTICIPATION);
export type TendersParticipation = (typeof TENDERS_PARTICIPATION)[number];
/** `tenders.award_model` */
export const TENDERS_AWARD_MODEL = ['single', 'per_lot', 'multiple'] as const;
export const TendersAwardModel = z.enum(TENDERS_AWARD_MODEL);
export type TendersAwardModel = (typeof TENDERS_AWARD_MODEL)[number];
/** `tenders.opening_mode` */
export const TENDERS_OPENING_MODE = ['single_stage', 'staged'] as const;
export const TendersOpeningMode = z.enum(TENDERS_OPENING_MODE);
export type TendersOpeningMode = (typeof TENDERS_OPENING_MODE)[number];
/** `tenders.status` */
export const TENDERS_STATUS = [
  'draft',
  'awaiting_release_approval',
  'ready',
  'open',
  'closed',
  'under_assessment',
  'award_pending',
  'awarded',
  'partially_awarded',
  'completed_without_award',
  'information_collected',
  'cancelled',
  'archived',
] as const;
export const TendersStatus = z.enum(TENDERS_STATUS);
export type TendersStatus = (typeof TENDERS_STATUS)[number];
/** `tenders.link_type` */
export const TENDERS_LINK_TYPE = ['next_stage', 're_tender', 'follow_on', 'from_rfi'] as const;
export const TendersLinkType = z.enum(TENDERS_LINK_TYPE);
export type TendersLinkType = (typeof TENDERS_LINK_TYPE)[number];
/** `tender_milestones.milestone` */
export const TENDER_MILESTONES_MILESTONE = [
  'questions_deadline',
  'briefing',
  'site_visit',
  'submission_deadline',
  'opening',
  'clarification_deadline',
  'expected_award',
  'standstill_end',
  'contract_start',
] as const;
export const TenderMilestonesMilestone = z.enum(TENDER_MILESTONES_MILESTONE);
export type TenderMilestonesMilestone = (typeof TENDER_MILESTONES_MILESTONE)[number];
/** `lots.stage` */
export const LOTS_STAGE = [
  'draft',
  'open',
  'closed',
  'under_assessment',
  'award_pending',
  'awarded',
  'no_award',
  'cancelled',
] as const;
export const LotsStage = z.enum(LOTS_STAGE);
export type LotsStage = (typeof LOTS_STAGE)[number];
/** `tender_team_members.team_role` */
export const TENDER_TEAM_MEMBERS_TEAM_ROLE = [
  'owner',
  'officer',
  'evaluator',
  'evaluation_chair',
  'commercial_reviewer',
  'opening_officer',
  'witness',
  'legal_reviewer',
  'finance_reviewer',
  'observer',
  'auditor',
] as const;
export const TenderTeamMembersTeamRole = z.enum(TENDER_TEAM_MEMBERS_TEAM_ROLE);
export type TenderTeamMembersTeamRole = (typeof TENDER_TEAM_MEMBERS_TEAM_ROLE)[number];
/** `requirements.response_type` */
export const REQUIREMENTS_RESPONSE_TYPE = [
  'text',
  'yes_no',
  'number',
  'document',
  'choice',
  'quantity',
] as const;
export const RequirementsResponseType = z.enum(REQUIREMENTS_RESPONSE_TYPE);
export type RequirementsResponseType = (typeof REQUIREMENTS_RESPONSE_TYPE)[number];
/** `requirements.treatment` */
export const REQUIREMENTS_TREATMENT = ['mandatory_gate', 'rated', 'information_only'] as const;
export const RequirementsTreatment = z.enum(REQUIREMENTS_TREATMENT);
export type RequirementsTreatment = (typeof REQUIREMENTS_TREATMENT)[number];
/** `requirements.envelope` */
export const REQUIREMENTS_ENVELOPE = ['qualification', 'technical', 'commercial'] as const;
export const RequirementsEnvelope = z.enum(REQUIREMENTS_ENVELOPE);
export type RequirementsEnvelope = (typeof REQUIREMENTS_ENVELOPE)[number];
/** `requirements.missing_consequence` */
export const REQUIREMENTS_MISSING_CONSEQUENCE = ['reject', 'clarify', 'warning'] as const;
export const RequirementsMissingConsequence = z.enum(REQUIREMENTS_MISSING_CONSEQUENCE);
export type RequirementsMissingConsequence = (typeof REQUIREMENTS_MISSING_CONSEQUENCE)[number];
/** `pricing_items.charge_type` */
export const PRICING_ITEMS_CHARGE_TYPE = ['one_time', 'recurring'] as const;
export const PricingItemsChargeType = z.enum(PRICING_ITEMS_CHARGE_TYPE);
export type PricingItemsChargeType = (typeof PRICING_ITEMS_CHARGE_TYPE)[number];
/** `pricing_items.recurrence` */
export const PRICING_ITEMS_RECURRENCE = ['monthly', 'quarterly', 'annual'] as const;
export const PricingItemsRecurrence = z.enum(PRICING_ITEMS_RECURRENCE);
export type PricingItemsRecurrence = (typeof PRICING_ITEMS_RECURRENCE)[number];
/** `tender_terms.term_type` */
export const TENDER_TERMS_TERM_TYPE = [
  'draft_contract',
  'insurance',
  'security',
  'confidentiality',
  'complaint_process',
  'payment',
  'document_precedence',
  'other',
] as const;
export const TenderTermsTermType = z.enum(TENDER_TERMS_TERM_TYPE);
export type TenderTermsTermType = (typeof TENDER_TERMS_TERM_TYPE)[number];
/** `tender_envelopes.envelope` */
export const TENDER_ENVELOPES_ENVELOPE = ['qualification', 'technical', 'commercial'] as const;
export const TenderEnvelopesEnvelope = z.enum(TENDER_ENVELOPES_ENVELOPE);
export type TenderEnvelopesEnvelope = (typeof TENDER_ENVELOPES_ENVELOPE)[number];
/** `participation_conditions.condition_type` */
export const PARTICIPATION_CONDITIONS_CONDITION_TYPE = [
  'confidentiality_undertaking',
  'qualification_required',
  'mandatory_briefing',
  'registration',
  'eligibility_review',
] as const;
export const ParticipationConditionsConditionType = z.enum(PARTICIPATION_CONDITIONS_CONDITION_TYPE);
export type ParticipationConditionsConditionType = (typeof PARTICIPATION_CONDITIONS_CONDITION_TYPE)[number];
/** `evaluation_plans.status` */
export const EVALUATION_PLANS_STATUS = ['draft', 'approved', 'amended'] as const;
export const EvaluationPlansStatus = z.enum(EVALUATION_PLANS_STATUS);
export type EvaluationPlansStatus = (typeof EVALUATION_PLANS_STATUS)[number];
/** `evaluation_plans.aggregation_method` */
export const EVALUATION_PLANS_AGGREGATION_METHOD = ['consensus', 'average', 'weighted_assessor'] as const;
export const EvaluationPlansAggregationMethod = z.enum(EVALUATION_PLANS_AGGREGATION_METHOD);
export type EvaluationPlansAggregationMethod = (typeof EVALUATION_PLANS_AGGREGATION_METHOD)[number];
/** `evaluation_plans.price_method` */
export const EVALUATION_PLANS_PRICE_METHOD = ['lowest_ratio', 'linear_deduction', 'none'] as const;
export const EvaluationPlansPriceMethod = z.enum(EVALUATION_PLANS_PRICE_METHOD);
export type EvaluationPlansPriceMethod = (typeof EVALUATION_PLANS_PRICE_METHOD)[number];
/** `evaluation_plans.threshold_scope` */
export const EVALUATION_PLANS_THRESHOLD_SCOPE = [
  'criterion',
  'section',
  'non_price_total',
  'combined',
  'none',
] as const;
export const EvaluationPlansThresholdScope = z.enum(EVALUATION_PLANS_THRESHOLD_SCOPE);
export type EvaluationPlansThresholdScope = (typeof EVALUATION_PLANS_THRESHOLD_SCOPE)[number];
/** `evaluation_criteria.envelope` */
export const EVALUATION_CRITERIA_ENVELOPE = ['qualification', 'technical', 'commercial'] as const;
export const EvaluationCriteriaEnvelope = z.enum(EVALUATION_CRITERIA_ENVELOPE);
export type EvaluationCriteriaEnvelope = (typeof EVALUATION_CRITERIA_ENVELOPE)[number];
/** `tie_break_rules.rule` */
export const TIE_BREAK_RULES_RULE = [
  'highest_non_price',
  'lowest_evaluated_cost',
  'highest_criterion',
  'earliest_receipt',
  'committee_decision',
] as const;
export const TieBreakRulesRule = z.enum(TIE_BREAK_RULES_RULE);
export type TieBreakRulesRule = (typeof TIE_BREAK_RULES_RULE)[number];
/** `release_checks.check_area` */
export const RELEASE_CHECKS_CHECK_AREA = [
  'scope',
  'funding',
  'terms',
  'evaluation_readiness',
  'dates',
  'accessibility',
  'languages',
  'supplier_burden',
  'permissions',
  'approval_authority',
] as const;
export const ReleaseChecksCheckArea = z.enum(RELEASE_CHECKS_CHECK_AREA);
export type ReleaseChecksCheckArea = (typeof RELEASE_CHECKS_CHECK_AREA)[number];
/** `release_checks.status` */
export const RELEASE_CHECKS_STATUS = ['pending', 'passed', 'failed', 'not_applicable'] as const;
export const ReleaseChecksStatus = z.enum(RELEASE_CHECKS_STATUS);
export type ReleaseChecksStatus = (typeof RELEASE_CHECKS_STATUS)[number];
/** `publications.channel` */
export const PUBLICATIONS_CHANNEL = ['portal', 'external_notice'] as const;
export const PublicationsChannel = z.enum(PUBLICATIONS_CHANNEL);
export type PublicationsChannel = (typeof PUBLICATIONS_CHANNEL)[number];
/** `publications.status` */
export const PUBLICATIONS_STATUS = [
  'scheduled',
  'published',
  'failed',
  'awaiting_confirmation',
  'confirmed',
  'withdrawn',
] as const;
export const PublicationsStatus = z.enum(PUBLICATIONS_STATUS);
export type PublicationsStatus = (typeof PUBLICATIONS_STATUS)[number];

// Migration 08 (participation_clarifications)
/** `participants.source` */
export const PARTICIPANTS_SOURCE = [
  'invited',
  'registered_interest',
  'access_request',
  'shortlisted',
  'next_stage',
] as const;
export const ParticipantsSource = z.enum(PARTICIPANTS_SOURCE);
export type ParticipantsSource = (typeof PARTICIPANTS_SOURCE)[number];
/** `participants.invitation_status` */
export const PARTICIPANTS_INVITATION_STATUS = [
  'not_invited',
  'invited',
  'accepted',
  'declined',
  'expired',
] as const;
export const ParticipantsInvitationStatus = z.enum(PARTICIPANTS_INVITATION_STATUS);
export type ParticipantsInvitationStatus = (typeof PARTICIPANTS_INVITATION_STATUS)[number];
/** `participants.access_status` */
export const PARTICIPANTS_ACCESS_STATUS = ['not_required', 'requested', 'granted', 'denied'] as const;
export const ParticipantsAccessStatus = z.enum(PARTICIPANTS_ACCESS_STATUS);
export type ParticipantsAccessStatus = (typeof PARTICIPANTS_ACCESS_STATUS)[number];
/** `participants.bid_intent` */
export const PARTICIPANTS_BID_INTENT = ['undecided', 'intends_to_bid', 'no_bid'] as const;
export const ParticipantsBidIntent = z.enum(PARTICIPANTS_BID_INTENT);
export type ParticipantsBidIntent = (typeof PARTICIPANTS_BID_INTENT)[number];
/** `participants.qualification_gate` */
export const PARTICIPANTS_QUALIFICATION_GATE = ['not_required', 'met', 'not_met', 'pending'] as const;
export const ParticipantsQualificationGate = z.enum(PARTICIPANTS_QUALIFICATION_GATE);
export type ParticipantsQualificationGate = (typeof PARTICIPANTS_QUALIFICATION_GATE)[number];
/** `participant_acknowledgments.subject_type` */
export const PARTICIPANT_ACKNOWLEDGMENTS_SUBJECT_TYPE = [
  'addendum',
  'participation_condition',
  'tender_version',
  'notice',
] as const;
export const ParticipantAcknowledgmentsSubjectType = z.enum(PARTICIPANT_ACKNOWLEDGMENTS_SUBJECT_TYPE);
export type ParticipantAcknowledgmentsSubjectType = (typeof PARTICIPANT_ACKNOWLEDGMENTS_SUBJECT_TYPE)[number];
/** `pursuits.decision` */
export const PURSUITS_DECISION = ['undecided', 'bid', 'no_bid'] as const;
export const PursuitsDecision = z.enum(PURSUITS_DECISION);
export type PursuitsDecision = (typeof PURSUITS_DECISION)[number];
/** `pursuit_team_members.responsibility` */
export const PURSUIT_TEAM_MEMBERS_RESPONSIBILITY = [
  'bid_manager',
  'contributor',
  'commercial_contributor',
  'reviewer',
  'approver',
  'signatory',
] as const;
export const PursuitTeamMembersResponsibility = z.enum(PURSUIT_TEAM_MEMBERS_RESPONSIBILITY);
export type PursuitTeamMembersResponsibility = (typeof PURSUIT_TEAM_MEMBERS_RESPONSIBILITY)[number];
/** `questions.late_disposition` */
export const QUESTIONS_LATE_DISPOSITION = ['accepted', 'declined'] as const;
export const QuestionsLateDisposition = z.enum(QUESTIONS_LATE_DISPOSITION);
export type QuestionsLateDisposition = (typeof QUESTIONS_LATE_DISPOSITION)[number];
/** `questions.status` */
export const QUESTIONS_STATUS = [
  'received',
  'assigned',
  'draft_answer',
  'in_review',
  'published',
  'answered_privately',
  'escalated_to_addendum',
  'declined',
  'withdrawn',
] as const;
export const QuestionsStatus = z.enum(QUESTIONS_STATUS);
export type QuestionsStatus = (typeof QUESTIONS_STATUS)[number];
/** `questions.audience` */
export const QUESTIONS_AUDIENCE = ['all_participants', 'public', 'private'] as const;
export const QuestionsAudience = z.enum(QUESTIONS_AUDIENCE);
export type QuestionsAudience = (typeof QUESTIONS_AUDIENCE)[number];
/** `addenda.materiality` */
export const ADDENDA_MATERIALITY = ['material', 'non_material'] as const;
export const AddendaMateriality = z.enum(ADDENDA_MATERIALITY);
export type AddendaMateriality = (typeof ADDENDA_MATERIALITY)[number];
/** `addenda.existing_submission_action` */
export const ADDENDA_EXISTING_SUBMISSION_ACTION = ['none', 'acknowledge', 'supplement', 'replace'] as const;
export const AddendaExistingSubmissionAction = z.enum(ADDENDA_EXISTING_SUBMISSION_ACTION);
export type AddendaExistingSubmissionAction = (typeof ADDENDA_EXISTING_SUBMISSION_ACTION)[number];
/** `addenda.status` */
export const ADDENDA_STATUS = ['draft', 'awaiting_approval', 'approved', 'issued', 'withdrawn'] as const;
export const AddendaStatus = z.enum(ADDENDA_STATUS);
export type AddendaStatus = (typeof ADDENDA_STATUS)[number];
/** `addendum_requirement_changes.change_type` */
export const ADDENDUM_REQUIREMENT_CHANGES_CHANGE_TYPE = ['added', 'modified', 'removed'] as const;
export const AddendumRequirementChangesChangeType = z.enum(ADDENDUM_REQUIREMENT_CHANGES_CHANGE_TYPE);
export type AddendumRequirementChangesChangeType = (typeof ADDENDUM_REQUIREMENT_CHANGES_CHANGE_TYPE)[number];
/** `sessions.session_type` */
export const SESSIONS_SESSION_TYPE = ['briefing', 'site_visit'] as const;
export const SessionsSessionType = z.enum(SESSIONS_SESSION_TYPE);
export type SessionsSessionType = (typeof SESSIONS_SESSION_TYPE)[number];
/** `sessions.status` */
export const SESSIONS_STATUS = ['scheduled', 'completed', 'cancelled'] as const;
export const SessionsStatus = z.enum(SESSIONS_STATUS);
export type SessionsStatus = (typeof SESSIONS_STATUS)[number];
/** `session_registrations.status` */
export const SESSION_REGISTRATIONS_STATUS = ['registered', 'cancelled', 'attended', 'absent'] as const;
export const SessionRegistrationsStatus = z.enum(SESSION_REGISTRATIONS_STATUS);
export type SessionRegistrationsStatus = (typeof SESSION_REGISTRATIONS_STATUS)[number];

// Migration 09 (bids)
/** `bids.submission_state` */
export const BIDS_SUBMISSION_STATE = ['not_submitted', 'submitted', 'withdrawn'] as const;
export const BidsSubmissionState = z.enum(BIDS_SUBMISSION_STATE);
export type BidsSubmissionState = (typeof BIDS_SUBMISSION_STATE)[number];
/** `bids.compliance_status` */
export const BIDS_COMPLIANCE_STATUS = [
  'pending',
  'compliant',
  'non_compliant',
  'clarification_pending',
  'excluded',
] as const;
export const BidsComplianceStatus = z.enum(BIDS_COMPLIANCE_STATUS);
export type BidsComplianceStatus = (typeof BIDS_COMPLIANCE_STATUS)[number];
/** `bids.evaluation_status` */
export const BIDS_EVALUATION_STATUS = ['not_started', 'in_evaluation', 'evaluated', 'excluded'] as const;
export const BidsEvaluationStatus = z.enum(BIDS_EVALUATION_STATUS);
export type BidsEvaluationStatus = (typeof BIDS_EVALUATION_STATUS)[number];
/** `bids.round_type` */
export const BIDS_ROUND_TYPE = ['initial', 'next_stage', 'bafo'] as const;
export const BidsRoundType = z.enum(BIDS_ROUND_TYPE);
export type BidsRoundType = (typeof BIDS_ROUND_TYPE)[number];
/** `bid_revisions.status` */
export const BID_REVISIONS_STATUS = [
  'draft',
  'internal_review',
  'approved_internally',
  'submitted',
  'superseded',
  'withdrawn',
  'late_rejected',
  'submission_failed',
] as const;
export const BidRevisionsStatus = z.enum(BID_REVISIONS_STATUS);
export type BidRevisionsStatus = (typeof BID_REVISIONS_STATUS)[number];
/** `bid_answers.envelope` */
export const BID_ANSWERS_ENVELOPE = ['qualification', 'technical', 'commercial'] as const;
export const BidAnswersEnvelope = z.enum(BID_ANSWERS_ENVELOPE);
export type BidAnswersEnvelope = (typeof BID_ANSWERS_ENVELOPE)[number];
/** `bid_answers.progress` */
export const BID_ANSWERS_PROGRESS = ['not_started', 'in_progress', 'ready_for_review', 'complete'] as const;
export const BidAnswersProgress = z.enum(BID_ANSWERS_PROGRESS);
export type BidAnswersProgress = (typeof BID_ANSWERS_PROGRESS)[number];
/** `bid_prices.price_status` */
export const BID_PRICES_PRICE_STATUS = ['priced', 'included', 'not_offered'] as const;
export const BidPricesPriceStatus = z.enum(BID_PRICES_PRICE_STATUS);
export type BidPricesPriceStatus = (typeof BID_PRICES_PRICE_STATUS)[number];
/** `bid_declarations.declaration_type` */
export const BID_DECLARATIONS_DECLARATION_TYPE = [
  'authority_to_bid',
  'eligibility',
  'no_conflict',
  'no_collusion',
  'bid_validity',
  'terms_acceptance',
  'other',
] as const;
export const BidDeclarationsDeclarationType = z.enum(BID_DECLARATIONS_DECLARATION_TYPE);
export type BidDeclarationsDeclarationType = (typeof BID_DECLARATIONS_DECLARATION_TYPE)[number];
/** `bid_internal_approvals.approval_type` */
export const BID_INTERNAL_APPROVALS_APPROVAL_TYPE = [
  'commercial',
  'financial',
  'delivery',
  'executive',
] as const;
export const BidInternalApprovalsApprovalType = z.enum(BID_INTERNAL_APPROVALS_APPROVAL_TYPE);
export type BidInternalApprovalsApprovalType = (typeof BID_INTERNAL_APPROVALS_APPROVAL_TYPE)[number];
/** `bid_internal_approvals.status` */
export const BID_INTERNAL_APPROVALS_STATUS = [
  'pending',
  'approved',
  'rejected',
  'returned',
  'invalidated',
] as const;
export const BidInternalApprovalsStatus = z.enum(BID_INTERNAL_APPROVALS_STATUS);
export type BidInternalApprovalsStatus = (typeof BID_INTERNAL_APPROVALS_STATUS)[number];
/** `submission_attempts.outcome` */
export const SUBMISSION_ATTEMPTS_OUTCOME = [
  'succeeded',
  'failed_validation',
  'failed_late',
  'failed_authority',
  'failed_error',
] as const;
export const SubmissionAttemptsOutcome = z.enum(SUBMISSION_ATTEMPTS_OUTCOME);
export type SubmissionAttemptsOutcome = (typeof SUBMISSION_ATTEMPTS_OUTCOME)[number];
/** `submission_receipts.status` */
export const SUBMISSION_RECEIPTS_STATUS = [
  'received',
  'superseded',
  'withdrawn',
  'late_rejected',
  'selected_for_evaluation',
] as const;
export const SubmissionReceiptsStatus = z.enum(SUBMISSION_RECEIPTS_STATUS);
export type SubmissionReceiptsStatus = (typeof SUBMISSION_RECEIPTS_STATUS)[number];
/** `receipt_inventory_items.envelope` */
export const RECEIPT_INVENTORY_ITEMS_ENVELOPE = ['qualification', 'technical', 'commercial'] as const;
export const ReceiptInventoryItemsEnvelope = z.enum(RECEIPT_INVENTORY_ITEMS_ENVELOPE);
export type ReceiptInventoryItemsEnvelope = (typeof RECEIPT_INVENTORY_ITEMS_ENVELOPE)[number];
/** `late_submission_exceptions.decision` */
export const LATE_SUBMISSION_EXCEPTIONS_DECISION = ['pending', 'accepted', 'rejected'] as const;
export const LateSubmissionExceptionsDecision = z.enum(LATE_SUBMISSION_EXCEPTIONS_DECISION);
export type LateSubmissionExceptionsDecision = (typeof LATE_SUBMISSION_EXCEPTIONS_DECISION)[number];

// Migration 10 (opening_evaluation)
/** `opening_sessions.envelope` */
export const OPENING_SESSIONS_ENVELOPE = ['all', 'qualification', 'technical', 'commercial'] as const;
export const OpeningSessionsEnvelope = z.enum(OPENING_SESSIONS_ENVELOPE);
export type OpeningSessionsEnvelope = (typeof OPENING_SESSIONS_ENVELOPE)[number];
/** `opening_sessions.status` */
export const OPENING_SESSIONS_STATUS = ['scheduled', 'awaiting_quorum', 'completed', 'aborted'] as const;
export const OpeningSessionsStatus = z.enum(OPENING_SESSIONS_STATUS);
export type OpeningSessionsStatus = (typeof OPENING_SESSIONS_STATUS)[number];
/** `opening_participants.role` */
export const OPENING_PARTICIPANTS_ROLE = [
  'opening_officer',
  'witness',
  'committee_member',
  'observer',
] as const;
export const OpeningParticipantsRole = z.enum(OPENING_PARTICIPANTS_ROLE);
export type OpeningParticipantsRole = (typeof OPENING_PARTICIPANTS_ROLE)[number];
/** `compliance_checks.check_type` */
export const COMPLIANCE_CHECKS_CHECK_TYPE = [
  'timeliness',
  'declarations',
  'required_documents',
  'eligibility',
  'mandatory_requirement',
  'attendance',
  'acknowledgments',
  'securities',
  'lot_restrictions',
  'qualification_status',
] as const;
export const ComplianceChecksCheckType = z.enum(COMPLIANCE_CHECKS_CHECK_TYPE);
export type ComplianceChecksCheckType = (typeof COMPLIANCE_CHECKS_CHECK_TYPE)[number];
/** `compliance_checks.finding_class` */
export const COMPLIANCE_CHECKS_FINDING_CLASS = [
  'administrative_omission',
  'substantive_noncompliance',
  'clarifiable',
  'none',
] as const;
export const ComplianceChecksFindingClass = z.enum(COMPLIANCE_CHECKS_FINDING_CLASS);
export type ComplianceChecksFindingClass = (typeof COMPLIANCE_CHECKS_FINDING_CLASS)[number];
/** `compliance_checks.result` */
export const COMPLIANCE_CHECKS_RESULT = [
  'pending',
  'pass',
  'fail',
  'clarification_required',
  'not_applicable',
] as const;
export const ComplianceChecksResult = z.enum(COMPLIANCE_CHECKS_RESULT);
export type ComplianceChecksResult = (typeof COMPLIANCE_CHECKS_RESULT)[number];
/** `bid_clarifications.source` */
export const BID_CLARIFICATIONS_SOURCE = [
  'compliance',
  'evaluation',
  'presentation',
  'reference',
  'due_diligence',
] as const;
export const BidClarificationsSource = z.enum(BID_CLARIFICATIONS_SOURCE);
export type BidClarificationsSource = (typeof BID_CLARIFICATIONS_SOURCE)[number];
/** `bid_clarifications.status` */
export const BID_CLARIFICATIONS_STATUS = [
  'draft',
  'approved',
  'issued',
  'responded',
  'closed',
  'expired',
] as const;
export const BidClarificationsStatus = z.enum(BID_CLARIFICATIONS_STATUS);
export type BidClarificationsStatus = (typeof BID_CLARIFICATIONS_STATUS)[number];
/** `bid_clarifications.effect` */
export const BID_CLARIFICATIONS_EFFECT = ['resolved', 'not_resolved', 'no_effect'] as const;
export const BidClarificationsEffect = z.enum(BID_CLARIFICATIONS_EFFECT);
export type BidClarificationsEffect = (typeof BID_CLARIFICATIONS_EFFECT)[number];
/** `exclusions.status` */
export const EXCLUSIONS_STATUS = [
  'proposed',
  'awaiting_approval',
  'approved',
  'rejected',
  'withdrawn',
] as const;
export const ExclusionsStatus = z.enum(EXCLUSIONS_STATUS);
export type ExclusionsStatus = (typeof EXCLUSIONS_STATUS)[number];
/** `evaluation_assignments.status` */
export const EVALUATION_ASSIGNMENTS_STATUS = [
  'not_started',
  'in_progress',
  'submitted',
  'returned',
  'finalized',
  'recused',
  'reassigned',
] as const;
export const EvaluationAssignmentsStatus = z.enum(EVALUATION_ASSIGNMENTS_STATUS);
export type EvaluationAssignmentsStatus = (typeof EVALUATION_ASSIGNMENTS_STATUS)[number];
/** `evaluation_scores.status` */
export const EVALUATION_SCORES_STATUS = ['draft', 'submitted'] as const;
export const EvaluationScoresStatus = z.enum(EVALUATION_SCORES_STATUS);
export type EvaluationScoresStatus = (typeof EVALUATION_SCORES_STATUS)[number];
/** `moderation_sessions.method` */
export const MODERATION_SESSIONS_METHOD = ['consensus', 'average', 'weighted_assessor'] as const;
export const ModerationSessionsMethod = z.enum(MODERATION_SESSIONS_METHOD);
export type ModerationSessionsMethod = (typeof MODERATION_SESSIONS_METHOD)[number];
/** `moderation_sessions.status` */
export const MODERATION_SESSIONS_STATUS = ['open', 'finalized'] as const;
export const ModerationSessionsStatus = z.enum(MODERATION_SESSIONS_STATUS);
export type ModerationSessionsStatus = (typeof MODERATION_SESSIONS_STATUS)[number];
/** `commercial_evaluations.affordability` */
export const COMMERCIAL_EVALUATIONS_AFFORDABILITY = [
  'within_budget',
  'exceeds_budget',
  'not_assessed',
] as const;
export const CommercialEvaluationsAffordability = z.enum(COMMERCIAL_EVALUATIONS_AFFORDABILITY);
export type CommercialEvaluationsAffordability = (typeof COMMERCIAL_EVALUATIONS_AFFORDABILITY)[number];
/** `commercial_evaluations.status` */
export const COMMERCIAL_EVALUATIONS_STATUS = ['draft', 'approved'] as const;
export const CommercialEvaluationsStatus = z.enum(COMMERCIAL_EVALUATIONS_STATUS);
export type CommercialEvaluationsStatus = (typeof COMMERCIAL_EVALUATIONS_STATUS)[number];
/** `evaluation_results.status` */
export const EVALUATION_RESULTS_STATUS = ['draft', 'signed_off', 'superseded'] as const;
export const EvaluationResultsStatus = z.enum(EVALUATION_RESULTS_STATUS);
export type EvaluationResultsStatus = (typeof EVALUATION_RESULTS_STATUS)[number];
/** `evaluation_reports.status` */
export const EVALUATION_REPORTS_STATUS = ['draft', 'in_signoff', 'signed_off', 'superseded'] as const;
export const EvaluationReportsStatus = z.enum(EVALUATION_REPORTS_STATUS);
export type EvaluationReportsStatus = (typeof EVALUATION_REPORTS_STATUS)[number];
/** `evaluation_report_signoffs.decision` */
export const EVALUATION_REPORT_SIGNOFFS_DECISION = ['signed', 'declined'] as const;
export const EvaluationReportSignoffsDecision = z.enum(EVALUATION_REPORT_SIGNOFFS_DECISION);
export type EvaluationReportSignoffsDecision = (typeof EVALUATION_REPORT_SIGNOFFS_DECISION)[number];

// Migration 11 (selection_award)
/** `assessment_sessions.session_type` */
export const ASSESSMENT_SESSIONS_SESSION_TYPE = [
  'demonstration',
  'interview',
  'presentation',
  'sample',
  'site_inspection',
  'reference_check',
] as const;
export const AssessmentSessionsSessionType = z.enum(ASSESSMENT_SESSIONS_SESSION_TYPE);
export type AssessmentSessionsSessionType = (typeof ASSESSMENT_SESSIONS_SESSION_TYPE)[number];
/** `assessment_sessions.assessment_basis` */
export const ASSESSMENT_SESSIONS_ASSESSMENT_BASIS = [
  'scored_criterion',
  'claim_verification',
  'eligibility_gate',
] as const;
export const AssessmentSessionsAssessmentBasis = z.enum(ASSESSMENT_SESSIONS_ASSESSMENT_BASIS);
export type AssessmentSessionsAssessmentBasis = (typeof ASSESSMENT_SESSIONS_ASSESSMENT_BASIS)[number];
/** `assessment_sessions.status` */
export const ASSESSMENT_SESSIONS_STATUS = ['planned', 'scheduled', 'completed', 'cancelled'] as const;
export const AssessmentSessionsStatus = z.enum(ASSESSMENT_SESSIONS_STATUS);
export type AssessmentSessionsStatus = (typeof ASSESSMENT_SESSIONS_STATUS)[number];
/** `assessment_invites.status` */
export const ASSESSMENT_INVITES_STATUS = ['invited', 'confirmed', 'declined', 'attended', 'no_show'] as const;
export const AssessmentInvitesStatus = z.enum(ASSESSMENT_INVITES_STATUS);
export type AssessmentInvitesStatus = (typeof ASSESSMENT_INVITES_STATUS)[number];
/** `assessment_findings.effect` */
export const ASSESSMENT_FINDINGS_EFFECT = [
  'score_input',
  'claim_verified',
  'claim_not_verified',
  'gate_passed',
  'gate_failed',
] as const;
export const AssessmentFindingsEffect = z.enum(ASSESSMENT_FINDINGS_EFFECT);
export type AssessmentFindingsEffect = (typeof ASSESSMENT_FINDINGS_EFFECT)[number];
/** `shortlists.status` */
export const SHORTLISTS_STATUS = ['draft', 'awaiting_approval', 'approved', 'changed'] as const;
export const ShortlistsStatus = z.enum(SHORTLISTS_STATUS);
export type ShortlistsStatus = (typeof SHORTLISTS_STATUS)[number];
/** `preferred_bidders.status` */
export const PREFERRED_BIDDERS_STATUS = [
  'proposed',
  'awaiting_approval',
  'approved',
  'withdrawn',
  'failed_diligence',
  'superseded',
  'converted_to_award',
] as const;
export const PreferredBiddersStatus = z.enum(PREFERRED_BIDDERS_STATUS);
export type PreferredBiddersStatus = (typeof PREFERRED_BIDDERS_STATUS)[number];
/** `due_diligence_cases.status` */
export const DUE_DILIGENCE_CASES_STATUS = ['open', 'ready_for_decision', 'passed', 'failed'] as const;
export const DueDiligenceCasesStatus = z.enum(DUE_DILIGENCE_CASES_STATUS);
export type DueDiligenceCasesStatus = (typeof DUE_DILIGENCE_CASES_STATUS)[number];
/** `due_diligence_findings.area` */
export const DUE_DILIGENCE_FINDINGS_AREA = [
  'financial',
  'capacity',
  'references',
  'insurance',
  'licenses',
  'restrictions',
  'ownership',
  'key_personnel',
  'subcontractors',
  'contract_exceptions',
  'security',
] as const;
export const DueDiligenceFindingsArea = z.enum(DUE_DILIGENCE_FINDINGS_AREA);
export type DueDiligenceFindingsArea = (typeof DUE_DILIGENCE_FINDINGS_AREA)[number];
/** `due_diligence_findings.disposition` */
export const DUE_DILIGENCE_FINDINGS_DISPOSITION = ['satisfied', 'condition', 'unresolved', 'failed'] as const;
export const DueDiligenceFindingsDisposition = z.enum(DUE_DILIGENCE_FINDINGS_DISPOSITION);
export type DueDiligenceFindingsDisposition = (typeof DUE_DILIGENCE_FINDINGS_DISPOSITION)[number];
/** `negotiations.status` */
export const NEGOTIATIONS_STATUS = ['planned', 'awaiting_mandate', 'active', 'concluded', 'aborted'] as const;
export const NegotiationsStatus = z.enum(NEGOTIATIONS_STATUS);
export type NegotiationsStatus = (typeof NEGOTIATIONS_STATUS)[number];
/** `final_offer_rounds.status` */
export const FINAL_OFFER_ROUNDS_STATUS = [
  'draft',
  'awaiting_approval',
  'issued',
  'closed',
  'evaluated',
  'cancelled',
] as const;
export const FinalOfferRoundsStatus = z.enum(FINAL_OFFER_ROUNDS_STATUS);
export type FinalOfferRoundsStatus = (typeof FINAL_OFFER_ROUNDS_STATUS)[number];
/** `process_decisions.decision_type` */
export const PROCESS_DECISIONS_DECISION_TYPE = [
  'new_competition_required',
  'fallback_to_next_bidder',
  'reopen_round',
  'deadline_extension',
  'cancellation',
  'no_award',
  'late_exception',
  'restart_after_incident',
  'other',
] as const;
export const ProcessDecisionsDecisionType = z.enum(PROCESS_DECISIONS_DECISION_TYPE);
export type ProcessDecisionsDecisionType = (typeof PROCESS_DECISIONS_DECISION_TYPE)[number];
/** `process_decisions.status` */
export const PROCESS_DECISIONS_STATUS = ['proposed', 'approved', 'rejected'] as const;
export const ProcessDecisionsStatus = z.enum(PROCESS_DECISIONS_STATUS);
export type ProcessDecisionsStatus = (typeof PROCESS_DECISIONS_STATUS)[number];
/** `award_recommendations.status` */
export const AWARD_RECOMMENDATIONS_STATUS = [
  'draft',
  'awaiting_approval',
  'approved',
  'returned',
  'rejected',
  'superseded',
] as const;
export const AwardRecommendationsStatus = z.enum(AWARD_RECOMMENDATIONS_STATUS);
export type AwardRecommendationsStatus = (typeof AWARD_RECOMMENDATIONS_STATUS)[number];
/** `lot_outcomes.outcome` */
export const LOT_OUTCOMES_OUTCOME = [
  'award',
  'partial_award',
  'conditional_award',
  'no_award',
  'cancelled',
] as const;
export const LotOutcomesOutcome = z.enum(LOT_OUTCOMES_OUTCOME);
export type LotOutcomesOutcome = (typeof LOT_OUTCOMES_OUTCOME)[number];
/** `lot_outcomes.status` */
export const LOT_OUTCOMES_STATUS = [
  'recommended',
  'approved',
  'intent_notified',
  'final_awarded',
  'withdrawn',
] as const;
export const LotOutcomesStatus = z.enum(LOT_OUTCOMES_STATUS);
export type LotOutcomesStatus = (typeof LOT_OUTCOMES_STATUS)[number];
/** `standstill_periods.status` */
export const STANDSTILL_PERIODS_STATUS = [
  'running',
  'extended',
  'suspended',
  'completed',
  'not_applicable',
] as const;
export const StandstillPeriodsStatus = z.enum(STANDSTILL_PERIODS_STATUS);
export type StandstillPeriodsStatus = (typeof STANDSTILL_PERIODS_STATUS)[number];
/** `debrief_requests.status` */
export const DEBRIEF_REQUESTS_STATUS = ['requested', 'scheduled', 'provided', 'declined'] as const;
export const DebriefRequestsStatus = z.enum(DEBRIEF_REQUESTS_STATUS);
export type DebriefRequestsStatus = (typeof DEBRIEF_REQUESTS_STATUS)[number];
/** `complaints.subject` */
export const COMPLAINTS_SUBJECT = [
  'tender_terms',
  'eligibility',
  'exclusion',
  'evaluation',
  'award',
  'process',
  'other',
] as const;
export const ComplaintsSubject = z.enum(COMPLAINTS_SUBJECT);
export type ComplaintsSubject = (typeof COMPLAINTS_SUBJECT)[number];
/** `complaints.status` */
export const COMPLAINTS_STATUS = [
  'received',
  'acknowledged',
  'admissibility_review',
  'under_investigation',
  'response_issued',
  'appealed',
  'resolved',
  'withdrawn',
  'closed',
] as const;
export const ComplaintsStatus = z.enum(COMPLAINTS_STATUS);
export type ComplaintsStatus = (typeof COMPLAINTS_STATUS)[number];
/** `complaints.outcome` */
export const COMPLAINTS_OUTCOME = [
  'upheld',
  'partially_upheld',
  'dismissed',
  'withdrawn',
  'inadmissible',
] as const;
export const ComplaintsOutcome = z.enum(COMPLAINTS_OUTCOME);
export type ComplaintsOutcome = (typeof COMPLAINTS_OUTCOME)[number];
/** `public_award_notices.status` */
export const PUBLIC_AWARD_NOTICES_STATUS = ['draft', 'approved', 'published', 'withdrawn'] as const;
export const PublicAwardNoticesStatus = z.enum(PUBLIC_AWARD_NOTICES_STATUS);
export type PublicAwardNoticesStatus = (typeof PUBLIC_AWARD_NOTICES_STATUS)[number];
/** `event_closeouts.status` */
export const EVENT_CLOSEOUTS_STATUS = ['in_progress', 'blocked', 'closed', 'archived'] as const;
export const EventCloseoutsStatus = z.enum(EVENT_CLOSEOUTS_STATUS);
export type EventCloseoutsStatus = (typeof EVENT_CLOSEOUTS_STATUS)[number];

// Migration 12 (contracts)
/** `contracts.status` */
export const CONTRACTS_STATUS = [
  'draft',
  'under_review',
  'awaiting_signature',
  'signed_not_effective',
  'active',
  'suspended',
  'expired',
  'terminated',
  'closed',
] as const;
export const ContractsStatus = z.enum(CONTRACTS_STATUS);
export type ContractsStatus = (typeof CONTRACTS_STATUS)[number];
/** `contract_signatories.party` */
export const CONTRACT_SIGNATORIES_PARTY = ['buyer', 'supplier'] as const;
export const ContractSignatoriesParty = z.enum(CONTRACT_SIGNATORIES_PARTY);
export type ContractSignatoriesParty = (typeof CONTRACT_SIGNATORIES_PARTY)[number];
/** `contract_signatories.status` */
export const CONTRACT_SIGNATORIES_STATUS = ['pending', 'signed', 'refused', 'recorded_external'] as const;
export const ContractSignatoriesStatus = z.enum(CONTRACT_SIGNATORIES_STATUS);
export type ContractSignatoriesStatus = (typeof CONTRACT_SIGNATORIES_STATUS)[number];
/** `contract_signatories.method` */
export const CONTRACT_SIGNATORIES_METHOD = ['in_app', 'external_recorded'] as const;
export const ContractSignatoriesMethod = z.enum(CONTRACT_SIGNATORIES_METHOD);
export type ContractSignatoriesMethod = (typeof CONTRACT_SIGNATORIES_METHOD)[number];
/** `handovers.status` */
export const HANDOVERS_STATUS = ['draft', 'submitted', 'accepted', 'returned'] as const;
export const HandoversStatus = z.enum(HANDOVERS_STATUS);
export type HandoversStatus = (typeof HANDOVERS_STATUS)[number];
/** `obligations.kind` */
export const OBLIGATIONS_KIND = ['obligation', 'milestone', 'deliverable'] as const;
export const ObligationsKind = z.enum(OBLIGATIONS_KIND);
export type ObligationsKind = (typeof OBLIGATIONS_KIND)[number];
/** `obligations.party` */
export const OBLIGATIONS_PARTY = ['buyer', 'supplier'] as const;
export const ObligationsParty = z.enum(OBLIGATIONS_PARTY);
export type ObligationsParty = (typeof OBLIGATIONS_PARTY)[number];
/** `obligations.status` */
export const OBLIGATIONS_STATUS = [
  'planned',
  'due',
  'evidence_submitted',
  'under_review',
  'accepted',
  'rejected',
  'overdue',
  'waived',
  'cancelled',
] as const;
export const ObligationsStatus = z.enum(OBLIGATIONS_STATUS);
export type ObligationsStatus = (typeof OBLIGATIONS_STATUS)[number];
/** `acceptance_decisions.decision` */
export const ACCEPTANCE_DECISIONS_DECISION = ['accepted', 'rejected'] as const;
export const AcceptanceDecisionsDecision = z.enum(ACCEPTANCE_DECISIONS_DECISION);
export type AcceptanceDecisionsDecision = (typeof ACCEPTANCE_DECISIONS_DECISION)[number];
/** `performance_reviews.status` */
export const PERFORMANCE_REVIEWS_STATUS = [
  'draft',
  'shared_with_supplier',
  'supplier_responded',
  'finalized',
] as const;
export const PerformanceReviewsStatus = z.enum(PERFORMANCE_REVIEWS_STATUS);
export type PerformanceReviewsStatus = (typeof PERFORMANCE_REVIEWS_STATUS)[number];
/** `performance_reviews.overall_rating` */
export const PERFORMANCE_REVIEWS_OVERALL_RATING = [
  'exceeds',
  'meets',
  'partially_meets',
  'does_not_meet',
] as const;
export const PerformanceReviewsOverallRating = z.enum(PERFORMANCE_REVIEWS_OVERALL_RATING);
export type PerformanceReviewsOverallRating = (typeof PERFORMANCE_REVIEWS_OVERALL_RATING)[number];
/** `contract_incidents.incident_type` */
export const CONTRACT_INCIDENTS_INCIDENT_TYPE = ['incident', 'complaint', 'breach'] as const;
export const ContractIncidentsIncidentType = z.enum(CONTRACT_INCIDENTS_INCIDENT_TYPE);
export type ContractIncidentsIncidentType = (typeof CONTRACT_INCIDENTS_INCIDENT_TYPE)[number];
/** `contract_incidents.severity` */
export const CONTRACT_INCIDENTS_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
export const ContractIncidentsSeverity = z.enum(CONTRACT_INCIDENTS_SEVERITY);
export type ContractIncidentsSeverity = (typeof CONTRACT_INCIDENTS_SEVERITY)[number];
/** `contract_incidents.status` */
export const CONTRACT_INCIDENTS_STATUS = ['open', 'corrective_action', 'resolved', 'closed'] as const;
export const ContractIncidentsStatus = z.enum(CONTRACT_INCIDENTS_STATUS);
export type ContractIncidentsStatus = (typeof CONTRACT_INCIDENTS_STATUS)[number];
/** `improvement_actions.status` */
export const IMPROVEMENT_ACTIONS_STATUS = ['open', 'done', 'overdue', 'cancelled'] as const;
export const ImprovementActionsStatus = z.enum(IMPROVEMENT_ACTIONS_STATUS);
export type ImprovementActionsStatus = (typeof IMPROVEMENT_ACTIONS_STATUS)[number];
/** `contract_invoices.acceptance_status` */
export const CONTRACT_INVOICES_ACCEPTANCE_STATUS = ['not_accepted', 'accepted', 'disputed'] as const;
export const ContractInvoicesAcceptanceStatus = z.enum(CONTRACT_INVOICES_ACCEPTANCE_STATUS);
export type ContractInvoicesAcceptanceStatus = (typeof CONTRACT_INVOICES_ACCEPTANCE_STATUS)[number];
/** `contract_invoices.payment_status` */
export const CONTRACT_INVOICES_PAYMENT_STATUS = [
  'not_invoiced',
  'invoiced',
  'approved',
  'paid',
  'disputed',
] as const;
export const ContractInvoicesPaymentStatus = z.enum(CONTRACT_INVOICES_PAYMENT_STATUS);
export type ContractInvoicesPaymentStatus = (typeof CONTRACT_INVOICES_PAYMENT_STATUS)[number];
/** `contract_invoices.source` */
export const CONTRACT_INVOICES_SOURCE = ['local_entry', 'finance_system'] as const;
export const ContractInvoicesSource = z.enum(CONTRACT_INVOICES_SOURCE);
export type ContractInvoicesSource = (typeof CONTRACT_INVOICES_SOURCE)[number];
/** `change_requests.raised_by_party` */
export const CHANGE_REQUESTS_RAISED_BY_PARTY = ['buyer', 'supplier'] as const;
export const ChangeRequestsRaisedByParty = z.enum(CHANGE_REQUESTS_RAISED_BY_PARTY);
export type ChangeRequestsRaisedByParty = (typeof CHANGE_REQUESTS_RAISED_BY_PARTY)[number];
/** `change_requests.status` */
export const CHANGE_REQUESTS_STATUS = [
  'draft',
  'submitted',
  'impact_assessment',
  'approval_pending',
  'agreed',
  'rejected',
  'withdrawn',
  'incorporated',
] as const;
export const ChangeRequestsStatus = z.enum(CHANGE_REQUESTS_STATUS);
export type ChangeRequestsStatus = (typeof CHANGE_REQUESTS_STATUS)[number];
/** `contract_disputes.dispute_type` */
export const CONTRACT_DISPUTES_DISPUTE_TYPE = [
  'dispute',
  'claim',
  'remedy',
  'credit',
  'penalty',
  'settlement',
] as const;
export const ContractDisputesDisputeType = z.enum(CONTRACT_DISPUTES_DISPUTE_TYPE);
export type ContractDisputesDisputeType = (typeof CONTRACT_DISPUTES_DISPUTE_TYPE)[number];
/** `contract_disputes.status` */
export const CONTRACT_DISPUTES_STATUS = ['open', 'negotiating', 'resolved', 'withdrawn'] as const;
export const ContractDisputesStatus = z.enum(CONTRACT_DISPUTES_STATUS);
export type ContractDisputesStatus = (typeof CONTRACT_DISPUTES_STATUS)[number];
/** `renewal_options.option_type` */
export const RENEWAL_OPTIONS_OPTION_TYPE = ['renewal', 'extension', 'termination_notice'] as const;
export const RenewalOptionsOptionType = z.enum(RENEWAL_OPTIONS_OPTION_TYPE);
export type RenewalOptionsOptionType = (typeof RENEWAL_OPTIONS_OPTION_TYPE)[number];
/** `renewal_options.status` */
export const RENEWAL_OPTIONS_STATUS = [
  'available',
  'under_review',
  'decided',
  'expired',
  'not_exercised',
] as const;
export const RenewalOptionsStatus = z.enum(RENEWAL_OPTIONS_STATUS);
export type RenewalOptionsStatus = (typeof RENEWAL_OPTIONS_STATUS)[number];
/** `renewal_options.decision` */
export const RENEWAL_OPTIONS_DECISION = ['renew', 'extend', 'recompete', 'terminate', 'let_expire'] as const;
export const RenewalOptionsDecision = z.enum(RENEWAL_OPTIONS_DECISION);
export type RenewalOptionsDecision = (typeof RENEWAL_OPTIONS_DECISION)[number];
/** `contract_securities.security_type` */
export const CONTRACT_SECURITIES_SECURITY_TYPE = [
  'performance_bond',
  'bank_guarantee',
  'insurance',
  'license',
  'certification',
  'retention',
] as const;
export const ContractSecuritiesSecurityType = z.enum(CONTRACT_SECURITIES_SECURITY_TYPE);
export type ContractSecuritiesSecurityType = (typeof CONTRACT_SECURITIES_SECURITY_TYPE)[number];
/** `contract_securities.status` */
export const CONTRACT_SECURITIES_STATUS = ['active', 'expiring', 'expired', 'released', 'called'] as const;
export const ContractSecuritiesStatus = z.enum(CONTRACT_SECURITIES_STATUS);
export type ContractSecuritiesStatus = (typeof CONTRACT_SECURITIES_STATUS)[number];
/** `contract_closeouts.status` */
export const CONTRACT_CLOSEOUTS_STATUS = ['in_progress', 'closed'] as const;
export const ContractCloseoutsStatus = z.enum(CONTRACT_CLOSEOUTS_STATUS);
export type ContractCloseoutsStatus = (typeof CONTRACT_CLOSEOUTS_STATUS)[number];

// Migration 13 (records_reporting_ops)
/** `disposal_requests.status` */
export const DISPOSAL_REQUESTS_STATUS = ['proposed', 'blocked', 'approved', 'executed', 'rejected'] as const;
export const DisposalRequestsStatus = z.enum(DISPOSAL_REQUESTS_STATUS);
export type DisposalRequestsStatus = (typeof DISPOSAL_REQUESTS_STATUS)[number];
/** `exports.export_type` */
export const EXPORTS_EXPORT_TYPE = [
  'report',
  'evidence_pack',
  'tender_package',
  'receipt',
  'evaluation_report',
  'award_report',
  'handover',
  'customer_exit',
] as const;
export const ExportsExportType = z.enum(EXPORTS_EXPORT_TYPE);
export type ExportsExportType = (typeof EXPORTS_EXPORT_TYPE)[number];
/** `exports.format` */
export const EXPORTS_FORMAT = ['xlsx', 'csv', 'html'] as const;
export const ExportsFormat = z.enum(EXPORTS_FORMAT);
export type ExportsFormat = (typeof EXPORTS_FORMAT)[number];
/** `exports.status` */
export const EXPORTS_STATUS = ['queued', 'running', 'ready', 'failed'] as const;
export const ExportsStatus = z.enum(EXPORTS_STATUS);
export type ExportsStatus = (typeof EXPORTS_STATUS)[number];
/** `report_definitions.family` */
export const REPORT_DEFINITIONS_FAMILY = [
  'pipeline',
  'cycle_time',
  'participation',
  'qualification_risk',
  'evaluation_integrity',
  'awards',
  'commercial_outcomes',
  'contract_performance',
  'complaints',
  'audit_records',
] as const;
export const ReportDefinitionsFamily = z.enum(REPORT_DEFINITIONS_FAMILY);
export type ReportDefinitionsFamily = (typeof REPORT_DEFINITIONS_FAMILY)[number];
/** `integration_connections.system_type` */
export const INTEGRATION_CONNECTIONS_SYSTEM_TYPE = [
  'directory',
  'finance',
  'purchasing',
  'vendor_master',
  'notice_portal',
  'registry',
  'credit',
  'sanctions',
  'insurance_verification',
  'esignature',
  'records_management',
  'messaging',
  'calendar',
  'contract_delivery',
  'fx_rates',
  'bi',
  'support',
] as const;
export const IntegrationConnectionsSystemType = z.enum(INTEGRATION_CONNECTIONS_SYSTEM_TYPE);
export type IntegrationConnectionsSystemType = (typeof INTEGRATION_CONNECTIONS_SYSTEM_TYPE)[number];
/** `integration_connections.status` */
export const INTEGRATION_CONNECTIONS_STATUS = ['planned', 'active', 'suspended', 'retired'] as const;
export const IntegrationConnectionsStatus = z.enum(INTEGRATION_CONNECTIONS_STATUS);
export type IntegrationConnectionsStatus = (typeof INTEGRATION_CONNECTIONS_STATUS)[number];
/** `integration_exceptions.status` */
export const INTEGRATION_EXCEPTIONS_STATUS = [
  'open',
  'investigating',
  'reconciled',
  'manual_fallback_used',
  'closed',
] as const;
export const IntegrationExceptionsStatus = z.enum(INTEGRATION_EXCEPTIONS_STATUS);
export type IntegrationExceptionsStatus = (typeof INTEGRATION_EXCEPTIONS_STATUS)[number];
/** `import_batches.record_type` */
export const IMPORT_BATCHES_RECORD_TYPE = ['supplier', 'contract', 'tender_history'] as const;
export const ImportBatchesRecordType = z.enum(IMPORT_BATCHES_RECORD_TYPE);
export type ImportBatchesRecordType = (typeof IMPORT_BATCHES_RECORD_TYPE)[number];
/** `import_batches.status` */
export const IMPORT_BATCHES_STATUS = [
  'uploaded',
  'reviewing',
  'accepted',
  'partially_accepted',
  'rejected',
] as const;
export const ImportBatchesStatus = z.enum(IMPORT_BATCHES_STATUS);
export type ImportBatchesStatus = (typeof IMPORT_BATCHES_STATUS)[number];
/** `import_records.decision` */
export const IMPORT_RECORDS_DECISION = ['pending', 'accepted', 'rejected'] as const;
export const ImportRecordsDecision = z.enum(IMPORT_RECORDS_DECISION);
export type ImportRecordsDecision = (typeof IMPORT_RECORDS_DECISION)[number];
/** `subscriptions.status` */
export const SUBSCRIPTIONS_STATUS = ['trial', 'active', 'past_due', 'cancelled', 'ended'] as const;
export const SubscriptionsStatus = z.enum(SUBSCRIPTIONS_STATUS);
export type SubscriptionsStatus = (typeof SUBSCRIPTIONS_STATUS)[number];
/** `offboarding_plans.status` */
export const OFFBOARDING_PLANS_STATUS = ['draft', 'agreed', 'in_progress', 'completed'] as const;
export const OffboardingPlansStatus = z.enum(OFFBOARDING_PLANS_STATUS);
export type OffboardingPlansStatus = (typeof OFFBOARDING_PLANS_STATUS)[number];
/** `support_cases.category` */
export const SUPPORT_CASES_CATEGORY = [
  'usage',
  'access',
  'submission_evidence',
  'qualification',
  'procurement_merits',
  'contract_performance',
  'accessibility',
] as const;
export const SupportCasesCategory = z.enum(SUPPORT_CASES_CATEGORY);
export type SupportCasesCategory = (typeof SUPPORT_CASES_CATEGORY)[number];
/** `support_cases.status` */
export const SUPPORT_CASES_STATUS = [
  'open',
  'in_progress',
  'awaiting_customer',
  'resolved',
  'closed',
  'routed_to_buyer',
] as const;
export const SupportCasesStatus = z.enum(SUPPORT_CASES_STATUS);
export type SupportCasesStatus = (typeof SUPPORT_CASES_STATUS)[number];
/** `support_access_grants.scope` */
export const SUPPORT_ACCESS_GRANTS_SCOPE = ['metadata_only', 'specific_records'] as const;
export const SupportAccessGrantsScope = z.enum(SUPPORT_ACCESS_GRANTS_SCOPE);
export type SupportAccessGrantsScope = (typeof SUPPORT_ACCESS_GRANTS_SCOPE)[number];
/** `support_access_grants.status` */
export const SUPPORT_ACCESS_GRANTS_STATUS = [
  'requested',
  'authorized',
  'active',
  'expired',
  'revoked',
  'denied',
] as const;
export const SupportAccessGrantsStatus = z.enum(SUPPORT_ACCESS_GRANTS_STATUS);
export type SupportAccessGrantsStatus = (typeof SUPPORT_ACCESS_GRANTS_STATUS)[number];
/** `service_incidents.status` */
export const SERVICE_INCIDENTS_STATUS = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
export const ServiceIncidentsStatus = z.enum(SERVICE_INCIDENTS_STATUS);
export type ServiceIncidentsStatus = (typeof SERVICE_INCIDENTS_STATUS)[number];
/** `announcements.audience` */
export const ANNOUNCEMENTS_AUDIENCE = ['all', 'buyers', 'suppliers', 'public'] as const;
export const AnnouncementsAudience = z.enum(ANNOUNCEMENTS_AUDIENCE);
export type AnnouncementsAudience = (typeof ANNOUNCEMENTS_AUDIENCE)[number];
/** `announcements.status` */
export const ANNOUNCEMENTS_STATUS = ['draft', 'published', 'archived'] as const;
export const AnnouncementsStatus = z.enum(ANNOUNCEMENTS_STATUS);
export type AnnouncementsStatus = (typeof ANNOUNCEMENTS_STATUS)[number];
/** `help_articles.audience` */
export const HELP_ARTICLES_AUDIENCE = ['public', 'supplier', 'buyer', 'all'] as const;
export const HelpArticlesAudience = z.enum(HELP_ARTICLES_AUDIENCE);
export type HelpArticlesAudience = (typeof HELP_ARTICLES_AUDIENCE)[number];
/** `help_articles.topic` */
export const HELP_ARTICLES_TOPIC = [
  'registration',
  'qualification',
  'submission',
  'complaints',
  'accessibility',
  'evaluation',
  'contracts',
  'general',
] as const;
export const HelpArticlesTopic = z.enum(HELP_ARTICLES_TOPIC);
export type HelpArticlesTopic = (typeof HELP_ARTICLES_TOPIC)[number];
/** `help_articles.status` */
export const HELP_ARTICLES_STATUS = ['draft', 'published', 'archived'] as const;
export const HelpArticlesStatus = z.enum(HELP_ARTICLES_STATUS);
export type HelpArticlesStatus = (typeof HELP_ARTICLES_STATUS)[number];

// ---------------------------------------------------------------------------------------------------------
// Contract-defined enumerations (free text or derived in the blueprint; fixed here so every layer agrees)
// ---------------------------------------------------------------------------------------------------------

/** `tenders.procedure`: the blueprint defines it "as strategies", so it mirrors `procurement_strategies.procedure`. */
export const TENDERS_PROCEDURE = PROCUREMENT_STRATEGIES_PROCEDURE;
export const TendersProcedure = z.enum(TENDERS_PROCEDURE);
export type TendersProcedure = (typeof TENDERS_PROCEDURE)[number];

/** `policy_profile_versions.permitted_procedures` (text[]): a subset of the procurement procedures. */
export const POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES = PROCUREMENT_STRATEGIES_PROCEDURE;
export const PolicyProfileVersionsPermittedProcedures = z.enum(POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES);
export type PolicyProfileVersionsPermittedProcedures =
  (typeof POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES)[number];

/**
 * `v_qualification_status.effective_status` (DD-13): the latest non-superseded decision's outcome, `expired`
 * once `effective_to` has passed, and `not_assessed` for active relationships × active programs without a
 * decision (PRD §8.3 "Qualification status").
 */
export const V_QUALIFICATION_STATUS_EFFECTIVE_STATUS = [
  'not_assessed',
  'qualified',
  'qualified_with_conditions',
  'not_qualified',
  'suspended',
  'expired',
  'withdrawn',
] as const;
export const VQualificationStatusEffectiveStatus = z.enum(V_QUALIFICATION_STATUS_EFFECTIVE_STATUS);
export type VQualificationStatusEffectiveStatus = (typeof V_QUALIFICATION_STATUS_EFFECTIVE_STATUS)[number];

/** `holds.blocked_actions` (text[]): the commands a hold blocks (BR-13, BR-32, BR-40). */
export const HOLDS_BLOCKED_ACTIONS = [
  'publish',
  'open',
  'evaluate',
  'award_intent',
  'award_final',
  'contract_sign',
  'contract_start',
  'disposal',
] as const;
export const HoldsBlockedActions = z.enum(HOLDS_BLOCKED_ACTIONS);
export type HoldsBlockedActions = (typeof HOLDS_BLOCKED_ACTIONS)[number];

/**
 * `notification_rules.event_type`, also used by `notifications.event_type` and
 * `user_notification_preferences.event_type`: the PRD §14.3 notification events.
 */
export const NOTIFICATION_RULES_EVENT_TYPE = [
  'user_invitation',
  'authority_change',
  'request_submitted',
  'request_returned',
  'tender_issued',
  'invitation_received',
  'addendum_issued',
  'deadline_changed',
  'question_answered',
  'clarification_requested',
  'evidence_expiring',
  'submission_succeeded',
  'submission_failed',
  'submission_replaced',
  'submission_withdrawn',
  'closing_approaching',
  'evaluation_assigned',
  'evaluation_overdue',
  'approval_needed',
  'approval_returned',
  'approval_expired',
  'preferred_bidder_selected',
  'intent_to_award',
  'exclusion_decided',
  'award_decided',
  'complaint_update',
  'standstill_changed',
  'contract_milestone_due',
  'contract_expiry',
  'renewal_window',
  'service_incident',
  'delivery_exception',
  'task_assigned',
  'task_overdue',
  'product_announcement',
] as const;
export const NotificationRulesEventType = z.enum(NOTIFICATION_RULES_EVENT_TYPE);
export type NotificationRulesEventType = (typeof NOTIFICATION_RULES_EVENT_TYPE)[number];

/**
 * Formal-notice events that are mandatory: an ordinary preference never mutes them (PRD §14.3 "Mandatory
 * formal notices cannot be disabled by an ordinary preference"; DD-44).
 */
export const MANDATORY_NOTIFICATION_EVENT_TYPES = [
  'user_invitation',
  'tender_issued',
  'invitation_received',
  'addendum_issued',
  'deadline_changed',
  'submission_succeeded',
  'submission_failed',
  'submission_replaced',
  'submission_withdrawn',
  'preferred_bidder_selected',
  'intent_to_award',
  'exclusion_decided',
  'award_decided',
  'complaint_update',
  'standstill_changed',
  'service_incident',
  'delivery_exception',
] as const satisfies readonly NotificationRulesEventType[];

/** True when an event type is a mandatory formal notice that preferences cannot mute. */
export function isMandatoryNotificationEvent(eventType: NotificationRulesEventType): boolean {
  return (MANDATORY_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(eventType);
}

/**
 * `documents.related_type`: the record a document belongs to. The Stage B documents service authorizes
 * access per related type through `documents/access-registry.ts`; an unregistered type is denied.
 */
export const DOCUMENTS_RELATED_TYPE = [
  'procurement_request',
  'procurement_project',
  'procurement_strategy',
  'tender',
  'lot',
  'tender_term',
  'addendum',
  'question',
  'session',
  'bid_revision',
  'bid_answer',
  'qualification_application',
  'evidence_item',
  'supplier_profile',
  'supplier_identity_change',
  'opening_session',
  'evaluation_report',
  'assessment_session',
  'due_diligence_case',
  'notice',
  'award_recommendation',
  'public_award_notice',
  'complaint',
  'contract',
  'handover',
  'obligation',
  'change_request',
  'contract_security',
  'template',
  'policy_profile',
  'export',
  'import_batch',
  'support_case',
  'help_article',
] as const;
export const DocumentsRelatedType = z.enum(DOCUMENTS_RELATED_TYPE);
export type DocumentsRelatedType = (typeof DOCUMENTS_RELATED_TYPE)[number];

// ---------------------------------------------------------------------------------------------------------
// Write variants (DD-40): a request body never offers `framework_calloff`
// ---------------------------------------------------------------------------------------------------------

/** The procedure value that stays in the database CHECK lists but is never written by a contract (DD-40). */
export const DEFERRED_PROCEDURE = 'framework_calloff' as const;

type Procedure = ProcurementStrategiesProcedure;
type WriteProcedure = Exclude<Procedure, typeof DEFERRED_PROCEDURE>;

function isWriteProcedure(value: Procedure): value is WriteProcedure {
  return value !== DEFERRED_PROCEDURE;
}

function writeProcedures(): readonly [WriteProcedure, ...WriteProcedure[]] {
  const [first, ...rest] = PROCUREMENT_STRATEGIES_PROCEDURE.filter(isWriteProcedure);
  if (first === undefined) {
    throw new Error('The procedure write enum cannot be empty.');
  }
  return [first, ...rest];
}

/** `procurement_strategies.procedure` for request bodies (DD-40). */
export const PROCUREMENT_STRATEGIES_PROCEDURE_WRITE = writeProcedures();
export const ProcurementStrategiesProcedureWrite = z.enum(PROCUREMENT_STRATEGIES_PROCEDURE_WRITE);
export type ProcurementStrategiesProcedureWrite = (typeof PROCUREMENT_STRATEGIES_PROCEDURE_WRITE)[number];

/** `tenders.procedure` for request bodies (DD-40). */
export const TENDERS_PROCEDURE_WRITE = PROCUREMENT_STRATEGIES_PROCEDURE_WRITE;
export const TendersProcedureWrite = z.enum(TENDERS_PROCEDURE_WRITE);
export type TendersProcedureWrite = (typeof TENDERS_PROCEDURE_WRITE)[number];

/** `policy_profile_versions.permitted_procedures` for request bodies (DD-40). */
export const POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES_WRITE = PROCUREMENT_STRATEGIES_PROCEDURE_WRITE;
export const PolicyProfileVersionsPermittedProceduresWrite = z.enum(
  POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES_WRITE,
);
export type PolicyProfileVersionsPermittedProceduresWrite =
  (typeof POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES_WRITE)[number];

/** Every write variant, keyed by the `table.column` it restricts. */
export const WRITE_ENUMS = {
  'procurement_strategies.procedure': PROCUREMENT_STRATEGIES_PROCEDURE_WRITE,
  'tenders.procedure': TENDERS_PROCEDURE_WRITE,
  'policy_profile_versions.permitted_procedures': POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES_WRITE,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------

/** Every enumeration keyed by `table.column`. The StatusChip tone map and the blueprint test iterate it. */

// ---------------------------------------------------------------------------------------------------------
// Contract-defined enumerations of the domain contracts (derived display states and contract-only choices)
// ---------------------------------------------------------------------------------------------------------
// Listed once here so StatusChip, enumLabel and enumTone render them; the domain modules re-export them.

/** `evidence_items.freshness` (contract-defined). */
export const EVIDENCE_FRESHNESS = ['current', 'expiring_soon', 'expired', 'no_expiry'] as const;
/** `supplier_verification_requests.status` (contract-defined). */
export const VERIFICATION_REQUEST_STATUSES = ['open', 'answered', 'closed'] as const;
/** `supplier_claim_invitations.state` (contract-defined). */
export const CLAIM_INVITATION_STATES = ['pending', 'expired', 'claimed', 'revoked'] as const;
/** `service_incidents.severity` (contract-defined). */
export const SERVICE_INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
/** `subscriptions.plan_code` (contract-defined). */
export const PLAN_CODES = ['pilot', 'buyer_standard', 'buyer_enterprise'] as const;
/** `invoices.status` (contract-defined). */
export const INVOICE_STATUSES = ['issued', 'paid', 'overdue', 'disputed', 'void'] as const;
/** `service_actions.status` (contract-defined). */
export const SERVICE_ACTION_STATUSES = ['open', 'in_progress', 'resolved'] as const;
/** `onboarding_items.area` (contract-defined). */
export const ONBOARDING_ITEM_AREAS = ['setup', 'ownership', 'adoption', 'issue'] as const;
/** `onboarding_items.status` (contract-defined). */
export const ONBOARDING_ITEM_STATUSES = ['open', 'in_progress', 'done', 'blocked', 'not_applicable'] as const;
/** `privileged_access_reviews.status` (contract-defined). */
export const ACCESS_REVIEW_STATUSES = ['due', 'overdue', 'completed'] as const;
/** `privileged_access_reviews.outcome` (contract-defined). */
export const ACCESS_REVIEW_OUTCOMES = ['retain', 'reduce', 'revoke'] as const;
/** `conduct_cases.kind` (contract-defined). */
export const CONDUCT_CASE_KINDS = ['service_complaint', 'misuse'] as const;
/** `conduct_cases.status` (contract-defined). */
export const CONDUCT_CASE_STATUSES = ['open', 'under_review', 'closed'] as const;
/** `access_items.status` (contract-defined). */
export const ACCESS_ITEM_STATUSES = ['scheduled', 'active', 'expiring_soon', 'expired', 'revoked'] as const;
/** `contact_change_requests.status` (contract-defined). */
export const CONTACT_CHANGE_STATUSES = ['pending_confirmation', 'confirmed', 'cancelled', 'expired'] as const;
/** `access_findings.finding_type` (contract-defined). */
export const ACCESS_FINDING_TYPES = ['sod_conflict', 'grant_expiring', 'dormant_account', 'active_restriction', 'pending_conflict_review'] as const;
/** `access_findings.severity` (contract-defined). */
export const FINDING_SEVERITIES = ['info', 'warning', 'critical'] as const;
/** `release_checks.readiness` (contract-defined). */
export const READINESS_CHECK_STATUS = ['passed', 'warning', 'blocking'] as const;
/** `qualification_applications.priority` (contract-defined): the task priorities. */
export const QUALIFICATION_APPLICATIONS_PRIORITY = TASKS_PRIORITY;
export const QualificationApplicationsPriority = z.enum(QUALIFICATION_APPLICATIONS_PRIORITY);
export type QualificationApplicationsPriority = (typeof QUALIFICATION_APPLICATIONS_PRIORITY)[number];
/** `envelope_openings.envelope` (DD-05): the envelopes of a staged opening. */
export const ENVELOPE_OPENINGS_ENVELOPE = ['qualification', 'technical', 'commercial'] as const;
export const EnvelopeOpeningsEnvelope = z.enum(ENVELOPE_OPENINGS_ENVELOPE);
export type EnvelopeOpeningsEnvelope = (typeof ENVELOPE_OPENINGS_ENVELOPE)[number];

export const ENUMS = {
  'tenants.kind': TENANTS_KIND,
  'tenants.status': TENANTS_STATUS,
  'tenants.verification_status': TENANTS_VERIFICATION_STATUS,
  'tenants.onboarding_stage': TENANTS_ONBOARDING_STAGE,
  'users.status': USERS_STATUS,
  'users.theme': USERS_THEME,
  'memberships.status': MEMBERSHIPS_STATUS,
  'invitations.status': INVITATIONS_STATUS,
  'permissions.tenant_kind': PERMISSIONS_TENANT_KIND,
  'role_assignments.scope_type': ROLE_ASSIGNMENTS_SCOPE_TYPE,
  'access_restrictions.restriction_type': ACCESS_RESTRICTIONS_RESTRICTION_TYPE,
  'audit_log.sensitivity': AUDIT_LOG_SENSITIVITY,
  'job_run.trigger': JOB_RUN_TRIGGER,
  'job_run.environment': JOB_RUN_ENVIRONMENT,
  'job_run.status': JOB_RUN_STATUS,
  'funding_sources.source_type': FUNDING_SOURCES_SOURCE_TYPE,
  'calendars.status': CALENDARS_STATUS,
  'committees.purpose': COMMITTEES_PURPOSE,
  'committee_members.member_role': COMMITTEE_MEMBERS_MEMBER_ROLE,
  'authority_limits.subject_type': AUTHORITY_LIMITS_SUBJECT_TYPE,
  'authority_limits.decision_type': AUTHORITY_LIMITS_DECISION_TYPE,
  'sod_policies.rule_code': SOD_POLICIES_RULE_CODE,
  'sod_policies.mode': SOD_POLICIES_MODE,
  'conflict_declarations.subject_type': CONFLICT_DECLARATIONS_SUBJECT_TYPE,
  'conflict_declarations.nature': CONFLICT_DECLARATIONS_NATURE,
  'conflict_declarations.disposition': CONFLICT_DECLARATIONS_DISPOSITION,
  'policy_profiles.status': POLICY_PROFILES_STATUS,
  'policy_profile_versions.status': POLICY_PROFILE_VERSIONS_STATUS,
  'policy_profile_versions.late_submission_policy': POLICY_PROFILE_VERSIONS_LATE_SUBMISSION_POLICY,
  'policy_profile_versions.standstill_day_type': POLICY_PROFILE_VERSIONS_STANDSTILL_DAY_TYPE,
  'custom_fields.entity_type': CUSTOM_FIELDS_ENTITY_TYPE,
  'custom_fields.field_type': CUSTOM_FIELDS_FIELD_TYPE,
  'custom_fields.required_mode': CUSTOM_FIELDS_REQUIRED_MODE,
  'custom_fields.audience': CUSTOM_FIELDS_AUDIENCE,
  'templates.kind': TEMPLATES_KIND,
  'templates.audience': TEMPLATES_AUDIENCE,
  'templates.status': TEMPLATES_STATUS,
  'portal_settings.disclose_bidder_identities': PORTAL_SETTINGS_DISCLOSE_BIDDER_IDENTITIES,
  'portal_settings.public_document_policy': PORTAL_SETTINGS_PUBLIC_DOCUMENT_POLICY,
  'retention_classes.record_class': RETENTION_CLASSES_RECORD_CLASS,
  'retention_classes.trigger_event': RETENTION_CLASSES_TRIGGER_EVENT,
  'retention_classes.disposition': RETENTION_CLASSES_DISPOSITION,
  'approval_requests.subject_type': APPROVAL_REQUESTS_SUBJECT_TYPE,
  'approval_requests.status': APPROVAL_REQUESTS_STATUS,
  'approval_requests.route_mode': APPROVAL_REQUESTS_ROUTE_MODE,
  'approval_steps.status': APPROVAL_STEPS_STATUS,
  'tasks.task_type': TASKS_TASK_TYPE,
  'tasks.priority': TASKS_PRIORITY,
  'tasks.status': TASKS_STATUS,
  'notifications.category': NOTIFICATIONS_CATEGORY,
  'notification_deliveries.channel': NOTIFICATION_DELIVERIES_CHANNEL,
  'notification_deliveries.status': NOTIFICATION_DELIVERIES_STATUS,
  'user_notification_preferences.digest': USER_NOTIFICATION_PREFERENCES_DIGEST,
  'notices.notice_type': NOTICES_NOTICE_TYPE,
  'notices.status': NOTICES_STATUS,
  'notices.period_start_basis': NOTICES_PERIOD_START_BASIS,
  'notice_recipients.delivery_status': NOTICE_RECIPIENTS_DELIVERY_STATUS,
  'documents.classification': DOCUMENTS_CLASSIFICATION,
  'documents.status': DOCUMENTS_STATUS,
  'document_versions.upload_status': DOCUMENT_VERSIONS_UPLOAD_STATUS,
  'comments.visibility': COMMENTS_VISIBILITY,
  'holds.subject_type': HOLDS_SUBJECT_TYPE,
  'holds.hold_type': HOLDS_HOLD_TYPE,
  'supplier_membership_requests.status': SUPPLIER_MEMBERSHIP_REQUESTS_STATUS,
  'supplier_identity_changes.change_type': SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE,
  'supplier_identity_changes.status': SUPPLIER_IDENTITY_CHANGES_STATUS,
  'duplicate_candidates.detected_reason': DUPLICATE_CANDIDATES_DETECTED_REASON,
  'duplicate_candidates.status': DUPLICATE_CANDIDATES_STATUS,
  'buyer_supplier_relationships.status': BUYER_SUPPLIER_RELATIONSHIPS_STATUS,
  'buyer_supplier_relationships.risk_rating': BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING,
  'evidence_items.evidence_type': EVIDENCE_ITEMS_EVIDENCE_TYPE,
  'evidence_items.status': EVIDENCE_ITEMS_STATUS,
  'evidence_items.verification_status': EVIDENCE_ITEMS_VERIFICATION_STATUS,
  'evidence_items.sensitivity': EVIDENCE_ITEMS_SENSITIVITY,
  'evidence_submissions.context_type': EVIDENCE_SUBMISSIONS_CONTEXT_TYPE,
  'qualification_programs.status': QUALIFICATION_PROGRAMS_STATUS,
  'qualification_program_versions.status': QUALIFICATION_PROGRAM_VERSIONS_STATUS,
  'qualification_criteria.area': QUALIFICATION_CRITERIA_AREA,
  'qualification_criteria.response_type': QUALIFICATION_CRITERIA_RESPONSE_TYPE,
  'qualification_applications.status': QUALIFICATION_APPLICATIONS_STATUS,
  'qualification_applications.risk_level': QUALIFICATION_APPLICATIONS_RISK_LEVEL,
  'qualification_answers.applicability': QUALIFICATION_ANSWERS_APPLICABILITY,
  'qualification_info_requests.status': QUALIFICATION_INFO_REQUESTS_STATUS,
  'qualification_findings.finding': QUALIFICATION_FINDINGS_FINDING,
  'financial_reviews.conclusion': FINANCIAL_REVIEWS_CONCLUSION,
  'qualification_decisions.outcome': QUALIFICATION_DECISIONS_OUTCOME,
  'qualification_decisions.blocked_gate': QUALIFICATION_DECISIONS_BLOCKED_GATE,
  'reassessment_triggers.trigger_type': REASSESSMENT_TRIGGERS_TRIGGER_TYPE,
  'reassessment_triggers.status': REASSESSMENT_TRIGGERS_STATUS,
  'integrity_screenings.check_type': INTEGRITY_SCREENINGS_CHECK_TYPE,
  'integrity_screenings.result': INTEGRITY_SCREENINGS_RESULT,
  'procurement_projects.status': PROCUREMENT_PROJECTS_STATUS,
  'procurement_requests.need_type': PROCUREMENT_REQUESTS_NEED_TYPE,
  'procurement_requests.funding_status': PROCUREMENT_REQUESTS_FUNDING_STATUS,
  'procurement_requests.priority': PROCUREMENT_REQUESTS_PRIORITY,
  'procurement_requests.status': PROCUREMENT_REQUESTS_STATUS,
  'request_links.link_type': REQUEST_LINKS_LINK_TYPE,
  'request_info_requests.status': REQUEST_INFO_REQUESTS_STATUS,
  'plan_items.status': PLAN_ITEMS_STATUS,
  'advance_notices.status': ADVANCE_NOTICES_STATUS,
  'procurement_strategies.event_type': PROCUREMENT_STRATEGIES_EVENT_TYPE,
  'procurement_strategies.procedure': PROCUREMENT_STRATEGIES_PROCEDURE,
  'procurement_strategies.award_model': PROCUREMENT_STRATEGIES_AWARD_MODEL,
  'procurement_strategies.status': PROCUREMENT_STRATEGIES_STATUS,
  'market_research_entries.source_type': MARKET_RESEARCH_ENTRIES_SOURCE_TYPE,
  'fairness_reviews.subject_type': FAIRNESS_REVIEWS_SUBJECT_TYPE,
  'fairness_reviews.outcome': FAIRNESS_REVIEWS_OUTCOME,
  'tenders.event_type': TENDERS_EVENT_TYPE,
  'tenders.participation': TENDERS_PARTICIPATION,
  'tenders.award_model': TENDERS_AWARD_MODEL,
  'tenders.opening_mode': TENDERS_OPENING_MODE,
  'tenders.status': TENDERS_STATUS,
  'tenders.link_type': TENDERS_LINK_TYPE,
  'tender_milestones.milestone': TENDER_MILESTONES_MILESTONE,
  'lots.stage': LOTS_STAGE,
  'tender_team_members.team_role': TENDER_TEAM_MEMBERS_TEAM_ROLE,
  'requirements.response_type': REQUIREMENTS_RESPONSE_TYPE,
  'requirements.treatment': REQUIREMENTS_TREATMENT,
  'requirements.envelope': REQUIREMENTS_ENVELOPE,
  'requirements.missing_consequence': REQUIREMENTS_MISSING_CONSEQUENCE,
  'pricing_items.charge_type': PRICING_ITEMS_CHARGE_TYPE,
  'pricing_items.recurrence': PRICING_ITEMS_RECURRENCE,
  'tender_terms.term_type': TENDER_TERMS_TERM_TYPE,
  'tender_envelopes.envelope': TENDER_ENVELOPES_ENVELOPE,
  'participation_conditions.condition_type': PARTICIPATION_CONDITIONS_CONDITION_TYPE,
  'evaluation_plans.status': EVALUATION_PLANS_STATUS,
  'evaluation_plans.aggregation_method': EVALUATION_PLANS_AGGREGATION_METHOD,
  'evaluation_plans.price_method': EVALUATION_PLANS_PRICE_METHOD,
  'evaluation_plans.threshold_scope': EVALUATION_PLANS_THRESHOLD_SCOPE,
  'evaluation_criteria.envelope': EVALUATION_CRITERIA_ENVELOPE,
  'tie_break_rules.rule': TIE_BREAK_RULES_RULE,
  'release_checks.check_area': RELEASE_CHECKS_CHECK_AREA,
  'release_checks.status': RELEASE_CHECKS_STATUS,
  'publications.channel': PUBLICATIONS_CHANNEL,
  'publications.status': PUBLICATIONS_STATUS,
  'participants.source': PARTICIPANTS_SOURCE,
  'participants.invitation_status': PARTICIPANTS_INVITATION_STATUS,
  'participants.access_status': PARTICIPANTS_ACCESS_STATUS,
  'participants.bid_intent': PARTICIPANTS_BID_INTENT,
  'participants.qualification_gate': PARTICIPANTS_QUALIFICATION_GATE,
  'participant_acknowledgments.subject_type': PARTICIPANT_ACKNOWLEDGMENTS_SUBJECT_TYPE,
  'pursuits.decision': PURSUITS_DECISION,
  'pursuit_team_members.responsibility': PURSUIT_TEAM_MEMBERS_RESPONSIBILITY,
  'questions.late_disposition': QUESTIONS_LATE_DISPOSITION,
  'questions.status': QUESTIONS_STATUS,
  'questions.audience': QUESTIONS_AUDIENCE,
  'addenda.materiality': ADDENDA_MATERIALITY,
  'addenda.existing_submission_action': ADDENDA_EXISTING_SUBMISSION_ACTION,
  'addenda.status': ADDENDA_STATUS,
  'addendum_requirement_changes.change_type': ADDENDUM_REQUIREMENT_CHANGES_CHANGE_TYPE,
  'sessions.session_type': SESSIONS_SESSION_TYPE,
  'sessions.status': SESSIONS_STATUS,
  'session_registrations.status': SESSION_REGISTRATIONS_STATUS,
  'bids.submission_state': BIDS_SUBMISSION_STATE,
  'bids.compliance_status': BIDS_COMPLIANCE_STATUS,
  'bids.evaluation_status': BIDS_EVALUATION_STATUS,
  'bids.round_type': BIDS_ROUND_TYPE,
  'bid_revisions.status': BID_REVISIONS_STATUS,
  'bid_answers.envelope': BID_ANSWERS_ENVELOPE,
  'bid_answers.progress': BID_ANSWERS_PROGRESS,
  'bid_prices.price_status': BID_PRICES_PRICE_STATUS,
  'bid_declarations.declaration_type': BID_DECLARATIONS_DECLARATION_TYPE,
  'bid_internal_approvals.approval_type': BID_INTERNAL_APPROVALS_APPROVAL_TYPE,
  'bid_internal_approvals.status': BID_INTERNAL_APPROVALS_STATUS,
  'submission_attempts.outcome': SUBMISSION_ATTEMPTS_OUTCOME,
  'submission_receipts.status': SUBMISSION_RECEIPTS_STATUS,
  'receipt_inventory_items.envelope': RECEIPT_INVENTORY_ITEMS_ENVELOPE,
  'late_submission_exceptions.decision': LATE_SUBMISSION_EXCEPTIONS_DECISION,
  'opening_sessions.envelope': OPENING_SESSIONS_ENVELOPE,
  'opening_sessions.status': OPENING_SESSIONS_STATUS,
  'opening_participants.role': OPENING_PARTICIPANTS_ROLE,
  'compliance_checks.check_type': COMPLIANCE_CHECKS_CHECK_TYPE,
  'compliance_checks.finding_class': COMPLIANCE_CHECKS_FINDING_CLASS,
  'compliance_checks.result': COMPLIANCE_CHECKS_RESULT,
  'bid_clarifications.source': BID_CLARIFICATIONS_SOURCE,
  'bid_clarifications.status': BID_CLARIFICATIONS_STATUS,
  'bid_clarifications.effect': BID_CLARIFICATIONS_EFFECT,
  'exclusions.status': EXCLUSIONS_STATUS,
  'evaluation_assignments.status': EVALUATION_ASSIGNMENTS_STATUS,
  'evaluation_scores.status': EVALUATION_SCORES_STATUS,
  'moderation_sessions.method': MODERATION_SESSIONS_METHOD,
  'moderation_sessions.status': MODERATION_SESSIONS_STATUS,
  'commercial_evaluations.affordability': COMMERCIAL_EVALUATIONS_AFFORDABILITY,
  'commercial_evaluations.status': COMMERCIAL_EVALUATIONS_STATUS,
  'evaluation_results.status': EVALUATION_RESULTS_STATUS,
  'evaluation_reports.status': EVALUATION_REPORTS_STATUS,
  'evaluation_report_signoffs.decision': EVALUATION_REPORT_SIGNOFFS_DECISION,
  'assessment_sessions.session_type': ASSESSMENT_SESSIONS_SESSION_TYPE,
  'assessment_sessions.assessment_basis': ASSESSMENT_SESSIONS_ASSESSMENT_BASIS,
  'assessment_sessions.status': ASSESSMENT_SESSIONS_STATUS,
  'assessment_invites.status': ASSESSMENT_INVITES_STATUS,
  'assessment_findings.effect': ASSESSMENT_FINDINGS_EFFECT,
  'shortlists.status': SHORTLISTS_STATUS,
  'preferred_bidders.status': PREFERRED_BIDDERS_STATUS,
  'due_diligence_cases.status': DUE_DILIGENCE_CASES_STATUS,
  'due_diligence_findings.area': DUE_DILIGENCE_FINDINGS_AREA,
  'due_diligence_findings.disposition': DUE_DILIGENCE_FINDINGS_DISPOSITION,
  'negotiations.status': NEGOTIATIONS_STATUS,
  'final_offer_rounds.status': FINAL_OFFER_ROUNDS_STATUS,
  'process_decisions.decision_type': PROCESS_DECISIONS_DECISION_TYPE,
  'process_decisions.status': PROCESS_DECISIONS_STATUS,
  'award_recommendations.status': AWARD_RECOMMENDATIONS_STATUS,
  'lot_outcomes.outcome': LOT_OUTCOMES_OUTCOME,
  'lot_outcomes.status': LOT_OUTCOMES_STATUS,
  'standstill_periods.status': STANDSTILL_PERIODS_STATUS,
  'debrief_requests.status': DEBRIEF_REQUESTS_STATUS,
  'complaints.subject': COMPLAINTS_SUBJECT,
  'complaints.status': COMPLAINTS_STATUS,
  'complaints.outcome': COMPLAINTS_OUTCOME,
  'public_award_notices.status': PUBLIC_AWARD_NOTICES_STATUS,
  'event_closeouts.status': EVENT_CLOSEOUTS_STATUS,
  'contracts.status': CONTRACTS_STATUS,
  'contract_signatories.party': CONTRACT_SIGNATORIES_PARTY,
  'contract_signatories.status': CONTRACT_SIGNATORIES_STATUS,
  'contract_signatories.method': CONTRACT_SIGNATORIES_METHOD,
  'handovers.status': HANDOVERS_STATUS,
  'obligations.kind': OBLIGATIONS_KIND,
  'obligations.party': OBLIGATIONS_PARTY,
  'obligations.status': OBLIGATIONS_STATUS,
  'acceptance_decisions.decision': ACCEPTANCE_DECISIONS_DECISION,
  'performance_reviews.status': PERFORMANCE_REVIEWS_STATUS,
  'performance_reviews.overall_rating': PERFORMANCE_REVIEWS_OVERALL_RATING,
  'contract_incidents.incident_type': CONTRACT_INCIDENTS_INCIDENT_TYPE,
  'contract_incidents.severity': CONTRACT_INCIDENTS_SEVERITY,
  'contract_incidents.status': CONTRACT_INCIDENTS_STATUS,
  'improvement_actions.status': IMPROVEMENT_ACTIONS_STATUS,
  'contract_invoices.acceptance_status': CONTRACT_INVOICES_ACCEPTANCE_STATUS,
  'contract_invoices.payment_status': CONTRACT_INVOICES_PAYMENT_STATUS,
  'contract_invoices.source': CONTRACT_INVOICES_SOURCE,
  'change_requests.raised_by_party': CHANGE_REQUESTS_RAISED_BY_PARTY,
  'change_requests.status': CHANGE_REQUESTS_STATUS,
  'contract_disputes.dispute_type': CONTRACT_DISPUTES_DISPUTE_TYPE,
  'contract_disputes.status': CONTRACT_DISPUTES_STATUS,
  'renewal_options.option_type': RENEWAL_OPTIONS_OPTION_TYPE,
  'renewal_options.status': RENEWAL_OPTIONS_STATUS,
  'renewal_options.decision': RENEWAL_OPTIONS_DECISION,
  'contract_securities.security_type': CONTRACT_SECURITIES_SECURITY_TYPE,
  'contract_securities.status': CONTRACT_SECURITIES_STATUS,
  'contract_closeouts.status': CONTRACT_CLOSEOUTS_STATUS,
  'disposal_requests.status': DISPOSAL_REQUESTS_STATUS,
  'exports.export_type': EXPORTS_EXPORT_TYPE,
  'exports.format': EXPORTS_FORMAT,
  'exports.status': EXPORTS_STATUS,
  'report_definitions.family': REPORT_DEFINITIONS_FAMILY,
  'integration_connections.system_type': INTEGRATION_CONNECTIONS_SYSTEM_TYPE,
  'integration_connections.status': INTEGRATION_CONNECTIONS_STATUS,
  'integration_exceptions.status': INTEGRATION_EXCEPTIONS_STATUS,
  'import_batches.record_type': IMPORT_BATCHES_RECORD_TYPE,
  'import_batches.status': IMPORT_BATCHES_STATUS,
  'import_records.decision': IMPORT_RECORDS_DECISION,
  'subscriptions.status': SUBSCRIPTIONS_STATUS,
  'offboarding_plans.status': OFFBOARDING_PLANS_STATUS,
  'support_cases.category': SUPPORT_CASES_CATEGORY,
  'support_cases.status': SUPPORT_CASES_STATUS,
  'support_access_grants.scope': SUPPORT_ACCESS_GRANTS_SCOPE,
  'support_access_grants.status': SUPPORT_ACCESS_GRANTS_STATUS,
  'service_incidents.status': SERVICE_INCIDENTS_STATUS,
  'announcements.audience': ANNOUNCEMENTS_AUDIENCE,
  'announcements.status': ANNOUNCEMENTS_STATUS,
  'help_articles.audience': HELP_ARTICLES_AUDIENCE,
  'help_articles.topic': HELP_ARTICLES_TOPIC,
  'help_articles.status': HELP_ARTICLES_STATUS,
  'tenders.procedure': TENDERS_PROCEDURE,
  'policy_profile_versions.permitted_procedures': POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES,
  'v_qualification_status.effective_status': V_QUALIFICATION_STATUS_EFFECTIVE_STATUS,
  'holds.blocked_actions': HOLDS_BLOCKED_ACTIONS,
  'notification_rules.event_type': NOTIFICATION_RULES_EVENT_TYPE,
  'documents.related_type': DOCUMENTS_RELATED_TYPE,
  'evidence_items.freshness': EVIDENCE_FRESHNESS,
  'supplier_verification_requests.status': VERIFICATION_REQUEST_STATUSES,
  'supplier_claim_invitations.state': CLAIM_INVITATION_STATES,
  'service_incidents.severity': SERVICE_INCIDENT_SEVERITIES,
  'subscriptions.plan_code': PLAN_CODES,
  'invoices.status': INVOICE_STATUSES,
  'service_actions.status': SERVICE_ACTION_STATUSES,
  'onboarding_items.area': ONBOARDING_ITEM_AREAS,
  'onboarding_items.status': ONBOARDING_ITEM_STATUSES,
  'privileged_access_reviews.status': ACCESS_REVIEW_STATUSES,
  'privileged_access_reviews.outcome': ACCESS_REVIEW_OUTCOMES,
  'conduct_cases.kind': CONDUCT_CASE_KINDS,
  'conduct_cases.status': CONDUCT_CASE_STATUSES,
  'access_items.status': ACCESS_ITEM_STATUSES,
  'contact_change_requests.status': CONTACT_CHANGE_STATUSES,
  'access_findings.finding_type': ACCESS_FINDING_TYPES,
  'access_findings.severity': FINDING_SEVERITIES,
  'release_checks.readiness': READINESS_CHECK_STATUS,
  'qualification_applications.priority': QUALIFICATION_APPLICATIONS_PRIORITY,
  'envelope_openings.envelope': ENVELOPE_OPENINGS_ENVELOPE,
} as const satisfies Record<string, readonly [string, ...string[]]>;

/** An enumeration name (`table.column`). */
export type EnumName = keyof typeof ENUMS;
/** The values of one enumeration. */
export type EnumValue<N extends EnumName> = (typeof ENUMS)[N][number];

/** Enumerations fixed by the contracts rather than by a blueprint CHECK list. */
export const CONTRACT_DEFINED_ENUMS = [
  'tenders.procedure',
  'policy_profile_versions.permitted_procedures',
  'v_qualification_status.effective_status',
  'holds.blocked_actions',
  'notification_rules.event_type',
  'documents.related_type',
  'evidence_items.freshness',
  'supplier_verification_requests.status',
  'supplier_claim_invitations.state',
  'service_incidents.severity',
  'subscriptions.plan_code',
  'invoices.status',
  'service_actions.status',
  'onboarding_items.area',
  'onboarding_items.status',
  'privileged_access_reviews.status',
  'privileged_access_reviews.outcome',
  'conduct_cases.kind',
  'conduct_cases.status',
  'access_items.status',
  'contact_change_requests.status',
  'access_findings.finding_type',
  'access_findings.severity',
  'release_checks.readiness',
  'qualification_applications.priority',
  'envelope_openings.envelope',
] as const satisfies readonly EnumName[];

const ENUM_NAMES: readonly string[] = Object.keys(ENUMS);

/** Type guard for an enumeration name. */
export function isEnumName(name: string): name is EnumName {
  return ENUM_NAMES.includes(name);
}

/** The values of an enumeration, in declaration order. */
export function enumValues<N extends EnumName>(name: N): (typeof ENUMS)[N] {
  return ENUMS[name];
}

/** True when `value` belongs to the enumeration. */
export function isEnumValue<N extends EnumName>(name: N, value: string): value is EnumValue<N> {
  const values: readonly string[] = ENUMS[name];
  return values.includes(value);
}

// ---------------------------------------------------------------------------------------------------------
// Display labels (English defaults; the SPA passes them through t(), DD-37)
// ---------------------------------------------------------------------------------------------------------

/** Words rendered with fixed spelling when a value is humanized. */
const WORD_LABELS: Readonly<Record<string, string>> = {
  rfi: 'RFI',
  rfq: 'RFQ',
  rfp: 'RFP',
  bafo: 'BAFO',
  fx: 'FX',
  bi: 'BI',
  xlsx: 'XLSX',
  csv: 'CSV',
  html: 'HTML',
  esignature: 'e-signature',
  signoff: 'sign-off',
  calloff: 'call-off',
  noncompliance: 'non-compliance',
};

/** Whole values whose label is not a plain humanization, whatever the enumeration. */
const VALUE_LABELS: Readonly<Record<string, string>> = {
  in_app: 'In-app',
  yes_no: 'Yes / no',
  one_time: 'One-time',
  late_rejected: 'Late / rejected',
  no_bid: 'No bid',
  per_lot: 'Per lot',
  single_stage: 'Single stage',
  multi_stage: 'Multi-stage',
  invitation_only: 'Invitation only',
  framework_calloff: 'Framework call-off',
  re_tender: 'Re-tender',
  follow_on: 'Follow-on',
  from_rfi: 'From RFI',
  non_material: 'Non-material',
  social_environmental: 'Social and environmental',
  key_personnel: 'Key personnel',
  vendor_master: 'Vendor master',
  past_due: 'Past due',
};

/** Labels that differ per enumeration, taken from the PRD wording (§8). */
const ENUM_LABEL_OVERRIDES: { readonly [N in EnumName]?: Partial<Record<EnumValue<N>, string>> } = {
  'tenders.status': {
    ready: 'Ready / scheduled',
    closed: 'Closed / awaiting opening',
    award_pending: 'Award decision pending',
  },
  'lots.stage': { closed: 'Closed / awaiting opening', award_pending: 'Award decision pending' },
  'procurement_requests.status': { routed_to_existing: 'Routed to existing arrangement' },
  'approval_requests.status': { invalidated: 'Invalidated by change' },
  'approval_steps.status': { invalidated: 'Invalidated by change' },
  'evaluation_assignments.status': { returned: 'Returned for correction' },
  'contracts.status': { signed_not_effective: 'Signed, not yet effective' },
  'obligations.status': { waived: 'Waived by authorized decision' },
  'notification_deliveries.status': { not_configured: 'Channel not configured' },
  'bids.submission_state': { not_submitted: 'Not submitted' },
  'pursuits.decision': { bid: 'Bid' },
  'users.theme': { light: 'Light', dark: 'Dark' },
  'tenders.event_type': { tender: 'Tender' },
  'procurement_strategies.event_type': { tender: 'Tender' },
  'opening_sessions.envelope': { all: 'All envelopes (single stage)' },
  'submission_attempts.outcome': {
    failed_error: 'Failed (service error)',
    failed_late: 'Rejected as late',
    failed_validation: 'Failed validation',
    failed_authority: 'No submit authority',
  },
  'evidence_items.freshness': { no_expiry: 'No expiry' },
  'subscriptions.plan_code': { buyer_standard: 'Buyer standard', buyer_enterprise: 'Buyer enterprise' },
  'access_items.status': { expiring_soon: 'Expiring soon' },
};

/** Turns `awaiting_release_approval` into `Awaiting release approval`. */
export function humanizeEnumValue(value: string): string {
  const fixed = VALUE_LABELS[value];
  if (fixed !== undefined) {
    return fixed;
  }
  const words = value.split('_').map((word) => WORD_LABELS[word] ?? word);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The display label of an enumeration value. Unknown values are humanized, never dropped. */
export function enumLabel<N extends EnumName>(name: N, value: EnumValue<N> | (string & {})): string {
  const overrides: Partial<Record<string, string>> | undefined = ENUM_LABEL_OVERRIDES[name];
  return overrides?.[value] ?? humanizeEnumValue(value);
}

/** `{ value, label }` pairs for select inputs, in declaration order. */
export function enumOptions<N extends EnumName>(
  name: N,
): ReadonlyArray<{ readonly value: EnumValue<N>; readonly label: string }> {
  const values: readonly EnumValue<N>[] = ENUMS[name];
  return values.map((value) => ({ value, label: enumLabel(name, value) }));
}

// ---------------------------------------------------------------------------------------------------------
// StatusChip tones
// ---------------------------------------------------------------------------------------------------------

/** Tone by value, whatever the enumeration. Values not listed fall through to the prefix rules. */
const VALUE_TONES: Readonly<Record<string, ChipTone>> = {
  // completed, positive decisions
  approved: 'success',
  approved_with_conditions: 'success',
  approved_internally: 'success',
  active: 'success',
  passed: 'success',
  pass: 'success',
  qualified: 'success',
  completed: 'success',
  complete: 'success',
  accepted: 'success',
  awarded: 'success',
  partially_awarded: 'success',
  final_awarded: 'success',
  award: 'success',
  partial_award: 'success',
  signed: 'success',
  signed_off: 'success',
  confirmed: 'success',
  delivered: 'success',
  succeeded: 'success',
  resolved: 'success',
  cleared: 'success',
  mitigated: 'success',
  met: 'success',
  meets: 'success',
  exceeds: 'success',
  compliant: 'success',
  current: 'success',
  published: 'success',
  issued: 'success',
  converted: 'success',
  agreed: 'success',
  incorporated: 'success',
  paid: 'success',
  finalized: 'success',
  evaluated: 'success',
  done: 'success',
  attended: 'success',
  granted: 'success',
  live: 'success',
  adequate: 'success',
  no_match: 'success',
  within_budget: 'success',
  independently_verified: 'success',
  identity_verified: 'success',
  reconciled: 'success',
  gate_passed: 'success',
  claim_verified: 'success',
  satisfied: 'success',
  no_issue: 'success',
  answered: 'success',
  responded: 'success',
  provided: 'success',
  decided: 'success',
  converted_to_award: 'success',
  recorded_external: 'success',
  // active work, in-flight states
  submitted: 'info',
  received: 'info',
  acknowledged: 'info',
  under_review: 'info',
  in_review: 'info',
  in_signoff: 'info',
  internal_review: 'info',
  impact_assessment: 'info',
  admissibility_review: 'info',
  evidence_submitted: 'info',
  in_progress: 'info',
  in_evaluation: 'info',
  reviewing: 'info',
  scheduled: 'info',
  running: 'info',
  queued: 'info',
  investigating: 'info',
  identified: 'info',
  monitoring: 'info',
  assigned: 'info',
  draft_answer: 'info',
  invited: 'info',
  registered: 'info',
  requested: 'info',
  proposed: 'info',
  recommended: 'info',
  intent_notified: 'info',
  shared_with_supplier: 'info',
  supplier_responded: 'info',
  negotiating: 'info',
  answered_privately: 'info',
  uploaded: 'info',
  available: 'info',
  trial: 'info',
  open: 'info',
  contact_verified: 'info',
  supplier_provided: 'info',
  appealed: 'info',
  response_issued: 'info',
  ready_for_decision: 'info',
  ready_for_review: 'info',
  selected_for_evaluation: 'accent',
  intends_to_bid: 'accent',
  bid: 'accent',
  ready: 'accent',
  // attention needed
  pending: 'warning',
  pending_review: 'warning',
  pending_approval: 'warning',
  returned: 'warning',
  more_info_required: 'warning',
  information_requested: 'warning',
  clarification_needed: 'warning',
  clarification_required: 'warning',
  clarification_pending: 'warning',
  expiring: 'warning',
  possible_match: 'warning',
  deferred: 'warning',
  due: 'warning',
  escalated: 'warning',
  escalated_to_addendum: 'warning',
  unclear: 'warning',
  adequate_with_limitations: 'warning',
  partially_meets: 'warning',
  partially_accepted: 'warning',
  partially_upheld: 'warning',
  qualified_with_conditions: 'warning',
  conditional_award: 'warning',
  condition: 'warning',
  corrective_action: 'warning',
  restricted: 'warning',
  extended: 'warning',
  medium: 'warning',
  high: 'warning',
  award_pending: 'warning',
  awaiting_customer: 'warning',
  manual_fallback_used: 'warning',
  routed_to_buyer: 'warning',
  routed_to_existing: 'info',
  undecided: 'neutral',
  // failures, blocks and ends that need attention
  rejected: 'danger',
  failed: 'danger',
  fail: 'danger',
  overdue: 'danger',
  expired: 'danger',
  cancelled: 'danger',
  terminated: 'danger',
  suspended: 'danger',
  excluded: 'danger',
  not_qualified: 'danger',
  does_not_meet: 'danger',
  non_compliant: 'danger',
  late_rejected: 'danger',
  revoked: 'danger',
  denied: 'danger',
  blocked: 'danger',
  invalidated: 'danger',
  failed_diligence: 'danger',
  confirmed_restriction: 'danger',
  called: 'danger',
  breach: 'danger',
  critical: 'danger',
  urgent: 'danger',
  inadequate: 'danger',
  not_met: 'danger',
  disputed: 'danger',
  refused: 'danger',
  aborted: 'danger',
  no_show: 'danger',
  claim_not_verified: 'danger',
  exceeds_budget: 'danger',
  past_due: 'danger',
  not_resolved: 'danger',
  unresolved: 'danger',
  upheld: 'danger',
  recused: 'neutral-outlined',
  // finished, superseded or not applicable
  withdrawn: 'neutral-outlined',
  superseded: 'neutral-outlined',
  archived: 'neutral-outlined',
  retired: 'neutral-outlined',
  closed: 'neutral-outlined',
  not_applicable: 'neutral-outlined',
  skipped: 'neutral-outlined',
  reissued: 'neutral-outlined',
  replaced: 'neutral-outlined',
  reassigned: 'neutral-outlined',
  not_exercised: 'neutral-outlined',
  inactive: 'neutral-outlined',
  ended: 'neutral-outlined',
  deactivated: 'neutral-outlined',
  dismissed: 'neutral-outlined',
  declined: 'neutral-outlined',
  no_bid: 'neutral-outlined',
  not_offered: 'neutral-outlined',
  information_collected: 'neutral-outlined',
  completed_without_award: 'neutral-outlined',
  no_award: 'neutral-outlined',
  not_duplicate: 'neutral-outlined',
  merged: 'neutral-outlined',
  executed: 'neutral-outlined',
  absent: 'neutral-outlined',
  redacted: 'neutral-outlined',
  released: 'neutral-outlined',
  not_configured: 'neutral-outlined',
  inadmissible: 'neutral-outlined',
  let_expire: 'neutral-outlined',
  // not started
  draft: 'neutral',
  not_started: 'neutral',
  planned: 'neutral',
  planning: 'neutral',
  none: 'neutral',
  not_assessed: 'neutral',
  not_required: 'neutral',
  not_invited: 'neutral',
  not_submitted: 'neutral',
  unverified: 'neutral',
  low: 'neutral',
  normal: 'neutral',
};

/** Tones that differ per enumeration. */
const ENUM_TONE_OVERRIDES: { readonly [N in EnumName]?: Partial<Record<EnumValue<N>, ChipTone>> } = {
  'tenders.status': { open: 'accent', closed: 'info', under_assessment: 'info', ready: 'accent' },
  'lots.stage': { open: 'accent', closed: 'info', under_assessment: 'info' },
  'tasks.status': { open: 'info', returned: 'warning' },
  'tenants.onboarding_stage': { pilot: 'info', setup: 'neutral', configuring: 'info', offboarding: 'warning' },
  'tenants.status': { offboarding: 'warning', pending: 'warning' },
  'memberships.status': { invited: 'info', pending_approval: 'warning' },
  'contract_securities.status': { released: 'success' },
  'holds.hold_type': {
    procurement_hold: 'warning',
    complaint_hold: 'warning',
    suspension: 'danger',
    legal_hold: 'warning',
    investigation_hold: 'warning',
  },
  'complaints.outcome': { upheld: 'warning', dismissed: 'neutral-outlined' },
  'contract_incidents.severity': { high: 'danger' },
  'procurement_requests.priority': { high: 'warning', critical: 'danger' },
  'tasks.priority': { high: 'warning' },
  'audit_log.sensitivity': { restricted: 'warning', normal: 'neutral' },
  'documents.classification': {
    public: 'success',
    participating_suppliers: 'info',
    supplier_private: 'neutral',
    buyer_internal: 'neutral',
    restricted_assessment: 'warning',
    commercially_confidential: 'warning',
    sealed: 'danger',
  },
  'evidence_items.sensitivity': { financial: 'warning', commercially_sensitive: 'warning' },
  'integration_exceptions.status': { open: 'warning' },
  'contract_incidents.status': { open: 'warning' },
  'improvement_actions.status': { open: 'info' },
  'duplicate_candidates.status': { open: 'warning' },
  'reassessment_triggers.status': { open: 'warning' },
};

const PREFIX_TONES: ReadonlyArray<readonly [string, ChipTone]> = [
  ['awaiting_', 'warning'],
  ['pending_', 'warning'],
  ['failed_', 'danger'],
  ['under_', 'info'],
  ['in_', 'info'],
  ['not_', 'neutral'],
];

const SUFFIX_TONES: ReadonlyArray<readonly [string, ChipTone]> = [
  ['_pending', 'warning'],
  ['_failed', 'danger'],
  ['_required', 'warning'],
];

/** The StatusChip tone of a value, whatever the enumeration, from the value rules alone. */
export function toneForValue(value: string): ChipTone {
  const direct = VALUE_TONES[value];
  if (direct !== undefined) {
    return direct;
  }
  for (const [prefix, tone] of PREFIX_TONES) {
    if (value.startsWith(prefix)) {
      return tone;
    }
  }
  for (const [suffix, tone] of SUFFIX_TONES) {
    if (value.endsWith(suffix)) {
      return tone;
    }
  }
  return 'neutral';
}

/** The StatusChip tone of an enumeration value. Every value of every enumeration has one. */
export function enumTone<N extends EnumName>(name: N, value: EnumValue<N> | (string & {})): ChipTone {
  const overrides: Partial<Record<string, ChipTone>> | undefined = ENUM_TONE_OVERRIDES[name];
  return overrides?.[value] ?? toneForValue(value);
}
