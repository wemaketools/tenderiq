/**
 * Tender authoring rules shared by the SPA (live warnings while editing), the mock API (fixture-derived issues)
 * and Stage B (authoritative checks). Pure functions over plain values: no I/O, no clock.
 *
 * - Requirements (BUY-09, FR-07): accountable owner (BR-01) and contradictions between treatment, missing-item
 *   consequence, criterion and envelope. Business eligibility must never be confused with a completeness warning.
 * - Evaluation plan (BUY-11, PRD §9): weights total 100, price weight and treatments, thresholds, anchors, tie
 *   rules and decimals.
 * - Timetable (BUY-12, BR-11, BR-12): ordering, policy periods and working-day hints in the official time zone
 *   using the tender's calendar.
 */
import { eq, round, sum } from '../decimal.js';
import type {
  EvaluationPlansPriceMethod,
  EvaluationPlansStatus,
  EvaluationPlansThresholdScope,
  RequirementsEnvelope,
  RequirementsMissingConsequence,
  RequirementsResponseType,
  RequirementsTreatment,
  TenderMilestonesMilestone,
  TendersOpeningMode,
} from '../enums.js';
import { milestoneOrderViolations } from './schemas.js';
import type { Holiday, TenderIssue, TenderIssueCode, WorkingDayHint } from './schemas.js';

function issueOf(
  code: TenderIssueCode,
  severity: TenderIssue['severity'],
  message: string,
  field: string | null = null,
  relatedId: number | null = null,
): TenderIssue {
  return { code, severity, message, field, relatedId };
}

// ---------------------------------------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------------------------------------

export interface RequirementFacts {
  readonly id: number;
  readonly refCode: string;
  readonly ownerUserId: number | null;
  readonly responseType: RequirementsResponseType;
  readonly choices: readonly string[];
  readonly evidenceRequired: string | null;
  readonly treatment: RequirementsTreatment;
  readonly envelope: RequirementsEnvelope;
  readonly missingConsequence: RequirementsMissingConsequence;
  /** The linked evaluation criterion, if any. */
  readonly criterion: { readonly envelope: RequirementsEnvelope; readonly isPrice: boolean } | null;
}

export interface RequirementContext {
  /** Envelopes configured on the tender. */
  readonly envelopes: readonly RequirementsEnvelope[];
  /** Reference codes used by more than one requirement of the tender. */
  readonly duplicateRefCodes: ReadonlySet<string>;
}

