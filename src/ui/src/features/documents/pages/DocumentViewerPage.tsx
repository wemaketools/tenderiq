/**
 * COM-07 — Document and evidence viewer: title, owner, version, classification, validity, related record and change
 * history. View, or download if permitted — sealed content is never downloadable before the authorized opening —
 * and released originals remain distinguishable from redacted copies (PRD §14.1). Authorized users add a new
 * version or release a redacted copy. Opened with `?version=<versionId>` (from an approval's evidence), the page
 * names that exact version and offers its download, so a decision is always read against the version it covered.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { getMyDocument, listMyDocumentVersions } from '@contracts/documents';
import type { DocumentDetail, DocumentRef } from '@contracts/documents';

import { invalidateApiQueries, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { HistoryTimeline } from '../../../components/audit';
import {
  ClassificationBadge,
  DocumentUploader,
  DocumentVersionHistory,
  DownloadVersionButton,
} from '../../../components/documents';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Reference,
  SkeletonBlock,
  StatusChip,
  useToast,
} from '../../../components/ui';
import { formatBytes, formatCalendarDate, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { useDisplayTimeZone, useIdParam } from '../../tasks/lib/shared';
import { RedactedCopyDialog } from '../components/RedactedCopyDialog';
import { documentPaths, languageName } from '../lib/documents';

/** The exact version a link asked for (`?version=`), with its download when the caller may download. */
function PinnedVersion({
  document,
  versionId,
}: {
  readonly document: DocumentDetail;
  readonly versionId: number;
}) {
  const timeZone = useDisplayTimeZone();
  const versions = useApiQuery(listMyDocumentVersions, { params: { documentId: document.id } });
  if (versions.data === undefined) {
    return versions.error === null ? (
      <SkeletonBlock lines={2} />
    ) : (
      <ErrorState error={versions.error} onRetry={versions.reload} />
    );
  }
  const version = versions.data.items.find((candidate) => candidate.id === versionId);
  if (version === undefined) {
    return (
      <Banner tone="warning" title={t('documents.viewer.pinned.missingTitle')}>
        {t('documents.viewer.pinned.missing')}
      </Banner>
    );
  }
  const latest = document.currentVersion;
  const superseded = latest !== null && latest.versionNo > version.versionNo;
  return (
    <Banner
      tone={superseded ? 'warning' : 'info'}
      title={t('documents.viewer.pinned.title', { version: version.versionNo })}
      actions={
        document.capabilities.canDownload && version.uploadStatus === 'confirmed' ? (
          <DownloadVersionButton
            documentId={document.id}
            versionId={version.id}
            fileName={version.fileName}
            label={t('documents.viewer.pinned.download', { version: version.versionNo })}
          />
        ) : undefined
      }
    >
      <span className="tiq-stack">
        <span>
          {t('documents.viewer.pinned.line', {
            file: version.fileName,
            size: formatBytes(version.sizeBytes),
            time: formatOfficialTime(version.createdAt, timeZone),
          })}
        </span>
        <span className="tiq-mono" title={version.sha256}>
          {t('documents.viewer.pinned.hash', { hash: version.sha256 })}
        </span>
        {superseded && (
          <span>{t('documents.viewer.pinned.superseded', { version: latest.versionNo })}</span>
        )}
      </span>
    </Banner>
  );
}

