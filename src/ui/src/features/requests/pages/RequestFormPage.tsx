/**
 * BUY-03 business case form: draft a new request or revise one. Covers every FR-04 field and distinguishes
 * indicative funding, an approved budget and a firm commitment. Saving never submits: the page states whether the
 * request stays a draft, is under review or was approved, and a material change to an approved request shows that
 * re-approval is required (BR-10).
 */
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { valueBandOf } from '@contracts/policy';
import type { CustomFieldIssue, CustomFieldValues } from '@contracts/policy';
import { REQUEST_MATERIAL_FIELDS, requestEndpoints } from '@contracts/requests';
import type {
  BusinessCaseBody,
  RequestChangeAssessment,
  RequestDetail,
  RequestOptions,
} from '@contracts/requests';
import type {
  ProcurementRequestsFundingStatus,
  ProcurementRequestsNeedType,
  ProcurementRequestsPriority,
} from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  DateInput,
  EmptyState,
  FormErrorSummary,
  MoneyInput,
  NumberInput,
  PageHeader,
  QueryView,
  RadioGroup,
  ReadinessChecklist,
  Reference,
  Select,
  StatusChip,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { CustomFieldsSection } from '../../admin-policy/components/CustomFieldsSection';
import {
  currencyFallback,
  enumOptions,
  explainError,
  idOrNull,
  idValue,
  personValue,
  requestPaths,
  textOrNull,
} from '../lib';

const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/;

function sameCustomValues(a: Readonly<CustomFieldValues>, b: Readonly<CustomFieldValues>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? null) === (b[key] ?? null));
}

interface FormState {
  readonly title: string;
  readonly problemStatement: string;
  readonly expectedOutcomes: string;
  readonly scopeDescription: string;
  readonly quantities: string;
  readonly deliveryLocations: string;
  readonly targetDate: string;
  readonly constraints: string;
  readonly stakeholders: string;
  readonly consequenceOfDelay: string;
  readonly risks: string;
  readonly needType: ProcurementRequestsNeedType;
  readonly replacesContractId: string;
  readonly legalEntityId: string;
  readonly departmentId: string;
  readonly categoryId: string;
  readonly costCenterId: string;
  readonly fundingSourceId: string;
  readonly projectId: string;
  readonly sponsorUserId: string;
  readonly budgetOwnerUserId: string;
  readonly estimatedAmount: string;
  readonly currency: string;
  readonly estimationBasis: string;
  readonly accountingReference: string;
  readonly contractTermMonths: string;
  readonly renewalOptions: string;
  readonly totalAmount: string;
  readonly fundingStatus: ProcurementRequestsFundingStatus;
  readonly priority: ProcurementRequestsPriority;
}

const FIELD_NAMES = [
  'title',
  'problemStatement',
  'expectedOutcomes',
  'scopeDescription',
  'quantities',
  'deliveryLocations',
  'targetDate',
  'constraints',
  'stakeholders',
  'consequenceOfDelay',
  'risks',
  'needType',
  'replacesContractId',
  'legalEntityId',
  'departmentId',
  'categoryId',
  'costCenterId',
  'fundingSourceId',
  'projectId',
  'sponsorUserId',
  'budgetOwnerUserId',
  'estimatedValue',
  'estimationBasis',
  'accountingReference',
  'contractTermMonths',
  'renewalOptions',
  'estimatedTotalCommitment',
  'fundingStatus',
  'priority',
];

function emptyState(currency: string): FormState {
  return {
    title: '',
    problemStatement: '',
    expectedOutcomes: '',
    scopeDescription: '',
    quantities: '',
    deliveryLocations: '',
    targetDate: '',
    constraints: '',
    stakeholders: '',
    consequenceOfDelay: '',
    risks: '',
    needType: 'new_expenditure',
    replacesContractId: '',
    legalEntityId: '',
    departmentId: '',
    categoryId: '',
    costCenterId: '',
    fundingSourceId: '',
    projectId: '',
    sponsorUserId: '',
    budgetOwnerUserId: '',
    estimatedAmount: '',
    currency,
    estimationBasis: '',
    accountingReference: '',
    contractTermMonths: '',
    renewalOptions: '',
    totalAmount: '',
    fundingStatus: 'none',
    priority: 'normal',
  };
}

