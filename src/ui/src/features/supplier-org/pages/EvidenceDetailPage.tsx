/**
 * SUP-05 — one evidence item: its details, every edition of its lineage, the buyers it is shared with, and where each
 * edition was formally submitted. Actions: replace prospectively (a new edition; earlier submissions keep the edition
 * they used), renew (a new validity period), withdraw the item, share it with a buyer, and withdraw future sharing per
 * buyer (earlier formal submissions stay in that buyer's record, FR-02). Financial evidence is restricted to
 * `supplier.financial.view` members.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import type { FieldError } from '@contracts/common';
import { RenewEvidenceBody, ReplaceEvidenceBody, suppliersEndpoints } from '@contracts/suppliers';
import type {
  EvidenceDetail,
  EvidenceItem,
  EvidenceShare,
  EvidenceSubmission,
} from '@contracts/suppliers';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DetailList,
  EmptyState,
  ErrorState,
  MoneyInput,
  MoneyText,
  OrDash,
  PageHeader,
  RestrictedState,
  Select,
  SkeletonBlock,
  StatusChip,
  TextField,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { EvidenceFields } from '../components/EvidenceFields';
import { EvidenceUploadField } from '../components/EvidenceUploadField';
import type { UploadedDocument } from '../components/EvidenceUploadField';
import { DocumentLink, FreshnessChip } from '../components/SupplierBits';
import { isFinancialRestriction, withSupplierMessage } from '../lib/errors';
import {
  draftFromItem,
  effectiveCurrency,
  evidenceErrors,
  evidenceFields,
} from '../lib/evidenceForm';
import type { EvidenceDraft } from '../lib/evidenceForm';
import {
  useCommandResult,
  useDeferredNavigate,
  useIdParam,
  useEvidenceCurrencies,
  useOfficialTimeZone,
} from '../lib/hooks';
import { textOrNull } from '../lib/lists';
import { supplierOrgPaths } from '../lib/paths';
import { EVIDENCE_MANAGE, EVIDENCE_SHARE } from '../lib/permissions';
import { errorLookup, validateWith } from '../lib/validation';

interface ArrivalState {
  readonly record?: EvidenceItem;
  readonly added?: boolean;
  readonly edition?: {
    readonly kind: 'replaced' | 'renewed';
    readonly previousId: number;
    readonly carriedShareCount: number;
    readonly retainedSubmissionCount: number;
  };
}

/** A detail built from a command result, for an edition the static prototype cannot fetch again. */
function detailFromItem(item: EvidenceItem): EvidenceDetail {
  return {
    ...item,
    editions: [
      {
        id: item.id,
        editionNo: item.editionNo,
        status: item.status,
        validFrom: item.validFrom,
        expiresAt: item.expiresAt,
        document: item.document,
        createdAt: item.createdAt,
      },
    ],
    shares: item.activeShares.map((share) => ({
      id: share.shareId,
      buyer: share.buyer,
      sharedAt: share.sharedAt,
      sharedBy: item.createdBy,
      withdrawnAt: null,
      withdrawnBy: null,
    })),
    submissions: [],
  };
}

