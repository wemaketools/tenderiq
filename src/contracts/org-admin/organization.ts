/**
 * Org-admin contract, buyer organization (ADM-01) and business structure (ADM-02). FR-01, DD-10.
 *
 * - `tenants` is authoritative for official time zone, working languages and default currency; `org_settings` keeps
 *   procurement configuration (`accepted_currencies`, responsible people, portal switches) (DD-10).
 * - A settings change is reviewed first (`impact-review`): effects on public notices and active work are listed and
 *   must be acknowledged before the update is accepted.
 * - Legal entities, departments, locations, categories, cost centers and funding sources are deactivated, never
 *   deleted, so historical records keep their descriptions (FR-01 "Deactivated values remain interpretable").
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CurrencyCode,
  Id,
  IdParam,
  Instant,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Slug,
  TenantKind,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  FundingSourcesSourceType,
  TenantsOnboardingStage,
  TenantsStatus,
  TenantsVerificationStatus,
} from '../enums.js';
import { NamedRef } from './authority.js';

// ---------------------------------------------------------------------------------------------------------
// ADM-01 organization settings
// ---------------------------------------------------------------------------------------------------------

/** The responsible people FR-01 requires (`org_settings.*_user_id`). */
export const ORGANIZATION_RESPONSIBILITIES = [
  'procurementOwner',
  'administrator',
  'budgetApprovalOwner',
  'publicationOwner',
  'complaintsOwner',
  'recordsOwner',
  'contractOwner',
  'supportContact',
] as const;
export const OrganizationResponsibility = z.enum(ORGANIZATION_RESPONSIBILITIES);
export type OrganizationResponsibility = z.infer<typeof OrganizationResponsibility>;

const responsibilityShape = <T extends z.ZodType>(item: T) =>
  z.object({
    procurementOwner: item,
    administrator: item,
    budgetApprovalOwner: item,
    publicationOwner: item,
    complaintsOwner: item,
    recordsOwner: item,
    contractOwner: item,
    supportContact: item,
  });

export const OrganizationIdentity = z.object({
  tenantId: Id,
  slug: Slug,
  kind: TenantKind,
  legalName: z.string().min(1),
  tradingName: z.string().nullable(),
  status: TenantsStatus,
  country: z.string().length(2).nullable(),
  registrationJurisdiction: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  taxIdentifier: z.string().nullable(),
  defaultCurrency: CurrencyCode,
  officialTimeZone: TimeZone,
  workingLanguages: z.array(z.string().min(2)).min(1),
  verificationStatus: TenantsVerificationStatus,
  onboardingStage: TenantsOnboardingStage.nullable(),
  planCode: z.string().nullable(),
});
export type OrganizationIdentity = z.infer<typeof OrganizationIdentity>;

export const OrganizationProcurementSettings = z.object({
  acceptedCurrencies: z.array(CurrencyCode).min(1),
  defaultCalendar: NamedRef.nullable(),
  responsibilities: responsibilityShape(PersonRef.nullable()),
  brandingDisplayName: z.string().nullable(),
  publicPortalEnabled: z.boolean(),
  portalIntro: z.string().nullable(),
  sodAlternativeOversightNote: z.string().nullable(),
});
export type OrganizationProcurementSettings = z.infer<typeof OrganizationProcurementSettings>;

export const READINESS_STATES = ['passed', 'warning', 'blocking'] as const;
export const ReadinessState = z.enum(READINESS_STATES);

export const OrganizationReadinessItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: ReadinessState,
  detail: z.string().nullable(),
});
export type OrganizationReadinessItem = z.infer<typeof OrganizationReadinessItem>;

export const OrganizationSettings = z.object({
  identity: OrganizationIdentity,
  settings: OrganizationProcurementSettings,
  policyProfile: z.object({ name: z.string().min(1), versionNo: z.number().int().min(1) }).nullable(),
  legalEntityCount: z.number().int().min(0),
  readiness: z.array(OrganizationReadinessItem),
  updatedAt: Instant,
  updatedBy: PersonRef.nullable(),
});
export type OrganizationSettings = z.infer<typeof OrganizationSettings>;

export const getOrganization = defineEndpoint({
  id: 'buyer.admin.organization.get',
  method: 'GET',
  path: '/api/v1/buyer/admin/organization',
  audience: 'buyer',
  permission: ['org.settings.manage', 'org.structure.manage'],
  response: OrganizationSettings,
  errors: [],
  screens: ['ADM-01'],
});

