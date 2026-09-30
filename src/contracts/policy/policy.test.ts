/**
 * Policy contract: endpoint map shape, the cross-field rules of policy versions, custom fields, templates and portal
 * settings, and the shared conditional-required evaluation used by CustomFieldsSection, the mock API and Stage B.
 */
import { describe, expect, it } from 'vitest';

import { validateEndpointDefinition } from '../endpoint.js';
import {
  CreateCustomFieldBody,
  CreateTemplateBody,
  CustomFieldKey,
  MANDATORY_NOTICE_FIELD_KEYS,
  PORTAL_NOTICE_FIELD_KEYS,
  PolicyRulesInput,
  PortalSettingsInput,
  isCustomFieldRequired,
  policyEndpoints,
  validateCustomFieldValues,
  valueBandOf,
} from '../policy.js';
import type { CustomFieldRule, PolicyRulesInput as PolicyRules, PortalSettingsInput as PortalInput } from '../policy.js';

function codesOf(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message.split('|')[0] ?? '');
}

const BASE_RULES: PolicyRules = {
  permittedProcedures: ['open', 'restricted'],
  requiresReleaseApproval: true,
  stagedOpeningDefault: false,
  openingQuorum: 2,
  openingRequiresSecondPerson: true,
  independentEvaluation: true,
  negotiationPermitted: false,
  bafoPermitted: false,
  lateSubmissionPolicy: 'reject',
  questionDeadlineDaysBeforeClose: 7,
  minResponseDays: 21,
  standstillRequired: true,
  standstillLength: 10,
  standstillDayType: 'calendar',
  complaintWindowDays: 10,
  complaintRequiresIndependentReview: true,
  publicAwardNoticeRequired: true,
  approvalRouteNote: null,
  thresholds: [
    { procedure: 'open', minValue: '0.00', maxValue: '2000000.00', currency: 'BWP', requiredApprovalLevel: 'Manager', requiresPublicNotice: true },
    { procedure: 'open', minValue: '2000000.00', maxValue: null, currency: 'BWP', requiredApprovalLevel: 'Chief Executive', requiresPublicNotice: true },
  ],
};

