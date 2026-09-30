/**
 * The organization a personal service request is made for (DD-21): the person's active memberships, defaulting to
 * the active organization. The request is sent with that organization as its row tenant.
 */
import { Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useRequestOrganizations } from '../lib/organizations';

export function OrganizationSelect({
  value,
  onChange,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}) {
  const organizations = useRequestOrganizations();
  return (
    <Select
      label={t('help.form.organization')}
      hint={t('help.form.organizationHint')}
      required
      placeholder={t('ops.common.choose')}
      value={value}
      onChange={onChange}
      error={error}
      options={organizations.map((membership) => ({
        value: String(membership.tenantId),
        label:
          membership.capacity === null
            ? membership.tenantName
            : `${membership.tenantName} (${membership.capacity})`,
      }))}
    />
  );
}
