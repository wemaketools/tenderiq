/**
 * PUB-05 — Award detail: the approved, redacted public award notice of one tender: buyer, event, awarded lots,
 * supplier names, disclosed values, dates and the approved outcome explanation, with the notice as a download.
 * Publication of an award does not prove that a contract is signed or effective (FR-17).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { downloadPublicAwardNotice, getPublicAward } from '@contracts/awards';
import type { PublicAwardDetail, PublicAwardLot } from '@contracts/awards';

import { call, isApiError } from '../../../api/client';
import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  DataTable,
  DetailList,
  EmptyState,
  MoneyText,
  OrDash,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  describeError,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { downloadBlob } from '../../../lib/download';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { TextBlock } from '../../awards/components/TextBlock';
import { outcomePaths } from '../lib/paths';

export default function PublicAwardPage() {
  const { buyerSlug = '', reference = '' } = useParams();
  const valid = buyerSlug !== '' && reference !== '';
  const query = useApiQuery(getPublicAward, valid ? { params: { buyerSlug, reference } } : null);
  const back = { to: outcomePaths.publicAwards, label: t('outcomes.public.back') };
  return (
    <div className="tiq-page">
      {valid ? (
        <QueryView
          query={query}
          loading={<PageHeader title={t('outcomes.public.detailTitle')} back={back} />}
        >
          {(data) => <AwardBody award={data} back={back} />}
        </QueryView>
      ) : (
        <EmptyState title={t('outcomes.public.notFound')} icon="award" />
      )}
    </div>
  );
}

function AwardBody({
  award,
  back,
}: {
  readonly award: PublicAwardDetail;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zone = award.officialTimeZone;

  const download = async (): Promise<void> => {
    setDownloading(true);
    setError(null);
    try {
      const file = await call(downloadPublicAwardNotice, {
        params: { buyerSlug: award.buyer.slug, reference: award.reference },
      });
      downloadBlob(new Blob([file.content], { type: file.contentType }), file.fileName);
    } catch (caught) {
      setError(isApiError(caught) ? describeError(caught) : t('outcomes.public.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const columns: DataTableColumn<PublicAwardLot>[] = [
    {
      id: 'lot',
      header: t('outcomes.public.col.lot'),
      cell: (row) => t('awards.common.lotLabel', { no: row.lotNo, title: row.title }),
    },
    {
      id: 'outcome',
      header: t('outcomes.public.col.outcome'),
      cell: (row) =>
        row.outcome === null ? (
          <span className="tiq-text-muted">{t('outcomes.public.noOutcome')}</span>
        ) : (
          <StatusChip enum="lot_outcomes.outcome" value={row.outcome} />
        ),
    },
    {
      id: 'supplier',
      header: t('outcomes.public.col.supplier'),
      cell: (row) => row.supplierName ?? <OrDash>{null}</OrDash>,
    },
    {
      id: 'value',
      header: t('outcomes.public.col.value'),
      numeric: true,
      cell: (row) =>
        !award.disclosedValues ? (
          <span className="tiq-text-muted">{t('outcomes.public.notDisclosed')}</span>
        ) : row.awardedValue === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <MoneyText value={row.awardedValue} />
        ),
    },
    {
      id: 'final',
      header: t('outcomes.public.col.finalAwarded'),
      cell: (row) =>
        row.finalAwardedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          formatDateTime(row.finalAwardedAt, zone)
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`${award.reference} ${award.title}`}
        back={back}
        meta={
          <>
            <span>{award.buyer.name}</span>
            <Reference value={award.reference} />
            <StatusChip enum="tenders.status" value={award.tenderStatus} />
          </>
        }
        actions={
          <Button icon="download" loading={downloading} onClick={() => void download()}>
            {t('outcomes.public.download')}
          </Button>
        }
      />
      <div className="tiq-stack tiq-stack--spaced">
        {error !== null && (
          <Banner tone="error" title={t('outcomes.public.downloadFailed')}>
            {error}
          </Banner>
        )}
        <Banner tone="info" title={t('outcomes.public.notContractTitle')}>
          {t('outcomes.public.notContractText')}
        </Banner>
        <Card title={t('outcomes.public.summaryTitle')}>
          <DetailList
            items={[
              { label: t('outcomes.public.col.buyer'), value: award.buyer.name },
              {
                label: t('outcomes.public.col.event'),
                value: tEnum('tenders.event_type', award.eventType),
              },
              {
                label: t('outcomes.public.col.published'),
                value: formatDateTime(award.publishedAt, zone),
              },
              {
                label: t('outcomes.public.totalValue'),
                value:
                  !award.disclosedValues || award.totalAwardedValue === null ? (
                    t('outcomes.public.notDisclosed')
                  ) : (
                    <MoneyText value={award.totalAwardedValue} />
                  ),
              },
              { label: t('outcomes.public.fileName'), value: award.noticeFileName },
            ]}
          />
        </Card>
        <Card title={t('outcomes.public.lotsTitle')} flush>
          <DataTable
            caption={t('outcomes.public.lotsTitle')}
            columns={columns}
            rows={award.lots}
            rowKey={(row) => String(row.lotNo)}
            empty={<EmptyState compact title={t('outcomes.public.noLots')} />}
          />
        </Card>
        <Card title={t('outcomes.public.explanationTitle')}>
          <TextBlock text={award.content} />
        </Card>
      </div>
    </>
  );
}