/** Issues of one requirement. `blocking` issues stop the release approval request. */
export function requirementIssues(requirement: RequirementFacts, context: RequirementContext): TenderIssue[] {
  const issues: TenderIssue[] = [];
  const field = `requirements.${requirement.refCode}`;
  const { id, refCode } = requirement;
  if (requirement.ownerUserId === null) {
    issues.push(issueOf('REQUIREMENT_OWNER_MISSING', 'blocking', `${refCode} has no accountable owner.`, field, id));
  }
  if (requirement.treatment === 'mandatory_gate' && requirement.missingConsequence === 'warning') {
    issues.push(
      issueOf(
        'MANDATORY_GATE_ONLY_WARNS',
        'blocking',
        `${refCode} is a mandatory gate, but a missing response only raises a warning. A gate must reject or seek clarification.`,
        field,
        id,
      ),
    );
  }
  if (requirement.treatment === 'information_only' && requirement.missingConsequence === 'reject') {
    issues.push(
      issueOf(
        'INFORMATION_ONLY_REJECTS',
        'blocking',
        `${refCode} is for information only, but a missing response would reject the bid. Make it a mandatory gate or change the consequence.`,
        field,
        id,
      ),
    );
  }
  if (requirement.treatment === 'rated' && requirement.criterion === null) {
    issues.push(issueOf('RATED_WITHOUT_CRITERION', 'blocking', `${refCode} is rated but no evaluation criterion assesses it.`, field, id));
  }
  if (requirement.treatment === 'mandatory_gate' && requirement.criterion !== null) {
    issues.push(
      issueOf(
        'GATE_LINKED_TO_RATED_CRITERION',
        'warning',
        `${refCode} is a pass/fail gate and is also linked to a scored criterion; check for double counting.`,
        field,
        id,
      ),
    );
  }
  if (requirement.criterion !== null && requirement.criterion.envelope !== requirement.envelope) {
    issues.push(
      issueOf(
        'CRITERION_ENVELOPE_MISMATCH',
        'warning',
        `${refCode} sits in the ${requirement.envelope} envelope but its criterion is assessed in the ${requirement.criterion.envelope} envelope.`,
        field,
        id,
      ),
    );
  }
  if (!context.envelopes.includes(requirement.envelope)) {
    issues.push(
      issueOf('ENVELOPE_NOT_CONFIGURED', 'blocking', `${refCode} uses the ${requirement.envelope} envelope, which the tender does not configure.`, field, id),
    );
  }
  if (context.duplicateRefCodes.has(refCode)) {
    issues.push(issueOf('DUPLICATE_REFERENCE_CODE', 'blocking', `The reference ${refCode} is used by more than one requirement.`, field, id));
  }
  if (requirement.responseType === 'choice' && requirement.choices.length < 2) {
    issues.push(issueOf('CHOICES_MISSING', 'blocking', `${refCode} asks for a choice but lists fewer than two options.`, field, id));
  }
  if (requirement.treatment === 'mandatory_gate' && requirement.responseType === 'document' && requirement.evidenceRequired === null) {
    issues.push(
      issueOf('MANDATORY_EVIDENCE_UNSPECIFIED', 'warning', `${refCode} requires a document but does not say which evidence is acceptable.`, field, id),
    );
  }
  return issues;
}

/** The reference codes used more than once. */
export function duplicateRefCodes(refCodes: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const code of refCodes) {
    if (seen.has(code)) {
      duplicates.add(code);
    }
    seen.add(code);
  }
  return duplicates;
}

/** Whether an issue code is a requirement contradiction (as opposed to a missing owner). */
export function isContradiction(code: TenderIssueCode): boolean {
  return (
    code === 'MANDATORY_GATE_ONLY_WARNS' ||
    code === 'INFORMATION_ONLY_REJECTS' ||
    code === 'RATED_WITHOUT_CRITERION' ||
    code === 'GATE_LINKED_TO_RATED_CRITERION' ||
    code === 'CRITERION_ENVELOPE_MISMATCH' ||
    code === 'DUPLICATE_REFERENCE_CODE'
  );
}

// ---------------------------------------------------------------------------------------------------------
// Evaluation plan
// ---------------------------------------------------------------------------------------------------------

export interface PlanFacts {
  readonly status: EvaluationPlansStatus;
  readonly scaleMax: number;
  readonly priceMethod: EvaluationPlansPriceMethod;
  readonly priceWeight: string | null;
  readonly zeroPriceTreatment: string | null;
  readonly missingPriceTreatment: string | null;
  readonly thresholdScope: EvaluationPlansThresholdScope;
  readonly nonPriceThreshold: string | null;
  readonly decimalPlacesCalc: number;
  readonly decimalPlacesDisplay: number;
  readonly criteria: readonly { readonly parentId: number | null; readonly maxPoints: string; readonly isPrice: boolean }[];
  readonly anchorValues: readonly number[];
  readonly tieBreakRuleCount: number;
}

/** Sum of the top-level criteria points, as a decimal string with two places. */
export function weightsTotal(criteria: PlanFacts['criteria']): string {
  const topLevel = criteria.filter((criterion) => criterion.parentId === null).map((criterion) => criterion.maxPoints);
  return round(sum(topLevel), 2);
}

