/**
 * BUY-34 restricted financial review panel (AC-08): only financial reviewers and deciders read it (the API returns
 * 403 to anyone else; the assessment workspace leaves the tab out for them, DD-49). It shows the financial thresholds, the financial
 * evidence with reporting periods, currency and consolidation, every recorded review (period, currency,
 * consolidated flag, source, review date, conclusion) and the information requests to the supplier. The assigned
 * financial reviewer records a review or asks for clarification.
 */
import { useState } from 'react';

import { RecordFinancialReviewBody, qualificationEndpoints as api } from '@contracts/qualification';
import type {
  Criterion,
  FinancialReview,
  FinancialReviewPanel as Panel,
  InfoRequest,
} from '@contracts/qualification';
import { FINANCIAL_REVIEWS_CONCLUSION } from '@contracts/enums';
import type { FinancialReviewsConclusion } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  DateInput,
  DetailList,
  Dialog,
  EmptyState,
  FormErrorSummary,
  NumberInput,
  QueryView,
  Select,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { summaryTitle } from '../lib/errors';
import { runCommand } from '../lib/hooks';
import { errorLookup, textOrNull, validateWith } from '../lib/validation';
import { RequestInfoDialog } from './RequestInfoDialog';
import { EvidenceTable, InfoRequestList } from './shared';

export interface FinancialReviewSectionProps {
  readonly applicationId: number;
  readonly reference: string;
  readonly supplierName: string;
  readonly timeZone: string;
  /** From the application's actions: false renders nothing and never calls the API (DD-49). */
  readonly canView: boolean;
  /** Reporting currencies offered by the form options. */
  readonly currencies: readonly string[];
  readonly onInfoRequested: (request: InfoRequest) => void;
}

export function FinancialReviewSection({
  applicationId,
  reference,
  supplierName,
  timeZone,
  canView,
  currencies,
  onInfoRequested,
}: FinancialReviewSectionProps) {
  const query = useApiQuery(api.getFinancialReview, canView ? { params: { applicationId } } : null);
  if (!canView || query.error?.kind === 'forbidden') return null;
  return (
    <QueryView query={query}>
      {(panel) => (
        <PanelView
          panel={panel}
          reference={reference}
          supplierName={supplierName}
          timeZone={timeZone}
          currencies={currencies}
          onInfoRequested={onInfoRequested}
        />
      )}
    </QueryView>
  );
}

function PanelView({
  panel,
  reference,
  supplierName,
  timeZone,
  currencies,
  onInfoRequested,
}: {
  readonly panel: Panel;
  readonly reference: string;
  readonly supplierName: string;
  readonly timeZone: string;
  readonly currencies: readonly string[];
  readonly onInfoRequested: (request: InfoRequest) => void;
}) {
  const toast = useToast();
  const [recorded, setRecorded] = useState<readonly FinancialReview[]>([]);
  const [asked, setAsked] = useState<readonly InfoRequest[]>([]);
  const [dialog, setDialog] = useState<'record' | 'ask' | null>(null);
  const reviews = [...recorded, ...panel.reviews];
  const requests = [...asked, ...panel.infoRequests];

  return (
    <div className="tiq-stack">
      <Banner tone="info" title={t('qualification.financial.confidentialTitle')}>
        {t('qualification.financial.confidential', {
          reviewer: panel.financialReviewer?.fullName ?? t('qualification.financial.noReviewer'),
        })}
      </Banner>
      <Card
        title={t('qualification.financial.reviewsTitle')}
        actions={
          panel.canRecord ? (
            <>
              <Button icon="messageQuestion" onClick={() => setDialog('ask')}>
                {t('qualification.financial.ask')}
              </Button>
              <Button variant="primary" icon="plus" onClick={() => setDialog('record')}>
                {t('qualification.financial.record')}
              </Button>
            </>
          ) : undefined
        }
      >
        {reviews.length === 0 ? (
          <EmptyState compact title={t('qualification.financial.noReviews')} />
        ) : (
          <div className="tiq-stack">
            {reviews.map((review) => (
              <ReviewView key={review.id} review={review} timeZone={timeZone} />
            ))}
          </div>
        )}
      </Card>
      <Card title={t('qualification.financial.thresholdsTitle')}>
        <CriteriaList criteria={panel.financialCriteria} />
      </Card>
      <Card title={t('qualification.financial.evidenceTitle')} flush>
        <EvidenceTable
          evidence={panel.financialEvidence}
          timeZone={timeZone}
          caption={t('qualification.financial.evidenceTitle')}
        />
      </Card>
      <Card title={t('qualification.financial.requestsTitle')}>
        <InfoRequestList requests={requests} timeZone={timeZone} />
      </Card>
      {dialog === 'record' && (
        <RecordFinancialReviewDialog
          applicationId={panel.applicationId}
          reference={reference}
          currencies={currencies}
          onClose={() => setDialog(null)}
          onRecorded={(review) => {
            setRecorded((previous) => [review, ...previous]);
            setDialog(null);
            toast.show(
              t('qualification.financial.recorded', {
                conclusion: tEnum('financial_reviews.conclusion', review.conclusion),
              }),
              'success',
            );
          }}
        />
      )}
      {dialog === 'ask' && (
        <RequestInfoDialog
          applicationId={panel.applicationId}
          reference={reference}
          supplierName={supplierName}
          timeZone={timeZone}
          criteria={panel.financialCriteria}
          initialCriterionId={panel.financialCriteria[0]?.id ?? null}
          onClose={() => setDialog(null)}
          onRequested={(result) => {
            setAsked((previous) => [result.infoRequest, ...previous]);
            onInfoRequested(result.infoRequest);
            setDialog(null);
            toast.show(
              t('qualification.requestInfo.done', {
                reference,
                status: tEnum('qualification_applications.status', result.applicationStatus),
              }),
              'success',
            );
          }}
        />
      )}
    </div>
  );
}

