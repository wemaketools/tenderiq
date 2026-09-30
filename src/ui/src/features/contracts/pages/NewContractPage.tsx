/**
 * CON-02 — Prepare a contract from final-awarded lot outcomes: tender, supplier legal party and contracting legal
 * entity (BR-04), reconciling allocations per awarded lot (BR-33), value, ceiling, term and terms. A value that
 * differs from the allocated award needs an explanation and later a difference approval (AC-28).
 *
 * Saving creates a DRAFT; it is not submitted for review and nothing is approved until the review step.
 */
import { useMemo, useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { AwardSource, ContractRow, CreateContractBody } from '@contracts/contracts';
import { add, compare, isDecimal } from '@contracts/decimal';
import { valueBandOf } from '@contracts/policy';
import type { CustomFieldIssue, CustomFieldValues } from '@contracts/policy';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  Checkbox,
  DataTable,
  DateInput,
  DetailList,
  EmptyState,
  FormErrorSummary,
  MoneyInput,
  MoneyText,
  PageHeader,
  QueryView,
  Reference,
  Select,
  StatusChip,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  Button,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CustomFieldsSection } from '../../admin-policy/components/CustomFieldsSection';
import { useAssigneeOptions } from '../lib/assignees';
import { contractErrorMessage, splitCommandError } from '../lib/errors';
import { useContractCommand, useDefaultCurrency } from '../lib/hooks';
import { idOf, optionalMoney, optionalText } from '../lib/lists';
import { contractPaths } from '../lib/paths';

const FIELDS = [
  'title',
  'tenderId',
  'supplierTenantId',
  'legalEntityId',
  'allocations',
  'value',
  'ceiling',
  'termStart',
  'termEnd',
  'scope',
  'paymentTerms',
  'serviceLocations',
  'optionsSummary',
  'differenceExplanation',
  'ownerUserId',
  'contractManagerUserId',
] as const;

interface Draft {
  title: string;
  tenderId: string;
  supplierTenantId: string;
  legalEntityId: string;
  allocations: Record<number, string>;
  value: string;
  ceiling: string;
  termStart: string;
  termEnd: string;
  scope: string;
  paymentTerms: string;
  serviceLocations: string;
  optionsSummary: string;
  differenceExplanation: string;
  ownerUserId: string;
  contractManagerUserId: string;
}

const EMPTY: Draft = {
  title: '',
  tenderId: '',
  supplierTenantId: '',
  legalEntityId: '',
  allocations: {},
  value: '',
  ceiling: '',
  termStart: '',
  termEnd: '',
  scope: '',
  paymentTerms: '',
  serviceLocations: '',
  optionsSummary: '',
  differenceExplanation: '',
  ownerUserId: '',
  contractManagerUserId: '',
};

type LocalErrors = Partial<Record<(typeof FIELDS)[number], string>>;

function isPositive(amount: string): boolean {
  return isDecimal(amount) && compare(amount, '0') > 0;
}

function validate(draft: Draft, chosen: readonly AwardSource[]): LocalErrors {
  const errors: LocalErrors = {};
  if (draft.title.trim().length < 3) errors.title = t('contracts.create.errors.title');
  if (draft.tenderId === '') errors.tenderId = t('contracts.create.errors.tender');
  if (draft.supplierTenantId === '')
    errors.supplierTenantId = t('contracts.create.errors.supplier');
  if (draft.legalEntityId === '') errors.legalEntityId = t('contracts.create.errors.legalEntity');
  if (chosen.length === 0) errors.allocations = t('contracts.create.errors.allocation');
  for (const source of chosen) {
    const amount = draft.allocations[source.lotOutcomeId] ?? '';
    if (!isPositive(amount)) {
      errors.allocations = t('contracts.create.errors.allocationAmount');
    } else if (
      source.remainingValue !== null &&
      compare(amount, source.remainingValue.amount) > 0
    ) {
      errors.allocations = t('contracts.create.errors.allocationExceeds', {
        lot: source.lotNumber,
        remaining: formatMoney(source.remainingValue),
      });
    }
  }
  if (!isPositive(draft.value)) errors.value = t('contracts.create.errors.value');
  if (draft.ceiling !== '' && !isDecimal(draft.ceiling))
    errors.ceiling = t('contracts.create.errors.ceiling');
  if (draft.termStart !== '' && draft.termEnd !== '' && draft.termEnd < draft.termStart) {
    errors.termEnd = t('contracts.create.errors.termEnd');
  }
  if (draft.scope.trim() === '') errors.scope = t('contracts.create.errors.scope');
  return errors;
}

