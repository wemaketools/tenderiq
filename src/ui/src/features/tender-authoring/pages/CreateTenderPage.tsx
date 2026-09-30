/**
 * BUY-07 — Establish a tender: from an approved template, a prior event (its structure only), a blank form, or an
 * approved request or strategy (FR-07). Reuse copies structure and NEVER bids, deliberations, evaluation scores,
 * approvals, supplier outcomes, participants or clarifications; the page says so before and after creation.
 *
 * Creating is consequential, so it goes through ConfirmActionDialog (COM-02). The result is a DRAFT tender that is
 * neither submitted nor approved; the copied sections the owner must review are listed.
 */
import { useState } from 'react';

import { TENDERS_EVENT_TYPE, TENDERS_PARTICIPATION } from '@contracts/enums';
import type {
  TendersEventType,
  TendersParticipation,
  TendersProcedureWrite,
} from '@contracts/enums';
import { TENDER_CREATION_SOURCES, createTender, getCreationSources } from '@contracts/tenders';
import type {
  CreateTenderBody,
  CreatedTender,
  TenderCopySection,
  TenderCreationSource,
} from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useIsPrototype } from '../../../app/hooks';
import {
  Banner,
  ButtonLink,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  ErrorState,
  MoneyInput,
  MultiSelect,
  PageHeader,
  RadioGroup,
  Reference,
  RestrictedState,
  SearchField,
  Select,
  SkeletonBlock,
  StatusChip,
  TextField,
  UnsavedChangesGuard,
  formErrors,
} from '../../../components/ui';
import type { RadioOption } from '../../../components/ui';
import { formatCalendarDate, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { withTenderMessage } from '../lib/errors';
import { sectionLabel } from '../lib/labels';
import { tenderPaths } from '../lib/paths';

const FIELDS = [
  'source',
  'title',
  'templateId',
  'priorTenderId',
  'sections',
  'requestId',
  'strategyId',
  'eventType',
  'procedure',
  'participation',
  'estimatedValue',
  'estimatedValue.currency',
];

interface Draft {
  readonly source: TenderCreationSource | '';
  readonly title: string;
  readonly choice: string;
  readonly sections: string[];
  readonly eventType: string;
  readonly procedure: string;
  readonly participation: string;
  readonly amount: string;
  /** Chosen currency of the estimate; empty until chosen when the organization has no default. */
  readonly currency: string;
}

const EMPTY: Draft = {
  source: '',
  title: '',
  choice: '',
  sections: [],
  eventType: '',
  procedure: '',
  participation: '',
  amount: '',
  currency: '',
};

export default function CreateTenderPage() {
  const tenant = useActiveTenant();
  const prototype = useIsPrototype();
  const [search, setSearch] = useState('');
  const sources = useApiQuery(getCreationSources, {
    query: search.trim() === '' ? {} : { q: search.trim() },
  });
  const mutation = useApiMutation(createTender);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [created, setCreated] = useState<CreatedTender | null>(null);

  const update = (patch: Partial<Draft>): void => setDraft((current) => ({ ...current, ...patch }));
  const errors = formErrors(mutation.error, FIELDS);
  const dirty = created === null && JSON.stringify(draft) !== JSON.stringify(EMPTY);
  const data = sources.data;
  const currencies = data?.currencies ?? [];
  const currency =
    draft.currency !== ''
      ? draft.currency
      : (tenant?.defaultCurrency ?? data?.defaultCurrency ?? '');

  const titleRequired =
    draft.source === 'blank' || draft.source === 'template' || draft.source === 'prior_event';
  const titleError = (() => {
    const trimmed = draft.title.trim();
    if (titleRequired && trimmed === '') return t('tender-authoring.create.titleRequired');
    if (trimmed !== '' && trimmed.length < 3) return t('tender-authoring.create.titleShort');
    return undefined;
  })();
  const localErrors = {
    source: draft.source === '' ? t('tender-authoring.create.sourceRequired') : undefined,
    title: titleError,
    choice:
      draft.source !== '' && draft.source !== 'blank' && draft.choice === ''
        ? t('tender-authoring.create.choiceRequired')
        : undefined,
    sections:
      draft.source === 'prior_event' && draft.sections.length === 0
        ? t('tender-authoring.create.sectionsRequired')
        : undefined,
    eventType:
      draft.source === 'blank' && draft.eventType === ''
        ? t('tender-authoring.create.required')
        : undefined,
    procedure:
      draft.source === 'blank' && draft.procedure === ''
        ? t('tender-authoring.create.required')
        : undefined,
    participation:
      draft.source === 'blank' && draft.participation === ''
        ? t('tender-authoring.create.required')
        : undefined,
  };
  const valid = Object.values(localErrors).every((value) => value === undefined);
  const show = (key: keyof typeof localErrors, field: string): string | undefined =>
    errors.forField(field) ?? (touched ? localErrors[key] : undefined);

  const body = (): CreateTenderBody | null => {
    const title = draft.title.trim();
    const optionalTitle = title === '' ? {} : { title };
    switch (draft.source) {
      case 'blank':
        return {
          source: 'blank',
          title,
          eventType: draft.eventType as TendersEventType,
          procedure: draft.procedure as TendersProcedureWrite,
          participation: draft.participation as TendersParticipation,
          ...(draft.amount === '' ? {} : { estimatedValue: { amount: draft.amount, currency } }),
        };
      case 'template':
        return { source: 'template', templateId: Number(draft.choice), title };
      case 'prior_event':
        return {
          source: 'prior_event',
          priorTenderId: Number(draft.choice),
          title,
          sections: draft.sections as TenderCopySection[],
        };
      case 'request':
        return { source: 'request', requestId: Number(draft.choice), ...optionalTitle };
      case 'strategy':
        return { source: 'strategy', strategyId: Number(draft.choice), ...optionalTitle };
      default:
        return null;
    }
  };

  const review = (): void => {
    setTouched(true);
    if (valid) setConfirming(true);
  };

  const confirm = async (): Promise<void> => {
    const request = body();
    if (request === null) return;
    try {
      const result = await mutation.mutate({ body: request });
      setCreated(result);
      setConfirming(false);
    } catch (caught) {
      const failed = caught as { fieldErrors?: readonly unknown[] };
      if ((failed.fieldErrors ?? []).length > 0) setConfirming(false);
    }
  };

  const choiceOptions = (): RadioOption[] => {
    if (data === undefined) return [];
    switch (draft.source) {
      case 'template':
        return data.templates.map((row) => ({
          value: String(row.templateId),
          label: t('tender-authoring.create.templateOption', {
            name: row.name,
            version: row.versionNo,
          }),
          disabled: !row.usable,
          hint: row.usable
            ? [
                row.procedure === null ? null : tEnum('tenders.procedure', row.procedure),
                row.category?.name ?? null,
                row.reviewDate === null
                  ? null
                  : t('tender-authoring.create.reviewDate', {
                      date: formatCalendarDate(row.reviewDate),
                    }),
                t('tender-authoring.create.sectionsList', {
                  sections: row.sections.map(sectionLabel).join(', '),
                }),
              ]
                .filter((value) => value !== null)
                .join(' · ')
            : (row.unusableReason ?? t('tender-authoring.create.notUsable')),
        }));
      case 'prior_event':
        return data.priorEvents.map((row) => ({
          value: String(row.tenderId),
          label: `${row.reference} ${row.title}`,
          hint: `${tEnum('tenders.status', row.status)} · ${tEnum('tenders.event_type', row.eventType)} · ${tEnum('tenders.procedure', row.procedure)}`,
        }));
      case 'request':
        return data.requests.map((row) => ({
          value: String(row.requestId),
          label: `${row.reference} ${row.title}`,
          disabled: !row.usable,
          hint: row.usable
            ? [
                row.status,
                row.category?.name ?? null,
                row.estimatedValue === null ? null : formatMoney(row.estimatedValue),
              ]
                .filter((value) => value !== null)
                .join(' · ')
            : (row.unusableReason ?? t('tender-authoring.create.notUsable')),
        }));
      case 'strategy':
        return data.strategies.map((row) => ({
          value: String(row.strategyId),
          label: row.title,
          disabled: !row.usable,
          hint: row.usable
            ? [
                row.request?.reference ?? null,
                tEnum('tenders.event_type', row.eventType),
                tEnum('tenders.procedure', row.procedure),
                tEnum('procurement_strategies.status', row.status),
              ]
                .filter((value) => value !== null)
                .join(' · ')
            : (row.unusableReason ?? t('tender-authoring.create.notUsable')),
        }));
      default:
        return [];
    }
  };

  const priorEvent =
    draft.source === 'prior_event'
      ? data?.priorEvents.find((row) => String(row.tenderId) === draft.choice)
      : undefined;

  if (created !== null) {
    const row = created.tender;
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('tender-authoring.create.createdTitle')}
          back={{ to: tenderPaths.register, label: t('tender-authoring.workspace.backToRegister') }}
        />
        <Banner
          tone="success"
          title={t('tender-authoring.create.createdBanner', { reference: row.reference })}
        >
          <p>{t('tender-authoring.create.createdDraft')}</p>
        </Banner>
        <Card title={row.title} subtitle={created.provenance.label}>
          <DetailList
            items={[
              {
                key: 'ref',
                label: t('tender-authoring.fields.reference'),
                value: <Reference value={row.reference} />,
              },
              {
                key: 'status',
                label: t('tender-authoring.fields.status'),
                value: <StatusChip enum="tenders.status" value={row.status} />,
              },
              {
                key: 'method',
                label: t('tender-authoring.fields.method'),
                value: `${tEnum('tenders.event_type', row.eventType)} · ${tEnum('tenders.procedure', row.procedure)}`,
              },
              {
                key: 'owner',
                label: t('tender-authoring.fields.owner'),
                value: row.owner.fullName,
              },
              {
                key: 'source',
                label: t('tender-authoring.fields.source'),
                value: t(`tender-authoring.create.source.${created.provenance.source}`),
              },
              {
                key: 'copied',
                label: t('tender-authoring.create.copied'),
                value:
                  created.copiedSections.length === 0
                    ? t('tender-authoring.create.nothingCopied')
                    : created.copiedSections.map(sectionLabel).join(', '),
              },
              {
                key: 'review',
                label: t('tender-authoring.create.reviewRequired'),
                value:
                  created.reviewRequired.length === 0
                    ? t('tender-authoring.common.none')
                    : created.reviewRequired.map(sectionLabel).join(', '),
              },
            ]}
          />
          <NeverCopied items={created.notCopied} />
          <div className="tiq-inline">
            {!prototype && (
              <ButtonLink to={created.link} variant="primary">
                {t('tender-authoring.create.open')}
              </ButtonLink>
            )}
            <ButtonLink to={tenderPaths.register}>
              {t('tender-authoring.workspace.backToRegister')}
            </ButtonLink>
            <Button
              onClick={() => {
                setCreated(null);
                setDraft(EMPTY);
                setTouched(false);
                mutation.reset();
              }}
            >
              {t('tender-authoring.create.another')}
            </Button>
          </div>
          {prototype && (
            <p className="tiq-text-muted">{t('tender-authoring.create.prototypeNote')}</p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={t('tender-authoring.create.title')}
        subtitle={t('tender-authoring.create.intro')}
        back={{ to: tenderPaths.register, label: t('tender-authoring.workspace.backToRegister') }}
        primaryAction={
          <Button
            variant="primary"
            icon="plus"
            onClick={review}
            disabled={sources.data === undefined}
          >
            {t('tender-authoring.create.submit')}
          </Button>
        }
      />
      {sources.error !== null ? (
        sources.error.kind === 'forbidden' ? (
          <RestrictedState description={t('tender-authoring.create.restricted')} />
        ) : (
          <ErrorState error={sources.error} onRetry={sources.reload} />
        )
      ) : data === undefined ? (
        <SkeletonBlock lines={6} />
      ) : (
        <div className="tiq-grid tiq-grid--sidebar">
          <Card title={t('tender-authoring.create.howTitle')}>
            <div className="tiq-form-stack">
              <RadioGroup
                label={t('tender-authoring.create.source.label')}
                required
                value={draft.source}
                onChange={(source) =>
                  update({ source: source as TenderCreationSource, choice: '', sections: [] })
                }
                options={TENDER_CREATION_SOURCES.map((value) => ({
                  value,
                  label: t(`tender-authoring.create.source.${value}`),
                  hint: t(`tender-authoring.create.sourceHint.${value}`),
                }))}
                error={show('source', 'source')}
              />
              {draft.source !== '' && draft.source !== 'blank' && (
                <>
                  <SearchField
                    label={t('tender-authoring.create.search')}
                    placeholder={t('tender-authoring.create.searchPlaceholder')}
                    value={search}
                    onChange={setSearch}
                  />
                  {choiceOptions().length === 0 ? (
                    <EmptyState
                      compact
                      icon="search"
                      title={t(`tender-authoring.create.none.${draft.source}`)}
                    />
                  ) : (
                    <RadioGroup
                      label={t(`tender-authoring.create.choice.${draft.source}`)}
                      required
                      value={draft.choice}
                      onChange={(choice) => {
                        const prior = data.priorEvents.find(
                          (row) => String(row.tenderId) === choice,
                        );
                        update({
                          choice,
                          sections:
                            draft.source === 'prior_event' && prior !== undefined
                              ? [...prior.copyableSections]
                              : draft.sections,
                        });
                      }}
                      options={choiceOptions()}
                      error={
                        errors.forField('templateId') ??
                        errors.forField('priorTenderId') ??
                        errors.forField('requestId') ??
                        errors.forField('strategyId') ??
                        (touched ? localErrors.choice : undefined)
                      }
                    />
                  )}
                </>
              )}
              {priorEvent !== undefined && (
                <MultiSelect
                  label={t('tender-authoring.create.sections')}
                  required
                  hint={t('tender-authoring.create.sectionsHint')}
                  value={draft.sections}
                  onChange={(sections) => update({ sections })}
                  options={priorEvent.copyableSections.map((value) => ({
                    value,
                    label: sectionLabel(value),
                  }))}
                  error={show('sections', 'sections')}
                />
              )}
              {draft.source !== '' && (
                <TextField
                  label={t('tender-authoring.fields.title')}
                  required={titleRequired}
                  hint={titleRequired ? undefined : t('tender-authoring.create.titleOptional')}
                  value={draft.title}
                  onChange={(title) => update({ title })}
                  error={show('title', 'title')}
                  maxLength={300}
                />
              )}
              {draft.source === 'blank' && (
                <div className="tiq-form-grid">
                  <Select
                    label={t('tender-authoring.fields.eventType')}
                    required
                    placeholder={t('tender-authoring.common.select')}
                    value={draft.eventType}
                    options={TENDERS_EVENT_TYPE.map((value) => ({
                      value,
                      label: tEnum('tenders.event_type', value),
                    }))}
                    onChange={(eventType) => update({ eventType })}
                    error={show('eventType', 'eventType')}
                  />
                  <Select
                    label={t('tender-authoring.fields.procedure')}
                    required
                    placeholder={t('tender-authoring.common.select')}
                    value={draft.procedure}
                    options={data.permittedProcedures.map((value) => ({
                      value,
                      label: tEnum('tenders.procedure', value),
                    }))}
                    onChange={(procedure) => update({ procedure })}
                    hint={t('tender-authoring.create.procedureHint')}
                    error={show('procedure', 'procedure')}
                  />
                  <Select
                    label={t('tender-authoring.fields.participation')}
                    required
                    placeholder={t('tender-authoring.common.select')}
                    value={draft.participation}
                    options={TENDERS_PARTICIPATION.map((value) => ({
                      value,
                      label: tEnum('tenders.participation', value),
                    }))}
                    onChange={(participation) => update({ participation })}
                    error={show('participation', 'participation')}
                  />
                  {currency === '' ? (
                    <>
                      <Select
                        label={t('tender-authoring.create.currency')}
                        hint={t('tender-authoring.create.currencyHint')}
                        placeholder={t('tender-authoring.common.select')}
                        value={draft.currency}
                        options={currencies.map((code) => ({ value: code, label: code }))}
                        onChange={(value) => update({ currency: value })}
                        error={errors.forField('estimatedValue.currency')}
                      />
                      <TextField
                        label={t('tender-authoring.fields.estimatedValue')}
                        value={draft.amount}
                        onChange={(amount) => update({ amount })}
                        error={errors.forField('estimatedValue')}
                        disabled
                        hint={t('tender-authoring.create.currencyFirst')}
                      />
                    </>
                  ) : (
                    <MoneyInput
                      label={t('tender-authoring.fields.estimatedValue')}
                      value={{ amount: draft.amount, currency }}
                      currencies={
                        currencies.includes(currency) ? currencies : [currency, ...currencies]
                      }
                      onChange={(value) =>
                        update({
                          amount: value.amount,
                          ...(value.currency === currency ? {} : { currency: value.currency }),
                        })
                      }
                      error={errors.forField('estimatedValue')}
                    />
                  )}
                </div>
              )}
            </div>
          </Card>
          <Card title={t('tender-authoring.create.reuseTitle')}>
            <p>{t('tender-authoring.create.reuseIntro')}</p>
            <NeverCopied items={data.neverCopied} />
            <p className="tiq-text-muted">{t('tender-authoring.create.reuseAfter')}</p>
          </Card>
        </div>
      )}
      <ConfirmActionDialog
        open={confirming}
        title={t('tender-authoring.create.confirmTitle')}
        scope={
          draft.title.trim() === ''
            ? t(`tender-authoring.create.source.${draft.source === '' ? 'blank' : draft.source}`)
            : draft.title.trim()
        }
        consequence={t('tender-authoring.create.confirmResult')}
        confirmLabel={t('tender-authoring.create.submit')}
        onConfirm={() => confirm()}
        onCancel={() => {
          setConfirming(false);
          mutation.reset();
        }}
        pending={mutation.pending}
        error={withTenderMessage(mutation.error)}
      />
    </div>
  );
}

function NeverCopied({ items }: { readonly items: readonly string[] }) {
  return (
    <div className="tiq-stack">
      <span className="tiq-text-muted">{t('tender-authoring.create.neverCopied')}</span>
      <span className="tiq-inline" data-testid="never-copied">
        {items.map((item) => (
          <Chip key={item} tone="neutral" size="sm" icon="ban">
            {t(`tender-authoring.neverCopied.${item}`)}
          </Chip>
        ))}
      </span>
    </div>
  );
}
