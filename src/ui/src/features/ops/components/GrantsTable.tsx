/**
 * Support access grants (OPS-04): case purpose, customer authorization, permitted records, access window and status.
 * Each grant is read-only, time-limited and never covers sealed content (bids, evaluation scores).
 */
import type { ReactNode } from 'react';

import type { SupportGrant } from '@contracts/operations';

import type { ApiError } from '../../../api/client';
import { DataTable, EmptyState, Reference, StatusChip } from '../../../components/ui';
import type { PaginationProps } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { grantWindow } from '../lib/grants';

export interface GrantsTableProps {
  readonly rows: readonly SupportGrant[] | undefined;
  readonly timeZone: string;
  readonly caption: string;
  readonly action?: (row: SupportGrant) => ReactNode;
  readonly showCase?: boolean;
  /** Where the case reference links to (operator views link to the case; omitted, it is plain text). */
  readonly caseLink?: (caseId: number) => string;
  readonly loading?: boolean;
  readonly error?: ApiError | null;
  readonly onRetry?: () => void;
  readonly pagination?: PaginationProps;
}

export function GrantsTable({
  rows,
  timeZone,
  caption,
  action,
  showCase = false,
  caseLink,
  loading,
  error,
  onRetry,
  pagination,
}: GrantsTableProps) {
  return (
    <DataTable<SupportGrant>
      caption={caption}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      pagination={pagination}
      rowKey={(row) => String(row.id)}
      empty={
        <EmptyState
          compact
          icon="key"
          title={t('ops.grants.empty')}
          description={t('ops.grants.emptyHint')}
        />
      }
      columns={[
        {
          id: 'need',
          header: t('ops.grants.col.need'),
          width: '28%',
          cell: (row) => (
            <>
              {row.businessNeed}
              {showCase && (
                <div className="tiq-cell-sub">
                  {t('ops.grants.caseLabel')}{' '}
                  <Reference value={row.caseReference} to={caseLink?.(row.caseId)} />
                </div>
              )}
            </>
          ),
        },
        {
          id: 'customer',
          header: t('ops.grants.col.customer'),
          cell: (row) => (
            <>
              {row.customer.name}
              <div className="tiq-cell-sub">
                {row.authorizedBy === null
                  ? t('ops.grants.notAuthorized')
                  : t('ops.grants.authorizedBy', { name: row.authorizedBy.fullName })}
              </div>
            </>
          ),
        },
        {
          id: 'operator',
          header: t('ops.grants.col.operator'),
          cell: (row) => row.operator.fullName,
        },
        {
          id: 'scope',
          header: t('ops.grants.col.scope'),
          cell: (row) => (
            <>
              <StatusChip enum="support_access_grants.scope" value={row.scope} size="sm" />
              {row.recordRefs.length > 0 && (
                <div className="tiq-cell-sub tiq-mono">{row.recordRefs.join(', ')}</div>
              )}
            </>
          ),
        },
        {
          id: 'window',
          header: t('ops.grants.col.window'),
          cell: (row) => grantWindow(row, timeZone),
        },
        {
          id: 'status',
          header: t('ops.grants.col.status'),
          cell: (row) => (
            <div className="tiq-stack">
              <span>
                <StatusChip enum="support_access_grants.status" value={row.status} />
              </span>
              {row.statusReason !== null && (
                <span className="tiq-cell-sub">{row.statusReason}</span>
              )}
            </div>
          ),
        },
        ...(action === undefined
          ? []
          : [{ id: 'actions', header: t('ops.common.actions'), cell: action }]),
      ]}
    />
  );
}
