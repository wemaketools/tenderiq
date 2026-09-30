/**
 * The supplier's own questions (SUP-10): status, subject, lateness and the reply once answered. Other suppliers'
 * questions never appear here.
 */
import type { SupplierQuestionRow } from '@contracts/clarifications';

import type { ApiError } from '../../../api/client';
import { Chip, DataTable, EmptyState, Reference, StatusChip } from '../../../components/ui';
import type { DataTableSort, PaginationProps } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { excerpt, subjectLabel, supplierPaths } from '../lib';

interface SupplierQuestionTableProps {
  readonly rows: readonly SupplierQuestionRow[] | undefined;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly onRetry: () => void;
  readonly timeZone: string;
  readonly sort: DataTableSort;
  readonly onSortChange: (sort: DataTableSort) => void;
  readonly onOpen: (row: SupplierQuestionRow) => void;
  readonly pagination: PaginationProps | undefined;
}

/** The supplier's own questions: the reply shows once answered (shared or privately). */
export function SupplierQuestionTable({
  rows,
  loading,
  error,
  onRetry,
  timeZone,
  sort,
  onSortChange,
  onOpen,
  pagination,
}: SupplierQuestionTableProps) {
  return (
    <DataTable<SupplierQuestionRow>
      caption={t('clarifications.supplier.myQuestions')}
      rows={rows}
      rowKey={(row) => String(row.id)}
      loading={loading}
      error={error}
      onRetry={onRetry}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={onOpen}
      rowLabel={(row) => t('clarifications.questions.rowLabel', { id: row.id })}
      pagination={pagination}
      empty={
        <EmptyState
          compact
          icon="messageQuestion"
          title={t('clarifications.supplier.noQuestions')}
          description={t('clarifications.supplier.noQuestionsHint')}
        />
      }
      columns={[
        {
          id: 'question',
          header: t('clarifications.questions.col.question'),
          width: '30%',
          cell: (row) => (
            <>
              <Reference value={`Q-${row.id}`} to={supplierPaths.question(row.id)} />
              <div className="tiq-cell-sub" title={row.questionText}>
                {excerpt(row.questionText)}
              </div>
            </>
          ),
        },
        {
          id: 'tenderReference',
          header: t('clarifications.questions.col.tender'),
          sortable: true,
          cell: (row) => <Reference value={row.tender.reference} />,
        },
        {
          id: 'subject',
          header: t('clarifications.supplier.col.subject'),
          cell: (row) => subjectLabel(row),
        },
        {
          id: 'submittedAt',
          header: t('clarifications.questions.col.submitted'),
          sortable: true,
          cell: (row) => (
            <>
              {formatDateTime(row.submittedAt, timeZone)}
              {row.afterDeadline && (
                <div>
                  <Chip tone="warning" outlined size="sm">
                    {t('clarifications.supplier.late')}
                  </Chip>
                </div>
              )}
            </>
          ),
        },
        {
          id: 'status',
          header: t('clarifications.questions.col.status'),
          sortable: true,
          cell: (row) => <StatusChip enum="questions.status" value={row.status} />,
        },
        {
          id: 'reply',
          header: t('clarifications.supplier.col.reply'),
          cell: (row) =>
            row.answerText === null ? (
              <span className="tiq-text-muted">
                {row.addendumNumber !== null
                  ? t('clarifications.supplier.inAddendum', { no: row.addendumNumber })
                  : t('clarifications.supplier.noReply')}
              </span>
            ) : (
              <>
                <span>{row.answerText}</span>
                {row.answerAudience !== null && (
                  <div className="tiq-cell-sub">
                    {t(`clarifications.supplier.replyAudience.${row.answerAudience}`)}
                  </div>
                )}
              </>
            ),
        },
      ]}
    />
  );
}
