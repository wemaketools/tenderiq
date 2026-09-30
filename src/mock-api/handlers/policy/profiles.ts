/**
 * Mock handlers of the policy profile endpoints (ADM-06). Rows are filtered by the active buyer tenant (another
 * buyer's profile is simply not found); commands check the state the fixture implies and answer with the outcome
 * without persisting anything.
 */
import type { z } from 'zod';

import {
  approvePolicyVersion,
  comparePolicyVersions,
  createPolicyProfile,
  createPolicyVersion,
  getPolicyProfile,
  getPolicyVersion,
  listPolicyProfiles,
  listPolicyVersionOptions,
  retirePolicyProfile,
  retirePolicyVersion,
  returnPolicyVersion,
  submitPolicyVersion,
  updatePolicyVersion,
} from '../../../contracts/policy.js';
import type {
  PolicyProfileDetail,
  PolicyProfileSummary,
  PolicyRuleChange,
  PolicyRulesInput,
  PolicyVersionDetail,
  PolicyVersionSummary,
} from '../../../contracts/policy.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { POLICY_PROFILES, POLICY_VERSIONS, tenderRef } from '../../fixtures/policy.js';
import type { FixturePolicyProfile, FixturePolicyVersion } from '../../fixtures/policy.js';
import { personRef } from '../../persona.js';
import type { TenantAccess } from '../../persona.js';
import { holds, matchesText, selfApprovalFor, sortRows, withinRange } from './common.js';

type Detail = z.input<typeof PolicyVersionDetail>;

const NEW_PROFILE_ID = 900;
const NEW_VERSION_ID = 901;

function profilesOf(tenantId: number): FixturePolicyProfile[] {
  return POLICY_PROFILES.filter((profile) => profile.tenantId === tenantId);
}

function versionsOf(profileId: number): FixturePolicyVersion[] {
  return POLICY_VERSIONS.filter((version) => version.profileId === profileId).sort((a, b) => b.versionNo - a.versionNo);
}

function isPending(version: FixturePolicyVersion): boolean {
  return version.status === 'draft' || version.status === 'in_review';
}

function personOrNull(userId: number | null): { userId: number; fullName: string } | null {
  return userId === null ? null : personRef(userId);
}

function versionSummary(version: FixturePolicyVersion, profile: FixturePolicyProfile): PolicyVersionSummary {
  return {
    id: version.id,
    profileId: version.profileId,
    versionNo: version.versionNo,
    status: version.status,
    isCurrent: profile.currentVersionId === version.id,
    createdBy: personOrNull(version.createdBy),
    createdAt: version.createdAt,
    submittedBy: personOrNull(version.submittedBy),
    submittedAt: version.submittedAt,
    approvedBy: personOrNull(version.approvedBy),
    approvedAt: version.approvedAt,
    effectiveFrom: version.effectiveFrom,
    retiredAt: version.retiredAt,
    usageCount: version.tenders.length + version.strategies.length,
  };
}

