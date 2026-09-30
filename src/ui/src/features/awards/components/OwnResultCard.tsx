/**
 * The debrief recipient's OWN result (AC-27): its score and rank against the published criteria, with feedback
 * per criterion and the relative advantages of the successful tender at the permitted level. Never another
 * bidder's scores or prices.
 */
import type { DebriefOwnResult } from '@contracts/awards';

import { Card, DataTable, DetailList, OrDash } from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDecimalString } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { TextBlock } from './TextBlock';

type Criterion = DebriefOwnResult['criteria'][number];

export interface OwnResultCardProps {
  readonly result: DebriefOwnResult;
  readonly title?: string;
}

export function OwnResultCard({ result, title }: OwnResultCardProps) {
  const columns: DataTableColumn<Criterion>[] = [
    { id: 'criterion', header: t('awards.ownResult.col.criterion'), cell: (row) => row.criterion },
    {
      id: 'weight',
      header: t('awards.ownResult.col.weight'),
      numeric: true,
      cell: (row) => formatDecimalString(row.weight, 2),
    },
    {
      id: 'score',
      header: t('awards.ownResult.col.score'),
      numeric: true,
      cell: (row) =>
        row.ownScore === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          t('awards.ownResult.outOf', {
            score: formatDecimalString(row.ownScore, 2),
            max: formatDecimalString(row.maxScore, 2),
          })
        ),
    },
    { id: 'feedback', header: t('awards.ownResult.col.feedback'), cell: (row) => row.feedback },
  ];
  return (
    <Card title={title ?? t('awards.ownResult.title')} subtitle={t('awards.ownResult.subtitle')}>
      <div className="tiq-stack">
        <DetailList
          items={[
            {
              label: t('awards.ownResult.total'),
              value:
                result.totalScore === null
                  ? null
                  : t('awards.ownResult.outOf', {
                      score: formatDecimalString(result.totalScore, 2),
                      max: formatDecimalString(result.maxScore, 2),
                    }),
            },
            {
              label: t('awards.ownResult.rank'),
              value: result.rank === null ? null : String(result.rank),
            },
          ]}
        />
        <DataTable
          caption={t('awards.ownResult.criteriaCaption')}
          columns={columns}
          rows={result.criteria}
          rowKey={(row) => row.criterion}
          empty={<p className="tiq-text-muted">{t('awards.ownResult.noCriteria')}</p>}
        />
        <div>
          <h3 className="tiq-form-section-title">{t('awards.ownResult.advantages')}</h3>
          <TextBlock
            text={result.successfulTenderAdvantages}
            empty={t('awards.ownResult.noAdvantages')}
          />
        </div>
      </div>
    </Card>
  );
}
