/**
 * The request commands of BUY-02, BUY-03 and BUY-04, each confirmed through ConfirmActionDialog (COM-02): assign,
 * request information, respond, combine (originals preserved, aggregate value), split (parts add up to the
 * overall value), defer, route to an existing contract, submit, withdraw, rescind, reconsider and close.
 */
import { useState } from 'react';

import { sum } from '@contracts/decimal';
import { requestEndpoints } from '@contracts/requests';
import type { InfoRequest, ReadinessItem, RequestDetail } from '@contracts/requests';
import type { Money } from '@contracts/common';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Checkbox,
  ConfirmActionDialog,
  DateInput,
  DateTimeInput,
  MoneyInput,
  MultiSelect,
  RadioGroup,
  ReadinessChecklist,
  Select,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { formatMoney } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { currencyFallback, explainError } from '../lib';

export type RequestDialogKind =
  | 'assign'
  | 'request_info'
  | 'respond_info'
  | 'combine'
  | 'split'
  | 'defer'
  | 'route_to_contract'
  | 'submit'
  | 'withdraw'
  | 'rescind'
  | 'reconsider'
  | 'close';

/** The request fields every dialog needs. */
export interface DialogRequest {
  readonly id: number;
  readonly reference: string;
  readonly title: string;
  readonly revision: number;
  readonly estimatedValue: Money | null;
  readonly owner: { readonly userId: number; readonly fullName: string } | null;
}

export interface RequestActionDialogProps {
  readonly kind: RequestDialogKind;
  readonly request: DialogRequest;
  readonly onClose: () => void;
  /** Called with a confirmation message and the updated request (when the command returns one). */
  readonly onDone: (message: string, detail: RequestDetail | null) => void;
  /** The open information request answered by `respond_info`. */
  readonly infoRequest?: InfoRequest | null;
  /** The readiness shown before `submit`. */
  readonly readiness?: readonly ReadinessItem[];
}

export function RequestActionDialog(props: RequestActionDialogProps) {
  switch (props.kind) {
    case 'assign':
      return <AssignDialog {...props} />;
    case 'request_info':
      return <RequestInfoDialog {...props} />;
    case 'respond_info':
      return <RespondInfoDialog {...props} />;
    case 'combine':
      return <CombineDialog {...props} />;
    case 'split':
      return <SplitDialog {...props} />;
    case 'defer':
      return <DeferDialog {...props} />;
    case 'route_to_contract':
      return <RouteDialog {...props} />;
    case 'submit':
      return <SubmitDialog {...props} />;
    case 'withdraw':
    case 'rescind':
    case 'close':
      return <ReasonDialog {...props} />;
    case 'reconsider':
      return <ReconsiderDialog {...props} />;
  }
}

function scopeOf(request: DialogRequest): string {
  return `${request.reference} ${request.title}`;
}

async function attempt<T>(action: () => Promise<T>, onDone: (value: T) => void): Promise<void> {
  try {
    onDone(await action());
  } catch {
    // The mutation keeps the error; the dialog shows it.
  }
}

function AssignDialog({ request, onClose, onDone }: RequestActionDialogProps) {
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const assign = useApiMutation(requestEndpoints.assignRequest);
  const [owner, setOwner] = useState(request.owner === null ? '' : String(request.owner.userId));
  const [tried, setTried] = useState(false);
  const errors = formErrors(assign.error, ['ownerUserId', 'reason', 'note']);
  const people = (options.data?.people ?? []).filter((person) => person.roles.includes('owner'));
  const missing = owner === '';
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.assign.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.assign.consequence')}
      confirmLabel={t('requests.dialogs.assign.confirm')}
      reason={{ label: t('requests.dialogs.assign.note'), required: false }}
      pending={assign.pending}
      error={explainError(assign.error)}
      onCancel={onClose}
      onConfirm={({ reason }) => {
        setTried(true);
        if (missing) return;
        void attempt(
          () =>
            assign.mutate({
              params: { requestId: request.id },
              body: { ownerUserId: Number(owner), note: reason === '' ? null : reason },
            }),
          (detail) =>
            onDone(
              t('requests.dialogs.assign.done', {
                reference: request.reference,
                name: detail.owner?.fullName ?? '',
              }),
              detail,
            ),
        );
      }}
    >
      <Select
        label={t('requests.dialogs.assign.owner')}
        required
        value={owner}
        onChange={setOwner}
        placeholder={t('requests.common.select')}
        options={people.map((person) => ({
          value: String(person.userId),
          label:
            person.capacity === null ? person.fullName : `${person.fullName} (${person.capacity})`,
        }))}
        error={
          errors.forField('ownerUserId') ??
          (tried && missing ? t('requests.dialogs.assign.ownerRequired') : undefined)
        }
      />
    </ConfirmActionDialog>
  );
}

