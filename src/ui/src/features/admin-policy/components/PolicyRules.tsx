/**
 * The rules of a policy profile version (ADM-06, PRD §13.2 "Procedures, thresholds, gates, exceptions,
 * publication, opening, waiting periods, and complaint rules"): a read-only view and the draft editor.
 *
 * The editor keeps numbers as strings while typing and converts to the contract's `PolicyRulesInput` on save; the
 * contract's cross-field rules (quorum, standstill, BAFO, threshold overlap…) are checked before sending.
 */
import {
  POLICY_PROFILE_VERSIONS_LATE_SUBMISSION_POLICY,
  POLICY_PROFILE_VERSIONS_STANDSTILL_DAY_TYPE,
  TENDERS_PROCEDURE_WRITE,
} from '@contracts/enums';
import type { PolicyThreshold, PolicyVersionDetail } from '@contracts/policy';

import {
  Button,
  Card,
  Checkbox,
  DataTable,
  DetailList,
  EmptyState,
  IconButton,
  MoneyText,
  MultiSelect,
  NumberInput,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import type { RulesDraft, ThresholdDraft } from '../lib/rulesDraft';
import type { ErrorLookup } from '../lib/validation';

type Rules = PolicyVersionDetail['rules'];

function yesNo(value: boolean): string {
  return value ? t('admin-policy.common.yes') : t('admin-policy.common.no');
}

function days(value: number): string {
  return t('admin-policy.common.days', { count: value });
}

// ---------------------------------------------------------------------------------------------------------
// Read-only view
// ---------------------------------------------------------------------------------------------------------

export function PolicyRulesView({ rules }: { readonly rules: Rules }) {
  const thresholdColumns: DataTableColumn<PolicyThreshold>[] = [
    {
      id: 'procedure',
      header: t('admin-policy.rules.threshold.procedure'),
      cell: (row) => tEnum('tenders.procedure', row.procedure),
    },
    {
      id: 'min',
      header: t('admin-policy.rules.threshold.min'),
      numeric: true,
      cell: (row) => <MoneyText value={{ amount: row.minValue, currency: row.currency }} />,
    },
    {
      id: 'max',
      header: t('admin-policy.rules.threshold.max'),
      numeric: true,
      cell: (row) =>
        row.maxValue === null ? (
          t('admin-policy.rules.threshold.noUpper')
        ) : (
          <MoneyText value={{ amount: row.maxValue, currency: row.currency }} />
        ),
    },
    {
      id: 'approval',
      header: t('admin-policy.rules.threshold.approval'),
      cell: (row) => row.requiredApprovalLevel,
    },
    {
      id: 'notice',
      header: t('admin-policy.rules.threshold.notice'),
      cell: (row) => yesNo(row.requiresPublicNotice),
    },
  ];

  return (
    <div className="tiq-stack">
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-policy.rules.section.procedures')} headingLevel={3}>
          <DetailList
            items={[
              {
                key: 'procedures',
                label: t('admin-policy.rules.permittedProcedures'),
                value: rules.permittedProcedures
                  .map((procedure) => tEnum('tenders.procedure', procedure))
                  .join(', '),
              },
              {
                key: 'negotiation',
                label: t('admin-policy.rules.negotiationPermitted'),
                value: yesNo(rules.negotiationPermitted),
              },
              {
                key: 'bafo',
                label: t('admin-policy.rules.bafoPermitted'),
                value: yesNo(rules.bafoPermitted),
              },
            ]}
          />
        </Card>
        <Card title={t('admin-policy.rules.section.gates')} headingLevel={3}>
          <DetailList
            items={[
              {
                key: 'release',
                label: t('admin-policy.rules.requiresReleaseApproval'),
                value: yesNo(rules.requiresReleaseApproval),
              },
              {
                key: 'independent',
                label: t('admin-policy.rules.independentEvaluation'),
                value: yesNo(rules.independentEvaluation),
              },
              {
                key: 'route',
                label: t('admin-policy.rules.approvalRouteNote'),
                value: rules.approvalRouteNote,
              },
            ]}
          />
        </Card>
        <Card title={t('admin-policy.rules.section.exceptions')} headingLevel={3}>
          <DetailList
            items={[
              {
                key: 'late',
                label: t('admin-policy.rules.lateSubmissionPolicy'),
                value: tEnum(
                  'policy_profile_versions.late_submission_policy',
                  rules.lateSubmissionPolicy,
                ),
              },
            ]}
          />
        </Card>
        <Card title={t('admin-policy.rules.section.publication')} headingLevel={3}>
          <DetailList
            items={[
              {
                key: 'award',
                label: t('admin-policy.rules.publicAwardNoticeRequired'),
                value: yesNo(rules.publicAwardNoticeRequired),
              },
              {
                key: 'noticeBands',
                label: t('admin-policy.rules.publicNoticeBands'),
                value: t('admin-policy.rules.publicNoticeBandsValue', {
                  count: rules.thresholds.filter((band) => band.requiresPublicNotice).length,
                }),
              },
            ]}
          />
        </Card>
        <Card title={t('admin-policy.rules.section.opening')} headingLevel={3}>
          <DetailList
            items={[
              {
                key: 'staged',
                label: t('admin-policy.rules.stagedOpeningDefault'),
                value: yesNo(rules.stagedOpeningDefault),
              },
              {
                key: 'quorum',
                label: t('admin-policy.rules.openingQuorum'),
                value: String(rules.openingQuorum),
              },
              {
                key: 'second',
                label: t('admin-policy.rules.openingRequiresSecondPerson'),
                value: yesNo(rules.openingRequiresSecondPerson),
              },
            ]}
          />
        </Card>
        <Card title={t('admin-policy.rules.section.waiting')} headingLevel={3}>
          <DetailList
            items={[
              {
                key: 'response',
                label: t('admin-policy.rules.minResponseDays'),
                value: days(rules.minResponseDays),
              },
              {
                key: 'questions',
                label: t('admin-policy.rules.questionDeadlineDaysBeforeClose'),
                value: days(rules.questionDeadlineDaysBeforeClose),
              },
              {
                key: 'standstill',
                label: t('admin-policy.rules.standstill'),
                value:
                  rules.standstillRequired &&
                  rules.standstillLength !== null &&
                  rules.standstillDayType !== null
                    ? t('admin-policy.rules.standstillValue', {
                        count: rules.standstillLength,
                        type: tEnum(
                          'policy_profile_versions.standstill_day_type',
                          rules.standstillDayType,
                        ),
                      })
                    : t('admin-policy.rules.standstillNone'),
              },
            ]}
          />
        </Card>
        <Card title={t('admin-policy.rules.section.complaints')} headingLevel={3}>
          <DetailList
            items={[
              {
                key: 'window',
                label: t('admin-policy.rules.complaintWindowDays'),
                value: days(rules.complaintWindowDays),
              },
              {
                key: 'review',
                label: t('admin-policy.rules.complaintRequiresIndependentReview'),
                value: yesNo(rules.complaintRequiresIndependentReview),
              },
            ]}
          />
        </Card>
      </div>
      <Card title={t('admin-policy.rules.section.thresholds')} headingLevel={3} flush>
        <DataTable
          caption={t('admin-policy.rules.section.thresholds')}
          columns={thresholdColumns}
          rows={rules.thresholds}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('admin-policy.rules.threshold.empty')} />}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Draft editor
// ---------------------------------------------------------------------------------------------------------

export interface PolicyRulesFormProps {
  readonly value: RulesDraft;
  readonly onChange: (value: RulesDraft) => void;
  readonly errors: ErrorLookup;
  /** The field path prefix of the rules in the request body (`rules.`). */
  readonly prefix?: string;
  readonly defaultCurrency: string;
}

export function PolicyRulesForm({
  value,
  onChange,
  errors,
  prefix = 'rules.',
  defaultCurrency,
}: PolicyRulesFormProps) {
  const set = (patch: Partial<RulesDraft>): void => onChange({ ...value, ...patch });
  const err = (name: string): string | undefined => errors.forField(`${prefix}${name}`);
  const setBand = (index: number, patch: Partial<ThresholdDraft>): void =>
    set({
      thresholds: value.thresholds.map((band, position) =>
        position === index ? { ...band, ...patch } : band,
      ),
    });
  const procedureOptions = TENDERS_PROCEDURE_WRITE.map((procedure) => ({
    value: procedure,
    label: tEnum('tenders.procedure', procedure),
  }));

  return (
    <div className="tiq-form-stack">
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.procedures')}</legend>
        <div className="tiq-form-grid">
          <MultiSelect
            label={t('admin-policy.rules.permittedProcedures')}
            required
            value={value.permittedProcedures}
            options={procedureOptions}
            onChange={(permittedProcedures) => set({ permittedProcedures })}
            error={err('permittedProcedures')}
            fieldClassName="tiq-form-full"
          />
          <Checkbox
            label={t('admin-policy.rules.negotiationPermitted')}
            checked={value.negotiationPermitted}
            onChange={(negotiationPermitted) => set({ negotiationPermitted })}
          />
          <Checkbox
            label={t('admin-policy.rules.bafoPermitted')}
            hint={t('admin-policy.rules.bafoHint')}
            checked={value.bafoPermitted}
            onChange={(bafoPermitted) => set({ bafoPermitted })}
            error={err('bafoPermitted')}
          />
        </div>
      </fieldset>

      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.thresholds')}</legend>
        <div className="tiq-form-stack">
          {value.thresholds.map((band, index) => (
            <div
              key={index}
              className="tiq-form-grid"
              role="group"
              aria-label={t('admin-policy.rules.threshold.band', { no: index + 1 })}
            >
              <Select
                label={t('admin-policy.rules.threshold.procedure')}
                required
                placeholder={t('admin-policy.common.choose')}
                value={band.procedure}
                options={procedureOptions.filter(
                  (option) =>
                    value.permittedProcedures.includes(option.value) ||
                    option.value === band.procedure,
                )}
                onChange={(procedure) => setBand(index, { procedure })}
                error={err(`thresholds.${index}.procedure`)}
              />
              <TextField
                label={t('admin-policy.rules.threshold.approval')}
                required
                value={band.requiredApprovalLevel}
                onChange={(requiredApprovalLevel) => setBand(index, { requiredApprovalLevel })}
                error={err(`thresholds.${index}.requiredApprovalLevel`)}
              />
              <NumberInput
                label={t('admin-policy.rules.threshold.min')}
                required
                places={2}
                suffix={band.currency}
                value={band.minValue}
                onChange={(minValue) => setBand(index, { minValue })}
                error={err(`thresholds.${index}.minValue`)}
              />
              <NumberInput
                label={t('admin-policy.rules.threshold.max')}
                hint={t('admin-policy.rules.threshold.maxHint')}
                places={2}
                suffix={band.currency}
                value={band.maxValue}
                onChange={(maxValue) => setBand(index, { maxValue })}
                error={err(`thresholds.${index}.maxValue`)}
              />
              <TextField
                label={t('admin-policy.rules.threshold.currency')}
                required
                maxLength={3}
                value={band.currency}
                onChange={(currency) => setBand(index, { currency: currency.toUpperCase() })}
                error={err(`thresholds.${index}.currency`)}
              />
              <div className="tiq-inline">
                <Checkbox
                  label={t('admin-policy.rules.threshold.notice')}
                  checked={band.requiresPublicNotice}
                  onChange={(requiresPublicNotice) => setBand(index, { requiresPublicNotice })}
                />
                <IconButton
                  icon="trash"
                  label={t('admin-policy.rules.threshold.remove', { no: index + 1 })}
                  onClick={() =>
                    set({
                      thresholds: value.thresholds.filter((_, position) => position !== index),
                    })
                  }
                />
              </div>
            </div>
          ))}
          <div>
            <Button
              icon="plus"
              size="sm"
              onClick={() =>
                set({
                  thresholds: [
                    ...value.thresholds,
                    {
                      procedure: '',
                      minValue: '0.00',
                      maxValue: '',
                      currency: defaultCurrency,
                      requiredApprovalLevel: '',
                      requiresPublicNotice: true,
                    },
                  ],
                })
              }
            >
              {t('admin-policy.rules.threshold.add')}
            </Button>
          </div>
        </div>
      </fieldset>

      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.gates')}</legend>
        <div className="tiq-form-grid">
          <Checkbox
            label={t('admin-policy.rules.requiresReleaseApproval')}
            hint={t('admin-policy.rules.releaseHint')}
            checked={value.requiresReleaseApproval}
            onChange={(requiresReleaseApproval) => set({ requiresReleaseApproval })}
          />
          <Checkbox
            label={t('admin-policy.rules.independentEvaluation')}
            checked={value.independentEvaluation}
            onChange={(independentEvaluation) => set({ independentEvaluation })}
          />
          <TextArea
            label={t('admin-policy.rules.approvalRouteNote')}
            hint={t('admin-policy.rules.approvalRouteHint')}
            value={value.approvalRouteNote}
            onChange={(approvalRouteNote) => set({ approvalRouteNote })}
            error={err('approvalRouteNote')}
            rows={3}
            fieldClassName="tiq-form-full"
          />
        </div>
      </fieldset>

      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.exceptions')}</legend>
        <RadioGroup
          label={t('admin-policy.rules.lateSubmissionPolicy')}
          value={value.lateSubmissionPolicy}
          options={POLICY_PROFILE_VERSIONS_LATE_SUBMISSION_POLICY.map((option) => ({
            value: option,
            label: tEnum('policy_profile_versions.late_submission_policy', option),
            hint: t(`admin-policy.rules.late.${option}`),
          }))}
          onChange={(lateSubmissionPolicy) => set({ lateSubmissionPolicy })}
          error={err('lateSubmissionPolicy')}
        />
      </fieldset>

      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.publication')}</legend>
        <Checkbox
          label={t('admin-policy.rules.publicAwardNoticeRequired')}
          checked={value.publicAwardNoticeRequired}
          onChange={(publicAwardNoticeRequired) => set({ publicAwardNoticeRequired })}
        />
      </fieldset>

      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.opening')}</legend>
        <div className="tiq-form-grid">
          <NumberInput
            label={t('admin-policy.rules.openingQuorum')}
            required
            value={value.openingQuorum}
            onChange={(openingQuorum) => set({ openingQuorum })}
            error={err('openingQuorum')}
          />
          <div className="tiq-stack">
            <Checkbox
              label={t('admin-policy.rules.openingRequiresSecondPerson')}
              checked={value.openingRequiresSecondPerson}
              onChange={(openingRequiresSecondPerson) => set({ openingRequiresSecondPerson })}
            />
            <Checkbox
              label={t('admin-policy.rules.stagedOpeningDefault')}
              checked={value.stagedOpeningDefault}
              onChange={(stagedOpeningDefault) => set({ stagedOpeningDefault })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.waiting')}</legend>
        <div className="tiq-form-grid">
          <NumberInput
            label={t('admin-policy.rules.minResponseDays')}
            required
            suffix={t('admin-policy.common.daysUnit')}
            value={value.minResponseDays}
            onChange={(minResponseDays) => set({ minResponseDays })}
            error={err('minResponseDays')}
          />
          <NumberInput
            label={t('admin-policy.rules.questionDeadlineDaysBeforeClose')}
            required
            suffix={t('admin-policy.common.daysUnit')}
            value={value.questionDeadlineDaysBeforeClose}
            onChange={(questionDeadlineDaysBeforeClose) => set({ questionDeadlineDaysBeforeClose })}
            error={err('questionDeadlineDaysBeforeClose')}
          />
          <Checkbox
            label={t('admin-policy.rules.standstillRequired')}
            checked={value.standstillRequired}
            onChange={(standstillRequired) =>
              set(
                standstillRequired
                  ? { standstillRequired }
                  : { standstillRequired, standstillLength: '', standstillDayType: '' },
              )
            }
          />
          <div className="tiq-form-grid">
            <NumberInput
              label={t('admin-policy.rules.standstillLength')}
              required={value.standstillRequired}
              disabled={!value.standstillRequired}
              value={value.standstillLength}
              onChange={(standstillLength) => set({ standstillLength })}
              error={err('standstillLength')}
            />
            <Select
              label={t('admin-policy.rules.standstillDayType')}
              required={value.standstillRequired}
              disabled={!value.standstillRequired}
              placeholder={t('admin-policy.common.choose')}
              value={value.standstillDayType}
              options={POLICY_PROFILE_VERSIONS_STANDSTILL_DAY_TYPE.map((option) => ({
                value: option,
                label: tEnum('policy_profile_versions.standstill_day_type', option),
              }))}
              onChange={(standstillDayType) => set({ standstillDayType })}
              error={err('standstillDayType')}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.rules.section.complaints')}</legend>
        <div className="tiq-form-grid">
          <NumberInput
            label={t('admin-policy.rules.complaintWindowDays')}
            required
            suffix={t('admin-policy.common.daysUnit')}
            value={value.complaintWindowDays}
            onChange={(complaintWindowDays) => set({ complaintWindowDays })}
            error={err('complaintWindowDays')}
          />
          <Checkbox
            label={t('admin-policy.rules.complaintRequiresIndependentReview')}
            checked={value.complaintRequiresIndependentReview}
            onChange={(complaintRequiresIndependentReview) =>
              set({ complaintRequiresIndependentReview })
            }
          />
        </div>
      </fieldset>
    </div>
  );
}
