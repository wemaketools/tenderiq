/**
 * BUY-05 plan item form: plan a procurement event, prioritize it, allocate its owner, set its budget period,
 * expected value, planned release and award dates, resource demand and dependency. A dependency cannot release
 * after the item that depends on it (`DEPENDENCY_ORDER`) and a chain cannot loop (`DEPENDENCY_CYCLE`).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { REQUEST_READ, requestEndpoints } from '@contracts/requests';
import type { CreatePlanItemBody, PlanItemDetail, RequestOptions } from '@contracts/requests';
import type { ProcurementRequestsPriority } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
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
  Select,
  StatusChip,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { currencyFallback } from '../../requests/lib';
import { enumOptions, explainError, planningPaths } from '../lib';

interface FormState {
  readonly title: string;
  readonly projectId: string;
  readonly requestId: string;
  readonly categoryId: string;
  readonly departmentId: string;
  readonly ownerUserId: string;
  readonly budgetPeriod: string;
  readonly amount: string;
  readonly currency: string;
  readonly plannedReleaseDate: string;
  readonly plannedAwardDate: string;
  readonly resourceDemandDays: string;
  readonly priority: ProcurementRequestsPriority;
  readonly dependsOnId: string;
}

const FIELD_NAMES = [
  'title',
  'projectId',
  'requestId',
  'categoryId',
  'departmentId',
  'ownerUserId',
  'budgetPeriod',
  'expectedValue',
  'plannedReleaseDate',
  'plannedAwardDate',
  'resourceDemandDays',
  'priority',
  'dependsOnId',
  'status',
];

const id = (value: { readonly id: number } | null): string =>
  value === null ? '' : String(value.id);
const num = (value: string): number | null => (value === '' ? null : Number(value));

function stateOf(
  item: PlanItemDetail | null,
  options: RequestOptions,
  tenantCurrency: string | null,
): FormState {
  return {
    title: item?.title ?? '',
    projectId: item === null ? '' : id(item.project),
    requestId: item === null ? '' : id(item.request),
    categoryId: item === null ? '' : id(item.category),
    departmentId: item === null ? '' : id(item.department),
    ownerUserId: item?.owner === null || item === null ? '' : String(item.owner.userId),
    budgetPeriod: item?.budgetPeriod ?? options.budgetPeriods[0] ?? '',
    amount: item?.expectedValue?.amount ?? '',
    currency: currencyFallback(
      item?.expectedValue?.currency,
      tenantCurrency,
      options.currencies[0],
    ),
    plannedReleaseDate: item?.plannedReleaseDate ?? '',
    plannedAwardDate: item?.plannedAwardDate ?? '',
    resourceDemandDays: item === null ? '' : String(item.resourceDemandDays),
    priority: item?.priority ?? 'normal',
    dependsOnId: item === null ? '' : id(item.dependsOn),
  };
}

function bodyOf(form: FormState): CreatePlanItemBody {
  return {
    title: form.title.trim(),
    projectId: num(form.projectId),
    requestId: num(form.requestId),
    categoryId: num(form.categoryId),
    departmentId: num(form.departmentId),
    ownerUserId: num(form.ownerUserId),
    budgetPeriod: form.budgetPeriod,
    expectedValue: form.amount === '' ? null : { amount: form.amount, currency: form.currency },
    plannedReleaseDate: form.plannedReleaseDate === '' ? null : form.plannedReleaseDate,
    plannedAwardDate: form.plannedAwardDate === '' ? null : form.plannedAwardDate,
    resourceDemandDays: form.resourceDemandDays === '' ? 0 : Number(form.resourceDemandDays),
    priority: form.priority,
    dependsOnId: num(form.dependsOnId),
  };
}

function clientErrors(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.trim().length < 3) errors.title = t('planning.form.errors.title');
  if (form.budgetPeriod === '') errors.budgetPeriod = t('planning.form.errors.budgetPeriod');
  if (form.resourceDemandDays !== '' && Number(form.resourceDemandDays) > 500) {
    errors.resourceDemandDays = t('planning.form.errors.days');
  }
  if (
    form.plannedReleaseDate !== '' &&
    form.plannedAwardDate !== '' &&
    form.plannedAwardDate < form.plannedReleaseDate
  ) {
    errors.plannedAwardDate = t('planning.form.errors.dateOrder');
  }
  return errors;
}

export default function PlanItemFormPage() {
  const { planItemId } = useParams();
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  if (planItemId === undefined) {
    return (
      <div className="tiq-page">
        <QueryView query={options}>
          {(data) => <PlanItemForm options={data} item={null} />}
        </QueryView>
      </div>
    );
  }
  const itemId = Number(planItemId);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('planning.item.notFound')}
          back={{ to: planningPaths.plan, label: t('planning.item.back') }}
        />
        <EmptyState title={t('planning.item.notFound')} />
      </div>
    );
  }
  return <EditLoader key={itemId} planItemId={itemId} />;
}

function EditLoader({ planItemId }: { readonly planItemId: number }) {
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const item = useApiQuery(requestEndpoints.getPlanItem, { params: { planItemId } });
  return (
    <div className="tiq-page">
      <QueryView query={item}>
        {(detail) => (
          <QueryView query={options}>
            {(data) =>
              detail.allowedActions.includes('edit') ? (
                <PlanItemForm options={data} item={detail} />
              ) : (
                <>
                  <PageHeader
                    title={t('planning.form.editTitle', { title: detail.title })}
                    back={{
                      to: planningPaths.item(detail.id),
                      label: t('planning.form.backToItem'),
                    }}
                  />
                  <Banner tone="warning" title={t('planning.form.lockedTitle')}>
                    <p>
                      {t('planning.form.locked', {
                        status: tEnum('plan_items.status', detail.status),
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

function PlanItemForm({
  options,
  item,
}: {
  readonly options: RequestOptions;
  readonly item: PlanItemDetail | null;
}) {
  const toast = useToast();
  const canReadRequests = usePermission(REQUEST_READ);
  const planItems = useApiQuery(requestEndpoints.listPlanItems, {
    query: { pageSize: 100, sort: 'title', dir: 'asc' },
  });
  // A plan item may reference a request from its submission on (never a private draft); the tender still waits
  // for the request's approval.
  const plannable = useApiQuery(
    requestEndpoints.listRequests,
    canReadRequests
      ? {
          query: {
            status: ['submitted', 'under_review', 'information_requested', 'approved', 'deferred'],
            pageSize: 100,
          },
        }
      : null,
  );
  const tenantCurrency = useActiveTenant()?.defaultCurrency ?? null;
  const [current, setCurrent] = useState<PlanItemDetail | null>(item);
  const [baseline, setBaseline] = useState<FormState>(() => stateOf(item, options, tenantCurrency));
  const [form, setForm] = useState<FormState>(baseline);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<PlanItemDetail | null>(null);
  const create = useApiMutation(requestEndpoints.createPlanItem);
  const update = useApiMutation(requestEndpoints.updatePlanItem);
  const mutation = current === null ? create : update;
  const serverErrors = formErrors(mutation.error, FIELD_NAMES);
  const local = clientErrors(form);
  const dirty = (Object.keys(form) as (keyof FormState)[]).some(
    (key) => form[key] !== baseline[key],
  );
  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  const errorOf = (field: string): string | undefined =>
    serverErrors.forField(field) ?? (tried ? local[field] : undefined);
  const coded = (items: readonly { id: number; code: string; name: string }[]) =>
    items.map((entry) => ({ value: String(entry.id), label: `${entry.code} ${entry.name}` }));

  const onSave = async (): Promise<void> => {
    setTried(true);
    if (Object.keys(local).length > 0) return;
    try {
      const next =
        current === null
          ? await create.mutate({ body: bodyOf(form) })
          : await update.mutate({
              params: { planItemId: current.id },
              body: {
                ...bodyOf(form),
                status:
                  current.status === 'planned' || current.status === 'scheduled'
                    ? current.status
                    : undefined,
              },
            });
      setCurrent(next);
      setSaved(next);
      const nextState = stateOf(next, options, tenantCurrency);
      setBaseline(nextState);
      setForm(nextState);
      setTried(false);
      toast.show(t('planning.form.saved', { title: next.title }), 'success');
    } catch {
      // The mutation keeps the error; the summary shows it.
    }
  };

  return (
    <>
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <PageHeader
        title={
          current === null
            ? t('planning.form.newTitle')
            : t('planning.form.editTitle', { title: current.title })
        }
        back={
          current === null
            ? { to: planningPaths.plan, label: t('planning.item.back') }
            : { to: planningPaths.item(current.id), label: t('planning.form.backToItem') }
        }
        meta={
          current === null ? undefined : (
            <StatusChip enum="plan_items.status" value={current.status} />
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
            {t('planning.form.save')}
          </Button>
        }
      />
      {saved !== null && (
        <Banner tone="success" title={t('planning.form.savedTitle')}>
          <p>
            {t('planning.form.savedBody', { status: tEnum('plan_items.status', saved.status) })}
          </p>
          {saved.warnings.length > 0 && (
            <ul>
              {saved.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {saved.id < 900 && (
            <ButtonLink to={planningPaths.item(saved.id)} size="sm">
              {t('planning.form.openItem')}
            </ButtonLink>
          )}
        </Banner>
      )}
      <FormErrorSummary
        title={explainError(mutation.error)?.detail ?? mutation.error?.title ?? null}
        errors={serverErrors.other}
      />

      <Card title={t('planning.item.sections.plan')}>
        <div className="tiq-form-grid">
          <TextField
            label={t('planning.fields.title')}
            required
            fieldClassName="tiq-form-full"
            value={form.title}
            onChange={(value) => set('title', value)}
            error={errorOf('title')}
          />
          <Select
            label={t('planning.fields.ownerUserId')}
            value={form.ownerUserId}
            onChange={(value) => set('ownerUserId', value)}
            placeholder={t('planning.common.unassigned')}
            options={options.people
              .filter((person) => person.roles.includes('plan_owner'))
              .map((person) => ({ value: String(person.userId), label: person.fullName }))}
            error={errorOf('ownerUserId')}
          />
          <Select
            label={t('planning.fields.priority')}
            value={form.priority}
            onChange={(value) => set('priority', value as ProcurementRequestsPriority)}
            options={enumOptions('procurement_requests.priority')}
            error={errorOf('priority')}
          />
          <Select
            label={t('planning.fields.budgetPeriod')}
            required
            value={form.budgetPeriod}
            onChange={(value) => set('budgetPeriod', value)}
            options={options.budgetPeriods.map((period) => ({ value: period, label: period }))}
            error={errorOf('budgetPeriod')}
          />
          <MoneyInput
            label={t('planning.fields.expectedValue')}
            currencies={options.currencies}
            value={{ amount: form.amount, currency: form.currency }}
            onChange={(value) => {
              set('amount', value.amount);
              set('currency', value.currency);
            }}
            error={errorOf('expectedValue')}
          />
          <DateInput
            label={t('planning.fields.plannedReleaseDate')}
            hint={t('planning.form.releaseHint')}
            value={form.plannedReleaseDate}
            onChange={(value) => set('plannedReleaseDate', value)}
            error={errorOf('plannedReleaseDate')}
          />
          <DateInput
            label={t('planning.fields.plannedAwardDate')}
            value={form.plannedAwardDate}
            onChange={(value) => set('plannedAwardDate', value)}
            error={errorOf('plannedAwardDate')}
          />
          <NumberInput
            label={t('planning.fields.resourceDemandDays')}
            hint={t('planning.form.daysHint')}
            suffix={t('planning.form.daysSuffix')}
            value={form.resourceDemandDays}
            onChange={(value) => set('resourceDemandDays', value)}
            error={errorOf('resourceDemandDays')}
          />
          <Select
            label={t('planning.fields.dependsOnId')}
            hint={t('planning.form.dependsHint')}
            value={form.dependsOnId}
            onChange={(value) => set('dependsOnId', value)}
            placeholder={t('planning.common.none')}
            options={(planItems.data?.items ?? [])
              .filter((row) => row.id !== current?.id)
              .map((row) => ({ value: String(row.id), label: row.title }))}
            error={errorOf('dependsOnId')}
          />
        </div>
      </Card>

      <Card title={t('planning.form.links')}>
        <div className="tiq-form-grid">
          <Select
            label={t('planning.fields.requestId')}
            value={form.requestId}
            onChange={(value) => set('requestId', value)}
            placeholder={t('planning.common.none')}
            options={[
              ...(current?.request !== null && current?.request !== undefined
                ? [
                    {
                      value: String(current.request.id),
                      label: `${current.request.reference} ${current.request.title}`,
                    },
                  ]
                : []),
              ...(plannable.data?.items ?? [])
                .filter((row) => row.id !== current?.request?.id)
                .map((row) => ({ value: String(row.id), label: `${row.reference} ${row.title}` })),
            ]}
            hint={t('planning.form.requestHint')}
            error={errorOf('requestId')}
          />
          <Select
            label={t('planning.fields.projectId')}
            value={form.projectId}
            onChange={(value) => set('projectId', value)}
            placeholder={t('planning.common.none')}
            options={options.projects.map((project) => ({
              value: String(project.id),
              label: `${project.reference} ${project.title}`,
            }))}
            error={errorOf('projectId')}
          />
          <Select
            label={t('planning.fields.categoryId')}
            value={form.categoryId}
            onChange={(value) => set('categoryId', value)}
            placeholder={t('planning.common.none')}
            options={coded(options.categories)}
            error={errorOf('categoryId')}
          />
          <Select
            label={t('planning.fields.departmentId')}
            value={form.departmentId}
            onChange={(value) => set('departmentId', value)}
            placeholder={t('planning.common.none')}
            options={coded(options.departments)}
            error={errorOf('departmentId')}
          />
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
          {t('planning.form.save')}
        </Button>
        <span className="tiq-text-muted">{t('planning.form.saveNote')}</span>
      </div>
    </>
  );
}
