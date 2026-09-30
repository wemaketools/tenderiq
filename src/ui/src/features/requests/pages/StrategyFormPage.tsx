/**
 * BUY-06 strategy form: draft a strategy for an approved request or a project, or revise one. The procedure is one
 * of the FR-05 procedures (never a framework call-off, DD-40); a direct procurement states its exception grounds
 * and an RFI uses the RFI procedure. Saving keeps the strategy a draft; approval is requested from the strategy
 * page.
 */
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { PROCUREMENT_STRATEGIES_PROCEDURE_WRITE } from '@contracts/enums';
import type {
  ProcurementStrategiesAwardModel,
  ProcurementStrategiesEventType,
  ProcurementStrategiesProcedureWrite,
} from '@contracts/enums';
import { requestEndpoints } from '@contracts/requests';
import type { RequestOptions, StrategyDetail } from '@contracts/requests';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  EmptyState,
  FormErrorSummary,
  PageHeader,
  QueryView,
  RadioGroup,
  Reference,
  Select,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { enumOptions, explainError, requestPaths, textOrNull } from '../lib';

interface FormState {
  readonly subject: 'request' | 'project';
  readonly requestId: string;
  readonly projectId: string;
  readonly eventType: ProcurementStrategiesEventType;
  readonly procedure: ProcurementStrategiesProcedureWrite;
  readonly awardModel: ProcurementStrategiesAwardModel;
  readonly intendedOutcome: string;
  readonly competitionRationale: string;
  readonly directAwardGrounds: string;
  readonly risks: string;
  readonly qualificationApproach: string;
  readonly lotStrategy: string;
  readonly evaluationApproach: string;
  readonly negotiationPermitted: boolean;
  readonly timetableSummary: string;
  readonly externalOversight: string;
  readonly supplierInformationUse: string;
}

const TEXT_FIELDS = [
  'intendedOutcome',
  'competitionRationale',
  'lotStrategy',
  'qualificationApproach',
  'evaluationApproach',
  'risks',
  'timetableSummary',
  'externalOversight',
] as const;

const FIELD_NAMES = [
  'requestId',
  'projectId',
  'eventType',
  'procedure',
  'awardModel',
  'directAwardGrounds',
  'negotiationPermitted',
  'supplierInformationUse',
  ...TEXT_FIELDS,
];

/** Competition-only fields: an RFI runs no competition, so they do not apply to it (FR-05). */
const COMPETITION_ONLY = new Set<string>([
  'competitionRationale',
  'lotStrategy',
  'qualificationApproach',
  'evaluationApproach',
]);

function stateOf(strategy: StrategyDetail | null, requestId: string): FormState {
  const procedure =
    strategy === null || strategy.procedure === 'framework_calloff' ? 'open' : strategy.procedure;
  return {
    subject: strategy?.project !== null && strategy?.request === null ? 'project' : 'request',
    requestId:
      strategy?.request === null || strategy === null ? requestId : String(strategy.request.id),
    projectId: strategy?.project === null || strategy === null ? '' : String(strategy.project.id),
    eventType: strategy?.eventType ?? 'tender',
    procedure,
    awardModel: strategy?.awardModel ?? 'single',
    intendedOutcome: strategy?.intendedOutcome ?? '',
    competitionRationale: strategy?.competitionRationale ?? '',
    directAwardGrounds: strategy?.directAwardGrounds ?? '',
    risks: strategy?.risks ?? '',
    qualificationApproach: strategy?.qualificationApproach ?? '',
    lotStrategy: strategy?.lotStrategy ?? '',
    evaluationApproach: strategy?.evaluationApproach ?? '',
    negotiationPermitted: strategy?.negotiationPermitted ?? false,
    timetableSummary: strategy?.timetableSummary ?? '',
    externalOversight: strategy?.externalOversight ?? '',
    supplierInformationUse: strategy?.supplierInformationUse ?? '',
  };
}

function clientErrors(form: FormState, isNew: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if ((form.eventType === 'rfi') !== (form.procedure === 'rfi')) {
    errors.procedure = t('requests.errors.EVENT_TYPE_PROCEDURE_MISMATCH');
  }
  if (form.eventType === 'rfi' && form.supplierInformationUse.trim() === '') {
    errors.supplierInformationUse = t('requests.errors.SUPPLIER_INFORMATION_USE_REQUIRED');
  }
  if (form.procedure === 'direct' && form.directAwardGrounds.trim() === '') {
    errors.directAwardGrounds = t('requests.errors.DIRECT_AWARD_GROUNDS_REQUIRED');
  }
  if (isNew && form.subject === 'request' && form.requestId === '') {
    errors.requestId = t('requests.errors.STRATEGY_SUBJECT_REQUIRED');
  }
  if (isNew && form.subject === 'project' && form.projectId === '') {
    errors.projectId = t('requests.errors.STRATEGY_SUBJECT_REQUIRED');
  }
  return errors;
}

