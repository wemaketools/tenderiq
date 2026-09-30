/**
 * Notice content shared by the public notice (PUB-03) and the supplier opportunity workspace (SUP-08): the amendment
 * history (issued addenda and versions, shown prominently), lots, key dates in official time, participation
 * conditions and the package documents. Deadlines always render through OfficialDeadline (DD-33).
 */
import type { ReactNode } from 'react';

import type {
  NoticeAddendum,
  NoticeCondition,
  NoticeLot,
  NoticeMilestone,
  NoticeVersion,
  PackageDocument,
} from '@contracts/publication';

import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  OfficialDeadline,
  Reference,
  StatusChip,
  Timeline,
} from '../../../components/ui';
import type { DataTableColumn, TimelineItem } from '../../../components/ui';
import { formatBytes, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { lotColumns } from '../lib/lotColumns';

// ---------------------------------------------------------------------------------------------------------
// Amendment history
// ---------------------------------------------------------------------------------------------------------

export interface AmendmentHistoryProps<A extends NoticeAddendum> {
  readonly addenda: readonly A[];
  readonly versions: readonly NoticeVersion[];
  readonly timeZone: string;
  readonly currentVersionNo: number;
  /** Extra content per addendum (the supplier's acknowledgment state and action). */
  readonly renderAddendumExtra?: (addendum: A) => ReactNode;
  readonly title?: string;
}

export function AmendmentHistory<A extends NoticeAddendum>({
  addenda,
  versions,
  timeZone,
  currentVersionNo,
  renderAddendumExtra,
  title,
}: AmendmentHistoryProps<A>) {
  const sorted = [...addenda].sort((a, b) => b.number - a.number);
  const items: TimelineItem[] = sorted.map((addendum) => ({
    id: addendum.addendumId,
    title: (
      <span className="tiq-inline">
        <Reference value={t('publication.shared.addendumNo', { no: addendum.number })} />
        <span>{addendum.title}</span>
        <StatusChip enum="addenda.materiality" value={addendum.materiality} size="sm" />
      </span>
    ),
    meta: t('publication.shared.addendumMeta', {
      at: formatOfficialTime(addendum.issuedAt, timeZone),
      version: addendum.resultingVersionNo,
    }),
    detail: (
      <div className="tiq-stack">
        <p>{addendum.changeDescription}</p>
        <p className="tiq-text-muted">
          {addendum.affectedLotNos.length === 0
            ? t('publication.shared.affectsAllLots')
            : t('publication.shared.affectsLots', {
                lots: addendum.affectedLotNos
                  .map((no) => t('publication.common.lotNo', { no }))
                  .join(', '),
              })}
          {' · '}
          {tEnum('addenda.existing_submission_action', addendum.existingSubmissionAction)}
        </p>
        {addendum.newSubmissionDeadline !== null && (
          <OfficialDeadline
            deadline={addendum.newSubmissionDeadline}
            label={t('publication.shared.newDeadline')}
          />
        )}
        {renderAddendumExtra?.(addendum)}
      </div>
    ),
    tone: addendum.materiality === 'material' ? 'warning' : 'info',
    icon: 'fileText',
  }));

  return (
    <Card
      title={title ?? t('publication.shared.amendmentsTitle', { count: addenda.length })}
      subtitle={t('publication.shared.currentVersion', { version: currentVersionNo })}
    >
      {items.length === 0 ? (
        <EmptyState compact icon="fileText" title={t('publication.shared.noAmendments')} />
      ) : (
        <Timeline items={items} label={t('publication.shared.amendmentsLabel')} />
      )}
      {versions.length > 0 && (
        <details>
          <summary>{t('publication.shared.versionsTitle', { count: versions.length })}</summary>
          <ul className="tiq-stack">
            {[...versions]
              .sort((a, b) => b.versionNo - a.versionNo)
              .map((version) => (
                <li key={version.versionNo}>
                  <strong>{t('publication.common.versionNo', { no: version.versionNo })}</strong>
                  {' · '}
                  {formatOfficialTime(version.issuedAt, timeZone)}
                  {' · '}
                  {version.changeSummary}
                  {version.versionNo === currentVersionNo && (
                    <>
                      {' '}
                      <Chip tone="accent" size="sm">
                        {t('publication.shared.current')}
                      </Chip>
                    </>
                  )}
                </li>
              ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------------------------------------

export function LotsCard({ lots }: { readonly lots: readonly NoticeLot[] }) {
  return (
    <Card flush title={t('publication.shared.lotsTitle', { count: lots.length })}>
      <DataTable
        caption={t('publication.shared.lotsCaption')}
        columns={lotColumns<NoticeLot>()}
        rows={lots}
        rowKey={(lot) => String(lot.lotId)}
        empty={<EmptyState compact icon="layers" title={t('publication.shared.noLots')} />}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Key dates
// ---------------------------------------------------------------------------------------------------------

export function MilestonesCard({
  milestones,
  timeZone,
}: {
  readonly milestones: readonly NoticeMilestone[];
  readonly timeZone: string;
}) {
  const sorted = [...milestones].sort((a, b) => a.at.at.localeCompare(b.at.at));
  return (
    <Card
      title={t('publication.shared.datesTitle')}
      subtitle={t('publication.shared.datesIntro', { zone: timeZone })}
    >
      {sorted.length === 0 ? (
        <EmptyState compact icon="calendar" title={t('publication.shared.noDates')} />
      ) : (
        <ul className="tiq-stack">
          {sorted.map((milestone, index) => (
            <li
              key={`${milestone.milestone}:${milestone.lotNo ?? 0}:${index}`}
              className="tiq-stack"
            >
              <OfficialDeadline
                deadline={milestone.at}
                variant="block"
                label={
                  milestone.lotNo === null
                    ? tEnum('tender_milestones.milestone', milestone.milestone)
                    : `${tEnum('tender_milestones.milestone', milestone.milestone)} · ${t('publication.common.lotNo', { no: milestone.lotNo })}`
                }
              />
              {milestone.note !== null && <span className="tiq-text-muted">{milestone.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------------------------------------

export interface ConditionListProps<C extends NoticeCondition> {
  readonly conditions: readonly C[];
  readonly renderState?: (condition: C) => ReactNode;
  readonly title?: string;
  readonly intro?: string;
}

export function ConditionsCard<C extends NoticeCondition>({
  conditions,
  renderState,
  title,
  intro,
}: ConditionListProps<C>) {
  return (
    <Card title={title ?? t('publication.shared.conditionsTitle')} subtitle={intro}>
      {conditions.length === 0 ? (
        <EmptyState compact icon="clipboard" title={t('publication.shared.noConditions')} />
      ) : (
        <ul className="tiq-stack">
          {conditions.map((condition) => (
            <li key={condition.conditionId} className="tiq-inline">
              <Chip tone={condition.blocking ? 'danger' : 'neutral'} size="sm">
                {condition.blocking
                  ? t('publication.common.blocking')
                  : t('publication.common.informational')}
              </Chip>
              <span>
                <strong>
                  {tEnum('participation_conditions.condition_type', condition.conditionType)}
                </strong>
                {': '}
                {condition.description}
              </span>
              {renderState?.(condition)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------------------------------------

export interface DocumentsCardProps<D extends PackageDocument> {
  readonly documents: readonly D[];
  readonly timeZone: string;
  readonly renderAction: (document: D) => ReactNode;
  readonly title?: string;
  readonly intro?: ReactNode;
  readonly footer?: ReactNode;
}

export function DocumentsCard<D extends PackageDocument>({
  documents,
  timeZone,
  renderAction,
  title,
  intro,
  footer,
}: DocumentsCardProps<D>) {
  const columns: DataTableColumn<D>[] = [
    {
      id: 'title',
      header: t('publication.shared.col.document'),
      cell: (document) => (
        <>
          <span>{document.title}</span>
          <span className="tiq-cell-sub tiq-mono">{document.fileName}</span>
        </>
      ),
    },
    {
      id: 'classification',
      header: t('publication.shared.col.classification'),
      cell: (document) => (
        <StatusChip enum="documents.classification" value={document.classification} size="sm" />
      ),
    },
    {
      id: 'version',
      header: t('publication.shared.col.version'),
      cell: (document) => (
        <>
          <span>{t('publication.common.versionNo', { no: document.versionNo })}</span>
          {document.addendumNo !== null && (
            <span className="tiq-cell-sub">
              {t('publication.shared.fromAddendum', { no: document.addendumNo })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'published',
      header: t('publication.shared.col.published'),
      cell: (document) => formatOfficialTime(document.publishedAt, timeZone),
    },
    {
      id: 'size',
      header: t('publication.shared.col.size'),
      numeric: true,
      cell: (document) => (
        <>
          <span>{formatBytes(document.sizeBytes)}</span>
          <span className="tiq-cell-sub">{document.language.toUpperCase()}</span>
        </>
      ),
    },
    {
      id: 'action',
      header: <span className="tiq-visually-hidden">{t('publication.register.col.actions')}</span>,
      cell: (document) => renderAction(document),
    },
  ];
  return (
    <Card
      flush
      title={title ?? t('publication.shared.documentsTitle', { count: documents.length })}
      subtitle={intro}
      footer={footer}
    >
      <DataTable
        caption={t('publication.shared.documentsCaption')}
        columns={columns}
        rows={documents}
        rowKey={(document) => String(document.documentId)}
        empty={<EmptyState compact icon="files" title={t('publication.shared.noDocuments')} />}
      />
    </Card>
  );
}