describe('policyEndpoints', () => {
  it('defines 43 valid endpoints with unique ids under the policy paths', () => {
    // Arrange
    const endpoints = Object.values(policyEndpoints);

    // Act
    const problems = endpoints.flatMap((endpoint) => validateEndpointDefinition(endpoint));
    const ids = new Set(endpoints.map((endpoint) => endpoint.id));

    // Assert
    expect(endpoints).toHaveLength(43);
    expect(problems).toEqual([]);
    expect(ids.size).toBe(43);
    expect(endpoints.every((endpoint) => /^\/api\/v1\/(buyer|supplier)\/policy\/|^\/api\/v1\/public\/portal-policies\//.test(endpoint.path))).toBe(true);
  });

  it('requires org.policy.approve to approve a policy version and org.templates.approve to approve a template', () => {
    expect(policyEndpoints.approvePolicyVersion.permission).toBe('org.policy.approve');
    expect(policyEndpoints.approveTemplateVersion.permission).toBe('org.templates.approve');
  });
});

describe('PolicyRulesInput', () => {
  it('accepts a coherent rule set with adjacent value bands', () => {
    expect(PolicyRulesInput.safeParse(BASE_RULES).success).toBe(true);
  });

  it('rejects a second-person opening with a quorum of one', () => {
    const result = PolicyRulesInput.safeParse({ ...BASE_RULES, openingQuorum: 1 });
    expect(codesOf(result)).toContain('OPENING_QUORUM_TOO_LOW');
  });

  it('rejects a required standstill without a length', () => {
    const result = PolicyRulesInput.safeParse({ ...BASE_RULES, standstillLength: null });
    expect(codesOf(result)).toContain('STANDSTILL_LENGTH_REQUIRED');
  });

  it('rejects best-and-final offers when negotiation is not permitted', () => {
    const result = PolicyRulesInput.safeParse({ ...BASE_RULES, bafoPermitted: true });
    expect(codesOf(result)).toContain('BAFO_REQUIRES_NEGOTIATION');
  });

  it('rejects overlapping value bands and bands for procedures that are not permitted', () => {
    const [firstBand] = BASE_RULES.thresholds;
    if (firstBand === undefined) throw new Error('fixture band missing');
    const result = PolicyRulesInput.safeParse({
      ...BASE_RULES,
      thresholds: [
        ...BASE_RULES.thresholds,
        { ...firstBand, minValue: '1000000.00', maxValue: '3000000.00' },
        { ...firstBand, procedure: 'direct' },
      ],
    });
    expect(codesOf(result)).toEqual(expect.arrayContaining(['THRESHOLD_OVERLAP', 'THRESHOLD_PROCEDURE_NOT_PERMITTED']));
  });

  it('never offers framework_calloff as a permitted procedure (DD-40)', () => {
    const result = PolicyRulesInput.safeParse({ ...BASE_RULES, permittedProcedures: ['open', 'framework_calloff'] });
    expect(result.success).toBe(false);
  });
});

describe('custom field definitions', () => {
  it('refuses keys that shadow a mandatory core field or carry scores', () => {
    expect(codesOf(CustomFieldKey.safeParse('estimated_value'))).toContain('FIELD_KEY_RESERVED');
    expect(codesOf(CustomFieldKey.safeParse('supplier_score'))).toContain('SCORING_FIELD_NOT_ALLOWED');
    expect(CustomFieldKey.safeParse('service_region').success).toBe(true);
  });

  it('requires choices for a choice field and a condition for a conditional field', () => {
    const result = CreateCustomFieldBody.safeParse({
      entityType: 'tender',
      key: 'service_region',
      label: 'Service region',
      purpose: 'Where the work takes place.',
      fieldType: 'choice',
      allowedValues: ['Central'],
      requiredMode: 'conditional',
      audience: 'public',
    });
    expect(codesOf(result)).toEqual(expect.arrayContaining(['ALLOWED_VALUES_REQUIRED', 'CONDITION_FIELD_REQUIRED', 'CONDITION_VALUE_REQUIRED']));
  });
});

describe('validateCustomFieldValues', () => {
  const rules: CustomFieldRule[] = [
    { key: 'is_emergency', label: 'Emergency', fieldType: 'boolean', allowedValues: [], requiredMode: 'optional', requiredConditionField: null, requiredConditionValue: null },
    { key: 'emergency_justification', label: 'Justification', fieldType: 'text', allowedValues: [], requiredMode: 'conditional', requiredConditionField: 'is_emergency', requiredConditionValue: 'true' },
    { key: 'asset_no', label: 'Asset number', fieldType: 'text', allowedValues: [], requiredMode: 'conditional', requiredConditionField: 'category_code', requiredConditionValue: 'WTR-PUMP' },
    { key: 'priority', label: 'Priority', fieldType: 'choice', allowedValues: ['High', 'Normal'], requiredMode: 'required', requiredConditionField: null, requiredConditionValue: null },
    { key: 'target', label: 'Target', fieldType: 'number', allowedValues: [], requiredMode: 'optional', requiredConditionField: null, requiredConditionValue: null },
  ];

  it('requires a conditional field only when its condition source holds the value', () => {
    // Arrange
    const values = { is_emergency: true, priority: 'High' };

    // Act
    const issues = validateCustomFieldValues(rules, values, { category_code: 'WTR-PIPE' });

    // Assert
    expect(issues).toEqual([expect.objectContaining({ key: 'emergency_justification', code: 'CUSTOM_FIELD_REQUIRED' })]);
    expect(isCustomFieldRequired(rules[2] as CustomFieldRule, values, { category_code: 'WTR-PUMP' })).toBe(true);
  });

  it('reports invalid choices, non-decimal numbers and unknown keys', () => {
    const issues = validateCustomFieldValues(rules, { priority: 'Urgent', target: '12,5', unknown_key: 'x' });
    expect(issues.map((issue) => issue.code).sort()).toEqual(['CUSTOM_FIELD_INVALID_CHOICE', 'CUSTOM_FIELD_INVALID_NUMBER', 'CUSTOM_FIELD_UNKNOWN']);
  });

  it('accepts complete values', () => {
    expect(validateCustomFieldValues(rules, { is_emergency: false, priority: 'Normal', target: '30.5' })).toEqual([]);
  });

  it('bands decimal amounts without floats', () => {
    expect([valueBandOf('499999.99'), valueBandOf('500000.00'), valueBandOf('5000000.00')]).toEqual(['low', 'medium', 'high']);
  });
});

describe('templates', () => {
  it('requires at least one item on a checklist template', () => {
    const result = CreateTemplateBody.safeParse({
      kind: 'checklist',
      name: 'Opening checklist',
      procedure: null,
      categoryId: null,
      audience: 'buyer_internal',
      ownerUserId: 15,
      reviewDate: '2027-01-15',
      bodyMarkdown: '',
      checklistItems: [],
    });
    expect(codesOf(result)).toContain('CHECKLIST_ITEMS_REQUIRED');
  });
});

describe('PortalSettingsInput', () => {
  const input: PortalInput = {
    publicPortalEnabled: true,
    brandingDisplayName: 'Kalahari Water Utilities',
    portalIntro: 'Opportunities',
    guidanceMarkdown: '',
    showAdvanceNotices: true,
    showAwards: true,
    showBidderCounts: true,
    discloseBidderIdentities: 'after_award',
    publicDocumentPolicy: 'registered',
    languages: ['en'],
    visibleNoticeFields: [...PORTAL_NOTICE_FIELD_KEYS],
    channels: ['portal'],
  };

  it('accepts settings that keep every mandatory control visible', () => {
    expect(PortalSettingsInput.safeParse(input).success).toBe(true);
  });

  it('refuses hiding a mandatory notice field or the portal channel', () => {
    const hidden = PortalSettingsInput.safeParse({
      ...input,
      visibleNoticeFields: PORTAL_NOTICE_FIELD_KEYS.filter((key) => key !== MANDATORY_NOTICE_FIELD_KEYS[0]),
      channels: ['external_notice'],
      externalNoticeDescription: 'Daily News',
    });
    expect(codesOf(hidden).filter((code) => code === 'MANDATORY_CONTROL_HIDDEN')).toHaveLength(2);
  });
});
