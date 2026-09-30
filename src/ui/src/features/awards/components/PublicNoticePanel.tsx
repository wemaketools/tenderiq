/**
 * BUY-28 public award notice (BR-34 → PUB-05): the redacted public edition is drafted here, reviewed for
 * confidentiality and personal information, and published only after both reviews and at least one final award.
 * Editing clears earlier reviews. Publication of an award does not prove the contract is signed (FR-17).
 */
import { useState } from 'react';
import { Link } from 'react-router';

import {
  SavePublicNoticeBody,
  getPublicNotice,
  publishPublicNotice,
  reviewPublicNotice,
  savePublicNotice,
} from '@contracts/awards';
import type {
  BuyerPublicAwardNotice,
  PublicNoticeReviewArea,
  PublicNoticeState,
} from '@contracts/awards';
import type { FieldError } from '@contracts/common';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  FormErrorSummary,
  QueryView,
  ReadinessChecklist,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { ReadinessItem } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { awardErrorMessage, withAwardMessage } from '../lib/errors';
import { yesNo } from '../lib/labels';
import { errorLookup, validateWith } from '../lib/validation';
import { TextBlock } from './TextBlock';

export function PublicNoticePanel({ tenderId }: { readonly tenderId: number }) {
  const query = useApiQuery(getPublicNotice, { params: { tenderId } });
  return (
    <QueryView query={query}>
      {(data) => <PublicNoticeContent key={data.notice?.updatedAt ?? 'none'} state={data} />}
    </QueryView>
  );
}

const EDITABLE = ['draft', 'approved'];

