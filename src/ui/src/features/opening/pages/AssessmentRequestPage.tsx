/**
 * SUP-18 — One assessment request: the buyer's question or invitation, the permitted scope of the answer, the
 * official deadline and the response history. The supplier answers (or confirms participation) within the scope;
 * the answer is attached to this request and never replaces or improves the submitted bid (BR-22). The response is
 * sent only on submission, which confirms the organization, capacity, scope and result (COM-02).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import {
  ASSESSMENT_REQUEST_RESPOND_PERMISSION,
  RespondAssessmentRequestBody,
  openingEndpoints,
} from '@contracts/opening';
import type { AssessmentRequestDetail } from '@contracts/opening';
import type { FieldError } from '@contracts/common';

import { useActiveTenant } from '../../../app/hooks';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { DownloadVersionButton } from '../../../components/documents';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  FormErrorSummary,
  OfficialDeadline,
  PageHeader,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { LoadingFrame } from '../components/LoadingFrame';
import { RecordNotFound } from '../components/RecordNotFound';
import { withBusinessMessage } from '../lib/errors';
import { idParam, openingPaths } from '../lib/paths';
import { formFeedback, validateBody } from '../lib/validation';

const FIELDS = ['responseText', 'attachments', 'offerUnchangedConfirmed'] as const;

function ResponseForm({
  request,
  onSubmitted,
}: {
  readonly request: AssessmentRequestDetail;
  readonly onSubmitted: (request: AssessmentRequestDetail) => void;
}) {
  const toast = useToast();
  const mutation = useApiMutation(openingEndpoints.respondAssessmentRequest);
  const [responseText, setResponseText] = useState('');
  const [offerUnchanged, setOfferUnchanged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const feedback = formFeedback(clientErrors, mutation.error, FIELDS);
  const dirty = responseText !== '';
  const body = { responseText, attachments: [], offerUnchangedConfirmed: offerUnchanged };

  const review = (): void => {
    const checked = validateBody(RespondAssessmentRequestBody, body);
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    mutation.reset();
    setConfirming(true);
  };

  return (
    <div className="tiq-form-stack">
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <Banner tone="warning" title={t('opening.respond.notSentTitle')}>
        {t('opening.respond.notSent')}
      </Banner>
      <TextArea
        label={t('opening.respond.text')}
        hint={t('opening.respond.textHint', { scope: request.permittedScope })}
        required
        rows={8}
        value={responseText}
        onChange={setResponseText}
        error={feedback.forField('responseText')}
      />
      <Checkbox
        label={t('opening.respond.offerUnchanged')}
        hint={t('opening.respond.offerUnchangedHint')}
        checked={offerUnchanged}
        onChange={setOfferUnchanged}
        error={feedback.forField('offerUnchangedConfirmed')}
      />
      <FormErrorSummary errors={feedback.other} />
      <div className="tiq-inline">
        <Button variant="primary" icon="send" onClick={review}>
          {t('opening.respond.submit')}
        </Button>
      </div>
      <ConfirmActionDialog
        key={`respond-${String(confirming)}`}
        open={confirming}
        title={t('opening.respond.confirmTitle')}
        scope={t('opening.respond.scope', {
          request: request.reference,
          reference: request.tenderReference,
          buyer: request.buyer.name,
        })}
        consequence={t('opening.respond.result')}
        confirmLabel={t('opening.respond.submit')}
        pending={mutation.pending}
        error={withBusinessMessage(mutation.error)}
        onCancel={() => {
          mutation.reset();
          setConfirming(false);
        }}
        onConfirm={async () => {
          const checked = validateBody(RespondAssessmentRequestBody, body);
          if (!checked.ok) {
            setClientErrors(checked.errors);
            setConfirming(false);
            return;
          }
          try {
            const result = await mutation.mutate({
              params: { requestId: request.id },
              body: checked.data,
            });
            setConfirming(false);
            invalidateApiQueries('supplier.opening.listAssessmentRequests');
            toast.show(t('opening.respond.done'), 'success');
            onSubmitted(result);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <blockquote>{responseText}</blockquote>
      </ConfirmActionDialog>
    </div>
  );
}

function RequestView({ requestId }: { readonly requestId: number }) {
  const query = useApiQuery(openingEndpoints.getAssessmentRequest, { params: { requestId } });
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canRespond = usePermission(ASSESSMENT_REQUEST_RESPOND_PERMISSION);
  const [latest, setLatest] = useState<AssessmentRequestDetail | null>(null);
  const back = { to: openingPaths.requests, label: t('opening.supplier.back') };

  return (
    <LoadingFrame title={t('opening.supplier.loadingTitle')} back={back} query={query}>
      {(fetched) => {
        const request = latest ?? fetched;
        const open = request.status === 'issued';
        // Without submission authority an open request shows no response panel at all (DD-49).
        const showResponse = request.responseText !== null || !open || canRespond;
        const requestCard = (
          <Card title={t('opening.supplier.request')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'question',
                  label: t('opening.columns.question'),
                  value: request.question,
                },
                {
                  key: 'scope',
                  label: t('opening.raise.scope'),
                  value: request.permittedScope,
                },
                { key: 'buyer', label: t('opening.supplier.buyer'), value: request.buyer.name },
                {
                  key: 'due',
                  label: t('opening.columns.due'),
                  value:
                    request.dueAt === null ? null : (
                      <OfficialDeadline deadline={request.dueAt} variant="block" />
                    ),
                },
              ]}
            />
          </Card>
        );
        return (
          <div className="tiq-page">
            <PageHeader
              title={t('opening.supplier.detailTitle', {
                type: tEnum('bid_clarifications.source', request.source),
                reference: request.reference,
              })}
              subtitle={request.tenderTitle}
              back={back}
              meta={
                <>
                  <span>{request.buyer.name}</span>
                  <span className="tiq-mono">{request.tenderReference}</span>
                  <StatusChip enum="bid_clarifications.status" value={request.status} />
                  {request.dueAt !== null && (
                    <OfficialDeadline
                      deadline={request.dueAt}
                      label={t('opening.columns.due')}
                      showRemaining={open}
                    />
                  )}
                  <span>
                    <strong>{t('opening.common.nextAction')}</strong>{' '}
                    {t(`opening.supplier.next.${request.status}`)}
                  </span>
                </>
              }
            />
            <Banner tone="info" title={t('opening.br22.title')}>
              {t('opening.br22.supplier')}
            </Banner>
            {showResponse ? (
              <div className="tiq-grid tiq-grid--2">
                {requestCard}
                <Card title={t('opening.supplier.response')}>
                  {request.responseText !== null ? (
                    <div className="tiq-stack">
                      <Banner tone="success" title={t('opening.respond.submittedTitle')}>
                        {request.respondedAt === null
                          ? t('opening.respond.submitted')
                          : t('opening.respond.submittedAt', {
                              who: request.respondedBy?.fullName ?? '',
                              at: formatOfficialTime(request.respondedAt, timeZone),
                            })}
                      </Banner>
                      <p>{request.responseText}</p>
                      {request.attachments.length > 0 && (
                        <ul className="tiq-stack">
                          {request.attachments.map((file) => (
                            <li key={file.versionId} className="tiq-inline">
                              <span>{file.title}</span>
                              <DownloadVersionButton
                                documentId={file.documentId}
                                versionId={file.versionId}
                                fileName={file.fileName}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : open ? (
                    <ResponseForm request={request} onSubmitted={setLatest} />
                  ) : (
                    <EmptyState compact icon="clock" title={t('opening.respond.closed')} />
                  )}
                </Card>
              </div>
            ) : (
              requestCard
            )}
          </div>
        );
      }}
    </LoadingFrame>
  );
}

export default function AssessmentRequestPage() {
  const params = useParams();
  const requestId = idParam(params.requestId);
  if (requestId === null) {
    return (
      <RecordNotFound
        title={t('opening.supplier.loadingTitle')}
        back={{ to: openingPaths.requests, label: t('opening.supplier.back') }}
      />
    );
  }
  return <RequestView key={requestId} requestId={requestId} />;
}
