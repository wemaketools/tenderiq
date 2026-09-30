/**
 * The six structure kinds of ADM-01 / ADM-02 (FR-01): columns, form fields, client checks and request bodies of
 * legal entities, departments (with parent, legal entity and head: the reporting relationships), locations,
 * categories (with parent and the shared category catalog mapping), cost centers and funding sources.
 */
import { orgAdminEndpoints } from '@contracts/org-admin';
import type {
  CategoryRow,
  CostCenterRow,
  DepartmentRow,
  FundingSourceRow,
  LegalEntityRow,
  LocationRow,
} from '@contracts/org-admin';

import { t, tEnum } from '../../../lib/i18n';
import type { StructureKind } from '../components/StructureRegister';
import {
  CategoryFields,
  CostCenterFields,
  DepartmentFields,
  FundingSourceFields,
  LegalEntityFields,
  LocationFields,
  NameCell,
} from '../components/StructureFields';
import { codeCheck, countryCheck, idOrNull, nameCheck, nullable, text } from './structureDraft';

export const legalEntityKind: StructureKind<LegalEntityRow> = {
  key: 'legalEntities',
  endpoints: {
    list: orgAdminEndpoints.legalEntitiesList,
    create: orgAdminEndpoints.legalEntitiesCreate,
    update: orgAdminEndpoints.legalEntitiesUpdate,
    deactivate: orgAdminEndpoints.legalEntitiesDeactivate,
  },
  columns: () => [
    {
      id: 'name',
      header: t('admin-org.structure.col.name'),
      sortable: true,
      cell: (row) => <NameCell name={row.name} sub={row.address} />,
    },
    {
      id: 'registration',
      header: t('admin-org.structure.col.registration'),
      cell: (row) => <NameCell name={row.registrationNumber ?? '—'} sub={row.country} />,
    },
    {
      id: 'contracting',
      header: t('admin-org.structure.col.contracting'),
      cell: (row) =>
        row.isContractingEntity ? t('admin-access.common.yes') : t('admin-access.common.no'),
    },
  ],
  fields: ['name', 'registrationNumber', 'country', 'address', 'isContractingEntity'],
  emptyDraft: {
    name: '',
    registrationNumber: '',
    country: 'BW',
    address: '',
    isContractingEntity: 'true',
  },
  draftOf: (row) => ({
    name: row.name,
    registrationNumber: row.registrationNumber ?? '',
    country: row.country,
    address: row.address ?? '',
    isContractingEntity: String(row.isContractingEntity),
  }),
  validate: (draft) => {
    const problems: Record<string, string> = {};
    nameCheck(draft, problems);
    countryCheck(draft, problems);
    return problems;
  },
  bodyOf: (draft) => ({
    name: text(draft, 'name'),
    registrationNumber: nullable(draft, 'registrationNumber'),
    country: text(draft, 'country'),
    address: nullable(draft, 'address'),
    isContractingEntity: draft.isContractingEntity === 'true',
  }),
  Fields: LegalEntityFields,
  deactivateNote: 'admin-org.structure.legalEntities.deactivateNote',
};

