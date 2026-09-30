/**
 * Cross-fixture consistency of the policy fixtures with the permission model and with other domains:
 * - every recorded actor holds the permission their action needs, and every self-approval is covered by the
 *   documented alternative oversight of its organization (BR-07);
 * - every approval link resolves in the approvals fixtures;
 * - the tender references match the tenders fixtures, every tender is listed by exactly one policy version of its
 *   buyer, and a frozen version was approved and in force when the tender was released (BR-09).
 */
import { describe, expect, it } from 'vitest';

import type { PermissionCode } from '../../../contracts/permissions.js';
import { findPersonaById, membershipPermissions } from '../../persona.js';
import { APPROVALS } from '../approvals.js';
import {
  CONFIGURATION_OVERSIGHT,
  CUSTOM_FIELDS,
  POLICY_TENDER_REFS,
  POLICY_VERSIONS,
  PORTAL_POLICIES,
  TEMPLATES,
  TEMPLATE_VERSIONS,
} from '../policy.js';
import { TENDERS } from '../tenders/index.js';

function holdsIn(userId: number, tenantId: number, permission: PermissionCode): boolean {
  const persona = findPersonaById(userId);
  return (persona?.memberships ?? []).some(
    (membership) => membership.tenantId === tenantId && membership.status === 'active' && membershipPermissions(membership).includes(permission),
  );
}

function hasOversight(tenantId: number): boolean {
  return CONFIGURATION_OVERSIGHT.some((row) => row.tenantId === tenantId && row.note.length > 0);
}

function tenantOfTemplate(templateId: number): number {
  const template = TEMPLATES.find((row) => row.id === templateId);
  if (template === undefined) throw new Error(`Unknown template ${templateId}.`);
  return template.tenantId;
}

describe('policy actors and the permission model', () => {
  it('has policy versions created and submitted by holders of org.policy.manage and approved by holders of org.policy.approve', () => {
    for (const version of POLICY_VERSIONS) {
      expect(holdsIn(version.createdBy, version.tenantId, 'org.policy.manage')).toBe(true);
      if (version.submittedBy !== null) expect(holdsIn(version.submittedBy, version.tenantId, 'org.policy.manage')).toBe(true);
      if (version.approvedBy !== null) expect(holdsIn(version.approvedBy, version.tenantId, 'org.policy.approve')).toBe(true);
    }
  });

  it('has template versions authored by holders of org.templates.manage and approved by holders of org.templates.approve', () => {
    for (const version of TEMPLATE_VERSIONS) {
      const tenantId = tenantOfTemplate(version.templateId);
      expect(holdsIn(version.createdBy, tenantId, 'org.templates.manage')).toBe(true);
      if (version.submittedBy !== null) expect(holdsIn(version.submittedBy, tenantId, 'org.templates.manage')).toBe(true);
      if (version.approvedBy !== null) expect(holdsIn(version.approvedBy, tenantId, 'org.templates.approve')).toBe(true);
    }
  });

  it('keeps template owners as members of the buyer, independent of who authored the versions', () => {
    for (const template of TEMPLATES) {
      const owner = findPersonaById(template.ownerUserId);
      expect(owner?.memberships.some((membership) => membership.tenantId === template.tenantId)).toBe(true);
    }
    expect(TEMPLATES.some((template) => !holdsIn(template.ownerUserId, template.tenantId, 'org.templates.manage'))).toBe(true);
  });

  it('has custom fields created and changed by holders of org.fields.manage', () => {
    for (const field of CUSTOM_FIELDS) {
      for (const actor of [field.createdBy, field.updatedBy, ...field.history.map((change) => change.by)]) {
        if (actor !== null) expect(holdsIn(actor, field.tenantId, 'org.fields.manage')).toBe(true);
      }
    }
  });

  it('has portal proposals and decisions made by holders of org.portal.manage', () => {
    for (const policy of PORTAL_POLICIES) {
      const actors = [
        policy.approvedBy,
        policy.proposal?.proposedBy ?? null,
        ...policy.history.flatMap((entry) => [entry.by, entry.proposedBy]),
      ];
      for (const actor of actors) {
        if (actor !== null) expect(holdsIn(actor, policy.tenantId, 'org.portal.manage')).toBe(true);
      }
    }
  });

  it('covers every recorded self-approval with the documented alternative oversight of the buyer (BR-07)', () => {
    for (const version of POLICY_VERSIONS) {
      if (version.approvedBy !== null && version.approvedBy === version.submittedBy) expect(hasOversight(version.tenantId)).toBe(true);
    }
    for (const version of TEMPLATE_VERSIONS) {
      if (version.approvedBy !== null && version.approvedBy === version.submittedBy) {
        expect(hasOversight(tenantOfTemplate(version.templateId))).toBe(true);
      }
    }
    for (const policy of PORTAL_POLICIES) {
      for (const entry of policy.history.filter((row) => row.outcome === 'approved')) {
        expect(entry.underAlternativeOversight).toBe(entry.proposedBy === entry.by);
        if (entry.underAlternativeOversight) expect(hasOversight(policy.tenantId)).toBe(true);
      }
    }
  });

  it('documents the oversight only for buyers, by their administrator', () => {
    for (const row of CONFIGURATION_OVERSIGHT) {
      expect(holdsIn(row.documentedBy, row.tenantId, 'org.policy.approve')).toBe(true);
      if (row.reviewerUserId !== null) {
        expect(findPersonaById(row.reviewerUserId)?.memberships.some((membership) => membership.tenantId === row.tenantId)).toBe(true);
      }
    }
  });
});

