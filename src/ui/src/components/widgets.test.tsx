import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ApprovalDetail, ApprovalSummary } from '@contracts/approvals';
import type { AuditEntry } from '@contracts/audit';
import type { DocumentSummary, DocumentVersion } from '@contracts/documents';

import { installFetch, problem } from '../test/fetchMock';
import { makeTenant, makeUser, signedInSession } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { ApprovalStatusPanel } from './approvals/ApprovalStatusPanel';
import { HistoryTimeline } from './audit/HistoryTimeline';
import { ClassificationBadge } from './documents/ClassificationBadge';
import { DocumentList } from './documents/DocumentList';
import { DocumentUploader } from './documents/DocumentUploader';

const HASH = 'b'.repeat(64);
const me = makeUser();

function approval(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return {
    id: 31,
    subjectType: 'tender_release',
    subjectId: 5,
    subjectReference: 'T-2026-0005',
    subjectVersion: 2,
    contentHash: HASH,
    title: 'Release T-2026-0005',
    status: 'pending',
    amount: { amount: '1500000.00', currency: 'BWP' },
    requestedBy: { userId: me.id, fullName: me.fullName },
    requestedAt: '2026-09-20T08:00:00Z',
    dueAt: '2026-10-01T15:00:00Z',
    expiresAt: null,
    decidedAt: null,
    routeMode: 'sequential',
    currentStep: {
      id: 90,
      sequence: 1,
      approver: { userId: 102, fullName: 'Mpho Dikgang' },
      committee: null,
      requiredDecisionType: 'release_approval',
      status: 'pending',
      decidedBy: null,
      actingFor: null,
      delegationId: null,
      decisionReason: null,
      conditions: null,
      decidedAt: null,
      authorityCheckedAmount: null,
    },
    isOverdue: true,
    ...overrides,
  };
}

function detail(): ApprovalDetail {
  const summary = approval();
  return {
    ...summary,
    organization: {
      tenantId: 2,
      tenantName: 'Kalahari Water Utilities (Pilot)',
      tenantKind: 'buyer',
    },
    summary: null,
    justification: 'Ready for release',
    legalEntity: null,
    category: null,
    subjectLinkPath: '/buyer/tenders/5',
    currentSubjectVersion: 2,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    committee: null,
    steps: summary.currentStep === null ? [] : [summary.currentStep],
    evidence: [],
    decisionPermission: 'tender.release_approve',
    conflict: {
      declarationRequired: false,
      declared: false,
      hasConflict: null,
      disposition: null,
      blocksDecision: false,
    },
    sod: { rule: null, mode: null, blocked: false, alternativeOversightNote: null },
    authority: null,
    myStep: null,
    allowedDecisions: [],
  };
}

const panelProps = {
  subjectType: 'tender_release' as const,
  subjectId: 5,
  subjectLabel: 'T-2026-0005 Water treatment chemicals framework',
  requestDefaults: {
    title: 'Release T-2026-0005',
    amount: { amount: '1500000.00', currency: 'BWP' },
  },
};

