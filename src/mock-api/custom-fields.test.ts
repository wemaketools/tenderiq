/**
 * Custom business fields on the request, tender, qualification application and contract forms (ADM-07, PRD §17.3):
 * each owning domain validates the values a save sends and checks completeness when the record leaves the draft stage.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../contracts/common.js';
import { contractsEndpoints } from '../contracts/contracts.js';
import { qualificationEndpoints } from '../contracts/qualification.js';
import { requestEndpoints } from '../contracts/requests.js';
import { tenderEndpoints } from '../contracts/tenders.js';
import { customFieldRules, supplierVisibleValues } from './custom-fields.js';
import { TENANT_IDS } from './fixtures/platform.js';
import { createTestMockApp } from './testing/index.js';
import type { TestMockApp, TestResponse } from './testing/index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const email = (login: string): string => `${login}@tenderiq.local`;

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', now: () => NOW });
});

function fieldErrors(response: TestResponse): readonly { field: string; code: string }[] {
  return Problem.parse(response.body).errors ?? [];
}

describe('custom field rules', () => {
  it('offers a supplier only the buyer’s supplier-visible and public application fields', () => {
    // Arrange
    const buyerKeys = customFieldRules(TENANT_IDS.kwu, 'qualification_application').map((rule) => rule.key);

    // Act
    const supplierKeys = customFieldRules(TENANT_IDS.kwu, 'qualification_application', 'supplier').map((rule) => rule.key);

    // Assert
    expect(buyerKeys).toContain('assessor_internal_note');
    expect(supplierKeys).not.toContain('assessor_internal_note');
    expect(supplierVisibleValues(TENANT_IDS.kwu, 'qualification_application', { assessor_internal_note: 'x', ppadb_registration_number: 'P-1' })).toEqual({
      ppadb_registration_number: 'P-1',
    });
  });
});

describe('procurement requests (BUY-03)', () => {
  it('refuses a choice outside the list of an additional field with a field error', async () => {
    const response = await api.callAs(email('kagiso.requester'), requestEndpoints.createRequest, {
      tenant: 'kwu',
      body: { title: 'Pump house roof repair', needType: 'new_expenditure', customFields: { business_priority: 'Urgent' } },
    });

    expect(response.status).toBe(422);
    expect(fieldErrors(response)).toContainEqual(expect.objectContaining({ field: 'customFields.business_priority', code: 'CUSTOM_FIELD_INVALID_CHOICE' }));
  });

  it('saves a draft without the required additional fields and returns the values sent', async () => {
    const response = await api.callAs(email('kagiso.requester'), requestEndpoints.createRequest, {
      tenant: 'kwu',
      body: { title: 'Pump house roof repair', needType: 'new_expenditure', customFields: { business_priority: 'High' } },
    });

    expect(response.status).toBe(201);
    expect(requestEndpoints.createRequest.response.parse(response.body).customFields).toEqual({ business_priority: 'High' });
  });

  it('lists a missing required additional field as blocking submission and shows recorded values', async () => {
    const draft = await api.callAs(email('kagiso.requester'), requestEndpoints.getRequest, { tenant: 'kwu', params: { requestId: 7 } });
    const complete = await api.callAs(email('kagiso.requester'), requestEndpoints.getRequest, { tenant: 'kwu', params: { requestId: 14 } });

    const blocking = requestEndpoints.getRequest.response.parse(draft.body).submissionReadiness.filter((item) => item.id.startsWith('customFields.'));
    expect(blocking.map((item) => [item.id, item.status])).toContainEqual(['customFields.funding_vote_code', 'blocking']);
    const detail = requestEndpoints.getRequest.response.parse(complete.body);
    expect(detail.customFields).toMatchObject({ funding_vote_code: 'OPS-2026-0522' });
    expect(detail.submissionReadiness.some((item) => item.id.startsWith('customFields.'))).toBe(false);
  });
});

describe('tenders (BUY-08)', () => {
  it('refuses an additional number field that is not a number', async () => {
    const response = await api.callAs(email('tebogo.officer'), tenderEndpoints.update, {
      tenant: 'kwu',
      params: { tenderId: 12 },
      body: { expectedDraftRevision: 2, customFields: { local_content_target_percent: 'about a third' } },
    });

    expect(response.status).toBe(422);
    expect(fieldErrors(response)).toContainEqual(expect.objectContaining({ field: 'customFields.local_content_target_percent' }));
  });

  it('returns the saved additional values with the updated tender', async () => {
    const response = await api.callAs(email('tebogo.officer'), tenderEndpoints.update, {
      tenant: 'kwu',
      params: { tenderId: 12 },
      body: { expectedDraftRevision: 2, customFields: { local_content_target_percent: '25.00' } },
    });

    expect(response.status).toBe(200);
    expect(tenderEndpoints.update.response.parse(response.body).tender.customFields).toEqual({ local_content_target_percent: '25.00' });
  });
});

describe('qualification applications (SUP-20)', () => {
  it('refuses a buyer-internal field from the supplier and never shows it to the supplier', async () => {
    const refused = await api.callAs(email('gaborone-meter.bidmanager'), qualificationEndpoints.saveSupplierAnswers, {
      tenant: 'gaborone-meter',
      params: { applicationId: 511 },
      body: { answers: [], customFields: { assessor_internal_note: 'Please prioritise.' } },
    });
    const own = await api.callAs(email('tsodilo.bidmanager'), qualificationEndpoints.getSupplierApplication, {
      tenant: 'tsodilo',
      params: { applicationId: 501 },
    });

    expect(refused.status).toBe(422);
    expect(fieldErrors(refused)).toContainEqual(expect.objectContaining({ field: 'customFields.assessor_internal_note', code: 'CUSTOM_FIELD_UNKNOWN' }));
    const detail = qualificationEndpoints.getSupplierApplication.response.parse(own.body);
    expect(detail.customFields).toMatchObject({ ppadb_registration_number: 'PPADB-2.2-04417' });
    expect(Object.keys(detail.customFields ?? {})).not.toContain('assessor_internal_note');
  });

  it('saves supplier-visible values without an answer change', async () => {
    const response = await api.callAs(email('gaborone-meter.bidmanager'), qualificationEndpoints.saveSupplierAnswers, {
      tenant: 'gaborone-meter',
      params: { applicationId: 511 },
      body: { answers: [], customFields: { ppadb_registration_number: 'PPADB-3.1-00731', water_sector_experience_years: '11' } },
    });

    expect(response.status).toBe(200);
    expect(qualificationEndpoints.saveSupplierAnswers.response.parse(response.body).customFields).toEqual({
      ppadb_registration_number: 'PPADB-3.1-00731',
      water_sector_experience_years: '11',
    });
  });
});

describe('contracts (CON-02)', () => {
  it('refuses an additional date field that is not a date', async () => {
    const response = await api.callAs(email('tebogo.officer'), contractsEndpoints.update, {
      tenant: 'kwu',
      params: { contractId: 8 },
      body: { customFields: { commitment_vote_code: 'CAP-2026-0107', site_handover_date: 'next month' } },
    });

    expect(response.status).toBe(422);
    expect(fieldErrors(response)).toContainEqual(expect.objectContaining({ field: 'customFields.site_handover_date', code: 'CUSTOM_FIELD_INVALID_DATE' }));
  });

  it('shows the recorded additional values on the contract', async () => {
    const response = await api.callAs(email('masego.contracts'), contractsEndpoints.get, { tenant: 'kwu', params: { contractId: 1 } });

    expect(contractsEndpoints.get.response.parse(response.body).customFields).toMatchObject({ commitment_vote_code: 'OPS-2026-0930' });
  });
});
