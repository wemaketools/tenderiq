import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  GRANT_ONLY_PERMISSIONS,
  PERMISSION_CATALOG,
  PERMISSION_CODES,
  PermissionCodeSchema,
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_CODES,
  SUPPORT_GRANT_PERMISSIONS,
  isPermissionCode,
  permissionTenantKind,
  permissionsForTemplates,
  roleTemplatePermissionRows,
  templatePermissions,
} from './permissions.js';
import type { PermissionCode } from './permissions.js';

const BLUEPRINT = readFileSync(new URL('../../docs/plan/schema-blueprint.md', import.meta.url), 'utf8');

/** The permission codes listed on the `**<Kind> permissions:**` line of blueprint §P. */
function blueprintPermissions(kind: 'Buyer' | 'Supplier' | 'Operator'): string[] {
  const line = BLUEPRINT.split(/\r?\n/).find((l) => l.startsWith(`**${kind} permissions:**`));
  if (line === undefined) {
    throw new Error(`Blueprint §P has no ${kind} permissions line`);
  }
  return line
    .replace(`**${kind} permissions:**`, '')
    .replace(/\([^)]*\)/g, '')
    .split(/[,·]/)
    .map((token) => token.trim().replace(/\.$/, '').trim())
    .filter((token) => /^[a-z_]+(\.[a-z_]+)+$/.test(token));
}

/** The role template codes listed on the `**Role templates**` line of blueprint §P. */
function blueprintTemplates(): string[] {
  const line = BLUEPRINT.split(/\r?\n/).find((l) => l.startsWith('**Role templates**'));
  if (line === undefined) {
    throw new Error('Blueprint §P has no role templates line');
  }
  return [...line.matchAll(/`([a-z_]+)`/g)].map((match) => match[1] ?? '');
}

const TEMPLATE_KIND = { buyer: 'buyer', supplier: 'supplier', operator: 'operator' } as const;