describe('ApprovalStatusPanel', () => {
  it('shows the pending approval, flags an earlier version (AC-06) and the overdue state, and shows the route', async () => {
    installFetch({
      'GET /api/v1/buyer/approvals/subjects/tender_release/5': () => ({
        body: {
          subjectType: 'tender_release',
          subjectId: 5,
          current: approval(),
          history: [],
          canRequest: true,
        },
      }),
      'GET /api/v1/buyer/approvals/31': () => ({ body: detail() }),
    });
    renderWithProviders(
      <ApprovalStatusPanel
        {...panelProps}
        currentVersion={{ subjectVersion: 3, contentHash: HASH }}
      />,
      { state: { session: signedInSession() } },
    );
    expect(await screen.findByText('Release T-2026-0005')).toBeInTheDocument();
    expect(screen.getByText('This approval is for an earlier version')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('BWP 1,500,000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request approval' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show approval route' }));
    expect(await screen.findByRole('list', { name: 'Approval route' })).toHaveTextContent(
      'Step 1: Mpho Dikgang',
    );
  });

  it('lets the requester withdraw with a reason after the COM-02 confirmation', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/approvals/subjects/tender_release/5': () => ({
        body: {
          subjectType: 'tender_release',
          subjectId: 5,
          current: approval(),
          history: [],
          canRequest: false,
        },
      }),
      'POST /api/v1/buyer/approvals/31/withdraw': () => ({
        body: { ...detail(), status: 'withdrawn' },
      }),
    });
    renderWithProviders(
      <ApprovalStatusPanel
        {...panelProps}
        currentVersion={{ subjectVersion: 2, contentHash: HASH }}
      />,
      { state: { session: signedInSession() } },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    const dialog = screen.getByRole('dialog', { name: 'Withdraw the approval request' });
    expect(within(dialog).getByTestId('confirm-context')).toHaveTextContent('Procurement Officer');
    await userEvent.type(within(dialog).getByLabelText(/Reason for withdrawing/), 'Scope changes');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const withdraw = requests.find((request) => request.path.endsWith('/withdraw'));
    expect(withdraw?.body).toEqual({ reason: 'Scope changes' });
    expect(withdraw?.headers['x-tenant-id']).toBe('2');
  });

  it('requests approval of the exact version with the authority hint (AC-05)', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/approvals/subjects/tender_release/5': () => ({
        body: {
          subjectType: 'tender_release',
          subjectId: 5,
          current: null,
          history: [],
          canRequest: true,
        },
      }),
      'GET /api/v1/buyer/approval-authority-check': () => ({
        body: {
          subjectType: 'tender_release',
          decisionType: 'release_approval',
          amount: { amount: '1500000.00', currency: 'BWP' },
          eligibleApprovers: [
            {
              userId: 103,
              fullName: 'Keabetswe Nkwe',
              capacity: 'Chief Executive',
              check: {
                decisionType: 'release_approval',
                amount: { amount: '1500000.00', currency: 'BWP' },
                sufficient: true,
                basis: 'authority_limit',
                limit: { amount: '10000000.00', currency: 'BWP' },
                delegatedFrom: null,
                conversion: null,
                missingExchangeRate: false,
                routedToNextLevel: false,
              },
            },
          ],
          routedToNextLevel: true,
          skippedLevel: null,
        },
      }),
      'POST /api/v1/buyer/approvals': () => ({ status: 201, body: detail() }),
    });
    renderWithProviders(
      <ApprovalStatusPanel
        {...panelProps}
        currentVersion={{ subjectVersion: 2, contentHash: HASH }}
      />,
      { state: { session: signedInSession() } },
    );
    expect(
      await screen.findByText('No approval has been requested for this record.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Request approval' }));
    const dialog = screen.getByRole('dialog', { name: 'Request approval' });
    expect(
      await within(dialog).findByText(/lacks the authority for this amount/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Keabetswe Nkwe/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Justification/), 'Evaluation complete');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request approval' }));
    await waitFor(() => expect(requests.some((request) => request.method === 'POST')).toBe(true));
    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toMatchObject({
      subjectType: 'tender_release',
      subjectId: 5,
      subjectVersion: 2,
      contentHash: HASH,
      justification: 'Evaluation complete',
      amount: { amount: '1500000.00', currency: 'BWP' },
    });
    expect(post?.headers['idempotency-key']).toBeTruthy();
  });

  it('explains restricted access', async () => {
    installFetch({
      'GET /api/v1/buyer/approvals/subjects/tender_release/5': () => problem(403, 'Forbidden'),
    });
    renderWithProviders(<ApprovalStatusPanel {...panelProps} currentVersion={null} />, {
      state: { session: signedInSession() },
    });
    expect(await screen.findByText('Restricted')).toBeInTheDocument();
  });
});

function version(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: 71,
    documentId: 61,
    versionNo: 2,
    fileName: 'specification.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    sha256: HASH,
    uploadStatus: 'confirmed',
    changeNote: 'Addendum 1 applied',
    supersedesVersionId: null,
    createdAt: '2026-09-10T08:00:00Z',
    createdBy: { userId: me.id, fullName: me.fullName },
    confirmedAt: '2026-09-10T08:01:00Z',
    ...overrides,
  };
}

function documentSummary(): DocumentSummary {
  return {
    id: 61,
    title: 'Technical specification',
    purpose: 'Scope of the SCADA upgrade',
    classification: 'participating_suppliers',
    language: 'en',
    status: 'published',
    relatedType: 'tender',
    relatedId: 3,
    precedence: 1,
    isRedactedCopy: false,
    currentVersion: version(),
    updatedAt: '2026-09-10T08:01:00Z',
  };
}

describe('DocumentList', () => {
  it('lists the documents of a record with classification, version, download and history', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { requests } = installFetch({
      'GET /api/v1/buyer/documents': () => ({
        body: { items: [documentSummary()], total: 1, page: 1, pageSize: 25 },
      }),
      'GET /api/v1/me/documents/61/versions/71/download': () => ({
        body: {
          url: '/api/v1/files/61/71',
          expiresAt: '2026-09-29T09:00:00Z',
          fileName: 'specification.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
          sha256: HASH,
        },
      }),
      'GET /api/v1/me/documents/61/versions': () => ({
        body: { items: [version(), version({ id: 70, versionNo: 1 })] },
      }),
    });
    renderWithProviders(
      <DocumentList audience="buyer" relatedType="tender" relatedId={3} canUpload />,
      {
        state: { session: signedInSession() },
      },
    );
    expect(await screen.findByRole('link', { name: 'Technical specification' })).toHaveAttribute(
      'href',
      '/me/documents/61',
    );
    expect(screen.getByText('Participating suppliers')).toBeInTheDocument();
    expect(requests[0]?.search).toContain('relatedType=tender');
    await userEvent.click(screen.getByRole('button', { name: 'Download specification.pdf' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    const history = await screen.findByRole('dialog', {
      name: 'Version history of Technical specification',
    });
    expect(await within(history).findAllByText('Addendum 1 applied')).toHaveLength(2);
  });

  it('shows the empty state', async () => {
    installFetch({
      'GET /api/v1/supplier/documents': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      }),
    });
    renderWithProviders(
      <DocumentList audience="supplier" relatedType="bid_revision" relatedId={3} />,
      {
        state: {
          session: signedInSession({ activeTenant: makeTenant({ tenantId: 5, kind: 'supplier' }) }),
        },
      },
    );
    expect(await screen.findByText('No documents yet.')).toBeInTheDocument();
  });
});

