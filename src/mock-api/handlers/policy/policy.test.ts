/**
 * Policy mock handlers with REAL authentication (local Supabase Auth, DD-43): tenant isolation between KWU and ODC,
 * 403 for the wrong tenant kind and missing permissions, supplier and public audience isolation, and the business
 * errors every command declares.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import {
  CustomFieldForm,
  PolicyProfileDetail,
  PolicyProfilePage,
  PolicyVersionComparison,
  PolicyVersionDetail,
  PolicyVersionOption,
  PortalPolicy,
  PublicPortalPolicy,
  TemplateAuthoringOptions,
  TemplateDetail,
  TemplateOption,
  TemplatePage,
  CustomFieldPage,
  CustomFieldDetail,
  PORTAL_NOTICE_FIELD_KEYS,
  policyEndpoints as p,
} from '../../../contracts/policy.js';
import type { PortalSettingsInput } from '../../../contracts/policy.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

const ADMIN_KWU = 'admin.kwu@tenderiq.local';
const ADMIN_ODC = 'admin.odc@tenderiq.local';
const OFFICER = 'tebogo.officer@tenderiq.local';
const AUDITOR = 'pule.auditor@tenderiq.local';
const REQUESTER = 'kagiso.requester@tenderiq.local';
const SUPPLIER = 'tsodilo.bidmanager@tenderiq.local';
const OPERATOR = 'ops.admin@tenderiq.local';
const SUPPORT = 'support.agent@tenderiq.local';
const FINANCIAL_REVIEWER = 'lesego.finance@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

function codeOf(response: TestResponse): string | undefined {
  return Problem.parse(response.body).errors?.[0]?.code ?? (response.body as { code?: string }).code;
}

function problemCode(response: TestResponse): string {
  const body = response.body as { code?: string; errors?: Array<{ code: string }> };
  return body.code ?? body.errors?.[0]?.code ?? '';
}

describe('registration', () => {
  it('loads the policy module and serves all 43 endpoints', () => {
    expect(api.loaded).toContain('policy/index');
    expect(api.failed.map((failure) => failure.module)).not.toContain('policy/index');
    expect(api.endpointIds).toEqual(expect.arrayContaining(Object.values(p).map((endpoint) => endpoint.id)));
  });
});

describe('ADM-06 policy profiles', () => {
  it('lists only the active buyer’s profiles for the KWU administrator', async () => {
    // Act
    const response = await api.callAs(ADMIN_KWU, p.listPolicyProfiles, { tenant: 'kwu' });

    // Assert
    expect(response.status).toBe(200);
    const page = PolicyProfilePage.parse(response.body);
    expect(page.total).toBe(4);
    expect(page.items.map((row) => row.name)).not.toContain('ODC procurement rules 2026');
  });

  it('lists only ODC profiles for the ODC administrator and hides KWU profiles as not found', async () => {
    const list = PolicyProfilePage.parse((await api.callAs(ADMIN_ODC, p.listPolicyProfiles, { tenant: 'odc' })).body);
    expect(list.items.map((row) => row.name)).toEqual(['ODC procurement rules 2026']);
    const other = await api.callAs(ADMIN_ODC, p.getPolicyProfile, { tenant: 'odc', params: { profileId: 1 } });
    expect(other.status).toBe(404);
    expect(problemCode(other)).toBe('POLICY_PROFILE_NOT_FOUND');
  });

  it('filters by version status and sorts by usage', async () => {
    const response = await api.callAs(ADMIN_KWU, p.listPolicyProfiles, {
      tenant: 'kwu',
      query: { versionStatus: 'in_review', sort: 'usageCount', dir: 'desc' },
    });
    const page = PolicyProfilePage.parse(response.body);
    expect(page.items.map((row) => row.id)).toEqual([1, 2]);
  });

  it('answers 403 TENANT_ACCESS_DENIED when a KWU member names the ODC tenant', async () => {
    const response = await api.callAs(ADMIN_KWU, p.listPolicyProfiles, { tenant: 'odc' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('TENANT_ACCESS_DENIED');
  });

  it('answers 403 FORBIDDEN to a requester without policy permissions', async () => {
    const response = await api.callAs(REQUESTER, p.listPolicyProfiles, { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });

  it('lets the auditor read but not change a profile', async () => {
    const read = await api.callAs(AUDITOR, p.getPolicyProfile, { tenant: 'kwu', params: { profileId: 1 } });
    expect(read.status).toBe(200);
    expect(PolicyProfileDetail.parse(read.body).capabilities).toEqual({ canDraftVersion: false, canRetire: false });
    const retire = await api.callAs(AUDITOR, p.retirePolicyProfile, { tenant: 'kwu', params: { profileId: 3 }, body: { reason: 'x' } });
    expect(retire.status).toBe(403);
  });

  it('shows which tenders froze each version and which only propose it', async () => {
    const response = await api.callAs(ADMIN_KWU, p.getPolicyVersion, { tenant: 'kwu', params: { profileId: 1, versionId: 2 } });
    const version = PolicyVersionDetail.parse(response.body);
    expect(version.isCurrent).toBe(true);
    expect(version.tenders).toEqual([
      expect.objectContaining({ reference: 'T-2026-0008', frozen: true }),
      expect.objectContaining({ reference: 'T-2026-0005', frozen: false, status: 'awaiting_release_approval', releasedAt: null }),
      expect.objectContaining({ reference: 'T-2026-0012', frozen: false, status: 'draft', releasedAt: null }),
    ]);
    expect(version.capabilities.canEdit).toBe(false);
  });

  it('refuses edits to an approved version as immutable', async () => {
    const current = PolicyVersionDetail.parse(
      (await api.callAs(ADMIN_KWU, p.getPolicyVersion, { tenant: 'kwu', params: { profileId: 1, versionId: 2 } })).body,
    );
    const { thresholds, ...rules } = current.rules;
    const response = await api.callAs(ADMIN_KWU, p.updatePolicyVersion, {
      tenant: 'kwu',
      params: { profileId: 1, versionId: 2 },
      body: { rules: { ...rules, thresholds: thresholds.map(({ id: _id, ...band }) => band) } },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('POLICY_VERSION_IMMUTABLE');
  });

  it('lets the sole approver approve their own version when alternative oversight is documented (BR-07)', async () => {
    const own = await api.callAs(ADMIN_KWU, p.approvePolicyVersion, { tenant: 'kwu', params: { profileId: 2, versionId: 5 }, body: {} });
    expect(own.status).toBe(200);
    const approved = PolicyVersionDetail.parse(own.body);
    expect(approved).toMatchObject({ status: 'approved', isCurrent: true, approvedBy: { fullName: 'Lorato Kgosi' } });
  });

  it('shows the documented oversight the self-approval relies on, and no block, on the version in review', async () => {
    const version = PolicyVersionDetail.parse(
      (await api.callAs(ADMIN_KWU, p.getPolicyVersion, { tenant: 'kwu', params: { profileId: 1, versionId: 3 } })).body,
    );
    expect(version.submittedBy?.fullName).toBe('Lorato Kgosi');
    expect(version.capabilities).toMatchObject({ canApprove: true, approvalBlockedReason: null });
    expect(version.capabilities.alternativeOversightNote).toContain('Internal Audit');
  });

  it('never links a version to an approval request that does not exist, even right after submission', async () => {
    const submitted = await api.callAs(ADMIN_KWU, p.submitPolicyVersion, { tenant: 'kwu', params: { profileId: 3, versionId: 8 }, body: {} });
    expect(submitted.status).toBe(200);
    expect(PolicyVersionDetail.parse(submitted.body)).toMatchObject({ status: 'in_review', approvalRequestId: null });
  });

  it('refuses a second draft, a retired profile and retiring the current version', async () => {
    const draftExists = await api.callAs(ADMIN_KWU, p.createPolicyVersion, { tenant: 'kwu', params: { profileId: 3 }, body: {} });
    expect(problemCode(draftExists)).toBe('POLICY_DRAFT_EXISTS');
    const retired = await api.callAs(ADMIN_KWU, p.createPolicyVersion, { tenant: 'kwu', params: { profileId: 4 }, body: {} });
    expect(problemCode(retired)).toBe('POLICY_PROFILE_RETIRED');
    const current = await api.callAs(ADMIN_KWU, p.retirePolicyVersion, {
      tenant: 'kwu',
      params: { profileId: 1, versionId: 2 },
      body: { reason: 'Superseded' },
    });
    expect(problemCode(current)).toBe('POLICY_VERSION_IS_CURRENT');
  });

  it('retires a non-current approved version and submits, returns and compares versions', async () => {
    const retired = await api.callAs(ADMIN_KWU, p.retirePolicyVersion, {
      tenant: 'kwu',
      params: { profileId: 1, versionId: 1 },
      body: { reason: 'Superseded by version 2' },
    });
    expect(PolicyVersionDetail.parse(retired.body).status).toBe('retired');

    const submitted = await api.callAs(ADMIN_KWU, p.submitPolicyVersion, { tenant: 'kwu', params: { profileId: 3, versionId: 8 }, body: {} });
    expect(PolicyVersionDetail.parse(submitted.body).status).toBe('in_review');

    const returned = await api.callAs(ADMIN_KWU, p.returnPolicyVersion, {
      tenant: 'kwu',
      params: { profileId: 2, versionId: 5 },
      body: { reason: 'Clarify the BAFO mandate.' },
    });
    expect(PolicyVersionDetail.parse(returned.body)).toMatchObject({ status: 'draft', returnedReason: 'Clarify the BAFO mandate.' });

    const comparison = PolicyVersionComparison.parse(
      (await api.callAs(ADMIN_KWU, p.comparePolicyVersions, { tenant: 'kwu', params: { profileId: 1, versionId: 3 } })).body,
    );
    expect(comparison.base.versionNo).toBe(2);
    expect(comparison.changes.map((change) => change.rule)).toEqual(
      expect.arrayContaining(['Late submissions', 'Complaint window (days)', 'Value thresholds']),
    );
  });

  it('creates a profile with draft version 1 and rejects a duplicate name', async () => {
    const rules = PolicyVersionDetail.parse(
      (await api.callAs(ADMIN_KWU, p.getPolicyVersion, { tenant: 'kwu', params: { profileId: 3, versionId: 7 } })).body,
    ).rules;
    const body = { name: 'Works contracts', rules: { ...rules, thresholds: rules.thresholds.map(({ id: _id, ...band }) => band) } };
    const created = await api.callAs(ADMIN_KWU, p.createPolicyProfile, { tenant: 'kwu', body });
    expect(created.status).toBe(201);
    expect(PolicyProfileDetail.parse(created.body).versions).toEqual([expect.objectContaining({ versionNo: 1, status: 'draft' })]);
    const duplicate = await api.callAs(ADMIN_KWU, p.createPolicyProfile, { tenant: 'kwu', body: { ...body, name: 'requests for quotation' } });
    expect(duplicate.status).toBe(409);
    expect(problemCode(duplicate)).toBe('POLICY_PROFILE_NAME_TAKEN');
  });

  it('returns 422 with the rule code for an incoherent rule set', async () => {
    const rules = PolicyVersionDetail.parse(
      (await api.callAs(ADMIN_KWU, p.getPolicyVersion, { tenant: 'kwu', params: { profileId: 3, versionId: 8 } })).body,
    ).rules;
    const response = await api.callAs(ADMIN_KWU, p.updatePolicyVersion, {
      tenant: 'kwu',
      params: { profileId: 3, versionId: 8 },
      body: { rules: { ...rules, openingQuorum: 1, thresholds: [] } },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('OPENING_QUORUM_TOO_LOW');
  });

  it('refuses retiring a profile with a version in review', async () => {
    const response = await api.callAs(ADMIN_KWU, p.retirePolicyProfile, { tenant: 'kwu', params: { profileId: 1 }, body: { reason: 'x' } });
    expect(problemCode(response)).toBe('POLICY_REVIEW_IN_PROGRESS');
  });

  it('offers the procurement officer only current approved versions permitting the procedure', async () => {
    const response = await api.callAs(OFFICER, p.listPolicyVersionOptions, { tenant: 'kwu', query: { procedure: 'invitation_only' } });
    expect(response.status).toBe(200);
    const options = PolicyVersionOption.array().parse(response.body);
    expect(options.map((option) => option.versionId).sort()).toEqual([2, 7]);
  });
});

describe('ADM-07 custom fields', () => {
  it('lists KWU fields filtered by form and hides ODC fields', async () => {
    const page = CustomFieldPage.parse(
      (await api.callAs(ADMIN_KWU, p.listCustomFields, { tenant: 'kwu', query: { entityType: 'tender', active: 'true' } })).body,
    );
    expect(page.items.map((field) => field.key)).toEqual([
      'local_content_target_percent',
      'service_region',
      'donor_programme_code',
      'environmental_permit_ref',
    ]);
    const odc = await api.callAs(ADMIN_KWU, p.getCustomField, { tenant: 'kwu', params: { fieldId: 40 } });
    expect(odc.status).toBe(404);
  });

  it('shows dependents and blocks deactivating a field another field depends on', async () => {
    const detail = CustomFieldDetail.parse((await api.callAs(ADMIN_KWU, p.getCustomField, { tenant: 'kwu', params: { fieldId: 2 } })).body);
    expect(detail.dependents.map((field) => field.key)).toEqual(['emergency_justification']);
    expect(detail.capabilities).toMatchObject({ canDeactivate: false, structureLocked: true });
    const response = await api.callAs(ADMIN_KWU, p.deactivateCustomField, { tenant: 'kwu', params: { fieldId: 2 }, body: { reason: 'No longer used' } });
    expect(problemCode(response)).toBe('FIELD_IS_CONDITION_SOURCE');
  });

  it('locks the type and existing choices of a field that issued records carry', async () => {
    const response = await api.callAs(ADMIN_KWU, p.updateCustomField, {
      tenant: 'kwu',
      params: { fieldId: 7 },
      body: {
        label: 'Service region',
        purpose: 'The KWU operating region where works or deliveries take place.',
        fieldType: 'choice',
        allowedValues: ['Central', 'North-East'],
        requiredMode: 'optional',
        audience: 'public',
        changeNote: 'Drop regions',
      },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('FIELD_LOCKED_BY_ISSUED_FORMS');
  });

  it('refuses widening the audience of a field that issued records carry with 409 AUDIENCE_WIDENING_REQUIRES_NEW_FIELD', async () => {
    const response = await api.callAs(ADMIN_KWU, p.updateCustomField, {
      tenant: 'kwu',
      params: { fieldId: 1 },
      body: {
        label: 'Funding vote code',
        purpose: 'The budget vote that funds the request.',
        fieldType: 'text',
        allowedValues: [],
        requiredMode: 'required',
        audience: 'public',
        includeInReports: true,
        changeNote: 'Publish vote codes',
      },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('AUDIENCE_WIDENING_REQUIRES_NEW_FIELD');
  });

  it('accepts keeping or narrowing the audience of a field that issued records carry', async () => {
    const detail = CustomFieldDetail.parse((await api.callAs(ADMIN_KWU, p.getCustomField, { tenant: 'kwu', params: { fieldId: 1 } })).body);
    expect(detail.capabilities.structureLocked).toBe(true);
    const response = await api.callAs(ADMIN_KWU, p.updateCustomField, {
      tenant: 'kwu',
      params: { fieldId: 1 },
      body: {
        label: 'Funding vote code (finance)',
        purpose: detail.purpose,
        fieldType: 'text',
        allowedValues: [],
        requiredMode: 'required',
        audience: 'buyer_internal',
        includeInReports: true,
        changeNote: 'Clearer label',
      },
    });
    expect(response.status).toBe(200);
    expect(CustomFieldDetail.parse(response.body)).toMatchObject({ label: 'Funding vote code (finance)', audience: 'buyer_internal' });
  });

  it('creates a conditional field and rejects taken keys, reserved keys and unknown condition values', async () => {
    const base = {
      entityType: 'tender',
      label: 'Bid security form',
      purpose: 'Names the bid security form required for high-value tenders.',
      fieldType: 'text',
      requiredMode: 'conditional',
      requiredConditionField: 'value_band',
      audience: 'supplier_visible',
    };
    const created = await api.callAs(ADMIN_KWU, p.createCustomField, {
      tenant: 'kwu',
      body: { ...base, key: 'bid_security_form', requiredConditionValue: 'high' },
    });
    expect(created.status).toBe(201);
    expect(CustomFieldDetail.parse(created.body)).toMatchObject({ key: 'bid_security_form', active: true, valueCount: 0 });

    const taken = await api.callAs(ADMIN_KWU, p.createCustomField, { tenant: 'kwu', body: { ...base, key: 'service_region', requiredConditionValue: 'high' } });
    expect(problemCode(taken)).toBe('CUSTOM_FIELD_KEY_TAKEN');
    const reserved = await api.callAs(ADMIN_KWU, p.createCustomField, { tenant: 'kwu', body: { ...base, key: 'estimated_value', requiredConditionValue: 'high' } });
    expect(reserved.status).toBe(422);
    expect(codeOf(reserved)).toBe('FIELD_KEY_RESERVED');
    const badValue = await api.callAs(ADMIN_KWU, p.createCustomField, { tenant: 'kwu', body: { ...base, key: 'bid_security_form', requiredConditionValue: 'huge' } });
    expect(problemCode(badValue)).toBe('CONDITION_VALUE_INVALID');
  });

  it('reorders a form and rejects an incomplete order', async () => {
    const ok = await api.callAs(ADMIN_KWU, p.reorderCustomFields, { tenant: 'kwu', body: { entityType: 'contract', fieldIds: [18, 17, 16, 15] } });
    expect(CustomFieldForm.parse(ok.body).fields.map((field) => field.id)).toEqual([18, 17, 16, 15]);
    const incomplete = await api.callAs(ADMIN_KWU, p.reorderCustomFields, { tenant: 'kwu', body: { entityType: 'contract', fieldIds: [15] } });
    expect(problemCode(incomplete)).toBe('FIELD_ORDER_INCOMPLETE');
  });

  it('serves the active tender form to a procurement officer without admin rights', async () => {
    const response = await api.callAs(OFFICER, p.getCustomFieldForm, { tenant: 'kwu', params: { entityType: 'tender' } });
    expect(response.status).toBe(200);
    const formDefinition = CustomFieldForm.parse(response.body);
    expect(formDefinition.fields.every((field) => field.key !== 'legacy_vote_code')).toBe(true);
    expect(formDefinition.coreConditionSources).toContain('value_band');
  });

  it('serves the qualification application form to a restricted financial reviewer (AC-08)', async () => {
    const response = await api.callAs(FINANCIAL_REVIEWER, p.getCustomFieldForm, {
      tenant: 'kwu',
      params: { entityType: 'qualification_application' },
    });
    expect(response.status).toBe(200);
    expect(CustomFieldForm.parse(response.body).fields.length).toBeGreaterThan(0);
  });

  it('gives a supplier only the supplier-visible and public fields of the buyer it names', async () => {
    const response = await api.callAs(SUPPLIER, p.getSupplierCustomFieldForm, {
      tenant: 'tsodilo',
      params: { buyerSlug: 'kwu', entityType: 'qualification_application' },
    });
    expect(response.status).toBe(200);
    const keys = CustomFieldForm.parse(response.body).fields.map((field) => field.key);
    expect(keys).toEqual(['ppadb_registration_number', 'water_sector_experience_years', 'pump_service_centre']);
    expect(keys).not.toContain('assessor_internal_note');

    const supplierAsBuyer = await api.callAs(SUPPLIER, p.getSupplierCustomFieldForm, {
      tenant: 'tsodilo',
      params: { buyerSlug: 'chobe-pipe', entityType: 'tender' },
    });
    expect(problemCode(supplierAsBuyer)).toBe('BUYER_NOT_FOUND');
  });

  it('denies suppliers and operators the buyer endpoints and buyers the supplier endpoint', async () => {
    expect((await api.callAs(SUPPLIER, p.listCustomFields, { tenant: 'tsodilo' })).status).toBe(403);
    expect((await api.callAs(OPERATOR, p.getPortalPolicy, { tenant: 'tenderiq-ops' })).status).toBe(403);
    expect(
      (await api.callAs(ADMIN_KWU, p.getSupplierCustomFieldForm, { tenant: 'kwu', params: { buyerSlug: 'kwu', entityType: 'tender' } })).status,
    ).toBe(403);
  });

  it('denies the support agent under a metadata-only grant', async () => {
    const response = await api.callAs(SUPPORT, p.listCustomFields, { tenant: 'kwu' });
    expect(response.status).toBe(403);
  });
});

describe('ADM-08 templates', () => {
  it('offers only the active members and categories of the caller tenant as authoring options', async () => {
    const kwu = await api.callAs(ADMIN_KWU, p.getTemplateAuthoringOptions, { tenant: 'kwu' });
    expect(kwu.status).toBe(200);
    const options = TemplateAuthoringOptions.parse(kwu.body);
    expect(options.owners.map((owner) => owner.fullName)).toContain('Tebogo Molefe');
    expect(options.owners.map((owner) => owner.fullName)).not.toContain('Wame Olebile');
    expect(options.owners.map((owner) => owner.fullName)).not.toContain('Gaone Letsholo');
    expect(options.categories.map((category) => category.code)).not.toContain('FAC-CLEAN');
    const odc = TemplateAuthoringOptions.parse((await api.callAs(ADMIN_ODC, p.getTemplateAuthoringOptions, { tenant: 'odc' })).body);
    expect(odc.categories.map((category) => category.code).sort()).toEqual(['CIV-WORKS', 'FAC-CLEAN', 'FAC-MAINT', 'FUEL']);
    expect((await api.callAs(REQUESTER, p.getTemplateAuthoringOptions, { tenant: 'kwu' })).status).toBe(403);
  });

  it('lists KWU templates with overdue reviews and filters by kind', async () => {
    const overdue = TemplatePage.parse(
      (await api.callAs(ADMIN_KWU, p.listTemplates, { tenant: 'kwu', query: { reviewOverdue: 'true', sort: 'reviewDate' } })).body,
    );
    expect(overdue.items.map((row) => row.id)).toEqual([5, 2]);
    const letters = TemplatePage.parse((await api.callAs(ADMIN_KWU, p.listTemplates, { tenant: 'kwu', query: { kind: 'letter' } })).body);
    expect(letters.items.map((row) => row.name).sort()).toEqual(['Notice of intent to award', 'Regret letter to unsuccessful bidders']);
  });

  it('shows the retired services contract still carried by C-2026-0001 and never offers it', async () => {
    const detail = TemplateDetail.parse((await api.callAs(ADMIN_KWU, p.getTemplate, { tenant: 'kwu', params: { templateId: 9 } })).body);
    expect(detail).toMatchObject({ status: 'retired', selectable: false });
    expect(detail.usage).toEqual(expect.arrayContaining([expect.objectContaining({ reference: 'C-2026-0001', adoptedVersionNo: 2 })]));

    const options = TemplateOption.array().parse(
      (await api.callAs(OFFICER, p.listTemplateOptions, { tenant: 'kwu', query: { kind: 'contract' } })).body,
    );
    expect(options.map((option) => option.templateId)).toEqual([8]);
    const resolved = await api.callAs(OFFICER, p.resolveTemplateOption, { tenant: 'kwu', params: { templateId: 9 } });
    expect(resolved.status).toBe(409);
    expect(problemCode(resolved)).toBe('TEMPLATE_RETIRED');
    const draft = await api.callAs(OFFICER, p.resolveTemplateOption, { tenant: 'kwu', params: { templateId: 10 } });
    expect(problemCode(draft)).toBe('TEMPLATE_NOT_APPROVED');
  });

  it('approves the sole approver’s own template version under the documented oversight and shows the note first', async () => {
    const before = TemplateDetail.parse((await api.callAs(ADMIN_KWU, p.getTemplate, { tenant: 'kwu', params: { templateId: 6 } })).body);
    expect(before.capabilities).toMatchObject({ canApprove: true, approvalBlockedReason: null });
    expect(before.capabilities.alternativeOversightNote).toContain('Internal Audit');
    expect(before.owner.fullName).toBe('Tebogo Molefe');
    expect(before.focusVersion.submittedBy?.fullName).toBe('Lorato Kgosi');
    const own = await api.callAs(ADMIN_KWU, p.approveTemplateVersion, { tenant: 'kwu', params: { templateId: 6, versionId: 9 }, body: {} });
    expect(own.status).toBe(200);
    expect(TemplateDetail.parse(own.body)).toMatchObject({ status: 'approved', selectable: true, currentVersionNo: 1 });
  });

  it('refuses a second revision and edits to approved versions', async () => {
    const revision = await api.callAs(ADMIN_KWU, p.createTemplateVersion, {
      tenant: 'kwu',
      params: { templateId: 3 },
      body: { bodyMarkdown: '# Criteria', changeNote: 'Another change' },
    });
    expect(problemCode(revision)).toBe('TEMPLATE_REVISION_EXISTS');
    const immutable = await api.callAs(ADMIN_KWU, p.updateTemplateVersion, {
      tenant: 'kwu',
      params: { templateId: 1, versionId: 2 },
      body: { bodyMarkdown: '# Changed', changeNote: 'Edit' },
    });
    expect(problemCode(immutable)).toBe('TEMPLATE_VERSION_IMMUTABLE');
  });

  it('creates a template for an active owner and rejects an owner from another organization', async () => {
    const body = {
      kind: 'letter',
      name: 'Debriefing invitation',
      procedure: null,
      categoryId: null,
      audience: 'supplier_visible',
      ownerUserId: 5,
      reviewDate: '2099-12-31',
      bodyMarkdown: 'You are invited to a debriefing.',
    };
    const created = await api.callAs(ADMIN_KWU, p.createTemplate, { tenant: 'kwu', body });
    expect(created.status).toBe(201);
    expect(TemplateDetail.parse(created.body)).toMatchObject({ status: 'draft', selectable: false, focusVersion: { versionNo: 1 } });
    const foreignOwner = await api.callAs(ADMIN_KWU, p.createTemplate, { tenant: 'kwu', body: { ...body, ownerUserId: 23 } });
    expect(problemCode(foreignOwner)).toBe('OWNER_NOT_MEMBER');
  });

  it('submits a draft, returns a review and retires a template', async () => {
    const submitted = await api.callAs(ADMIN_KWU, p.submitTemplateVersion, { tenant: 'kwu', params: { templateId: 10, versionId: 14 }, body: {} });
    expect(TemplateDetail.parse(submitted.body).status).toBe('in_review');
    const returned = await api.callAs(ADMIN_KWU, p.returnTemplateVersion, {
      tenant: 'kwu',
      params: { templateId: 3, versionId: 6 },
      body: { reason: 'Local content weighting needs legal review.' },
    });
    expect(TemplateDetail.parse(returned.body).focusVersion).toMatchObject({ versionStatus: 'draft', returnedReason: 'Local content weighting needs legal review.' });
    const retired = await api.callAs(ADMIN_KWU, p.retireTemplate, { tenant: 'kwu', params: { templateId: 5 }, body: { reason: 'Replaced' } });
    expect(TemplateDetail.parse(retired.body)).toMatchObject({ status: 'retired', selectable: false });
    const again = await api.callAs(ADMIN_KWU, p.retireTemplate, { tenant: 'kwu', params: { templateId: 9 }, body: { reason: 'Replaced' } });
    expect(problemCode(again)).toBe('TEMPLATE_RETIRED');
  });

  it('keeps ODC templates away from KWU', async () => {
    const response = await api.callAs(ADMIN_KWU, p.getTemplate, { tenant: 'kwu', params: { templateId: 30 } });
    expect(response.status).toBe(404);
  });
});

describe('ADM-11 portal policy', () => {
  const settings: PortalSettingsInput = {
    publicPortalEnabled: true,
    brandingDisplayName: 'Okavango District Council',
    portalIntro: 'Council opportunities.',
    guidanceMarkdown: '',
    showAdvanceNotices: true,
    showAwards: true,
    showBidderCounts: true,
    discloseBidderIdentities: 'after_award',
    publicDocumentPolicy: 'public',
    languages: ['en'],
    visibleNoticeFields: [...PORTAL_NOTICE_FIELD_KEYS],
    channels: ['portal'],
  };

  it('shows KWU approved settings with the proposal in review and its changed settings', async () => {
    const policy = PortalPolicy.parse((await api.callAs(ADMIN_KWU, p.getPortalPolicy, { tenant: 'kwu' })).body);
    expect(policy.approved.showBidderCounts).toBe(false);
    expect(policy.proposal).toMatchObject({ status: 'in_review' });
    expect(policy.proposal?.changedSettings).toEqual(expect.arrayContaining(['Bidder counts', 'Bidder identities', 'Languages']));
    expect(policy.capabilities).toMatchObject({ canApprove: true, canPropose: false, approvalBlockedReason: null });
    expect(policy.proposal?.proposedBy.fullName).toBe('Lorato Kgosi');
    expect(policy.capabilities.alternativeOversightNote).toContain('Internal Audit');
  });

  it('shows no approval capability or oversight note to a reader without portal management', async () => {
    const policy = PortalPolicy.parse((await api.callAs(AUDITOR, p.getPortalPolicy, { tenant: 'kwu' })).body);
    expect(policy.capabilities).toMatchObject({ canApprove: false, approvalBlockedReason: null, alternativeOversightNote: null });
  });

  it('records a self-approval as relying on the documented oversight in the history', async () => {
    const approved = await api.callAs(ADMIN_KWU, p.approvePortalProposal, { tenant: 'kwu', body: { disclosureReviewed: true } });
    expect(approved.status).toBe(200);
    const [latest] = PortalPolicy.parse(approved.body).history;
    expect(latest).toMatchObject({
      outcome: 'approved',
      underAlternativeOversight: true,
      proposedBy: { fullName: 'Lorato Kgosi' },
      by: { fullName: 'Lorato Kgosi' },
    });
    expect(latest?.summary).toContain('Bidder counts');
  });

  it('refuses a new proposal while one is in review and approves the pending one', async () => {
    const blocked = await api.callAs(ADMIN_KWU, p.savePortalProposal, { tenant: 'kwu', body: { settings, changeNote: 'Change' } });
    expect(problemCode(blocked)).toBe('PORTAL_PROPOSAL_IN_REVIEW');
    const approved = await api.callAs(ADMIN_KWU, p.approvePortalProposal, { tenant: 'kwu', body: { disclosureReviewed: true } });
    expect(approved.status).toBe(200);
    const policy = PortalPolicy.parse(approved.body);
    expect(policy).toMatchObject({ proposal: null, approved: { showBidderCounts: true, discloseBidderIdentities: 'after_opening' } });
  });

  it('refuses hiding a mandatory notice field with 422 MANDATORY_CONTROL_HIDDEN', async () => {
    const response = await api.callAs(ADMIN_ODC, p.savePortalProposal, {
      tenant: 'odc',
      body: { settings: { ...settings, visibleNoticeFields: ['title'] }, changeNote: 'Shorter notices' },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('MANDATORY_CONTROL_HIDDEN');
  });

  it('saves an ODC draft proposal, and answers not found for submit, approve and withdraw without one', async () => {
    const saved = await api.callAs(ADMIN_ODC, p.savePortalProposal, { tenant: 'odc', body: { settings, changeNote: 'Show advance notices' } });
    expect(PortalPolicy.parse(saved.body).proposal).toMatchObject({ status: 'draft', changedSettings: expect.arrayContaining(['Advance notices']) });
    for (const endpoint of [p.submitPortalProposal, p.withdrawPortalProposal]) {
      const response = await api.callAs(ADMIN_ODC, endpoint, { tenant: 'odc' });
      expect(problemCode(response)).toBe('PORTAL_PROPOSAL_NOT_FOUND');
    }
    const approve = await api.callAs(ADMIN_ODC, p.approvePortalProposal, { tenant: 'odc', body: { disclosureReviewed: true } });
    expect(problemCode(approve)).toBe('PORTAL_PROPOSAL_NOT_FOUND');
  });

  it('returns and withdraws the KWU proposal', async () => {
    const returned = await api.callAs(ADMIN_KWU, p.returnPortalProposal, { tenant: 'kwu', body: { reason: 'Legal review first' } });
    expect(PortalPolicy.parse(returned.body).proposal).toMatchObject({ status: 'draft', returnedReason: 'Legal review first' });
    const withdrawn = await api.callAs(ADMIN_KWU, p.withdrawPortalProposal, { tenant: 'kwu' });
    expect(PortalPolicy.parse(withdrawn.body).proposal).toBeNull();
  });

  it('lets a procurement officer read but not propose', async () => {
    const policy = PortalPolicy.parse((await api.callAs(OFFICER, p.getPortalPolicy, { tenant: 'kwu' })).body);
    expect(policy.capabilities.canPropose).toBe(false);
    const response = await api.callAs(OFFICER, p.savePortalProposal, { tenant: 'kwu', body: { settings, changeNote: 'Change' } });
    expect(response.status).toBe(403);
  });

  it('publishes only the approved settings to the public, never the pending proposal', async () => {
    const response = await api.request('GET', '/api/v1/public/portal-policies/kwu');
    expect(response.status).toBe(200);
    const policy = PublicPortalPolicy.parse(response.body);
    expect(policy).toMatchObject({ buyerName: 'Kalahari Water Utilities (Pilot)', showBidderCounts: false, discloseBidderIdentities: 'after_award' });
    expect(policy.visibleNoticeFields).not.toContain('estimated_value');
    expect(JSON.stringify(response.body)).not.toContain('internal audit');
  });

  it('answers 404 for a supplier slug or an unknown buyer on the public endpoint', async () => {
    expect((await api.request('GET', '/api/v1/public/portal-policies/tsodilo')).status).toBe(404);
    expect((await api.request('GET', '/api/v1/public/portal-policies/nobody')).status).toBe(404);
  });
});

describe('contract conformance of every fixture detail', () => {
  it('serves every profile, version, field, template and template version of each buyer without drift', async () => {
    // Arrange
    const { POLICY_PROFILES, POLICY_VERSIONS, CUSTOM_FIELDS, TEMPLATES, TEMPLATE_VERSIONS } = await import('../../fixtures/policy.js');
    const who = (tenantId: number): [string, string] => (tenantId === 2 ? [ADMIN_KWU, 'kwu'] : [ADMIN_ODC, 'odc']);
    const statuses: number[] = [];

    // Act
    for (const profile of POLICY_PROFILES) {
      const [email, tenant] = who(profile.tenantId);
      statuses.push((await api.callAs(email, p.getPolicyProfile, { tenant, params: { profileId: profile.id } })).status);
    }
    for (const version of POLICY_VERSIONS) {
      const [email, tenant] = who(version.tenantId);
      statuses.push((await api.callAs(email, p.getPolicyVersion, { tenant, params: { profileId: version.profileId, versionId: version.id } })).status);
    }
    for (const field of CUSTOM_FIELDS) {
      const [email, tenant] = who(field.tenantId);
      statuses.push((await api.callAs(email, p.getCustomField, { tenant, params: { fieldId: field.id } })).status);
    }
    for (const template of TEMPLATES) {
      const [email, tenant] = who(template.tenantId);
      statuses.push((await api.callAs(email, p.getTemplate, { tenant, params: { templateId: template.id } })).status);
      for (const version of TEMPLATE_VERSIONS.filter((row) => row.templateId === template.id)) {
        statuses.push((await api.callAs(email, p.getTemplateVersion, { tenant, params: { templateId: template.id, versionId: version.id } })).status);
      }
    }
    statuses.push((await api.callAs(ADMIN_ODC, p.getPortalPolicy, { tenant: 'odc' })).status);

    // Assert
    expect(statuses.filter((status) => status !== 200)).toEqual([]);
    expect(api.logs.filter((line) => line.includes('drift'))).toEqual([]);
  });

  it('answers TEMPLATE_VERSION_NOT_FOUND for a version of another template', async () => {
    const response = await api.callAs(ADMIN_KWU, p.getTemplateVersion, { tenant: 'kwu', params: { templateId: 1, versionId: 4 } });
    expect(response.status).toBe(404);
    expect(problemCode(response)).toBe('TEMPLATE_VERSION_NOT_FOUND');
  });
});
