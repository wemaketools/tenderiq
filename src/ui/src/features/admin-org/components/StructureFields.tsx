/**
 * The form fields of the six structure kinds (ADM-01 legal entities; ADM-02 departments with parent, legal entity
 * and head, locations, categories with parent and catalog mapping, cost centers, funding sources) and the name cell.
 */
import { FUNDING_SOURCES_SOURCE_TYPE } from '@contracts/enums';
import { orgAdminEndpoints } from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import { Checkbox, Select, TextArea, TextField } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { MemberSelect } from '../../admin-access/components/Pickers';
import type { FieldsProps } from './StructureRegister';

function NameField({ draft, onChange, errorOf }: FieldsProps) {
  return (
    <TextField
      label={t('admin-org.structure.field.name')}
      value={draft.name ?? ''}
      onChange={(name) => onChange({ ...draft, name })}
      error={errorOf('name')}
      required
    />
  );
}

function CodeField({
  draft,
  onChange,
  errorOf,
  required,
}: FieldsProps & { readonly required: boolean }) {
  return (
    <TextField
      label={t('admin-org.structure.field.code')}
      hint={t('admin-org.structure.field.codeHint')}
      value={draft.code ?? ''}
      onChange={(code) => onChange({ ...draft, code: code.toUpperCase() })}
      error={errorOf('code')}
      required={required}
    />
  );
}

function CountryField({ draft, onChange, errorOf }: FieldsProps) {
  return (
    <TextField
      label={t('admin-org.structure.field.country')}
      hint={t('admin-org.structure.field.countryHint')}
      value={draft.country ?? ''}
      maxLength={2}
      onChange={(country) => onChange({ ...draft, country: country.toUpperCase() })}
      error={errorOf('country')}
      required
    />
  );
}

export function LegalEntityFields(props: FieldsProps) {
  const { draft, onChange, errorOf } = props;
  return (
    <>
      <NameField {...props} />
      <TextField
        label={t('admin-org.structure.field.registrationNumber')}
        value={draft.registrationNumber ?? ''}
        onChange={(registrationNumber) => onChange({ ...draft, registrationNumber })}
        error={errorOf('registrationNumber')}
      />
      <CountryField {...props} />
      <TextArea
        label={t('admin-org.structure.field.address')}
        value={draft.address ?? ''}
        onChange={(address) => onChange({ ...draft, address })}
        error={errorOf('address')}
        rows={2}
        fieldClassName="tiq-form-full"
      />
      <Checkbox
        label={t('admin-org.structure.field.contracting')}
        hint={t('admin-org.structure.field.contractingHint')}
        checked={draft.isContractingEntity === 'true'}
        onChange={(checked) => onChange({ ...draft, isContractingEntity: String(checked) })}
        error={errorOf('isContractingEntity')}
      />
    </>
  );
}

function useActiveOptions(
  kind: 'departments' | 'categories' | 'legalEntities',
  editingId: number | null,
) {
  const endpoint =
    kind === 'departments'
      ? orgAdminEndpoints.departmentsList
      : kind === 'categories'
        ? orgAdminEndpoints.categoriesList
        : orgAdminEndpoints.legalEntitiesList;
  const query = useApiQuery(endpoint, { query: { active: true, pageSize: 100, sort: 'name' } });
  return (query.data?.items ?? [])
    .filter((row) => row.id !== editingId)
    .map((row) => ({ value: String(row.id), label: row.name }));
}

export function DepartmentFields(props: FieldsProps) {
  const { draft, onChange, errorOf, editingId } = props;
  const parents = useActiveOptions('departments', editingId);
  const entities = useActiveOptions('legalEntities', null);
  return (
    <>
      <NameField {...props} />
      <CodeField {...props} required={false} />
      <Select
        label={t('admin-org.structure.field.parentDepartment')}
        hint={t('admin-org.structure.field.parentHint')}
        placeholder={t('admin-org.structure.field.noParent')}
        value={draft.parentId ?? ''}
        options={parents}
        onChange={(parentId) => onChange({ ...draft, parentId })}
        error={errorOf('parentId')}
      />
      <Select
        label={t('admin-org.structure.field.legalEntity')}
        placeholder={t('admin-org.structure.field.anyEntity')}
        value={draft.legalEntityId ?? ''}
        options={entities}
        onChange={(legalEntityId) => onChange({ ...draft, legalEntityId })}
        error={errorOf('legalEntityId')}
      />
      <MemberSelect
        label={t('admin-org.structure.field.head')}
        value={draft.headUserId ?? ''}
        onChange={(headUserId) => onChange({ ...draft, headUserId })}
        error={errorOf('headUserId')}
      />
    </>
  );
}