function stateOf(request: RequestDetail, currency: string): FormState {
  return {
    title: request.title,
    problemStatement: request.problemStatement ?? '',
    expectedOutcomes: request.expectedOutcomes ?? '',
    scopeDescription: request.scopeDescription ?? '',
    quantities: request.quantities ?? '',
    deliveryLocations: request.deliveryLocations ?? '',
    targetDate: request.targetDate ?? '',
    constraints: request.constraints ?? '',
    stakeholders: request.stakeholders ?? '',
    consequenceOfDelay: request.consequenceOfDelay ?? '',
    risks: request.risks ?? '',
    needType: request.needType,
    replacesContractId: idValue(request.replacesContract),
    legalEntityId: idValue(request.legalEntity),
    departmentId: idValue(request.department),
    categoryId: idValue(request.category),
    costCenterId: idValue(request.costCenter),
    fundingSourceId: idValue(request.fundingSource),
    projectId: idValue(request.project),
    sponsorUserId: personValue(request.sponsor),
    budgetOwnerUserId: personValue(request.budgetOwner),
    estimatedAmount: request.estimatedValue?.amount ?? '',
    currency: request.estimatedValue?.currency ?? currency,
    estimationBasis: request.estimationBasis ?? '',
    accountingReference: request.accountingReference ?? '',
    contractTermMonths:
      request.contractTermMonths === null ? '' : String(request.contractTermMonths),
    renewalOptions: request.renewalOptions ?? '',
    totalAmount: request.estimatedTotalCommitment?.amount ?? '',
    fundingStatus: request.fundingStatus,
    priority: request.priority,
  };
}

function bodyOf(form: FormState): BusinessCaseBody {
  return {
    title: form.title.trim(),
    problemStatement: textOrNull(form.problemStatement),
    expectedOutcomes: textOrNull(form.expectedOutcomes),
    scopeDescription: textOrNull(form.scopeDescription),
    quantities: textOrNull(form.quantities),
    deliveryLocations: textOrNull(form.deliveryLocations),
    targetDate: form.targetDate === '' ? null : form.targetDate,
    constraints: textOrNull(form.constraints),
    stakeholders: textOrNull(form.stakeholders),
    consequenceOfDelay: textOrNull(form.consequenceOfDelay),
    risks: textOrNull(form.risks),
    needType: form.needType,
    replacesContractId:
      form.needType === 'new_expenditure' ? null : idOrNull(form.replacesContractId),
    legalEntityId: idOrNull(form.legalEntityId),
    departmentId: idOrNull(form.departmentId),
    categoryId: idOrNull(form.categoryId),
    costCenterId: idOrNull(form.costCenterId),
    fundingSourceId: idOrNull(form.fundingSourceId),
    projectId: idOrNull(form.projectId),
    sponsorUserId: idOrNull(form.sponsorUserId),
    budgetOwnerUserId: idOrNull(form.budgetOwnerUserId),
    estimatedValue:
      form.estimatedAmount === ''
        ? null
        : { amount: form.estimatedAmount, currency: form.currency },
    estimationBasis: textOrNull(form.estimationBasis),
    accountingReference: textOrNull(form.accountingReference),
    contractTermMonths: form.contractTermMonths === '' ? null : Number(form.contractTermMonths),
    renewalOptions: textOrNull(form.renewalOptions),
    estimatedTotalCommitment:
      form.totalAmount === '' ? null : { amount: form.totalAmount, currency: form.currency },
    fundingStatus: form.fundingStatus,
    priority: form.priority,
  };
}

function sameState(a: FormState, b: FormState): boolean {
  return (Object.keys(a) as (keyof FormState)[]).every((key) => a[key] === b[key]);
}

/** Client checks mirroring the contract, so obvious mistakes never leave the page. */
function clientErrors(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.trim().length < 3) {
    errors.title = t('requests.form.errors.title');
  }
  if (form.needType !== 'new_expenditure' && form.replacesContractId === '') {
    errors.replacesContractId = t('requests.errors.REPLACED_CONTRACT_REQUIRED');
  }
  if (form.contractTermMonths !== '') {
    const months = Number(form.contractTermMonths);
    if (months < 1 || months > 240) {
      errors.contractTermMonths = t('requests.form.errors.term');
    }
  }
  return errors;
}

export default function RequestFormPage() {
  const { requestId } = useParams();
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  if (requestId === undefined) {
    return (
      <div className="tiq-page">
        <QueryView query={options}>
          {(data) => <RequestForm options={data} request={null} />}
        </QueryView>
      </div>
    );
  }
  const id = Number(requestId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('requests.detail.notFound')}
          back={{ to: requestPaths.register, label: t('requests.detail.back') }}
        />
        <EmptyState title={t('requests.detail.notFound')} />
      </div>
    );
  }
  return <EditLoader key={id} requestId={id} />;
}

