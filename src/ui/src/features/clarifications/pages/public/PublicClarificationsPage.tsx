/**
 * PUB-04 Public clarifications and amendments: the released public answers and issued addenda of a tender on the
 * public portal, with issue dates and affected lots. Supplier identities and commercial details never appear. The
 * edition can be read here or downloaded as a text document dated by its latest released item.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { PublicAddendum, PublicClarifications } from '@contracts/clarifications';

import { useApiQuery } from '../../../../api/hooks';
import {
  Button,
  Card,
  DetailList,
  EmptyState,
  FilterBar,
  OfficialDeadline,
  PageHeader,
  QueryView,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import { downloadBlob } from '../../../../lib/download';
import { EMPTY_VALUE, formatOfficialTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import {
  ChangeAreaChips,
  RequirementChangesTable,
  SharedAnswerList,
} from '../../components/shared';
import { lotsLabel } from '../../lib';

export default function PublicClarificationsPage() {
  const { buyerSlug = '', ref = '' } = useParams();
  const [q, setQ] = useState('');
  const [lot, setLot] = useState('');
  const edition = useApiQuery(clarificationsEndpoints.publicEdition, {
    params: { buyerSlug, ref },
    query: {
      ...(q.trim() === '' ? {} : { q: q.trim() }),
      ...(lot === '' ? {} : { lotId: Number(lot) }),
    },
  });

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.public.title')}
        subtitle={t('clarifications.public.subtitle', { reference: ref })}
        actions={
          edition.data === undefined ? undefined : (
            <Button
              icon="download"
              onClick={() => downloadEdition(edition.data as PublicClarifications)}
            >
              {t('clarifications.public.download')}
            </Button>
          )
        }
      />
      <QueryView query={edition} errorTitle={t('clarifications.public.unavailable')}>
        {(data) => (
          <>
            <Card title={`${data.tender.reference} · ${data.tender.title}`}>
              <DetailList
                items={[
                  {
                    key: 'buyer',
                    label: t('clarifications.supplier.col.buyer'),
                    value: data.tender.buyer.name,
                  },
                  {
                    key: 'status',
                    label: t('clarifications.addenda.col.status'),
                    value: <StatusChip enum="tenders.status" value={data.tender.status} />,
                  },
                  {
                    key: 'deadline',
                    label: t('clarifications.common.submissionDeadline'),
                    value:
                      data.tender.submissionDeadline === null ? null : (
                        <OfficialDeadline deadline={data.tender.submissionDeadline} />
                      ),
                  },
                  {
                    key: 'version',
                    label: t('clarifications.supplierAddendum.version'),
                    value: t('clarifications.supplierAddendum.versionValue', {
                      version: data.tender.currentVersionNo,
                    }),
                  },
                  {
                    key: 'edition',
                    label: t('clarifications.public.edition'),
                    value:
                      data.editionAt === null
                        ? null
                        : formatOfficialTime(data.editionAt, data.tender.officialTimeZone),
                  },
                ]}
              />
              <p className="tiq-text-muted">{t('clarifications.public.identityNote')}</p>
            </Card>

            <FilterBar
              onClear={() => {
                setQ('');
                setLot('');
              }}
              canClear={q !== '' || lot !== ''}
            >
              <SearchField
                label={t('clarifications.filters.search')}
                placeholder={t('clarifications.public.searchPlaceholder')}
                value={q}
                onChange={setQ}
              />
              {data.tender.lots.length > 0 && (
                <Select
                  label={t('clarifications.addendumForm.lot')}
                  value={lot}
                  onChange={setLot}
                  placeholder={t('clarifications.common.allLots')}
                  options={data.tender.lots.map((item) => ({
                    value: String(item.lotId),
                    label: t('clarifications.common.lotLabel', {
                      no: item.lotNo,
                      title: item.title,
                    }),
                  }))}
                />
              )}
            </FilterBar>

            <Card title={t('clarifications.public.addenda', { count: data.addenda.length })}>
              {data.addenda.length === 0 ? (
                <EmptyState compact icon="fileText" title={t('clarifications.public.noAddenda')} />
              ) : (
                <div className="tiq-stack tiq-stack--spaced">
                  {data.addenda.map((addendum) => (
                    <PublicAddendumCard
                      key={addendum.addendumId}
                      addendum={addendum}
                      edition={data}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card title={t('clarifications.public.questions', { count: data.questions.length })}>
              <SharedAnswerList
                answers={data.questions}
                timeZone={data.tender.officialTimeZone}
                emptyTitle={t('clarifications.public.noQuestions')}
              />
            </Card>
          </>
        )}
      </QueryView>
    </div>
  );
}

function PublicAddendumCard({
  addendum,
  edition,
}: {
  readonly addendum: PublicAddendum;
  readonly edition: PublicClarifications;
}) {
  const lotLabel = (lotId: number | null): string => {
    if (lotId === null) return t('clarifications.common.allLots');
    const lot = edition.tender.lots.find((item) => item.lotId === lotId);
    return lot === undefined
      ? t('clarifications.common.lotShort', { no: lotId })
      : t('clarifications.common.lotLabel', { no: lot.lotNo, title: lot.title });
  };
  return (
    <Card
      headingLevel={3}
      title={
        <span className="tiq-inline">
          <Reference value={t('clarifications.common.addendumNo', { no: addendum.number })} />
          {addendum.title}
        </span>
      }
      subtitle={t('clarifications.public.issuedAt', {
        at: formatOfficialTime(addendum.issuedAt, edition.tender.officialTimeZone),
        version: addendum.resultingVersionNo,
      })}
    >
      <div className="tiq-stack">
        <p>{addendum.changeDescription}</p>
        <DetailList
          items={[
            {
              key: 'materiality',
              label: t('clarifications.addendumPage.materiality'),
              value: (
                <StatusChip enum="addenda.materiality" value={addendum.materiality} size="sm" />
              ),
            },
            {
              key: 'areas',
              label: t('clarifications.addendumPage.changeAreas'),
              value: <ChangeAreaChips areas={addendum} />,
            },
            {
              key: 'lots',
              label: t('clarifications.addendumPage.affectedLots'),
              value: lotsLabel(addendum.affectedLots),
            },
            {
              key: 'deadline',
              label: t('clarifications.addendumPage.newDeadline'),
              value:
                addendum.newSubmissionDeadline === null ? (
                  t('clarifications.addenda.noDateChange')
                ) : (
                  <OfficialDeadline deadline={addendum.newSubmissionDeadline} />
                ),
            },
          ]}
        />
        {addendum.requirementChanges.length > 0 && (
          <RequirementChangesTable changes={addendum.requirementChanges} lotLabel={lotLabel} />
        )}
      </div>
    </Card>
  );
}

/** The edition as a plain-text document (the same content as the page, no identities). */
function downloadEdition(edition: PublicClarifications): void {
  const tz = edition.tender.officialTimeZone;
  const lines: string[] = [
    t('clarifications.public.file.heading', {
      reference: edition.tender.reference,
      title: edition.tender.title,
    }),
    t('clarifications.public.file.buyer', { buyer: edition.tender.buyer.name }),
    t('clarifications.public.file.edition', {
      at: edition.editionAt === null ? EMPTY_VALUE : formatOfficialTime(edition.editionAt, tz),
    }),
    t('clarifications.public.file.deadline', {
      at:
        edition.tender.submissionDeadline === null
          ? EMPTY_VALUE
          : formatOfficialTime(
              edition.tender.submissionDeadline.at,
              edition.tender.submissionDeadline.timeZone,
            ),
    }),
    '',
    t('clarifications.public.addenda', { count: edition.addenda.length }),
  ];
  for (const addendum of edition.addenda) {
    lines.push(
      '',
      `${t('clarifications.common.addendumNo', { no: addendum.number })}: ${addendum.title}`,
      t('clarifications.public.issuedAt', {
        at: formatOfficialTime(addendum.issuedAt, tz),
        version: addendum.resultingVersionNo,
      }),
      `${t('clarifications.addendumPage.affectedLots')}: ${lotsLabel(addendum.affectedLots)}`,
      addendum.changeDescription,
    );
    if (addendum.newSubmissionDeadline !== null) {
      lines.push(
        `${t('clarifications.addendumPage.newDeadline')}: ${formatOfficialTime(
          addendum.newSubmissionDeadline.at,
          addendum.newSubmissionDeadline.timeZone,
        )}`,
      );
    }
    for (const change of addendum.requirementChanges) {
      lines.push(
        `- ${change.refCode} (${change.changeType}): ${change.previousText ?? EMPTY_VALUE} -> ${change.newText ?? EMPTY_VALUE}`,
      );
    }
  }
  lines.push('', t('clarifications.public.questions', { count: edition.questions.length }));
  for (const answer of edition.questions) {
    lines.push(
      '',
      `${t('clarifications.answers.question')} ${answer.sanitizedQuestion}`,
      `${t('clarifications.answers.answer')} ${answer.answerText}`,
      t('clarifications.answers.publishedAt', { at: formatOfficialTime(answer.publishedAt, tz) }),
    );
  }
  downloadBlob(
    new Blob([`${lines.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }),
    `${edition.tender.reference}-clarifications.txt`,
  );
}