export default function EvidenceDetailPage() {
  const evidenceId = useIdParam('evidenceId');
  const location = useLocation();
  const arrival = (location.state as ArrivalState | null) ?? {};
  const [seeded] = useCommandResult<EvidenceItem>(evidenceId);
  const query = useApiQuery(
    suppliersEndpoints.getEvidence,
    evidenceId === null ? null : { params: { evidenceId } },
  );
  const back = { to: supplierOrgPaths.evidence, label: t('supplier-org.evidenceForm.back') };

  const detail: EvidenceDetail | undefined =
    query.data ??
    (seeded !== null && query.status === 'error' ? detailFromItem(seeded) : undefined);

  if (detail === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('supplier-org.evidenceDetail.title')} back={back} />
        {query.error !== null && isFinancialRestriction(query.error) ? (
          <RestrictedState
            title={t('supplier-org.evidenceDetail.financialTitle')}
            description={t('supplier-org.evidence.financialRestricted')}
          />
        ) : query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : evidenceId === null ? (
          <Banner tone="error" title={t('supplier-org.evidenceDetail.notFound')} />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }
  return <EvidenceView key={detail.id} detail={detail} arrival={arrival} back={back} />;
}

type Action = 'replace' | 'renew' | 'withdraw' | 'share' | null;

function EvidenceView({
  detail,
  arrival,
  back,
}: {
  readonly detail: EvidenceDetail;
  readonly arrival: ArrivalState;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const zone = useOfficialTimeZone();
  const toast = useToast();
  const canManage = usePermission(EVIDENCE_MANAGE);
  const canShare = usePermission(EVIDENCE_SHARE);
  const canHoldFinancial = usePermission('supplier.financial.view');
  const [item, setItem] = useState<EvidenceItem>(detail);
  const [shares, setShares] = useState<readonly EvidenceShare[]>(detail.shares);
  const [action, setAction] = useState<Action>(null);
  const [endingShare, setEndingShare] = useState<EvidenceShare | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const isLatest = item.replacedById === null;
  const isCurrent = item.status === 'current' && isLatest;
  const renewable = isCurrent && item.expiresAt !== null;
  const nextAction = !isLatest
    ? t('supplier-org.evidenceDetail.next.replaced')
    : item.status === 'withdrawn'
      ? t('supplier-org.evidenceDetail.next.withdrawn')
      : item.freshness === 'expired'
        ? t('supplier-org.evidenceDetail.next.expired')
        : item.freshness === 'expiring_soon'
          ? t('supplier-org.evidenceDetail.next.expiring')
          : item.activeShares.length === 0 && shares.every((share) => share.withdrawnAt !== null)
            ? t('supplier-org.evidenceDetail.next.share')
            : t('supplier-org.evidenceDetail.next.none');

  const shareColumns: DataTableColumn<EvidenceShare>[] = [
    {
      id: 'buyer',
      header: t('supplier-org.evidenceDetail.col.buyer'),
      cell: (row) => row.buyer.tenantName,
    },
    {
      id: 'shared',
      header: t('supplier-org.evidenceDetail.col.shared'),
      cell: (row) => (
        <>
          <span>{formatDateTime(row.sharedAt, zone)}</span>
          <span className="tiq-cell-sub">{row.sharedBy.fullName}</span>
        </>
      ),
    },
    {
      id: 'state',
      header: t('supplier-org.evidenceDetail.col.shareState'),
      cell: (row) =>
        row.withdrawnAt === null ? (
          <Chip tone="success" size="sm">
            {t('supplier-org.evidenceDetail.shareActive')}
          </Chip>
        ) : (
          <>
            <span className="tiq-text-muted">
              {t('supplier-org.evidenceDetail.shareWithdrawn', {
                at: formatDateTime(row.withdrawnAt, zone),
              })}
            </span>
            {row.withdrawnBy !== null && (
              <span className="tiq-cell-sub">{row.withdrawnBy.fullName}</span>
            )}
          </>
        ),
    },
    {
      id: 'actions',
      header: t('supplier-org.evidenceDetail.col.actions'),
      cell: (row) =>
        canShare && row.withdrawnAt === null ? (
          <Button size="sm" onClick={() => setEndingShare(row)}>
            {t('supplier-org.evidenceDetail.withdrawShare')}
          </Button>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  const submissionColumns: DataTableColumn<EvidenceSubmission>[] = [
    {
      id: 'context',
      header: t('supplier-org.evidenceDetail.col.context'),
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.contextReference}</span>
          <span className="tiq-cell-sub">{row.contextTitle}</span>
        </>
      ),
    },
    {
      id: 'type',
      header: t('supplier-org.evidenceDetail.col.contextType'),
      cell: (row) => tEnum('evidence_submissions.context_type', row.contextType),
    },
    {
      id: 'buyer',
      header: t('supplier-org.evidenceDetail.col.buyer'),
      cell: (row) => row.buyer.tenantName,
    },
    {
      id: 'edition',
      header: t('supplier-org.evidenceDetail.col.edition'),
      numeric: true,
      cell: (row) => t('supplier-org.evidence.editionNo', { no: row.editionNo }),
    },
    {
      id: 'submittedAt',
      header: t('supplier-org.evidenceDetail.col.submittedAt'),
      cell: (row) => formatDateTime(row.submittedAt, zone),
    },
  ];

  type Edition = EvidenceDetail['editions'][number];
  const editionColumns: DataTableColumn<Edition>[] = [
    {
      id: 'edition',
      header: t('supplier-org.evidenceDetail.col.edition'),
      cell: (row) =>
        row.id === item.id ? (
          <strong>{t('supplier-org.evidence.editionNo', { no: row.editionNo })}</strong>
        ) : (
          <Link to={supplierOrgPaths.evidenceItem(row.id)}>
            {t('supplier-org.evidence.editionNo', { no: row.editionNo })}
          </Link>
        ),
    },
    {
      id: 'status',
      header: t('supplier-org.evidence.col.status'),
      cell: (row) => <StatusChip enum="evidence_items.status" value={row.status} />,
    },
    {
      id: 'validity',
      header: t('supplier-org.evidenceDetail.col.validity'),
      cell: (row) =>
        t('supplier-org.evidence.range', {
          from: row.validFrom === null ? '—' : formatCalendarDate(row.validFrom),
          to:
            row.expiresAt === null
              ? t('supplier-org.evidence.noExpiry')
              : formatCalendarDate(row.expiresAt),
        }),
    },
    {
      id: 'document',
      header: t('supplier-org.evidenceDetail.col.document'),
      cell: (row) => <DocumentLink document={row.document} />,
    },
    {
      id: 'created',
      header: t('supplier-org.evidenceDetail.col.created'),
      cell: (row) => formatDateTime(row.createdAt, zone),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={item.title}
        back={back}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="evidence_items.status" value={item.status} />
            <FreshnessChip value={item.freshness} />
            <span>{t('supplier-org.evidence.editionNo', { no: item.editionNo })}</span>
            {item.expiresAt !== null && (
              <span>
                {t('supplier-org.evidenceDetail.expires', {
                  date: formatCalendarDate(item.expiresAt),
                })}
              </span>
            )}
            <span className="tiq-text-muted">
              {t('supplier-org.evidenceDetail.nextLabel', { next: nextAction })}
            </span>
          </span>
        }
        primaryAction={
          canManage && renewable ? (
            <Button variant="primary" icon="refresh" onClick={() => setAction('renew')}>
              {t('supplier-org.evidenceDetail.renew')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canShare && isCurrent && (
              <Button icon="send" onClick={() => setAction('share')}>
                {t('supplier-org.evidenceDetail.share')}
              </Button>
            )}
            {canManage && isCurrent && (
              <Button icon="repeat" onClick={() => setAction('replace')}>
                {t('supplier-org.evidenceDetail.replace')}
              </Button>
            )}
            {canManage && isCurrent && (
              <Button variant="danger" icon="archive" onClick={() => setAction('withdraw')}>
                {t('supplier-org.evidenceDetail.withdraw')}
              </Button>
            )}
          </>
        }
      />
      {arrival.added === true && (
        <Banner tone="success" title={t('supplier-org.evidenceDetail.addedTitle')}>
          <p>{t('supplier-org.evidenceForm.savedNotShared')}</p>
        </Banner>
      )}
      {arrival.edition !== undefined && (
        <Banner
          tone="success"
          title={t(`supplier-org.evidenceDetail.${arrival.edition.kind}Title`)}
        >
          <p>
            {t('supplier-org.evidenceDetail.editionOutcome', {
              carried: arrival.edition.carriedShareCount,
              retained: arrival.edition.retainedSubmissionCount,
            })}
          </p>
          <Link to={supplierOrgPaths.evidenceItem(arrival.edition.previousId)}>
            {t('supplier-org.evidenceDetail.openPrevious')}
          </Link>
        </Banner>
      )}
      {outcome !== null && (
        <Banner tone="success" title={t('supplier-org.evidenceDetail.doneTitle')}>
          <p>{outcome}</p>
        </Banner>
      )}
      {!isLatest && item.replacedById !== null && (
        <Banner tone="warning" title={t('supplier-org.evidenceDetail.replacedTitle2')}>
          <p>{t('supplier-org.evidenceDetail.replacedText')}</p>
          <Link to={supplierOrgPaths.evidenceItem(item.replacedById)}>
            {t('supplier-org.evidenceDetail.openCurrent')}
          </Link>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('supplier-org.evidenceDetail.detailsCard')}>
          <DetailList
            items={[
              {
                key: 'type',
                label: t('supplier-org.evidenceForm.type'),
                value: tEnum('evidence_items.evidence_type', item.evidenceType),
              },
              { key: 'issuer', label: t('supplier-org.evidenceForm.issuer'), value: item.issuer },
              {
                key: 'reference',
                label: t('supplier-org.evidenceForm.reference'),
                value:
                  item.referenceNumber === null ? null : (
                    <span className="tiq-mono">{item.referenceNumber}</span>
                  ),
              },
              {
                key: 'period',
                label: t('supplier-org.evidenceDetail.period'),
                value:
                  item.periodStart === null || item.periodEnd === null
                    ? null
                    : t('supplier-org.evidence.range', {
                        from: formatCalendarDate(item.periodStart),
                        to: formatCalendarDate(item.periodEnd),
                      }),
              },
              {
                key: 'currency',
                label: t('supplier-org.evidenceForm.currency'),
                value: item.reportingCurrency,
              },
              {
                key: 'consolidated',
                label: t('supplier-org.evidenceForm.consolidated'),
                value:
                  item.isConsolidated === null
                    ? null
                    : item.isConsolidated
                      ? t('supplier-org.evidenceForm.consolidatedYes')
                      : t('supplier-org.evidenceForm.consolidatedNo'),
              },
              {
                key: 'coverage',
                label: t('supplier-org.evidenceForm.coverage'),
                value: item.coverage === null ? null : <MoneyText value={item.coverage} />,
              },
              {
                key: 'validity',
                label: t('supplier-org.evidenceDetail.col.validity'),
                value: t('supplier-org.evidence.range', {
                  from: item.validFrom === null ? '—' : formatCalendarDate(item.validFrom),
                  to:
                    item.expiresAt === null
                      ? t('supplier-org.evidence.noExpiry')
                      : formatCalendarDate(item.expiresAt),
                }),
              },
              {
                key: 'document',
                label: t('supplier-org.evidenceDetail.col.document'),
                value: <DocumentLink document={item.document} />,
              },
            ]}
          />
        </Card>
        <Card title={t('supplier-org.evidenceDetail.statusCard')}>
          <DetailList
            items={[
              {
                key: 'status',
                label: t('supplier-org.evidence.col.status'),
                value: <StatusChip enum="evidence_items.status" value={item.status} />,
              },
              {
                key: 'freshness',
                label: t('supplier-org.evidence.filter.freshness'),
                value: <FreshnessChip value={item.freshness} />,
              },
              {
                key: 'verification',
                label: t('supplier-org.evidenceDetail.verification'),
                value: (
                  <StatusChip
                    enum="evidence_items.verification_status"
                    value={item.verificationStatus}
                  />
                ),
              },
              {
                key: 'sensitivity',
                label: t('supplier-org.evidenceForm.sensitivity'),
                value: <StatusChip enum="evidence_items.sensitivity" value={item.sensitivity} />,
              },
              {
                key: 'created',
                label: t('supplier-org.evidenceDetail.col.created'),
                value: `${item.createdBy.fullName} · ${formatDateTime(item.createdAt, zone)}`,
              },
              {
                key: 'replaces',
                label: t('supplier-org.evidenceDetail.replaces'),
                value:
                  item.replacesId === null ? null : (
                    <Link to={supplierOrgPaths.evidenceItem(item.replacesId)}>
                      {t('supplier-org.evidenceDetail.previousEdition')}
                    </Link>
                  ),
              },
            ]}
          />
        </Card>
      </div>
      <Card
        flush
        title={t('supplier-org.evidenceDetail.submissionsTitle')}
        subtitle={t('supplier-org.evidenceDetail.submissionsHint')}
      >
        <DataTable
          caption={t('supplier-org.evidenceDetail.submissionsTitle')}
          columns={submissionColumns}
          rows={detail.submissions}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('supplier-org.evidenceDetail.noSubmissions')} />}
        />
      </Card>
      <Card
        flush
        title={t('supplier-org.evidenceDetail.sharingTitle')}
        subtitle={t('supplier-org.evidenceDetail.sharingHint')}
      >
        <DataTable
          caption={t('supplier-org.evidenceDetail.sharingTitle')}
          columns={shareColumns}
          rows={shares}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('supplier-org.evidenceDetail.noShares')} />}
        />
      </Card>
      <Card
        flush
        title={t('supplier-org.evidenceDetail.editionsTitle')}
        subtitle={t('supplier-org.evidenceDetail.editionsHint')}
      >
        <DataTable
          caption={t('supplier-org.evidenceDetail.editionsTitle')}
          columns={editionColumns}
          rows={detail.editions}
          rowKey={(row) => String(row.id)}
        />
      </Card>

      {action === 'replace' && (
        <ReplaceDialog
          item={item}
          canHoldFinancial={canHoldFinancial}
          onClose={() => setAction(null)}
        />
      )}
      {action === 'renew' && <RenewDialog item={item} onClose={() => setAction(null)} />}
      {action === 'withdraw' && (
        <WithdrawDialog
          item={item}
          onClose={() => setAction(null)}
          onDone={(updated, message) => {
            setItem(updated);
            setShares((current) =>
              current.map((share) =>
                share.withdrawnAt === null ? { ...share, withdrawnAt: updated.updatedAt } : share,
              ),
            );
            setAction(null);
            setOutcome(message);
            toast.show(t('supplier-org.evidenceDetail.withdrawn'), 'success');
          }}
        />
      )}
      {action === 'share' && (
        <ShareDialog
          item={item}
          activeBuyerIds={shares
            .filter((share) => share.withdrawnAt === null)
            .map((share) => share.buyer.tenantId)}
          onClose={() => setAction(null)}
          onDone={(share) => {
            setShares((current) => [...current, share]);
            setAction(null);
            setOutcome(
              t('supplier-org.evidenceDetail.sharedWith', { buyer: share.buyer.tenantName }),
            );
            toast.show(t('supplier-org.evidenceDetail.shared'), 'success');
          }}
        />
      )}
      {endingShare !== null && (
        <WithdrawShareDialog
          item={item}
          share={endingShare}
          onClose={() => setEndingShare(null)}
          onDone={(share, message) => {
            setShares((current) => current.map((row) => (row.id === share.id ? share : row)));
            setEndingShare(null);
            setOutcome(message);
            toast.show(t('supplier-org.evidenceDetail.shareEnded'), 'success');
          }}
        />
      )}
    </div>
  );
}

const EDITION_FIELDS = [
  'title',
  'issuer',
  'referenceNumber',
  'periodStart',
  'periodEnd',
  'reportingCurrency',
  'isConsolidated',
  'coverage',
  'validFrom',
  'expiresAt',
  'documentId',
  'reason',
] as const;

function ReplaceDialog({
  item,
  canHoldFinancial,
  onClose,
}: {
  readonly item: EvidenceItem;
  readonly canHoldFinancial: boolean;
  readonly onClose: () => void;
}) {
  const leave = useDeferredNavigate();
  const replace = useApiMutation(suppliersEndpoints.replaceEvidence);
  const currencies = useEvidenceCurrencies();
  const [draft, setDraft] = useState<EvidenceDraft>(() => draftFromItem(item));
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, replace.error, EDITION_FIELDS);

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-org.evidenceDetail.replaceTitle')}
      scope={t('supplier-org.evidenceDetail.replaceScope', {
        title: item.title,
        no: item.editionNo,
      })}
      consequence={t('supplier-org.evidenceDetail.replaceResult', { count: item.submissionCount })}
      confirmLabel={t('supplier-org.evidenceDetail.replace')}
      reason={{ label: t('supplier-org.evidenceDetail.replaceReason'), required: true }}
      pending={replace.pending}
      error={withSupplierMessage(replace.error)}
      onCancel={() => {
        replace.reset();
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        const body = { ...evidenceFields(draft, currencies.defaultCurrency), reason };
        const found = evidenceErrors(
          ReplaceEvidenceBody,
          { ...body, evidenceType: item.evidenceType },
          draft.document !== null,
        );
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await replace.mutate({ params: { evidenceId: item.id }, body });
          invalidateApiQueries('supplier.suppliers.evidence.');
          leave(supplierOrgPaths.evidenceItem(result.current.id), {
            record: result.current,
            edition: {
              kind: 'replaced',
              previousId: result.previous.id,
              carriedShareCount: result.carriedShareCount,
              retainedSubmissionCount: result.retainedSubmissionCount,
            },
          });
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <EvidenceFields
        draft={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        errorFor={errors.forField}
        editableKind={false}
        canHoldFinancial={canHoldFinancial}
        upload={{ relatedType: 'evidence_item', relatedId: item.id }}
        currencies={currencies.codes}
        defaultCurrency={currencies.defaultCurrency}
      />
    </ConfirmActionDialog>
  );
}

function RenewDialog({
  item,
  onClose,
}: {
  readonly item: EvidenceItem;
  readonly onClose: () => void;
}) {
  const leave = useDeferredNavigate();
  const renew = useApiMutation(suppliersEndpoints.renewEvidence);
  const currencies = useEvidenceCurrencies();
  const [validFrom, setValidFrom] = useState(item.expiresAt ?? '');
  const [expiresAt, setExpiresAt] = useState('');
  const [reference, setReference] = useState(item.referenceNumber ?? '');
  const [coverage, setCoverage] = useState(
    item.coverage === null ? { amount: '', currency: '' } : { ...item.coverage },
  );
  const coverageValue = {
    amount: coverage.amount,
    currency: effectiveCurrency(coverage.currency, currencies.defaultCurrency),
  };
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, renew.error, [
    'validFrom',
    'expiresAt',
    'referenceNumber',
    'coverage',
    'documentId',
  ]);

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-org.evidenceDetail.renewTitle')}
      scope={t('supplier-org.evidenceDetail.replaceScope', {
        title: item.title,
        no: item.editionNo,
      })}
      consequence={t('supplier-org.evidenceDetail.renewResult')}
      confirmLabel={t('supplier-org.evidenceDetail.renew')}
      pending={renew.pending}
      error={withSupplierMessage(renew.error)}
      onCancel={() => {
        renew.reset();
        onClose();
      }}
      onConfirm={async () => {
        const body = {
          validFrom,
          expiresAt,
          referenceNumber: textOrNull(reference),
          coverage: coverage.amount.trim() === '' ? null : coverageValue,
          documentId: document?.documentId ?? 0,
        };
        const found = validateWith(RenewEvidenceBody, body)
          .filter((entry) => entry.field !== 'documentId')
          .concat(
            document === null
              ? [
                  {
                    field: 'documentId',
                    code: 'DOCUMENT_REQUIRED',
                    message: t('supplier-org.evidenceForm.documentRequired'),
                  },
                ]
              : [],
          );
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await renew.mutate({ params: { evidenceId: item.id }, body });
          invalidateApiQueries('supplier.suppliers.evidence.');
          leave(supplierOrgPaths.evidenceItem(result.current.id), {
            record: result.current,
            edition: {
              kind: 'renewed',
              previousId: result.previous.id,
              carriedShareCount: result.carriedShareCount,
              retainedSubmissionCount: result.retainedSubmissionCount,
            },
          });
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <div className="tiq-stack">
        <div className="tiq-form-grid">
          <DateInput
            label={t('supplier-org.evidenceForm.validFrom')}
            required
            value={validFrom}
            onChange={setValidFrom}
            error={errors.forField('validFrom')}
          />
          <DateInput
            label={t('supplier-org.evidenceForm.expiresAt')}
            required
            value={expiresAt}
            onChange={setExpiresAt}
            error={errors.forField('expiresAt')}
          />
          <TextField
            label={t('supplier-org.evidenceForm.reference')}
            value={reference}
            onChange={setReference}
            error={errors.forField('referenceNumber')}
          />
          <MoneyInput
            label={t('supplier-org.evidenceForm.coverage')}
            value={coverageValue}
            currencies={currencies.codes}
            onChange={(value) => setCoverage({ ...value })}
            error={errors.forField('coverage')}
          />
        </div>
        <EvidenceUploadField
          relatedType="evidence_item"
          relatedId={item.id}
          title={item.title}
          value={document}
          onChange={setDocument}
          error={errors.forField('documentId')}
        />
      </div>
    </ConfirmActionDialog>
  );
}

function WithdrawDialog({
  item,
  onClose,
  onDone,
}: {
  readonly item: EvidenceItem;
  readonly onClose: () => void;
  readonly onDone: (item: EvidenceItem, message: string) => void;
}) {
  const withdraw = useApiMutation(suppliersEndpoints.withdrawEvidence);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('supplier-org.evidenceDetail.withdrawTitle')}
      scope={t('supplier-org.evidenceDetail.replaceScope', {
        title: item.title,
        no: item.editionNo,
      })}
      consequence={t('supplier-org.evidenceDetail.withdrawResult', {
        shares: item.activeShares.length,
        submissions: item.submissionCount,
      })}
      confirmLabel={t('supplier-org.evidenceDetail.withdraw')}
      reason={{ label: t('supplier-org.evidenceDetail.withdrawReason'), required: true }}
      pending={withdraw.pending}
      error={withSupplierMessage(withdraw.error)}
      onCancel={() => {
        withdraw.reset();
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        try {
          const result = await withdraw.mutate({
            params: { evidenceId: item.id },
            body: { reason },
          });
          invalidateApiQueries('supplier.suppliers.evidence.');
          onDone(
            result.item,
            t('supplier-org.evidenceDetail.withdrawOutcome', {
              ended: result.endedShareCount,
              retained: result.retainedSubmissionCount,
            }),
          );
        } catch {
          // The dialog shows the error.
        }
      }}
    />
  );
}

