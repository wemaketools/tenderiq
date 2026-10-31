/**
 * The stage summary of the award register (docs/plan/design1 §5): four groups of `AWARD_NEXT_STEPS`, used as a
 * FILTER (the groups travel through the existing `nextStep` list filter) and, when the whole register is loaded, as
 * counts. It is a view of the next required action, not a linear path every award follows: a file moves back
 * (a returned recommendation, a complaint) as readily as forward.
 */
import { AWARD_NEXT_STEPS } from '@contracts/awards';
import type { AwardNextStep, AwardRegisterRow } from '@contracts/awards';

import type { IconName } from '../../../components/ui';
import { awardPaths } from './paths';

export const AWARD_STAGES = ['decision', 'standstill', 'ready', 'completed'] as const;
export type AwardStage = (typeof AWARD_STAGES)[number];

export const AWARD_STAGE_STEPS: Readonly<Record<AwardStage, readonly AwardNextStep[]>> = {
  decision: ['prepare_recommendation', 'submit_recommendation', 'await_recommendation_approval'],
  standstill: ['issue_intent_notice', 'await_standstill', 'resolve_complaint'],
  ready: ['final_award', 'publish_award_notice'],
  completed: ['close_event', 'archive', 'none'],
};

/** The stage a filter value names, or `null` for anything else (including an empty filter). */
export function stageOf(value: string): AwardStage | null {
  return (AWARD_STAGES as readonly string[]).includes(value) ? (value as AwardStage) : null;
}

/** The stage of a next step. */
export function stageOfStep(step: AwardNextStep): AwardStage {
  for (const stage of AWARD_STAGES) {
    if (AWARD_STAGE_STEPS[stage].includes(step)) return stage;
  }
  return 'completed';
}

/** Files per stage, for the counts of a fully loaded register. */
export function countByStage(rows: readonly AwardRegisterRow[]): Record<AwardStage, number> {
  const counts: Record<AwardStage, number> = { decision: 0, standstill: 0, ready: 0, completed: 0 };
  for (const row of rows) {
    counts[stageOfStep(row.nextStep)] += 1;
  }
  return counts;
}

/** True when every next step is covered by exactly one stage (guards the mapping against new steps). */
export function stagesCoverEveryStep(): boolean {
  const covered = new Set(AWARD_STAGES.flatMap((stage) => AWARD_STAGE_STEPS[stage]));
  return (
    AWARD_NEXT_STEPS.every((step) => covered.has(step)) && covered.size === AWARD_NEXT_STEPS.length
  );
}

/** The icon of a completed stage (shown instead of a count). */
export const COMPLETED_STAGE_ICON: IconName = 'check';

/** Where the next step of a file is taken: the award file, its notices, the complaints or the closeout. */
export function nextStepPath(row: AwardRegisterRow): string {
  const id = row.tender.tenderId;
  switch (row.nextStep) {
    case 'issue_intent_notice':
    case 'await_standstill':
    case 'publish_award_notice':
      return awardPaths.notices(id);
    case 'resolve_complaint':
      return awardPaths.complaints;
    case 'close_event':
    case 'archive':
      return awardPaths.closeout(id);
    default:
      return awardPaths.file(id);
  }
}
