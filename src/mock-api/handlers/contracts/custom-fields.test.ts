/**
 * Submitting a draft contract for review with a required contract custom field left empty (CON-02): the handler
 * answers the declared 422 CUSTOM_FIELDS_INCOMPLETE, never an undeclared code that the dispatcher turns into a 500.
 * The stored values of C-2026-0004 are replaced by an empty set so the required "Commitment vote code" is missing.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { contractsEndpoints as api } from '../../../contracts/contracts.js';
import type * as CustomFieldsModule from '../../custom-fields.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

const PUMPS_SPARES = 8;

vi.mock('../../custom-fields.js', async (importOriginal) => {
  const original = await importOriginal<typeof CustomFieldsModule>();
  return {
    ...original,
    customFieldValuesOf: (...args: Parameters<typeof original.customFieldValuesOf>) =>
      args[1] === 'contract' && args[2] === PUMPS_SPARES ? {} : original.customFieldValuesOf(...args),
  };
});

const NOW = new Date('2026-09-30T08:00:00Z');
const TEBOGO = 'tebogo.officer@tenderiq.local';

let app: TestMockApp;

beforeAll(async () => {
  app = await createTestMockApp({ modules: [{ name: 'contracts', register }], now: () => NOW });
});

describe('submit for review with incomplete contract custom fields (CON-02)', () => {
  it('declares CUSTOM_FIELDS_INCOMPLETE on the submit-for-review endpoint', () => {
    expect(api.submitForReview.errors).toContain('CUSTOM_FIELDS_INCOMPLETE');
  });

  it('answers 422 CUSTOM_FIELDS_INCOMPLETE when a required contract field is empty on the draft C-2026-0004', async () => {
    const response = await app.callAs(TEBOGO, api.submitForReview, { tenant: 'kwu', params: { contractId: PUMPS_SPARES } });
    expect(response.status).toBe(422);
    const body = response.body as { code?: string; detail?: string };
    expect(body.code).toBe('CUSTOM_FIELDS_INCOMPLETE');
    expect(body.detail).toContain('Commitment vote code');
  });
});
