import type { PersonRef } from '@contracts/common';
import type { ClarificationDetail } from '@contracts/opening';

/** The assessors affected by a clarification: who raised it and every merged question, plus earlier recipients. */
export function affectedAssessors(clarification: ClarificationDetail): PersonRef[] {
  const people = [
    clarification.raisedBy,
    ...clarification.consolidated.map((row) => row.raisedBy),
    ...clarification.distributedTo,
  ];
  const seen = new Map<number, PersonRef>();
  for (const person of people) {
    seen.set(person.userId, person);
  }
  return [...seen.values()];
}