function CriteriaList({ criteria }: { readonly criteria: readonly Criterion[] }) {
  if (criteria.length === 0) {
    return <EmptyState compact title={t('qualification.financial.noThresholds')} />;
  }
  return (
    <DetailList
      stacked
      items={criteria.map((criterion) => ({
        key: String(criterion.id),
        label: criterion.question,
        value: criterion.thresholdDescription ?? t('qualification.financial.noThreshold'),
      }))}
    />
  );
}

function ReviewView({
  review,
  timeZone,
}: {
  readonly review: FinancialReview;
  readonly timeZone: string;
}) {
  return (
    <section
      className="tiq-stack"
      aria-label={t('qualification.financial.reviewLabel', {
        date: formatDateTime(review.reviewedAt, timeZone),
      })}
    >
      <div className="tiq-inline">
        <StatusChip enum="financial_reviews.conclusion" value={review.conclusion} />
        <span className="tiq-text-muted">
          {t('qualification.financial.reviewedBy', {
            name: review.reviewer.fullName,
            at: formatDateTime(review.reviewedAt, timeZone),
          })}
        </span>
      </div>
      <DetailList
        items={[
          {
            label: t('qualification.financial.periodEnd'),
            value: formatCalendarDate(review.financialPeriodEnd),
          },
          { label: t('qualification.financial.currency'), value: review.reportingCurrency },
          {
            label: t('qualification.financial.consolidated'),
            value: review.isConsolidated
              ? t('qualification.financial.consolidatedYes')
              : t('qualification.financial.consolidatedNo'),
          },
          { label: t('qualification.financial.source'), value: review.source },
          {
            label: t('qualification.financial.turnover'),
            value:
              review.turnover === null
                ? null
                : `${review.reportingCurrency} ${formatDecimalString(review.turnover, 2)}`,
          },
          {
            label: t('qualification.financial.currentRatio'),
            value:
              review.currentRatio === null ? null : formatDecimalString(review.currentRatio, 2),
          },
          {
            label: t('qualification.financial.debtToEquity'),
            value:
              review.debtToEquity === null ? null : formatDecimalString(review.debtToEquity, 2),
          },
          {
            label: t('qualification.financial.parentSupport'),
            value: review.parentSupportEvidence,
          },
          {
            label: t('qualification.financial.qualifications'),
            value: review.materialQualifications,
          },
          { label: t('qualification.financial.rationale'), value: review.rationale },
        ]}
      />
    </section>
  );
}

const FIELDS = [
  'financialPeriodEnd',
  'reportingCurrency',
  'isConsolidated',
  'source',
  'turnover',
  'currentRatio',
  'debtToEquity',
  'parentSupportEvidence',
  'materialQualifications',
  'conclusion',
  'rationale',
];

