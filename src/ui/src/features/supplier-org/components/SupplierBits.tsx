/**
 * Small presentational pieces shared by the supplier screens: the evidence freshness chip (a contract-derived value,
 * not a blueprint enumeration), category chips, a document link, and the list of a supplier's locations.
 */
import { Link } from 'react-router';

import type { ChipTone } from '@contracts/enums';
import type {
  EvidenceDocumentRef,
  EvidenceFreshness,
  SupplierCategory,
  SupplierLocation,
} from '@contracts/suppliers';

import { Chip, EmptyState, Icon, OrDash } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { supplierOrgPaths } from '../lib/paths';

const FRESHNESS_TONE: Readonly<Record<EvidenceFreshness, ChipTone>> = {
  current: 'success',
  expiring_soon: 'warning',
  expired: 'danger',
  no_expiry: 'neutral',
};

/** The derived freshness of an evidence edition (current, expiring soon, expired, no expiry). */
export function FreshnessChip({
  value,
  size,
}: {
  readonly value: EvidenceFreshness;
  readonly size?: 'sm' | 'md';
}) {
  return (
    <Chip tone={FRESHNESS_TONE[value]} size={size}>
      {t(`supplier-org.freshness.${value}`)}
    </Chip>
  );
}

/** The categories a supplier serves, as neutral chips. */
export function CategoryChips({
  categories,
}: {
  readonly categories: readonly SupplierCategory[];
}) {
  if (categories.length === 0) return <OrDash>{null}</OrDash>;
  return (
    <span className="tiq-inline">
      {categories.map((category) => (
        <Chip
          key={category.catalogCode}
          tone="neutral-outlined"
          size="sm"
          title={category.catalogCode}
        >
          {category.name}
        </Chip>
      ))}
    </span>
  );
}

/** A link to the workspace document page of an evidence or identity document. */
export function DocumentLink({ document }: { readonly document: EvidenceDocumentRef | null }) {
  if (document === null) return <OrDash>{null}</OrDash>;
  return (
    <Link to={supplierOrgPaths.document(document.documentId)} className="tiq-inline">
      <Icon name="fileText" />
      <span>{document.fileName}</span>
      <span className="tiq-text-muted">
        {t('supplier-org.common.versionNo', { no: document.versionNo })}
      </span>
    </Link>
  );
}

/** The supplier's locations, the registered office first. */
export function LocationList({ locations }: { readonly locations: readonly SupplierLocation[] }) {
  if (locations.length === 0) {
    return <EmptyState compact title={t('supplier-org.common.noLocations')} />;
  }
  const ordered = [...locations].sort(
    (a, b) => Number(b.isRegisteredOffice) - Number(a.isRegisteredOffice),
  );
  return (
    <ul className="tiq-stack">
      {ordered.map((location) => (
        <li key={location.id}>
          <span className="tiq-inline">
            <strong>{location.name}</strong>
            {location.isRegisteredOffice && (
              <Chip tone="info" size="sm">
                {t('supplier-org.common.registeredOffice')}
              </Chip>
            )}
          </span>
          <span className="tiq-cell-sub">
            {[location.address, location.region, location.country]
              .filter((part) => part !== null && part !== '')
              .join(', ')}
          </span>
        </li>
      ))}
    </ul>
  );
}
