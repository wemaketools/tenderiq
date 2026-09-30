/**
 * BUY-05 advance notice: edit a draft, check its publication readiness (blocking items vs warnings), publish it to
 * the public plans page (PUB-06) or withdraw it. A published notice is a forecast that may change; it is never an
 * invitation to submit a bid.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { AdvanceNoticeDetail } from '@contracts/requests';

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
  FormErrorSummary,
  PageHeader,
  QueryView,
  ReadinessChecklist,
  StatusChip,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { NoticeFields } from '../components/NoticeFields';
import { NOTICE_FIELDS, noticeBody, noticeErrors } from '../components/noticeDraft';
import type { NoticeDraft } from '../components/noticeDraft';
import { explainError, noticeNextAction, planningPaths } from '../lib';

function draftOf(notice: AdvanceNoticeDetail): NoticeDraft {
  return {
    title: notice.title,
    summary: notice.summary,
    categoryId: notice.category === null ? '' : String(notice.category.id),
    indicativeTiming: notice.indicativeTiming,
    estimatedValueBand: notice.estimatedValueBand ?? '',
    eoiInstructions: notice.eoiInstructions ?? '',
  };
}

export default function AdvanceNoticePage() {
  const { noticeId } = useParams();
  const id = Number(noticeId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('planning.notice.notFound')}
          back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        />
        <EmptyState title={t('planning.notice.notFound')} />
      </div>
    );
  }
  return <NoticeLoader key={id} noticeId={id} />;
}

function NoticeLoader({ noticeId }: { readonly noticeId: number }) {
  const query = useApiQuery(requestEndpoints.getAdvanceNotice, { params: { noticeId } });
  const [result, setResult] = useState<AdvanceNoticeDetail | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('planning.notice.title')}
          back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => <NoticeWorkspace notice={result ?? data} onChanged={setResult} />}
      </QueryView>
    </div>
  );
}

function NoticeWorkspace({
  notice,
  onChanged,
}: {
  readonly notice: AdvanceNoticeDetail;
  readonly onChanged: (next: AdvanceNoticeDetail) => void;
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const allowed = notice.allowedActions;
  const options = useApiQuery(
    requestEndpoints.getRequestOptions,
    allowed.includes('edit') ? {} : null,
  );
  const [baseline, setBaseline] = useState<NoticeDraft>(() => draftOf(notice));
  const [draft, setDraft] = useState<NoticeDraft>(baseline);
  const [tried, setTried] = useState(false);
  const [dialog, setDialog] = useState<'publish' | 'withdraw' | null>(null);
  const save = useApiMutation(requestEndpoints.updateAdvanceNotice);
  const publish = useApiMutation(requestEndpoints.publishAdvanceNotice);
  const withdraw = useApiMutation(requestEndpoints.withdrawAdvanceNotice);
  const serverErrors = formErrors(save.error, NOTICE_FIELDS);
  const local = noticeErrors(draft);
  const dirty = (Object.keys(draft) as (keyof NoticeDraft)[]).some(
    (key) => draft[key] !== baseline[key],
  );
  const blocking = notice.publishReadiness.filter((item) => item.status === 'blocking');

  const apply = (next: AdvanceNoticeDetail, message: string): void => {
    onChanged(next);
    const nextDraft = draftOf(next);
    setBaseline(nextDraft);
    setDraft(nextDraft);
    setTried(false);
    setDialog(null);
    toast.show(message, 'success');
  };

  const onSave = async (): Promise<void> => {
    setTried(true);
    if (Object.keys(local).length > 0) return;
    try {
      apply(
        await save.mutate({ params: { noticeId: notice.id }, body: noticeBody(draft) }),
        t('planning.notice.saved'),
      );
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <>
      <UnsavedChangesGuard when={dirty && !save.pending} />
      <PageHeader
        title={notice.title}
        back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        meta={
          <>
            <StatusChip enum="advance_notices.status" value={notice.status} />
            <span>
              {t('planning.notice.planItem')}:{' '}
              <Link to={planningPaths.item(notice.planItem.id)}>{notice.planItem.title}</Link>
            </span>
            <span>
              {t('planning.common.nextAction')}: {noticeNextAction(notice)}
            </span>
          </>
        }
        primaryAction={
          allowed.includes('publish') ? (
            <Button
              variant="primary"
              icon="megaphone"
              disabled={dirty}
              onClick={() => setDialog('publish')}
            >
              {t('planning.notice.publish')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {allowed.includes('edit') && (
              <Button
                icon="check"
                loading={save.pending}
                disabled={!dirty}
                onClick={() => void onSave()}
              >
                {t('planning.notice.save')}
              </Button>
            )}
            {notice.publicPath !== null && (
              <ButtonLink to={notice.publicPath} icon="externalLink">
                {t('planning.notice.viewPublic')}
              </ButtonLink>
            )}
            {allowed.includes('withdraw') && (
              <Button variant="danger-soft" icon="xCircle" onClick={() => setDialog('withdraw')}>
                {t('planning.notice.withdraw')}
              </Button>
            )}
          </>
        }
      />

      {!notice.portalShowsAdvanceNotices && (
        <Banner tone="warning" title={t('planning.notice.portalDisabledTitle')}>
          <p>{t('planning.notice.portalDisabled')}</p>
        </Banner>
      )}
      {notice.status === 'withdrawn' && (
        <Banner tone="info" title={t('planning.notice.withdrawnTitle')}>
          <p>{notice.withdrawnReason ?? t('planning.notice.withdrawnNoReason')}</p>
        </Banner>
      )}
      {notice.status === 'published' && (
        <Banner tone="success" title={t('planning.notice.publishedTitle')}>
          <p>
            {t('planning.notice.published', {
              at: notice.publishedAt === null ? '' : formatDateTime(notice.publishedAt, timeZone),
              name: notice.publishedBy?.fullName ?? '',
            })}
          </p>
        </Banner>
      )}
      {dirty && allowed.includes('publish') && (
        <Banner tone="info" title={t('planning.notice.saveBeforePublish')} />
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('planning.notice.sections.content')}>
          {allowed.includes('edit') ? (
            <>
              <FormErrorSummary
                title={explainError(save.error)?.detail ?? save.error?.title ?? null}
                errors={serverErrors.other}
              />
              <NoticeFields
                draft={draft}
                onChange={setDraft}
                options={options.data}
                errorOf={(field) =>
                  serverErrors.forField(field) ?? (tried ? local[field] : undefined)
                }
              />
            </>
          ) : (
            <DetailList
              stacked
              items={[
                { label: t('planning.noticeFields.summary'), value: notice.summary },
                { label: t('planning.noticeFields.category'), value: notice.category?.name },
                { label: t('planning.noticeFields.timing'), value: notice.indicativeTiming },
                { label: t('planning.noticeFields.valueBand'), value: notice.estimatedValueBand },
                { label: t('planning.noticeFields.eoi'), value: notice.eoiInstructions },
              ]}
            />
          )}
        </Card>
        <div className="tiq-stack">
          <Card
            title={t('planning.notice.sections.readiness')}
            subtitle={
              blocking.length === 0
                ? t('planning.notice.ready')
                : t('planning.notice.blocked', { count: blocking.length })
            }
          >
            {notice.publishReadiness.length === 0 ? (
              <EmptyState compact title={t('planning.notice.noReadiness')} />
            ) : (
              <ReadinessChecklist
                label={t('planning.notice.sections.readiness')}
                items={notice.publishReadiness.map((item) => ({
                  id: item.id,
                  label: item.label,
                  detail: item.detail ?? undefined,
                  status: item.status,
                }))}
              />
            )}
          </Card>
          <Card title={t('planning.notice.sections.forecast')}>
            <p>{t('planning.notice.forecast')}</p>
          </Card>
        </div>
      </div>

      {dialog === 'publish' && (
        <ConfirmActionDialog
          open
          title={t('planning.notice.publishTitle')}
          scope={`${notice.title} · ${notice.indicativeTiming}`}
          consequence={t('planning.notice.publishConsequence')}
          confirmLabel={t('planning.notice.publish')}
          acknowledgement={t('planning.notice.publishAck')}
          pending={publish.pending}
          error={explainError(publish.error)}
          onCancel={() => {
            setDialog(null);
            publish.reset();
          }}
          onConfirm={async () => {
            try {
              apply(
                await publish.mutate({ params: { noticeId: notice.id } }),
                t('planning.notice.publishDone'),
              );
            } catch {
              // The dialog shows the error.
            }
          }}
        >
          {blocking.length > 0 && (
            <Banner tone="error" title={t('planning.notice.blocked', { count: blocking.length })}>
              <ul>
                {blocking.map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            </Banner>
          )}
        </ConfirmActionDialog>
      )}
      {dialog === 'withdraw' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('planning.notice.withdrawTitle')}
          scope={notice.title}
          consequence={t('planning.notice.withdrawConsequence')}
          confirmLabel={t('planning.notice.withdraw')}
          reason={{ label: t('planning.notice.withdrawReason'), required: true }}
          pending={withdraw.pending}
          error={explainError(withdraw.error)}
          onCancel={() => {
            setDialog(null);
            withdraw.reset();
          }}
          onConfirm={async ({ reason }) => {
            try {
              apply(
                await withdraw.mutate({ params: { noticeId: notice.id }, body: { reason } }),
                t('planning.notice.withdrawDone'),
              );
            } catch {
              // The dialog shows the error.
            }
          }}
        />
      )}
    </>
  );
}
