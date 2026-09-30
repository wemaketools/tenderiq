/**
 * Shared constants and builders of the evaluation fixtures: the natural-key ids used across evaluation fixtures,
 * the KWU confidentiality undertaking, the 0–5 scale anchors and the score-row builder.
 *
 * Id conventions (reported to Integration for the cross-fixture consistency test):
 * - tender id = the number of its reference (`T-2026-0003` → 3); lot 3 of T-2026-0001 is lot id 103;
 * - bid ids: T-2026-0001 → 11, 12; T-2026-0003 → 31, 32, 33; T-2026-0009 → 91, 92, 93;
 * - revision id = bid id × 100 + 1 (the effective revision opened for evaluation).
 */
import { TENANT_IDS, TENANTS } from '../platform.js';
import type { ScaleAnchor, UndertakingText } from '../../../contracts/evaluation.js';
import type { FixtureScore, FixtureScoreCorrection } from './types.js';

/** Demo personas that take part in evaluation (platform fixture user ids). */
export const USERS = {
  mpho: 4,
  tebogo: 5,
  lesego: 9,
  boitumelo: 10,
  thato: 11,
  kabo: 12,
  amantle: 13,
  refilwe: 14,
  keabetswe: 18,
  sam: 42,
} as const;

export const KWU = TENANT_IDS.kwu;
export const GABORONE_TZ = 'Africa/Gaborone';

export const SUPPLIERS = {
  tsodilo: TENANT_IDS.tsodilo,
  chobePipe: TENANT_IDS['chobe-pipe'],
  makgadikgadi: TENANT_IDS.makgadikgadi,
  seroweIct: TENANT_IDS['serowe-ict'],
  limpopoEnv: TENANT_IDS['limpopo-env'],
  gaboroneMeter: TENANT_IDS['gaborone-meter'],
} as const;

/** The display name of a supplier tenant (from the platform fixtures, so names never drift). */
export function supplierName(tenantId: number): string {
  const tenant = TENANTS.find((candidate) => candidate.id === tenantId);
  if (tenant === undefined) {
    throw new Error(`No fixture tenant ${tenantId}.`);
  }
  return tenant.name;
}

/** The KWU confidentiality undertaking every evaluator accepts before any content (BR-08). */
export const KWU_UNDERTAKING: UndertakingText = {
  textVersion: 'KWU-EVAL-CU-2026.1',
  title: 'Evaluation confidentiality undertaking',
  text:
    'I will keep the content of every response, every score and every committee deliberation confidential, use it ' +
    'only for this evaluation, and not copy or disclose it outside the evaluation workspace. I will assess ' +
    'independently on the published criteria and the approved evaluation plan, and I will not discuss my scores ' +
    'with other assessors before moderation. I will declare immediately any financial interest, personal ' +
    'relationship, prior employment or involvement in preparing a bid that could affect my impartiality, and I ' +
    'understand that a declared conflict suspends my access until the chair has reviewed it.',
};

/** The 0–5 rating scale with anchors (PRD §9.3). */
export const SCALE_ANCHORS_0_5: readonly ScaleAnchor[] = [
  { value: 0, label: 'No response', description: 'The requirement is not addressed or the response is unacceptable.' },
  { value: 1, label: 'Poor', description: 'Major gaps or unsupported claims; significant risk to delivery.' },
  { value: 2, label: 'Weak', description: 'Partly addresses the requirement; several material weaknesses.' },
  { value: 3, label: 'Meets requirements', description: 'Addresses every element of the requirement with adequate evidence.' },
  { value: 4, label: 'Good', description: 'Meets every element with clear evidence and some added value or reduced risk.' },
  { value: 5, label: 'Excellent', description: 'Exceeds the requirement with strong evidence, clear added value and low risk.' },
];

/** One cell of an evaluator's matrix: rating (or null = not scored) with its notes. */
export interface CellSpec {
  readonly bidId: number;
  readonly criterionId: number;
  readonly score: string | null;
  readonly rationale: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly clarificationQuestion?: string;
  readonly corrections?: readonly FixtureScoreCorrection[];
  readonly version?: number;
}

/** Builds the score rows of one assignment; score ids are `assignmentId × 100 + position`. */
export function scoreRows(
  assignmentId: number,
  status: FixtureScore['status'],
  submittedAt: string | null,
  cells: readonly CellSpec[],
): FixtureScore[] {
  return cells.map((cell, index) => ({
    scoreId: assignmentId * 100 + index + 1,
    tenantId: KWU,
    assignmentId,
    bidId: cell.bidId,
    criterionId: cell.criterionId,
    score: cell.score,
    isNotApplicable: false,
    rationale: cell.rationale,
    evidenceRefs: cell.evidenceRefs ?? [],
    clarificationNeeded: cell.clarificationQuestion !== undefined,
    clarificationQuestion: cell.clarificationQuestion ?? null,
    status,
    submittedAt,
    version: cell.version ?? 1 + (cell.corrections?.length ?? 0),
    corrections: cell.corrections ?? [],
  }));
}