function profileSummary(profile: FixturePolicyProfile, versions: readonly FixturePolicyVersion[]): PolicyProfileSummary {
  const current = versions.find((version) => version.id === profile.currentVersionId) ?? null;
  const pending = versions.find(isPending) ?? null;
  const reference = current ?? versions[0];
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    status: profile.status,
    currentVersion: current === null ? null : versionSummary(current, profile),
    pendingVersion: pending === null ? null : versionSummary(pending, profile),
    versionCount: versions.length,
    permittedProcedures: reference === undefined ? [] : [...reference.rules.permittedProcedures],
    usageCount: versions.reduce((total, version) => total + version.tenders.length, 0),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function profileDetail(
  profile: FixturePolicyProfile,
  versions: readonly FixturePolicyVersion[],
  access: TenantAccess,
): PolicyProfileDetail {
  const active = profile.status === 'active';
  const manage = holds(access, 'org.policy.manage');
  return {
    ...profileSummary(profile, versions),
    versions: versions.map((version) => versionSummary(version, profile)),
    retiredAt: profile.retiredAt,
    retirementReason: profile.retirementReason,
    capabilities: {
      canDraftVersion: manage && active && !versions.some(isPending),
      canRetire: manage && active && !versions.some((version) => version.status === 'in_review'),
    },
  };
}

function versionDetail(
  version: FixturePolicyVersion,
  profile: FixturePolicyProfile,
  access: TenantAccess,
  userId: number,
): Detail {
  const manage = holds(access, 'org.policy.manage');
  const approve = holds(access, 'org.policy.approve');
  const inReview = version.status === 'in_review';
  const decision = approve && inReview ? selfApprovalFor(access, userId, version.submittedBy, 'org.policy.approve', 'version') : null;
  const summary = versionSummary(version, profile);
  return {
    ...summary,
    profileName: profile.name,
    profileStatus: profile.status,
    rules: {
      ...version.rules,
      thresholds: version.rules.thresholds.map((threshold, index) => ({ id: version.id * 100 + index + 1, ...threshold })),
    },
    approvalRequestId: version.approvalRequestId,
    returnedReason: version.returnedReason,
    tenders: version.tenders.map((usage) => {
      const tender = tenderRef(usage.tenderId);
      return {
        tenderId: tender.tenderId,
        reference: tender.reference,
        title: tender.title,
        status: tender.status,
        frozen: usage.frozen,
        releasedAt: usage.frozen ? tender.releasedAt : null,
      };
    }),
    strategies: version.strategies.map((strategy) => ({ ...strategy })),
    capabilities: {
      canEdit: manage && version.status === 'draft' && profile.status === 'active',
      canSubmit: manage && version.status === 'draft' && profile.status === 'active',
      canApprove: approve && inReview && decision !== null && decision.allowed,
      canReturn: approve && inReview,
      canRetire: manage && version.status === 'approved' && !summary.isCurrent,
      approvalBlockedReason: decision?.blockedReason ?? null,
      alternativeOversightNote: decision?.oversightNote ?? null,
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------------------------------------

const RULE_LABELS: ReadonlyArray<[keyof Omit<PolicyRulesInput, 'thresholds'>, string]> = [
  ['permittedProcedures', 'Permitted procedures'],
  ['requiresReleaseApproval', 'Release approval required'],
  ['stagedOpeningDefault', 'Staged opening by default'],
  ['openingQuorum', 'Opening quorum'],
  ['openingRequiresSecondPerson', 'Second person at opening'],
  ['independentEvaluation', 'Independent evaluation'],
  ['negotiationPermitted', 'Negotiation permitted'],
  ['bafoPermitted', 'Best-and-final offers permitted'],
  ['lateSubmissionPolicy', 'Late submissions'],
  ['questionDeadlineDaysBeforeClose', 'Question deadline (days before closing)'],
  ['minResponseDays', 'Minimum response period (days)'],
  ['standstillRequired', 'Standstill required'],
  ['standstillLength', 'Standstill length'],
  ['standstillDayType', 'Standstill day type'],
  ['complaintWindowDays', 'Complaint window (days)'],
  ['complaintRequiresIndependentReview', 'Independent complaint review'],
  ['publicAwardNoticeRequired', 'Public award notice required'],
  ['approvalRouteNote', 'Approval route'],
];

function renderRule(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function renderThresholds(rules: PolicyRulesInput): string {
  return rules.thresholds
    .map((band) => `${band.procedure}: ${band.currency} ${band.minValue}–${band.maxValue ?? '∞'} → ${band.requiredApprovalLevel}${band.requiresPublicNotice ? ' (public notice)' : ''}`)
    .join('; ');
}

export function ruleChanges(base: PolicyRulesInput, target: PolicyRulesInput): PolicyRuleChange[] {
  const changes: PolicyRuleChange[] = [];
  for (const [key, label] of RULE_LABELS) {
    const before = renderRule(base[key]);
    const after = renderRule(target[key]);
    if (before !== after) changes.push({ rule: label, before, after });
  }
  const beforeBands = renderThresholds(base);
  const afterBands = renderThresholds(target);
  if (beforeBands !== afterBands) changes.push({ rule: 'Value thresholds', before: beforeBands, after: afterBands });
  return changes;
}

// ---------------------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------------------

export function registerProfiles(app: MockApp): void {
  function findProfile(tenantId: number, profileId: number): FixturePolicyProfile | undefined {
    return profilesOf(tenantId).find((profile) => profile.id === profileId);
  }

  mockRoute(app, listPolicyProfiles, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = profilesOf(tenant.id)
      .map((profile) => ({ profile, versions: versionsOf(profile.id) }))
      .filter(({ profile }) => matchesText(query.q, profile.name, profile.description))
      .filter(({ profile }) => query.status === undefined || query.status.includes(profile.status))
      .filter(
        ({ versions }) =>
          query.versionStatus === undefined || versions.some((version) => query.versionStatus?.includes(version.status) === true),
      )
      .filter(
        ({ versions }) =>
          query.procedure === undefined ||
          versions.some((version) => version.rules.permittedProcedures.some((procedure) => query.procedure?.includes(procedure) === true)),
      )
      .filter(({ profile }) => withinRange(profile.updatedAt, query.updatedFrom, query.updatedTo))
      .map(({ profile, versions }) => profileSummary(profile, versions));
    const sort = query.sort ?? 'name';
    const sorted = sortRows(rows, (row) => (sort === 'usageCount' ? row.usageCount : row[sort]), query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, getPolicyProfile, ({ requireTenant, params, fail }) => {
    const access = requireTenant();
    const profile = findProfile(access.tenant.id, params.profileId);
    if (profile === undefined) return fail(404, 'POLICY_PROFILE_NOT_FOUND', 'No policy profile with this id.');
    return profileDetail(profile, versionsOf(profile.id), access);
  });

  function findVersion(
    access: TenantAccess,
    profileId: number,
    versionId: number,
    fail: (status: number, code: string, detail?: string) => never,
  ): { profile: FixturePolicyProfile; version: FixturePolicyVersion } {
    const profile = findProfile(access.tenant.id, profileId);
    if (profile === undefined) return fail(404, 'POLICY_PROFILE_NOT_FOUND', 'No policy profile with this id.');
    const version = versionsOf(profile.id).find((row) => row.id === versionId);
    if (version === undefined) return fail(404, 'POLICY_VERSION_NOT_FOUND', 'No version with this id in the profile.');
    return { profile, version };
  }

  mockRoute(app, getPolicyVersion, ({ requireTenant, requirePersona, params, fail }) => {
    const access = requireTenant();
    const { profile, version } = findVersion(access, params.profileId, params.versionId, fail);
    return versionDetail(version, profile, access, requirePersona().userId);
  });

  mockRoute(app, comparePolicyVersions, ({ requireTenant, params, query, fail }) => {
    const access = requireTenant();
    const { profile, version } = findVersion(access, params.profileId, params.versionId, fail);
    const baseId = query.against ?? profile.currentVersionId;
    const base = baseId === null ? undefined : versionsOf(profile.id).find((row) => row.id === baseId);
    if (baseId !== null && query.against !== undefined && base === undefined) {
      return fail(404, 'POLICY_VERSION_NOT_FOUND', 'The comparison version is not in this profile.');
    }
    const effectiveBase = base !== undefined && base.id !== version.id ? base : versionsOf(profile.id).find((row) => row.versionNo < version.versionNo);
    if (effectiveBase === undefined) return fail(409, 'NO_BASE_VERSION', 'There is no earlier version to compare with.');
    return {
      profileId: profile.id,
      base: versionSummary(effectiveBase, profile),
      target: versionSummary(version, profile),
      changes: ruleChanges(effectiveBase.rules, version.rules),
    };
  });

  mockRoute(app, createPolicyProfile, ({ requireTenant, requirePersona, body, now, fail }) => {
    const access = requireTenant();
    const name = body.name.trim();
    if (profilesOf(access.tenant.id).some((profile) => profile.name.toLowerCase() === name.toLowerCase())) {
      return fail(409, 'POLICY_PROFILE_NAME_TAKEN', 'A policy profile with this name already exists.');
    }
    const at = now.toISOString();
    const userId = requirePersona().userId;
    const profile: FixturePolicyProfile = {
      id: NEW_PROFILE_ID, tenantId: access.tenant.id, name, description: body.description, status: 'active',
      currentVersionId: null, createdAt: at, updatedAt: at, retiredAt: null, retirementReason: null,
    };
    const version: FixturePolicyVersion = {
      id: NEW_VERSION_ID, tenantId: access.tenant.id, profileId: NEW_PROFILE_ID, versionNo: 1, status: 'draft', rules: body.rules,
      createdBy: userId, createdAt: at, submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null,
      effectiveFrom: null, retiredAt: null, approvalRequestId: null, returnedReason: null, tenders: [], strategies: [],
    };
    return profileDetail(profile, [version], access);
  });

  mockRoute(app, createPolicyVersion, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const profile = findProfile(access.tenant.id, params.profileId);
    if (profile === undefined) return fail(404, 'POLICY_PROFILE_NOT_FOUND', 'No policy profile with this id.');
    if (profile.status === 'retired') return fail(409, 'POLICY_PROFILE_RETIRED', 'A retired profile cannot get new versions.');
    const versions = versionsOf(profile.id);
    if (versions.some(isPending)) {
      return fail(409, 'POLICY_DRAFT_EXISTS', 'Finish or return the version that is already in preparation first.');
    }
    const sourceId = body.fromVersionId ?? profile.currentVersionId;
    const source = versions.find((row) => row.id === sourceId);
    if (source === undefined) return fail(404, 'POLICY_VERSION_NOT_FOUND', 'The source version is not in this profile.');
    const draft: FixturePolicyVersion = {
      ...source,
      id: NEW_VERSION_ID, versionNo: (versions[0]?.versionNo ?? 0) + 1, status: 'draft', createdBy: requirePersona().userId,
      createdAt: now.toISOString(), submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null, effectiveFrom: null,
      retiredAt: null, approvalRequestId: null, returnedReason: null, tenders: [], strategies: [],
    };
    return versionDetail(draft, profile, access, requirePersona().userId);
  });

  mockRoute(app, updatePolicyVersion, ({ requireTenant, requirePersona, params, body, fail }) => {
    const access = requireTenant();
    const { profile, version } = findVersion(access, params.profileId, params.versionId, fail);
    if (version.status === 'approved' || version.status === 'retired') {
      return fail(409, 'POLICY_VERSION_IMMUTABLE', 'An approved or retired version cannot change; draft a new version instead.');
    }
    if (version.status === 'in_review') {
      return fail(409, 'POLICY_VERSION_IN_REVIEW', 'The version is in review; ask the approver to return it before editing.');
    }
    return versionDetail({ ...version, rules: body.rules }, profile, access, requirePersona().userId);
  });

  mockRoute(app, submitPolicyVersion, ({ requireTenant, requirePersona, params, now, fail }) => {
    const access = requireTenant();
    const { profile, version } = findVersion(access, params.profileId, params.versionId, fail);
    if (version.status !== 'draft') return fail(409, 'POLICY_VERSION_NOT_DRAFT', 'Only a draft version can be submitted.');
    if (profile.status === 'retired') return fail(409, 'POLICY_PROFILE_RETIRED', 'The profile is retired.');
    const userId = requirePersona().userId;
    return versionDetail(
      { ...version, status: 'in_review', submittedBy: userId, submittedAt: now.toISOString(), returnedReason: null, approvalRequestId: null },
      profile,
      access,
      userId,
    );
  });

  mockRoute(app, approvePolicyVersion, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const { profile, version } = findVersion(access, params.profileId, params.versionId, fail);
    const userId = requirePersona().userId;
    if (version.status !== 'in_review') return fail(409, 'POLICY_VERSION_NOT_IN_REVIEW', 'Only a version in review can be approved.');
    const decision = selfApprovalFor(access, userId, version.submittedBy, 'org.policy.approve', 'version');
    if (!decision.allowed) return fail(403, 'SOD_SELF_APPROVAL_BLOCKED', decision.blockedReason ?? undefined);
    const effectiveFrom = body.effectiveFrom ?? now.toISOString();
    if (Date.parse(effectiveFrom) < now.getTime() - 60_000) {
      return fail(422, 'EFFECTIVE_DATE_IN_PAST', 'A policy version cannot take effect retroactively.');
    }
    return versionDetail(
      { ...version, status: 'approved', approvedBy: userId, approvedAt: now.toISOString(), effectiveFrom },
      { ...profile, currentVersionId: version.id, updatedAt: now.toISOString() },
      access,
      userId,
    );
  });

  mockRoute(app, returnPolicyVersion, ({ requireTenant, requirePersona, params, body, fail }) => {
    const access = requireTenant();
    const { profile, version } = findVersion(access, params.profileId, params.versionId, fail);
    if (version.status !== 'in_review') return fail(409, 'POLICY_VERSION_NOT_IN_REVIEW', 'Only a version in review can be returned.');
    return versionDetail({ ...version, status: 'draft', returnedReason: body.reason }, profile, access, requirePersona().userId);
  });

  mockRoute(app, retirePolicyVersion, ({ requireTenant, requirePersona, params, now, fail }) => {
    const access = requireTenant();
    const { profile, version } = findVersion(access, params.profileId, params.versionId, fail);
    if (version.status !== 'approved') return fail(409, 'POLICY_VERSION_NOT_APPROVED', 'Only an approved version can be retired.');
    if (profile.currentVersionId === version.id) {
      return fail(409, 'POLICY_VERSION_IS_CURRENT', 'Approve a newer version or retire the profile before retiring the current version.');
    }
    return versionDetail({ ...version, status: 'retired', retiredAt: now.toISOString() }, profile, access, requirePersona().userId);
  });

  mockRoute(app, retirePolicyProfile, ({ requireTenant, params, body, now, fail }) => {
    const access = requireTenant();
    const profile = findProfile(access.tenant.id, params.profileId);
    if (profile === undefined) return fail(404, 'POLICY_PROFILE_NOT_FOUND', 'No policy profile with this id.');
    if (profile.status === 'retired') return fail(409, 'POLICY_PROFILE_RETIRED', 'The profile is already retired.');
    const versions = versionsOf(profile.id);
    if (versions.some((version) => version.status === 'in_review')) {
      return fail(409, 'POLICY_REVIEW_IN_PROGRESS', 'A version of this profile is in review; decide or return it first.');
    }
    const at = now.toISOString();
    return profileDetail(
      { ...profile, status: 'retired', retiredAt: at, retirementReason: body.reason, updatedAt: at },
      versions,
      access,
    );
  });

  mockRoute(app, listPolicyVersionOptions, ({ requireTenant, query }) => {
    const { tenant } = requireTenant();
    return profilesOf(tenant.id)
      .filter((profile) => profile.status === 'active' && profile.currentVersionId !== null)
      .flatMap((profile) => {
        const current = versionsOf(profile.id).find((version) => version.id === profile.currentVersionId);
        if (current === undefined || current.status !== 'approved') return [];
        if (query.procedure !== undefined && !current.rules.permittedProcedures.includes(query.procedure)) return [];
        return [
          {
            versionId: current.id,
            profileId: profile.id,
            profileName: profile.name,
            versionNo: current.versionNo,
            effectiveFrom: current.effectiveFrom,
            permittedProcedures: [...current.rules.permittedProcedures],
            requiresReleaseApproval: current.rules.requiresReleaseApproval,
            stagedOpeningDefault: current.rules.stagedOpeningDefault,
            minResponseDays: current.rules.minResponseDays,
          },
        ];
      })
      .sort((a, b) => a.profileName.localeCompare(b.profileName));
  });
}