describe('DocumentUploader', () => {
  it('creates the envelope with the SHA-256, then confirms it (prototype: no byte transfer)', async () => {
    const onUploaded = vi.fn();
    const { requests } = installFetch({
      'POST /api/v1/buyer/documents/uploads': () => ({
        status: 201,
        body: {
          document: documentSummary(),
          version: version({ uploadStatus: 'pending' }),
          upload: {
            url: '/mock-storage/1',
            method: 'PUT',
            headers: {},
            expiresAt: '2026-09-29T09:00:00Z',
          },
        },
      }),
      'POST /api/v1/buyer/documents/uploads/71/confirm': () => ({
        body: { document: documentSummary(), version: version() },
      }),
    });
    renderWithProviders(
      <DocumentUploader
        audience="buyer"
        relatedType="tender"
        relatedId={3}
        defaultClassification="buyer_internal"
        onUploaded={onUploaded}
      />,
      { state: { session: signedInSession() } },
    );
    await userEvent.upload(
      screen.getByLabelText('File'),
      new File(['abc'], 'note.txt', { type: 'text/plain' }),
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    const create = requests.find((request) => request.path === '/api/v1/buyer/documents/uploads');
    expect(create?.body).toMatchObject({
      title: 'note.txt',
      classification: 'buyer_internal',
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      sizeBytes: 3,
    });
    const confirm = requests.find((request) => request.path.endsWith('/confirm'));
    expect(confirm?.body).toEqual({
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      sizeBytes: 3,
    });
  });

  it('binds field errors from the API to the inputs', async () => {
    installFetch({
      'POST /api/v1/buyer/documents/uploads': () =>
        problem(422, 'Validation failed', {
          errors: [
            {
              field: 'classification',
              code: 'CLASSIFICATION_NOT_PERMITTED',
              message: 'Not allowed here.',
            },
          ],
        }),
    });
    renderWithProviders(
      <DocumentUploader
        audience="buyer"
        relatedType="tender"
        relatedId={3}
        defaultClassification="public"
      />,
      { state: { session: signedInSession() } },
    );
    await userEvent.upload(
      screen.getByLabelText('File'),
      new File(['abc'], 'note.txt', { type: 'text/plain' }),
    );
    expect(await screen.findByText('Not allowed here.')).toHaveClass('tiq-field-error');
  });
});

describe('ClassificationBadge', () => {
  it('distinguishes restricted classifications and redacted copies', () => {
    renderWithProviders(<ClassificationBadge classification="sealed" redactedCopy />);
    expect(screen.getByText('Sealed').querySelector('[data-icon="lock"]')).not.toBeNull();
    expect(screen.getByText('Redacted copy')).toBeInTheDocument();
  });
});

function auditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 1,
    occurredAt: '2026-09-20T08:00:00Z',
    actor: { userId: me.id, fullName: me.fullName, capacity: 'Procurement Officer' },
    actorCapacity: 'Procurement Officer',
    onBehalfOf: null,
    delegationId: null,
    supportGrantId: null,
    action: 'tender.published',
    entityType: 'tender',
    entityId: 3,
    reason: 'Approved release',
    beforeState: { status: 'ready' },
    afterState: { status: 'open' },
    correlationId: 'corr-a',
    sensitivity: 'normal',
    redacted: false,
    ...overrides,
  };
}

describe('HistoryTimeline', () => {
  it('shows actions with actor, capacity, reason and changed fields, and restricted rows as metadata only', async () => {
    installFetch({
      'GET /api/v1/buyer/audit/entities/tender/3': () => ({
        body: {
          items: [
            auditEntry(),
            auditEntry({
              id: 2,
              action: 'bid.envelope_opened',
              sensitivity: 'restricted',
              redacted: true,
              reason: null,
              beforeState: null,
              afterState: null,
            }),
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        },
      }),
    });
    renderWithProviders(<HistoryTimeline entityType="tender" entityId={3} />, {
      state: { session: signedInSession() },
    });
    const list = await screen.findByRole('list', { name: 'History' });
    expect(list).toHaveTextContent('Tender published');
    expect(list).toHaveTextContent('Tebogo Molefe · Procurement Officer');
    expect(list).toHaveTextContent('Reason: Approved release');
    expect(list).toHaveTextContent('Changed: status');
    expect(within(list).getByText('Restricted: metadata only')).toBeInTheDocument();
  });

  it('explains when the caller may not read the audit trail', async () => {
    installFetch({ 'GET /api/v1/buyer/audit/entities/tender/3': () => problem(403, 'Forbidden') });
    renderWithProviders(<HistoryTimeline entityType="tender" entityId={3} />, {
      state: { session: signedInSession() },
    });
    expect(await screen.findByText('Restricted')).toBeInTheDocument();
  });
});