function RecordFinancialReviewDialog({
  applicationId,
  reference,
  currencies,
  onClose,
  onRecorded,
}: {
  readonly applicationId: number;
  readonly reference: string;
  readonly currencies: readonly string[];
  readonly onClose: () => void;
  readonly onRecorded: (review: FinancialReview) => void;
}) {
  const record = useApiMutation(api.recordFinancialReview);
  const [periodEnd, setPeriodEnd] = useState('');
  const [currency, setCurrency] = useState(currencies[0] ?? '');
  const [consolidated, setConsolidated] = useState(false);
  const [source, setSource] = useState('');
  const [turnover, setTurnover] = useState('');
  const [currentRatio, setCurrentRatio] = useState('');
  const [debtToEquity, setDebtToEquity] = useState('');
  const [parentSupport, setParentSupport] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [conclusion, setConclusion] = useState<FinancialReviewsConclusion | ''>('');
  const [rationale, setRationale] = useState('');
  const [tried, setTried] = useState(false);

  const body = {
    financialPeriodEnd: periodEnd === '' ? undefined : periodEnd,
    reportingCurrency: currency,
    isConsolidated: consolidated,
    source,
    turnover: textOrNull(turnover),
    currentRatio: textOrNull(currentRatio),
    debtToEquity: textOrNull(debtToEquity),
    parentSupportEvidence: textOrNull(parentSupport),
    materialQualifications: textOrNull(qualifications),
    conclusion: conclusion === '' ? undefined : conclusion,
    rationale,
  };
  const errors = errorLookup(
    tried ? validateWith(RecordFinancialReviewBody, body) : [],
    record.error,
    FIELDS,
  );
  const dirty = periodEnd !== '' || source !== '' || rationale !== '' || conclusion !== '';

  const submit = (): void => {
    setTried(true);
    const parsed = RecordFinancialReviewBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () => record.mutate({ params: { applicationId }, body: parsed.data }),
      onRecorded,
    );
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('qualification.financial.recordTitle', { reference })}
      onClose={onClose}
      dismissible={!record.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={record.pending}>
            {t('qualification.common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={record.pending}>
            {t('qualification.financial.recordConfirm')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !record.pending} />
      <FormErrorSummary title={summaryTitle(record.error)} errors={errors.other} />
      <div className="tiq-form-grid">
        <DateInput
          label={t('qualification.financial.periodEnd')}
          required
          value={periodEnd}
          onChange={setPeriodEnd}
          error={errors.forField('financialPeriodEnd')}
        />
        <Select
          label={t('qualification.financial.currency')}
          required
          value={currency}
          onChange={setCurrency}
          error={errors.forField('reportingCurrency')}
          options={currencies.map((code) => ({ value: code, label: code }))}
        />
        <div className="tiq-form-full">
          <Checkbox
            label={t('qualification.financial.consolidatedLabel')}
            hint={t('qualification.financial.consolidatedHint')}
            checked={consolidated}
            onChange={setConsolidated}
            error={errors.forField('isConsolidated')}
          />
        </div>
        <TextArea
          label={t('qualification.financial.source')}
          hint={t('qualification.financial.sourceHint')}
          required
          rows={2}
          value={source}
          onChange={setSource}
          error={errors.forField('source')}
          fieldClassName="tiq-form-full"
        />
        <NumberInput
          label={t('qualification.financial.turnover')}
          places={2}
          suffix={currency}
          value={turnover}
          onChange={setTurnover}
          error={errors.forField('turnover')}
        />
        <NumberInput
          label={t('qualification.financial.currentRatio')}
          places={2}
          value={currentRatio}
          onChange={setCurrentRatio}
          error={errors.forField('currentRatio')}
        />
        <NumberInput
          label={t('qualification.financial.debtToEquity')}
          places={2}
          value={debtToEquity}
          onChange={setDebtToEquity}
          error={errors.forField('debtToEquity')}
        />
        <Select
          label={t('qualification.financial.conclusion')}
          required
          placeholder={t('qualification.common.select')}
          value={conclusion}
          onChange={(value) => setConclusion(value as FinancialReviewsConclusion)}
          error={errors.forField('conclusion')}
          options={FINANCIAL_REVIEWS_CONCLUSION.map((value) => ({
            value,
            label: tEnum('financial_reviews.conclusion', value),
          }))}
        />
        <TextArea
          label={t('qualification.financial.parentSupport')}
          hint={t('qualification.financial.parentSupportHint')}
          rows={2}
          value={parentSupport}
          onChange={setParentSupport}
          error={errors.forField('parentSupportEvidence')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('qualification.financial.qualifications')}
          hint={t('qualification.financial.qualificationsHint')}
          required={conclusion !== '' && conclusion !== 'adequate'}
          rows={2}
          value={qualifications}
          onChange={setQualifications}
          error={errors.forField('materialQualifications')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('qualification.financial.rationale')}
          required
          rows={3}
          value={rationale}
          onChange={setRationale}
          error={errors.forField('rationale')}
          fieldClassName="tiq-form-full"
        />
      </div>
    </Dialog>
  );
}
