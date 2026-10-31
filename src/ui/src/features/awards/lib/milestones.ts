/**
 * The "Award progress" milestones of a register row (docs/plan/design1 §5), derived from the ROW's own fields only:
 * no award file is fetched per row. Where the row carries nothing about a milestone, it is "Not started", never
 * a guessed success. States: done (blue check), pending (hollow), warning (returned, suspended, blocked, on hold).
 */
import type { AwardRegisterRow } from '@contracts/awards';

import type { CheckState } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';

export interface RowMilestone {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly state: CheckState;
}

function stateLabel(state: CheckState): string {
  return t(`awards.progress.state.${state}`);
}

export function rowMilestones(row: AwardRegisterRow): readonly (RowMilestone & {
  readonly stateLabel: string;
})[] {
  const rec = row.latestRecommendation;
  const notStarted = t('awards.progress.notStarted');
  const version = rec === null ? '' : t('awards.common.version', { no: rec.version });

  let recommendation: RowMilestone;
  if (rec === null) {
    recommendation = {
      id: 'recommendation',
      label: t('awards.progress.recommendation'),
      note: t('awards.register.noRecommendation'),
      state: 'pending',
    };
  } else {
    const warn = rec.status === 'returned' || rec.status === 'rejected';
    const done = rec.status === 'approved' || rec.status === 'awaiting_approval';
    recommendation = {
      id: 'recommendation',
      label: t('awards.progress.recommendation'),
      note: `${version} · ${tEnum('award_recommendations.status', rec.status)}`,
      state: warn ? 'warning' : done ? 'done' : 'pending',
    };
  }

  const approval: RowMilestone = {
    id: 'approval',
    label: t('awards.progress.approval'),
    note:
      rec?.status === 'approved'
        ? version
        : rec?.status === 'awaiting_approval'
          ? t('awards.progress.awaitingSignOff')
          : rec?.status === 'returned' || rec?.status === 'rejected'
            ? tEnum('award_recommendations.status', rec.status)
            : notStarted,
    state:
      rec?.status === 'approved'
        ? 'done'
        : rec?.status === 'returned' || rec?.status === 'rejected'
          ? 'warning'
          : 'pending',
  };

  const noticed =
    row.standstillStatus !== null || row.value?.basis === 'intended' || row.lotsFinalAwarded > 0;
  const intent: RowMilestone = {
    id: 'intent',
    label: t('awards.progress.intent'),
    note: noticed ? t('awards.progress.notified') : notStarted,
    state: noticed ? 'done' : 'pending',
  };

  let standstill: RowMilestone;
  switch (row.standstillStatus) {
    case 'completed':
    case 'not_applicable':
      standstill = {
        id: 'standstill',
        label: t('awards.progress.standstill'),
        note: tEnum('standstill_periods.status', row.standstillStatus),
        state: 'done',
      };
      break;
    case 'running':
    case 'extended':
    case 'suspended':
      standstill = {
        id: 'standstill',
        label: t('awards.progress.standstill'),
        note: tEnum('standstill_periods.status', row.standstillStatus),
        state: row.standstillStatus === 'suspended' ? 'warning' : 'pending',
      };
      break;
    default:
      standstill = {
        id: 'standstill',
        label: t('awards.progress.standstill'),
        note: notStarted,
        state: 'pending',
      };
  }

  const allFinal = row.lotCount > 0 && row.lotsFinalAwarded === row.lotCount;
  const held = row.activeHoldCount > 0 && !allFinal;
  const finalAward: RowMilestone = {
    id: 'final',
    label: t('awards.progress.finalAward'),
    note: held
      ? t('awards.register.holds', { count: row.activeHoldCount })
      : row.lotsFinalAwarded > 0
        ? t('awards.progress.lotsFinal', {
            done: formatCount(row.lotsFinalAwarded),
            total: formatCount(row.lotCount),
          })
        : notStarted,
    state: allFinal ? 'done' : held ? 'warning' : 'pending',
  };

  const closeout: RowMilestone = {
    id: 'closeout',
    label: t('awards.progress.closeout'),
    note:
      row.closeoutStatus === null
        ? notStarted
        : tEnum('event_closeouts.status', row.closeoutStatus),
    state:
      row.closeoutStatus === 'closed' || row.closeoutStatus === 'archived'
        ? 'done'
        : row.closeoutStatus === 'blocked'
          ? 'warning'
          : 'pending',
  };

  return [recommendation, approval, intent, standstill, finalAward, closeout].map((item) => ({
    ...item,
    stateLabel: stateLabel(item.state),
  }));
}