/** Issues of an evaluation plan (PRD §9.1, §9.3). */
export function planIssues(plan: PlanFacts): TenderIssue[] {
  const issues: TenderIssue[] = [];
  const total = weightsTotal(plan.criteria);
  if (!eq(total, '100')) {
    issues.push(issueOf('WEIGHTS_NOT_100', 'blocking', `Weights total ${total}; the top-level criteria must total 100.`, 'criteria'));
  }
  const priceCriteria = plan.criteria.filter((criterion) => criterion.isPrice);
  if (plan.priceMethod !== 'none') {
    if (priceCriteria.length === 0) {
      issues.push(issueOf('PRICE_CRITERION_MISSING', 'blocking', 'The price method needs a price criterion.', 'criteria'));
    }
    const priceTotal = sum(priceCriteria.map((criterion) => criterion.maxPoints));
    if (plan.priceWeight === null || !eq(plan.priceWeight, priceTotal)) {
      issues.push(issueOf('PRICE_WEIGHT_MISMATCH', 'blocking', 'The price weight does not equal the points of the price criteria.', 'priceWeight'));
    }
    if ((plan.zeroPriceTreatment ?? '').trim() === '' || (plan.missingPriceTreatment ?? '').trim() === '') {
      issues.push(
        issueOf('PRICE_TREATMENT_UNDECLARED', 'blocking', 'Declare how zero and missing prices are treated before release.', 'zeroPriceTreatment'),
      );
    }
  }
  if (plan.thresholdScope !== 'none' && plan.nonPriceThreshold === null) {
    issues.push(issueOf('THRESHOLD_MISSING', 'blocking', 'A threshold scope is set but no threshold value.', 'nonPriceThreshold'));
  }
  const missingAnchors: number[] = [];
  for (let value = 0; value <= plan.scaleMax; value += 1) {
    if (!plan.anchorValues.includes(value)) {
      missingAnchors.push(value);
    }
  }
  if (missingAnchors.length > 0) {
    issues.push(
      issueOf('ANCHORS_INCOMPLETE', 'warning', `Scale values without an anchor: ${missingAnchors.join(', ')}.`, 'anchors'),
    );
  }
  if (plan.tieBreakRuleCount === 0) {
    issues.push(issueOf('TIE_RULES_MISSING', 'blocking', 'Publish a tie-break sequence before release.', 'tieBreakRules'));
  }
  if (plan.decimalPlacesDisplay > plan.decimalPlacesCalc) {
    issues.push(issueOf('DECIMALS_INCONSISTENT', 'blocking', 'Display decimals exceed calculation decimals.', 'decimalPlacesDisplay'));
  }
  if (plan.status === 'draft') {
    issues.push(issueOf('PLAN_NOT_APPROVED', 'blocking', 'The evaluation plan must be approved before release.', 'status'));
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------------------
// Time and working days (BR-11, BR-12)
// ---------------------------------------------------------------------------------------------------------

/** The calendar date of an instant in an IANA time zone (`YYYY-MM-DD`). */
export function localDateOf(at: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(at),
  );
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateToUtcMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function addDays(date: string, days: number): string {
  return new Date(dateToUtcMs(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole calendar days from one date to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / 86_400_000);
}

function isWeekend(date: string): boolean {
  const weekday = new Date(dateToUtcMs(date)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function holidayName(date: string, holidays: readonly Holiday[]): string | null {
  return holidays.find((holiday) => holiday.date === date)?.name ?? null;
}

/** Whether a calendar date is a working day in the calendar (weekends and holidays are not). */
export function isWorkingDate(date: string, holidays: readonly Holiday[]): boolean {
  return !isWeekend(date) && holidayName(date, holidays) === null;
}

/** The working-day hint of an instant in the official zone (BR-12). */
export function workingDayHint(at: string, timeZone: string, holidays: readonly Holiday[]): WorkingDayHint {
  const localDate = localDateOf(at, timeZone);
  const holiday = holidayName(localDate, holidays);
  const weekend = isWeekend(localDate);
  if (!weekend && holiday === null) {
    return { localDate, isWorkingDay: true, reason: null, holidayName: null, nextWorkingDate: null };
  }
  let next = addDays(localDate, 1);
  for (let guard = 0; guard < 30 && !isWorkingDate(next, holidays); guard += 1) {
    next = addDays(next, 1);
  }
  return {
    localDate,
    isWorkingDay: false,
    reason: holiday !== null ? 'holiday' : 'weekend',
    holidayName: holiday,
    nextWorkingDate: next,
  };
}

/** Working days after `from` up to and including `to`, in the official zone. */
export function workingDaysBetween(from: string, to: string, timeZone: string, holidays: readonly Holiday[]): number {
  const start = localDateOf(from, timeZone);
  const end = localDateOf(to, timeZone);
  let count = 0;
  for (let date = addDays(start, 1); daysBetween(date, end) >= 0; date = addDays(date, 1)) {
    if (isWorkingDate(date, holidays)) {
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------------------------------------
// Timetable coherence
// ---------------------------------------------------------------------------------------------------------

export interface TimetableFacts {
  readonly timeZone: string;
  readonly holidays: readonly Holiday[];
  readonly calendarId: number | null;
  readonly releaseAt: string | null;
  readonly milestones: readonly {
    readonly id: number | null;
    readonly milestone: TenderMilestonesMilestone;
    readonly lotId: number | null;
    /** The lot number, so per-lot messages can name the lot. */
    readonly lotNo?: number | null;
    readonly at: string;
  }[];
  readonly policy: { readonly minResponseDays: number | null; readonly questionDeadlineDaysBeforeClose: number | null } | null;
  readonly openingMode: TendersOpeningMode;
  readonly envelopeCount: number;
}

const WORKING_DAY_MILESTONES: readonly TenderMilestonesMilestone[] = [
  'questions_deadline',
  'briefing',
  'site_visit',
  'submission_deadline',
  'opening',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** A calendar date (`2026-12-29`) as the UI writes it: `29 Dec 2026`. */
export function formatDateText(date: string): string {
  const [year, month, day] = date.split('-');
  const name = MONTHS[Number(month) - 1];
  return name === undefined || year === undefined || day === undefined ? date : `${Number(day)} ${name} ${year}`;
}

/** "" for the whole tender, " for Lot 2", " for Lots 1 and 2", " for the whole tender and Lot 1". */
function scopeText(lots: readonly (number | null)[]): string {
  const lotNos = [...new Set(lots.filter((lot): lot is number => lot !== null))].sort((a, b) => a - b);
  if (lotNos.length === 0) {
    return '';
  }
  const list = lotNos.length === 1 ? `Lot ${lotNos[0]}` : `Lots ${lotNos.slice(0, -1).join(', ')} and ${lotNos[lotNos.length - 1]}`;
  return lots.includes(null) ? ` for the whole tender and ${list}` : ` for ${list}`;
}

/** Coherence issues of a timetable. */
export function timetableIssues(facts: TimetableFacts): TenderIssue[] {
  const issues: TenderIssue[] = [];
  const tenderLevel = new Map(facts.milestones.filter((row) => row.lotId === null).map((row) => [row.milestone, row] as const));
  const submission = tenderLevel.get('submission_deadline');
  if (submission === undefined) {
    issues.push(issueOf('SUBMISSION_DEADLINE_MISSING', 'blocking', 'Set the submission deadline.', 'milestones.submission_deadline'));
  }
  if (facts.calendarId === null) {
    issues.push(issueOf('CALENDAR_MISSING', 'blocking', 'Choose the working-day calendar of the event.', 'calendarId'));
  }
  const lotNos = new Map(facts.milestones.map((row) => [row.lotId, row.lotNo ?? null] as const));
  const lotName = (lotId: number): string => {
    const lotNo = lotNos.get(lotId);
    return lotNo === null || lotNo === undefined ? 'its lot' : `Lot ${lotNo}`;
  };
  for (const violation of milestoneOrderViolations(facts.milestones, facts.releaseAt, lotName)) {
    const row = facts.milestones[violation.index];
    issues.push(issueOf('MILESTONE_ORDER', 'blocking', violation.message, `milestones.${violation.milestone}`, row?.id ?? null));
  }
  const briefing = tenderLevel.get('briefing');
  const questions = tenderLevel.get('questions_deadline');
  if (briefing !== undefined && questions !== undefined && Date.parse(briefing.at) >= Date.parse(questions.at)) {
    issues.push(
      issueOf(
        'BRIEFING_AFTER_QUESTIONS_DEADLINE',
        'warning',
        'The briefing is after the questions deadline, so suppliers cannot ask about it.',
        'milestones.briefing',
        briefing.id,
      ),
    );
  }
  if (facts.releaseAt !== null && submission !== undefined && facts.policy?.minResponseDays != null) {
    const days = daysBetween(localDateOf(facts.releaseAt, facts.timeZone), localDateOf(submission.at, facts.timeZone));
    if (days < facts.policy.minResponseDays) {
      issues.push(
        issueOf(
          'RESPONSE_PERIOD_TOO_SHORT',
          'blocking',
          `Suppliers get ${days} days to respond; the policy requires at least ${facts.policy.minResponseDays}.`,
          'milestones.submission_deadline',
          submission.id,
        ),
      );
    }
  }
  if (questions !== undefined && submission !== undefined && facts.policy?.questionDeadlineDaysBeforeClose != null) {
    const days = daysBetween(localDateOf(questions.at, facts.timeZone), localDateOf(submission.at, facts.timeZone));
    if (days < facts.policy.questionDeadlineDaysBeforeClose) {
      issues.push(
        issueOf(
          'QUESTION_WINDOW_TOO_SHORT',
          'warning',
          `The questions deadline is ${days} days before closing; the policy expects ${facts.policy.questionDeadlineDaysBeforeClose}.`,
          'milestones.questions_deadline',
          questions.id,
        ),
      );
    }
  }
  // One warning per milestone and local date: per-lot deadlines on the same day are merged and name their lots.
  const nonWorking = new Map<string, { row: TimetableFacts['milestones'][number]; hint: WorkingDayHint; lots: (number | null)[] }>();
  for (const row of facts.milestones) {
    if (!WORKING_DAY_MILESTONES.includes(row.milestone)) {
      continue;
    }
    const hint = workingDayHint(row.at, facts.timeZone, facts.holidays);
    if (hint.isWorkingDay) {
      continue;
    }
    const key = `${row.milestone}|${hint.localDate}`;
    const lot = row.lotId === null ? null : (row.lotNo ?? null);
    const existing = nonWorking.get(key);
    if (existing === undefined) {
      nonWorking.set(key, { row, hint, lots: [lot] });
    } else {
      existing.lots.push(lot);
    }
  }
  for (const { row, hint, lots } of nonWorking.values()) {
    const why = hint.reason === 'holiday' ? `a public holiday (${hint.holidayName ?? ''})` : 'a weekend';
    const next = hint.nextWorkingDate === null ? '' : `; the next working day is ${formatDateText(hint.nextWorkingDate)}`;
    issues.push(
      issueOf(
        'NON_WORKING_DAY',
        'warning',
        `The ${row.milestone.replace(/_/g, ' ')}${scopeText(lots)} falls on ${why}, ${formatDateText(hint.localDate)}${next}.`,
        `milestones.${row.milestone}`,
        row.id,
      ),
    );
  }
  if (facts.openingMode === 'staged' && facts.envelopeCount < 2) {
    issues.push(issueOf('STAGED_OPENING_ENVELOPES', 'blocking', 'Staged opening needs at least two envelopes.', 'envelopes'));
  }
  return issues;
}