export const departmentKind: StructureKind<DepartmentRow> = {
  key: 'departments',
  endpoints: {
    list: orgAdminEndpoints.departmentsList,
    create: orgAdminEndpoints.departmentsCreate,
    update: orgAdminEndpoints.departmentsUpdate,
    deactivate: orgAdminEndpoints.departmentsDeactivate,
  },
  columns: () => [
    {
      id: 'name',
      header: t('admin-org.structure.col.name'),
      sortable: true,
      cell: (row) => (
        <NameCell
          name={row.name}
          sub={
            row.parent === null ? null : t('admin-org.structure.under', { parent: row.parent.name })
          }
        />
      ),
    },
    {
      id: 'code',
      header: t('admin-org.structure.col.code'),
      sortable: true,
      cell: (row) => <span className="tiq-mono">{row.code ?? '—'}</span>,
    },
    {
      id: 'entity',
      header: t('admin-org.structure.col.legalEntity'),
      cell: (row) => row.legalEntity?.name ?? '—',
    },
    {
      id: 'head',
      header: t('admin-org.structure.col.head'),
      cell: (row) => row.head?.fullName ?? '—',
    },
  ],
  fields: ['name', 'code', 'parentId', 'legalEntityId', 'headUserId'],
  emptyDraft: { name: '', code: '', parentId: '', legalEntityId: '', headUserId: '' },
  draftOf: (row) => ({
    name: row.name,
    code: row.code ?? '',
    parentId: row.parent === null ? '' : String(row.parent.id),
    legalEntityId: row.legalEntity === null ? '' : String(row.legalEntity.id),
    headUserId: row.head === null ? '' : String(row.head.userId),
  }),
  validate: (draft) => {
    const problems: Record<string, string> = {};
    nameCheck(draft, problems);
    codeCheck(draft, problems, false);
    return problems;
  },
  bodyOf: (draft) => ({
    name: text(draft, 'name'),
    code: nullable(draft, 'code'),
    parentId: idOrNull(draft, 'parentId'),
    legalEntityId: idOrNull(draft, 'legalEntityId'),
    headUserId: idOrNull(draft, 'headUserId'),
  }),
  Fields: DepartmentFields,
  deactivateNote: 'admin-org.structure.childrenNote',
};

export const locationKind: StructureKind<LocationRow> = {
  key: 'locations',
  endpoints: {
    list: orgAdminEndpoints.locationsList,
    create: orgAdminEndpoints.locationsCreate,
    update: orgAdminEndpoints.locationsUpdate,
    deactivate: orgAdminEndpoints.locationsDeactivate,
  },
  columns: () => [
    {
      id: 'name',
      header: t('admin-org.structure.col.name'),
      sortable: true,
      cell: (row) => <NameCell name={row.name} sub={row.address} />,
    },
    {
      id: 'region',
      header: t('admin-org.structure.col.region'),
      cell: (row) => <NameCell name={row.region ?? '—'} sub={row.country} />,
    },
  ],
  fields: ['name', 'address', 'region', 'country'],
  emptyDraft: { name: '', address: '', region: '', country: 'BW' },
  draftOf: (row) => ({
    name: row.name,
    address: row.address ?? '',
    region: row.region ?? '',
    country: row.country,
  }),
  validate: (draft) => {
    const problems: Record<string, string> = {};
    nameCheck(draft, problems);
    countryCheck(draft, problems);
    return problems;
  },
  bodyOf: (draft) => ({
    name: text(draft, 'name'),
    address: nullable(draft, 'address'),
    region: nullable(draft, 'region'),
    country: text(draft, 'country'),
  }),
  Fields: LocationFields,
};

export const categoryKind: StructureKind<CategoryRow> = {
  key: 'categories',
  endpoints: {
    list: orgAdminEndpoints.categoriesList,
    create: orgAdminEndpoints.categoriesCreate,
    update: orgAdminEndpoints.categoriesUpdate,
    deactivate: orgAdminEndpoints.categoriesDeactivate,
  },
  columns: () => [
    {
      id: 'name',
      header: t('admin-org.structure.col.name'),
      sortable: true,
      cell: (row) => (
        <NameCell
          name={row.name}
          sub={
            row.parent === null ? null : t('admin-org.structure.under', { parent: row.parent.name })
          }
        />
      ),
    },
    {
      id: 'code',
      header: t('admin-org.structure.col.code'),
      sortable: true,
      cell: (row) => <span className="tiq-mono">{row.code ?? '—'}</span>,
    },
    {
      id: 'catalog',
      header: t('admin-org.structure.col.catalog'),
      cell: (row) => <NameCell name={row.catalogCode ?? '—'} sub={row.catalogName} />,
    },
  ],
  fields: ['name', 'code', 'parentId', 'catalogCode'],
  emptyDraft: { name: '', code: '', parentId: '', catalogCode: '' },
  draftOf: (row) => ({
    name: row.name,
    code: row.code ?? '',
    parentId: row.parent === null ? '' : String(row.parent.id),
    catalogCode: row.catalogCode ?? '',
  }),
  validate: (draft) => {
    const problems: Record<string, string> = {};
    nameCheck(draft, problems);
    codeCheck(draft, problems, false);
    return problems;
  },
  bodyOf: (draft) => ({
    name: text(draft, 'name'),
    code: nullable(draft, 'code'),
    parentId: idOrNull(draft, 'parentId'),
    catalogCode: nullable(draft, 'catalogCode'),
  }),
  Fields: CategoryFields,
  deactivateNote: 'admin-org.structure.childrenNote',
};

