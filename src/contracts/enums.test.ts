import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CHIP_TONES,
  CONTRACT_DEFINED_ENUMS,
  DEFERRED_PROCEDURE,
  ENUMS,
  MANDATORY_NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_RULES_EVENT_TYPE,
  PROCUREMENT_STRATEGIES_PROCEDURE,
  TendersProcedureWrite,
  TendersStatus,
  WRITE_ENUMS,
  enumLabel,
  enumOptions,
  enumTone,
  enumValues,
  humanizeEnumValue,
  isEnumName,
  isEnumValue,
  isMandatoryNotificationEvent,
  toneForValue,
} from './enums.js';
import type { EnumName } from './enums.js';

const BLUEPRINT = readFileSync(new URL('../../docs/plan/schema-blueprint.md', import.meta.url), 'utf8');

/**
 * Every `` `column` CHECK (a, b, c) `` of the blueprint, keyed `table.column`. The table is the nearest preceding
 * bold table header (`**name [T]**`); column lists sometimes continue on the next line.
 */
function blueprintCheckLists(markdown: string): Map<string, string[]> {
  const headers = [...markdown.matchAll(/\*\*([a-z_0-9]+) \[[A-Z]\]/g)].map((match) => ({
    index: match.index,
    table: match[1] ?? '',
  }));
  const lists = new Map<string, string[]>();
  for (const match of markdown.matchAll(/`([a-z_0-9]+)`\s+CHECK\s+\(([a-z0-9_,\s]+)\)/g)) {
    const header = headers.filter((h) => h.index < match.index).pop();
    if (header === undefined) {
      throw new Error(`CHECK list before any table header: ${match[0]}`);
    }
    const key = `${header.table}.${match[1] ?? ''}`;
    if (lists.has(key)) {
      throw new Error(`Duplicate CHECK list for ${key}`);
    }
    lists.set(
      key,
      (match[2] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );
  }
  return lists;
}

const checkLists = blueprintCheckLists(BLUEPRINT);
const enumNames = Object.keys(ENUMS) as EnumName[];

describe('enums mirror the blueprint CHECK lists', () => {
  it('finds the blueprint CHECK lists (the parser still works)', () => {
    expect(checkLists.size).toBeGreaterThan(250);
    expect(checkLists.get('tenders.status')).toContain('awaiting_release_approval');
  });

  it.each([...checkLists.keys()])('defines %s with exactly the blueprint values in the same order', (key) => {
    expect(isEnumName(key)).toBe(true);
    if (isEnumName(key)) {
      expect([...enumValues(key)]).toEqual(checkLists.get(key));
    }
  });

  it('defines no enumeration beyond the blueprint except the contract-defined ones', () => {
    const extra = enumNames.filter((name) => !checkLists.has(name));
    expect(extra.sort()).toEqual([...CONTRACT_DEFINED_ENUMS].sort());
  });

  it('keeps the contract-defined names out of the blueprint CHECK lists', () => {
    for (const name of CONTRACT_DEFINED_ENUMS) {
      expect(checkLists.has(name)).toBe(false);
    }
  });

  it('mirrors tenders.procedure from procurement_strategies.procedure ("as strategies")', () => {
    expect(BLUEPRINT).toMatch(/`procedure` \(as strategies\)/);
    expect([...enumValues('tenders.procedure')]).toEqual(checkLists.get('procurement_strategies.procedure'));
  });

  it('includes the DD-06 and DD-14 additions', () => {
    expect([...enumValues('tenders.award_model')]).toEqual(['single', 'per_lot', 'multiple']);
    expect([...enumValues('job_run.status')]).toEqual(['running', 'succeeded', 'failed']);
    expect(enumValues('approval_requests.subject_type')).toEqual(
      expect.arrayContaining([
        'obligation_waiver',
        'security_release',
        'dispute_decision',
        'contract_difference',
        'final_award',
      ]),
    );
  });

  it('keeps every enumeration non-empty and free of duplicates', () => {
    for (const name of enumNames) {
      const values = enumValues(name);
      expect(values.length).toBeGreaterThan(0);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe('write variants (DD-40)', () => {
  it('keeps framework_calloff in the database lists', () => {
    expect(PROCUREMENT_STRATEGIES_PROCEDURE).toContain(DEFERRED_PROCEDURE);
  });

  it('never offers framework_calloff in a write enum', () => {
    for (const [name, values] of Object.entries(WRITE_ENUMS)) {
      expect(values, name).not.toContain(DEFERRED_PROCEDURE);
      expect(isEnumName(name)).toBe(true);
      if (isEnumName(name)) {
        expect([...values]).toEqual(enumValues(name).filter((v) => v !== DEFERRED_PROCEDURE));
      }
    }
  });

  it('rejects framework_calloff when a write body is parsed', () => {
    expect(TendersProcedureWrite.safeParse('framework_calloff').success).toBe(false);
    expect(TendersProcedureWrite.safeParse('open').success).toBe(true);
  });
});

describe('zod schemas', () => {
  it('parses every value of an enumeration and rejects unknown ones', () => {
    for (const value of enumValues('tenders.status')) {
      expect(TendersStatus.parse(value)).toBe(value);
    }
    expect(TendersStatus.safeParse('published').success).toBe(false);
  });

  it('checks membership through isEnumValue', () => {
    expect(isEnumValue('contracts.status', 'signed_not_effective')).toBe(true);
    expect(isEnumValue('contracts.status', 'signed')).toBe(false);
  });
});

describe('labels', () => {
  it('gives every value of every enumeration a non-empty label', () => {
    for (const name of enumNames) {
      for (const value of enumValues(name)) {
        const label = enumLabel(name, value);
        expect(label.length, `${name}.${value}`).toBeGreaterThan(0);
        expect(label, `${name}.${value}`).not.toContain('_');
      }
    }
  });

  it('humanizes snake_case values and keeps acronyms', () => {
    expect(humanizeEnumValue('awaiting_release_approval')).toBe('Awaiting release approval');
    expect(humanizeEnumValue('rfq')).toBe('RFQ');
    expect(humanizeEnumValue('from_rfi')).toBe('From RFI');
    expect(humanizeEnumValue('in_app')).toBe('In-app');
  });

  it('uses the PRD §8 wording where it differs from the value', () => {
    expect(enumLabel('tenders.status', 'closed')).toBe('Closed / awaiting opening');
    expect(enumLabel('tenders.status', 'award_pending')).toBe('Award decision pending');
    expect(enumLabel('approval_requests.status', 'invalidated')).toBe('Invalidated by change');
    expect(enumLabel('evaluation_assignments.status', 'returned')).toBe('Returned for correction');
    expect(enumLabel('bid_revisions.status', 'late_rejected')).toBe('Late / rejected');
  });

  it('humanizes a value unknown to the enumeration instead of dropping it', () => {
    expect(enumLabel('tenders.status', 'some_future_state')).toBe('Some future state');
  });

  it('lists options in declaration order', () => {
    const options = enumOptions('tasks.priority');
    expect(options.map((o) => o.value)).toEqual(['low', 'normal', 'high', 'urgent']);
    expect(options[3]?.label).toBe('Urgent');
  });
});

describe('StatusChip tones', () => {
  it('gives every value of every enumeration a design-system tone', () => {
    for (const name of enumNames) {
      for (const value of enumValues(name)) {
        expect(CHIP_TONES, `${name}.${value}`).toContain(enumTone(name, value));
      }
    }
  });

  it('distinguishes completed, failed, waiting and in-flight states', () => {
    expect(enumTone('approval_requests.status', 'approved')).toBe('success');
    expect(enumTone('approval_requests.status', 'rejected')).toBe('danger');
    expect(enumTone('approval_requests.status', 'pending')).toBe('warning');
    expect(enumTone('approval_requests.status', 'withdrawn')).toBe('neutral-outlined');
    expect(enumTone('obligations.status', 'overdue')).toBe('danger');
    expect(enumTone('qualification_applications.status', 'under_review')).toBe('info');
    expect(enumTone('tenders.status', 'open')).toBe('accent');
    expect(enumTone('tenders.status', 'draft')).toBe('neutral');
    expect(enumTone('tenders.status', 'awaiting_release_approval')).toBe('warning');
  });

  it('applies prefix and suffix rules to values without an explicit tone', () => {
    expect(toneForValue('awaiting_something')).toBe('warning');
    expect(toneForValue('failed_something')).toBe('danger');
    expect(toneForValue('something_pending')).toBe('warning');
    expect(toneForValue('not_something')).toBe('neutral');
    expect(toneForValue('buyer')).toBe('neutral');
  });
});

describe('notification event types', () => {
  it('marks mandatory formal notices as not mutable', () => {
    expect(isMandatoryNotificationEvent('addendum_issued')).toBe(true);
    expect(isMandatoryNotificationEvent('closing_approaching')).toBe(false);
  });

  it('only marks known event types as mandatory', () => {
    for (const eventType of MANDATORY_NOTIFICATION_EVENT_TYPES) {
      expect(NOTIFICATION_RULES_EVENT_TYPE).toContain(eventType);
    }
  });
});
