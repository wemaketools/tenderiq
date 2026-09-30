/**
 * Tender authoring fixtures (domain 06): the static demo world behind BUY-07..BUY-13. Nothing here is mutated at
 * runtime. Row shapes: `./types.ts`; projections onto the contract: `src/mock-api/handlers/tenders/`.
 */
export * from './types.js';
export * from './reference.js';
export { TENDERS, tenderById } from './tenders.js';
export { LOTS, REQUIREMENTS, TEAM_MEMBERS } from './structure.js';
export { PRICING_SCHEDULES, TENDER_TERMS } from './commercial.js';
export { EVALUATION_PLANS, STANDARD_ANCHORS } from './evaluation.js';
export { ENVELOPES, MILESTONES, PARTICIPATION_CONDITIONS } from './timetable.js';
export {
  AC06_APPROVAL_ID,
  CORRECTIONS,
  MATERIAL_CHANGES,
  PACKAGE_DOCUMENTS,
  RELEASE_APPROVALS,
  RELEASE_CHECKS,
  TENDER_VERSIONS,
} from './release.js';