export const costCenterKind: StructureKind<CostCenterRow> = {
  key: 'costCenters',
  endpoints: {
    list: orgAdminEndpoints.costCentersList,
    create: orgAdminEndpoints.costCentersCreate,
    update: orgAdminEndpoints.costCentersUpdate,
    deactivate: orgAdminEndpoints.costCentersDeactivate,
  },
  columns: () => [
    {
      id: 'code',
      header: t('admin-org.structure.col.code'),
      sortable: true,
      cell: (row) => <span className="tiq-mono">{row.code}</span>,
    },
    {
      id: 'name',
      header: t('admin-org.structure.col.name'),
      sortable: true,
      cell: (row) => row.name,
    },
    {
      id: 'department',
      header: t('admin-org.structure.col.department'),
      cell: (row) => row.department?.name ?? '—',
    },
  ],
  fields: ['code', 'name', 'departmentId'],
  emptyDraft: { code: '', name: '', departmentId: '' },
  draftOf: (row) => ({
    code: row.code,
    name: row.name,
    departmentId: row.department === null ? '' : String(row.department.id),
  }),
  validate: (draft) => {
    const problems: Record<string, string> = {};
    nameCheck(draft, problems);
    codeCheck(draft, problems, true);
    return problems;
  },
  bodyOf: (draft) => ({
    code: text(draft, 'code'),
    name: text(draft, 'name'),
    departmentId: idOrNull(draft, 'departmentId'),
  }),
  Fields: CostCenterFields,
};

export const fundingSourceKind: StructureKind<FundingSourceRow> = {
  key: 'fundingSources',
  endpoints: {
    list: orgAdminEndpoints.fundingSourcesList,
    create: orgAdminEndpoints.fundingSourcesCreate,
    update: orgAdminEndpoints.fundingSourcesUpdate,
    deactivate: orgAdminEndpoints.fundingSourcesDeactivate,
  },
  columns: () => [
    {
      id: 'code',
      header: t('admin-org.structure.col.code'),
      sortable: true,
      cell: (row) => <span className="tiq-mono">{row.code}</span>,
    },
    {
      id: 'name',
      header: t('admin-org.structure.col.name'),
      sortable: true,
      cell: (row) => <NameCell name={row.name} sub={row.externalReference} />,
    },
    {
      id: 'type',
      header: t('admin-org.structure.col.sourceType'),
      cell: (row) => tEnum('funding_sources.source_type', row.sourceType),
    },
  ],
  fields: ['code', 'name', 'sourceType', 'externalReference'],
  emptyDraft: { code: '', name: '', sourceType: '', externalReference: '' },
  draftOf: (row) => ({
    code: row.code,
    name: row.name,
    sourceType: row.sourceType,
    externalReference: row.externalReference ?? '',
  }),
  validate: (draft) => {
    const problems: Record<string, string> = {};
    nameCheck(draft, problems);
    codeCheck(draft, problems, true);
    if (text(draft, 'sourceType') === '')
      problems.sourceType = t('admin-org.structure.error.sourceType');
    return problems;
  },
  bodyOf: (draft) => ({
    code: text(draft, 'code'),
    name: text(draft, 'name'),
    sourceType: text(draft, 'sourceType'),
    externalReference: nullable(draft, 'externalReference'),
  }),
  Fields: FundingSourceFields,
};
