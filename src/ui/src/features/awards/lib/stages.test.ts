import { describe, expect, it } from 'vitest';

import { AWARD_NEXT_STEPS } from '@contracts/awards';

import {
  AWARD_STAGE_STEPS,
  countByStage,
  stageOf,
  stageOfStep,
  stagesCoverEveryStep,
} from './stages';
import { registerRow } from '../test/data';

describe('award stages', () => {
  it('covers every next step with exactly one stage, so a filter never drops a file', () => {
    expect(stagesCoverEveryStep()).toBe(true);
    for (const step of AWARD_NEXT_STEPS) {
      expect(AWARD_STAGE_STEPS[stageOfStep(step)]).toContain(step);
    }
  });

  it('counts files by the stage of their next step and ignores unknown filter values', () => {
    const rows = [
      registerRow({ nextStep: 'prepare_recommendation' }),
      registerRow({ nextStep: 'await_standstill' }),
      registerRow({ nextStep: 'none' }),
    ];
    expect(countByStage(rows)).toEqual({ decision: 1, standstill: 1, ready: 0, completed: 1 });
    expect(stageOf('ready')).toBe('ready');
    expect(stageOf('')).toBeNull();
    expect(stageOf('final_award')).toBeNull();
  });
});
