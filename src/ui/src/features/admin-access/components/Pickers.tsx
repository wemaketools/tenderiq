/**
 * Pickers used by the org-admin forms: an active member of the organization (from the member directory, never a
 * hard-coded list) and a scope (whole organization, or one legal entity, department, category or tender the
 * organization owns). A lookup that fails or is not permitted is explained under the field.
 */
import { ROLE_ASSIGNMENTS_SCOPE_TYPE } from '@contracts/enums';
import type { RoleAssignmentsScopeType } from '@contracts/enums';
import { orgAdminEndpoints } from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import { Select } from '../../../components/ui';
import type { SelectOption } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useMemberAdmin } from '../lib/audience';
import { orgAdminErrorMessage } from '../lib/errors';
import type { ScopeValue } from '../lib/scope';

export interface MemberSelectProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** User ids that may not be chosen (for example the person being deactivated). */
  readonly exclude?: readonly number[];
  readonly error?: string;
  readonly hint?: string;
  readonly required?: boolean;
}

/** One active member of the active organization. */
export function MemberSelect({
  label,
  value,
  onChange,
  exclude = [],
  error,
  hint,
  required,
}: MemberSelectProps) {
  const { endpoints } = useMemberAdmin();
  const query = useApiQuery(endpoints.listMembers, {
    query: { status: ['active'], sort: 'fullName', pageSize: 100 },
  });
  const options: SelectOption[] = (query.data?.items ?? [])
    .filter((row) => !exclude.includes(row.userId))
    .map((row) => ({
      value: String(row.userId),
      label: row.capacity === null ? row.fullName : `${row.fullName} (${row.capacity})`,
    }));
  const lookupError = query.error === null ? undefined : orgAdminErrorMessage(query.error);
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={
        query.data === undefined && query.error === null
          ? t('admin-access.common.loading')
          : t('admin-access.common.choosePerson')
      }
      error={error ?? lookupError}
      hint={hint}
      required={required}
    />
  );
}

const BUYER_SCOPE_TYPES: readonly RoleAssignmentsScopeType[] = [
  'organization',
  'legal_entity',
  'department',
  'category',
];
const SUPPLIER_SCOPE_TYPES: readonly RoleAssignmentsScopeType[] = ['organization', 'tender'];

function useScopeRecords(scopeType: RoleAssignmentsScopeType) {
  const legal = useApiQuery(
    orgAdminEndpoints.legalEntitiesList,
    scopeType === 'legal_entity' ? { query: { active: true, pageSize: 100 } } : null,
  );
  const departments = useApiQuery(
    orgAdminEndpoints.departmentsList,
    scopeType === 'department' ? { query: { active: true, pageSize: 100 } } : null,
  );
  const categories = useApiQuery(
    orgAdminEndpoints.categoriesList,
    scopeType === 'category' ? { query: { active: true, pageSize: 100 } } : null,
  );
  const tenders = useApiQuery(
    orgAdminEndpoints.listAssignableTenders,
    scopeType === 'tender' ? {} : null,
  );
  switch (scopeType) {
    case 'legal_entity':
      return {
        options: (legal.data?.items ?? []).map((row) => ({
          value: String(row.id),
          label: row.name,
        })),
        error: legal.error,
        loading: legal.data === undefined && legal.error === null,
      };
    case 'department':
      return {
        options: (departments.data?.items ?? []).map((row) => ({
          value: String(row.id),
          label: row.name,
        })),
        error: departments.error,
        loading: departments.data === undefined && departments.error === null,
      };
    case 'category':
      return {
        options: (categories.data?.items ?? []).map((row) => ({
          value: String(row.id),
          label: row.code === null ? row.name : `${row.code} ${row.name}`,
        })),
        error: categories.error,
        loading: categories.data === undefined && categories.error === null,
      };
    case 'tender':
      return {
        options: (tenders.data?.items ?? []).map((row) => ({
          value: String(row.tenderId),
          label: `${row.reference} ${row.title}`,
        })),
        error: tenders.error,
        loading: tenders.data === undefined && tenders.error === null,
      };
    default:
      return { options: [], error: null, loading: false };
  }
}

export interface ScopeInputProps {
  readonly value: ScopeValue;
  readonly onChange: (value: ScopeValue) => void;
  readonly error?: string;
  /** Limits the scope types (for example submission authority: organization or tender). */
  readonly types?: readonly RoleAssignmentsScopeType[];
}

/** The scope of a role assignment, grant or restriction (`scope_type`, `scope_id`). */
export function ScopeInput({ value, onChange, error, types }: ScopeInputProps) {
  const { kind } = useMemberAdmin();
  const allowed = types ?? (kind === 'buyer' ? BUYER_SCOPE_TYPES : SUPPLIER_SCOPE_TYPES);
  const records = useScopeRecords(value.scopeType);
  const scopeTypes = ROLE_ASSIGNMENTS_SCOPE_TYPE.filter((type) => allowed.includes(type));
  return (
    <>
      <Select
        label={t('admin-access.scope.type')}
        value={value.scopeType}
        options={scopeTypes.map((type) => ({
          value: type,
          label: t(`admin-access.scopeType.${type}`),
        }))}
        onChange={(next) =>
          onChange({ scopeType: next as RoleAssignmentsScopeType, scopeId: null })
        }
        required
      />
      {value.scopeType !== 'organization' && (
        <Select
          label={t(`admin-access.scope.record.${value.scopeType}`)}
          value={value.scopeId === null ? '' : String(value.scopeId)}
          options={records.options}
          placeholder={
            records.loading ? t('admin-access.common.loading') : t('admin-access.common.choose')
          }
          onChange={(next) =>
            onChange({ scopeType: value.scopeType, scopeId: next === '' ? null : Number(next) })
          }
          error={
            error ?? (records.error === null ? undefined : orgAdminErrorMessage(records.error))
          }
          required
        />
      )}
    </>
  );
}
