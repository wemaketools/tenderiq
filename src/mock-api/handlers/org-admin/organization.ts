/**
 * Org-admin mock handlers, buyer organization (ADM-01) and structure (ADM-02). Structure values are deactivated,
 * never deleted; commands answer with the outcome and nothing is stored.
 */
import {
  categoryRoutes,
  costCenterRoutes,
  departmentRoutes,
  fundingSourceRoutes,
  getOrganization,
  legalEntityRoutes,
  listCategoryCatalog,
  locationRoutes,
  reviewOrganizationImpact,
  updateOrganization,
} from '../../../contracts/org-admin.js';
import type {
  CategoryRow,
  CostCenterRow,
  DepartmentRow,
  FundingSourceRow,
  LegalEntityRow,
  LocationRow,
  OrganizationSettings,
  SettingsImpact,
  UpdateOrganizationBody,
} from '../../../contracts/org-admin.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  CATEGORIES,
  CATEGORY_CATALOG,
  COST_CENTERS,
  DEPARTMENTS,
  FUNDING_SOURCES,
  LEGAL_ENTITIES,
  LOCATIONS,
  MEMBERS,
  ORGANIZATION_SETTINGS,
} from '../../fixtures/org-admin/index.js';
import type { FixtureOrganizationSettings } from '../../fixtures/org-admin/index.js';
import type { FixtureTenant } from '../../fixtures/platform.js';
import { iso, matches, person, personOrNull, sortRows } from './views.js';

const RESPONSIBILITY_LABELS: Readonly<Record<keyof FixtureOrganizationSettings['responsibilities'], string>> = {
  procurementOwner: 'Procurement owner',
  administrator: 'Administrator',
  budgetApprovalOwner: 'Budget approval owner',
  publicationOwner: 'Publication owner',
  complaintsOwner: 'Complaints owner',
  recordsOwner: 'Records retention owner',
  contractOwner: 'Contract owner',
  supportContact: 'Support contact',
};

function settingsOf(tenantId: number): FixtureOrganizationSettings | undefined {
  return ORGANIZATION_SETTINGS.find((settings) => settings.tenantId === tenantId);
}

function organizationOf(tenant: FixtureTenant, settings: FixtureOrganizationSettings): OrganizationSettings {
  const responsibilities = settings.responsibilities;
  const keys = Object.keys(RESPONSIBILITY_LABELS) as Array<keyof typeof RESPONSIBILITY_LABELS>;
  const readiness: OrganizationSettings['readiness'] = keys
    .filter((key) => key !== 'supportContact')
    .map((key) => ({
      id: `responsibility.${key}`,
      label: RESPONSIBILITY_LABELS[key],
      status: responsibilities[key] === null ? (key === 'complaintsOwner' ? 'blocking' : 'warning') : 'passed',
      detail: responsibilities[key] === null ? 'Name the responsible person (FR-01).' : null,
    }));
  readiness.push({
    id: 'calendar',
    label: 'Working calendar',
    status: settings.defaultCalendar === null ? 'blocking' : 'passed',
    detail: settings.defaultCalendar === null ? 'Approve a working calendar before deadlines are computed.' : null,
  });
  readiness.push({
    id: 'policy',
    label: 'Initial policy profile',
    status: settings.policyProfile === null ? 'blocking' : 'passed',
    detail: settings.policyProfile === null ? 'Approve a procurement policy profile before the first release.' : null,
  });
  return {
    identity: {
      tenantId: tenant.id,
      slug: tenant.slug,
      kind: tenant.kind,
      legalName: tenant.legalName,
      tradingName: settings.tradingName,
      status: tenant.status,
      country: settings.country,
      registrationJurisdiction: settings.registrationJurisdiction,
      registrationNumber: settings.registrationNumber,
      taxIdentifier: settings.taxIdentifier,
      defaultCurrency: tenant.defaultCurrency ?? 'BWP',
      officialTimeZone: tenant.officialTimeZone,
      workingLanguages: [...tenant.workingLanguages],
      verificationStatus: settings.verificationStatus,
      onboardingStage: settings.onboardingStage,
      planCode: settings.planCode,
    },
    settings: {
      acceptedCurrencies: [...settings.acceptedCurrencies],
      defaultCalendar: settings.defaultCalendar,
      responsibilities: {
        procurementOwner: personOrNull(responsibilities.procurementOwner),
        administrator: personOrNull(responsibilities.administrator),
        budgetApprovalOwner: personOrNull(responsibilities.budgetApprovalOwner),
        publicationOwner: personOrNull(responsibilities.publicationOwner),
        complaintsOwner: personOrNull(responsibilities.complaintsOwner),
        recordsOwner: personOrNull(responsibilities.recordsOwner),
        contractOwner: personOrNull(responsibilities.contractOwner),
        supportContact: personOrNull(responsibilities.supportContact),
      },
      brandingDisplayName: settings.brandingDisplayName,
      publicPortalEnabled: settings.publicPortalEnabled,
      portalIntro: settings.portalIntro,
      sodAlternativeOversightNote: settings.sodAlternativeOversightNote,
    },
    policyProfile: settings.policyProfile,
    legalEntityCount: LEGAL_ENTITIES.filter((entity) => entity.tenantId === tenant.id && entity.active).length,
    readiness,
    updatedAt: settings.updatedAt,
    updatedBy: personOrNull(settings.updatedByUserId),
  };
}

