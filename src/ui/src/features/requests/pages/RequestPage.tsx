/**
 * BUY-03 Request and business case. Required information: need, outcomes, scope, quantities, dates, locations,
 * budget, risk, stakeholders and supporting evidence. Principal actions: draft, submit, clarify (respond to
 * information requests), revise, withdraw and review (FR-04, PRD §8.1, BR-10).
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { RequestDetail } from '@contracts/requests';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { DocumentList } from '../../../components/documents';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DetailList,
  EmptyState,
  MoneyText,
  PageHeader,
  QueryView,
  ReadinessChecklist,
  Reference,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useActiveTenant } from '../../../app/hooks';
import { CustomFieldsSection } from '../../admin-policy/components/CustomFieldsSection';
import { RequestActionDialog } from '../components/RequestActionDialog';
import type { RequestDialogKind } from '../components/RequestActionDialog';
import { requestNextAction, requestPaths, strategyBlocksTender } from '../lib';

export default function RequestPage() {
  const { requestId } = useParams();
  const id = Number(requestId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('requests.detail.notFound')}
          back={{ to: requestPaths.register, label: t('requests.detail.back') }}
        />
        <EmptyState title={t('requests.detail.notFound')} />
      </div>
    );
  }
  return <RequestLoader key={id} requestId={id} />;
}

function RequestLoader({ requestId }: { readonly requestId: number }) {
  const query = useApiQuery(requestEndpoints.getRequest, { params: { requestId } });
  const [result, setResult] = useState<RequestDetail | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('requests.detail.title')}
          back={{ to: requestPaths.register, label: t('requests.detail.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => <RequestWorkspace request={result ?? data} onChanged={setResult} />}
      </QueryView>
    </div>
  );
}

function RequestWorkspace({
  request,
  onChanged,
}: {
  readonly request: RequestDetail;
  readonly onChanged: (next: RequestDetail) => void;
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canUpload = usePermission('request.create');
  const [dialog, setDialog] = useState<RequestDialogKind | null>(null);
  const allowed = request.allowedActions;
  const openInfo = request.infoRequests.find((item) => item.status === 'open') ?? null;
  const blocking = request.submissionReadiness.filter((item) => item.status === 'blocking');
  const warnings = request.submissionReadiness.filter((item) => item.status === 'warning');

  const stageBanner = (() => {
    switch (request.status) {
      case 'draft':
        return (
          <Banner tone="info" title={t('requests.detail.stage.draftTitle')}>
            <p>{t('requests.detail.stage.draft')}</p>
          </Banner>
        );
      case 'submitted':
      case 'under_review':
        return (
          <Banner tone="info" title={t('requests.detail.stage.submittedTitle')}>
            <p>
              {t('requests.detail.stage.submitted', {
                at:
                  request.submittedAt === null ? '' : formatDateTime(request.submittedAt, timeZone),
              })}
            </p>
          </Banner>
        );
      case 'approved':
        return (
          <Banner tone="success" title={t('requests.detail.stage.approvedTitle')}>
            <p>{t('requests.detail.stage.approved')}</p>
          </Banner>
        );
      default:
        return null;
    }
  })();

  return (
    <>
      <PageHeader
        title={request.title}
        back={{ to: requestPaths.register, label: t('requests.detail.back') }}
        meta={
          <>
            <Reference value={request.reference} />
            <StatusChip enum="procurement_requests.status" value={request.status} />
            <span>{t('requests.detail.revision', { revision: request.revision })}</span>
            <span>
              {t('requests.detail.ownerLabel')}:{' '}
              {request.owner?.fullName ?? t('requests.common.unassigned')}
            </span>
            {request.targetDate !== null && (
              <span>
                {t('requests.detail.targetLabel')}: {formatCalendarDate(request.targetDate)}
              </span>
            )}
            <span>
              {t('requests.common.nextAction')}: {requestNextAction(request)}
            </span>
          </>
        }
        primaryAction={
          allowed.includes('submit') ? (
            <Button variant="primary" icon="send" onClick={() => setDialog('submit')}>
              {request.status === 'information_requested'
                ? t('requests.actions.resubmit')
                : t('requests.actions.submit')}
            </Button>
          ) : allowed.includes('create_tender') && request.createTenderPath !== null ? (
            <ButtonLink to={request.createTenderPath} variant="primary" icon="fileText">
              {t('requests.actions.create_tender')}
            </ButtonLink>
          ) : strategyBlocksTender(request) && request.strategy !== null ? (
            <ButtonLink
              to={requestPaths.strategy(request.strategy.id)}
              variant="primary"
              icon="compass"
            >
              {t('requests.detail.openStrategy')}
            </ButtonLink>
          ) : undefined
        }
        actions={
          <>
            {allowed.includes('edit') && (
              <ButtonLink to={requestPaths.edit(request.id)} icon="edit">
                {t('requests.actions.edit')}
              </ButtonLink>
            )}
            {allowed.includes('respond_info') && openInfo !== null && (
              <Button icon="messageSquare" onClick={() => setDialog('respond_info')}>
                {t('requests.actions.respond_info')}
              </Button>
            )}
            {allowed.includes('request_info') && (
              <Button icon="messageQuestion" onClick={() => setDialog('request_info')}>
                {t('requests.actions.request_info')}
              </Button>
            )}
            {(allowed.includes('decide') ||
              allowed.includes('confirm_funding') ||
              allowed.includes('comment')) && (
              <ButtonLink to={requestPaths.decision(request.id)} icon="gavel">
                {t('requests.detail.openDecision')}
              </ButtonLink>
            )}
            {allowed.includes('create_strategy') && (
              <ButtonLink to={requestPaths.newStrategy(request.id)} icon="compass">
                {t('requests.actions.create_strategy')}
              </ButtonLink>
            )}
            {allowed.includes('withdraw') && (
              <Button variant="danger-soft" icon="xCircle" onClick={() => setDialog('withdraw')}>
                {t('requests.actions.withdraw')}
              </Button>
            )}
          </>
        }
      />

      {request.materialChange !== null && (
        <Banner tone="warning" title={t('requests.detail.materialChangeTitle')}>
          <p>
            {t('requests.detail.materialChange', {
              approved: request.materialChange.approvedRevision,
              current: request.materialChange.currentRevision,
              fields: request.materialChange.changedFields
                .map((field) => t(`requests.fields.${field}`))
                .join(', '),
            })}
          </p>
        </Banner>
      )}
      {strategyBlocksTender(request) && request.strategy !== null && (
        <Banner tone="info" title={t('requests.detail.strategyPendingTitle')}>
          <p>
            {t('requests.detail.strategyPending', {
              revision: request.strategy.revision,
              status: tEnum('procurement_strategies.status', request.strategy.status),
            })}
          </p>
        </Banner>
      )}
      {openInfo !== null && (
        <Banner tone="warning" title={t('requests.detail.infoRequestedTitle')}>
          <p>{openInfo.question}</p>
          <p className="tiq-cell-sub">
            {t('requests.detail.infoRequestedBy', {
              name: openInfo.requestedBy.fullName,
              at: formatDateTime(openInfo.requestedAt, timeZone),
            })}
            {openInfo.dueAt !== null &&
              ` · ${t('requests.detail.infoDue', { at: formatOfficialTime(openInfo.dueAt, timeZone) })}`}
          </p>
        </Banner>
      )}
      {stageBanner}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card title={t('requests.detail.sections.need')}>
            <DetailList
              stacked
              items={[
                { label: t('requests.fields.problemStatement'), value: request.problemStatement },
                { label: t('requests.fields.expectedOutcomes'), value: request.expectedOutcomes },
                {
                  label: t('requests.fields.consequenceOfDelay'),
                  value: request.consequenceOfDelay,
                },
                {
                  label: t('requests.fields.needType'),
                  value: (
                    <>
                      {tEnum('procurement_requests.need_type', request.needType)}
                      {request.replacesContract !== null && (
                        <>
                          {' · '}
                          <Reference
                            value={request.replacesContract.reference}
                            to={requestPaths.contract(request.replacesContract.id)}
                          />{' '}
                          {request.replacesContract.title}
                        </>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </Card>

          <Card title={t('requests.detail.sections.scope')}>
            <DetailList
              stacked
              items={[
                { label: t('requests.fields.scopeDescription'), value: request.scopeDescription },
                { label: t('requests.fields.quantities'), value: request.quantities },
                { label: t('requests.fields.deliveryLocations'), value: request.deliveryLocations },
                {
                  label: t('requests.fields.targetDate'),
                  value:
                    request.targetDate === null ? null : formatCalendarDate(request.targetDate),
                },
                { label: t('requests.fields.constraints'), value: request.constraints },
                { label: t('requests.fields.stakeholders'), value: request.stakeholders },
                { label: t('requests.fields.risks'), value: request.risks },
              ]}
            />
          </Card>

          <Card title={t('requests.detail.sections.budget')}>
            <DetailList
              items={[
                {
                  label: t('requests.fields.estimatedValue'),
                  value: <MoneyText value={request.estimatedValue} />,
                },
                { label: t('requests.fields.estimationBasis'), value: request.estimationBasis },
                {
                  label: t('requests.fields.estimatedTotalCommitment'),
                  value: <MoneyText value={request.estimatedTotalCommitment} />,
                },
                {
                  label: t('requests.fields.contractTermMonths'),
                  value:
                    request.contractTermMonths === null
                      ? null
                      : t('requests.common.months', { count: request.contractTermMonths }),
                },
                { label: t('requests.fields.renewalOptions'), value: request.renewalOptions },
                {
                  label: t('requests.fields.fundingStatus'),
                  value: (
                    <div className="tiq-stack">
                      <StatusChip
                        enum="procurement_requests.funding_status"
                        value={request.fundingStatus}
                      />
                      <span className="tiq-cell-sub">
                        {t(`requests.funding.explain.${request.fundingStatus}`)}
                      </span>
                    </div>
                  ),
                },
                {
                  label: t('requests.fields.fundingSourceId'),
                  value:
                    request.fundingSource === null
                      ? null
                      : `${request.fundingSource.code} ${request.fundingSource.name}`,
                },
                {
                  label: t('requests.fields.budgetOwnerUserId'),
                  value: request.budgetOwner?.fullName,
                },
                {
                  label: t('requests.fields.costCenterId'),
                  value:
                    request.costCenter === null
                      ? null
                      : `${request.costCenter.code} ${request.costCenter.name}`,
                },
                {
                  label: t('requests.fields.accountingReference'),
                  value: request.accountingReference,
                },
                {
                  label: t('requests.fields.projectId'),
                  value:
                    request.project === null ? null : (
                      <>
                        <Reference value={request.project.reference} /> {request.project.title}
                      </>
                    ),
                },
              ]}
            />
          </Card>

          <Card
            title={t('requests.detail.sections.valueBasis')}
            subtitle={request.valueBasis.explanation}
          >
            <DetailList
              items={[
                {
                  label: t('requests.detail.value.own'),
                  value: <MoneyText value={request.valueBasis.ownValue} />,
                },
                {
                  label: t('requests.detail.value.combined'),
                  value: <MoneyText value={request.valueBasis.combinedValue} />,
                },
                {
                  label: t('requests.detail.value.total'),
                  value: <MoneyText value={request.valueBasis.totalCommitment} />,
                },
                {
                  label: t('requests.detail.value.approval'),
                  value: <MoneyText value={request.valueBasis.approvalValue} />,
                },
              ]}
            />
            {request.links.length > 0 && (
              <ul className="tiq-stack" aria-label={t('requests.detail.links')}>
                {request.links.map((link) => (
                  <li key={link.id}>
                    <div>
                      <Chip tone="neutral" size="sm">
                        {t(`requests.linkTypes.${link.linkType}.${link.direction}`)}
                      </Chip>
                    </div>
                    <Reference
                      value={link.request.reference}
                      to={requestPaths.request(link.request.id)}
                    />{' '}
                    {link.request.title} · {link.requester.fullName} ·{' '}
                    <MoneyText value={link.estimatedValue} /> ·{' '}
                    {tEnum('procurement_requests.funding_status', link.fundingStatus)}
                    {link.note !== null && <div className="tiq-cell-sub">{link.note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <DocumentList
            audience="buyer"
            relatedType="procurement_request"
            relatedId={request.id}
            title={t('requests.detail.sections.evidence')}
            canUpload={canUpload && allowed.includes('edit')}
          />
        </div>

        <div className="tiq-stack">
          <Card title={t('requests.detail.sections.people')}>
            <DetailList
              stacked
              items={[
                { label: t('requests.fields.requester'), value: request.requester.fullName },
                { label: t('requests.fields.sponsorUserId'), value: request.sponsor?.fullName },
                {
                  label: t('requests.fields.owner'),
                  value: request.owner?.fullName ?? t('requests.common.unassigned'),
                },
                {
                  label: t('requests.fields.legalEntityId'),
                  value: request.legalEntity?.name,
                },
                { label: t('requests.fields.departmentId'), value: request.department?.name },
                { label: t('requests.fields.categoryId'), value: request.category?.name },
                {
                  label: t('requests.fields.priority'),
                  value: (
                    <div>
                      <StatusChip enum="procurement_requests.priority" value={request.priority} />
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          {request.submissionReadiness.length > 0 && (
            <Card
              title={t('requests.detail.readiness')}
              subtitle={t('requests.detail.readinessSummary', {
                blocking: blocking.length,
                warnings: warnings.length,
              })}
            >
              <ReadinessChecklist
                label={t('requests.detail.readiness')}
                items={request.submissionReadiness.map((item) => ({
                  id: item.id,
                  label: item.label,
                  detail: item.detail ?? undefined,
                  status: item.status,
                }))}
              />
            </Card>
          )}

          {request.customFields !== undefined && Object.keys(request.customFields).length > 0 && (
            <Card title={t('requests.form.customFields')}>
              <CustomFieldsSection
                entityType="procurement_request"
                values={request.customFields}
                readOnly
              />
            </Card>
          )}

          <Card title={t('requests.detail.sections.linked')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('requests.detail.linked.planItem'),
                  value:
                    request.planItem === null ? null : (
                      <Link to={requestPaths.planItem(request.planItem.id)}>
                        {request.planItem.title}
                      </Link>
                    ),
                },
                {
                  label: t('requests.detail.linked.strategy'),
                  value:
                    request.strategy === null ? null : (
                      <>
                        <Reference
                          value={t('requests.common.strategyRef', {
                            revision: request.strategy.revision,
                          })}
                          to={requestPaths.strategy(request.strategy.id)}
                        />{' '}
                        <StatusChip
                          enum="procurement_strategies.status"
                          value={request.strategy.status}
                          size="sm"
                        />
                      </>
                    ),
                },
                {
                  label: t('requests.detail.linked.tender'),
                  value:
                    request.convertedTender === null ? null : (
                      <>
                        <Reference value={request.convertedTender.reference} />{' '}
                        {request.convertedTender.title}
                      </>
                    ),
                },
                {
                  label: t('requests.detail.linked.contract'),
                  value:
                    request.routedContract === null ? null : (
                      <>
                        <Reference
                          value={request.routedContract.reference}
                          to={requestPaths.contract(request.routedContract.id)}
                        />{' '}
                        {request.routedContract.title}
                      </>
                    ),
                },
                {
                  label: t('requests.detail.linked.decision'),
                  value:
                    request.decision.latest !== null
                      ? `${t('requests.detail.linked.decisionEntry', {
                          decision: t(
                            `requests.decision.history.${request.decision.latest.decision}`,
                          ),
                          name: request.decision.latest.decidedBy.fullName,
                          at: formatDateTime(request.decision.latest.decidedAt, timeZone),
                        })} · ${request.decision.latest.reason}`
                      : request.decision.decidedAt === null
                        ? null
                        : `${formatDateTime(request.decision.decidedAt, timeZone)}${
                            request.decision.decisionReason === null
                              ? ''
                              : ` · ${request.decision.decisionReason}`
                          }`,
                },
              ]}
            />
          </Card>

          <Card title={t('requests.detail.sections.infoRequests')}>
            {request.infoRequests.length === 0 ? (
              <EmptyState compact title={t('requests.detail.noInfoRequests')} />
            ) : (
              <Timeline
                label={t('requests.detail.sections.infoRequests')}
                items={request.infoRequests.map((item) => ({
                  id: item.id,
                  title: item.question,
                  tone: item.status === 'open' ? 'warning' : 'success',
                  icon: 'messageQuestion',
                  meta: `${item.requestedBy.fullName} · ${formatDateTime(item.requestedAt, timeZone)} · ${tEnum('request_info_requests.status', item.status)}`,
                  detail:
                    item.responseText === null
                      ? undefined
                      : `${item.respondedBy?.fullName ?? ''}: ${item.responseText}`,
                }))}
              />
            )}
          </Card>

          <Card title={t('requests.detail.sections.revisions')}>
            <Timeline
              label={t('requests.detail.sections.revisions')}
              items={[...request.revisions].reverse().map((revision) => ({
                id: revision.revision,
                title: t('requests.detail.revisionTitle', {
                  revision: revision.revision,
                  summary: revision.changeSummary,
                }),
                tone: revision.material ? 'warning' : 'neutral',
                meta: `${revision.createdBy.fullName} · ${formatDateTime(revision.createdAt, timeZone)}`,
                detail: revision.material
                  ? t('requests.detail.materialRevision', {
                      fields: revision.changedFields
                        .map((field) => t(`requests.fields.${field}`))
                        .join(', '),
                    })
                  : undefined,
              }))}
            />
          </Card>
        </div>
      </div>

      {dialog !== null && (
        <RequestActionDialog
          kind={dialog}
          request={request}
          infoRequest={openInfo}
          readiness={request.submissionReadiness}
          onClose={() => setDialog(null)}
          onDone={(message, detail) => {
            setDialog(null);
            toast.show(message, 'success');
            if (detail !== null) onChanged(detail);
          }}
        />
      )}
    </>
  );
}