export const UpdateOrganizationBody = z
  .object({
    tradingName: z.string().trim().max(200).nullable(),
    brandingDisplayName: z.string().trim().max(200).nullable(),
    officialTimeZone: TimeZone,
    workingLanguages: z.array(z.string().min(2).max(10)).min(1, issue('LANGUAGE_REQUIRED', 'Choose at least one language.')),
    defaultCurrency: CurrencyCode,
    acceptedCurrencies: z.array(CurrencyCode).min(1, issue('CURRENCY_REQUIRED', 'Accept at least one currency.')),
    responsibilities: responsibilityShape(Id.nullable()),
    publicPortalEnabled: z.boolean(),
    portalIntro: z.string().trim().max(4000).nullable(),
    /** Set after reviewing the impact list (`IMPACT_NOT_ACKNOWLEDGED` otherwise). */
    acknowledgeImpact: z.boolean(),
  })
  .refine((value) => value.acceptedCurrencies.includes(value.defaultCurrency), {
    message: issue('DEFAULT_CURRENCY_NOT_ACCEPTED', 'The default currency must be one of the accepted currencies.'),
    path: ['defaultCurrency'],
  });
export type UpdateOrganizationBody = z.infer<typeof UpdateOrganizationBody>;

export const IMPACT_AREAS = ['public_notices', 'open_events', 'deadlines', 'currency', 'responsibilities'] as const;
export const ImpactArea = z.enum(IMPACT_AREAS);
export type ImpactArea = z.infer<typeof ImpactArea>;

export const SettingsImpact = z.object({
  area: ImpactArea,
  severity: z.enum(['info', 'warning']),
  description: z.string().min(1),
  affectedCount: z.number().int().min(0),
  references: z.array(z.string().min(1)),
});
export type SettingsImpact = z.infer<typeof SettingsImpact>;

export const SettingsImpactReview = z.object({
  impacts: z.array(SettingsImpact),
  requiresAcknowledgement: z.boolean(),
});
export type SettingsImpactReview = z.infer<typeof SettingsImpactReview>;

export const reviewOrganizationImpact = defineEndpoint({
  id: 'buyer.admin.organization.impactReview',
  method: 'POST',
  path: '/api/v1/buyer/admin/organization/impact-review',
  audience: 'buyer',
  permission: 'org.settings.manage',
  body: UpdateOrganizationBody,
  response: SettingsImpactReview,
  errors: ['OWNER_NOT_ACTIVE_MEMBER'],
  screens: ['ADM-01'],
  summary: 'Lists the effects of proposed settings on public notices and active work, without changing anything.',
});

export const updateOrganization = defineEndpoint({
  id: 'buyer.admin.organization.update',
  method: 'PUT',
  path: '/api/v1/buyer/admin/organization',
  audience: 'buyer',
  permission: 'org.settings.manage',
  body: UpdateOrganizationBody,
  response: z.object({ organization: OrganizationSettings, impacts: z.array(SettingsImpact) }),
  errors: ['IMPACT_NOT_ACKNOWLEDGED', 'OWNER_NOT_ACTIVE_MEMBER'],
  screens: ['ADM-01'],
});

// ---------------------------------------------------------------------------------------------------------
// Legal entities (ADM-01)
// ---------------------------------------------------------------------------------------------------------

export const StructureUsage = z.object({
  /** Historical and current records that reference the value (they keep its description). */
  referenceCount: z.number().int().min(0),
  openTenders: z.number().int().min(0),
  activeContracts: z.number().int().min(0),
});
export type StructureUsage = z.infer<typeof StructureUsage>;

const structureBase = {
  active: z.boolean(),
  deactivatedAt: Instant.nullable(),
  usage: StructureUsage,
  createdAt: Instant,
};

export const LegalEntityRow = z.object({
  id: Id,
  name: z.string().min(1),
  registrationNumber: z.string().nullable(),
  country: z.string().length(2),
  address: z.string().nullable(),
  isContractingEntity: z.boolean(),
  ...structureBase,
});
export type LegalEntityRow = z.infer<typeof LegalEntityRow>;

const Country = z.string().regex(/^[A-Z]{2}$/, issue('INVALID_COUNTRY', 'Use a two-letter country code such as BW.'));
const StructureName = z.string().trim().min(2, issue('NAME_REQUIRED', 'At least 2 characters.')).max(200);
const StructureCode = z
  .string()
  .trim()
  .regex(/^[A-Z0-9][A-Z0-9-]{0,31}$/, issue('INVALID_CODE', 'Use capitals, digits and hyphens, such as CC-OPS-100.'));