export default function StrategyFormPage() {
  const { strategyId } = useParams();
  const [search] = useSearchParams();
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  if (strategyId === undefined) {
    const fromRequest = search.get('requestId') ?? '';
    return (
      <div className="tiq-page">
        <QueryView query={options}>
          {(data) => (
            <StrategyForm
              options={data}
              strategy={null}
              initialRequestId={/^\d+$/.test(fromRequest) ? fromRequest : ''}
            />
          )}
        </QueryView>
      </div>
    );
  }
  const id = Number(strategyId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('requests.strategy.notFound')}
          back={{ to: requestPaths.strategies, label: t('requests.strategy.back') }}
        />
        <EmptyState title={t('requests.strategy.notFound')} />
      </div>
    );
  }
  return <EditLoader key={id} strategyId={id} />;
}

function EditLoader({ strategyId }: { readonly strategyId: number }) {
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const strategy = useApiQuery(requestEndpoints.getStrategy, { params: { strategyId } });
  return (
    <div className="tiq-page">
      <QueryView query={strategy}>
        {(detail) => (
          <QueryView query={options}>
            {(data) =>
              detail.allowedActions.includes('edit') ? (
                <StrategyForm options={data} strategy={detail} initialRequestId="" />
              ) : (
                <>
                  <PageHeader
                    title={t('requests.strategyForm.editTitle', { title: detail.title })}
                    back={{
                      to: requestPaths.strategy(detail.id),
                      label: t('requests.strategyForm.back'),
                    }}
                  />
                  <Banner tone="warning" title={t('requests.strategyForm.notEditableTitle')}>
                    <p>
                      {t('requests.strategyForm.notEditable', {
                        status: tEnum('procurement_strategies.status', detail.status),
                      })}
                    </p>
                  </Banner>
                </>
              )
            }
          </QueryView>
        )}
      </QueryView>
    </div>
  );
}