function DocumentView({ document }: { readonly document: DocumentDetail }) {
  const timeZone = useDisplayTimeZone();
  const [searchParams] = useSearchParams();
  const pinnedParam = Number(searchParams.get('version') ?? '');
  const pinnedVersionId = Number.isInteger(pinnedParam) && pinnedParam > 0 ? pinnedParam : null;
  const activeTenant = useActiveTenant();
  const canAudit = usePermission('audit.view');
  const toast = useToast();
  const now = useNow();
  const [dialog, setDialog] = useState<'upload' | 'redact' | null>(null);
  const [copies, setCopies] = useState<readonly DocumentRef[]>([]);
  const { capabilities } = document;
  const version = document.currentVersion;
  const activeId = activeTenant?.tenantId ?? null;
  const inOrganization =
    activeId !== null &&
    (activeId === document.organization.tenantId || activeId === document.ownerTenant.tenantId);
  const canUpload = capabilities.canUploadVersion && inOrganization;
  const canRedact =
    capabilities.canCreateRedactedCopy &&
    activeTenant?.kind === 'buyer' &&
    activeId === document.organization.tenantId;
  // Only a state of the record explains a missing download (sealed, no confirmed version, withdrawn); a download the
  // caller's access does not cover is simply not offered (DD-49).
  const reason = capabilities.downloadBlockedReason ?? null;
  const blocked =
    capabilities.canDownload || reason === 'classification_restricted' ? null : reason;
  const evidence = document.evidence;
  const allCopies = [...document.redactedCopies, ...copies];
  const today = new Date(now).toISOString().slice(0, 10);
  const expired = evidence !== null && evidence.expiresAt !== null && evidence.expiresAt < today;

  return (
    <div className="tiq-page">
      <PageHeader
        title={document.title}
        back={{ to: documentPaths.list, label: t('documents.viewer.back') }}
        subtitle={document.purpose ?? undefined}
        meta={
          <>
            <Chip tone="neutral" size="sm" icon="building">
              {document.organization.tenantName}
            </Chip>
            {document.relatedReference !== null && (
              <Reference value={document.relatedReference} to={document.relatedLinkPath} />
            )}
            <StatusChip enum="documents.status" value={document.status} />
            <ClassificationBadge
              classification={document.classification}
              redactedCopy={document.isRedactedCopy}
            />
            {!document.isRedactedCopy && document.redactedCopies.length > 0 && (
              <Chip tone="neutral-outlined" size="sm" icon="shield">
                {t('documents.viewer.original')}
              </Chip>
            )}
          </>
        }
        primaryAction={
          capabilities.canDownload && version !== null && version.uploadStatus === 'confirmed' ? (
            <DownloadVersionButton
              documentId={document.id}
              versionId={version.id}
              fileName={version.fileName}
              label={t('documents.viewer.download')}
            />
          ) : undefined
        }
        actions={
          <>
            {canUpload && (
              <Button icon="upload" onClick={() => setDialog('upload')}>
                {t('documents.viewer.uploadVersion')}
              </Button>
            )}
            {canRedact && (
              <Button icon="eyeOff" onClick={() => setDialog('redact')}>
                {t('documents.viewer.redact')}
              </Button>
            )}
          </>
        }
      />
      {pinnedVersionId !== null && (
        <PinnedVersion document={document} versionId={pinnedVersionId} />
      )}
      {blocked !== null && (
        <Banner
          tone={blocked === 'sealed' ? 'warning' : 'info'}
          title={t('documents.list.notDownloadable')}
        >
          {t(`documents.viewer.blocked.${blocked}`)}
        </Banner>
      )}
      {document.redactedFrom !== null && (
        <Banner
          tone="info"
          title={t('documents.viewer.redactedCopy')}
          actions={
            <ButtonLink
              to={documentPaths.document(document.redactedFrom.documentId)}
              size="sm"
              icon="arrowRight"
            >
              {t('documents.viewer.openOriginal')}
            </ButtonLink>
          }
        >
          {t('documents.viewer.redactedFrom', { title: document.redactedFrom.title })}
        </Banner>
      )}
      {(capabilities.canUploadVersion || capabilities.canCreateRedactedCopy) && !inOrganization && (
        <Banner tone="info">
          {t('documents.viewer.otherOrganization', {
            organization: document.organization.tenantName,
          })}
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card title={t('documents.viewer.details')}>
            <DetailList
              items={[
                { key: 'title', label: t('documents.viewer.title'), value: document.title },
                { key: 'purpose', label: t('documents.viewer.purpose'), value: document.purpose },
                {
                  key: 'owner',
                  label: t('documents.viewer.owner'),
                  value: document.owner?.fullName ?? null,
                },
                {
                  key: 'organization',
                  label: t('documents.viewer.organization'),
                  value: document.organization.tenantName,
                },
                {
                  key: 'ownerTenant',
                  label: t('documents.viewer.ownerTenant'),
                  value: document.ownerTenant.tenantName,
                },
                {
                  key: 'version',
                  label: t('documents.viewer.version'),
                  value:
                    version === null
                      ? t('documents.viewer.noVersion')
                      : t('documents.viewer.versionLine', {
                          version: version.versionNo,
                          count: document.versionCount,
                          file: version.fileName,
                          size: formatBytes(version.sizeBytes),
                        }),
                },
                {
                  key: 'classification',
                  label: t('documents.viewer.classification'),
                  value: (
                    <ClassificationBadge
                      classification={document.classification}
                      redactedCopy={document.isRedactedCopy}
                    />
                  ),
                },
                {
                  key: 'language',
                  label: t('documents.viewer.language'),
                  value: languageName(document.language),
                },
                {
                  key: 'status',
                  label: t('documents.viewer.status'),
                  value: <StatusChip enum="documents.status" value={document.status} size="sm" />,
                },
                {
                  key: 'precedence',
                  label: t('documents.viewer.precedence'),
                  value: document.precedence,
                },
                {
                  key: 'related',
                  label: t('documents.viewer.related'),
                  value: (
                    <span className="tiq-stack">
                      {document.relatedReference !== null &&
                        (document.relatedLinkPath === null ? (
                          <span>{document.relatedReference}</span>
                        ) : (
                          <Link to={document.relatedLinkPath}>{document.relatedReference}</Link>
                        ))}
                      <span className="tiq-text-muted">
                        {tEnum('documents.related_type', document.relatedType)}
                      </span>
                    </span>
                  ),
                },
                {
                  key: 'created',
                  label: t('documents.viewer.created'),
                  value: formatOfficialTime(document.createdAt, timeZone),
                },
                {
                  key: 'updated',
                  label: t('documents.viewer.updated'),
                  value: formatOfficialTime(document.updatedAt, timeZone),
                },
              ]}
            />
          </Card>
          <Card title={t('documents.viewer.history')} flush>
            <DocumentVersionHistory
              documentId={document.id}
              canDownload={capabilities.canDownload}
            />
          </Card>
          {canAudit && activeId === document.organization.tenantId && (
            <HistoryTimeline
              entityType="document"
              entityId={document.id}
              title={t('documents.viewer.audit')}
            />
          )}
        </div>
        <div className="tiq-stack">
          {evidence !== null && (
            <Card title={t('documents.viewer.evidence')}>
              <DetailList
                stacked
                items={[
                  { key: 'issuer', label: t('documents.viewer.issuer'), value: evidence.issuer },
                  {
                    key: 'period',
                    label: t('documents.viewer.period'),
                    value:
                      evidence.periodStart === null && evidence.periodEnd === null
                        ? null
                        : t('documents.viewer.periodLine', {
                            from: formatCalendarDate(evidence.periodStart),
                            to: formatCalendarDate(evidence.periodEnd),
                          }),
                  },
                  {
                    key: 'validFrom',
                    label: t('documents.viewer.validFrom'),
                    value:
                      evidence.validFrom === null ? null : formatCalendarDate(evidence.validFrom),
                  },
                  {
                    key: 'expires',
                    label: t('documents.viewer.expires'),
                    value:
                      evidence.expiresAt === null ? null : (
                        <span className="tiq-inline">
                          <span className={expired ? 'tiq-text-danger' : undefined}>
                            {formatCalendarDate(evidence.expiresAt)}
                          </span>
                          {expired && (
                            <Chip tone="danger" size="sm" outlined>
                              {t('documents.viewer.expired')}
                            </Chip>
                          )}
                        </span>
                      ),
                  },
                  {
                    key: 'verification',
                    label: t('documents.viewer.verification'),
                    value: (
                      <StatusChip
                        enum="evidence_items.verification_status"
                        value={evidence.verificationStatus}
                        size="sm"
                      />
                    ),
                  },
                ]}
              />
            </Card>
          )}
          {!document.isRedactedCopy && (
            <Card title={t('documents.viewer.copies')}>
              {allCopies.length === 0 ? (
                <p className="tiq-text-muted">{t('documents.viewer.copiesEmpty')}</p>
              ) : (
                <ul className="tiq-stack" aria-label={t('documents.viewer.copies')}>
                  {allCopies.map((copy) => (
                    <li key={copy.documentId} className="tiq-stack">
                      {/* A plain link wraps inside the narrow card (references render on one line). */}
                      <Link to={documentPaths.document(copy.documentId)} title={copy.title}>
                        {copy.title}
                      </Link>
                      <span className="tiq-inline">
                        <ClassificationBadge classification={copy.classification} redactedCopy />
                        <StatusChip enum="documents.status" value={copy.status} size="sm" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
      {dialog === 'upload' && activeTenant !== null && (
        <Dialog
          open
          size="lg"
          title={t('documents.upload.title', { title: document.title })}
          description={t('documents.upload.intro')}
          onClose={() => setDialog(null)}
        >
          <DocumentUploader
            audience={activeTenant.kind === 'supplier' ? 'supplier' : 'buyer'}
            relatedType={document.relatedType}
            relatedId={document.relatedId}
            documentId={document.id}
            defaultTitle={document.title}
            defaultClassification={document.classification}
            classifications={[document.classification]}
            onUploaded={(result) => {
              setDialog(null);
              toast.show(
                t('documents.upload.done', { version: result.version.versionNo }),
                'success',
              );
              invalidateApiQueries('me.documents.');
            }}
          />
        </Dialog>
      )}
      {dialog === 'redact' && (
        <RedactedCopyDialog
          original={document}
          onClose={() => setDialog(null)}
          onCreated={(copy) => {
            setCopies((previous) => [...previous, copy]);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

export default function DocumentViewerPage() {
  const documentId = useIdParam('documentId');
  const query = useApiQuery(getMyDocument, documentId === null ? null : { params: { documentId } });
  if (query.data !== undefined) return <DocumentView document={query.data} />;
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('documents.viewer.loadingTitle')}
        back={{ to: documentPaths.list, label: t('documents.viewer.back') }}
      />
      {documentId === null ? (
        <EmptyState icon="alertCircle" title={t('documents.viewer.notFound')} />
      ) : query.error === null ? (
        <SkeletonBlock lines={8} />
      ) : (
        <ErrorState error={query.error} onRetry={query.reload} />
      )}
    </div>
  );
}
