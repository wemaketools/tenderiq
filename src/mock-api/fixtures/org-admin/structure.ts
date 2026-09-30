/**
 * Org-admin fixtures: organization settings (ADM-01) and business structure (ADM-02) of both buyers.
 *
 * KWU has a full structure (three legal entities, a department hierarchy, depots, a category tree under WTR-INFRA,
 * cost centres and funding sources) with one deactivated value of every kind, which stays on historical records.
 * ODC deliberately keeps a simple structure (FR-01: no invented departments or committees).
 */
import type { FundingSourcesSourceType, TenantsOnboardingStage, TenantsVerificationStatus } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';
import { uid } from './refs.js';

export interface FixtureOrganizationSettings {
  readonly tenantId: number;
  readonly tradingName: string | null;
  readonly country: string;
  readonly registrationJurisdiction: string;
  readonly registrationNumber: string;
  readonly taxIdentifier: string | null;
  readonly verificationStatus: TenantsVerificationStatus;
  readonly onboardingStage: TenantsOnboardingStage;
  readonly planCode: string;
  readonly acceptedCurrencies: readonly string[];
  readonly defaultCalendar: { readonly id: number; readonly name: string } | null;
  readonly responsibilities: {
    readonly procurementOwner: number | null;
    readonly administrator: number | null;
    readonly budgetApprovalOwner: number | null;
    readonly publicationOwner: number | null;
    readonly complaintsOwner: number | null;
    readonly recordsOwner: number | null;
    readonly contractOwner: number | null;
    readonly supportContact: number | null;
  };
  readonly brandingDisplayName: string | null;
  readonly publicPortalEnabled: boolean;
  readonly portalIntro: string | null;
  readonly sodAlternativeOversightNote: string | null;
  readonly policyProfile: { readonly name: string; readonly versionNo: number } | null;
  /** Open tenders and published notices a settings change could affect (impact review). */
  readonly openTenderReferences: readonly string[];
  readonly publishedNoticeReferences: readonly string[];
  readonly updatedAt: string;
  readonly updatedByUserId: number | null;
}

export const ORGANIZATION_SETTINGS: readonly FixtureOrganizationSettings[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    tradingName: 'Kalahari Water',
    country: 'BW',
    registrationJurisdiction: 'Botswana',
    registrationNumber: 'BW-PE-2004-0117',
    taxIdentifier: 'C01234567',
    verificationStatus: 'identity_verified',
    onboardingStage: 'pilot',
    planCode: 'buyer-professional',
    acceptedCurrencies: ['BWP', 'ZAR', 'USD'],
    defaultCalendar: { id: 1, name: 'Botswana Public Holidays 2026' },
    responsibilities: {
      procurementOwner: uid('mpho.manager'),
      administrator: uid('admin.kwu'),
      budgetApprovalOwner: uid('onalenna.budget'),
      publicationOwner: uid('tebogo.officer'),
      complaintsOwner: uid('dineo.legal'),
      recordsOwner: 108,
      contractOwner: uid('masego.contracts'),
      supportContact: null,
    },
    brandingDisplayName: 'Kalahari Water Utilities',
    publicPortalEnabled: true,
    portalIntro:
      'Kalahari Water Utilities publishes open tenders, clarifications and award notices here. Register once to take part in any open procurement.',
    sodAlternativeOversightNote: null,
    policyProfile: { name: 'KWU Standard Procurement Policy', versionNo: 2 },
    openTenderReferences: ['T-2026-0002', 'T-2026-0006'],
    publishedNoticeReferences: ['T-2026-0001', 'T-2026-0002', 'T-2026-0003', 'T-2026-0004', 'T-2026-0007', 'T-2026-0008', 'T-2026-0010'],
    updatedAt: '2026-09-14T09:12:00Z',
    updatedByUserId: uid('admin.kwu'),
  },
  {
    tenantId: TENANT_IDS.odc,
    tradingName: null,
    country: 'BW',
    registrationJurisdiction: 'Botswana',
    registrationNumber: 'BW-LA-1966-0031',
    taxIdentifier: null,
    verificationStatus: 'contact_verified',
    onboardingStage: 'configuring',
    planCode: 'buyer-essentials',
    acceptedCurrencies: ['BWP'],
    defaultCalendar: null,
    responsibilities: {
      procurementOwner: uid('officer.odc'),
      administrator: uid('admin.odc'),
      budgetApprovalOwner: 113,
      publicationOwner: uid('officer.odc'),
      complaintsOwner: null,
      recordsOwner: null,
      contractOwner: null,
      supportContact: uid('admin.odc'),
    },
    brandingDisplayName: null,
    publicPortalEnabled: true,
    portalIntro: null,
    sodAlternativeOversightNote:
      'With two procurement staff, the Council Secretary reviews every release and opening record in place of a second officer.',
    policyProfile: null,
    openTenderReferences: ['T-2026-0011'],
    publishedNoticeReferences: ['T-2026-0011'],
    updatedAt: '2026-09-02T12:30:00Z',
    updatedByUserId: uid('admin.odc'),
  },
] satisfies FixtureOrganizationSettings[]);

