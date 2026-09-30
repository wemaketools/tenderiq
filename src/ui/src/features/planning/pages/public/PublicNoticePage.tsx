/**
 * PUB-06 one advance notice (public): the buyer, planned category, indicative timing, value band, plan status and
 * expression-of-interest instructions, and a form to follow the future opportunity by email. Following is not an
 * expression of interest, and the forecast is not an invitation to submit a bid.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { FollowNoticeResult, PublicAdvanceNotice } from '@contracts/requests';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  DetailList,
  FormErrorSummary,
  PageHeader,
  QueryView,
  StatusChip,
  TextField,
  formErrors,
} from '../../../../components/ui';
import { browserTimeZone, formatInstantDate } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { explainError, planningPaths } from '../../lib';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PublicNoticePage() {
  const { buyerSlug = '', noticeId = '' } = useParams();
  const id = Number(noticeId);
  const valid = Number.isInteger(id) && id > 0 && buyerSlug !== '';
  const notice = useApiQuery(
    requestEndpoints.getPublicAdvanceNotice,
    valid ? { params: { buyerSlug, noticeId: id } } : null,
  );
  return (
    <div className="tiq-page">
      {notice.data === undefined && (
        <PageHeader
          title={t('planning.public.noticeTitle')}
          back={{ to: planningPaths.publicPlans, label: t('planning.public.back') }}
        />
      )}
      {valid ? (
        <QueryView query={notice} errorTitle={t('planning.public.unavailable')}>
          {(data) => <NoticeView notice={data} />}
        </QueryView>
      ) : (
        <Banner tone="error" title={t('planning.public.unavailable')} />
      )}
    </div>
  );
}

function NoticeView({ notice }: { readonly notice: PublicAdvanceNotice }) {
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [tried, setTried] = useState(false);
  const [result, setResult] = useState<FollowNoticeResult | null>(null);
  const follow = useApiMutation(requestEndpoints.followPublicAdvanceNotice);
  const errors = formErrors(follow.error, ['email', 'organizationName']);
  const emailInvalid = !EMAIL_PATTERN.test(email.trim());

  const onFollow = async (): Promise<void> => {
    setTried(true);
    if (emailInvalid) return;
    try {
      setResult(
        await follow.mutate({
          params: { buyerSlug: notice.buyer.slug, noticeId: notice.id },
          body: {
            email: email.trim(),
            organizationName: organization.trim() === '' ? null : organization.trim(),
          },
        }),
      );
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <>
      <PageHeader
        title={notice.title}
        subtitle={notice.buyer.name}
        back={{ to: planningPaths.publicPlans, label: t('planning.public.back') }}
        meta={<StatusChip enum="plan_items.status" value={notice.planStatus} />}
      />
      <Banner tone="warning" title={t('planning.public.disclaimerTitle')}>
        <p>{t('planning.public.disclaimer')}</p>
      </Banner>
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('planning.public.forecast')}>
          <DetailList
            stacked
            items={[
              { label: t('planning.noticeFields.summary'), value: notice.summary },
              { label: t('planning.public.buyer'), value: notice.buyer.name },
              { label: t('planning.public.category'), value: notice.category?.name },
              { label: t('planning.noticeFields.timing'), value: notice.indicativeTiming },
              { label: t('planning.noticeFields.valueBand'), value: notice.estimatedValueBand },
              {
                label: t('planning.public.col.status'),
                value: <StatusChip enum="plan_items.status" value={notice.planStatus} size="sm" />,
              },
              {
                label: t('planning.noticeFields.eoi'),
                value: notice.eoiInstructions ?? t('planning.public.noEoi'),
              },
              {
                label: t('planning.public.col.published'),
                value: formatInstantDate(notice.publishedAt, browserTimeZone()),
              },
            ]}
          />
        </Card>
        <Card
          title={t('planning.public.follow.title')}
          subtitle={t('planning.public.follow.subtitle')}
        >
          {result !== null ? (
            <Banner tone="success" title={t('planning.public.follow.sentTitle')}>
              <p>{result.message}</p>
            </Banner>
          ) : (
            <div className="tiq-stack">
              <FormErrorSummary
                title={explainError(follow.error)?.detail ?? follow.error?.title ?? null}
                errors={errors.other}
              />
              <TextField
                label={t('planning.public.follow.email')}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={setEmail}
                error={
                  errors.forField('email') ??
                  (tried && emailInvalid ? t('planning.public.follow.emailInvalid') : undefined)
                }
              />
              <TextField
                label={t('planning.public.follow.organization')}
                autoComplete="organization"
                value={organization}
                onChange={setOrganization}
                error={errors.forField('organizationName')}
              />
              <p className="tiq-cell-sub">{t('planning.public.follow.note')}</p>
              <div className="tiq-inline">
                <Button
                  variant="primary"
                  icon="bell"
                  loading={follow.pending}
                  onClick={() => void onFollow()}
                >
                  {t('planning.public.follow.submit')}
                </Button>
                <ButtonLink to={planningPaths.publicPlans} variant="ghost">
                  {t('planning.public.back')}
                </ButtonLink>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