describe('policy links into the approvals fixtures', () => {
  it('links policy versions only to existing approval requests about a policy profile', () => {
    for (const version of POLICY_VERSIONS.filter((row) => row.approvalRequestId !== null)) {
      const approval = APPROVALS.find((row) => row.id === version.approvalRequestId);
      expect(approval).toBeDefined();
      expect(approval?.subjectType).toBe('policy_profile');
    }
  });

  it('links template versions only to existing approval requests about a template', () => {
    for (const version of TEMPLATE_VERSIONS.filter((row) => row.approvalRequestId !== null)) {
      const approval = APPROVALS.find((row) => row.id === version.approvalRequestId);
      expect(approval).toBeDefined();
      expect(approval?.subjectType).toBe('template');
    }
  });
});

describe('policy tender references and the tenders fixtures', () => {
  const eventTenders = TENDERS.filter((tender) => /^T-\d{4}-\d{4}$/.test(tender.reference));

  it('matches each tender reference with the tenders fixtures (buyer, reference, title, status, release time)', () => {
    for (const ref of POLICY_TENDER_REFS) {
      const tender = TENDERS.find((row) => row.id === ref.tenderId);
      expect(tender).toBeDefined();
      expect({ tenantId: ref.tenantId, reference: ref.reference, title: ref.title, status: ref.status, releasedAt: ref.releasedAt }).toEqual({
        tenantId: tender?.tenantId,
        reference: tender?.reference,
        title: tender?.title,
        status: tender?.status,
        releasedAt: tender?.releasedAt,
      });
    }
  });

  it('lists every procurement event of the tenders fixtures under exactly one policy version of its buyer', () => {
    for (const tender of eventTenders) {
      const versions = POLICY_VERSIONS.filter((version) => version.tenders.some((usage) => usage.tenderId === tender.id));
      expect(versions.map((version) => version.tenantId), tender.reference).toEqual([tender.tenantId]);
    }
  });

  it('freezes only versions that were approved and in force when the tender was released (BR-09)', () => {
    for (const version of POLICY_VERSIONS) {
      for (const usage of version.tenders.filter((row) => row.frozen)) {
        const tender = POLICY_TENDER_REFS.find((row) => row.tenderId === usage.tenderId);
        expect(tender?.releasedAt).not.toBeNull();
        expect(version.effectiveFrom).not.toBeNull();
        expect((version.effectiveFrom ?? '') <= (tender?.releasedAt ?? ''), `${tender?.reference} under version ${version.id}`).toBe(true);
      }
    }
  });
});