function RequestInfoDialog({ request, onClose, onDone }: RequestActionDialogProps) {
  const tenant = useActiveTenant();
  const ask = useApiMutation(requestEndpoints.requestInformation);
  const [question, setQuestion] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const errors = formErrors(ask.error, ['question', 'dueAt']);
  const missing = question.trim().length < 5;
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.requestInfo.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.requestInfo.consequence')}
      confirmLabel={t('requests.dialogs.requestInfo.confirm')}
      pending={ask.pending}
      error={explainError(ask.error)}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        if (missing) return;
        void attempt(
          () =>
            ask.mutate({
              params: { requestId: request.id },
              body: { question: question.trim(), dueAt },
            }),
          () =>
            onDone(t('requests.dialogs.requestInfo.done', { reference: request.reference }), null),
        );
      }}
    >
      <TextArea
        label={t('requests.dialogs.requestInfo.question')}
        required
        rows={4}
        value={question}
        onChange={setQuestion}
        error={
          errors.forField('question') ??
          (tried && missing ? t('requests.dialogs.requestInfo.questionRequired') : undefined)
        }
      />
      <DateTimeInput
        label={t('requests.dialogs.requestInfo.dueAt')}
        hint={t('requests.dialogs.requestInfo.dueHint')}
        timeZone={tenant?.officialTimeZone ?? 'UTC'}
        value={dueAt}
        onChange={setDueAt}
        error={errors.forField('dueAt')}
      />
    </ConfirmActionDialog>
  );
}

function RespondInfoDialog({ request, infoRequest, onClose, onDone }: RequestActionDialogProps) {
  const respond = useApiMutation(requestEndpoints.respondToInfoRequest);
  const [text, setText] = useState('');
  const [resubmit, setResubmit] = useState(true);
  const [tried, setTried] = useState(false);
  const errors = formErrors(respond.error, ['responseText', 'resubmit']);
  const missing = text.trim() === '';
  if (infoRequest === null || infoRequest === undefined) {
    return null;
  }
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.respond.title', { reference: request.reference })}
      scope={infoRequest.question}
      consequence={
        resubmit
          ? t('requests.dialogs.respond.consequenceResubmit')
          : t('requests.dialogs.respond.consequence')
      }
      confirmLabel={t('requests.dialogs.respond.confirm')}
      pending={respond.pending}
      error={explainError(respond.error)}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        if (missing) return;
        void attempt(
          () =>
            respond.mutate({
              params: { requestId: request.id, infoRequestId: infoRequest.id },
              body: { responseText: text.trim(), resubmit },
            }),
          (detail) =>
            onDone(t('requests.dialogs.respond.done', { reference: request.reference }), detail),
        );
      }}
    >
      <TextArea
        label={t('requests.dialogs.respond.response')}
        required
        rows={5}
        value={text}
        onChange={setText}
        error={
          errors.forField('responseText') ??
          (tried && missing ? t('requests.dialogs.respond.responseRequired') : undefined)
        }
      />
      <Checkbox
        label={t('requests.dialogs.respond.resubmit')}
        checked={resubmit}
        onChange={setResubmit}
      />
    </ConfirmActionDialog>
  );
}

