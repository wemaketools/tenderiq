/**
 * The candidates of the selection stage: compliant bids with their non-price and total scores, rank, gate result,
 * evaluated value and shortlist standing (BUY-23 eligible candidates, BUY-24 comparison).
 */
import type { SelectionCandidate } from '@contracts/selection';

import { Chip, DataTable, EmptyState, MoneyText, OrDash } from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDecimalString } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { lotLabel } from '../lib/labels';
import { BidName } from './BidName';

export interface CandidateTableProps {
  readonly candidates: readonly SelectionCandidate[];
  readonly caption: string;
  /** Highlights the preferred candidate (BUY-24). */
  readonly preferredBidId?: number;
  readonly fallbackBidId?: number | null;
}

export function CandidateTable({
  candidates,
  caption,
  preferredBidId,
  fallbackBidId,
}: CandidateTableProps) {
  const columns: DataTableColumn<SelectionCandidate>[] = [
    {
      id: 'bid',
      header: t('selection.candidates.col.supplier'),
      cell: (row) => (
        <>
          <span className="tiq-inline">
            <BidName bid={row.bid} />
            {row.bid.bidId === preferredBidId && (
              <Chip tone="accent" size="sm">
                {t('selection.candidates.preferred')}
              </Chip>
            )}
            {row.bid.bidId === fallbackBidId && (
              <Chip tone="neutral" size="sm">
                {t('selection.candidates.fallback')}
              </Chip>
            )}
          </span>
          <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>
        </>
      ),
    },
    {
      id: 'nonPrice',
      header: t('selection.candidates.col.nonPrice'),
      numeric: true,
      cell: (row) => <OrDash>{formatScore(row.nonPriceScore)}</OrDash>,
    },
    {
      id: 'total',
      header: t('selection.candidates.col.total'),
      numeric: true,
      cell: (row) => <OrDash>{formatScore(row.totalScore)}</OrDash>,
    },
    {
      id: 'rank',
      header: t('selection.candidates.col.rank'),
      numeric: true,
      cell: (row) => <OrDash>{row.rank}</OrDash>,
    },
    {
      id: 'gates',
      header: t('selection.candidates.col.gates'),
      cell: (row) =>
        row.passesGates ? (
          <Chip tone="success" size="sm" icon="checkCircle">
            {t('selection.candidates.passes')}
          </Chip>
        ) : (
          <Chip tone="danger" size="sm" icon="xCircle">
            {t('selection.candidates.fails')}
          </Chip>
        ),
    },
    {
      id: 'value',
      header: t('selection.candidates.col.value'),
      numeric: true,
      cell: (row) =>
        row.evaluatedValue === null ? (
          <span className="tiq-text-muted">{t('selection.candidates.sealed')}</span>
        ) : (
          <MoneyText value={row.evaluatedValue} />
        ),
    },
    {
      id: 'shortlisted',
      header: t('selection.candidates.col.shortlist'),
      cell: (row) =>
        row.shortlisted === null ? (
          <span className="tiq-text-muted">{t('selection.candidates.notShortlisted')}</span>
        ) : row.shortlisted ? (
          <Chip tone="success" size="sm">
            {t('selection.candidates.included')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('selection.candidates.excluded')}
          </Chip>
        ),
    },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={candidates}
      rowKey={(row) => String(row.bid.bidId)}
      empty={<EmptyState compact title={t('selection.candidates.empty')} />}
    />
  );
}

function formatScore(score: string | null): string | null {
  return score === null ? null : formatDecimalString(score, 2);
}