function EditLoader({ requestId }: { readonly requestId: number }) {
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const request = useApiQuery(requestEndpoints.getRequest, { params: { requestId } });
  return (
    <div className="tiq-page">
      <QueryView query={request}>
        {(detail) => (
          <QueryView query={options}>
            {(data) =>
              detail.allowedActions.includes('edit') ? (
                <RequestForm options={data} request={detail} />
              ) : (
                <>
                  <PageHeader
                    title={t('requests.form.editTitle', { reference: detail.reference })}
                    back={{
                      to: requestPaths.request(detail.id),
                      label: t('requests.form.backToRequest'),
                    }}
                  />
                  <Banner tone="warning" title={t('requests.form.notEditableTitle')}>
                    <p>
                      {t('requests.form.notEditable', {
                        status: tEnum('procurement_requests.status', detail.status),
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

function RequestForm({
  options,
  request,
}: {
  readonly options: RequestOptions;
  readonly request: RequestDetail | null;
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const defaultCurrency = currencyFallback(tenant?.defaultCurrency, options.currencies[0]);
  const [current, setCurrent] = useState<RequestDetail | null>(request);
  const [baseline, setBaseline] = useState<FormState>(() =>
    request === null ? emptyState(defaultCurrency) : stateOf(request, defaultCurrency),
  );
  const [form, setForm] = useState<FormState>(baseline);
  const [custom, setCustom] = useState<CustomFieldValues>(() => ({
    ...(request?.customFields ?? {}),
  }));
  const [customBaseline, setCustomBaseline] = useState<CustomFieldValues>(custom);
  const [customIssues, setCustomIssues] = useState<readonly CustomFieldIssue[]>([]);
  const [tried, setTried] = useState(false);
  const [assessment, setAssessment] = useState<RequestChangeAssessment | null>(null);
  const [created, setCreated] = useState<RequestDetail | null>(null);
  const create = useApiMutation(requestEndpoints.createRequest);
  const update = useApiMutation(requestEndpoints.updateRequest);
  const mutation = request === null ? create : update;
  const serverErrors = formErrors(mutation.error, FIELD_NAMES);
  const local = clientErrors(form);
  const dirty = !sameState(form, baseline) || !sameCustomValues(custom, customBaseline);
  const categoryCode =
    options.categories.find((category) => String(category.id) === form.categoryId)?.code ?? null;
  const customContext = useMemo(
    () => ({
      category_code: categoryCode,
      value_band: DECIMAL_AMOUNT.test(form.estimatedAmount)
        ? valueBandOf(form.estimatedAmount)
        : null,
    }),
    [categoryCode, form.estimatedAmount],
  );
  const approved = current?.status === 'approved';

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  const errorOf = (field: string, localKey: string = field): string | undefined =>
    serverErrors.forField(field) ?? (tried ? local[localKey] : undefined);
  const materialHint = (field: string): string | undefined =>
    approved && (REQUEST_MATERIAL_FIELDS as readonly string[]).includes(field)
      ? t('requests.form.materialHint')
      : undefined;

  const onSave = async (): Promise<void> => {
    setTried(true);
    if (Object.keys(local).length > 0) return;
    // Required custom fields are checked on submission; wrong values block the save.
    if (customIssues.some((issue) => issue.code !== 'CUSTOM_FIELD_REQUIRED')) return;
    try {
      if (current === null) {
        const detail = await create.mutate({ body: { ...bodyOf(form), customFields: custom } });
        setCreated(detail);
        setBaseline(form);
        setCustomBaseline(custom);
        toast.show(t('requests.form.created', { reference: detail.reference }), 'success');
      } else {
        const result = await update.mutate({
          params: { requestId: current.id },
          body: { ...bodyOf(form), customFields: custom, expectedRevision: current.revision },
        });
        setCurrent(result.request);
        const savedCustom = { ...(result.request.customFields ?? {}) };
        setCustom(savedCustom);
        setCustomBaseline(savedCustom);
        setAssessment(result.changeAssessment);
        const next = stateOf(result.request, defaultCurrency);
        setBaseline(next);
        setForm(next);
        setTried(false);
        toast.show(
          result.changeAssessment.message,
          result.changeAssessment.reapprovalRequired ? 'info' : 'success',
        );
      }
    } catch {
      // The mutation keeps the error; the summary shows it.
    }
  };

  if (created !== null) {
    return (
      <>
        <PageHeader
          title={t('requests.form.createdTitle')}
          back={{ to: requestPaths.register, label: t('requests.detail.back') }}
          meta={
            <>
              <Reference value={created.reference} />
              <StatusChip enum="procurement_requests.status" value={created.status} />
            </>
          }
        />
        <Banner
          tone="success"
          title={t('requests.form.savedDraftTitle', { reference: created.reference })}
        >
          <p>{t('requests.form.savedDraft')}</p>
        </Banner>
        <Card title={t('requests.detail.readiness')}>
          <ReadinessChecklist
            label={t('requests.detail.readiness')}
            items={created.submissionReadiness.map((item) => ({
              id: item.id,
              label: item.label,
              detail: item.detail ?? undefined,
              status: item.status,
            }))}
          />
        </Card>
        <div className="tiq-inline">
          <ButtonLink to={requestPaths.register} icon="arrowLeft">
            {t('requests.form.backToRegister')}
          </ButtonLink>
        </div>
      </>
    );
  }

  const people = (role: 'sponsor' | 'budget_owner') =>
    options.people
      .filter((person) => person.roles.includes(role))
      .map((person) => ({ value: String(person.userId), label: person.fullName }));
  const coded = (items: readonly { id: number; code: string; name: string }[]) =>
    items.map((item) => ({ value: String(item.id), label: `${item.code} ${item.name}` }));

  return (
    <>
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <PageHeader
        title={
          current === null
            ? t('requests.form.newTitle')
            : t('requests.form.editTitle', { reference: current.reference })
        }
        back={
          current === null
            ? { to: requestPaths.register, label: t('requests.detail.back') }
            : { to: requestPaths.request(current.id), label: t('requests.form.backToRequest') }
        }
        meta={
          current === null ? undefined : (
            <>
              <Reference value={current.reference} />
              <StatusChip enum="procurement_requests.status" value={current.status} />
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
            {current === null ? t('requests.form.saveDraft') : t('requests.form.saveChanges')}
          </Button>
        }
      />

      <Banner
        tone={approved ? 'warning' : 'info'}
        title={t(
          `requests.form.stage.${current === null ? 'new' : approved ? 'approved' : current.status === 'draft' ? 'draft' : 'review'}Title`,
        )}
      >
        <p>
          {t(
            `requests.form.stage.${current === null ? 'new' : approved ? 'approved' : current.status === 'draft' ? 'draft' : 'review'}`,
          )}
        </p>
      </Banner>

      {assessment !== null && (
        <Banner
          tone={assessment.reapprovalRequired ? 'warning' : 'success'}
          title={
            assessment.reapprovalRequired
              ? t('requests.form.reapprovalTitle')
              : t('requests.form.savedTitle', { revision: assessment.revision })
          }
        >
          <p>{assessment.message}</p>
          {assessment.changedFields.length > 0 && (
            <p className="tiq-cell-sub">
              {t('requests.form.changedFields', {
                fields: assessment.changedFields
                  .map((field) => t(`requests.fields.${field}`))
                  .join(', '),
              })}
            </p>
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

      <Card title={t('requests.detail.sections.need')}>
        <div className="tiq-form-grid">
          <TextField
            label={t('requests.fields.title')}
            required
            fieldClassName="tiq-form-full"
            value={form.title}
            onChange={(value) => set('title', value)}
            error={errorOf('title')}
          />
          <TextArea
            label={t('requests.fields.problemStatement')}
            fieldClassName="tiq-form-full"
            value={form.problemStatement}
            onChange={(value) => set('problemStatement', value)}
            error={errorOf('problemStatement')}
          />
          <TextArea
            label={t('requests.fields.expectedOutcomes')}
            fieldClassName="tiq-form-full"
            value={form.expectedOutcomes}
            onChange={(value) => set('expectedOutcomes', value)}
            error={errorOf('expectedOutcomes')}
          />
          <TextArea
            label={t('requests.fields.consequenceOfDelay')}
            fieldClassName="tiq-form-full"
            rows={2}
            value={form.consequenceOfDelay}
            onChange={(value) => set('consequenceOfDelay', value)}
            error={errorOf('consequenceOfDelay')}
          />
          <RadioGroup
            label={t('requests.fields.needType')}
            inline
            required
            value={form.needType}
            onChange={(value) => set('needType', value as ProcurementRequestsNeedType)}
            options={enumOptions('procurement_requests.need_type')}
            error={errorOf('needType')}
          />
          {form.needType !== 'new_expenditure' && (
            <Select
              label={t('requests.fields.replacesContractId')}
              required
              value={form.replacesContractId}
              onChange={(value) => set('replacesContractId', value)}
              placeholder={t('requests.common.select')}
              options={options.contracts.map((contract) => ({
                value: String(contract.id),
                label: `${contract.reference} ${contract.title}${
                  contract.expiresOn === null
                    ? ''
                    : ` · ${t('requests.form.expires', { date: contract.expiresOn })}`
                }`,
              }))}
              error={errorOf('replacesContractId')}
            />
          )}
        </div>
      </Card>

      <Card title={t('requests.detail.sections.scope')}>
        <div className="tiq-form-grid">
          <TextArea
            label={t('requests.fields.scopeDescription')}
            fieldClassName="tiq-form-full"
            hint={materialHint('scopeDescription')}
            value={form.scopeDescription}
            onChange={(value) => set('scopeDescription', value)}
            error={errorOf('scopeDescription')}
          />
          <TextArea
            label={t('requests.fields.quantities')}
            rows={2}
            hint={materialHint('quantities')}
            value={form.quantities}
            onChange={(value) => set('quantities', value)}
            error={errorOf('quantities')}
          />
          <TextArea
            label={t('requests.fields.deliveryLocations')}
            rows={2}
            value={form.deliveryLocations}
            onChange={(value) => set('deliveryLocations', value)}
            error={errorOf('deliveryLocations')}
          />
          <DateInput
            label={t('requests.fields.targetDate')}
            value={form.targetDate}
            onChange={(value) => set('targetDate', value)}
            error={errorOf('targetDate')}
          />
          <Select
            label={t('requests.fields.priority')}
            value={form.priority}
            onChange={(value) => set('priority', value as ProcurementRequestsPriority)}
            options={enumOptions('procurement_requests.priority')}
            error={errorOf('priority')}
          />
          <TextArea
            label={t('requests.fields.constraints')}
            rows={2}
            value={form.constraints}
            onChange={(value) => set('constraints', value)}
            error={errorOf('constraints')}
          />
          <TextArea
            label={t('requests.fields.stakeholders')}
            rows={2}
            value={form.stakeholders}
            onChange={(value) => set('stakeholders', value)}
            error={errorOf('stakeholders')}
          />
          <TextArea
            label={t('requests.fields.risks')}
            fieldClassName="tiq-form-full"
            rows={2}
            hint={materialHint('risks')}
            value={form.risks}
            onChange={(value) => set('risks', value)}
            error={errorOf('risks')}
          />
        </div>
      </Card>

      <Card title={t('requests.detail.sections.budget')}>
        <div className="tiq-form-grid">
          <MoneyInput
            label={t('requests.fields.estimatedValue')}
            hint={materialHint('estimatedValue')}
            currencies={options.currencies}
            value={{ amount: form.estimatedAmount, currency: form.currency }}
            onChange={(value) => {
              set('estimatedAmount', value.amount);
              set('currency', value.currency);
            }}
            error={errorOf('estimatedValue')}
          />
          <MoneyInput
            label={t('requests.fields.estimatedTotalCommitment')}
            hint={materialHint('estimatedTotalCommitment') ?? t('requests.form.totalHint')}
            currencies={[form.currency]}
            value={{ amount: form.totalAmount, currency: form.currency }}
            onChange={(value) => set('totalAmount', value.amount)}
            error={errorOf('estimatedTotalCommitment')}
          />
          <TextArea
            label={t('requests.fields.estimationBasis')}
            fieldClassName="tiq-form-full"
            rows={2}
            value={form.estimationBasis}
            onChange={(value) => set('estimationBasis', value)}
            error={errorOf('estimationBasis')}
          />
          <NumberInput
            label={t('requests.fields.contractTermMonths')}
            hint={materialHint('contractTermMonths')}
            suffix={t('requests.form.monthsSuffix')}
            value={form.contractTermMonths}
            onChange={(value) => set('contractTermMonths', value)}
            error={errorOf('contractTermMonths')}
          />
          <TextField
            label={t('requests.fields.renewalOptions')}
            hint={materialHint('renewalOptions')}
            value={form.renewalOptions}
            onChange={(value) => set('renewalOptions', value)}
            error={errorOf('renewalOptions')}
          />
          <RadioGroup
            label={t('requests.fields.fundingStatus')}
            fieldClassName="tiq-form-full"
            hint={materialHint('fundingStatus')}
            value={form.fundingStatus}
            onChange={(value) => set('fundingStatus', value as ProcurementRequestsFundingStatus)}
            options={enumOptions('procurement_requests.funding_status').map((option) => ({
              ...option,
              hint: t(`requests.funding.explain.${option.value}`),
            }))}
            error={errorOf('fundingStatus')}
          />
          <Select
            label={t('requests.fields.fundingSourceId')}
            hint={materialHint('fundingSourceId')}
            value={form.fundingSourceId}
            onChange={(value) => set('fundingSourceId', value)}
            placeholder={t('requests.common.select')}
            options={options.fundingSources.map((source) => ({
              value: String(source.id),
              label: `${source.code} ${source.name} (${tEnum('funding_sources.source_type', source.sourceType)})`,
            }))}
            error={errorOf('fundingSourceId')}
          />
          <Select
            label={t('requests.fields.budgetOwnerUserId')}
            value={form.budgetOwnerUserId}
            onChange={(value) => set('budgetOwnerUserId', value)}
            placeholder={t('requests.common.select')}
            options={people('budget_owner')}
            error={errorOf('budgetOwnerUserId')}
          />
          <Select
            label={t('requests.fields.costCenterId')}
            value={form.costCenterId}
            onChange={(value) => set('costCenterId', value)}
            placeholder={t('requests.common.select')}
            options={coded(options.costCenters)}
            error={errorOf('costCenterId')}
          />
          <TextField
            label={t('requests.fields.accountingReference')}
            value={form.accountingReference}
            onChange={(value) => set('accountingReference', value)}
            error={errorOf('accountingReference')}
          />
          <Select
            label={t('requests.fields.projectId')}
            value={form.projectId}
            onChange={(value) => set('projectId', value)}
            placeholder={t('requests.common.none')}
            options={options.projects.map((project) => ({
              value: String(project.id),
              label: `${project.reference} ${project.title}`,
            }))}
            error={errorOf('projectId')}
          />
        </div>
      </Card>

      <Card title={t('requests.detail.sections.people')}>
        <div className="tiq-form-grid">
          <Select
            label={t('requests.fields.legalEntityId')}
            hint={materialHint('legalEntityId')}
            value={form.legalEntityId}
            onChange={(value) => set('legalEntityId', value)}
            placeholder={t('requests.common.select')}
            options={options.legalEntities.map((entity) => ({
              value: String(entity.id),
              label: entity.name,
            }))}
            error={errorOf('legalEntityId')}
          />
          <Select
            label={t('requests.fields.departmentId')}
            value={form.departmentId}
            onChange={(value) => set('departmentId', value)}
            placeholder={t('requests.common.select')}
            options={coded(options.departments)}
            error={errorOf('departmentId')}
          />
          <Select
            label={t('requests.fields.categoryId')}
            value={form.categoryId}
            onChange={(value) => set('categoryId', value)}
            placeholder={t('requests.common.select')}
            options={coded(options.categories)}
            error={errorOf('categoryId')}
          />
          <Select
            label={t('requests.fields.sponsorUserId')}
            value={form.sponsorUserId}
            onChange={(value) => set('sponsorUserId', value)}
            placeholder={t('requests.common.select')}
            options={people('sponsor')}
            error={errorOf('sponsorUserId')}
          />
        </div>
      </Card>

      <Card title={t('requests.form.customFields')}>
        <CustomFieldsSection
          entityType="procurement_request"
          values={custom}
          onChange={setCustom}
          context={customContext}
          showErrors={tried}
          serverErrors={mutation.error?.fieldErrors}
          onValidationChange={setCustomIssues}
        />
      </Card>

      <div className="tiq-inline">
        <Button
          variant="primary"
          icon="check"
          loading={mutation.pending}
          disabled={!dirty}
          onClick={() => void onSave()}
        >
          {current === null ? t('requests.form.saveDraft') : t('requests.form.saveChanges')}
        </Button>
        {current !== null && (
          <ButtonLink to={requestPaths.request(current.id)}>
            {t('requests.form.backToRequest')}
          </ButtonLink>
        )}
        <span className="tiq-text-muted">{t('requests.form.saveNote')}</span>
      </div>
    </>
  );
}
