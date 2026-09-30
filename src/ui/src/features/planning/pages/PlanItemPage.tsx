/**
 * BUY-05 plan item: the planned event with its dependency chain, owner, budget period, planned release and award,
 * resource demand, expiring contract and advance notices. Actions: edit (prioritize, allocate the owner), schedule,
 * defer, cancel and prepare an advance notice.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { PlanItemDetail } from '@contracts/requests';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  MoneyText,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { explainError, planItemNextAction, planningPaths, updateBodyOf } from '../lib';

type StatusAction = 'schedule' | 'defer' | 'cancel';

const TARGET_STATUS: Record<StatusAction, 'scheduled' | 'deferred' | 'cancelled'> = {
  schedule: 'scheduled',
  defer: 'deferred',
  cancel: 'cancelled',
};

export default function PlanItemPage() {
  const { planItemId } = useParams();
  const id = Number(planItemId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('planning.item.notFound')}
          back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        />
        <EmptyState title={t('planning.item.notFound')} />
      </div>
    );
  }
  return <ItemLoader key={id} planItemId={id} />;
}

function ItemLoader({ planItemId }: { readonly planItemId: number }) {
  const query = useApiQuery(requestEndpoints.getPlanItem, { params: { planItemId } });
  const [result, setResult] = useState<PlanItemDetail | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('planning.item.title')}
          back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => <ItemWorkspace item={result ?? data} onChanged={setResult} />}
      </QueryView>
    </div>
  );
}

function ItemWorkspace({
  item,
  onChanged,
}: {
  readonly item: PlanItemDetail;
  readonly onChanged: (next: PlanItemDetail) => void;
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [action, setAction] = useState<StatusAction | null>(null);
  const update = useApiMutation(requestEndpoints.updatePlanItem);
  const allowed = item.allowedActions;

  return (
    <>
      <PageHeader
        title={item.title}
        back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        meta={
          <>
            <StatusChip enum="plan_items.status" value={item.status} />
            <StatusChip enum="procurement_requests.priority" value={item.priority} />
            <span>
              {t('planning.item.owner')}: {item.owner?.fullName ?? t('planning.common.unassigned')}
            </span>
            <span>
              {t('planning.item.release')}:{' '}
              {item.plannedReleaseDate === null
                ? t('planning.common.unscheduled')
                : formatCalendarDate(item.plannedReleaseDate)}
            </span>
            <span>
              {t('planning.common.nextAction')}: {planItemNextAction(item)}
            </span>
          </>
        }
        primaryAction={
          allowed.includes('schedule') ? (
            <Button variant="primary" icon="calendar" onClick={() => setAction('schedule')}>
              {t('planning.item.actions.schedule')}
            </Button>
          ) : allowed.includes('create_notice') ? (
            <ButtonLink to={planningPaths.newNotice(item.id)} variant="primary" icon="megaphone">
              {t('planning.item.actions.createNotice')}
            </ButtonLink>
          ) : undefined
        }
        actions={
          <>
            {allowed.includes('edit') && (
              <ButtonLink to={planningPaths.editItem(item.id)} icon="edit">
                {t('planning.item.actions.edit')}
              </ButtonLink>
            )}
            {allowed.includes('schedule') && allowed.includes('create_notice') && (
              <ButtonLink to={planningPaths.newNotice(item.id)} icon="megaphone">
                {t('planning.item.actions.createNotice')}
              </ButtonLink>
            )}
            {allowed.includes('defer') && (
              <Button icon="pause" onClick={() => setAction('defer')}>
                {t('planning.item.actions.defer')}
              </Button>
            )}
            {allowed.includes('cancel') && (
              <Button variant="danger-soft" icon="xCircle" onClick={() => setAction('cancel')}>
                {t('planning.item.actions.cancel')}
              </Button>
            )}
          </>
        }
      />

      {item.warnings.length > 0 && (
        <Banner tone="warning" title={t('planning.item.warningsTitle')}>
          <ul>
            {item.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card title={t('planning.item.sections.plan')}>
            <DetailList
              items={[
                { label: t('planning.fields.budgetPeriod'), value: item.budgetPeriod },
                {
                  label: t('planning.fields.expectedValue'),
                  value: <MoneyText value={item.expectedValue} />,
                },
                {
                  label: t('planning.fields.plannedReleaseDate'),
                  value:
                    item.plannedReleaseDate === null
                      ? null
                      : formatCalendarDate(item.plannedReleaseDate),
                },
                {
                  label: t('planning.fields.plannedAwardDate'),
                  value:
                    item.plannedAwardDate === null
                      ? null
                      : formatCalendarDate(item.plannedAwardDate),
                },
                {
                  label: t('planning.fields.resourceDemandDays'),
                  value: t('planning.common.days', { count: item.resourceDemandDays }),
                },
                { label: t('planning.fields.categoryId'), value: item.category?.name },
                { label: t('planning.fields.departmentId'), value: item.department?.name },
                {
                  label: t('planning.fields.projectId'),
                  value:
                    item.project === null
                      ? null
                      : `${item.project.reference} ${item.project.title}`,
                },
                {
                  label: t('planning.fields.requestId'),
                  value:
                    item.request === null ? null : (
                      <>
                        <Reference
                          value={item.request.reference}
                          to={planningPaths.request(item.request.id)}
                        />{' '}
                        {item.request.title}
                      </>
                    ),
                },
                {
                  label: t('planning.item.tender'),
                  value:
                    item.tender === null ? null : (
                      <>
                        <Reference value={item.tender.reference} /> {item.tender.title}{' '}
                        <div>
                          <StatusChip enum="tenders.status" value={item.tender.status} size="sm" />
                        </div>
                      </>
                    ),
                },
              ]}
            />
          </Card>

          <Card title={t('planning.item.sections.dependencies')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('planning.fields.dependsOnId'),
                  value:
                    item.dependsOn === null ? (
                      t('planning.item.noDependency')
                    ) : (
                      <>
                        <Link to={planningPaths.item(item.dependsOn.id)}>
                          {item.dependsOn.title}
                        </Link>{' '}
                        <StatusChip
                          enum="plan_items.status"
                          value={item.dependsOn.status}
                          size="sm"
                        />
                      </>
                    ),
                },
                {
                  label: t('planning.item.dependents'),
                  value:
                    item.dependents.length === 0 ? (
                      t('planning.item.noDependents')
                    ) : (
                      <ul className="tiq-stack">
                        {item.dependents.map((dependent) => (
                          <li key={dependent.id}>
                            <Link to={planningPaths.item(dependent.id)}>{dependent.title}</Link>{' '}
                            <StatusChip
                              enum="plan_items.status"
                              value={dependent.status}
                              size="sm"
                            />
                          </li>
                        ))}
                      </ul>
                    ),
                },
              ]}
            />
          </Card>
        </div>

        <div className="tiq-stack">
          {item.expiringContract !== null && (
            <Card title={t('planning.item.sections.expiry')}>
              <p>
                <Reference
                  value={item.expiringContract.reference}
                  to={planningPaths.contract(item.expiringContract.id)}
                />{' '}
                {item.expiringContract.title}
              </p>
              <p className="tiq-text-warning">
                {t('planning.item.expiresOn', {
                  date: formatCalendarDate(item.expiringContract.expiresOn),
                })}
              </p>
            </Card>
          )}
          <Card title={t('planning.item.sections.notices')}>
            {item.advanceNotices.length === 0 ? (
              <EmptyState
                compact
                icon="megaphone"
                title={t('planning.item.noNotices')}
                action={
                  allowed.includes('create_notice') ? (
                    <ButtonLink to={planningPaths.newNotice(item.id)} size="sm" icon="plus">
                      {t('planning.item.actions.createNotice')}
                    </ButtonLink>
                  ) : undefined
                }
              />
            ) : (
              <ul className="tiq-stack">
                {item.advanceNotices.map((notice) => (
                  <li key={notice.id}>
                    <Link to={planningPaths.notice(notice.id)}>{notice.title}</Link>{' '}
                    <div>
                      <StatusChip enum="advance_notices.status" value={notice.status} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t('planning.item.sections.record')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('planning.item.created'),
                  value: formatDateTime(item.createdAt, timeZone),
                },
                {
                  label: t('planning.item.updated'),
                  value: formatDateTime(item.updatedAt, timeZone),
                },
              ]}
            />
          </Card>
        </div>
      </div>

      {action !== null && (
        <ConfirmActionDialog
          open
          tone={action === 'cancel' ? 'danger' : 'primary'}
          title={t(`planning.item.confirm.${action}.title`, { title: item.title })}
          scope={item.title}
          consequence={t(`planning.item.confirm.${action}.consequence`, {
            date:
              item.plannedReleaseDate === null ? '' : formatCalendarDate(item.plannedReleaseDate),
          })}
          confirmLabel={t(`planning.item.actions.${action}`)}
          pending={update.pending}
          error={explainError(update.error)}
          onCancel={() => {
            setAction(null);
            update.reset();
          }}
          onConfirm={async () => {
            try {
              const next = await update.mutate({
                params: { planItemId: item.id },
                body: updateBodyOf(item, TARGET_STATUS[action]),
              });
              setAction(null);
              onChanged(next);
              toast.show(
                t(`planning.item.confirm.${action}.done`, { title: item.title }),
                'success',
              );
            } catch {
              // The dialog shows the error.
            }
          }}
        >
          {action === 'schedule' && item.plannedReleaseDate === null && (
            <Banner tone="warning" title={t('planning.errors.SCHEDULE_DATE_REQUIRED')} />
          )}
        </ConfirmActionDialog>
      )}
    </>
  );
}