export const LegalEntityBody = z.object({
  name: StructureName,
  registrationNumber: z.string().trim().max(100).nullable(),
  country: Country,
  address: z.string().trim().max(1000).nullable(),
  isContractingEntity: z.boolean(),
});

export const DepartmentRow = z.object({
  id: Id,
  name: z.string().min(1),
  code: z.string().nullable(),
  parent: NamedRef.nullable(),
  legalEntity: NamedRef.nullable(),
  head: PersonRef.nullable(),
  ...structureBase,
});
export type DepartmentRow = z.infer<typeof DepartmentRow>;

export const DepartmentBody = z.object({
  name: StructureName,
  code: StructureCode.nullable(),
  parentId: Id.nullable(),
  legalEntityId: Id.nullable(),
  headUserId: Id.nullable(),
});

export const LocationRow = z.object({
  id: Id,
  name: z.string().min(1),
  address: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().length(2),
  ...structureBase,
});
export type LocationRow = z.infer<typeof LocationRow>;

export const LocationBody = z.object({
  name: StructureName,
  address: z.string().trim().max(1000).nullable(),
  region: z.string().trim().max(200).nullable(),
  country: Country,
});

export const CategoryRow = z.object({
  id: Id,
  name: z.string().min(1),
  code: z.string().nullable(),
  parent: NamedRef.nullable(),
  catalogCode: z.string().nullable(),
  catalogName: z.string().nullable(),
  ...structureBase,
});
export type CategoryRow = z.infer<typeof CategoryRow>;

export const CategoryBody = z.object({
  name: StructureName,
  code: StructureCode.nullable(),
  parentId: Id.nullable(),
  catalogCode: z.string().trim().min(2).max(40).nullable(),
});

export const CostCenterRow = z.object({
  id: Id,
  code: z.string().min(1),
  name: z.string().min(1),
  department: NamedRef.nullable(),
  ...structureBase,
});
export type CostCenterRow = z.infer<typeof CostCenterRow>;

export const CostCenterBody = z.object({
  code: StructureCode,
  name: StructureName,
  departmentId: Id.nullable(),
});

export const FundingSourceRow = z.object({
  id: Id,
  code: z.string().min(1),
  name: z.string().min(1),
  sourceType: FundingSourcesSourceType,
  externalReference: z.string().nullable(),
  ...structureBase,
});
export type FundingSourceRow = z.infer<typeof FundingSourceRow>;

export const FundingSourceBody = z.object({
  code: StructureCode,
  name: StructureName,
  sourceType: FundingSourcesSourceType,
  externalReference: z.string().trim().max(200).nullable(),
});

export const STRUCTURE_SORTS = ['name', 'code', 'referenceCount', 'createdAt'] as const;

export const StructureListQuery = listQueryWithSort(STRUCTURE_SORTS).extend({
  active: QueryBoolean.optional(),
  parentId: IdParam.optional(),
});

export const StructureValueParams = z.object({ valueId: IdParam });

export const DeactivateStructureBody = z.object({ reason: ReasonText });

/** Errors every structure command may return. */
export const STRUCTURE_ERRORS = [
  'STRUCTURE_CODE_TAKEN',
  'STRUCTURE_NAME_TAKEN',
  'PARENT_NOT_FOUND',
  'PARENT_INACTIVE',
  'PARENT_CYCLE',
  'VALUE_INACTIVE',
  'SCOPE_NOT_FOUND',
] as const;

/**
 * The four endpoints of one structure kind: list, create, update, deactivate. Values are never deleted.
 */
function structureEndpoints<
  const ListPath extends string,
  const ItemPath extends string,
  const DeactivatePath extends string,
  Row extends z.ZodType,
  Body extends z.ZodType,