function CombineDialog({ request, onClose, onDone }: RequestActionDialogProps) {
  const candidates = useApiQuery(requestEndpoints.listRequests, {
    query: { status: ['submitted', 'under_review'], pageSize: 100, sort: 'reference', dir: 'asc' },
  });
  const combine = useApiMutation(requestEndpoints.combineRequests);
  const [selected, setSelected] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const errors = formErrors(combine.error, ['sourceRequestIds', 'reason']);
  const rows = (candidates.data?.items ?? []).filter((row) => row.id !== request.id);
  const missing = selected.length === 0;
  const chosen = rows.filter((row) => selected.includes(String(row.id)));
  const values = [request.estimatedValue, ...chosen.map((row) => row.estimatedValue)].filter(
    (value): value is Money => value !== null,
  );
  const currency = values[0]?.currency ?? null;
  const sameCurrency = values.every((value) => value.currency === currency);
  const aggregate =
    currency === null || !sameCurrency
      ? null
      : { amount: sum(values.map((value) => value.amount)), currency };
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.combine.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.combine.consequence')}
      confirmLabel={t('requests.dialogs.combine.confirm')}
      reason={{ label: t('requests.dialogs.combine.reason'), required: true }}
      pending={combine.pending}
      error={explainError(combine.error)}
      onCancel={onClose}
      onConfirm={({ reason }) => {
        setTried(true);
        if (missing) return;
        void attempt(
          () =>
            combine.mutate({
              params: { requestId: request.id },
              body: { sourceRequestIds: selected.map(Number), reason },
            }),
          (result) =>
            onDone(
              t(
                result.approvalRouteChanged
                  ? 'requests.dialogs.combine.doneRouteChanged'
                  : 'requests.dialogs.combine.done',
                {
                  count: result.combined.length,
                  reference: request.reference,
                  value: formatMoney(result.aggregateValue),
                },
              ),
              result.request,
            ),
        );
      }}
    >
      <MultiSelect
        label={t('requests.dialogs.combine.sources')}
        required
        value={selected}
        onChange={setSelected}
        options={rows.map((row) => ({
          value: String(row.id),
          label: `${row.reference} ${row.title} · ${formatMoney(row.estimatedValue)}`,
        }))}
        hint={
          candidates.status === 'success' && rows.length === 0
            ? t('requests.dialogs.combine.noCandidates')
            : undefined
        }
        error={
          errors.forField('sourceRequestIds') ??
          (tried && missing ? t('requests.dialogs.combine.sourcesRequired') : undefined)
        }
      />
      <Banner tone="info" title={t('requests.dialogs.combine.aggregateTitle')}>
        <p>
          {aggregate === null
            ? t('requests.dialogs.combine.aggregateUnavailable')
            : t('requests.dialogs.combine.aggregate', { value: formatMoney(aggregate) })}
        </p>
        <p>{t('requests.dialogs.combine.preserved')}</p>
      </Banner>
    </ConfirmActionDialog>
  );
}

interface SplitPart {
  readonly key: number;
  readonly title: string;
  readonly scopeDescription: string;
  readonly amount: string;
}

function SplitDialog({ request, onClose, onDone }: RequestActionDialogProps) {
  const split = useApiMutation(requestEndpoints.splitRequest);
  const tenant = useActiveTenant();
  const currency = currencyFallback(request.estimatedValue?.currency, tenant?.defaultCurrency);
  const [parts, setParts] = useState<SplitPart[]>([
    { key: 1, title: '', scopeDescription: '', amount: '' },
    { key: 2, title: '', scopeDescription: '', amount: '' },
  ]);
  const [tried, setTried] = useState(false);
  const errors = formErrors(split.error, ['parts', 'justification']);
  const total = sum(parts.map((part) => (part.amount === '' ? '0' : part.amount)));
  const incomplete = parts.some(
    (part) =>
      part.title.trim().length < 3 || part.scopeDescription.trim() === '' || part.amount === '',
  );
  const update = (key: number, values: Partial<SplitPart>): void => {
    setParts((current) =>
      current.map((part) => (part.key === key ? { ...part, ...values } : part)),
    );
  };
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.split.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.split.consequence')}
      confirmLabel={t('requests.dialogs.split.confirm')}
      reason={{ label: t('requests.dialogs.split.justification'), required: true }}
      pending={split.pending}
      error={explainError(split.error)}
      onCancel={onClose}
      onConfirm={({ reason }) => {
        setTried(true);
        if (incomplete) return;
        void attempt(
          () =>
            split.mutate({
              params: { requestId: request.id },
              body: {
                justification: reason,
                parts: parts.map((part) => ({
                  title: part.title.trim(),
                  scopeDescription: part.scopeDescription.trim(),
                  estimatedValue: { amount: part.amount, currency },
                })),
              },
            }),
          (result) =>
            onDone(
              t('requests.dialogs.split.done', {
                count: result.parts.length,
                reference: request.reference,
                value: formatMoney(result.policyValue),
              }),
              result.request,
            ),
        );
      }}
    >
      <Banner tone="info" title={t('requests.dialogs.split.overallTitle')}>
        <p>
          {t('requests.dialogs.split.overall', {
            original: formatMoney(request.estimatedValue),
            total: formatMoney({ amount: total, currency }),
          })}
        </p>
      </Banner>
      {parts.map((part, index) => (
        <fieldset key={part.key} className="tiq-fieldset">
          <legend>{t('requests.dialogs.split.part', { no: index + 1 })}</legend>
          <div className="tiq-form-grid">
            <TextField
              label={t('requests.dialogs.split.partTitle')}
              required
              value={part.title}
              onChange={(value) => update(part.key, { title: value })}
              error={errors.forField(`parts.${index}.title`)}
            />
            <MoneyInput
              label={t('requests.dialogs.split.partValue')}
              required
              currencies={[currency]}
              value={{ amount: part.amount, currency }}
              onChange={(value) => update(part.key, { amount: value.amount })}
              error={errors.forField(`parts.${index}.estimatedValue`)}
            />
            <TextArea
              label={t('requests.dialogs.split.partScope')}
              required
              rows={2}
              fieldClassName="tiq-form-full"
              value={part.scopeDescription}
              onChange={(value) => update(part.key, { scopeDescription: value })}
              error={errors.forField(`parts.${index}.scopeDescription`)}
            />
          </div>
          {parts.length > 2 && (
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={() => setParts((current) => current.filter((item) => item.key !== part.key))}
            >
              {t('requests.dialogs.split.removePart', { no: index + 1 })}
            </Button>
          )}
        </fieldset>
      ))}
      <div className="tiq-inline">
        <Button
          size="sm"
          icon="plus"
          disabled={parts.length >= 10}
          onClick={() =>
            setParts((current) => [
              ...current,
              {
                key: Math.max(...current.map((part) => part.key)) + 1,
                title: '',
                scopeDescription: '',
                amount: '',
              },
            ])
          }
        >
          {t('requests.dialogs.split.addPart')}
        </Button>
      </div>
      {tried && incomplete && (
        <p className="tiq-field-error" role="alert">
          {t('requests.dialogs.split.incomplete')}
        </p>
      )}
    </ConfirmActionDialog>
  );
}

