/**
 * SUP-10 Tender questions and clarifications, one tender: the question deadline, the supplier's own questions and the
 * buyer's replies, the published answers every participant sees (BR-14), and the issued addenda with the action they
 * require. An outstanding supplement or replacement stays the next action after the acknowledgment (AC-10). Asking a
 * question is a formal communication to the buyer and is confirmed (COM-02).
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type {
  SupplierAddendumDue,
  SupplierAddendumRow,
  SupplierTenderContext,
} from '@contracts/clarifications';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  OfficialDeadline,
  PageHeader,
  Pagination,
  QueryView,
  Reference,
  Select,
  StatusChip,
  Tabs,
  TextArea,
  formErrors,
  useToast,
} from '../../../../components/ui';
import type { DataTableSort } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { SharedAnswerList } from '../../components/shared';
import { SupplierQuestionTable } from '../../components/SupplierQuestionTable';
import { SUPPLIER_PARTICIPATE_PERMISSION, explainError, supplierPaths } from '../../lib';

type TabId = 'questions' | 'answers' | 'addenda';

export default function SupplierTenderPage() {
  const { tenderId } = useParams();
  const id = Number(tenderId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.supplierTender.notFound')} />
        <EmptyState title={t('clarifications.supplierTender.notFound')} />
      </div>
    );
  }
  return <SupplierTenderLoader key={id} tenderId={id} />;
}

function SupplierTenderLoader({ tenderId }: { readonly tenderId: number }) {
  const context = useApiQuery(clarificationsEndpoints.supplierTenderContext, {
    params: { tenderId },
  });
  return (
    <div className="tiq-page">
      {context.data === undefined && (
        <PageHeader
          title={t('clarifications.supplier.title')}
          back={{ to: supplierPaths.overview, label: t('clarifications.supplierTender.back') }}
        />
      )}
      <QueryView query={context}>{(data) => <SupplierTenderWorkspace tender={data} />}</QueryView>
    </div>
  );
}

function SupplierTenderWorkspace({ tender }: { readonly tender: SupplierTenderContext }) {
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const tz = tender.officialTimeZone;
  const canAsk = usePermission(SUPPLIER_PARTICIPATE_PERMISSION);
  const [tab, setTab] = useState<TabId>(
    tender.addendaActionOutstanding > 0 ? 'addenda' : 'questions',
  );
  const [asking, setAsking] = useState(false);
  const [lotId, setLotId] = useState('');
  const [requirementId, setRequirementId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [tried, setTried] = useState(false);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionSort, setQuestionSort] = useState<DataTableSort>({
    key: 'submittedAt',
    dir: 'desc',
  });
  const [answerPage, setAnswerPage] = useState(1);
  const [answerLot, setAnswerLot] = useState('');

  const ask = useApiMutation(clarificationsEndpoints.supplierQuestionsAsk);
  const questions = useApiQuery(clarificationsEndpoints.supplierQuestionsList, {
    query: {
      tenderId: tender.tenderId,
      page: questionPage,
      pageSize: 25,
      sort: questionSort.key as 'submittedAt' | 'status' | 'tenderReference',
      dir: questionSort.dir,
    },
  });
  const answers = useApiQuery(clarificationsEndpoints.supplierPublishedAnswers, {
    params: { tenderId: tender.tenderId },
    query: {
      page: answerPage,
      pageSize: 20,
      sort: 'publishedAt',
      dir: 'desc',
      ...(answerLot === '' ? {} : { lotId: Number(answerLot) }),
    },
  });
  const addenda = useApiQuery(clarificationsEndpoints.supplierAddendaList, {
    query: { tenderId: tender.tenderId, pageSize: 50, sort: 'number', dir: 'desc' },
  });

  const pastDeadline =
    tender.questionsDeadline !== null && Date.parse(tender.questionsDeadline.at) <= now;
  const askErrors = formErrors(ask.error, ['questionText', 'lotId', 'requirementId', 'documentId']);
  const requirements = tender.requirements.filter(
    (item) => lotId === '' || item.lotId === null || String(item.lotId) === lotId,
  );
  const resetAsk = (): void => {
    setAsking(false);
    setTried(false);
    setLotId('');
    setRequirementId('');
    setDocumentId('');
    setQuestionText('');
    ask.reset();
  };

  const nextAction =
    tender.nextAddendumAction !== null ? (
      <AddendumActionDue due={tender.nextAddendumAction} />
    ) : tender.acceptingQuestions && !pastDeadline ? (
      t('clarifications.next.supplier.ask')
    ) : (
      t('clarifications.next.supplier.read')
    );

  return (
    <>
      <PageHeader
        title={t('clarifications.supplierTender.title', { reference: tender.reference })}
        subtitle={`${tender.title} · ${tender.buyer.name}`}
        back={{ to: supplierPaths.overview, label: t('clarifications.supplierTender.back') }}
        meta={
          <>
            <Reference value={tender.reference} />
            <StatusChip enum="tenders.status" value={tender.status} />
            {tender.questionsDeadline !== null && (
              <OfficialDeadline
                variant="block"
                label={t('clarifications.common.questionsDeadline')}
                deadline={tender.questionsDeadline}
                showRemaining
              />
            )}
            {tender.submissionDeadline !== null && (
              <OfficialDeadline
                variant="block"
                label={t('clarifications.common.submissionDeadline')}
                deadline={tender.submissionDeadline}
              />
            )}
            <span>
              <strong>{t('clarifications.common.nextAction')}:</strong> {nextAction}
            </span>
          </>
        }
        primaryAction={
          canAsk && tender.acceptingQuestions ? (
            <Button variant="primary" icon="plus" onClick={() => setAsking(true)}>
              {t('clarifications.supplierTender.ask')}
            </Button>
          ) : undefined
        }
      />

      {!tender.acceptingQuestions && (
        <Banner tone="info" title={t('clarifications.supplierTender.closedForQuestions')} />
      )}
      {tender.addendaActionOutstanding > 0 && (
        <Banner
          tone="warning"
          title={t('clarifications.supplierTender.addendaBanner', {
            count: tender.addendaActionOutstanding,
          })}
        >
          <p>{t('clarifications.supplier.addendaBannerDetail')}</p>
        </Banner>
      )}

      <Card>
        <Tabs
          label={t('clarifications.supplierTender.tabs')}
          selected={tab}
          onSelect={(id) => setTab(id as TabId)}
          tabs={[
            {
              id: 'questions',
              label: t('clarifications.supplier.myQuestions'),
              count: tender.ownQuestions,
            },
            {
              id: 'answers',
              label: t('clarifications.supplierTender.publishedAnswers'),
              count: tender.publishedAnswers,
            },
            {
              id: 'addenda',
              label: t('clarifications.supplierTender.addenda'),
              count: addenda.data?.total,
            },
          ]}
        >
          {tab === 'questions' && (
            <SupplierQuestionTable
              rows={questions.data?.items}
              loading={questions.isFetching}
              error={questions.error}
              onRetry={questions.reload}
              timeZone={tz}
              sort={questionSort}
              onSortChange={(next) => {
                setQuestionSort(next);
                setQuestionPage(1);
              }}
              onOpen={(row) => navigate(supplierPaths.question(row.id))}
              pagination={
                questions.data === undefined
                  ? undefined
                  : {
                      page: questions.data.page,
                      pageSize: questions.data.pageSize,
                      total: questions.data.total,
                      onPageChange: setQuestionPage,
                    }
              }
            />
          )}
          {tab === 'answers' && (
            <div className="tiq-stack tiq-stack--spaced">
              <div className="tiq-inline">
                {tender.lots.length > 0 && (
                  <Select
                    label={t('clarifications.addendumForm.lot')}
                    value={answerLot}
                    onChange={(value) => {
                      setAnswerLot(value);
                      setAnswerPage(1);
                    }}
                    placeholder={t('clarifications.common.allLots')}
                    options={tender.lots.map((lot) => ({
                      value: String(lot.lotId),
                      label: t('clarifications.common.lotLabel', {
                        no: lot.lotNo,
                        title: lot.title,
                      }),
                    }))}
                  />
                )}
                <p className="tiq-text-muted">{t('clarifications.supplierTender.sameForAll')}</p>
              </div>
              <QueryView query={answers}>
                {(page) => (
                  <>
                    <SharedAnswerList answers={page.items} timeZone={tz} />
                    <Pagination
                      page={page.page}
                      pageSize={page.pageSize}
                      total={page.total}
                      onPageChange={setAnswerPage}
                    />
                  </>
                )}
              </QueryView>
            </div>
          )}
          {tab === 'addenda' && (
            <DataTable<SupplierAddendumRow>
              caption={t('clarifications.supplierTender.addenda')}
              rows={addenda.data?.items}
              rowKey={(row) => String(row.id)}
              loading={addenda.isFetching}
              error={addenda.error}
              onRetry={addenda.reload}
              onRowClick={(row) => navigate(supplierPaths.addendum(row.id))}
              rowLabel={(row) =>
                t('clarifications.addenda.rowLabel', {
                  no: row.number,
                  reference: row.tender.reference,
                })
              }
              empty={
                <EmptyState
                  compact
                  icon="fileText"
                  title={t('clarifications.supplierTender.noAddenda')}
                />
              }
              columns={[
                {
                  id: 'addendum',
                  header: t('clarifications.addenda.col.addendum'),
                  cell: (row) => (
                    <>
                      <Reference
                        value={t('clarifications.common.addendumNo', { no: row.number })}
                        to={supplierPaths.addendum(row.id)}
                      />
                      <div className="tiq-cell-sub">{row.title}</div>
                    </>
                  ),
                },
                {
                  id: 'issued',
                  header: t('clarifications.addenda.col.issued'),
                  cell: (row) => formatDateTime(row.issuedAt, tz),
                },
                {
                  id: 'deadline',
                  header: t('clarifications.addenda.col.newDeadline'),
                  cell: (row) =>
                    row.newSubmissionDeadline === null ? (
                      <span className="tiq-text-muted">
                        {t('clarifications.addenda.noDateChange')}
                      </span>
                    ) : (
                      <OfficialDeadline deadline={row.newSubmissionDeadline} showLocal={false} />
                    ),
                },
                {
                  id: 'action',
                  header: t('clarifications.supplierAddendum.requiredAction'),
                  cell: (row) => (
                    <StatusChip
                      enum="addenda.existing_submission_action"
                      value={row.requiredAction}
                      size="sm"
                    />
                  ),
                },
                {
                  id: 'actionStatus',
                  header: t('clarifications.supplierTender.col.actionStatus'),
                  cell: (row) =>
                    row.requiredAction === 'none' ? (
                      <span className="tiq-text-muted">
                        {t('clarifications.supplierAddendum.notRequired')}
                      </span>
                    ) : row.requiredActionCompleted ? (
                      <span className="tiq-text-success">
                        {t('clarifications.addendumPage.actionDone')}
                      </span>
                    ) : (
                      <span className="tiq-text-danger">
                        {t('clarifications.addendumPage.actionOutstanding')}
                      </span>
                    ),
                },
                {
                  id: 'ack',
                  header: t('clarifications.addendumPage.col.acknowledged'),
                  cell: (row) =>
                    row.acknowledgedAt !== null ? (
                      formatDateTime(row.acknowledgedAt, tz)
                    ) : row.acknowledgmentRequired ? (
                      <span className="tiq-text-danger">
                        {t('clarifications.addendumPage.notAcknowledged')}
                      </span>
                    ) : (
                      <span className="tiq-text-muted">
                        {t('clarifications.supplierAddendum.notRequired')}
                      </span>
                    ),
                },
              ]}
            />
          )}
        </Tabs>
      </Card>

      <ConfirmActionDialog
        open={asking}
        title={t('clarifications.supplierTender.askDialog.title')}
        scope={`${tender.reference} · ${tender.title}`}
        consequence={
          pastDeadline
            ? t('clarifications.supplierTender.askDialog.late')
            : t('clarifications.supplierTender.askDialog.consequence', { buyer: tender.buyer.name })
        }
        confirmLabel={t('clarifications.supplierTender.askDialog.confirm')}
        pending={ask.pending}
        error={explainError(ask.error)}
        onCancel={resetAsk}
        onConfirm={async () => {
          setTried(true);
          if (questionText.trim() === '') return;
          try {
            const created = await ask.mutate({
              body: {
                tenderId: tender.tenderId,
                lotId: lotId === '' ? null : Number(lotId),
                requirementId: requirementId === '' ? null : Number(requirementId),
                documentId: documentId === '' ? null : Number(documentId),
                questionText,
              },
            });
            resetAsk();
            toast.show(
              created.afterDeadline
                ? t('clarifications.supplierTender.toast.askedLate')
                : t('clarifications.supplierTender.toast.asked'),
              'success',
            );
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <div className="tiq-form-stack">
          {pastDeadline && (
            <Banner tone="warning" title={t('clarifications.supplierTender.askDialog.lateTitle')} />
          )}
          {tender.lots.length > 0 && (
            <Select
              label={t('clarifications.addendumForm.lot')}
              value={lotId}
              onChange={(value) => {
                setLotId(value);
                setRequirementId('');
              }}
              placeholder={t('clarifications.supplierTender.askDialog.wholeTender')}
              error={askErrors.forField('lotId')}
              options={tender.lots.map((lot) => ({
                value: String(lot.lotId),
                label: t('clarifications.common.lotLabel', { no: lot.lotNo, title: lot.title }),
              }))}
            />
          )}
          <Select
            label={t('clarifications.addendumForm.requirement')}
            value={requirementId}
            onChange={setRequirementId}
            placeholder={t('clarifications.supplierTender.askDialog.noRequirement')}
            error={askErrors.forField('requirementId')}
            options={requirements.map((item) => ({
              value: String(item.requirementId),
              label: `${item.refCode} · ${item.section}`,
            }))}
          />
          <Select
            label={t('clarifications.supplierTender.askDialog.document')}
            value={documentId}
            onChange={setDocumentId}
            placeholder={t('clarifications.supplierTender.askDialog.noDocument')}
            error={askErrors.forField('documentId')}
            options={tender.documents.map((document) => ({
              value: String(document.documentId),
              label: document.title,
            }))}
          />
          <TextArea
            label={t('clarifications.supplierTender.askDialog.question')}
            hint={t('clarifications.supplierTender.askDialog.questionHint')}
            required
            rows={5}
            value={questionText}
            onChange={setQuestionText}
            error={
              askErrors.forField('questionText') ??
              (tried && questionText.trim() === ''
                ? t('clarifications.supplierTender.askDialog.required')
                : undefined)
            }
          />
        </div>
      </ConfirmActionDialog>
    </>
  );
}

/**
 * The next addendum action as a sentence ending with its official deadline: "Supplement your submission for
 * Addendum 1 before 21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone" (DD-33).
 */
function AddendumActionDue({ due }: { readonly due: SupplierAddendumDue }) {
  const key = due.submissionActionOutstanding
    ? due.requiredAction === 'replace'
      ? 'replace'
      : 'supplement'
    : 'acknowledgeNo';
  if (due.dueBy === null) {
    return <>{t(`clarifications.supplierAddendum.required.${due.requiredAction}`)}</>;
  }
  return (
    <>
      {t(`clarifications.next.supplier.${key}`, { no: due.number })}{' '}
      <OfficialDeadline deadline={due.dueBy} showLocal={false} />
    </>
  );
}
