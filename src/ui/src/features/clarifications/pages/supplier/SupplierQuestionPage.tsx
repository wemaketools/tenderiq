/**
 * SUP-10 Tender questions and clarifications, one of the supplier's own questions: what was asked and when, whether
 * it was late and how the buyer decided, the handling status, and the reply (shared under sanitized wording, answered
 * privately, or absorbed into an addendum). The supplier may withdraw a question that is still unanswered.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { SupplierQuestionDetail } from '@contracts/clarifications';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import {
  SUPPLIER_PARTICIPATE_PERMISSION,
  explainError,
  isQuestionClosed,
  subjectLabel,
  supplierPaths,
} from '../../lib';

export default function SupplierQuestionPage() {
  const { questionId } = useParams();
  const id = Number(questionId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.questionPage.notFound')} />
        <EmptyState title={t('clarifications.questionPage.notFound')} />
      </div>
    );
  }
  return <SupplierQuestionLoader key={id} questionId={id} />;
}

function SupplierQuestionLoader({ questionId }: { readonly questionId: number }) {
  const query = useApiQuery(clarificationsEndpoints.supplierQuestionsGet, {
    params: { questionId },
  });
  const [result, setResult] = useState<SupplierQuestionDetail | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('clarifications.questionPage.title', { id: questionId })}
          back={{ to: supplierPaths.overview, label: t('clarifications.supplierTender.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => <SupplierQuestionView question={result ?? data} onChanged={setResult} />}
      </QueryView>
    </div>
  );
}

function SupplierQuestionView({
  question,
  onChanged,
}: {
  readonly question: SupplierQuestionDetail;
  readonly onChanged: (next: SupplierQuestionDetail) => void;
}) {
  const toast = useToast();
  const canWithdraw = usePermission(SUPPLIER_PARTICIPATE_PERMISSION);
  const [confirming, setConfirming] = useState(false);
  const withdraw = useApiMutation(clarificationsEndpoints.supplierQuestionsWithdraw);
  const tz = question.timeZone;
  const open = !isQuestionClosed(question.status);

  return (
    <>
      <PageHeader
        title={t('clarifications.questionPage.title', { id: question.id })}
        subtitle={`${question.tender.reference} · ${question.tender.title}`}
        back={{
          to: supplierPaths.tender(question.tender.tenderId),
          label: t('clarifications.supplierQuestion.back', {
            reference: question.tender.reference,
          }),
        }}
        meta={
          <>
            <Reference
              value={question.tender.reference}
              to={supplierPaths.tender(question.tender.tenderId)}
            />
            <StatusChip enum="questions.status" value={question.status} />
            <span>
              <strong>{t('clarifications.common.nextAction')}:</strong>{' '}
              {open ? t('clarifications.next.supplier.awaitReply') : t('clarifications.next.none')}
            </span>
          </>
        }
        actions={
          open && canWithdraw ? (
            <Button variant="danger-soft" icon="x" onClick={() => setConfirming(true)}>
              {t('clarifications.supplierQuestion.withdraw')}
            </Button>
          ) : undefined
        }
      />

      {question.afterDeadline && (
        <Banner
          tone={question.lateDisposition === 'declined' ? 'error' : 'warning'}
          title={
            question.lateDisposition === null
              ? t('clarifications.supplierQuestion.lateAwaiting')
              : t(`clarifications.supplierQuestion.late.${question.lateDisposition}`)
          }
        >
          {question.lateDispositionReason !== null && <p>{question.lateDispositionReason}</p>}
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('clarifications.supplierQuestion.asked')}>
          <div className="tiq-stack">
            <p>{question.questionText}</p>
            <DetailList
              items={[
                {
                  key: 'subject',
                  label: t('clarifications.supplier.col.subject'),
                  value: subjectLabel(question),
                },
                {
                  key: 'askedBy',
                  label: t('clarifications.questionPage.askedBy'),
                  value: question.askedBy.fullName,
                },
                {
                  key: 'submitted',
                  label: t('clarifications.questionPage.submitted'),
                  value: formatDateTime(question.submittedAt, tz),
                },
                {
                  key: 'buyer',
                  label: t('clarifications.supplier.col.buyer'),
                  value: question.buyer.name,
                },
              ]}
            />
          </div>
        </Card>
        <Card title={t('clarifications.supplierQuestion.reply')}>
          {question.answerText !== null ? (
            <div className="tiq-stack">
              <p>{question.answerText}</p>
              <DetailList
                items={[
                  {
                    key: 'audience',
                    label: t('clarifications.questionPage.audience'),
                    value:
                      question.answerAudience === null
                        ? null
                        : t(`clarifications.supplier.replyAudience.${question.answerAudience}`),
                  },
                  {
                    key: 'sanitized',
                    label: t('clarifications.supplierQuestion.sharedWording'),
                    value: question.sanitizedQuestion,
                  },
                  {
                    key: 'answered',
                    label: t('clarifications.supplierQuestion.answeredAt'),
                    value: formatDateTime(question.answeredAt, tz),
                  },
                ]}
              />
            </div>
          ) : question.addendumNumber !== null ? (
            <Banner
              tone="info"
              title={t('clarifications.supplier.inAddendum', { no: question.addendumNumber })}
            >
              <p>{t('clarifications.supplierQuestion.addendumHint')}</p>
            </Banner>
          ) : (
            <EmptyState
              compact
              icon="hourglass"
              title={
                open
                  ? t('clarifications.supplierQuestion.awaiting')
                  : t('clarifications.supplierQuestion.noReply')
              }
            />
          )}
        </Card>
      </div>

      <ConfirmActionDialog
        open={confirming}
        tone="danger"
        title={t('clarifications.supplierQuestion.withdrawDialog.title')}
        scope={t('clarifications.questionPage.scope', {
          id: question.id,
          reference: question.tender.reference,
        })}
        consequence={t('clarifications.supplierQuestion.withdrawDialog.consequence')}
        confirmLabel={t('clarifications.supplierQuestion.withdraw')}
        pending={withdraw.pending}
        error={explainError(withdraw.error)}
        reason={{ label: t('clarifications.common.reason'), required: false }}
        onCancel={() => {
          withdraw.reset();
          setConfirming(false);
        }}
        onConfirm={async ({ reason }) => {
          try {
            const next = await withdraw.mutate({
              params: { questionId: question.id },
              body: reason === '' ? {} : { reason },
            });
            onChanged(next);
            setConfirming(false);
            toast.show(t('clarifications.supplierQuestion.withdrawn'), 'success');
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </>
  );
}
