/**
 * Policy fixtures parse against the contract schemas and are internally consistent: tenants are buyers, people are
 * personas, every version belongs to a profile of the same tenant, current versions are approved, templates point at
 * existing versions and categories, and the approved portal settings keep every mandatory control visible.
 */
import { describe, expect, it } from 'vitest';

import {
  CreateCustomFieldBody,
  CustomFieldDefinition,
  MANDATORY_NOTICE_FIELD_KEYS,
  PolicyRulesInput,
  PortalSettings,
  PortalSettingsInput,
  TemplateChecklistItem,
  isCoreConditionSource,
} from '../../../contracts/policy.js';
import { findPersonaById, findTenantById } from '../../persona.js';
import {
  CUSTOM_FIELDS,
  POLICY_CATEGORY_REFS,
  POLICY_CONTRACT_REFS,
  POLICY_PROFILES,
  POLICY_TENDER_REFS,
  POLICY_VERSIONS,
  PORTAL_POLICIES,
  TEMPLATES,
  TEMPLATE_VERSIONS,
  CONFIGURATION_OVERSIGHT,
} from '../policy.js';

function isBuyer(tenantId: number): boolean {
  return findTenantById(tenantId)?.kind === 'buyer';
}

describe('policy profile fixtures', () => {
  it('parses every version rule set against the contract rules', () => {
    for (const version of POLICY_VERSIONS) {
      const result = PolicyRulesInput.safeParse(version.rules);
      expect(result.success, `version ${version.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it('keeps versions inside a profile of the same buyer, numbered without gaps', () => {
    for (const profile of POLICY_PROFILES) {
      expect(isBuyer(profile.tenantId)).toBe(true);
      const versions = POLICY_VERSIONS.filter((version) => version.profileId === profile.id);
      expect(versions.every((version) => version.tenantId === profile.tenantId)).toBe(true);
      expect(versions.map((version) => version.versionNo).sort()).toEqual(versions.map((_, index) => index + 1));
    }
    expect(POLICY_VERSIONS.every((version) => POLICY_PROFILES.some((profile) => profile.id === version.profileId))).toBe(true);
  });

  it('points every active profile at an approved current version and retired profiles at none', () => {
    for (const profile of POLICY_PROFILES) {
      const current = POLICY_VERSIONS.find((version) => version.id === profile.currentVersionId);
      if (profile.status === 'active') {
        expect(current?.status).toBe('approved');
      } else {
        expect(profile.currentVersionId).toBeNull();
      }
    }
  });

  it('names only personas, and records an approver for every approved version', () => {
    for (const version of POLICY_VERSIONS) {
      for (const userId of [version.createdBy, version.submittedBy, version.approvedBy]) {
        if (userId !== null) expect(findPersonaById(userId)).toBeDefined();
      }
      if (version.status === 'approved') expect(version.approvedBy).not.toBeNull();
    }
  });

  it('references only tenders of the same buyer, and only frozen versions carry released tenders', () => {
    for (const version of POLICY_VERSIONS) {
      for (const usage of version.tenders) {
        const tender = POLICY_TENDER_REFS.find((row) => row.tenderId === usage.tenderId);
        expect(tender?.tenantId).toBe(version.tenantId);
        expect(usage.frozen).toBe(tender?.releasedAt !== null);
      }
    }
  });

  it('keeps a KWU version in review that its sole approver can decide under the documented oversight', () => {
    const inReview = POLICY_VERSIONS.filter((version) => version.status === 'in_review' && version.tenantId === 2);
    expect(inReview.length).toBeGreaterThan(0);
    expect(CONFIGURATION_OVERSIGHT.some((row) => row.tenantId === 2)).toBe(true);
  });
});

describe('custom field fixtures', () => {
  it('parses every field as a contract definition and as a valid create body', () => {
    for (const field of CUSTOM_FIELDS) {
      expect(isBuyer(field.tenantId)).toBe(true);
      expect(CustomFieldDefinition.safeParse({ ...field, allowedValues: [...field.allowedValues] }).success).toBe(true);
      const body = CreateCustomFieldBody.safeParse({ ...field, allowedValues: [...field.allowedValues] });
      expect(body.success, `field ${field.key}: ${JSON.stringify(body.error?.issues)}`).toBe(true);
    }
  });

  it('uses unique keys per buyer form and conditions that resolve to a core field or another active field', () => {
    const keys = CUSTOM_FIELDS.map((field) => `${field.tenantId}:${field.entityType}:${field.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const field of CUSTOM_FIELDS.filter((row) => row.requiredMode === 'conditional')) {
      const source = field.requiredConditionField ?? '';
      const resolves =
        isCoreConditionSource(field.entityType, source) ||
        CUSTOM_FIELDS.some((other) => other.tenantId === field.tenantId && other.entityType === field.entityType && other.key === source && other.active);
      expect(resolves, field.key).toBe(true);
    }
  });

  it('never counts more issued records than values', () => {
    expect(CUSTOM_FIELDS.every((field) => field.issuedRecordCount <= field.valueCount)).toBe(true);
  });
});

describe('template fixtures', () => {
  it('keeps each template with its versions, a current version when approved, and known categories and owners', () => {
    for (const template of TEMPLATES) {
      expect(isBuyer(template.tenantId)).toBe(true);
      expect(findPersonaById(template.ownerUserId)?.memberships.some((membership) => membership.tenantId === template.tenantId)).toBe(true);
      const versions = TEMPLATE_VERSIONS.filter((version) => version.templateId === template.id);
      expect(versions.length).toBeGreaterThan(0);
      if (template.status === 'approved') {
        expect(versions.find((version) => version.id === template.currentVersionId)?.versionStatus).toBe('approved');
      }
      if (template.categoryId !== null) {
        expect(POLICY_CATEGORY_REFS.find((row) => row.categoryId === template.categoryId)?.tenantId).toBe(template.tenantId);
      }
    }
  });

  it('adopts only existing versions of records of the same buyer', () => {
    for (const template of TEMPLATES) {
      const versionNos = TEMPLATE_VERSIONS.filter((version) => version.templateId === template.id).map((version) => version.versionNo);
      for (const usage of template.usage) {
        expect(versionNos).toContain(usage.adoptedVersionNo);
        const record =
          usage.recordType === 'tender'
            ? POLICY_TENDER_REFS.find((row) => row.tenderId === usage.recordId)
            : POLICY_CONTRACT_REFS.find((row) => row.contractId === usage.recordId);
        expect(record?.tenantId).toBe(template.tenantId);
      }
    }
  });

  it('parses every checklist item and covers every template kind in KWU', () => {
    for (const version of TEMPLATE_VERSIONS) {
      for (const item of version.checklistItems) expect(TemplateChecklistItem.safeParse(item).success).toBe(true);
    }
    const kinds = new Set(TEMPLATES.filter((template) => template.tenantId === 2).map((template) => template.kind));
    expect(kinds.size).toBe(7);
  });
});

describe('portal policy fixtures', () => {
  it('parses approved and proposed settings and keeps every mandatory control visible', () => {
    for (const policy of PORTAL_POLICIES) {
      expect(isBuyer(policy.tenantId)).toBe(true);
      const settings = [policy.approved, ...(policy.proposal === null ? [] : [policy.proposal.settings])];
      for (const entry of settings) {
        expect(PortalSettings.safeParse(entry).success).toBe(true);
        const visible = entry.noticeFields.filter((field) => field.visible).map((field) => field.key);
        expect(MANDATORY_NOTICE_FIELD_KEYS.every((key) => visible.includes(key))).toBe(true);
        const input = PortalSettingsInput.safeParse({
          ...entry,
          visibleNoticeFields: visible,
          channels: entry.channels.filter((channel) => channel.enabled).map((channel) => channel.channel),
          externalNoticeDescription: entry.channels.find((channel) => channel.channel === 'external_notice')?.description ?? null,
        });
        expect(input.success, JSON.stringify(input.error?.issues)).toBe(true);
      }
    }
  });
});