function PublicNoticeContent({ state }: { readonly state: PublicNoticeState }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const canIssue = usePermission('notice.issue');
  const [notice, setNotice] = useState<BuyerPublicAwardNotice | null>(state.notice);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(state.notice?.content ?? '');
  const [disclosedValues, setDisclosedValues] = useState(state.notice?.disclosedValues ?? true);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [reviewArea, setReviewArea] = useState<PublicNoticeReviewArea | null>(null);
  const [publishing, setPublishing] = useState(false);

  const save = useApiMutation(savePublicNotice);
  const review = useApiMutation(reviewPublicNotice);
  const publish = useApiMutation(publishPublicNotice);
  const errors = errorLookup(clientErrors, save.error, ['content', 'disclosedValues']);

  const editable = canIssue && (notice === null || EDITABLE.includes(notice.status));
  const dirty =
    editing &&
    (content !== (notice?.content ?? '') || disclosedValues !== (notice?.disclosedValues ?? true));
  const scope = `${state.tender.reference} ${state.tender.title}`;

  const readiness: ReadinessItem[] = [
    {
      id: 'content',
      label: t('awards.publicNotice.ready.content'),
      status: notice === null ? 'blocking' : 'passed',
    },
    {
      id: 'confidentiality',
      label: t('awards.publicNotice.ready.confidentiality'),
      detail: notice?.reviewConfidentialityBy?.fullName,
      status: notice?.reviewConfidentialityBy === null || notice === null ? 'blocking' : 'passed',
    },
    {
      id: 'personal',
      label: t('awards.publicNotice.ready.personal'),
      detail: notice?.reviewPersonalInfoBy?.fullName,
      status: notice?.reviewPersonalInfoBy === null || notice === null ? 'blocking' : 'passed',
    },
    {
      id: 'final',
      label: t('awards.publicNotice.ready.final'),
      detail: t('awards.publicNotice.ready.finalCount', { count: state.finalAwardedLotCount }),
      status: state.finalAwardedLotCount > 0 ? 'passed' : 'blocking',
    },
  ];
  const ready = readiness.every((item) => item.status !== 'blocking');

  const submitSave = async (): Promise<void> => {
    const body = { content: content.trim(), disclosedValues };
    const found = validateWith(SavePublicNoticeBody, body);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      const saved = await save.mutate({ params: { tenderId: state.tender.tenderId }, body });
      setNotice(saved);
      setEditing(false);
      toast.show(t('awards.publicNotice.saved'), 'success');
    } catch {
      // The summary shows the error.
    }
  };

  const confirmReview = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (notice === null || reviewArea === null) return;
    try {
      const reviewed = await review.mutate({
        params: { publicNoticeId: notice.publicNoticeId },
        body: { area: reviewArea, note: reason.trim() === '' ? undefined : reason.trim() },
      });
      setNotice(reviewed);
      setReviewArea(null);
      toast.show(t('awards.publicNotice.reviewed'), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const confirmPublish = async (): Promise<void> => {
    if (notice === null) return;
    try {
      const published = await publish.mutate({ params: { publicNoticeId: notice.publicNoticeId } });
      setNotice(published);
      setPublishing(false);
      invalidateApiQueries('buyer.awards.get');
      toast.show(t('awards.publicNotice.publishedToast'), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const publicPath = tenant === null ? null : `/awards/${tenant.slug}/${state.tender.reference}`;

  return (
    <div className="tiq-stack tiq-stack--spaced">
      {notice?.status === 'published' && (
        <Banner tone="success" title={t('awards.publicNotice.isPublished')}>
          {publicPath !== null && (
            <Link to={publicPath}>{t('awards.publicNotice.viewPublic')}</Link>
          )}
        </Banner>
      )}
      <Banner tone="info" title={t('awards.publicNotice.notContract')}>
        {t('awards.publicNotice.notContractText')}
      </Banner>
      <div className="tiq-grid tiq-grid--sidebar">
        <Card
          title={t('awards.publicNotice.title')}
          subtitle={t('awards.publicNotice.subtitle')}
          actions={
            editable && !editing ? (
              <Button
                icon={notice === null ? 'plus' : 'edit'}
                onClick={() => {
                  setContent(notice?.content ?? '');
                  setDisclosedValues(notice?.disclosedValues ?? true);
                  setClientErrors([]);
                  save.reset();
                  setEditing(true);
                }}
              >
                {notice === null ? t('awards.publicNotice.create') : t('awards.publicNotice.edit')}
              </Button>
            ) : undefined
          }
        >
          {editing ? (
            <form
              className="tiq-form-stack"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submitSave();
              }}
            >
              <UnsavedChangesGuard when={dirty && !save.pending} />
              <FormErrorSummary
                title={save.error === null ? null : awardErrorMessage(save.error)}
                errors={errors.other}
              />
              <TextArea
                label={t('awards.publicNotice.content')}
                hint={t('awards.publicNotice.contentHint')}
                required
                rows={10}
                value={content}
                error={errors.forField('content')}
                onChange={setContent}
              />
              <Checkbox
                label={t('awards.publicNotice.disclose')}
                hint={t('awards.publicNotice.discloseHint')}
                checked={disclosedValues}
                onChange={setDisclosedValues}
              />
              {notice !== null &&
                (notice.reviewConfidentialityBy !== null ||
                  notice.reviewPersonalInfoBy !== null) && (
                  <Banner tone="warning" title={t('awards.publicNotice.editClearsReviews')} />
                )}
              <div className="tiq-inline">
                <Button type="submit" variant="primary" icon="check" loading={save.pending}>
                  {t('awards.publicNotice.saveDraft')}
                </Button>
                <Button type="button" onClick={() => setEditing(false)} disabled={save.pending}>
                  {t('awards.common.cancel')}
                </Button>
              </div>
            </form>
          ) : notice === null ? (
            <p className="tiq-text-muted">{t('awards.publicNotice.none')}</p>
          ) : (
            <div className="tiq-stack">
              <DetailList
                items={[
                  {
                    label: t('awards.publicNotice.status'),
                    value: <StatusChip enum="public_award_notices.status" value={notice.status} />,
                  },
                  {
                    label: t('awards.publicNotice.disclosedValues'),
                    value: yesNo(notice.disclosedValues),
                  },
                  {
                    label: t('awards.publicNotice.updated'),
                    value: formatDateTime(notice.updatedAt, state.tender.officialTimeZone),
                  },
                  {
                    label: t('awards.publicNotice.publishedAt'),
                    value:
                      notice.publishedAt === null
                        ? null
                        : formatDateTime(notice.publishedAt, state.tender.officialTimeZone),
                  },
                ]}
              />
              <TextBlock text={notice.content} />
            </div>
          )}
        </Card>
        <Card title={t('awards.publicNotice.readinessTitle')}>
          <div className="tiq-stack">
            <ReadinessChecklist label={t('awards.publicNotice.readinessTitle')} items={readiness} />
            {canIssue && notice !== null && notice.status !== 'published' && !editing && (
              <div className="tiq-stack">
                {notice.reviewConfidentialityBy === null && (
                  <Button
                    icon="shieldCheck"
                    onClick={() => {
                      review.reset();
                      setReviewArea('confidentiality');
                    }}
                  >
                    {t('awards.publicNotice.reviewConfidentiality')}
                  </Button>
                )}
                {notice.reviewPersonalInfoBy === null && (
                  <Button
                    icon="eyeOff"
                    onClick={() => {
                      review.reset();
                      setReviewArea('personal_information');
                    }}
                  >
                    {t('awards.publicNotice.reviewPersonal')}
                  </Button>
                )}
                <Button
                  variant="primary"
                  icon="globe"
                  disabled={!ready}
                  onClick={() => {
                    publish.reset();
                    setPublishing(true);
                  }}
                >
                  {t('awards.publicNotice.publish')}
                </Button>
                {!ready && (
                  <p className="tiq-text-muted">{t('awards.publicNotice.publishBlocked')}</p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <ConfirmActionDialog
        open={reviewArea !== null}
        title={
          reviewArea === 'personal_information'
            ? t('awards.publicNotice.reviewPersonal')
            : t('awards.publicNotice.reviewConfidentiality')
        }
        scope={scope}
        consequence={t('awards.publicNotice.reviewConsequence')}
        confirmLabel={t('awards.publicNotice.recordReview')}
        reason={{ label: t('awards.common.noteOptional'), required: false }}
        pending={review.pending}
        error={withAwardMessage(review.error)}
        onCancel={() => setReviewArea(null)}
        onConfirm={confirmReview}
      />
      <ConfirmActionDialog
        open={publishing}
        title={t('awards.publicNotice.publishTitle')}
        scope={scope}
        consequence={t('awards.publicNotice.publishConsequence')}
        confirmLabel={t('awards.publicNotice.publish')}
        acknowledgement={t('awards.publicNotice.publishAcknowledgement')}
        pending={publish.pending}
        error={withAwardMessage(publish.error)}
        onCancel={() => setPublishing(false)}
        onConfirm={confirmPublish}
      />
    </div>
  );
}
