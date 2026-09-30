/**
 * SUP-19 — One final-offer round the supplier is invited to: round instructions, permitted changes, the official
 * deadline, opening rules and evaluation treatment, and whether the final offer was received. The final offer is
 * prepared and submitted in the response workspace (bids domain), which this page links to.
 */
import { selectionEndpoints } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  DetailList,
  OfficialDeadline,
  PageHeader,
  QueryView,
  StatusChip,
} from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { useIdParam } from '../../lib/hooks';
import { selectionPaths } from '../../lib/paths';

export default function SupplierFinalOfferPage() {
  const roundId = useIdParam('roundId');
  const query = useApiQuery(
    selectionEndpoints.getSupplierFinalOffer,
    roundId === null ? null : { params: { roundId } },
  );
  const view = query.data;
  const submitted = view?.finalOfferReceivedAt !== null && view !== undefined;

  return (
    <div className="tiq-page">
      <PageHeader
        title={
          view === undefined
            ? t('selection.supplierFinalOffer.title')
            : t('selection.supplierFinalOffer.heading', { reference: view.tender.reference })
        }
        back={{
          to: selectionPaths.supplierNegotiations,
          label: t('selection.supplierNegotiations.title'),
        }}
        meta={
          view === undefined ? undefined : (
            <>
              <span className="tiq-ref">{view.tender.reference}</span>
              <span>{view.buyer.name}</span>
              <StatusChip enum="final_offer_rounds.status" value={view.status} />
              {view.deadline !== null && (
                <OfficialDeadline
                  deadline={view.deadline}
                  label={t('selection.finalOffers.col.deadline')}
                />
              )}
              <span>
                {t('selection.common.nextAction', {
                  action:
                    view.status === 'issued' && !submitted
                      ? t('selection.supplierFinalOffer.next.submit')
                      : t('selection.supplierFinalOffer.next.none'),
                })}
              </span>
            </>
          )
        }
        primaryAction={
          view !== undefined && view.status === 'issued' ? (
            <ButtonLink to={view.responseWorkspaceLink} variant="primary" iconAfter="arrowRight">
              {t('selection.supplierFinalOffer.workspace')}
            </ButtonLink>
          ) : undefined
        }
      />
      <QueryView query={query}>
        {(data) => (
          <>
            {data.finalOfferReceivedAt !== null ? (
              <Banner tone="success" title={t('selection.supplierFinalOffer.received')}>
                <p>{formatDateTime(data.finalOfferReceivedAt, data.tender.officialTimeZone)}</p>
              </Banner>
            ) : data.status === 'issued' ? (
              <Banner tone="warning" title={t('selection.supplierFinalOffer.notSubmitted')}>
                <p>{t('selection.supplierFinalOffer.submitHint')}</p>
              </Banner>
            ) : (
              <Banner tone="info" title={t('selection.supplierFinalOffer.notOpen')} />
            )}
            <div className="tiq-grid tiq-grid--sidebar">
              <Card title={t('selection.finalOffer.terms')}>
                <DetailList
                  stacked
                  items={[
                    { label: t('selection.finalOfferForm.instructions'), value: data.instructions },
                    {
                      label: t('selection.finalOfferForm.permittedChanges'),
                      value: data.permittedChanges,
                    },
                    { label: t('selection.finalOfferForm.openingRules'), value: data.openingRules },
                    {
                      label: t('selection.finalOfferForm.evaluationTreatment'),
                      value: data.evaluationTreatment,
                    },
                  ]}
                />
              </Card>
              <Card title={t('selection.supplierFinalOffer.timeline')}>
                <DetailList
                  stacked
                  items={[
                    {
                      label: t('selection.finalOffers.col.deadline'),
                      value:
                        data.deadline === null ? null : (
                          <OfficialDeadline
                            deadline={data.deadline}
                            variant="block"
                            showRemaining
                          />
                        ),
                    },
                    {
                      label: t('selection.finalOffer.col.notified'),
                      value:
                        data.notifiedAt === null
                          ? null
                          : formatDateTime(data.notifiedAt, data.tender.officialTimeZone),
                    },
                    {
                      label: t('selection.finalOffer.col.received'),
                      value:
                        data.finalOfferReceivedAt === null
                          ? null
                          : formatDateTime(data.finalOfferReceivedAt, data.tender.officialTimeZone),
                    },
                  ]}
                />
              </Card>
            </div>
          </>
        )}
      </QueryView>
    </div>
  );
}