function impactsOf(tenant: FixtureTenant, settings: FixtureOrganizationSettings, body: UpdateOrganizationBody): SettingsImpact[] {
  const impacts: SettingsImpact[] = [];
  if (body.officialTimeZone !== tenant.officialTimeZone) {
    impacts.push({
      area: 'deadlines',
      severity: 'warning',
      description: 'Open events keep the official time zone they were issued with; new events use the new zone.',
      affectedCount: settings.openTenderReferences.length,
      references: [...settings.openTenderReferences],
    });
  }
  if (body.defaultCurrency !== (tenant.defaultCurrency ?? 'BWP') || body.acceptedCurrencies.join() !== settings.acceptedCurrencies.join()) {
    impacts.push({
      area: 'currency',
      severity: 'info',
      description: 'Currencies apply to new requests and tenders. Issued pricing schedules keep their currencies.',
      affectedCount: settings.openTenderReferences.length,
      references: [...settings.openTenderReferences],
    });
  }
  if (body.publicPortalEnabled !== settings.publicPortalEnabled || body.brandingDisplayName !== settings.brandingDisplayName || body.portalIntro !== settings.portalIntro) {
    impacts.push({
      area: 'public_notices',
      severity: body.publicPortalEnabled ? 'info' : 'warning',
      description: body.publicPortalEnabled
        ? 'Published notices show the new branding and introduction.'
        : 'Published notices leave the public portal. Suppliers already invited keep their access.',
      affectedCount: settings.publishedNoticeReferences.length,
      references: [...settings.publishedNoticeReferences],
    });
  }
  const keys = Object.keys(body.responsibilities) as Array<keyof UpdateOrganizationBody['responsibilities']>;
  const changed = keys.filter((key) => body.responsibilities[key] !== settings.responsibilities[key]);
  if (changed.length > 0) {
    impacts.push({
      area: 'responsibilities',
      severity: 'info',
      description: `New responsible people receive the related tasks and notices: ${changed.map((key) => RESPONSIBILITY_LABELS[key]).join(', ')}.`,
      affectedCount: changed.length,
      references: [],
    });
  }
  if (body.workingLanguages.join() !== tenant.workingLanguages.join()) {
    impacts.push({
      area: 'open_events',
      severity: 'info',
      description: 'Working languages apply to new notices. Open events keep their issued language editions.',
      affectedCount: settings.openTenderReferences.length,
      references: [...settings.openTenderReferences],
    });
  }
  return impacts;
}

function ownersAreMembers(tenantId: number, body: UpdateOrganizationBody): boolean {
  return Object.values(body.responsibilities).every(
    (userId) =>
      userId === null ||
      MEMBERS.some((member) => member.tenantId === tenantId && member.userId === userId && member.membershipStatus === 'active'),
  );
}