>(definition: {
  idBase: string;
  listPath: ListPath;
  itemPath: ItemPath;
  deactivatePath: DeactivatePath;
  row: Row;
  body: Body;
  screen: 'ADM-01' | 'ADM-02';
  extraDeactivateErrors: readonly string[];
}) {
  const { idBase, listPath, itemPath, deactivatePath, row, body, screen, extraDeactivateErrors } = definition;
  return {
    list: defineEndpoint({
      id: `buyer.admin.${idBase}.list`,
      method: 'GET',
      path: listPath,
      audience: 'buyer',
      permission: ['org.structure.manage', 'org.settings.manage'],
      query: StructureListQuery,
      response: pageOf(row),
      errors: [],
      screens: [screen] as const,
    }),
    create: defineEndpoint({
      id: `buyer.admin.${idBase}.create`,
      method: 'POST',
      path: listPath,
      audience: 'buyer',
      permission: 'org.structure.manage',
      body,
      response: row,
      idempotent: true,
      errors: STRUCTURE_ERRORS,
      screens: [screen] as const,
    }),
    update: defineEndpoint({
      id: `buyer.admin.${idBase}.update`,
      method: 'PUT',
      path: itemPath,
      audience: 'buyer',
      permission: 'org.structure.manage',
      params: StructureValueParams,
      body,
      response: row,
      errors: STRUCTURE_ERRORS,
      screens: [screen] as const,
      summary: 'Revises a value. Historical records keep the description they were created with.',
    }),
    deactivate: defineEndpoint({
      id: `buyer.admin.${idBase}.deactivate`,
      method: 'POST',
      path: deactivatePath,
      audience: 'buyer',
      permission: 'org.structure.manage',
      params: StructureValueParams,
      body: DeactivateStructureBody,
      response: row,
      errors: ['ALREADY_INACTIVE', ...extraDeactivateErrors],
      screens: [screen] as const,
      summary: 'Deactivates a value; it is never deleted and stays interpretable on historical records.',
    }),
  };
}

export const legalEntityRoutes = structureEndpoints({
  idBase: 'legalEntities',
  listPath: '/api/v1/buyer/admin/legal-entities',
  itemPath: '/api/v1/buyer/admin/legal-entities/:valueId',
  deactivatePath: '/api/v1/buyer/admin/legal-entities/:valueId/deactivate',
  row: LegalEntityRow,
  body: LegalEntityBody,
  screen: 'ADM-01',
  extraDeactivateErrors: ['LAST_CONTRACTING_ENTITY'],
});

export const departmentRoutes = structureEndpoints({
  idBase: 'departments',
  listPath: '/api/v1/buyer/admin/departments',
  itemPath: '/api/v1/buyer/admin/departments/:valueId',
  deactivatePath: '/api/v1/buyer/admin/departments/:valueId/deactivate',
  row: DepartmentRow,
  body: DepartmentBody,
  screen: 'ADM-02',
  extraDeactivateErrors: ['HAS_ACTIVE_CHILDREN'],
});

export const locationRoutes = structureEndpoints({
  idBase: 'locations',
  listPath: '/api/v1/buyer/admin/locations',
  itemPath: '/api/v1/buyer/admin/locations/:valueId',
  deactivatePath: '/api/v1/buyer/admin/locations/:valueId/deactivate',
  row: LocationRow,
  body: LocationBody,
  screen: 'ADM-02',
  extraDeactivateErrors: [],
});

export const categoryRoutes = structureEndpoints({
  idBase: 'categories',
  listPath: '/api/v1/buyer/admin/categories',
  itemPath: '/api/v1/buyer/admin/categories/:valueId',
  deactivatePath: '/api/v1/buyer/admin/categories/:valueId/deactivate',
  row: CategoryRow,
  body: CategoryBody,
  screen: 'ADM-02',
  extraDeactivateErrors: ['HAS_ACTIVE_CHILDREN'],
});

export const costCenterRoutes = structureEndpoints({
  idBase: 'costCenters',
  listPath: '/api/v1/buyer/admin/cost-centers',
  itemPath: '/api/v1/buyer/admin/cost-centers/:valueId',
  deactivatePath: '/api/v1/buyer/admin/cost-centers/:valueId/deactivate',
  row: CostCenterRow,
  body: CostCenterBody,
  screen: 'ADM-02',
  extraDeactivateErrors: [],
});

export const fundingSourceRoutes = structureEndpoints({
  idBase: 'fundingSources',
  listPath: '/api/v1/buyer/admin/funding-sources',
  itemPath: '/api/v1/buyer/admin/funding-sources/:valueId',
  deactivatePath: '/api/v1/buyer/admin/funding-sources/:valueId/deactivate',
  row: FundingSourceRow,
  body: FundingSourceBody,
  screen: 'ADM-02',
  extraDeactivateErrors: [],
});

/** The shared category taxonomy (`category_catalog`, global) for mapping tenant categories. */
export const CatalogCategory = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  parentCode: z.string().nullable(),
  description: z.string().nullable(),
});
export type CatalogCategory = z.infer<typeof CatalogCategory>;

export const listCategoryCatalog = defineEndpoint({
  id: 'buyer.admin.categoryCatalog.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/category-catalog',
  audience: 'buyer',
  permission: ['org.structure.manage', 'org.settings.manage'],
  response: z.object({ items: z.array(CatalogCategory) }),
  errors: [],
  screens: ['ADM-02'],
});