interface StructureCommon {
  readonly id: number;
  readonly tenantId: number;
  readonly active: boolean;
  readonly deactivatedAt: string | null;
  readonly createdAt: string;
  readonly referenceCount: number;
  readonly openTenders: number;
  readonly activeContracts: number;
}

export interface FixtureLegalEntity extends StructureCommon {
  readonly name: string;
  readonly registrationNumber: string | null;
  readonly country: string;
  readonly address: string | null;
  readonly isContractingEntity: boolean;
}

export interface FixtureDepartment extends StructureCommon {
  readonly name: string;
  readonly code: string | null;
  readonly parentId: number | null;
  readonly legalEntityId: number | null;
  readonly headUserId: number | null;
}

export interface FixtureLocation extends StructureCommon {
  readonly name: string;
  readonly address: string | null;
  readonly region: string | null;
  readonly country: string;
}

export interface FixtureCategory extends StructureCommon {
  readonly name: string;
  readonly code: string | null;
  readonly parentId: number | null;
  readonly catalogCode: string | null;
}

export interface FixtureCostCenter extends StructureCommon {
  readonly code: string;
  readonly name: string;
  readonly departmentId: number | null;
}

export interface FixtureFundingSource extends StructureCommon {
  readonly code: string;
  readonly name: string;
  readonly sourceType: FundingSourcesSourceType;
  readonly externalReference: string | null;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;
const live = (createdAt: string, referenceCount: number, openTenders = 0, activeContracts = 0) => ({
  active: true,
  deactivatedAt: null,
  createdAt,
  referenceCount,
  openTenders,
  activeContracts,
});
const retired = (createdAt: string, deactivatedAt: string, referenceCount: number) => ({
  active: false,
  deactivatedAt,
  createdAt,
  referenceCount,
  openTenders: 0,
  activeContracts: 0,
});

export const LEGAL_ENTITIES: readonly FixtureLegalEntity[] = Object.freeze([
  {
    id: 1, tenantId: KWU, name: 'Kalahari Water Utilities Corporation', registrationNumber: 'BW-PE-2004-0117', country: 'BW',
    address: 'Plot 1234, Khama Crescent, Gaborone', isContractingEntity: true, ...live('2026-01-12T08:00:00Z', 46, 2, 2),
  },
  {
    id: 2, tenantId: KWU, name: 'KWU Northern Operations Division', registrationNumber: null, country: 'BW',
    address: 'Blue Jacket Street, Francistown', isContractingEntity: false, ...live('2026-01-12T08:00:00Z', 9),
  },
  {
    id: 3, tenantId: KWU, name: 'Kalahari Water Projects Trust (dissolved)', registrationNumber: 'BW-TR-2011-0452', country: 'BW',
    address: null, isContractingEntity: true, ...retired('2026-01-12T08:00:00Z', '2026-03-31T15:00:00Z', 4),
  },
  {
    id: 61, tenantId: ODC, name: 'Okavango District Council', registrationNumber: 'BW-LA-1966-0031', country: 'BW',
    address: 'Council Offices, Maun', isContractingEntity: true, ...live('2026-02-02T08:00:00Z', 6, 1, 0),
  },
] satisfies FixtureLegalEntity[]);

export const DEPARTMENTS: readonly FixtureDepartment[] = Object.freeze([
  { id: 11, tenantId: KWU, name: 'Operations', code: 'OPS', parentId: null, legalEntityId: 1, headUserId: uid('onalenna.budget'), ...live('2026-01-12T08:00:00Z', 22, 2) },
  { id: 12, tenantId: KWU, name: 'Technical Services', code: 'TECH', parentId: 11, legalEntityId: 1, headUserId: uid('thato.eval'), ...live('2026-01-12T08:00:00Z', 14, 1) },
  { id: 13, tenantId: KWU, name: 'Network Operations', code: 'NET', parentId: 11, legalEntityId: 1, headUserId: uid('kabo.eval'), ...live('2026-01-12T08:00:00Z', 11, 1) },
  { id: 14, tenantId: KWU, name: 'Water Quality', code: 'WQ', parentId: 11, legalEntityId: 1, headUserId: uid('amantle.eval'), ...live('2026-01-12T08:00:00Z', 5) },
  { id: 15, tenantId: KWU, name: 'Finance', code: 'FIN', parentId: null, legalEntityId: 1, headUserId: uid('lesego.finance'), ...live('2026-01-12T08:00:00Z', 8) },
  { id: 16, tenantId: KWU, name: 'Procurement', code: 'PROC', parentId: 15, legalEntityId: 1, headUserId: uid('mpho.manager'), ...live('2026-01-12T08:00:00Z', 31) },
  { id: 17, tenantId: KWU, name: 'Internal Audit', code: 'AUD', parentId: null, legalEntityId: 1, headUserId: uid('pule.auditor'), ...live('2026-01-12T08:00:00Z', 3) },
  { id: 18, tenantId: KWU, name: 'Legal and Compliance', code: 'LEG', parentId: null, legalEntityId: 1, headUserId: uid('dineo.legal'), ...live('2026-01-12T08:00:00Z', 4) },
  { id: 19, tenantId: KWU, name: 'Northern Depots', code: 'NDEP', parentId: 11, legalEntityId: 2, headUserId: null, ...live('2026-02-01T08:00:00Z', 6) },
  { id: 20, tenantId: KWU, name: 'Rural Water Supply (merged into Operations)', code: 'RWS', parentId: 11, legalEntityId: 3, headUserId: null, ...retired('2026-01-12T08:00:00Z', '2026-03-31T15:00:00Z', 7) },
  { id: 62, tenantId: ODC, name: 'Works', code: 'WRK', parentId: null, legalEntityId: 61, headUserId: uid('officer.odc'), ...live('2026-02-02T08:00:00Z', 4, 1) },
  { id: 63, tenantId: ODC, name: 'Corporate Services', code: 'CORP', parentId: null, legalEntityId: 61, headUserId: uid('admin.odc'), ...live('2026-02-02T08:00:00Z', 2) },
] satisfies FixtureDepartment[]);

export const LOCATIONS: readonly FixtureLocation[] = Object.freeze([
  { id: 21, tenantId: KWU, name: 'Gaborone Head Office', address: 'Plot 1234, Khama Crescent, Gaborone', region: 'South-East', country: 'BW', ...live('2026-01-12T08:00:00Z', 18, 1) },
  { id: 22, tenantId: KWU, name: 'Francistown Depot', address: 'Blue Jacket Street, Francistown', region: 'North-East', country: 'BW', ...live('2026-01-12T08:00:00Z', 9, 1) },
  { id: 23, tenantId: KWU, name: 'Maun Depot', address: 'Airport Road, Maun', region: 'North-West', country: 'BW', ...live('2026-01-12T08:00:00Z', 6) },
  { id: 24, tenantId: KWU, name: 'Kasane Pump Station (decommissioned)', address: 'Chobe Riverfront, Kasane', region: 'Chobe', country: 'BW', ...retired('2026-01-12T08:00:00Z', '2026-05-29T15:00:00Z', 3) },
  { id: 64, tenantId: ODC, name: 'Council Offices, Maun', address: 'Council Offices, Maun', region: 'North-West', country: 'BW', ...live('2026-02-02T08:00:00Z', 3, 1) },
] satisfies FixtureLocation[]);

export const CATEGORIES: readonly FixtureCategory[] = Object.freeze([
  { id: 31, tenantId: KWU, name: 'Water infrastructure', code: 'WTR-INFRA', parentId: null, catalogCode: 'WTR-INFRA', ...live('2026-01-12T08:00:00Z', 12, 1) },
  { id: 32, tenantId: KWU, name: 'Pumps and mechanical', code: 'WTR-PUMP', parentId: 31, catalogCode: 'WTR-PUMP', ...live('2026-01-12T08:00:00Z', 9, 1, 1) },
  { id: 33, tenantId: KWU, name: 'Pipes and valves', code: 'WTR-PIPE', parentId: 31, catalogCode: 'WTR-PIPE', ...live('2026-01-12T08:00:00Z', 6) },
  { id: 34, tenantId: KWU, name: 'Water meters', code: 'WTR-METER', parentId: null, catalogCode: 'WTR-METER', ...live('2026-01-12T08:00:00Z', 5, 1) },
  { id: 35, tenantId: KWU, name: 'Treatment chemicals', code: 'WTR-TREAT', parentId: null, catalogCode: 'WTR-TREAT', ...live('2026-01-12T08:00:00Z', 3) },
  { id: 36, tenantId: KWU, name: 'SCADA and telemetry', code: 'ICT-SCADA', parentId: null, catalogCode: 'ICT-SCADA', ...live('2026-01-12T08:00:00Z', 4) },
  { id: 37, tenantId: KWU, name: 'Fleet maintenance', code: 'FLEET', parentId: null, catalogCode: 'FLEET-MAINT', ...live('2026-01-12T08:00:00Z', 3, 0, 1) },
  { id: 38, tenantId: KWU, name: 'Civil works', code: 'CIVIL', parentId: null, catalogCode: 'CIVIL-WORKS', ...live('2026-01-12T08:00:00Z', 4) },
  { id: 39, tenantId: KWU, name: 'Environmental services', code: 'ENV', parentId: null, catalogCode: 'ENV-SERV', ...live('2026-01-12T08:00:00Z', 2) },
  { id: 40, tenantId: KWU, name: 'Office stationery (legacy)', code: 'OFF-LEG', parentId: null, catalogCode: 'OFF-SUPPLY', ...retired('2026-01-12T08:00:00Z', '2026-02-27T15:00:00Z', 5) },
  { id: 65, tenantId: ODC, name: 'Cleaning services', code: 'CLEAN', parentId: null, catalogCode: 'FAC-CLEAN', ...live('2026-02-02T08:00:00Z', 2, 1) },
  { id: 66, tenantId: ODC, name: 'Building maintenance', code: 'BLDG', parentId: null, catalogCode: 'FAC-MAINT', ...live('2026-02-02T08:00:00Z', 1) },
] satisfies FixtureCategory[]);

export const COST_CENTERS: readonly FixtureCostCenter[] = Object.freeze([
  { id: 41, tenantId: KWU, code: 'CC-OPS-100', name: 'Operations — borehole maintenance', departmentId: 11, ...live('2026-01-12T08:00:00Z', 7, 1) },
  { id: 42, tenantId: KWU, code: 'CC-NET-210', name: 'Network — metering and valves', departmentId: 13, ...live('2026-01-12T08:00:00Z', 6, 1) },
  { id: 43, tenantId: KWU, code: 'CC-TECH-300', name: 'Technical services — SCADA', departmentId: 12, ...live('2026-01-12T08:00:00Z', 3) },
  { id: 44, tenantId: KWU, code: 'CC-WQ-400', name: 'Water quality — treatment', departmentId: 14, ...live('2026-01-12T08:00:00Z', 2) },
  { id: 45, tenantId: KWU, code: 'CC-FLT-500', name: 'Fleet', departmentId: 11, ...live('2026-01-12T08:00:00Z', 2, 0, 1) },
  { id: 46, tenantId: KWU, code: 'CC-RWS-900', name: 'Rural water supply (closed)', departmentId: 20, ...retired('2026-01-12T08:00:00Z', '2026-03-31T15:00:00Z', 4) },
  { id: 67, tenantId: ODC, code: 'CC-WRK-01', name: 'Works — facilities', departmentId: 62, ...live('2026-02-02T08:00:00Z', 2, 1) },
] satisfies FixtureCostCenter[]);

export const FUNDING_SOURCES: readonly FixtureFundingSource[] = Object.freeze([
  { id: 51, tenantId: KWU, code: 'OPEX-FY27', name: 'Operating budget FY2026/27', sourceType: 'operating_budget', externalReference: 'BUD-2026-OPEX', ...live('2026-03-01T08:00:00Z', 9, 1) },
  { id: 52, tenantId: KWU, code: 'CAPEX-FY27', name: 'Capital budget FY2026/27', sourceType: 'capital_budget', externalReference: 'BUD-2026-CAPEX', ...live('2026-03-01T08:00:00Z', 6, 1, 1) },
  { id: 53, tenantId: KWU, code: 'GRANT-WSR', name: 'Water Sector Reform Grant', sourceType: 'grant', externalReference: 'MoW-WSR-2026-08', ...live('2026-04-15T08:00:00Z', 2) },
  { id: 54, tenantId: KWU, code: 'AFDB-NRW', name: 'AfDB non-revenue water loan', sourceType: 'donor', externalReference: 'AfDB P-BW-E00-012', ...live('2026-05-20T08:00:00Z', 1) },
  { id: 55, tenantId: KWU, code: 'RELIEF-2020', name: 'Drought relief fund 2020 (closed)', sourceType: 'other', externalReference: null, ...retired('2026-01-12T08:00:00Z', '2026-01-31T15:00:00Z', 3) },
  { id: 68, tenantId: ODC, code: 'ODC-OPEX', name: 'Council recurrent budget', sourceType: 'operating_budget', externalReference: null, ...live('2026-02-02T08:00:00Z', 2, 1) },
] satisfies FixtureFundingSource[]);

export interface FixtureCatalogCategory {
  readonly code: string;
  readonly name: string;
  readonly parentCode: string | null;
  readonly description: string | null;
}

/** The global shared taxonomy (`category_catalog`). */
export const CATEGORY_CATALOG: readonly FixtureCatalogCategory[] = Object.freeze([
  { code: 'WTR-INFRA', name: 'Water infrastructure', parentCode: null, description: 'Water supply and distribution infrastructure.' },
  { code: 'WTR-PUMP', name: 'Pumps and mechanical equipment', parentCode: 'WTR-INFRA', description: 'Borehole, booster and dosing pumps.' },
  { code: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentCode: 'WTR-INFRA', description: null },
  { code: 'WTR-METER', name: 'Water meters', parentCode: null, description: 'Mechanical and smart meters, AMR/AMI.' },
  { code: 'WTR-TREAT', name: 'Water treatment chemicals', parentCode: null, description: null },
  { code: 'ICT-SCADA', name: 'SCADA and telemetry', parentCode: null, description: 'Control systems, RTUs and telemetry networks.' },
  { code: 'FLEET-MAINT', name: 'Fleet maintenance', parentCode: null, description: null },
  { code: 'CIVIL-WORKS', name: 'Civil works', parentCode: null, description: 'Reservoirs, pipelines and structures.' },
  { code: 'ENV-SERV', name: 'Environmental services', parentCode: null, description: null },
  { code: 'FAC-CLEAN', name: 'Cleaning services', parentCode: null, description: null },
  { code: 'FAC-MAINT', name: 'Building maintenance', parentCode: null, description: null },
  { code: 'OFF-SUPPLY', name: 'Office supplies', parentCode: null, description: null },
] satisfies FixtureCatalogCategory[]);
