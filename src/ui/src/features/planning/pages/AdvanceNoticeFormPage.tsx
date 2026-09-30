/**
 * BUY-05 new advance notice: a draft forecast for an active plan item. Saving creates a draft; publishing is a
 * separate, confirmed step on the notice page once the plan item is scheduled.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { AdvanceNoticeDetail } from '@contracts/requests';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  FormErrorSummary,
  PageHeader,
  ReadinessChecklist,
  Select,
  StatusChip,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { NoticeFields } from '../components/NoticeFields';
import { EMPTY_NOTICE, NOTICE_FIELDS, noticeBody, noticeErrors } from '../components/noticeDraft';
import type { NoticeDraft } from '../components/noticeDraft';
import { explainError, planningPaths } from '../lib';

const ACTIVE_ITEMS = {
  query: {
    status: ['planned' as const, 'scheduled' as const, 'in_progress' as const],
    pageSize: 100,
    sort: 'title' as const,
    dir: 'asc' as const,
  },
};

export default function AdvanceNoticeFormPage() {
  const toast = useToast();
  const [search] = useSearchParams();
  const fromItem = search.get('planItemId') ?? '';
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const items = useApiQuery(requestEndpoints.listPlanItems, ACTIVE_ITEMS);
  const [planItemId, setPlanItemId] = useState(/^\d+$/.test(fromItem) ? fromItem : '');
  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_NOTICE);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<AdvanceNoticeDetail | null>(null);
  const create = useApiMutation(requestEndpoints.createAdvanceNotice);
  const serverErrors = formErrors(create.error, NOTICE_FIELDS);
  const local = {
    ...noticeErrors(draft),
    ...(planItemId === '' ? { planItemId: t('planning.noticeForm.errors.planItem') } : {}),
  };
  const dirty =
    created === null &&
    (planItemId !== '' ||
      (Object.keys(draft) as (keyof NoticeDraft)[]).some(
        (key) => draft[key] !== EMPTY_NOTICE[key],
      ));
  const errorOf = (field: string): string | undefined =>
    serverErrors.forField(field) ?? (tried ? (local as Record<string, string>)[field] : undefined);

  const onSave = async (): Promise<void> => {
    setTried(true);
    if (Object.keys(local).length > 0) return;
    try {
      const notice = await create.mutate({
        body: { planItemId: Number(planItemId), ...noticeBody(draft) },
      });
      setCreated(notice);
      toast.show(t('planning.noticeForm.created'), 'success');
    } catch {
      // The summary shows the error.
    }
  };

  if (created !== null) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={created.title}
          back={{ to: planningPaths.plan, label: t('planning.item.back') }}
          meta={<StatusChip enum="advance_notices.status" value={created.status} />}
        />
        <Banner tone="success" title={t('planning.noticeForm.savedTitle')}>
          <p>{t('planning.noticeForm.saved')}</p>
        </Banner>
        <Card title={t('planning.notice.sections.readiness')}>
          <ReadinessChecklist
            label={t('planning.notice.sections.readiness')}
            items={created.publishReadiness.map((item) => ({
              id: item.id,
              label: item.label,
              detail: item.detail ?? undefined,
              status: item.status,
            }))}
          />
        </Card>
        <div className="tiq-inline">
          <ButtonLink to={planningPaths.item(created.planItem.id)} icon="arrowLeft">
            {t('planning.noticeForm.backToItem')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <PageHeader
        title={t('planning.noticeForm.title')}
        back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        primaryAction={
          <Button
            variant="primary"
            icon="check"
            loading={create.pending}
            onClick={() => void onSave()}
          >
            {t('planning.noticeForm.save')}
          </Button>
        }
      />
      <Banner tone="info" title={t('planning.noticeForm.stageTitle')}>
        <p>{t('planning.noticeForm.stage')}</p>
      </Banner>
      <FormErrorSummary
        title={explainError(create.error)?.detail ?? create.error?.title ?? null}
        errors={serverErrors.other}
      />
      <Card title={t('planning.notice.sections.content')}>
        <div className="tiq-form-grid">
          <Select
            label={t('planning.notice.planItem')}
            required
            fieldClassName="tiq-form-full"
            value={planItemId}
            onChange={setPlanItemId}
            placeholder={t('planning.common.select')}
            options={(items.data?.items ?? []).map((item) => ({
              value: String(item.id),
              label: `${item.title} (${tEnum('plan_items.status', item.status)})`,
            }))}
            error={errorOf('planItemId')}
          />
        </div>
        <NoticeFields draft={draft} onChange={setDraft} options={options.data} errorOf={errorOf} />
      </Card>
    </div>
  );
}