function ShareDialog({
  item,
  activeBuyerIds,
  onClose,
  onDone,
}: {
  readonly item: EvidenceItem;
  readonly activeBuyerIds: readonly number[];
  readonly onClose: () => void;
  readonly onDone: (share: EvidenceShare) => void;
}) {
  const buyers = useApiQuery(suppliersEndpoints.sharingBuyers, {});
  const share = useApiMutation(suppliersEndpoints.shareEvidence);
  const [buyerId, setBuyerId] = useState('');
  const [missing, setMissing] = useState(false);
  const options = (buyers.data?.items ?? []).filter(
    (row) => !activeBuyerIds.includes(row.buyer.tenantId),
  );
  const chosen = options.find((row) => String(row.buyer.tenantId) === buyerId);
  return (
    <ConfirmActionDialog
      open
      title={t('supplier-org.evidenceDetail.shareTitle')}
      scope={t('supplier-org.evidenceDetail.shareScope', {
        title: item.title,
        buyer: chosen?.buyer.tenantName ?? t('supplier-org.evidenceDetail.chooseBuyer'),
      })}
      consequence={t('supplier-org.evidenceDetail.shareResult')}
      confirmLabel={t('supplier-org.evidenceDetail.share')}
      pending={share.pending}
      error={withSupplierMessage(share.error)}
      onCancel={() => {
        share.reset();
        onClose();
      }}
      onConfirm={async () => {
        if (chosen === undefined) {
          setMissing(true);
          return;
        }
        try {
          const result = await share.mutate({
            params: { evidenceId: item.id },
            body: { buyerTenantId: chosen.buyer.tenantId },
          });
          invalidateApiQueries('supplier.suppliers.');
          onDone(result);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      {buyers.status === 'error' && buyers.error !== null ? (
        <ErrorState error={buyers.error} onRetry={buyers.reload} />
      ) : options.length === 0 && buyers.data !== undefined ? (
        <EmptyState compact title={t('supplier-org.evidenceDetail.noMoreBuyers')} />
      ) : (
        <Select
          label={t('supplier-org.evidenceDetail.buyer')}
          required
          placeholder={t('supplier-org.evidenceDetail.chooseBuyer')}
          value={buyerId}
          options={options.map((row) => ({
            value: String(row.buyer.tenantId),
            label: row.hasParticipated
              ? t('supplier-org.evidenceDetail.buyerParticipated', { name: row.buyer.tenantName })
              : row.buyer.tenantName,
          }))}
          onChange={(value) => {
            setBuyerId(value);
            setMissing(false);
          }}
          error={missing ? t('supplier-org.evidenceDetail.buyerRequired') : undefined}
        />
      )}
    </ConfirmActionDialog>
  );
}

function WithdrawShareDialog({
  item,
  share,
  onClose,
  onDone,
}: {
  readonly item: EvidenceItem;
  readonly share: EvidenceShare;
  readonly onClose: () => void;
  readonly onDone: (share: EvidenceShare, message: string) => void;
}) {
  const withdraw = useApiMutation(suppliersEndpoints.withdrawShare);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('supplier-org.evidenceDetail.withdrawShareTitle', { buyer: share.buyer.tenantName })}
      scope={t('supplier-org.evidenceDetail.shareScope', {
        title: item.title,
        buyer: share.buyer.tenantName,
      })}
      consequence={t('supplier-org.evidenceDetail.withdrawShareResult')}
      confirmLabel={t('supplier-org.evidenceDetail.withdrawShare')}
      reason={{ label: t('supplier-org.evidenceDetail.withdrawShareReason'), required: false }}
      pending={withdraw.pending}
      error={withSupplierMessage(withdraw.error)}
      onCancel={() => {
        withdraw.reset();
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        try {
          const result = await withdraw.mutate({
            params: { evidenceId: item.id, shareId: share.id },
            body: reason === '' ? {} : { reason },
          });
          invalidateApiQueries('supplier.suppliers.');
          onDone(result.share, result.message);
        } catch {
          // The dialog shows the error.
        }
      }}
    />
  );
}
