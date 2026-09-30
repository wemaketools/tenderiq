/**
 * The decider's side of COM-05: the authority check (BR-06, DD-24), conflicts and independence (BR-07, BR-08) and
 * a readiness list that separates blocking conditions from warnings (PRD §19).
 */
import type { ApprovalBlocker, ApprovalDetail } from '@contracts/approvals';

import { Card, Chip, DetailList, ReadinessChecklist } from '../../../components/ui';
import type { ReadinessItem } from '../../../components/ui';
import { formatCalendarDate, formatDecimalString, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';

export function AuthorityCard({ approval }: { readonly approval: ApprovalDetail }) {
  const authority = approval.authority;
  return (
    <Card title={t('approvals.authority.title')}>
      {authority === null ? (
        <p className="tiq-text-muted">
          {approval.myStep === null
            ? t('approvals.authority.notYours')
            : t('approvals.authority.notApplicable')}
        </p>
      ) : (
        <DetailList
          stacked
          items={[
            {
              key: 'type',
              label: t('approvals.authority.decisionType'),
              value:
                authority.decisionType === null
                  ? t('approvals.authority.notApplicable')
                  : tEnum('authority_limits.decision_type', authority.decisionType),
            },
            {
              key: 'amount',
              label: t('approvals.authority.amount'),
              value: authority.amount === null ? null : formatMoney(authority.amount),
            },
            {
              key: 'limit',
              label: t('approvals.authority.limit'),
              value: (
                <span className="tiq-inline">
                  <span>
                    {authority.limit !== null
                      ? formatMoney(authority.limit)
                      : authority.basis === 'unlimited'
                        ? t('approvals.authority.unlimited')
                        : t('approvals.authority.none')}
                  </span>
                  <Chip
                    tone={authority.sufficient ? 'success' : 'danger'}
                    size="sm"
                    icon={authority.sufficient ? 'checkCircle' : 'xCircle'}
                  >
                    {authority.sufficient
                      ? t('approvals.authority.sufficient')
                      : t('approvals.authority.insufficient')}
                  </Chip>
                </span>
              ),
            },
            {
              key: 'basis',
              label: t('approvals.authority.basis'),
              value: t(`approvals.authority.basisValue.${authority.basis}`),
            },
            {
              key: 'delegated',
              label: t('approvals.authority.delegatedFrom'),
              value: authority.delegatedFrom?.fullName ?? null,
            },
            {
              key: 'conversion',
              label: t('approvals.authority.conversion'),
              value:
                authority.conversion === null
                  ? authority.missingExchangeRate
                    ? t('approvals.authority.missingRate')
                    : null
                  : t('approvals.authority.conversionLine', {
                      amount: formatMoney(authority.conversion.convertedAmount),
                      rate: formatDecimalString(authority.conversion.rate),
                      source: authority.conversion.source,
                      date: formatCalendarDate(authority.conversion.rateDate),
                    }),
            },
            {
              key: 'permission',
              label: t('approvals.authority.permission'),
              value: <span className="tiq-mono">{approval.decisionPermission}</span>,
            },
          ]}
        />
      )}
    </Card>
  );
}

export function IndependenceCard({ approval }: { readonly approval: ApprovalDetail }) {
  const { conflict, sod } = approval;
  let conflictText: string;
  if (conflict.declared && conflict.hasConflict === false) {
    conflictText = t('approvals.independence.declaredNone');
  } else if (conflict.declared && conflict.disposition !== null) {
    conflictText = t('approvals.independence.declaredConflict', {
      disposition: tEnum('conflict_declarations.disposition', conflict.disposition),
    });
  } else if (conflict.declared) {
    conflictText = t('approvals.independence.declaredPending');
  } else if (conflict.declarationRequired) {
    conflictText = t('approvals.independence.declarationRequired');
  } else {
    conflictText = t('approvals.independence.notRequired');
  }
  return (
    <Card title={t('approvals.independence.title')}>
      <DetailList
        stacked
        items={[
          {
            key: 'conflict',
            label: t('approvals.independence.conflict'),
            value: (
              <span className={conflict.blocksDecision ? 'tiq-text-danger' : undefined}>
                {conflictText}
              </span>
            ),
          },
          {
            key: 'sod',
            label: t('approvals.independence.sod'),
            value: (
              <span className="tiq-stack">
                <span className={sod.blocked ? 'tiq-text-danger' : undefined}>
                  {sod.blocked && sod.rule !== null && sod.mode !== null
                    ? t('approvals.independence.sodBlocked', {
                        rule: tEnum('sod_policies.rule_code', sod.rule),
                        mode: tEnum('sod_policies.mode', sod.mode),
                      })
                    : t('approvals.independence.sodClear')}
                </span>
                {sod.alternativeOversightNote !== null && (
                  <span className="tiq-text-muted">
                    {t('approvals.independence.sodNote', { note: sod.alternativeOversightNote })}
                  </span>
                )}
              </span>
            ),
          },
        ]}
      />
    </Card>
  );
}

/** Blockers the specific checks below already explain. */
const EXPLAINED: readonly ApprovalBlocker[] = [
  'version_changed',
  'authority_insufficient',
  'conflict_declaration_required',
  'conflict_unresolved',
  'sod_blocked',
];

export function DecisionReadiness({ approval }: { readonly approval: ApprovalDetail }) {
  const step = approval.myStep;
  if (step === null) return null;
  const blockers = step.blockers;
  const items: ReadinessItem[] = [];
  const current = approval.currentSubjectVersion ?? approval.subjectVersion;
  items.push(
    blockers.includes('version_changed') || current !== approval.subjectVersion
      ? {
          id: 'version',
          status: 'blocking',
          label: t('approvals.readiness.versionChanged', {
            current,
            version: approval.subjectVersion,
          }),
        }
      : {
          id: 'version',
          status: 'passed',
          label: t('approvals.readiness.version', { version: approval.subjectVersion }),
        },
  );
  const authority = approval.authority;
  if (blockers.includes('authority_insufficient') || authority?.sufficient === false) {
    items.push({
      id: 'authority',
      status: 'blocking',
      label: t('approvals.blocker.authority_insufficient'),
    });
  } else if (authority !== null && authority.amount !== null) {
    items.push({
      id: 'authority',
      status: 'passed',
      label: t('approvals.readiness.authorityOk', { amount: formatMoney(authority.amount) }),
    });
  } else {
    items.push({
      id: 'authority',
      status: 'passed',
      label: t('approvals.readiness.authorityNone'),
    });
  }
  if (step.actingFor !== null) {
    items.push({
      id: 'delegation',
      status: 'warning',
      label: t('approvals.readiness.actingFor', { name: step.actingFor.fullName }),
    });
  }
  if (authority?.conversion !== null && authority?.conversion !== undefined) {
    items.push({ id: 'conversion', status: 'warning', label: t('approvals.readiness.conversion') });
  }
  const conflictBlocker = blockers.find(
    (code) => code === 'conflict_declaration_required' || code === 'conflict_unresolved',
  );
  items.push(
    conflictBlocker !== undefined || approval.conflict.blocksDecision
      ? {
          id: 'conflict',
          status: 'blocking',
          label: t(`approvals.blocker.${conflictBlocker ?? 'conflict_unresolved'}`),
        }
      : { id: 'conflict', status: 'passed', label: t('approvals.readiness.conflictOk') },
  );
  if (blockers.includes('sod_blocked') || approval.sod.blocked) {
    items.push({ id: 'sod', status: 'blocking', label: t('approvals.blocker.sod_blocked') });
  } else if (approval.sod.alternativeOversightNote !== null) {
    items.push({
      id: 'sod',
      status: 'warning',
      label: t('approvals.readiness.sodNote'),
      detail: approval.sod.alternativeOversightNote,
    });
  } else {
    items.push({ id: 'sod', status: 'passed', label: t('approvals.readiness.sodOk') });
  }
  for (const code of blockers) {
    if (EXPLAINED.includes(code)) continue;
    items.push({ id: code, status: 'blocking', label: t(`approvals.blocker.${code}`) });
  }
  return (
    <Card title={t('approvals.readiness.title')}>
      <ReadinessChecklist label={t('approvals.readiness.label')} items={items} />
    </Card>
  );
}
