/**
 * CON-07 — Performance and improvement: measures, service reviews, incidents and complaints, the supplier's response,
 * scorecards and corrective actions. Assess a period, share it with the supplier for discussion, finalize the rating
 * only after the supplier could respond, and manage improvement plans (FR-19).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type {
  ContractDetail,
  ContractIncidentView,
  ContractPerformance,
  ImprovementActionView,
  PerformanceMeasureView,
  PerformanceReviewRow,
} from '@contracts/contracts';
import {
  CONTRACT_INCIDENTS_INCIDENT_TYPE,
  CONTRACT_INCIDENTS_SEVERITY,
  IMPROVEMENT_ACTIONS_STATUS,
  PERFORMANCE_REVIEWS_OVERALL_RATING,
} from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DateTimeInput,
  DetailList,
  Dialog,
  EmptyState,
  KpiCard,
  KpiGrid,
  OrDash,
  QueryView,
  Select,
  StatusChip,
  TextArea,
  TextField,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useAssigneeOptions } from '../lib/assignees';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { FormDialog } from '../components/FormDialog';
import { DeadlineText, InstantText, PersonName } from '../components/shared';
import { proposedRatingText } from '../lib/ratings';
import { splitCommandError } from '../lib/errors';
import { useContractCommand, useDialog } from '../lib/hooks';
import { idOf, optionalText, pick } from '../lib/lists';
import { CONTRACT_MANAGE } from '../lib/permissions';

function period(row: Pick<PerformanceReviewRow, 'periodStart' | 'periodEnd'>): string {
  return `${formatCalendarDate(row.periodStart)} – ${formatCalendarDate(row.periodEnd)}`;
}

function NewReviewDialog({
  contract,
  measures,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly measures: readonly PerformanceMeasureView[];
  readonly onClose: () => void;
}) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [rating, setRating] = useState('');
  const [summary, setSummary] = useState('');
  const [results, setResults] = useState<
    Record<number, { actual: string; rating: string; note: string }>
  >({});
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.createPerformanceReview, (row) =>
    t('contracts.performance.reviewCreated', { period: period(row) }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'periodStart',
    'periodEnd',
    'overallRating',
    'summary',
    'results',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);
  const active = measures.filter((measure) => measure.active);

  const submit = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (periodStart === '') errors.periodStart = t('contracts.performance.periodRequired');
    if (periodEnd === '') errors.periodEnd = t('contracts.performance.periodRequired');
    if (periodStart !== '' && periodEnd !== '' && periodEnd < periodStart) {
      errors.periodEnd = t('contracts.performance.periodOrder');
    }
    if (summary.trim() === '') errors.summary = t('contracts.performance.summaryRequired');
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const overallRating = pick(rating, PERFORMANCE_REVIEWS_OVERALL_RATING);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        periodStart,
        periodEnd,
        summary: summary.trim(),
        ...(overallRating === undefined ? {} : { overallRating }),
        results: active
          .filter((measure) => results[measure.id] !== undefined)
          .map((measure) => {
            const entry = results[measure.id] ?? { actual: '', rating: '', note: '' };
            const actual = optionalText(entry.actual);
            const measureRating = optionalText(entry.rating);
            const note = optionalText(entry.note);
            return {
              measureId: measure.id,
              ...(actual === undefined ? {} : { actual }),
              ...(measureRating === undefined ? {} : { rating: measureRating }),
              ...(note === undefined ? {} : { note }),
            };
          }),
      },
    });
    if (result !== null) onClose();
  };

  const setResult = (
    id: number,
    values: Partial<{ actual: string; rating: string; note: string }>,
  ): void =>
    setResults((current) => ({
      ...current,
      [id]: { actual: '', rating: '', note: '', ...current[id], ...values },
    }));

  return (
    <FormDialog
      open
      size="lg"
      title={t('contracts.performance.newReview')}
      description={t('contracts.performance.newReviewHint')}
      submitLabel={t('contracts.performance.saveReview')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <div className="tiq-form-grid">
        <DateInput
          label={t('contracts.performance.periodStart')}
          required
          value={periodStart}
          onChange={setPeriodStart}
          error={errorFor('periodStart')}
        />
        <DateInput
          label={t('contracts.performance.periodEnd')}
          required
          value={periodEnd}
          onChange={setPeriodEnd}
          error={errorFor('periodEnd')}
        />
        <Select
          label={t('contracts.performance.provisionalRating')}
          hint={t('contracts.performance.provisionalHint')}
          placeholder={t('contracts.common.none')}
          value={rating}
          options={PERFORMANCE_REVIEWS_OVERALL_RATING.map((value) => ({
            value,
            label: tEnum('performance_reviews.overall_rating', value),
          }))}
          onChange={setRating}
          error={errorFor('overallRating')}
        />
        <TextArea
          label={t('contracts.performance.summary')}
          required
          value={summary}
          onChange={setSummary}
          error={errorFor('summary')}
          fieldClassName="tiq-form-full"
        />
      </div>
      {active.map((measure) => (
        <fieldset key={measure.id} className="tiq-fieldset">
          <legend className="tiq-form-section-title">
            {measure.name} · {t('contracts.performance.target', { target: measure.target })}
          </legend>
          <div className="tiq-form-grid">
            <TextField
              label={t('contracts.performance.actual')}
              value={results[measure.id]?.actual ?? ''}
              onChange={(actual) => setResult(measure.id, { actual })}
            />
            <TextField
              label={t('contracts.performance.measureRating')}
              value={results[measure.id]?.rating ?? ''}
              onChange={(value) => setResult(measure.id, { rating: value })}
            />
            <TextArea
              label={t('contracts.common.note')}
              rows={2}
              value={results[measure.id]?.note ?? ''}
              onChange={(note) => setResult(measure.id, { note })}
              fieldClassName="tiq-form-full"
            />
          </div>
        </fieldset>
      ))}
    </FormDialog>
  );
}

function ReviewDetailDialog({
  contract,
  review,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly review: PerformanceReviewRow;
  readonly onClose: () => void;
}) {
  const query = useApiQuery(contractsEndpoints.performanceReview, {
    params: { contractId: contract.id, reviewId: review.id },
  });
  return (
    <Dialog
      open
      size="lg"
      title={t('contracts.performance.reviewTitle', { period: period(review) })}
      onClose={onClose}
    >
      <QueryView query={query}>
        {(detail) => (
          <div className="tiq-stack">
            <DetailList
              items={[
                {
                  label: t('contracts.performance.col.status'),
                  value: <StatusChip enum="performance_reviews.status" value={detail.status} />,
                },
                {
                  label: t('contracts.performance.col.rating'),
                  value:
                    detail.overallRating === null
                      ? null
                      : tEnum('performance_reviews.overall_rating', detail.overallRating),
                },
                { label: t('contracts.performance.summary'), value: detail.summary },
                {
                  label: t('contracts.performance.supplierResponse'),
                  value: detail.supplierResponse,
                },
                {
                  label: t('contracts.performance.finalizedBy'),
                  value: <PersonName person={detail.finalizedBy} />,
                },
              ]}
            />
            <DataTable
              caption={t('contracts.performance.results')}
              columns={[
                {
                  id: 'measure',
                  header: t('contracts.performance.col.measure'),
                  cell: (row) => row.measureName,
                },
                {
                  id: 'target',
                  header: t('contracts.performance.col.target'),
                  cell: (row) => row.target,
                },
                {
                  id: 'actual',
                  header: t('contracts.performance.actual'),
                  cell: (row) => <OrDash>{row.actual}</OrDash>,
                },
                {
                  id: 'rating',
                  header: t('contracts.performance.measureRating'),
                  cell: (row) => <OrDash>{row.rating}</OrDash>,
                },
                {
                  id: 'note',
                  header: t('contracts.common.note'),
                  cell: (row) => <OrDash>{row.note}</OrDash>,
                },
              ]}
              rows={detail.results}
              rowKey={(row) => String(row.id)}
              empty={<EmptyState compact title={t('contracts.performance.noResults')} />}
            />
            <DataTable
              caption={t('contracts.performance.actions')}
              columns={[
                {
                  id: 'action',
                  header: t('contracts.performance.col.action'),
                  cell: (row) => row.action,
                },
                {
                  id: 'owner',
                  header: t('contracts.performance.col.owner'),
                  cell: (row) => row.owner,
                },
                {
                  id: 'status',
                  header: t('contracts.performance.col.status'),
                  cell: (row) => (
                    <StatusChip enum="improvement_actions.status" value={row.status} size="sm" />
                  ),
                },
              ]}
              rows={detail.improvementActions}
              rowKey={(row) => String(row.id)}
              empty={<EmptyState compact title={t('contracts.performance.noActions')} />}
            />
          </div>
        )}
      </QueryView>
    </Dialog>
  );
}

function FinalizeDialog({
  contract,
  review,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly review: PerformanceReviewRow;
  readonly onClose: () => void;
}) {
  const [rating, setRating] = useState(review.overallRating ?? '');
  const [ratingError, setRatingError] = useState<string | undefined>(undefined);
  const command = useContractCommand(contractsEndpoints.finalizePerformanceReview, (row) =>
    t('contracts.performance.finalized', { period: period(row) }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, ['overallRating']);
  return (
    <ConfirmActionDialog
      open
      title={t('contracts.performance.finalizeTitle')}
      scope={`${contract.reference} · ${period(review)}`}
      consequence={t('contracts.performance.finalizeConsequence')}
      confirmLabel={t('contracts.performance.finalize')}
      reason={{
        label: t('contracts.performance.finalizationNote'),
        required: true,
        hint: review.supplierDisputes ? t('contracts.performance.disputedHint') : undefined,
      }}
      onConfirm={async ({ reason }) => {
        const overallRating = pick(rating, PERFORMANCE_REVIEWS_OVERALL_RATING);
        if (overallRating === undefined) {
          setRatingError(t('contracts.performance.ratingRequired'));
          return;
        }
        const result = await command.run({
          params: { contractId: contract.id, reviewId: review.id },
          body: { overallRating, finalizationNote: reason },
        });
        if (result !== null) onClose();
      }}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      {review.status === 'shared_with_supplier' && (
        <Banner tone="warning" title={t('contracts.performance.responsePending')}>
          {t('contracts.performance.responsePendingDetail')}
        </Banner>
      )}
      {review.supplierResponse !== null && (
        <Banner
          tone={review.supplierDisputes ? 'warning' : 'info'}
          title={t('contracts.performance.supplierResponse')}
        >
          {review.supplierResponse}
        </Banner>
      )}
      <Select
        label={t('contracts.performance.finalRating')}
        required
        placeholder={t('contracts.common.select')}
        value={rating}
        options={PERFORMANCE_REVIEWS_OVERALL_RATING.map((value) => ({
          value,
          label: tEnum('performance_reviews.overall_rating', value),
        }))}
        onChange={(value) => {
          setRating(value);
          setRatingError(undefined);
        }}
        error={ratingError ?? fieldErrors.forField('overallRating')}
      />
    </ConfirmActionDialog>
  );
}

function IncidentDialog({
  contract,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly onClose: () => void;
}) {
  const owners = useAssigneeOptions('obligation_owner');
  const [incidentType, setIncidentType] = useState('incident');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.recordIncident, (row) =>
    t('contracts.performance.incidentRecorded', {
      type: tEnum('contract_incidents.incident_type', row.incidentType),
    }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'incidentType',
    'severity',
    'description',
    'occurredAt',
    'correctiveAction',
    'ownerUserId',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const submit = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (description.trim() === '')
      errors.description = t('contracts.performance.descriptionRequired');
    if (occurredAt === null) errors.occurredAt = t('contracts.performance.occurredRequired');
    setLocal(errors);
    const type = pick(incidentType, CONTRACT_INCIDENTS_INCIDENT_TYPE);
    const level = pick(severity, CONTRACT_INCIDENTS_SEVERITY);
    if (
      Object.keys(errors).length > 0 ||
      occurredAt === null ||
      type === undefined ||
      level === undefined
    ) {
      return;
    }
    const corrective = optionalText(correctiveAction);
    const owner = idOf(ownerId);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        incidentType: type,
        severity: level,
        description: description.trim(),
        occurredAt,
        ...(corrective === undefined ? {} : { correctiveAction: corrective }),
        ...(owner === undefined ? {} : { ownerUserId: owner }),
      },
    });
    if (result !== null) onClose();
  };

  return (
    <FormDialog
      open
      title={t('contracts.performance.recordIncident')}
      submitLabel={t('contracts.performance.record')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <div className="tiq-form-grid">
        <Select
          label={t('contracts.performance.col.type')}
          required
          value={incidentType}
          options={CONTRACT_INCIDENTS_INCIDENT_TYPE.map((value) => ({
            value,
            label: tEnum('contract_incidents.incident_type', value),
          }))}
          onChange={setIncidentType}
          error={errorFor('incidentType')}
        />
        <Select
          label={t('contracts.performance.col.severity')}
          required
          value={severity}
          options={CONTRACT_INCIDENTS_SEVERITY.map((value) => ({
            value,
            label: tEnum('contract_incidents.severity', value),
          }))}
          onChange={setSeverity}
          error={errorFor('severity')}
        />
        <TextArea
          label={t('contracts.performance.col.description')}
          required
          value={description}
          onChange={setDescription}
          error={errorFor('description')}
          fieldClassName="tiq-form-full"
        />
        <DateTimeInput
          label={t('contracts.performance.occurredAt')}
          required
          value={occurredAt}
          onChange={setOccurredAt}
          timeZone={contract.timeZone}
          error={errorFor('occurredAt')}
        />
        <Select
          label={t('contracts.performance.col.owner')}
          placeholder={t('contracts.common.select')}
          value={ownerId}
          options={owners.options}
          onChange={setOwnerId}
          error={errorFor('ownerUserId')}
        />
        <TextArea
          label={t('contracts.performance.col.corrective')}
          value={correctiveAction}
          onChange={setCorrectiveAction}
          error={errorFor('correctiveAction')}
          fieldClassName="tiq-form-full"
        />
      </div>
    </FormDialog>
  );
}

function ActionDialog({
  contract,
  reviews,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly reviews: readonly PerformanceReviewRow[];
  readonly onClose: () => void;
}) {
  const [reviewId, setReviewId] = useState('');
  const [action, setAction] = useState('');
  const [owner, setOwner] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.createImprovementAction, (row) =>
    t('contracts.performance.actionCreated', { action: row.action }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'reviewId',
    'action',
    'owner',
    'dueAt',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const submit = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (action.trim().length < 3) errors.action = t('contracts.performance.actionRequired');
    if (owner.trim().length < 2) errors.owner = t('contracts.performance.ownerRequired');
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const review = idOf(reviewId);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        action: action.trim(),
        owner: owner.trim(),
        ...(review === undefined ? {} : { reviewId: review }),
        ...(dueAt === null ? {} : { dueAt }),
      },
    });
    if (result !== null) onClose();
  };

  return (
    <FormDialog
      open
      title={t('contracts.performance.newAction')}
      submitLabel={t('contracts.performance.addAction')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <Select
        label={t('contracts.performance.linkedReview')}
        placeholder={t('contracts.common.none')}
        value={reviewId}
        options={reviews.map((review) => ({ value: String(review.id), label: period(review) }))}
        onChange={setReviewId}
        error={errorFor('reviewId')}
      />
      <TextArea
        label={t('contracts.performance.col.action')}
        required
        value={action}
        onChange={setAction}
        error={errorFor('action')}
      />
      <TextField
        label={t('contracts.performance.col.owner')}
        hint={t('contracts.performance.actionOwnerHint')}
        required
        value={owner}
        onChange={setOwner}
        error={errorFor('owner')}
      />
      <DateTimeInput
        label={t('contracts.performance.col.due')}
        value={dueAt}
        onChange={setDueAt}
        timeZone={contract.timeZone}
        error={errorFor('dueAt')}
      />
    </FormDialog>
  );
}

function ActionStatusDialog({
  contract,
  action,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly action: ImprovementActionView;
  readonly onClose: () => void;
}) {
  const [status, setStatus] = useState<string>(action.status === 'open' ? 'done' : action.status);
  const [note, setNote] = useState('');
  const command = useContractCommand(contractsEndpoints.updateImprovementAction, (row) =>
    t('contracts.performance.actionUpdated', {
      status: tEnum('improvement_actions.status', row.status),
    }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, ['status', 'note']);
  return (
    <ConfirmActionDialog
      open
      title={t('contracts.performance.updateAction')}
      scope={`${contract.reference} · ${action.action}`}
      consequence={t('contracts.performance.updateActionConsequence')}
      confirmLabel={t('contracts.performance.update')}
      onConfirm={async () => {
        const next = pick(status, IMPROVEMENT_ACTIONS_STATUS);
        if (next === undefined) return;
        const text = optionalText(note);
        const result = await command.run({
          params: { contractId: contract.id, actionId: action.id },
          body: text === undefined ? { status: next } : { status: next, note: text },
        });
        if (result !== null) onClose();
      }}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      <Select
        label={t('contracts.performance.col.status')}
        required
        value={status}
        options={IMPROVEMENT_ACTIONS_STATUS.map((value) => ({
          value,
          label: tEnum('improvement_actions.status', value),
        }))}
        onChange={setStatus}
        error={fieldErrors.forField('status')}
      />
      <TextArea
        label={t('contracts.common.note')}
        rows={2}
        value={note}
        onChange={setNote}
        error={fieldErrors.forField('note')}
      />
    </ConfirmActionDialog>
  );
}

type DialogKind = 'view' | 'share' | 'finalize' | 'incident' | 'action';

function PerformanceTables({
  contract,
  performance,
  canManage,
}: {
  readonly contract: ContractDetail;
  readonly performance: ContractPerformance;
  readonly canManage: boolean;
}) {
  const reviewDialog = useDialog<DialogKind, PerformanceReviewRow>();
  const actionDialog = useDialog<'actionStatus', ImprovementActionView>();
  const share = useContractCommand(contractsEndpoints.sharePerformanceReview, (row) =>
    t('contracts.performance.shared', { period: period(row) }),
  );
  const scorecard = performance.scorecard;

  const measureColumns: DataTableColumn<PerformanceMeasureView>[] = [
    {
      id: 'name',
      header: t('contracts.performance.col.measure'),
      cell: (row) => (
        <>
          <span>{row.name}</span>
          <span className="tiq-cell-sub">
            {row.frequency ?? ''} {row.active ? '' : `· ${t('contracts.performance.inactive')}`}
          </span>
        </>
      ),
    },
    {
      id: 'target',
      header: t('contracts.performance.col.target'),
      cell: (row) => row.target,
    },
    {
      id: 'actual',
      header: t('contracts.performance.col.latest'),
      cell: (row) => <OrDash>{row.latestActual}</OrDash>,
    },
    {
      id: 'rating',
      header: t('contracts.performance.col.latestRating'),
      cell: (row) => <OrDash>{row.latestRating}</OrDash>,
    },
  ];

  const reviewColumns: DataTableColumn<PerformanceReviewRow>[] = [
    { id: 'period', header: t('contracts.performance.col.period'), cell: (row) => period(row) },
    {
      id: 'status',
      header: t('contracts.performance.col.status'),
      cell: (row) => <StatusChip enum="performance_reviews.status" value={row.status} size="sm" />,
    },
    {
      id: 'rating',
      header: t('contracts.performance.col.rating'),
      cell: (row) =>
        row.overallRating === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          tEnum('performance_reviews.overall_rating', row.overallRating)
        ),
    },
    {
      id: 'response',
      header: t('contracts.performance.col.response'),
      cell: (row) => (
        <>
          {row.supplierDisputes && (
            <Chip tone="warning" size="sm">
              {t('contracts.performance.disputed')}
            </Chip>
          )}
          <span className="tiq-cell-sub">
            {row.supplierResponse ?? t('contracts.performance.noResponse')}
          </span>
        </>
      ),
    },
    {
      id: 'dates',
      header: t('contracts.performance.col.dates'),
      cell: (row) => (
        <>
          <span className="tiq-cell-sub">
            {t('contracts.performance.sharedAt')}{' '}
            <InstantText at={row.sharedAt} timeZone={contract.timeZone} />
          </span>
          <span className="tiq-cell-sub">
            {t('contracts.performance.finalizedAt')}{' '}
            <InstantText at={row.finalizedAt} timeZone={contract.timeZone} />
          </span>
        </>
      ),
    },
    {
      id: 'actions',
      header: t('contracts.register.col.actions'),
      cell: (row) => (
        <span className="tiq-inline">
          <Button size="sm" onClick={() => reviewDialog.show('view', row)}>
            {t('contracts.common.view')}
          </Button>
          {canManage && row.status === 'draft' && (
            <Button
              size="sm"
              onClick={() => {
                share.reset();
                reviewDialog.show('share', row);
              }}
            >
              {t('contracts.performance.share')}
            </Button>
          )}
          {canManage &&
            (row.status === 'supplier_responded' || row.status === 'shared_with_supplier') && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => reviewDialog.show('finalize', row)}
              >
                {t('contracts.performance.finalize')}
              </Button>
            )}
        </span>
      ),
    },
  ];

  const incidentColumns: DataTableColumn<ContractIncidentView>[] = [
    {
      id: 'type',
      header: t('contracts.performance.col.type'),
      cell: (row) => (
        <>
          <span>{tEnum('contract_incidents.incident_type', row.incidentType)}</span>
          <span className="tiq-cell-sub">{formatDateTime(row.occurredAt, contract.timeZone)}</span>
        </>
      ),
    },
    {
      id: 'severity',
      header: t('contracts.performance.col.severity'),
      cell: (row) => (
        <StatusChip enum="contract_incidents.severity" value={row.severity} size="sm" />
      ),
    },
    {
      id: 'description',
      header: t('contracts.performance.col.description'),
      cell: (row) => row.description,
    },
    {
      id: 'status',
      header: t('contracts.performance.col.status'),
      cell: (row) => <StatusChip enum="contract_incidents.status" value={row.status} size="sm" />,
    },
    {
      id: 'corrective',
      header: t('contracts.performance.col.corrective'),
      cell: (row) => <OrDash>{row.correctiveAction}</OrDash>,
    },
    {
      id: 'owner',
      header: t('contracts.performance.col.owner'),
      cell: (row) => <PersonName person={row.owner} />,
    },
  ];

  const actionColumns: DataTableColumn<ImprovementActionView>[] = [
    { id: 'action', header: t('contracts.performance.col.action'), cell: (row) => row.action },
    { id: 'owner', header: t('contracts.performance.col.owner'), cell: (row) => row.owner },
    {
      id: 'due',
      header: t('contracts.performance.col.due'),
      cell: (row) => <DeadlineText deadline={row.dueAt} />,
    },
    {
      id: 'status',
      header: t('contracts.performance.col.status'),
      cell: (row) => <StatusChip enum="improvement_actions.status" value={row.status} size="sm" />,
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: t('contracts.register.col.actions'),
            cell: (row: ImprovementActionView) =>
              row.status === 'done' || row.status === 'cancelled' ? null : (
                <Button size="sm" onClick={() => actionDialog.show('actionStatus', row)}>
                  {t('contracts.performance.update')}
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="tiq-stack">
      <KpiGrid>
        <KpiCard
          label={t('contracts.performance.kpi.rating')}
          icon="star"
          value={
            scorecard.latestRating === null
              ? null
              : tEnum('performance_reviews.overall_rating', scorecard.latestRating)
          }
          hint={
            scorecard.latestProposedRating !== null
              ? proposedRatingText(scorecard.latestProposedRating)
              : scorecard.latestRating === null
                ? t('contracts.performance.kpi.ratingNone')
                : t('contracts.performance.kpi.ratingHint')
          }
        />
        <KpiCard
          label={t('contracts.performance.kpi.finalized')}
          icon="checkCircle"
          tone="success"
          value={formatCount(scorecard.reviewsFinalized)}
          hint={t('contracts.performance.kpi.finalizedHint')}
        />
        <KpiCard
          label={t('contracts.performance.kpi.disputed')}
          icon="scale"
          tone="warning"
          value={formatCount(scorecard.reviewsDisputed)}
          hint={t('contracts.performance.kpi.disputedHint')}
        />
        <KpiCard
          label={t('contracts.performance.kpi.incidents')}
          icon="alertOctagon"
          tone="danger"
          value={formatCount(scorecard.openIncidents)}
          hint={t('contracts.performance.kpi.incidentsHint')}
        />
        <KpiCard
          label={t('contracts.performance.kpi.actions')}
          icon="target"
          tone="info"
          value={formatCount(scorecard.openActions)}
          hint={t('contracts.performance.kpi.actionsHint')}
        />
      </KpiGrid>
      <Card flush title={t('contracts.performance.measures')}>
        <DataTable
          caption={t('contracts.performance.measures')}
          columns={measureColumns}
          rows={performance.measures}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.performance.noMeasures')} />}
        />
      </Card>
      <Card
        flush
        title={t('contracts.performance.reviews')}
        subtitle={t('contracts.performance.reviewsHint')}
      >
        <DataTable
          caption={t('contracts.performance.reviews')}
          columns={reviewColumns}
          rows={performance.reviews}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.performance.noReviews')} />}
        />
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card
          flush
          title={t('contracts.performance.incidents')}
          actions={
            canManage ? (
              <Button size="sm" icon="plus" onClick={() => reviewDialog.show('incident')}>
                {t('contracts.performance.recordIncident')}
              </Button>
            ) : undefined
          }
        >
          <DataTable
            caption={t('contracts.performance.incidents')}
            columns={incidentColumns}
            rows={performance.incidents}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact title={t('contracts.performance.noIncidents')} />}
          />
        </Card>
        <Card
          flush
          title={t('contracts.performance.actions')}
          actions={
            canManage ? (
              <Button size="sm" icon="plus" onClick={() => reviewDialog.show('action')}>
                {t('contracts.performance.newAction')}
              </Button>
            ) : undefined
          }
        >
          <DataTable
            caption={t('contracts.performance.actions')}
            columns={actionColumns}
            rows={performance.improvementActions}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact title={t('contracts.performance.noActions')} />}
          />
        </Card>
      </div>
      {reviewDialog.open === 'view' && reviewDialog.target !== null && (
        <ReviewDetailDialog
          contract={contract}
          review={reviewDialog.target}
          onClose={reviewDialog.close}
        />
      )}
      {reviewDialog.open === 'finalize' && reviewDialog.target !== null && (
        <FinalizeDialog
          contract={contract}
          review={reviewDialog.target}
          onClose={reviewDialog.close}
        />
      )}
      {reviewDialog.open === 'incident' && (
        <IncidentDialog contract={contract} onClose={reviewDialog.close} />
      )}
      {reviewDialog.open === 'action' && (
        <ActionDialog
          contract={contract}
          reviews={performance.reviews}
          onClose={reviewDialog.close}
        />
      )}
      {actionDialog.open === 'actionStatus' && actionDialog.target !== null && (
        <ActionStatusDialog
          contract={contract}
          action={actionDialog.target}
          onClose={actionDialog.close}
        />
      )}
      <ConfirmActionDialog
        open={reviewDialog.open === 'share'}
        title={t('contracts.performance.shareTitle')}
        scope={
          reviewDialog.target === null
            ? contract.reference
            : `${contract.reference} · ${period(reviewDialog.target)}`
        }
        consequence={t('contracts.performance.shareConsequence')}
        confirmLabel={t('contracts.performance.share')}
        onConfirm={async () => {
          const target = reviewDialog.target;
          if (target === null) return;
          const result = await share.run({
            params: { contractId: contract.id, reviewId: target.id },
          });
          if (result !== null) reviewDialog.close();
        }}
        onCancel={reviewDialog.close}
        pending={share.pending}
        error={share.error}
      />
    </div>
  );
}

function PerformanceBody({
  contract,
  creating,
  onCreated,
}: {
  readonly contract: ContractDetail;
  readonly creating: boolean;
  readonly onCreated: () => void;
}) {
  const canManage = usePermission(CONTRACT_MANAGE) && contract.status !== 'closed';
  const query = useApiQuery(contractsEndpoints.performance, {
    params: { contractId: contract.id },
  });
  return (
    <QueryView query={query}>
      {(performance) => (
        <>
          <PerformanceTables contract={contract} performance={performance} canManage={canManage} />
          {creating && (
            <NewReviewDialog
              contract={contract}
              measures={performance.measures}
              onClose={onCreated}
            />
          )}
        </>
      )}
    </QueryView>
  );
}

export default function PerformancePage() {
  const canManage = usePermission(CONTRACT_MANAGE);
  const [creating, setCreating] = useState(false);
  return (
    <ContractWorkspace
      screen="CON-07"
      primaryAction={(contract) =>
        canManage && contract.status !== 'closed' ? (
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t('contracts.performance.newReview')}
          </Button>
        ) : undefined
      }
    >
      {(contract) => (
        <PerformanceBody
          contract={contract}
          creating={creating}
          onCreated={() => setCreating(false)}
        />
      )}
    </ContractWorkspace>
  );
}
