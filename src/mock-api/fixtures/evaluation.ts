/**
 * Evaluation fixtures (domain 11; docs/plan/demo-storyline.md): every evaluation of the demo world with its
 * assignments and individual scores. Only the KWU buyer runs evaluations in the storyline; ODC has none, and
 * suppliers, the public and operators never receive evaluation records ([R] tables, DD-03, PRD §4.3).
 *
 * - T-2026-0003 carries the PRD §9.2 worked example exactly (AC-18, AC-19, AC-20).
 * - T-2026-0001 Lot 3 is still under evaluation (returned assessment, unaccepted assignment, price gate closed).
 * - T-2026-0009 is re-validated after a due-diligence failure, with a supplementary report in sign-off.
 * - T-2026-0014 (five lots) holds one lot at each later step, so every committee command has a record in the state
 *   it needs: a signed-off report to hand off, a draft report ready for sign-off, a draft comparison with a pending
 *   correction and an abnormally-low flag, a price gate ready to release and a moderation ready to finalize.
 *
 * Static data: nothing here is mutated at runtime (the arrays are frozen).
 */
import { T_2026_0001_LOT_3 } from './evaluation/t2026-0001-lot3.js';
import { T_2026_0003 } from './evaluation/t2026-0003.js';
import { T_2026_0009 } from './evaluation/t2026-0009.js';
import { T_2026_0014_LOTS } from './evaluation/t2026-0014.js';
import type { FixtureAssignment, FixtureEvaluation, FixtureScore } from './evaluation/types.js';

export { KWU_UNDERTAKING, USERS as EVALUATION_USERS } from './evaluation/common.js';
export type * from './evaluation/types.js';

const SETS = [T_2026_0003, T_2026_0001_LOT_3, T_2026_0009, ...T_2026_0014_LOTS] as const;

export const EVALUATIONS: readonly FixtureEvaluation[] = Object.freeze(SETS.map((set) => set.evaluation));
export const EVALUATION_ASSIGNMENTS: readonly FixtureAssignment[] = Object.freeze(SETS.flatMap((set) => set.assignments));
export const EVALUATION_SCORES: readonly FixtureScore[] = Object.freeze(SETS.flatMap((set) => set.scores));