function DeferDialog({ request, onClose, onDone }: RequestActionDialogProps) {
  const defer = useApiMutation(requestEndpoints.deferRequest);
  const [until, setUntil] = useState('');
  const [tried, setTried] = useState(false);
  const errors = formErrors(defer.error, ['deferredUntil', 'reason']);
  const missing = until === '';
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.defer.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.defer.consequence')}
      confirmLabel={t('requests.dialogs.defer.confirm')}
      reason={{ label: t('requests.dialogs.reason'), required: true }}
      pending={defer.pending}
      error={explainError(defer.error)}
      onCancel={onClose}
      onConfirm={({ reason }) => {
        setTried(true);
        if (missing) return;
        void attempt(
          () =>
            defer.mutate({
              params: { requestId: request.id },
              body: { deferredUntil: until, reason },
            }),
          (detail) =>
            onDone(t('requests.dialogs.defer.done', { reference: request.reference }), detail),
        );
      }}
    >
      <DateInput
        label={t('requests.dialogs.defer.until')}
        required
        value={until}
        onChange={setUntil}
        error={
          errors.forField('deferredUntil') ??
          (tried && missing ? t('requests.dialogs.defer.untilRequired') : undefined)
        }
      />
    </ConfirmActionDialog>
  );
}

function RouteDialog({ request, onClose, onDone }: RequestActionDialogProps) {
  const options = useApiQuery(requestEndpoints.getRoutingOptions, {
    params: { requestId: request.id },
  });
  const route = useApiMutation(requestEndpoints.routeRequestToContract);
  const [contract, setContract] = useState('');
  const [tried, setTried] = useState(false);
  const errors = formErrors(route.error, ['contractId', 'reason']);
  const missing = contract === '';
  const list = options.data?.options ?? [];
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.route.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.route.consequence')}
      confirmLabel={t('requests.dialogs.route.confirm')}
      reason={{ label: t('requests.dialogs.reason'), required: true }}
      pending={route.pending}
      error={explainError(route.error)}
      onCancel={onClose}
      onConfirm={({ reason }) => {
        setTried(true);
        if (missing) return;
        void attempt(
          () =>
            route.mutate({
              params: { requestId: request.id },
              body: { contractId: Number(contract), reason },
            }),
          (detail) =>
            onDone(
              t('requests.dialogs.route.done', {
                reference: request.reference,
                contract: detail.routedContract?.reference ?? '',
              }),
              detail,
            ),
        );
      }}
    >
      {options.status === 'loading' && <p>{t('requests.common.loading')}</p>}
      {options.status === 'error' && (
        <Banner tone="error" title={t('requests.dialogs.route.loadFailed')} />
      )}
      {options.status === 'success' && list.length === 0 && (
        <Banner tone="info" title={t('requests.dialogs.route.none')} />
      )}
      {list.length > 0 && (
        <RadioGroup
          label={t('requests.dialogs.route.contract')}
          required
          value={contract}
          onChange={setContract}
          options={list.map((option) => ({
            value: String(option.id),
            disabled: !option.eligible,
            label: `${option.reference} ${option.title} · ${option.supplier.name}`,
            hint: [
              option.remainingCeiling === null
                ? null
                : t('requests.dialogs.route.remaining', {
                    value: formatMoney(option.remainingCeiling),
                  }),
              option.expiresOn === null
                ? null
                : t('requests.dialogs.route.expires', { date: option.expiresOn }),
              option.eligible ? t('requests.dialogs.route.eligible') : null,
              ...option.reasons,
            ]
              .filter((value): value is string => value !== null)
              .join(' · '),
          }))}
          error={
            errors.forField('contractId') ??
            (tried && missing ? t('requests.dialogs.route.contractRequired') : undefined)
          }
        />
      )}
    </ConfirmActionDialog>
  );
}