describe('permission catalog mirrors blueprint §P and DD-23', () => {
  it.each([
    ['Buyer', 'buyer'],
    ['Supplier', 'supplier'],
    ['Operator', 'operator'],
  ] as const)('lists exactly the %s permissions of the blueprint with tenant kind %s', (label, kind) => {
    const expected = blueprintPermissions(label);
    expect(expected.length).toBeGreaterThan(5);
    const actual = PERMISSION_CODES.filter((code) => permissionTenantKind(code) === kind);
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  it('contains the DD-23 additions with the right tenant kinds', () => {
    expect(permissionTenantKind('org.support_access.authorize')).toBe('buyer');
    expect(permissionTenantKind('dashboard.view')).toBe('buyer');
    expect(permissionTenantKind('supplier.notices.acknowledge')).toBe('supplier');
    expect(permissionTenantKind('supplier.dashboard.view')).toBe('supplier');
  });

  it('gives every permission a category and a description', () => {
    for (const code of PERMISSION_CODES) {
      expect(PERMISSION_CATALOG[code].category.length, code).toBeGreaterThan(0);
      expect(PERMISSION_CATALOG[code].description.length, code).toBeGreaterThan(10);
    }
  });

  it('recognizes catalog codes and rejects others', () => {
    expect(isPermissionCode('tender.view')).toBe(true);
    expect(isPermissionCode('tender.delete')).toBe(false);
    expect(isPermissionCode('toString')).toBe(false);
    expect(PermissionCodeSchema.safeParse('award.approve').success).toBe(true);
    expect(PermissionCodeSchema.safeParse('award.overrule').success).toBe(false);
  });
});

describe('role templates', () => {
  it('lists exactly the blueprint §P templates', () => {
    expect([...ROLE_TEMPLATE_CODES].sort()).toEqual(blueprintTemplates().sort());
  });

  it.each(ROLE_TEMPLATE_CODES)('%s holds only existing permissions of its own tenant kind, once each', (code) => {
    const template = ROLE_TEMPLATES[code];
    const permissions = templatePermissions(code);
    expect(permissions.length).toBeGreaterThan(0);
    expect(new Set(permissions).size).toBe(permissions.length);
    for (const permission of permissions) {
      expect(isPermissionCode(permission), permission).toBe(true);
      expect(permissionTenantKind(permission), `${code} → ${permission}`).toBe(TEMPLATE_KIND[template.tenantKind]);
    }
  });

  it('gives org_admin every org.* permission and nothing else (PRD §4.1, BR-26, AC-15)', () => {
    const orgCodes = PERMISSION_CODES.filter((code) => code.startsWith('org.'));
    expect([...templatePermissions('org_admin')].sort()).toEqual([...orgCodes].sort());
    const admin = new Set<string>(templatePermissions('org_admin'));
    for (const forbidden of ['tender.view', 'bid.monitor', 'bid.open', 'evaluation.score', 'qualification.financial_review']) {
      expect(admin.has(forbidden), forbidden).toBe(false);
    }
  });

  it('keeps auditor read-only with audit and export and no sealed or scoring access', () => {
    const auditor = templatePermissions('auditor');
    expect(auditor).toContain('audit.view');
    expect(auditor).toContain('export.create');
    for (const permission of auditor) {
      const readOnly =
        permission.endsWith('.view') ||
        permission.endsWith('.view_all') ||
        permission === 'bid.monitor' ||
        permission === 'export.create';
      expect(readOnly, permission).toBe(true);
    }
    for (const forbidden of ['bid.open', 'bid.witness', 'evaluation.score', 'evaluation.commercial', 'approval.decide']) {
      expect(auditor).not.toContain(forbidden);
    }
  });

  it('never puts support.view in a template: it only comes from a support access grant (OPS-04)', () => {
    expect(GRANT_ONLY_PERMISSIONS).toEqual(['support.view']);
    for (const code of ROLE_TEMPLATE_CODES) {
      for (const grantOnly of GRANT_ONLY_PERMISSIONS) {
        expect(templatePermissions(code)).not.toContain(grantOnly);
      }
    }
    expect(SUPPORT_GRANT_PERMISSIONS).toEqual(['support.view']);
  });

  it('assigns every other permission to at least one template', () => {
    const assigned = new Set<PermissionCode>(ROLE_TEMPLATE_CODES.flatMap((code) => [...templatePermissions(code)]));
    const unassigned = PERMISSION_CODES.filter(
      (code) => !assigned.has(code) && !(GRANT_ONLY_PERMISSIONS as readonly string[]).includes(code),
    );
    expect(unassigned).toEqual([]);
  });

  it('keeps submission authority explicit: contributors and bid managers cannot submit (AC-03)', () => {
    expect(templatePermissions('contributor')).not.toContain('supplier.response.submit');
    expect(templatePermissions('commercial_contributor')).not.toContain('supplier.response.submit');
    expect(templatePermissions('bid_manager')).not.toContain('supplier.response.submit');
    expect(templatePermissions('authorized_signatory')).toContain('supplier.response.submit');
  });

  it('separates opening, evaluation and award authorities (BR-05)', () => {
    expect(templatePermissions('opening_officer')).not.toContain('evaluation.score');
    expect(templatePermissions('evaluator')).not.toContain('bid.open');
    expect(templatePermissions('evaluator')).not.toContain('award.approve');
    expect(templatePermissions('procurement_officer')).not.toContain('tender.release_approve');
    expect(templatePermissions('requester')).not.toContain('tender.publish');
    expect(templatePermissions('requester')).not.toContain('award.approve');
  });

  it('pairs approval.decide with a decision permission in every approver template (DD-24)', () => {
    for (const code of ['procurement_manager', 'award_approver', 'budget_owner', 'legal_reviewer'] as const) {
      const permissions = templatePermissions(code);
      expect(permissions).toContain('approval.decide');
      expect(
        permissions.some((p) => p.endsWith('.approve') || p.endsWith('.decide') || p === 'request.funding_confirm'),
      ).toBe(true);
    }
  });
});

describe('permission helpers', () => {
  it('unions template permissions in catalog order without duplicates', () => {
    const union = permissionsForTemplates(['evaluator', 'contributor', 'evaluator']);
    expect(union).toEqual(PERMISSION_CODES.filter((code) => union.includes(code)));
    expect(new Set(union).size).toBe(union.length);
    expect(union).toEqual(expect.arrayContaining(['evaluation.score', 'supplier.response.edit']));
  });

  it('returns no permission for no template', () => {
    expect(permissionsForTemplates([])).toEqual([]);
  });

  it('produces one seed row per template permission', () => {
    const rows = roleTemplatePermissionRows();
    const expected = ROLE_TEMPLATE_CODES.reduce((total, code) => total + templatePermissions(code).length, 0);
    expect(rows).toHaveLength(expected);
    expect(rows).toContainEqual({ roleCode: 'org_admin', permissionCode: 'org.support_access.authorize' });
  });
});
