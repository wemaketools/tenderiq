/**
 * PUB-03 Tender notice and public documents (`/opportunities/:buyerSlug/:ref`, DD-22): scope, lots, eligibility,
 * deadlines in the official time zone, the contact channel, public documents, addenda and the current status. The
 * current amendment history is displayed prominently. Visitors read and download public material, register interest
 * without an account, request restricted access or start participation (through sign-in, or the supplier workspace
 * when signed in as a supplier). Invitation-only and restricted events answer exactly like unknown references
 * (AC-01).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { publicationEndpoints } from '@contracts/publication';
import type { PackageDocument, PublicNotice } from '@contracts/publication';

import { isApiError } from '../../../api/client';
import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  CardLink,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  Reference,
  SkeletonBlock,
} from '../../../components/ui';
import { formatCount, formatInstantDate, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  AmendmentHistory,
  ConditionsCard,
  DocumentsCard,
  LotsCard,
  MilestonesCard,
} from '../../publication/components/NoticeSections';
import { saveDownloadLink } from '../../publication/lib/download';
import { publicationErrorMessage } from '../../publication/lib/errors';
import { opportunityPaths, portalPaths } from '../../publication/lib/paths';
import { NoticeStatus } from '../components/PortalBits';
import { languageName, usePortalViewer } from '../lib/viewer';
import { RegisterInterestDialog } from '../components/RegisterInterestDialog';

export default function NoticePage() {
  const { buyerSlug = '', ref = '' } = useParams();
  const query = useApiQuery(publicationEndpoints.publicNotice, {
    params: { buyerSlug, reference: ref },
  });

  if (
    query.error !== null &&
    (query.error.kind === 'not_found' || query.error.kind === 'validation')
  ) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('public-portal.notice.notFoundTitle')}
          back={{ to: portalPaths.search, label: t('public-portal.actions.backToSearch') }}
        />
        <EmptyState
          icon="search"
          title={t('public-portal.notice.notFoundTitle')}
          description={t('public-portal.notice.notFound')}
          action={
            <ButtonLink to={portalPaths.search}>{t('public-portal.home.browseAll')}</ButtonLink>
          }
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('public-portal.notice.loadingTitle')}
          back={{ to: portalPaths.search, label: t('public-portal.actions.backToSearch') }}
        />
        {query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return <NoticeView notice={query.data} />;
}

function NoticeView({ notice }: { readonly notice: PublicNotice }) {
  const viewer = usePortalViewer();
  const download = useApiMutation(publicationEndpoints.publicDocumentDownload);
  const [interestOpen, setInterestOpen] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const timeZone = notice.officialTimeZone;
  const routes = notice.participationRoutes;
  const supplierPath = opportunityPaths.find(notice.buyer.slug, notice.reference);

  const fetchDocument = async (document: PackageDocument): Promise<void> => {
    setDownloading(document.documentId);
    setDownloadError(null);
    try {
      const link = await download.mutate({
        params: {
          buyerSlug: notice.buyer.slug,
          reference: notice.reference,
          documentId: document.documentId,
        },
      });
      saveDownloadLink(link);
    } catch (error) {
      setDownloadError(
        isApiError(error)
          ? publicationErrorMessage(error)
          : t('public-portal.notice.downloadFailed'),
      );
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={notice.title}
        subtitle={notice.summary ?? undefined}
        back={{ to: portalPaths.search, label: t('public-portal.actions.backToSearch') }}
        meta={
          <>
            <Reference value={notice.reference} />
            <CardLink to={portalPaths.buyer(notice.buyer.slug)}>{notice.buyer.name}</CardLink>
            <NoticeStatus notice={notice} />
            {notice.closingAt !== null && (
              <OfficialDeadline
                deadline={notice.closingAt}
                label={t('public-portal.notice.closing')}
                showRemaining={notice.isAcceptingResponses}
              />
            )}
          </>
        }
      />

      {notice.cancellation !== null && (
        <Banner tone="error" title={t('public-portal.notice.cancelledTitle')}>
          <p>
            {t('public-portal.notice.cancelled', {
              at: formatOfficialTime(notice.cancellation.cancelledAt, timeZone),
              reason: notice.cancellation.reason,
            })}
          </p>
        </Banner>
      )}
      {notice.cancellation === null && !notice.isAcceptingResponses && (
        <Banner tone="warning" title={t('public-portal.notice.closedTitle')}>
          <p>
            {t('public-portal.notice.closedBody', {
              status: tEnum('tenders.status', notice.status),
            })}
          </p>
        </Banner>
      )}
      {notice.outcome !== null && (
        <Banner
          tone="info"
          title={t('public-portal.notice.outcomeTitle')}
          actions={
            notice.outcome.awardLinkPath === null ? undefined : (
              <ButtonLink to={notice.outcome.awardLinkPath} size="sm">
                {t('public-portal.notice.openAward')}
              </ButtonLink>
            )
          }
        >
          <p>{notice.outcome.summary}</p>
        </Banner>
      )}
      {notice.amendmentCount > 0 && (
        <Banner
          tone="warning"
          title={t('public-portal.notice.amendedTitle', { count: notice.amendmentCount })}
        >
          <p>
            {t('public-portal.notice.amendedBody', {
              version: notice.currentVersionNo,
              at:
                notice.lastAmendedAt === null
                  ? t('public-portal.notice.unknownDate')
                  : formatOfficialTime(notice.lastAmendedAt, timeZone),
            })}
          </p>
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label={t('public-portal.notice.kpi.lots')}
          icon="layers"
          value={formatCount(notice.lotCount)}
          hint={tEnum('tenders.procedure', notice.procedure)}
        />
        <KpiCard
          label={t('public-portal.notice.kpi.version')}
          icon="history"
          tone={notice.amendmentCount > 0 ? 'warning' : 'info'}
          value={t('public-portal.notice.kpi.versionValue', { version: notice.currentVersionNo })}
          hint={t('public-portal.notice.kpi.amendments', { count: notice.amendmentCount })}
        />
        <KpiCard
          label={t('public-portal.notice.kpi.documents')}
          icon="files"
          tone="info"
          value={formatCount(notice.documents.length)}
          hint={t('public-portal.notice.kpi.restricted', { count: notice.restrictedDocumentCount })}
        />
        <KpiCard
          label={t('public-portal.notice.kpi.published')}
          icon="calendar"
          tone="success"
          value={formatInstantDate(notice.publishedAt, timeZone)}
          hint={formatOfficialTime(notice.publishedAt, timeZone)}
        />
      </KpiGrid>

      <AmendmentHistory
        addenda={notice.addenda}
        versions={notice.versions}
        timeZone={timeZone}
        currentVersionNo={notice.currentVersionNo}
      />

      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('public-portal.notice.scopeTitle')}>
          <DetailList
            items={[
              { key: 'summary', label: t('public-portal.notice.scope'), value: notice.summary },
              {
                key: 'category',
                label: t('public-portal.notice.category'),
                value: notice.category.name,
              },
              {
                key: 'regions',
                label: t('public-portal.notice.regions'),
                value: notice.regions.join(', '),
              },
              {
                key: 'procedure',
                label: t('public-portal.notice.procedure'),
                value: `${tEnum('tenders.event_type', notice.eventType)} · ${tEnum('tenders.procedure', notice.procedure)}`,
              },
              {
                key: 'eligibility',
                label: t('public-portal.notice.eligibility'),
                value: notice.eligibilitySummary,
              },
              {
                key: 'delivery',
                label: t('public-portal.notice.delivery'),
                value: notice.deliveryRequirements,
              },
              {
                key: 'rules',
                label: t('public-portal.notice.rules'),
                value: notice.submissionRules,
              },
              {
                key: 'languages',
                label: t('public-portal.notice.languages'),
                value: notice.acceptedLanguages.map(languageName).join(', '),
              },
              {
                key: 'contact',
                label: t('public-portal.notice.contact'),
                value: notice.communicationChannelNote,
              },
              { key: 'zone', label: t('public-portal.notice.officialTime'), value: timeZone },
            ]}
          />
        </Card>
        <Card title={t('public-portal.notice.participateTitle')}>
          <div className="tiq-stack">
            {!notice.isAcceptingResponses && (
              <p className="tiq-text-muted">{t('public-portal.notice.participationClosed')}</p>
            )}
            {routes.registerInterest && (
              <Button variant="primary" icon="flag" block onClick={() => setInterestOpen(true)}>
                {t('public-portal.notice.registerInterest')}
              </Button>
            )}
            {routes.requestAccess &&
              (viewer.supplierName !== null ? (
                <ButtonLink to={supplierPath} icon="key">
                  {t('public-portal.notice.requestAccess')}
                </ButtonLink>
              ) : (
                <ButtonLink to={portalPaths.signIn} icon="key">
                  {t('public-portal.notice.requestAccessSignIn')}
                </ButtonLink>
              ))}
            {routes.startParticipation &&
              (viewer.supplierName !== null ? (
                <ButtonLink to={supplierPath} icon="play">
                  {t('public-portal.notice.startParticipation', { name: viewer.supplierName })}
                </ButtonLink>
              ) : (
                <ButtonLink to={portalPaths.register} icon="userPlus">
                  {t('public-portal.notice.startParticipationRegister')}
                </ButtonLink>
              ))}
            <CardLink to={notice.clarificationsLinkPath}>
              {t('public-portal.notice.clarifications')}
            </CardLink>
            <p className="tiq-text-muted">{t('public-portal.notice.bindingNote')}</p>
          </div>
        </Card>
      </div>

      <div className="tiq-grid tiq-grid--2">
        <MilestonesCard milestones={notice.milestones} timeZone={timeZone} />
        <ConditionsCard
          conditions={notice.conditions}
          intro={t('public-portal.notice.conditionsIntro')}
        />
      </div>

      <LotsCard lots={notice.lots} />

      {downloadError !== null && (
        <Banner tone="warning" title={t('public-portal.notice.downloadBlocked')}>
          <p>{downloadError}</p>
        </Banner>
      )}
      <DocumentsCard
        documents={notice.documents}
        timeZone={timeZone}
        intro={t(`public-portal.notice.policy.${notice.documentPolicy}`)}
        footer={
          notice.restrictedDocumentCount > 0 ? (
            <span className="tiq-text-muted">
              {t('public-portal.notice.restrictedDocuments', {
                count: notice.restrictedDocumentCount,
              })}
            </span>
          ) : undefined
        }
        renderAction={(document) => (
          <Button
            size="sm"
            icon="download"
            loading={downloading === document.documentId}
            onClick={() => void fetchDocument(document)}
            aria-label={t('public-portal.notice.downloadNamed', { title: document.title })}
          >
            {t('public-portal.notice.download')}
          </Button>
        )}
      />

      <RegisterInterestDialog
        open={interestOpen}
        notice={notice}
        onClose={() => setInterestOpen(false)}
      />
    </div>
  );
}