export function LocationFields(props: FieldsProps) {
  const { draft, onChange, errorOf } = props;
  return (
    <>
      <NameField {...props} />
      <TextField
        label={t('admin-org.structure.field.region')}
        value={draft.region ?? ''}
        onChange={(region) => onChange({ ...draft, region })}
        error={errorOf('region')}
      />
      <CountryField {...props} />
      <TextArea
        label={t('admin-org.structure.field.address')}
        value={draft.address ?? ''}
        onChange={(address) => onChange({ ...draft, address })}
        error={errorOf('address')}
        rows={2}
        fieldClassName="tiq-form-full"
      />
    </>
  );
}

export function CategoryFields(props: FieldsProps) {
  const { draft, onChange, errorOf, editingId } = props;
  const parents = useActiveOptions('categories', editingId);
  const catalog = useApiQuery(orgAdminEndpoints.listCategoryCatalog, {});
  return (
    <>
      <NameField {...props} />
      <CodeField {...props} required={false} />
      <Select
        label={t('admin-org.structure.field.parentCategory')}
        placeholder={t('admin-org.structure.field.noParent')}
        value={draft.parentId ?? ''}
        options={parents}
        onChange={(parentId) => onChange({ ...draft, parentId })}
        error={errorOf('parentId')}
      />
      <Select
        label={t('admin-org.structure.field.catalog')}
        hint={t('admin-org.structure.field.catalogHint')}
        placeholder={t('admin-org.structure.field.noCatalog')}
        value={draft.catalogCode ?? ''}
        options={(catalog.data?.items ?? []).map((item) => ({
          value: item.code,
          label: `${item.code} ${item.name}`,
        }))}
        onChange={(catalogCode) => onChange({ ...draft, catalogCode })}
        error={errorOf('catalogCode')}
      />
    </>
  );
}

export function CostCenterFields(props: FieldsProps) {
  const { draft, onChange, errorOf } = props;
  const departments = useActiveOptions('departments', null);
  return (
    <>
      <CodeField {...props} required />
      <NameField {...props} />
      <Select
        label={t('admin-org.structure.field.department')}
        placeholder={t('admin-org.structure.field.noDepartment')}
        value={draft.departmentId ?? ''}
        options={departments}
        onChange={(departmentId) => onChange({ ...draft, departmentId })}
        error={errorOf('departmentId')}
      />
    </>
  );
}

export function FundingSourceFields(props: FieldsProps) {
  const { draft, onChange, errorOf } = props;
  return (
    <>
      <CodeField {...props} required />
      <NameField {...props} />
      <Select
        label={t('admin-org.structure.field.sourceType')}
        value={draft.sourceType ?? ''}
        placeholder={t('admin-access.common.choose')}
        options={FUNDING_SOURCES_SOURCE_TYPE.map((value) => ({
          value,
          label: tEnum('funding_sources.source_type', value),
        }))}
        onChange={(sourceType) => onChange({ ...draft, sourceType })}
        error={errorOf('sourceType')}
        required
      />
      <TextField
        label={t('admin-org.structure.field.externalReference')}
        hint={t('admin-org.structure.field.externalReferenceHint')}
        value={draft.externalReference ?? ''}
        onChange={(externalReference) => onChange({ ...draft, externalReference })}
        error={errorOf('externalReference')}
      />
    </>
  );
}

export function NameCell({ name, sub }: { readonly name: string; readonly sub: string | null }) {
  return (
    <>
      <span>{name}</span>
      {sub !== null && sub !== '' && <span className="tiq-cell-sub">{sub}</span>}
    </>
  );
}