function SubmitDialog({ request, readiness = [], onClose, onDone }: RequestActionDialogProps) {
  const submit = useApiMutation(requestEndpoints.submitRequest);
  const blocking = readiness.some((item) => item.status === 'blocking');
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.submit.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.submit.consequence')}
      confirmLabel={t('requests.dialogs.submit.confirm')}
      acknowledgement={blocking ? t('requests.dialogs.submit.blockingAck') : undefined}
      pending={submit.pending}
      error={explainError(submit.error)}
      onCancel={onClose}
      onConfirm={() => {
        void attempt(
          () =>
            submit.mutate({
              params: { requestId: request.id },
              body: { expectedRevision: request.revision },
            }),
          (detail) =>
            onDone(t('requests.dialogs.submit.done', { reference: request.reference }), detail),
        );
      }}
    >
      {readiness.length > 0 && (
        <ReadinessChecklist
          label={t('requests.detail.readiness')}
          items={readiness.map((item) => ({
            id: item.id,
            label: item.label,
            detail: item.detail ?? undefined,
            status: item.status,
          }))}
        />
      )}
    </ConfirmActionDialog>
  );
}

function ReasonDialog({ kind, request, onClose, onDone }: RequestActionDialogProps) {
  const withdraw = useApiMutation(requestEndpoints.withdrawRequest);
  const rescind = useApiMutation(requestEndpoints.rescindRequest);
  const close = useApiMutation(requestEndpoints.closeRequest);
  const mutation = kind === 'withdraw' ? withdraw : kind === 'rescind' ? rescind : close;
  const key = kind === 'withdraw' ? 'withdraw' : kind === 'rescind' ? 'rescind' : 'close';
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t(`requests.dialogs.${key}.title`, { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t(`requests.dialogs.${key}.consequence`)}
      confirmLabel={t(`requests.dialogs.${key}.confirm`)}
      reason={{ label: t('requests.dialogs.reason'), required: true }}
      pending={mutation.pending}
      error={explainError(mutation.error)}
      onCancel={onClose}
      onConfirm={({ reason }) => {
        void attempt(
          () => mutation.mutate({ params: { requestId: request.id }, body: { reason } }),
          (detail) =>
            onDone(t(`requests.dialogs.${key}.done`, { reference: request.reference }), detail),
        );
      }}
    />
  );
}

function ReconsiderDialog({ request, onClose, onDone }: RequestActionDialogProps) {
  const reconsider = useApiMutation(requestEndpoints.reconsiderRequest);
  const [basis, setBasis] = useState('');
  const [tried, setTried] = useState(false);
  const errors = formErrors(reconsider.error, ['changedBasis', 'reason']);
  const missing = basis.trim() === '';
  return (
    <ConfirmActionDialog
      open
      title={t('requests.dialogs.reconsider.title', { reference: request.reference })}
      scope={scopeOf(request)}
      consequence={t('requests.dialogs.reconsider.consequence')}
      confirmLabel={t('requests.dialogs.reconsider.confirm')}
      reason={{ label: t('requests.dialogs.reason'), required: true }}
      pending={reconsider.pending}
      error={explainError(reconsider.error)}
      onCancel={onClose}
      onConfirm={({ reason }) => {
        setTried(true);
        if (missing) return;
        void attempt(
          () =>
            reconsider.mutate({
              params: { requestId: request.id },
              body: { reason, changedBasis: basis.trim() },
            }),
          (detail) =>
            onDone(t('requests.dialogs.reconsider.done', { reference: request.reference }), detail),
        );
      }}
    >
      <TextArea
        label={t('requests.dialogs.reconsider.changedBasis')}
        required
        rows={3}
        value={basis}
        onChange={setBasis}
        error={
          errors.forField('changedBasis') ??
          (tried && missing ? t('requests.dialogs.reconsider.changedBasisRequired') : undefined)
        }
      />
    </ConfirmActionDialog>
  );
}