function usage(row: { referenceCount: number; openTenders: number; activeContracts: number }) {
  return { referenceCount: row.referenceCount, openTenders: row.openTenders, activeContracts: row.activeContracts };
}

function named(list: ReadonlyArray<{ id: number; name: string }>, id: number | null) {
  if (id === null) {
    return null;
  }
  const found = list.find((candidate) => candidate.id === id);
  return found === undefined ? null : { id: found.id, name: found.name };
}

const legalEntityRows = (tenantId: number): LegalEntityRow[] =>
  LEGAL_ENTITIES.filter((row) => row.tenantId === tenantId).map((row) => ({
    id: row.id,
    name: row.name,
    registrationNumber: row.registrationNumber,
    country: row.country,
    address: row.address,
    isContractingEntity: row.isContractingEntity,
    active: row.active,
    deactivatedAt: row.deactivatedAt,
    usage: usage(row),
    createdAt: row.createdAt,
  }));

const departmentRows = (tenantId: number): DepartmentRow[] =>
  DEPARTMENTS.filter((row) => row.tenantId === tenantId).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    parent: named(DEPARTMENTS, row.parentId),
    legalEntity: named(LEGAL_ENTITIES, row.legalEntityId),
    head: personOrNull(row.headUserId),
    active: row.active,
    deactivatedAt: row.deactivatedAt,
    usage: usage(row),
    createdAt: row.createdAt,
  }));

const locationRows = (tenantId: number): LocationRow[] =>
  LOCATIONS.filter((row) => row.tenantId === tenantId).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    region: row.region,
    country: row.country,
    active: row.active,
    deactivatedAt: row.deactivatedAt,
    usage: usage(row),
    createdAt: row.createdAt,
  }));

const categoryRows = (tenantId: number): CategoryRow[] =>
  CATEGORIES.filter((row) => row.tenantId === tenantId).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    parent: named(CATEGORIES, row.parentId),
    catalogCode: row.catalogCode,
    catalogName: CATEGORY_CATALOG.find((entry) => entry.code === row.catalogCode)?.name ?? null,
    active: row.active,
    deactivatedAt: row.deactivatedAt,
    usage: usage(row),
    createdAt: row.createdAt,
  }));

const costCenterRows = (tenantId: number): CostCenterRow[] =>
  COST_CENTERS.filter((row) => row.tenantId === tenantId).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    department: named(DEPARTMENTS, row.departmentId),
    active: row.active,
    deactivatedAt: row.deactivatedAt,
    usage: usage(row),
    createdAt: row.createdAt,
  }));

const fundingSourceRows = (tenantId: number): FundingSourceRow[] =>
  FUNDING_SOURCES.filter((row) => row.tenantId === tenantId).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    sourceType: row.sourceType,
    externalReference: row.externalReference,
    active: row.active,
    deactivatedAt: row.deactivatedAt,
    usage: usage(row),
    createdAt: row.createdAt,
  }));

type AnyStructureRow = { id: number; name: string; active: boolean; createdAt: string; usage: { referenceCount: number } } & {
  code?: string | null;
  parent?: { id: number; name: string } | null;
};

function listStructure<Row extends AnyStructureRow>(
  rows: Row[],
  query: { q?: string | undefined; active?: boolean | undefined; parentId?: number | undefined; sort?: string | undefined; dir: 'asc' | 'desc' },
): Row[] {
  const filtered = rows
    .filter((row) => query.active === undefined || row.active === query.active)
    .filter((row) => query.parentId === undefined || row.parent?.id === query.parentId)
    .filter((row) => matches(query.q, row.name, row.code ?? null));
  return sortRows(
    filtered,
    query.sort,
    query.dir,
    {
      name: (row) => row.name,
      code: (row) => row.code ?? null,
      referenceCount: (row) => row.usage.referenceCount,
      createdAt: (row) => row.createdAt,
    },
    'name',
  );
}