function StrategyForm({
  options,
  strategy,
  initialRequestId,
}: {
  readonly options: RequestOptions;
  readonly strategy: StrategyDetail | null;
  readonly initialRequestId: string;
}) {
  const toast = useToast();
  const isNew = strategy === null;
  const approved = useApiQuery(
    requestEndpoints.listRequests,
    isNew
      ? { query: { status: ['approved'], pageSize: 100, sort: 'reference', dir: 'asc' } }
      : null,
  );
  const [current, setCurrent] = useState<StrategyDetail | null>(strategy);
  const [baseline, setBaseline] = useState<FormState>(() => stateOf(strategy, initialRequestId));
  const [form, setForm] = useState<FormState>(baseline);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<StrategyDetail | null>(null);
  const create = useApiMutation(requestEndpoints.createStrategy);
  const update = useApiMutation(requestEndpoints.updateStrategy);
  const mutation = current === null ? create : update;
  const serverErrors = formErrors(mutation.error, FIELD_NAMES);
  const local = clientErrors(form, current === null);
  const dirty = (Object.keys(form) as (keyof FormState)[]).some(
    (key) => form[key] !== baseline[key],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  /** The event type drives the procedure: an RFI always uses the RFI procedure, and only an RFI does. */
  const setEventType = (eventType: ProcurementStrategiesEventType): void => {
    setForm((previous) => {
      if (eventType === 'rfi') {
        return {
          ...previous,
          eventType,
          procedure: 'rfi',
          awardModel: 'single',
          negotiationPermitted: false,
          supplierInformationUse:
            previous.supplierInformationUse.trim() === ''
              ? t('requests.strategyForm.supplierInformationUseDefault')
              : previous.supplierInformationUse,
        };
      }
      return {
        ...previous,
        eventType,
        procedure: previous.procedure === 'rfi' ? 'open' : previous.procedure,
      };
    });
  };
  const isRfi = form.eventType === 'rfi';
  const procedureChoices = PROCUREMENT_STRATEGIES_PROCEDURE_WRITE.filter((value) =>
    isRfi ? value === 'rfi' : value !== 'rfi',
  );
  const errorOf = (field: string): string | undefined =>
    serverErrors.forField(field) ?? (tried ? local[field] : undefined);

  const fields = {
    eventType: form.eventType,
    procedure: form.procedure,
    awardModel: form.awardModel,
    intendedOutcome: textOrNull(form.intendedOutcome),
    competitionRationale: isRfi ? null : textOrNull(form.competitionRationale),
    directAwardGrounds: form.procedure === 'direct' ? textOrNull(form.directAwardGrounds) : null,
    risks: textOrNull(form.risks),
    qualificationApproach: isRfi ? null : textOrNull(form.qualificationApproach),
    lotStrategy: isRfi ? null : textOrNull(form.lotStrategy),
    evaluationApproach: isRfi ? null : textOrNull(form.evaluationApproach),
    negotiationPermitted: isRfi ? false : form.negotiationPermitted,
    timetableSummary: textOrNull(form.timetableSummary),
    externalOversight: textOrNull(form.externalOversight),
    supplierInformationUse: isRfi ? textOrNull(form.supplierInformationUse) : null,
  };

  const onSave = async (): Promise<void> => {
    setTried(true);
    if (Object.keys(local).length > 0) return;
    try {
      const next =
        current === null
          ? await create.mutate({
              body: {
                ...fields,
                requestId: form.subject === 'request' ? Number(form.requestId) : null,
                projectId: form.subject === 'project' ? Number(form.projectId) : null,
              },
            })
          : await update.mutate({
              params: { strategyId: current.id },
              body: { ...fields, expectedRevision: current.revision },
            });
      setCurrent(next);
      setSaved(next);
      const nextState = stateOf(next, form.requestId);
      setBaseline(nextState);
      setForm(nextState);
      setTried(false);
      toast.show(t('requests.strategyForm.saved', { revision: next.revision }), 'success');
    } catch {
      // The mutation keeps the error; the summary shows it.
    }
  };

  const textArea = (field: (typeof TEXT_FIELDS)[number]) =>
    isRfi && COMPETITION_ONLY.has(field) ? null : (
      <TextArea
        key={field}
        label={
          isRfi && field === 'intendedOutcome'
            ? t('requests.strategyForm.rfiIntendedOutcome')
            : t(`requests.strategyFields.${field}`)
        }
        fieldClassName="tiq-form-full"
        rows={3}
        value={form[field]}
        onChange={(value) => set(field, value)}
        error={errorOf(field)}
      />
    );

  return (
    <>
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <PageHeader
        title={
          current === null
            ? t('requests.strategyForm.newTitle')
            : t('requests.strategyForm.editTitle', { title: current.title })
        }
        back={
          current === null
            ? { to: requestPaths.strategies, label: t('requests.strategy.back') }
            : { to: requestPaths.strategy(current.id), label: t('requests.strategyForm.back') }
        }
        meta={
          current === null ? undefined : (
            <>
              <StatusChip enum="procurement_strategies.status" value={current.status} />
              <span>{t('requests.detail.revision', { revision: current.revision })}</span>
            </>
          )
        }
        primaryAction={
          <Button
            variant="primary"
            icon="check"
            loading={mutation.pending}
            disabled={!dirty}
            onClick={() => void onSave()}
          >
            {t('requests.strategyForm.save')}
          </Button>
        }
      />

      <Banner tone="info" title={t('requests.strategyForm.stageTitle')}>
        <p>{t('requests.strategyForm.stage')}</p>
      </Banner>
      {saved !== null && (
        <Banner
          tone="success"
          title={t('requests.strategyForm.savedTitle', { revision: saved.revision })}
        >
          <p>
            {t('requests.strategyForm.savedBody', {
              status: tEnum('procurement_strategies.status', saved.status),
            })}
          </p>
          {saved.id < 900 && (
            <ButtonLink to={requestPaths.strategy(saved.id)} size="sm">
              {t('requests.strategyForm.open')}
            </ButtonLink>
          )}
        </Banner>
      )}
      <FormErrorSummary
        title={explainError(mutation.error)?.detail ?? mutation.error?.title ?? null}
        errors={serverErrors.other}
      />
      {tried && Object.keys(local).length > 0 && (
        <Banner tone="error" title={t('requests.form.fixErrors')} />
      )}

      {current === null && (
        <Card title={t('requests.strategyForm.subject')}>
          <div className="tiq-form-grid">
            <RadioGroup
              label={t('requests.strategyForm.subjectKind')}
              inline
              fieldClassName="tiq-form-full"
              value={form.subject}
              onChange={(value) => set('subject', value as 'request' | 'project')}
              options={[
                { value: 'request', label: t('requests.strategyForm.subjectRequest') },
                { value: 'project', label: t('requests.strategyForm.subjectProject') },
              ]}
            />
            {form.subject === 'request' ? (
              <Select
                label={t('requests.strategyForm.request')}
                required
                value={form.requestId}
                onChange={(value) => set('requestId', value)}
                placeholder={t('requests.common.select')}
                hint={t('requests.strategyForm.requestHint')}
                options={(approved.data?.items ?? []).map((row) => ({
                  value: String(row.id),
                  label: `${row.reference} ${row.title}`,
                }))}
                error={errorOf('requestId')}
              />
            ) : (
              <Select
                label={t('requests.strategyForm.project')}
                required
                value={form.projectId}
                onChange={(value) => set('projectId', value)}
                placeholder={t('requests.common.select')}
                options={options.projects.map((project) => ({
                  value: String(project.id),
                  label: `${project.reference} ${project.title}`,
                }))}
                error={errorOf('projectId')}
              />
            )}
          </div>
        </Card>
      )}
      {current !== null && (current.request !== null || current.project !== null) && (
        <p>
          {t('requests.strategyForm.serves')}{' '}
          {current.request !== null ? (
            <Reference
              value={current.request.reference}
              to={requestPaths.request(current.request.id)}
            />
          ) : (
            current.project !== null && <Reference value={current.project.reference} />
          )}
        </p>
      )}

      <Card title={t('requests.strategy.sections.approach')}>
        <div className="tiq-form-grid">
          <Select
            label={t('requests.strategies.eventType')}
            required
            value={form.eventType}
            onChange={(value) => setEventType(value as ProcurementStrategiesEventType)}
            options={enumOptions('procurement_strategies.event_type')}
            hint={
              <>
                {t(`requests.eventTypes.${form.eventType}`)}{' '}
                {t('requests.strategyForm.eventTypeHint')}
              </>
            }
            error={errorOf('eventType')}
          />
          {!isRfi && (
            <Select
              label={t('requests.strategyFields.awardModel')}
              required
              value={form.awardModel}
              onChange={(value) => set('awardModel', value as ProcurementStrategiesAwardModel)}
              options={enumOptions('procurement_strategies.award_model')}
              error={errorOf('awardModel')}
            />
          )}
          {isRfi && (
            <div className="tiq-form-full">
              <Banner tone="info" title={t('requests.strategyForm.rfiTitle')}>
                <p>{t('requests.strategyForm.rfiBody')}</p>
              </Banner>
            </div>
          )}
          <RadioGroup
            label={t('requests.strategyFields.procedure')}
            required
            fieldClassName="tiq-form-full"
            hint={
              isRfi
                ? t('requests.strategyForm.rfiProcedureHint')
                : t('requests.strategyForm.procedureHint')
            }
            value={form.procedure}
            onChange={(value) => set('procedure', value as ProcurementStrategiesProcedureWrite)}
            options={procedureChoices.map((value) => ({
              value,
              label: tEnum('procurement_strategies.procedure', value),
              hint: t(`requests.procedures.${value}`),
            }))}
            error={errorOf('procedure')}
          />
          {form.procedure === 'direct' && (
            <div className="tiq-form-full">
              <Banner tone="warning" title={t('requests.strategyForm.directTitle')}>
                <p>{t('requests.strategyForm.directBody')}</p>
              </Banner>
            </div>
          )}
          {form.procedure === 'direct' && (
            <TextArea
              label={t('requests.strategyFields.directAwardGrounds')}
              required
              fieldClassName="tiq-form-full"
              hint={t('requests.strategyForm.groundsHint')}
              rows={3}
              value={form.directAwardGrounds}
              onChange={(value) => set('directAwardGrounds', value)}
              error={errorOf('directAwardGrounds')}
            />
          )}
          {TEXT_FIELDS.slice(0, 5).map(textArea)}
          {isRfi && (
            <TextArea
              label={t('requests.strategyFields.supplierInformationUse')}
              required
              fieldClassName="tiq-form-full"
              hint={t('requests.strategyForm.supplierInformationUseHint')}
              rows={4}
              value={form.supplierInformationUse}
              onChange={(value) => set('supplierInformationUse', value)}
              error={errorOf('supplierInformationUse')}
            />
          )}
          {!isRfi && (
            <Checkbox
              label={t('requests.strategyFields.negotiationPermitted')}
              checked={form.negotiationPermitted}
              onChange={(checked) => set('negotiationPermitted', checked)}
              error={errorOf('negotiationPermitted')}
            />
          )}
          {TEXT_FIELDS.slice(5).map(textArea)}
        </div>
      </Card>

      <div className="tiq-inline">
        <Button
          variant="primary"
          icon="check"
          loading={mutation.pending}
          disabled={!dirty}
          onClick={() => void onSave()}
        >
          {t('requests.strategyForm.save')}
        </Button>
        <span className="tiq-text-muted">{t('requests.strategyForm.saveNote')}</span>
      </div>
    </>
  );
}
