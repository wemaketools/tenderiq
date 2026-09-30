/**
 * Qualification fixtures, part 2: programs, versions and criteria (ADM-09; blueprint `qualification_programs`,
 * `qualification_program_versions`, `qualification_criteria`).
 *
 * KWU runs the storyline program "Water Infrastructure Suppliers — Category A" (WTR-INFRA, covering WTR-PUMP and
 * WTR-PIPE) with three versions (v1 retired, v2 current, v3 draft revision adding ISO 45001), plus ICT, metering and
 * environmental programs, one retired and one draft program. ODC runs two programs of its own, which proves that
 * programs, applications and decisions are buyer-specific (BR-45).
 *
 * Criterion ids are `programVersionId * 100 + position`.
 */
import type { NonNegativeMoney } from '../../../contracts/common.js';
import type {
  EvidenceItemsEvidenceType,
  QualificationCriteriaArea,
  QualificationCriteriaResponseType,
  QualificationProgramVersionsStatus,
  QualificationProgramsStatus,
  ReassessmentTriggersTriggerType,
} from '../../../contracts/enums.js';
import type { CriterionKey } from './world.js';
import { BWP, KWU, ODC, USERS } from './world.js';

export interface FxProgram {
  readonly id: number;
  readonly tenantId: number;
  readonly name: string;
  readonly description: string;
  readonly categoryId: number;
  readonly geography: string | null;
  readonly maxContractValue: NonNegativeMoney | null;
  readonly validityMonths: number;
  readonly renewalNoticeDays: number;
  /** Days after a decision within which the supplier may request reconsideration (the stated appeal window, SUP-24). */
  readonly reconsiderationWindowDays: number;
  readonly decisionRoleCode: string;
  readonly requiresIndependentApproval: boolean;
  readonly status: QualificationProgramsStatus;
  readonly currentVersionId: number | null;
  readonly ownerUserId: number;
  readonly monitoredTriggerTypes: readonly ReassessmentTriggersTriggerType[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FxProgramVersion {
  readonly id: number;
  readonly tenantId: number;
  readonly programId: number;
  readonly versionNo: number;
  readonly status: QualificationProgramVersionsStatus;
  readonly changeNote: string | null;
  readonly approvedByUserId: number | null;
  readonly approvedAt: string | null;
  readonly createdAt: string;
}

export interface FxCriterion {
  readonly id: number;
  readonly tenantId: number;
  readonly programVersionId: number;
  readonly key: CriterionKey;
  readonly area: QualificationCriteriaArea;
  readonly question: string;
  readonly guidance: string | null;
  readonly responseType: QualificationCriteriaResponseType;
  readonly mandatory: boolean;
  readonly evidenceTypes: readonly EvidenceItemsEvidenceType[];
  readonly requiresNaReason: boolean;
  readonly thresholdDescription: string | null;
  readonly sortOrder: number;
}

type CriterionTemplate = Omit<FxCriterion, 'id' | 'tenantId' | 'programVersionId' | 'sortOrder' | 'key'>;

/** The criterion families of the demo programs (PRD §7.3 assessment areas). */
const TEMPLATES: Record<CriterionKey, CriterionTemplate> = {
  REG: {
    area: 'corporate',
    question: 'Certificate of incorporation or registration of the applying legal entity',
    guidance: 'Upload the CIPA certificate of the entity that will contract. Group or parent documents are not accepted.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['registration'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  OWN: {
    area: 'corporate',
    question: 'Ownership disclosure: shareholders above 10% and ultimate beneficial owners',
    guidance: 'Name each shareholder above 10%, the ultimate beneficial owners and any parent company.',
    responseType: 'text',
    mandatory: true,
    evidenceTypes: [],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  FIN_STMT: {
    area: 'financial',
    question: 'Audited financial statements of the applying entity for the latest financial year',
    guidance:
      'State the financial year end, reporting currency and whether the figures are consolidated. A parent’s statements need a signed parent support letter.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['financial_statement'],
    requiresNaReason: false,
    thresholdDescription: 'Annual turnover of at least BWP 5,000,000, or parent support covering the requested scope',
  },
  FIN_RATIO: {
    area: 'financial',
    question: 'Current ratio (current assets ÷ current liabilities) from the latest statements',
    guidance: 'Calculate from the statements uploaded above. A ratio below the threshold flags review; it does not reject.',
    responseType: 'number',
    mandatory: true,
    evidenceTypes: [],
    requiresNaReason: false,
    thresholdDescription: 'At least 1.20',
  },
  REF_CONTRACTS: {
    area: 'capability',
    question: 'Comparable contracts delivered in the last five years (at least three)',
    guidance: 'List client, scope, value, dates and your role for each contract.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['reference'],
    requiresNaReason: false,
    thresholdDescription: 'Three contracts of at least BWP 1,000,000 each in the requested category',
  },
  CAPACITY: {
    area: 'capability',
    question: 'Workshop, fleet and field-service capacity available for this category',
    guidance: 'Describe staff numbers, workshops, vehicles and current workload.',
    responseType: 'text',
    mandatory: true,
    evidenceTypes: [],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  ISO9001: {
    area: 'quality',
    question: 'ISO 9001 quality management certificate',
    guidance: 'The certificate must be current and cover the activities applied for.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['certificate'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  ISO45001: {
    area: 'quality',
    question: 'ISO 45001 occupational health and safety certificate, or an equivalent documented system',
    guidance: 'Proposed for version 3. An equivalent system needs an independent audit report.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['certificate', 'policy'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  PL_INS: {
    area: 'insurance',
    question: 'Public liability insurance naming the applying entity as insured',
    guidance: 'Upload the certificate showing insurer, insured party, cover and expiry.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['insurance'],
    requiresNaReason: false,
    thresholdDescription: 'Cover of at least BWP 5,000,000 per occurrence, valid for the qualification period',
  },
  PI_INS: {
    area: 'insurance',
    question: 'Professional indemnity insurance',
    guidance: 'Required where the supplier offers design or engineering advice. Otherwise mark not applicable and explain.',
    responseType: 'document',
    mandatory: false,
    evidenceTypes: ['insurance'],
    requiresNaReason: true,
    thresholdDescription: 'Cover of at least BWP 2,000,000 where design services are offered',
  },
  LICENCE: {
    area: 'regulatory',
    question: 'PPADB contractor registration in the relevant works or supply code',
    guidance: null,
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['license'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  NO_EXCL: {
    area: 'integrity',
    question: 'Do you declare that the entity and its directors are not excluded, debarred or under sanctions?',
    guidance:
      'Screening checks run independently. A possible match only flags a review; it never excludes on its own (BR-48).',
    responseType: 'yes_no',
    mandatory: true,
    evidenceTypes: ['declaration'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  ENV_POLICY: {
    area: 'social_environmental',
    question: 'Environmental management policy covering site works',
    guidance: 'Mark not applicable only where no site works are offered, and explain.',
    responseType: 'document',
    mandatory: false,
    evidenceTypes: ['policy'],
    requiresNaReason: true,
    thresholdDescription: null,
  },
  CLIENT_REFS: {
    area: 'references',
    question: 'Two client references for comparable work in the last three years',
    guidance: 'Include a contact person. The buyer may contact referees.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['reference'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  SEC_CERT: {
    area: 'quality',
    question: 'ISO/IEC 27001 information security certificate',
    guidance: 'Required for remote access to operational technology networks.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['certificate'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  SCADA_EXP: {
    area: 'capability',
    question: 'SCADA and telemetry projects delivered for utilities',
    guidance: 'Name the platform, number of sites and support model.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['reference'],
    requiresNaReason: false,
    thresholdDescription: 'At least two utility SCADA projects with 20+ remote sites',
  },
  METER_APPROVAL: {
    area: 'regulatory',
    question: 'Botswana Bureau of Standards type approval for the meters offered',
    guidance: null,
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['certificate'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  WASTE_LICENCE: {
    area: 'regulatory',
    question: 'Waste management licence (Department of Waste Management and Pollution Control)',
    guidance: 'The licence must remain valid for the qualification period. Report any lapse immediately.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['license'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  LAB_ACCRED: {
    area: 'quality',
    question: 'SADCAS laboratory accreditation (ISO/IEC 17025)',
    guidance: null,
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['certificate'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  CLEAN_STAFF: {
    area: 'capability',
    question: 'Staffing and supervision plan for facilities cleaning',
    guidance: 'Show staff numbers per site, supervision ratio and relief arrangements.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['reference', 'other'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
  CIV_GRADE: {
    area: 'regulatory',
    question: 'PPADB civil works grade registration',
    guidance: null,
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['license'],
    requiresNaReason: false,
    thresholdDescription: 'Grade OC or higher',
  },
  PLANT: {
    area: 'capability',
    question: 'Plant and equipment available for road works',
    guidance: 'List owned and hired plant with availability.',
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['reference'],
    requiresNaReason: false,
    thresholdDescription: null,
  },
};

type CriterionSpec = CriterionKey | { key: CriterionKey; override: Partial<CriterionTemplate> };

function criteria(tenantId: number, programVersionId: number, specs: readonly CriterionSpec[]): FxCriterion[] {
  return specs.map((spec, index) => {
    const key = typeof spec === 'string' ? spec : spec.key;
    const override = typeof spec === 'string' ? {} : spec.override;
    return {
      id: programVersionId * 100 + index + 1,
      tenantId,
      programVersionId,
      key,
      ...TEMPLATES[key],
      ...override,
      sortOrder: (index + 1) * 10,
    };
  });
}

const ALL_TRIGGERS: readonly ReassessmentTriggersTriggerType[] = [
  'evidence_expiry',
  'ownership_change',
  'financial_change',
  'insurance_expired',
  'adverse_finding',
  'poor_performance',
  'manual',
];

/** The reconsideration window every demo program states in its appeal route ("within 14 days"). */
export const RECONSIDERATION_WINDOW_DAYS = 14;

export const QUALIFICATION_PROGRAMS: readonly FxProgram[] = Object.freeze([
  {
    id: 11,
    tenantId: KWU,
    name: 'Water Infrastructure Suppliers — Category A',
    description:
      'Suppliers and contractors of pumps, pipes, valves and mechanical equipment for water infrastructure up to BWP 10,000,000 per contract.',
    categoryId: 1,
    geography: 'Botswana',
    maxContractValue: BWP('10000000.00'),
    validityMonths: 24,
    renewalNoticeDays: 60,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: true,
    status: 'active',
    currentVersionId: 112,
    ownerUserId: USERS.mpho,
    monitoredTriggerTypes: ALL_TRIGGERS,
    createdAt: '2025-09-15T07:30:00Z',
    updatedAt: '2026-09-22T09:10:00Z',
  },
  {
    id: 12,
    tenantId: KWU,
    name: 'ICT and Telemetry Service Providers',
    description: 'SCADA, telemetry, network and operational technology service providers.',
    categoryId: 5,
    geography: 'Botswana',
    maxContractValue: BWP('5000000.00'),
    validityMonths: 36,
    renewalNoticeDays: 90,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: true,
    status: 'active',
    currentVersionId: 121,
    ownerUserId: USERS.mpho,
    monitoredTriggerTypes: ['evidence_expiry', 'financial_change', 'adverse_finding', 'poor_performance', 'manual'],
    createdAt: '2025-11-03T08:00:00Z',
    updatedAt: '2025-12-01T10:00:00Z',
  },
  {
    id: 13,
    tenantId: KWU,
    name: 'Metering Equipment Suppliers',
    description: 'Suppliers of mechanical and smart water meters, meter reading and installation services.',
    categoryId: 4,
    geography: 'Botswana',
    maxContractValue: BWP('3000000.00'),
    validityMonths: 24,
    renewalNoticeDays: 60,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: false,
    status: 'active',
    currentVersionId: 131,
    ownerUserId: USERS.mpho,
    monitoredTriggerTypes: ['evidence_expiry', 'insurance_expired', 'poor_performance', 'manual'],
    createdAt: '2024-05-06T08:00:00Z',
    updatedAt: '2024-06-10T08:00:00Z',
  },
  {
    id: 14,
    tenantId: KWU,
    name: 'Environmental and Laboratory Services',
    description: 'Water quality laboratories, waste handling and environmental monitoring services.',
    categoryId: 11,
    geography: 'Botswana',
    maxContractValue: BWP('2000000.00'),
    validityMonths: 24,
    renewalNoticeDays: 60,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: false,
    status: 'active',
    currentVersionId: 141,
    ownerUserId: USERS.mpho,
    monitoredTriggerTypes: ['evidence_expiry', 'adverse_finding', 'manual'],
    createdAt: '2025-10-01T08:00:00Z',
    updatedAt: '2025-10-20T08:00:00Z',
  },
  {
    id: 15,
    tenantId: KWU,
    name: 'Civil Works Contractors (2024 panel)',
    description: 'Retired panel for minor civil works; replaced by project-specific qualification.',
    categoryId: 8,
    geography: 'South-East District',
    maxContractValue: BWP('1500000.00'),
    validityMonths: 12,
    renewalNoticeDays: 30,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: false,
    status: 'retired',
    currentVersionId: 151,
    ownerUserId: USERS.mpho,
    monitoredTriggerTypes: ['manual'],
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2025-06-30T08:00:00Z',
  },
  {
    id: 16,
    tenantId: KWU,
    name: 'Water Treatment Chemicals and Dosing',
    description: 'Draft program for chlorine, coagulants and dosing equipment suppliers (framework T-2026-0005).',
    categoryId: 6,
    geography: 'Botswana',
    maxContractValue: BWP('4000000.00'),
    validityMonths: 24,
    renewalNoticeDays: 60,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: true,
    status: 'draft',
    currentVersionId: null,
    ownerUserId: USERS.mpho,
    monitoredTriggerTypes: ['evidence_expiry', 'insurance_expired', 'adverse_finding', 'manual'],
    createdAt: '2026-09-08T08:00:00Z',
    updatedAt: '2026-09-25T14:40:00Z',
  },
  {
    id: 21,
    tenantId: ODC,
    name: 'Facilities and Cleaning Contractors',
    description: 'Cleaning, hygiene and facilities contractors for council offices and clinics.',
    categoryId: 20,
    geography: 'Okavango District',
    maxContractValue: BWP('1500000.00'),
    validityMonths: 24,
    renewalNoticeDays: 45,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: false,
    status: 'active',
    currentVersionId: 211,
    ownerUserId: USERS.officerOdc,
    monitoredTriggerTypes: ['evidence_expiry', 'poor_performance', 'manual'],
    createdAt: '2026-03-02T08:00:00Z',
    updatedAt: '2026-03-20T08:00:00Z',
  },
  {
    id: 22,
    tenantId: ODC,
    name: 'Roads and Civil Works Contractors',
    description: 'Road maintenance, drainage and minor civil works in the Okavango District.',
    categoryId: 21,
    geography: 'Okavango District',
    maxContractValue: BWP('6000000.00'),
    validityMonths: 24,
    renewalNoticeDays: 60,
    reconsiderationWindowDays: RECONSIDERATION_WINDOW_DAYS,
    decisionRoleCode: 'procurement_manager',
    requiresIndependentApproval: true,
    status: 'active',
    currentVersionId: 221,
    ownerUserId: USERS.officerOdc,
    monitoredTriggerTypes: ['evidence_expiry', 'insurance_expired', 'poor_performance', 'manual'],
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-22T08:00:00Z',
  },
]);

export const QUALIFICATION_PROGRAM_VERSIONS: readonly FxProgramVersion[] = Object.freeze([
  { id: 111, tenantId: KWU, programId: 11, versionNo: 1, status: 'retired', changeNote: 'Initial criteria.', approvedByUserId: USERS.mpho, approvedAt: '2025-09-30T12:00:00Z', createdAt: '2025-09-15T07:30:00Z' },
  { id: 112, tenantId: KWU, programId: 11, versionNo: 2, status: 'approved', changeNote: 'Added professional indemnity and environmental policy criteria; raised the insurance cover to BWP 5,000,000.', approvedByUserId: USERS.mpho, approvedAt: '2026-03-02T10:15:00Z', createdAt: '2026-02-16T08:00:00Z' },
  { id: 113, tenantId: KWU, programId: 11, versionNo: 3, status: 'draft', changeNote: 'Proposed: ISO 45001 or equivalent occupational health and safety system.', approvedByUserId: null, approvedAt: null, createdAt: '2026-09-22T09:10:00Z' },
  { id: 121, tenantId: KWU, programId: 12, versionNo: 1, status: 'approved', changeNote: 'Initial criteria.', approvedByUserId: USERS.mpho, approvedAt: '2025-12-01T10:00:00Z', createdAt: '2025-11-03T08:00:00Z' },
  { id: 131, tenantId: KWU, programId: 13, versionNo: 1, status: 'approved', changeNote: 'Initial criteria.', approvedByUserId: USERS.mpho, approvedAt: '2024-06-10T08:00:00Z', createdAt: '2024-05-06T08:00:00Z' },
  { id: 141, tenantId: KWU, programId: 14, versionNo: 1, status: 'approved', changeNote: 'Initial criteria.', approvedByUserId: USERS.mpho, approvedAt: '2025-10-20T08:00:00Z', createdAt: '2025-10-01T08:00:00Z' },
  { id: 151, tenantId: KWU, programId: 15, versionNo: 1, status: 'retired', changeNote: 'Initial criteria.', approvedByUserId: USERS.mpho, approvedAt: '2024-02-01T08:00:00Z', createdAt: '2024-01-15T08:00:00Z' },
  { id: 161, tenantId: KWU, programId: 16, versionNo: 1, status: 'draft', changeNote: 'First draft for the chemicals framework.', approvedByUserId: null, approvedAt: null, createdAt: '2026-09-08T08:00:00Z' },
  { id: 211, tenantId: ODC, programId: 21, versionNo: 1, status: 'approved', changeNote: 'Initial criteria.', approvedByUserId: USERS.adminOdc, approvedAt: '2026-03-20T08:00:00Z', createdAt: '2026-03-02T08:00:00Z' },
  { id: 221, tenantId: ODC, programId: 22, versionNo: 1, status: 'approved', changeNote: 'Initial criteria.', approvedByUserId: USERS.adminOdc, approvedAt: '2026-06-22T08:00:00Z', createdAt: '2026-06-01T08:00:00Z' },
]);

const P11_V2: readonly CriterionSpec[] = [
  'REG',
  'OWN',
  'FIN_STMT',
  'FIN_RATIO',
  'REF_CONTRACTS',
  'CAPACITY',
  'ISO9001',
  'PL_INS',
  'PI_INS',
  'LICENCE',
  'NO_EXCL',
  'ENV_POLICY',
  'CLIENT_REFS',
];

export const QUALIFICATION_CRITERIA: readonly FxCriterion[] = Object.freeze([
  ...criteria(KWU, 111, [
    'REG',
    'OWN',
    'FIN_STMT',
    'FIN_RATIO',
    'REF_CONTRACTS',
    'CAPACITY',
    'ISO9001',
    { key: 'PL_INS', override: { thresholdDescription: 'Cover of at least BWP 3,000,000 per occurrence' } },
    'LICENCE',
    'NO_EXCL',
    'CLIENT_REFS',
  ]),
  ...criteria(KWU, 112, P11_V2),
  ...criteria(KWU, 113, [...P11_V2, 'ISO45001']),
  ...criteria(KWU, 121, [
    'REG',
    'OWN',
    { key: 'FIN_STMT', override: { thresholdDescription: 'Annual turnover of at least BWP 3,000,000' } },
    'SEC_CERT',
    'SCADA_EXP',
    'PL_INS',
    'PI_INS',
    'NO_EXCL',
    'CLIENT_REFS',
  ]),
  ...criteria(KWU, 131, [
    'REG',
    { key: 'FIN_STMT', override: { thresholdDescription: 'Annual turnover of at least BWP 2,000,000' } },
    'METER_APPROVAL',
    'ISO9001',
    { key: 'PL_INS', override: { thresholdDescription: 'Cover of at least BWP 3,000,000 per occurrence' } },
    'NO_EXCL',
    'CLIENT_REFS',
  ]),
  ...criteria(KWU, 141, [
    'REG',
    { key: 'FIN_STMT', override: { thresholdDescription: 'Annual turnover of at least BWP 1,500,000' } },
    'WASTE_LICENCE',
    'LAB_ACCRED',
    'PL_INS',
    'NO_EXCL',
    { key: 'ENV_POLICY', override: { mandatory: true, requiresNaReason: false } },
    'CLIENT_REFS',
  ]),
  ...criteria(KWU, 151, ['REG', 'FIN_STMT', 'LICENCE', 'PL_INS', 'NO_EXCL']),
  ...criteria(KWU, 161, ['REG', 'NO_EXCL', 'PL_INS']),
  ...criteria(ODC, 211, [
    'REG',
    { key: 'FIN_STMT', override: { thresholdDescription: 'Annual turnover of at least BWP 1,000,000' } },
    'CLEAN_STAFF',
    { key: 'PL_INS', override: { thresholdDescription: 'Cover of at least BWP 2,000,000 per occurrence' } },
    'NO_EXCL',
    'CLIENT_REFS',
  ]),
  ...criteria(ODC, 221, [
    'REG',
    'FIN_STMT',
    'CIV_GRADE',
    'PLANT',
    'PL_INS',
    'NO_EXCL',
    'CLIENT_REFS',
  ]),
]);

export function findProgram(programId: number): FxProgram | undefined {
  return QUALIFICATION_PROGRAMS.find((program) => program.id === programId);
}

export function findProgramVersion(programVersionId: number): FxProgramVersion | undefined {
  return QUALIFICATION_PROGRAM_VERSIONS.find((version) => version.id === programVersionId);
}

export function versionsOf(programId: number): FxProgramVersion[] {
  return QUALIFICATION_PROGRAM_VERSIONS.filter((version) => version.programId === programId).sort(
    (a, b) => b.versionNo - a.versionNo,
  );
}

export function criteriaOf(programVersionId: number): FxCriterion[] {
  return QUALIFICATION_CRITERIA.filter((criterion) => criterion.programVersionId === programVersionId).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}
