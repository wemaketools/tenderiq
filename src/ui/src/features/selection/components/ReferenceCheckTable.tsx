/**
 * Reference checks with the referee's consent, contact time, feedback and outcome. Confidential feedback the caller
 * may not read shows as a dash beside the "Confidential" chip (DD-49); feedback can be recorded only with consent
 * (BUY-22).
 */
import type { ReactNode } from 'react';

import type { ReferenceCheck } from '@contracts/selection';

import type { ApiError } from '../../../api/client';
import { Button, Chip, DataTable, OrDash, Reference } from '../../../components/ui';
import type { DataTableColumn, DataTableSort, PaginationProps } from '../../../components/ui';
import { EMPTY_VALUE, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { selectionPaths } from '../lib/paths';
import { BidName } from './BidName';

export interface ReferenceCheckTableProps {
  readonly checks: readonly ReferenceCheck[] | undefined;
  readonly caption: string;
  readonly showTender?: boolean;
  /** Offers "Record feedback" on open checks. */
  readonly onRecordFeedback?: (check: ReferenceCheck) => void;
  readonly loading?: boolean;
  readonly error?: ApiError | null;
  readonly onRetry?: () => void;
  readonly empty: ReactNode;
  readonly pagination?: PaginationProps;
  readonly sort?: DataTableSort | null;
  readonly onSortChange?: (sort: DataTableSort) => void;
}

export function ReferenceCheckTable({
  checks,
  caption,
  showTender = false,
  onRecordFeedback,
  loading,
  error,
  onRetry,
  empty,
  pagination,
  sort,
  onSortChange,
}: ReferenceCheckTableProps) {
  const columns: DataTableColumn<ReferenceCheck>[] = [
    ...(showTender
      ? [
          {
            id: 'tender',
            header: t('selection.common.tender'),
            cell: (row: ReferenceCheck) => (
              <Reference
                value={row.tender.reference}
                to={selectionPaths.tender(row.tender.tenderId)}
              />
            ),
          },
        ]
      : []),
    {
      id: 'supplier',
      header: t('selection.references.col.supplier'),
      cell: (row) => <BidName bid={row.bid} />,
    },
    {
      id: 'refereeName',
      header: t('selection.references.col.referee'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.refereeName}</span>
          <span className="tiq-cell-sub">{row.refereeOrganization}</span>
        </>
      ),
    },
    {
      id: 'consent',
      header: t('selection.references.col.consent'),
      cell: (row) =>
        row.consentConfirmed ? (
          <Chip tone="success" size="sm" icon="checkCircle">
            {t('selection.references.consentGiven')}
          </Chip>
        ) : (
          <Chip tone="danger" size="sm" icon="ban">
            {t('selection.references.consentMissing')}
          </Chip>
        ),
    },
    {
      id: 'contactedAt',
      header: t('selection.references.col.contacted'),
      sortable: true,
      cell: (row) =>
        row.contactedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          formatDateTime(row.contactedAt, row.tender.officialTimeZone)
        ),
    },
    {
      id: 'feedback',
      header: t('selection.references.col.feedback'),
      cell: (row) => (
        <>
          {row.feedbackRestricted ? EMPTY_VALUE : <OrDash>{row.feedback}</OrDash>}
          {row.confidential && (
            <span className="tiq-cell-sub">
              <Chip tone="warning" size="sm" icon="lock">
                {t('selection.references.confidentialChip')}
              </Chip>
            </span>
          )}
        </>
      ),
    },
    {
      id: 'outcome',
      header: t('selection.references.col.outcome'),
      cell: (row) => (
        <>
          <OrDash>{row.outcome}</OrDash>
          {row.assessor !== null && (
            <span className="tiq-cell-sub">
              {t('selection.references.assessedBy', { name: row.assessor.fullName })}
            </span>
          )}
        </>
      ),
    },
  ];
  if (onRecordFeedback !== undefined) {
    columns.push({
      id: 'actions',
      header: t('selection.common.actions'),
      cell: (row) =>
        row.feedback !== null || row.feedbackRestricted || row.outcome !== null ? (
          <span className="tiq-text-muted">{t('selection.references.recorded')}</span>
        ) : row.consentConfirmed ? (
          <Button size="sm" icon="edit" onClick={() => onRecordFeedback(row)}>
            {t('selection.references.recordFeedback')}
          </Button>
        ) : (
          <span className="tiq-text-danger">{t('selection.references.consentRequired')}</span>
        ),
    });
  }
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={checks}
      rowKey={(row) => String(row.referenceCheckId)}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={empty}
      pagination={pagination}
      sort={sort}
      onSortChange={onSortChange}
    />
  );
}
