/**
 * Evidence pack manifests (ADM-14): what a pack for one record contains, omits and redacts. Sealed content before
 * its opening is never included (BR-17); restricted audit rows appear as metadata only and only when requested by
 * an audit.view holder (DD-31). Also encodes the pack options into the synthetic export index.
 */
import { EVIDENCE_PACK_SUBJECT_TYPES } from '../../../contracts/records.js';
import type { ExportManifest } from '../../../contracts/reporting.js';
import { AUDIT_EVENTS, HOLDS, RECORD_SUBJECTS } from '../../fixtures/records/index.js';
import type { FixtureRecordSubject } from '../../fixtures/records/index.js';

/** Subjects an evidence pack can be produced for, in a stable order (the synthetic export index). */
export const EVIDENCE_PACK_SUBJECTS: readonly FixtureRecordSubject[] = RECORD_SUBJECTS.filter((subject) =>
  (EVIDENCE_PACK_SUBJECT_TYPES as readonly string[]).includes(subject.subjectType),
);

export function evidencePackSubjectAt(index: number): FixtureRecordSubject | undefined {
  return EVIDENCE_PACK_SUBJECTS[index];
}

export function evidencePackIndex(subject: FixtureRecordSubject, includeAuditTrail: boolean, includeRestrictedMetadata: boolean): number {
  return EVIDENCE_PACK_SUBJECTS.indexOf(subject) * 4 + (includeAuditTrail ? 2 : 0) + (includeRestrictedMetadata ? 1 : 0);
}

export function decodeEvidencePackIndex(index: number): { subjectIndex: number; includeAuditTrail: boolean; includeRestrictedMetadata: boolean } {
  return { subjectIndex: Math.floor(index / 4), includeAuditTrail: (index & 2) === 2, includeRestrictedMetadata: (index & 1) === 1 };
}

export function evidencePackManifest(subject: FixtureRecordSubject, includeAuditTrail: boolean, includeRestrictedMetadata: boolean): ExportManifest {
  const label = `${subject.reference ?? ''} ${subject.label}`.trim();
  const auditRows = AUDIT_EVENTS.filter((event) => event.tenantId === subject.tenantId && (event.entityReference === subject.reference || (event.entityType === subject.subjectType && event.entityId === subject.subjectId)));
  const restrictedRows = auditRows.filter((event) => event.sensitivity === 'restricted');
  const holds = HOLDS.filter((hold) => hold.tenantId === subject.tenantId && hold.releasedAt === null && hold.subjectType === subject.subjectType && hold.subjectId === subject.subjectId);
  const contents: ExportManifest['contents'] = [
    { label: 'Record summary', description: `Current state, owner and history of ${label}.`, recordCount: 1 },
    { label: 'Documents', description: 'Issued documents and released editions; protected originals stay distinguishable from redacted copies.', recordCount: null },
  ];
  if (includeAuditTrail) {
    contents.push({
      label: 'Audit trail',
      description: includeRestrictedMetadata ? 'Business actions and access events, with restricted rows as metadata only.' : 'Business actions and access events (restricted rows left out).',
      recordCount: includeRestrictedMetadata ? auditRows.length : auditRows.length - restrictedRows.length,
    });
  }
  if (holds.length > 0) {
    contents.push({ label: 'Holds', description: 'Active legal and investigation holds on the record.', recordCount: holds.length });
  }
  const omissions: ExportManifest['omissions'] = [];
  if (subject.sealedBeforeOpening) {
    omissions.push({ label: 'Bid contents', reason: 'Sealed until the authorized opening (BR-17); only receipt metadata is included.' });
  }
  if (includeAuditTrail && !includeRestrictedMetadata && restrictedRows.length > 0) {
    omissions.push({ label: 'Restricted audit rows', reason: 'Not requested; include them as metadata only with audit access.' });
  }
  if (!includeAuditTrail) {
    omissions.push({ label: 'Audit trail', reason: 'Not requested for this pack.' });
  }
  return {
    contents,
    versions: [{ label: 'Record snapshot', reference: subject.reference, version: 'latest approved version' }],
    omissions,
    redactions: [
      { field: 'Personal and banking information', reason: 'Outside the pack purpose (PRD §18.1).' },
      ...(includeRestrictedMetadata && restrictedRows.length > 0 ? [{ field: 'Restricted audit rows', reason: 'Metadata only: no sealed content or evaluator scores (DD-31).' }] : []),
    ],
  };
}
