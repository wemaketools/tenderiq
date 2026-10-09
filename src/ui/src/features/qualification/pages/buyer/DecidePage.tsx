/**
 * BUY-35 — Record the qualification decision (FR-06, BR-24; AC-08): a decider approves, approves with conditions or
 * rejects a decision-pending application, starting from the assessor's recommendation. The decision states scope,
 * limits, dates, conditions with the allowed activities and the blocked gate, internal reasons, the supplier
 * explanation and the appeal route, and optionally notifies the supplier. The restricted financial review stays
 * one tab away for the decider.
 */
import { useState } from 'react';

import { DecideApplicationBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { BuyerApplicationDetail, DecisionDetail } from '@contracts/qualification';
import type { QualificationDecisionsOutcome } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../../api/hooks';
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
  RestrictedState,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { DecisionFormFields } from '../../components/DecisionForm';
import { DecisionTerms } from '../../components/DecisionTerms';
import { FinancialReviewSection } from '../../components/FinancialReviewPanel';
import { calendarDateIn } from '../../lib/dates';
import {
  DECISION_FIELDS,
  decisionFields,
  seedDraft,
  useDecisionDraft,
} from '../../lib/decisionDraft';
import { summaryTitle, withQualificationMessage } from '../../lib/errors';
import { runCommand, useDefaultCurrency, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { buyerQualificationPaths } from '../../lib/paths';
import { gateText, scopeText } from '../../lib/text';
import { errorLookup, validateWith } from '../../lib/validation';

const OUTCOMES: readonly QualificationDecisionsOutcome[] = [
  'qualified',
  'qualified_with_conditions',
  'not_qualified',
];

export default function DecidePage() {
  const applicationId = useIdParam('applicationId');
  const query = useApiQuery(
    api.getApplication,
    applicationId === null ? null : { params: { applicationId } },
  );
  const [recorded, setRecorded] = useState<DecisionDetail | null>(null);
  return (
    <div className="tiq-page">
      {(applicationId === null || query.error?.kind === 'not_found') && (
        <>
          <PageHeader
            title={t('qualification.decide.notFound')}
            back={{ to: buyerQualificationPaths.queue, label: t('qualification.assessment.back') }}
          />
          <EmptyState title={t('qualification.decide.notFound')} />
        </>
      )}
      {applicationId !== null && query.error?.kind === 'forbidden' && (
        <RestrictedState description={t('qualification.decide.restricted')} />
      )}
      {applicationId !== null &&
        query.error?.kind !== 'not_found' &&
        query.error?.kind !== 'forbidden' && (
          <QueryView query={query}>
            {(application) =>
              recorded !== null ? (
                <RecordedView application={application} decision={recorded} />
              ) : (
                <DecideForm application={application} onRecorded={setRecorded} />
              )
            }
          </QueryView>
        )}
    </div>
  );
}

function DecideForm({
  application,
  onRecorded,
}: {
  readonly application: BuyerApplicationDetail;
  readonly onRecorded: (decision: DecisionDetail) => void;
}) {
  const toast = useToast();
  const now = useNow();
  const officialTimeZone = useOfficialTimeZone();
  const defaultCurrency = useDefaultCurrency();
  const timeZone = application.dueAt?.timeZone ?? officialTimeZone;
  const options = useApiQuery(api.getQualificationOptions, {});
  const decide = useApiMutation(api.decideApplication);
  const recommendation = application.recommendation;
  const { draft, setDraft, dirty } = useDecisionDraft(() =>
    seedDraft({
      outcome: recommendation?.proposedOutcome ?? '',
      categoryId: recommendation?.scopeCategory.categoryId ?? application.scopeCategory.categoryId,
      maxValue: recommendation?.scopeMaxValue ?? application.scopeMaxValue,
      geography: recommendation?.scopeGeography ?? application.scopeGeography,
      conditions: recommendation?.conditions ?? null,
      allowedActivities: recommendation?.allowedActivities ?? null,
      blockedGate: recommendation?.blockedGate ?? 'none',
      effectiveFrom: calendarDateIn(now, timeZone),
      currency: application.scopeMaxValue?.currency ?? defaultCurrency,
    }),
  );
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showFinancial, setShowFinancial] = useState(false);

  const body = decisionFields(draft);
  const errors = errorLookup(
    tried ? validateWith(DecideApplicationBody, body) : [],
    confirming ? null : decide.error,
    DECISION_FIELDS,
  );
  const canDecide = application.actions.canDecide && application.status === 'decision_pending';
  const category = application.programCoveredCategories.find(
    (item) => String(item.categoryId) === draft.scope.categoryId,
  );

  const review = (): void => {
    setTried(true);
    if (!DecideApplicationBody.safeParse(body).success) return;
    decide.reset();
    setConfirming(true);
  };

  return (
    <>
      <PageHeader
        title={t('qualification.decide.title', { reference: application.reference })}
        subtitle={t('qualification.decide.subtitle', { supplier: application.supplier.name })}
        back={{
          to: buyerQualificationPaths.application(application.id),
          label: t('qualification.decide.back'),
        }}
        meta={
          <>
            <StatusChip enum="qualification_applications.status" value={application.status} />
            <span>
              {t('qualification.common.programVersion', {
                name: application.program.programName,
                no: application.program.versionNo,
              })}
            </span>
            {application.actions.canDecide && (
              <span>
                {t('qualification.common.nextAction', {
                  action: canDecide
                    ? t('qualification.next.decide')
                    : t('qualification.decide.notPending'),
                })}
              </span>
            )}
          </>
        }
        primaryAction={
          canDecide ? (
            <Button variant="primary" icon="gavel" onClick={review}>
              {t('qualification.decide.review')}
            </Button>
          ) : undefined
        }
        actions={
          application.actions.canViewFinancialReview ? (
            <Button
              icon="lock"
              onClick={() => setShowFinancial((value) => !value)}
              aria-expanded={showFinancial}
            >
              {showFinancial
                ? t('qualification.decide.hideFinancial')
                : t('qualification.decide.showFinancial')}
            </Button>
          ) : undefined
        }
      />
      {application.actions.canDecide && !canDecide && (
        <Banner tone="warning" title={t('qualification.decide.cannotTitle')}>
          {t('qualification.decide.notPendingDetail', {
            status: tEnum('qualification_applications.status', application.status),
          })}
        </Banner>
      )}
      <Card title={t('qualification.decide.recommendationTitle')}>
        {recommendation === null ? (
          <EmptyState compact title={t('qualification.assessment.noRecommendation')} />
        ) : (
          <DetailList
            items={[
              {
                label: t('qualification.terms.outcome'),
                value: tEnum('qualification_decisions.outcome', recommendation.proposedOutcome),
              },
              {
                label: t('qualification.terms.scope'),
                value: scopeText(
                  recommendation.scopeCategory,
                  recommendation.scopeMaxValue,
                  recommendation.scopeGeography,
                ),
              },
              { label: t('qualification.terms.conditions'), value: recommendation.conditions },
              {
                label: t('qualification.terms.allowedActivities'),
                value: recommendation.allowedActivities,
              },
              {
                label: t('qualification.terms.blockedGate'),
                value: gateText(recommendation.blockedGate),
              },
              { label: t('qualification.recommend.rationale'), value: recommendation.rationale },
              {
                label: t('qualification.assessment.recommendedBy'),
                value: `${recommendation.recommendedBy.fullName} · ${formatDateTime(recommendation.recommendedAt, timeZone)}`,
              },
            ]}
          />
        )}
      </Card>
      {showFinancial && (
        <FinancialReviewSection
          applicationId={application.id}
          reference={application.reference}
          supplierName={application.supplier.name}
          timeZone={timeZone}
          canView={application.actions.canViewFinancialReview}
          currencies={options.data?.currencies ?? []}
          onInfoRequested={() => toast.show(t('qualification.decide.infoRequested'), 'success')}
        />
      )}
      {canDecide && (
        <Card
          title={t('qualification.decide.formTitle')}
          subtitle={t('qualification.decide.formHint')}
        >
          <FormErrorSummary
            title={confirming ? null : summaryTitle(decide.error)}
            errors={errors.other}
          />
          <DecisionFormFields
            draft={draft}
            onChange={setDraft}
            outcomes={OUTCOMES}
            categories={application.programCoveredCategories}
            currencies={options.data?.currencies ?? [draft.scope.maxValue.currency]}
            errors={errors}
            dirty={dirty && !decide.pending}
          />
          <div className="tiq-inline">
            <ButtonLink to={buyerQualificationPaths.application(application.id)}>
              {t('qualification.common.cancel')}
            </ButtonLink>
            <Button variant="primary" icon="gavel" onClick={review}>
              {t('qualification.decide.review')}
            </Button>
          </div>
        </Card>
      )}
      {confirming && (
        <ConfirmActionDialog
          open
          title={t('qualification.decide.confirmTitle')}
          scope={t('qualification.decide.scope', {
            reference: application.reference,
            supplier: application.supplier.name,
            outcome:
              draft.outcome === '' ? '' : tEnum('qualification_decisions.outcome', draft.outcome),
            terms: scopeText(
              category ?? application.scopeCategory,
              body.scopeMaxValue,
              body.scopeGeography,
            ),
          })}
          consequence={t('qualification.decide.consequence', {
            from: formatCalendarDate(draft.effectiveFrom),
            to:
              draft.effectiveTo === ''
                ? t('qualification.terms.openEnded')
                : formatCalendarDate(draft.effectiveTo),
            gate: gateText(draft.terms.blockedGate),
            notice: draft.notifySupplier
              ? t('qualification.decide.notified')
              : t('qualification.decide.notNotified'),
          })}
          confirmLabel={t('qualification.decide.confirm')}
          pending={decide.pending}
          error={withQualificationMessage(decide.error)}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            const parsed = DecideApplicationBody.safeParse(body);
            if (!parsed.success) return;
            return runCommand(
              () => decide.mutate({ params: { applicationId: application.id }, body: parsed.data }),
              (decision) => {
                setConfirming(false);
                invalidateApiQueries('buyer.qualification.');
                toast.show(
                  t('qualification.decide.done', {
                    outcome: tEnum('qualification_decisions.outcome', decision.outcome),
                  }),
                  'success',
                );
                onRecorded(decision);
              },
            );
          }}
        />
      )}
    </>
  );
}

function RecordedView({
  application,
  decision,
}: {
  readonly application: BuyerApplicationDetail;
  readonly decision: DecisionDetail;
}) {
  const officialTimeZone = useOfficialTimeZone();
  const timeZone = application.dueAt?.timeZone ?? officialTimeZone;
  return (
    <>
      <PageHeader
        title={t('qualification.decide.recordedTitle', { reference: application.reference })}
        back={{
          to: buyerQualificationPaths.monitoring,
          label: t('qualification.decide.toMonitoring'),
        }}
        meta={<StatusChip enum="qualification_decisions.outcome" value={decision.outcome} />}
      />
      <Banner tone="success" title={t('qualification.decide.recordedBanner')}>
        {t('qualification.decide.recordedDetail', {
          at: formatDateTime(decision.decidedAt, timeZone),
        })}
      </Banner>
      <Card title={t('qualification.decision.termsTitle')}>
        <DecisionTerms decision={decision} timeZone={timeZone} />
      </Card>
    </>
  );
}
