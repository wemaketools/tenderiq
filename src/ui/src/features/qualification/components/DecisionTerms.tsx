/**
 * The terms of a qualification decision as buyers see them (BUY-35): outcome and derived status, approved scope and
 * limits, effective dates and reassessment date, conditions with the allowed activities and the blocked gate,
 * internal reasons, the supplier explanation, the appeal route, reviewer and approver, and supersession.
 */
import type { Decision } from '@contracts/qualification';

import { DetailList, Reference } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { buyerQualificationPaths } from '../lib/paths';
import { categoryLabel, dateOrDash, gateText, scopeText } from '../lib/text';
import { EffectiveStatusChip, OutcomeChip } from './shared';

export function DecisionTerms({
  decision,
  timeZone,
}: {
  readonly decision: Decision;
  readonly timeZone: string;
}) {
  return (
    <DetailList
      items={[
        {
          label: t('qualification.terms.outcome'),
          value: <OutcomeChip outcome={decision.outcome} />,
        },
        {
          label: t('qualification.terms.effectiveStatus'),
          value: <EffectiveStatusChip status={decision.effectiveStatus} size="sm" />,
        },
        { label: t('qualification.terms.category'), value: categoryLabel(decision.scopeCategory) },
        {
          label: t('qualification.terms.scope'),
          value: scopeText(decision.scopeCategory, decision.scopeMaxValue, decision.scopeGeography),
        },
        {
          label: t('qualification.terms.effectiveFrom'),
          value: dateOrDash(decision.effectiveFrom),
        },
        {
          label: t('qualification.terms.effectiveTo'),
          value:
            decision.effectiveTo === null
              ? t('qualification.terms.openEnded')
              : dateOrDash(decision.effectiveTo),
        },
        {
          label: t('qualification.terms.reassessmentDate'),
          value: dateOrDash(decision.reassessmentDate),
        },
        { label: t('qualification.terms.conditions'), value: decision.conditions },
        { label: t('qualification.terms.allowedActivities'), value: decision.allowedActivities },
        { label: t('qualification.terms.blockedGate'), value: gateText(decision.blockedGate) },
        { label: t('qualification.terms.reasons'), value: decision.reasons },
        {
          label: t('qualification.terms.supplierExplanation'),
          value: decision.supplierExplanation,
        },
        { label: t('qualification.terms.appealRoute'), value: decision.appealRoute },
        { label: t('qualification.decision.reviewer'), value: decision.reviewer?.fullName ?? null },
        { label: t('qualification.decision.approver'), value: decision.approver?.fullName ?? null },
        {
          label: t('qualification.decision.decidedAt'),
          value: formatDateTime(decision.decidedAt, timeZone),
        },
        {
          label: t('qualification.decision.notified'),
          value:
            decision.supplierNotifiedAt === null
              ? t('qualification.decision.notNotified')
              : formatDateTime(decision.supplierNotifiedAt, timeZone),
        },
        {
          label: t('qualification.decision.application'),
          value: (
            <Reference
              value={decision.applicationReference}
              to={buyerQualificationPaths.application(decision.applicationId)}
            />
          ),
        },
        {
          label: t('qualification.decision.supersededBy'),
          value:
            decision.supersededById === null ? null : (
              <Reference
                value={t('qualification.decision.decisionNo', { id: decision.supersededById })}
                to={buyerQualificationPaths.decision(decision.supersededById)}
              />
            ),
        },
        { label: t('qualification.decision.supersedeReason'), value: decision.supersedeReason },
      ]}
    />
  );
}