export function registerOrganization(app: MockApp): void {
  mockRoute(app, getOrganization, ({ requireTenant, notFound }) => {
    const { tenant } = requireTenant();
    const settings = settingsOf(tenant.id);
    if (settings === undefined) {
      return notFound();
    }
    return organizationOf(tenant, settings);
  });

  mockRoute(app, reviewOrganizationImpact, ({ requireTenant, body, notFound, fail }) => {
    const { tenant } = requireTenant();
    const settings = settingsOf(tenant.id);
    if (settings === undefined) {
      return notFound();
    }
    if (!ownersAreMembers(tenant.id, body)) {
      return fail(422, 'OWNER_NOT_ACTIVE_MEMBER', 'Responsible people must be active members of this organization.');
    }
    const impacts = impactsOf(tenant, settings, body);
    return { impacts, requiresAcknowledgement: impacts.some((impact) => impact.severity === 'warning') };
  });

  mockRoute(app, updateOrganization, ({ requireTenant, requirePersona, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const settings = settingsOf(tenant.id);
    if (settings === undefined) {
      return notFound();
    }
    if (!ownersAreMembers(tenant.id, body)) {
      return fail(422, 'OWNER_NOT_ACTIVE_MEMBER', 'Responsible people must be active members of this organization.');
    }
    const impacts = impactsOf(tenant, settings, body);
    if (impacts.some((impact) => impact.severity === 'warning') && !body.acknowledgeImpact) {
      return fail(409, 'IMPACT_NOT_ACKNOWLEDGED', 'Review and acknowledge the effects on public notices and active work first.');
    }
    const current = organizationOf(tenant, settings);
    const caller = requirePersona();
    const responsibilities = Object.fromEntries(
      Object.entries(body.responsibilities).map(([key, userId]) => [key, userId === null ? null : person(userId)]),
    ) as OrganizationSettings['settings']['responsibilities'];
    return {
      organization: {
        ...current,
        identity: {
          ...current.identity,
          tradingName: body.tradingName,
          officialTimeZone: body.officialTimeZone,
          workingLanguages: body.workingLanguages,
          defaultCurrency: body.defaultCurrency,
        },
        settings: {
          ...current.settings,
          acceptedCurrencies: body.acceptedCurrencies,
          responsibilities,
          brandingDisplayName: body.brandingDisplayName,
          publicPortalEnabled: body.publicPortalEnabled,
          portalIntro: body.portalIntro,
        },
        updatedAt: iso(now),
        updatedBy: { userId: caller.userId, fullName: caller.fullName },
      },
      impacts,
    };
  });

  mockRoute(app, listCategoryCatalog, () => ({ items: CATEGORY_CATALOG.map((entry) => ({ ...entry })) }));

  registerLegalEntities(app);
  registerDepartments(app);
  registerLocations(app);
  registerCategories(app);
  registerCostCenters(app);
  registerFundingSources(app);
}

// ---------------------------------------------------------------------------------------------------------
// Structure kinds
// ---------------------------------------------------------------------------------------------------------

type Fail = (status: number, code: string, detail?: string) => never;

function deactivated<Row extends { active: boolean; deactivatedAt: string | null }>(row: Row, now: Date, fail: Fail): Row {
  if (!row.active) {
    fail(409, 'ALREADY_INACTIVE', 'This value is already deactivated.');
  }
  return { ...row, active: false, deactivatedAt: iso(now) };
}

function checkParent<Row extends { id: number; active: boolean; parent: { id: number } | null }>(
  rows: readonly Row[],
  parentId: number | null,
  selfId: number | null,
  fail: Fail,
): Row | null {
  if (parentId === null) {
    return null;
  }
  const parent = rows.find((row) => row.id === parentId);
  if (parent === undefined) {
    return fail(422, 'PARENT_NOT_FOUND', 'Choose a parent of this organization.');
  }
  if (!parent.active) {
    return fail(422, 'PARENT_INACTIVE', 'A deactivated value cannot be a parent.');
  }
  let cursor: Row | undefined = parent;
  while (cursor !== undefined && selfId !== null) {
    if (cursor.id === selfId) {
      return fail(422, 'PARENT_CYCLE', 'A value cannot sit below itself.');
    }
    const next: { id: number } | null = cursor.parent;
    cursor = next === null ? undefined : rows.find((row) => row.id === next.id);
  }
  return parent;
}

function uniqueCheck(
  rows: ReadonlyArray<{ id: number; name: string; code?: string | null }>,
  selfId: number | null,
  name: string,
  code: string | null,
  fail: Fail,
): void {
  if (rows.some((row) => row.id !== selfId && row.name.toLowerCase() === name.toLowerCase())) {
    fail(409, 'STRUCTURE_NAME_TAKEN', 'Another value already has this name.');
  }
  if (code !== null && rows.some((row) => row.id !== selfId && (row.code ?? '').toUpperCase() === code.toUpperCase())) {
    fail(409, 'STRUCTURE_CODE_TAKEN', 'Another value already uses this code.');
  }
}

function newRowBase(now: Date) {
  return { active: true, deactivatedAt: null, usage: { referenceCount: 0, openTenders: 0, activeContracts: 0 }, createdAt: iso(now) };
}

function registerLegalEntities(app: MockApp): void {
  const routes = legalEntityRoutes;
  mockRoute(app, routes.list, ({ requireTenant, query, fixtures }) =>
    fixtures.page(listStructure(legalEntityRows(requireTenant().tenant.id), query)),
  );
  mockRoute(app, routes.create, ({ requireTenant, body, fail, now }) => {
    const rows = legalEntityRows(requireTenant().tenant.id);
    uniqueCheck(rows, null, body.name, null, fail);
    return { id: 900, ...body, ...newRowBase(now) };
  });
  mockRoute(app, routes.update, ({ requireTenant, params, body, notFound, fail }) => {
    const rows = legalEntityRows(requireTenant().tenant.id);
    const row = rows.find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (!row.active) {
      return fail(409, 'VALUE_INACTIVE', 'A deactivated value cannot be revised.');
    }
    uniqueCheck(rows, row.id, body.name, null, fail);
    return { ...row, ...body };
  });
  mockRoute(app, routes.deactivate, ({ requireTenant, params, notFound, fail, now }) => {
    const rows = legalEntityRows(requireTenant().tenant.id);
    const row = rows.find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (row.active && row.isContractingEntity && rows.filter((candidate) => candidate.active && candidate.isContractingEntity).length === 1) {
      return fail(409, 'LAST_CONTRACTING_ENTITY', 'At least one active contracting entity is required.');
    }
    return deactivated(row, now, fail);
  });
}

function registerDepartments(app: MockApp): void {
  const routes = departmentRoutes;
  mockRoute(app, routes.list, ({ requireTenant, query, fixtures }) =>
    fixtures.page(listStructure(departmentRows(requireTenant().tenant.id), query)),
  );
  const build = (tenantId: number, id: number, body: { name: string; code: string | null; parentId: number | null; legalEntityId: number | null; headUserId: number | null }, fail: Fail) => {
    const rows = departmentRows(tenantId);
    uniqueCheck(rows, id, body.name, body.code, fail);
    const parent = checkParent(rows, body.parentId, id, fail);
    const entity = body.legalEntityId === null ? null : LEGAL_ENTITIES.find((row) => row.id === body.legalEntityId && row.tenantId === tenantId);
    if (entity === undefined) {
      fail(422, 'SCOPE_NOT_FOUND', 'Choose a legal entity of this organization.');
    }
    if (body.headUserId !== null && !MEMBERS.some((member) => member.tenantId === tenantId && member.userId === body.headUserId && member.membershipStatus === 'active')) {
      fail(422, 'SCOPE_NOT_FOUND', 'The head must be an active member of this organization.');
    }
    return {
      name: body.name,
      code: body.code,
      parent: parent === null ? null : { id: parent.id, name: parent.name },
      legalEntity: entity === null || entity === undefined ? null : { id: entity.id, name: entity.name },
      head: personOrNull(body.headUserId),
    };
  };
  mockRoute(app, routes.create, ({ requireTenant, body, fail, now }) => ({
    id: 900,
    ...build(requireTenant().tenant.id, 900, body, fail),
    ...newRowBase(now),
  }));
  mockRoute(app, routes.update, ({ requireTenant, params, body, notFound, fail }) => {
    const tenantId = requireTenant().tenant.id;
    const row = departmentRows(tenantId).find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (!row.active) {
      return fail(409, 'VALUE_INACTIVE', 'A deactivated value cannot be revised.');
    }
    return { ...row, ...build(tenantId, row.id, body, fail) };
  });
  mockRoute(app, routes.deactivate, ({ requireTenant, params, notFound, fail, now }) => {
    const rows = departmentRows(requireTenant().tenant.id);
    const row = rows.find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (row.active && rows.some((candidate) => candidate.active && candidate.parent?.id === row.id)) {
      return fail(409, 'HAS_ACTIVE_CHILDREN', 'Deactivate or move the sub-departments first.');
    }
    return deactivated(row, now, fail);
  });
}

function registerLocations(app: MockApp): void {
  const routes = locationRoutes;
  mockRoute(app, routes.list, ({ requireTenant, query, fixtures }) =>
    fixtures.page(listStructure(locationRows(requireTenant().tenant.id), query)),
  );
  mockRoute(app, routes.create, ({ requireTenant, body, fail, now }) => {
    uniqueCheck(locationRows(requireTenant().tenant.id), null, body.name, null, fail);
    return { id: 900, ...body, ...newRowBase(now) };
  });
  mockRoute(app, routes.update, ({ requireTenant, params, body, notFound, fail }) => {
    const rows = locationRows(requireTenant().tenant.id);
    const row = rows.find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (!row.active) {
      return fail(409, 'VALUE_INACTIVE', 'A deactivated value cannot be revised.');
    }
    uniqueCheck(rows, row.id, body.name, null, fail);
    return { ...row, ...body };
  });
  mockRoute(app, routes.deactivate, ({ requireTenant, params, notFound, fail, now }) => {
    const row = locationRows(requireTenant().tenant.id).find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    return deactivated(row, now, fail);
  });
}

function registerCategories(app: MockApp): void {
  const routes = categoryRoutes;
  mockRoute(app, routes.list, ({ requireTenant, query, fixtures }) =>
    fixtures.page(listStructure(categoryRows(requireTenant().tenant.id), query)),
  );
  const build = (tenantId: number, id: number, body: { name: string; code: string | null; parentId: number | null; catalogCode: string | null }, fail: Fail) => {
    const rows = categoryRows(tenantId);
    uniqueCheck(rows, id, body.name, body.code, fail);
    const parent = checkParent(rows, body.parentId, id, fail);
    const catalog = body.catalogCode === null ? null : CATEGORY_CATALOG.find((entry) => entry.code === body.catalogCode);
    if (catalog === undefined) {
      fail(422, 'SCOPE_NOT_FOUND', 'Choose a code from the shared category catalog.');
    }
    return {
      name: body.name,
      code: body.code,
      parent: parent === null ? null : { id: parent.id, name: parent.name },
      catalogCode: catalog === null || catalog === undefined ? null : catalog.code,
      catalogName: catalog === null || catalog === undefined ? null : catalog.name,
    };
  };
  mockRoute(app, routes.create, ({ requireTenant, body, fail, now }) => ({
    id: 900,
    ...build(requireTenant().tenant.id, 900, body, fail),
    ...newRowBase(now),
  }));
  mockRoute(app, routes.update, ({ requireTenant, params, body, notFound, fail }) => {
    const tenantId = requireTenant().tenant.id;
    const row = categoryRows(tenantId).find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (!row.active) {
      return fail(409, 'VALUE_INACTIVE', 'A deactivated value cannot be revised.');
    }
    return { ...row, ...build(tenantId, row.id, body, fail) };
  });
  mockRoute(app, routes.deactivate, ({ requireTenant, params, notFound, fail, now }) => {
    const rows = categoryRows(requireTenant().tenant.id);
    const row = rows.find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (row.active && rows.some((candidate) => candidate.active && candidate.parent?.id === row.id)) {
      return fail(409, 'HAS_ACTIVE_CHILDREN', 'Deactivate or move the subcategories first.');
    }
    return deactivated(row, now, fail);
  });
}

function registerCostCenters(app: MockApp): void {
  const routes = costCenterRoutes;
  mockRoute(app, routes.list, ({ requireTenant, query, fixtures }) =>
    fixtures.page(listStructure(costCenterRows(requireTenant().tenant.id), query)),
  );
  const departmentOf = (tenantId: number, departmentId: number | null, fail: Fail) => {
    if (departmentId === null) {
      return null;
    }
    const department = DEPARTMENTS.find((row) => row.id === departmentId && row.tenantId === tenantId);
    if (department === undefined) {
      return fail(422, 'SCOPE_NOT_FOUND', 'Choose a department of this organization.');
    }
    if (!department.active) {
      return fail(422, 'PARENT_INACTIVE', 'A deactivated department cannot own a cost centre.');
    }
    return { id: department.id, name: department.name };
  };
  mockRoute(app, routes.create, ({ requireTenant, body, fail, now }) => {
    const tenantId = requireTenant().tenant.id;
    uniqueCheck(costCenterRows(tenantId), null, body.name, body.code, fail);
    return { id: 900, code: body.code, name: body.name, department: departmentOf(tenantId, body.departmentId, fail), ...newRowBase(now) };
  });
  mockRoute(app, routes.update, ({ requireTenant, params, body, notFound, fail }) => {
    const tenantId = requireTenant().tenant.id;
    const rows = costCenterRows(tenantId);
    const row = rows.find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (!row.active) {
      return fail(409, 'VALUE_INACTIVE', 'A deactivated value cannot be revised.');
    }
    uniqueCheck(rows, row.id, body.name, body.code, fail);
    return { ...row, code: body.code, name: body.name, department: departmentOf(tenantId, body.departmentId, fail) };
  });
  mockRoute(app, routes.deactivate, ({ requireTenant, params, notFound, fail, now }) => {
    const row = costCenterRows(requireTenant().tenant.id).find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    return deactivated(row, now, fail);
  });
}

function registerFundingSources(app: MockApp): void {
  const routes = fundingSourceRoutes;
  mockRoute(app, routes.list, ({ requireTenant, query, fixtures }) =>
    fixtures.page(listStructure(fundingSourceRows(requireTenant().tenant.id), query)),
  );
  mockRoute(app, routes.create, ({ requireTenant, body, fail, now }) => {
    uniqueCheck(fundingSourceRows(requireTenant().tenant.id), null, body.name, body.code, fail);
    return { id: 900, ...body, ...newRowBase(now) };
  });
  mockRoute(app, routes.update, ({ requireTenant, params, body, notFound, fail }) => {
    const rows = fundingSourceRows(requireTenant().tenant.id);
    const row = rows.find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    if (!row.active) {
      return fail(409, 'VALUE_INACTIVE', 'A deactivated value cannot be revised.');
    }
    uniqueCheck(rows, row.id, body.name, body.code, fail);
    return { ...row, ...body };
  });
  mockRoute(app, routes.deactivate, ({ requireTenant, params, notFound, fail, now }) => {
    const row = fundingSourceRows(requireTenant().tenant.id).find((candidate) => candidate.id === params.valueId);
    if (row === undefined) {
      return notFound();
    }
    return deactivated(row, now, fail);
  });
}

/** Every structure projection per kind, for the fixture tests. */
export const STRUCTURE_PROJECTIONS = {
  legalEntities: legalEntityRows,
  departments: departmentRows,
  locations: locationRows,
  categories: categoryRows,
  costCenters: costCenterRows,
  fundingSources: fundingSourceRows,
} as const;

export { organizationOf, settingsOf };