function CreatedContract({ row }: { readonly row: ContractRow }) {
  return (
    <Card title={t('contracts.create.savedTitle')}>
      <Banner tone="success" title={t('contracts.create.savedBanner')}>
        {t('contracts.create.savedDetail')}
      </Banner>
      <DetailList
        items={[
          { label: t('contracts.create.reference'), value: <Reference value={row.reference} /> },
          {
            label: t('contracts.create.status'),
            value: <StatusChip enum="contracts.status" value={row.status} />,
          },
          { label: t('contracts.create.supplier'), value: row.supplier.name },
          { label: t('contracts.create.legalEntity'), value: row.legalEntity.name },
          { label: t('contracts.create.value'), value: <MoneyText value={row.value} /> },
          {
            label: t('contracts.create.differs'),
            value: row.differsFromAward ? t('contracts.common.yes') : t('contracts.common.no'),
          },
          { label: t('contracts.create.nextStep'), value: t('contracts.create.nextStepText') },
        ]}
      />
      <div className="tiq-inline">
        <ButtonLink to={contractPaths.register} variant="primary">
          {t('contracts.create.toRegister')}
        </ButtonLink>
      </div>
    </Card>
  );
}

const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/;

export default function NewContractPage() {
  const currency = useDefaultCurrency();
  const sources = useApiQuery(contractsEndpoints.awardSources, {});
  const owners = useAssigneeOptions('owner');
  const managers = useAssigneeOptions('contract_manager');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [included, setIncluded] = useState<readonly number[]>([]);
  const [localErrors, setLocalErrors] = useState<LocalErrors>({});
  const [created, setCreated] = useState<ContractRow | null>(null);
  const [custom, setCustom] = useState<CustomFieldValues>({});
  const [customIssues, setCustomIssues] = useState<readonly CustomFieldIssue[]>([]);
  const [tried, setTried] = useState(false);
  const command = useContractCommand(contractsEndpoints.create, (row) =>
    t('contracts.create.done', { reference: row.reference }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, FIELDS);
  const dirty =
    created === null &&
    (JSON.stringify(draft) !== JSON.stringify(EMPTY) || Object.keys(custom).length > 0);
  const customContext = useMemo(
    () => ({ value_band: DECIMAL_AMOUNT.test(draft.value) ? valueBandOf(draft.value) : null }),
    [draft.value],
  );

  const outcomes = useMemo(() => sources.data?.lotOutcomes ?? [], [sources.data]);
  const tenders = useMemo(() => {
    const seen = new Map<number, AwardSource['tender']>();
    for (const outcome of outcomes) seen.set(outcome.tender.tenderId, outcome.tender);
    return [...seen.values()];
  }, [outcomes]);
  const tenderId = idOf(draft.tenderId);
  const suppliers = useMemo(() => {
    const seen = new Map<number, string>();
    for (const outcome of outcomes) {
      if (outcome.tender.tenderId === tenderId && outcome.supplier !== null) {
        seen.set(outcome.supplier.tenantId, outcome.supplier.name);
      }
    }
    return [...seen.entries()];
  }, [outcomes, tenderId]);
  const supplierId = idOf(draft.supplierTenantId);
  const lots = outcomes.filter(
    (outcome) =>
      outcome.tender.tenderId === tenderId &&
      (outcome.supplier === null || outcome.supplier.tenantId === supplierId),
  );
  const chosen = lots.filter(
    (outcome) => outcome.availableForContract && included.includes(outcome.lotOutcomeId),
  );
  const allocatedTotal = chosen.reduce((total, outcome) => {
    const amount = draft.allocations[outcome.lotOutcomeId] ?? '';
    return isDecimal(amount) ? add(total, amount) : total;
  }, '0.00');
  const differs = isDecimal(draft.value) && compare(draft.value, allocatedTotal) !== 0;

  const set = (values: Partial<Draft>): void => setDraft((current) => ({ ...current, ...values }));
  const errorFor = (field: (typeof FIELDS)[number]): string | undefined =>
    localErrors[field] ?? fieldErrors.forField(field);

  const save = async (): Promise<void> => {
    setTried(true);
    const errors = validate(draft, chosen);
    if (differs && draft.differenceExplanation.trim() === '') {
      errors.differenceExplanation = t('contracts.create.errors.explanation');
    }
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0 || tenderId === undefined || supplierId === undefined)
      return;
    // Required additional fields are checked when the draft is submitted for review; wrong values block the save.
    if (customIssues.some((issue) => issue.code !== 'CUSTOM_FIELD_REQUIRED')) return;
    const legalEntityId = idOf(draft.legalEntityId);
    if (legalEntityId === undefined) return;
    const body: CreateContractBody = {
      title: draft.title.trim(),
      tenderId,
      supplierTenantId: supplierId,
      legalEntityId,
      allocations: chosen.map((outcome) => ({
        lotOutcomeId: outcome.lotOutcomeId,
        allocatedValue: { amount: draft.allocations[outcome.lotOutcomeId] ?? '', currency },
      })),
      value: { amount: draft.value, currency },
      scope: draft.scope.trim(),
    };
    const ceiling = optionalMoney({ amount: draft.ceiling, currency });
    if (ceiling !== undefined) body.ceiling = ceiling;
    if (draft.termStart !== '') body.termStart = draft.termStart;
    if (draft.termEnd !== '') body.termEnd = draft.termEnd;
    const paymentTerms = optionalText(draft.paymentTerms);
    if (paymentTerms !== undefined) body.paymentTerms = paymentTerms;
    const serviceLocations = optionalText(draft.serviceLocations);
    if (serviceLocations !== undefined) body.serviceLocations = serviceLocations;
    const optionsSummary = optionalText(draft.optionsSummary);
    if (optionsSummary !== undefined) body.optionsSummary = optionsSummary;
    const explanation = optionalText(draft.differenceExplanation);
    if (explanation !== undefined) body.differenceExplanation = explanation;
    const ownerUserId = idOf(draft.ownerUserId);
    if (ownerUserId !== undefined) body.ownerUserId = ownerUserId;
    const managerUserId = idOf(draft.contractManagerUserId);
    if (managerUserId !== undefined) body.contractManagerUserId = managerUserId;
    if (Object.keys(custom).length > 0) body.customFields = custom;
    const result = await command.run({ body });
    if (result !== null) setCreated(result);
  };

  const lotColumns: DataTableColumn<AwardSource>[] = [
    {
      id: 'include',
      header: t('contracts.create.col.include'),
      cell: (row) => (
        <Checkbox
          label={t('contracts.create.includeLot', { lot: row.lotNumber })}
          checked={included.includes(row.lotOutcomeId)}
          disabled={!row.availableForContract}
          onChange={(checked) =>
            setIncluded((current) =>
              checked
                ? [...current, row.lotOutcomeId]
                : current.filter((id) => id !== row.lotOutcomeId),
            )
          }
        />
      ),
    },
    {
      id: 'lot',
      header: t('contracts.create.col.lot'),
      cell: (row) => (
        <>
          <span>{t('contracts.create.lotTitle', { lot: row.lotNumber, title: row.lotTitle })}</span>
          <span className="tiq-cell-sub">
            {row.outcome === null || row.status === null
              ? t('contracts.create.noOutcome')
              : `${tEnum('lot_outcomes.outcome', row.outcome)} · ${tEnum('lot_outcomes.status', row.status)}`}
            {row.unavailableReason !== null ? ` · ${row.unavailableReason}` : ''}
          </span>
          {row.conditions !== null && <span className="tiq-cell-sub">{row.conditions}</span>}
        </>
      ),
    },
    {
      id: 'awarded',
      header: t('contracts.create.col.awarded'),
      numeric: true,
      cell: (row) => <MoneyText value={row.awardedValue} />,
    },
    {
      id: 'elsewhere',
      header: t('contracts.create.col.elsewhere'),
      numeric: true,
      cell: (row) => (
        <>
          <MoneyText value={row.allocatedValue} />
          {row.contracts.map((item) => (
            <span key={item.contractId} className="tiq-cell-sub">
              {item.reference}: {formatMoney(item.allocatedValue)}
            </span>
          ))}
        </>
      ),
    },
    {
      id: 'remaining',
      header: t('contracts.create.col.remaining'),
      numeric: true,
      cell: (row) => <MoneyText value={row.remainingValue} />,
    },
    {
      id: 'allocation',
      header: t('contracts.create.col.allocation'),
      cell: (row) =>
        row.availableForContract && included.includes(row.lotOutcomeId) ? (
          <MoneyInput
            label={t('contracts.create.allocationFor', { lot: row.lotNumber })}
            value={{ amount: draft.allocations[row.lotOutcomeId] ?? '', currency }}
            currencies={[currency]}
            onChange={(value) =>
              set({ allocations: { ...draft.allocations, [row.lotOutcomeId]: value.amount } })
            }
          />
        ) : (
          <span className="tiq-text-muted">{t('contracts.create.notIncluded')}</span>
        ),
    },
  ];

  if (created !== null) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('contracts.create.title')}
          back={{ to: contractPaths.register, label: t('contracts.workspace.back') }}
        />
        <CreatedContract row={created} />
      </div>
    );
  }

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={t('contracts.create.title')}
        subtitle={t('contracts.create.intro')}
        back={{ to: contractPaths.register, label: t('contracts.workspace.back') }}
        primaryAction={
          <Button
            variant="primary"
            icon="check"
            loading={command.pending}
            onClick={() => void save()}
          >
            {t('contracts.create.save')}
          </Button>
        }
      />
      <QueryView
        query={sources}
        isEmpty={(data) => data.lotOutcomes.length === 0}
        empty={
          <EmptyState
            title={t('contracts.create.noAwards')}
            description={t('contracts.create.noAwardsHint')}
          />
        }
      >
        {(data) => (
          <div className="tiq-stack">
            <Card title={t('contracts.create.sectionAward')}>
              <div className="tiq-form-grid">
                <Select
                  label={t('contracts.create.tender')}
                  required
                  placeholder={t('contracts.common.select')}
                  value={draft.tenderId}
                  options={tenders.map((tender) => ({
                    value: String(tender.tenderId),
                    label: `${tender.reference} ${tender.title}`,
                  }))}
                  onChange={(value) => {
                    set({ tenderId: value, supplierTenantId: '', allocations: {} });
                    setIncluded([]);
                  }}
                  error={errorFor('tenderId')}
                />
                <Select
                  label={t('contracts.create.supplier')}
                  hint={t('contracts.create.supplierHint')}
                  required
                  placeholder={t('contracts.common.select')}
                  value={draft.supplierTenantId}
                  options={suppliers.map(([id, name]) => ({ value: String(id), label: name }))}
                  onChange={(value) => {
                    set({ supplierTenantId: value, allocations: {} });
                    setIncluded([]);
                  }}
                  error={errorFor('supplierTenantId')}
                />
                <Select
                  label={t('contracts.create.legalEntity')}
                  hint={t('contracts.create.legalEntityHint')}
                  required
                  placeholder={t('contracts.common.select')}
                  value={draft.legalEntityId}
                  options={data.legalEntities.map((entity) => ({
                    value: String(entity.legalEntityId),
                    label:
                      entity.registrationNumber === null
                        ? entity.name
                        : `${entity.name} (${entity.registrationNumber})`,
                  }))}
                  onChange={(legalEntityId) => set({ legalEntityId })}
                  error={errorFor('legalEntityId')}
                />
              </div>
            </Card>
            <Card
              flush
              title={t('contracts.create.sectionAllocations')}
              subtitle={t('contracts.create.allocationsHint')}
            >
              <DataTable
                caption={t('contracts.create.sectionAllocations')}
                columns={lotColumns}
                rows={lots}
                rowKey={(row) => String(row.lotOutcomeId)}
                empty={
                  <EmptyState
                    compact
                    title={
                      tenderId === undefined || supplierId === undefined
                        ? t('contracts.create.chooseFirst')
                        : t('contracts.create.noLots')
                    }
                  />
                }
              />
              {errorFor('allocations') !== undefined && (
                <Banner tone="error" title={t('contracts.create.allocationProblem')}>
                  {errorFor('allocations')}
                </Banner>
              )}
            </Card>
            <Card title={t('contracts.create.sectionTerms')}>
              <div className="tiq-form-grid">
                <TextField
                  label={t('contracts.create.titleField')}
                  required
                  value={draft.title}
                  onChange={(title) => set({ title })}
                  error={errorFor('title')}
                  fieldClassName="tiq-form-full"
                />
                <MoneyInput
                  label={t('contracts.create.value')}
                  hint={t('contracts.create.valueHint', {
                    total: formatMoney({ amount: allocatedTotal, currency }),
                  })}
                  required
                  value={{ amount: draft.value, currency }}
                  currencies={[currency]}
                  onChange={(value) => set({ value: value.amount })}
                  error={errorFor('value')}
                />
                <MoneyInput
                  label={t('contracts.create.ceiling')}
                  hint={t('contracts.create.ceilingHint')}
                  value={{ amount: draft.ceiling, currency }}
                  currencies={[currency]}
                  onChange={(value) => set({ ceiling: value.amount })}
                  error={errorFor('ceiling')}
                />
                <DateInput
                  label={t('contracts.create.termStart')}
                  value={draft.termStart}
                  onChange={(termStart) => set({ termStart })}
                  error={errorFor('termStart')}
                />
                <DateInput
                  label={t('contracts.create.termEnd')}
                  value={draft.termEnd}
                  onChange={(termEnd) => set({ termEnd })}
                  error={errorFor('termEnd')}
                />
                <TextArea
                  label={t('contracts.create.scope')}
                  required
                  value={draft.scope}
                  onChange={(scope) => set({ scope })}
                  error={errorFor('scope')}
                  fieldClassName="tiq-form-full"
                />
                <TextArea
                  label={t('contracts.create.paymentTerms')}
                  value={draft.paymentTerms}
                  onChange={(paymentTerms) => set({ paymentTerms })}
                  error={errorFor('paymentTerms')}
                />
                <TextArea
                  label={t('contracts.create.serviceLocations')}
                  value={draft.serviceLocations}
                  onChange={(serviceLocations) => set({ serviceLocations })}
                  error={errorFor('serviceLocations')}
                />
                <TextArea
                  label={t('contracts.create.options')}
                  hint={t('contracts.create.optionsHint')}
                  value={draft.optionsSummary}
                  onChange={(optionsSummary) => set({ optionsSummary })}
                  error={errorFor('optionsSummary')}
                  fieldClassName="tiq-form-full"
                />
                <Select
                  label={t('contracts.assign.owner')}
                  placeholder={t('contracts.common.select')}
                  value={draft.ownerUserId}
                  options={owners.options}
                  onChange={(ownerUserId) => set({ ownerUserId })}
                  error={errorFor('ownerUserId')}
                />
                <Select
                  label={t('contracts.assign.manager')}
                  hint={t('contracts.assign.managerHint')}
                  placeholder={t('contracts.common.select')}
                  value={draft.contractManagerUserId}
                  options={managers.options}
                  onChange={(contractManagerUserId) => set({ contractManagerUserId })}
                  error={errorFor('contractManagerUserId')}
                />
              </div>
            </Card>
            <Card title={t('contracts.create.sectionCustomFields')}>
              <CustomFieldsSection
                entityType="contract"
                values={custom}
                onChange={setCustom}
                context={customContext}
                showErrors={tried}
                serverErrors={command.error?.fieldErrors}
                onValidationChange={setCustomIssues}
              />
            </Card>
            <Card title={t('contracts.create.sectionDifference')}>
              {differs ? (
                <Banner tone="warning" title={t('contracts.create.differsTitle')}>
                  {t('contracts.create.differsDetail', {
                    value: formatMoney({ amount: draft.value, currency }),
                    total: formatMoney({ amount: allocatedTotal, currency }),
                  })}
                </Banner>
              ) : (
                <p className="tiq-text-muted">{t('contracts.create.matchesAward')}</p>
              )}
              <TextArea
                label={t('contracts.create.explanation')}
                hint={t('contracts.create.explanationHint')}
                required={differs}
                value={draft.differenceExplanation}
                onChange={(differenceExplanation) => set({ differenceExplanation })}
                error={errorFor('differenceExplanation')}
              />
            </Card>
            {fieldErrors.other.length > 0 && <FormErrorSummary errors={fieldErrors.other} />}
            {dialogError !== null && (
              <Banner tone="error" title={dialogError.title}>
                {contractErrorMessage(dialogError)}
              </Banner>
            )}
            <p className="tiq-text-muted">{t('contracts.create.draftNote')}</p>
          </div>
        )}
      </QueryView>
    </div>
  );
}
