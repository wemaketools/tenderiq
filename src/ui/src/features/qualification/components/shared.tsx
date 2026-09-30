/**
 * Presentation pieces shared by the qualification screens: status chips, evidence snapshots (the submitted edition
 * never changes; later expiry only flags it, BR-25), information requests with their official due time, decision
 * terms, and the active bids and contracts a status change affects (AC-09).
 */
import type { ReactNode } from 'react';

import type {
  EvidenceSnapshot,
  ImpactedBid,
  ImpactedContract,
  InfoRequest,
} from '@contracts/qualification';
import type {
  QualificationDecisionsOutcome,
  VQualificationStatusEffectiveStatus,
} from '@contracts/enums';

import {
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  OfficialDeadline,
  OrDash,
  Reference,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';

export function EffectiveStatusChip({
  status,
  size,
}: {
  readonly status: VQualificationStatusEffectiveStatus;
  readonly size?: 'sm' | 'md';
}) {
  return <StatusChip enum="v_qualification_status.effective_status" value={status} size={size} />;
}

export function OutcomeChip({ outcome }: { readonly outcome: QualificationDecisionsOutcome }) {
  return <StatusChip enum="qualification_decisions.outcome" value={outcome} />;
}

/** "Expires in 8 days" / "Expired 12 days ago" chip for a decision or evidence date. */
export function ExpiryChip({ days }: { readonly days: number | null }) {
  if (days === null) return null;
  if (days < 0) {
    return (
      <Chip tone="danger" size="sm" icon="alertCircle">
        {t('qualification.common.expiredAgo', { count: -days })}
      </Chip>
    );
  }
  if (days <= 90) {
    return (
      <Chip tone="warning" size="sm" icon="hourglass">
        {t('qualification.common.expiresIn', { count: days })}
      </Chip>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------------------------------------

function periodText(item: EvidenceSnapshot): string {
  if (item.periodStart === null && item.periodEnd === null) return '';
  return t('qualification.evidence.period', {
    from: formatCalendarDate(item.periodStart),
    to: formatCalendarDate(item.periodEnd),
  });
}

export function EvidenceTable({
  evidence,
  timeZone,
  caption,
}: {
  readonly evidence: readonly EvidenceSnapshot[];
  readonly timeZone: string;
  readonly caption: string;
}) {
  const columns: DataTableColumn<EvidenceSnapshot>[] = [
    {
      id: 'title',
      header: t('qualification.evidence.col.title'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {[tEnum('evidence_items.evidence_type', row.evidenceType), row.fileName].join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'issuer',
      header: t('qualification.evidence.col.issuer'),
      cell: (row) => (
        <>
          <OrDash>{row.issuer}</OrDash>
          {row.referenceNumber !== null && (
            <span className="tiq-cell-sub">{row.referenceNumber}</span>
          )}
        </>
      ),
    },
    {
      id: 'period',
      header: t('qualification.evidence.col.period'),
      cell: (row) => (
        <>
          <OrDash>{periodText(row)}</OrDash>
          {(row.reportingCurrency !== null || row.isConsolidated !== null) && (
            <span className="tiq-cell-sub">
              {[
                row.reportingCurrency,
                row.isConsolidated === null
                  ? null
                  : row.isConsolidated
                    ? t('qualification.evidence.consolidated')
                    : t('qualification.evidence.standalone'),
              ]
                .filter((part): part is string => part !== null)
                .join(' · ')}
            </span>
          )}
          {row.coverageAmount !== null && (
            <span className="tiq-cell-sub">
              {t('qualification.evidence.coverage', { value: formatMoney(row.coverageAmount) })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'expiresAt',
      header: t('qualification.evidence.col.expires'),
      cell: (row) => (
        <OrDash>{row.expiresAt === null ? null : formatCalendarDate(row.expiresAt)}</OrDash>
      ),
    },
    {
      id: 'status',
      header: t('qualification.evidence.col.status'),
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip
            enum="evidence_items.verification_status"
            value={row.verificationStatus}
            size="sm"
          />
          {row.expiredSinceSubmission && (
            <Chip tone="danger" size="sm" icon="alertCircle">
              {t('qualification.evidence.expiredSince')}
            </Chip>
          )}
          {row.replacedSinceSubmission && (
            <Chip tone="info" size="sm" icon="refresh">
              {t('qualification.evidence.replacedSince')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'submittedAt',
      header: t('qualification.evidence.col.submitted'),
      cell: (row) => formatDateTime(row.submittedAt, timeZone),
    },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={evidence}
      rowKey={(row) => String(row.evidenceSubmissionId)}
      empty={<EmptyState compact title={t('qualification.evidence.none')} />}
    />
  );
}

/** A compact list of evidence snapshots inside a criterion card. */
export function EvidenceChips({ evidence }: { readonly evidence: readonly EvidenceSnapshot[] }) {
  if (evidence.length === 0) return null;
  return (
    <div role="list" className="tiq-stack" aria-label={t('qualification.evidence.listLabel')}>
      {evidence.map((item) => (
        <div role="listitem" key={item.evidenceSubmissionId} className="tiq-inline">
          <span>{item.title}</span>
          <span className="tiq-text-muted">
            {[
              tEnum('evidence_items.evidence_type', item.evidenceType),
              periodText(item),
              item.expiresAt === null
                ? ''
                : t('qualification.evidence.expiresOn', {
                    date: formatCalendarDate(item.expiresAt),
                  }),
            ]
              .filter((part) => part !== '')
              .join(' · ')}
          </span>
          {item.expiredSinceSubmission && (
            <Chip tone="danger" size="sm">
              {t('qualification.evidence.expiredSince')}
            </Chip>
          )}
          {item.replacedSinceSubmission && (
            <Chip tone="info" size="sm">
              {t('qualification.evidence.replacedSince')}
            </Chip>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Information requests
// ---------------------------------------------------------------------------------------------------------

export function InfoRequestItem({
  request,
  timeZone,
  actions,
}: {
  readonly request: InfoRequest;
  readonly timeZone: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div
      role="listitem"
      className="tiq-card tiq-stack"
      aria-label={t('qualification.infoRequests.itemLabel', { id: request.id })}
    >
      <div className="tiq-inline">
        <StatusChip enum="qualification_info_requests.status" value={request.status} size="sm" />
        {request.area !== null && (
          <Chip tone="neutral" size="sm">
            {tEnum('qualification_criteria.area', request.area)}
          </Chip>
        )}
        <span className="tiq-text-muted">
          {t('qualification.infoRequests.askedBy', {
            name: request.requestedBy.fullName,
            at: formatDateTime(request.requestedAt, timeZone),
          })}
        </span>
      </div>
      {request.criterionQuestion !== null && (
        <p className="tiq-text-muted">{request.criterionQuestion}</p>
      )}
      <p>{request.question}</p>
      <OfficialDeadline
        deadline={request.dueAt}
        label={t('qualification.infoRequests.due')}
        variant="inline"
        showRemaining={request.status === 'open'}
      />
      {request.responseText !== null && (
        <DetailList
          stacked
          items={[
            { label: t('qualification.infoRequests.response'), value: request.responseText },
            {
              label: t('qualification.infoRequests.respondedBy'),
              value:
                request.respondedBy === null
                  ? null
                  : `${request.respondedBy.fullName} · ${formatDateTime(request.respondedAt, timeZone)}`,
            },
          ]}
        />
      )}
      <EvidenceChips evidence={request.responseEvidence} />
      {actions !== undefined && <div className="tiq-inline">{actions}</div>}
    </div>
  );
}

export function InfoRequestList({
  requests,
  timeZone,
  renderActions,
}: {
  readonly requests: readonly InfoRequest[];
  readonly timeZone: string;
  readonly renderActions?: (request: InfoRequest) => ReactNode;
}) {
  if (requests.length === 0) {
    return <EmptyState compact title={t('qualification.infoRequests.none')} />;
  }
  return (
    <div role="list" className="tiq-stack">
      {requests.map((request) => (
        <InfoRequestItem
          key={request.id}
          request={request}
          timeZone={timeZone}
          actions={renderActions?.(request)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Impacts (AC-09)
// ---------------------------------------------------------------------------------------------------------

export function ImpactTables({
  bids,
  contracts,
}: {
  readonly bids: readonly ImpactedBid[];
  readonly contracts: readonly ImpactedContract[];
}) {
  const bidColumns: DataTableColumn<ImpactedBid>[] = [
    {
      id: 'reference',
      header: t('qualification.impacts.col.tender'),
      cell: (row) => (
        <>
          <Reference value={row.reference} to={row.link} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'tenderStatus',
      header: t('qualification.impacts.col.tenderStatus'),
      cell: (row) => <StatusChip enum="tenders.status" value={row.tenderStatus} size="sm" />,
    },
    {
      id: 'submission',
      header: t('qualification.impacts.col.submission'),
      cell: (row) => tEnum('bids.submission_state', row.submissionState),
    },
    {
      id: 'gate',
      header: t('qualification.impacts.col.gate'),
      cell: (row) => (
        <StatusChip
          enum="participants.qualification_gate"
          value={row.qualificationGate}
          size="sm"
        />
      ),
    },
    {
      id: 'nextGate',
      header: t('qualification.impacts.col.nextGate'),
      cell: (row) => <OrDash>{row.nextGate}</OrDash>,
    },
  ];
  const contractColumns: DataTableColumn<ImpactedContract>[] = [
    {
      id: 'reference',
      header: t('qualification.impacts.col.contract'),
      cell: (row) => (
        <>
          <Reference value={row.reference} to={row.link} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('qualification.impacts.col.contractStatus'),
      cell: (row) => <StatusChip enum="contracts.status" value={row.status} size="sm" />,
    },
  ];
  return (
    <div className="tiq-stack">
      <DataTable
        caption={t('qualification.impacts.bidsCaption')}
        columns={bidColumns}
        rows={bids}
        rowKey={(row) => String(row.tenderId)}
        empty={<EmptyState compact title={t('qualification.impacts.noBids')} />}
      />
      <DataTable
        caption={t('qualification.impacts.contractsCaption')}
        columns={contractColumns}
        rows={contracts}
        rowKey={(row) => String(row.contractId)}
        empty={<EmptyState compact title={t('qualification.impacts.noContracts')} />}
      />
    </div>
  );
}
