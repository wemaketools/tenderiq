import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { callsTo, renderPage, routeCalls } from '../../tasks/test/kit';
import { documentDetail, myDocument, page } from '../../tasks/test/workspaceData';
import DocumentViewerPage from './DocumentViewerPage';
import MyDocumentsPage from './MyDocumentsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const VIEWER = { path: '/me/documents/:documentId', route: '/me/documents/203' };
const versions = () => ({ items: [documentDetail().currentVersion] });

describe('MyDocumentsPage (COM-07 index)', () => {
  it('distinguishes downloadable originals, redacted copies and view-only documents', async () => {
    routeCalls({
      'me.documents.list': () =>
        page([
          myDocument(),
          myDocument({
            id: 208,
            title: 'Evaluation report — public copy',
            isRedactedCopy: true,
            classification: 'participating_suppliers',
          }),
          myDocument({
            id: 206,
            title: 'Commercial offer',
            classification: 'sealed',
            canDownload: false,
          }),
        ]),
    });
    renderPage(<MyDocumentsPage />, { path: '/me/documents', route: '/me/documents' });
    expect(await screen.findByText('Commercial offer')).toBeInTheDocument();
    const sealedRow = screen.getByText('Commercial offer').closest('tr') as HTMLElement;
    expect(within(sealedRow).getByText('View only')).toBeInTheDocument();
    const copyRow = screen
      .getByText('Evaluation report — public copy')
      .closest('tr') as HTMLElement;
    expect(within(copyRow).getByText('Redacted copy')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Download/ }).length).toBeGreaterThan(0);
  });

  it('filters to redacted copies', async () => {
    const calls = routeCalls({ 'me.documents.list': () => page([myDocument()]) });
    renderPage(<MyDocumentsPage />, { path: '/me/documents', route: '/me/documents' });
    await screen.findAllByText('Technical specification');
    fireEvent.change(screen.getByLabelText('Edition'), { target: { value: 'true' } });
    await waitFor(() =>
      expect(
        callsTo(calls, 'me.documents.list').some(
          (entry) => (entry.request.query as { redactedCopy?: boolean }).redactedCopy === true,
        ),
      ).toBe(true),
    );
  });

  it('shows an empty state', async () => {
    routeCalls({ 'me.documents.list': () => page([]) });
    renderPage(<MyDocumentsPage />, { path: '/me/documents', route: '/me/documents' });
    expect(await screen.findByText('No document is available to you yet.')).toBeInTheDocument();
  });
});

describe('DocumentViewerPage (COM-07)', () => {
  it('shows owner, version, classification and related record with a permitted download', async () => {
    routeCalls({
      'me.documents.get': () => documentDetail(),
      'me.documents.versions': versions,
      'buyer.audit.entityHistory': () => page([]),
    });
    renderPage(<DocumentViewerPage />, VIEWER);
    expect(await screen.findByText(/Version 4 of 4 — spec-v4.docx/)).toBeInTheDocument();
    expect(
      (await screen.findAllByRole('button', { name: /Download spec-v4.docx/ })).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Upload a new version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a redacted copy' })).toBeInTheDocument();
  });

  it('never offers a download of sealed content and says why', async () => {
    routeCalls({
      'me.documents.get': () =>
        documentDetail({
          classification: 'sealed',
          status: 'submitted',
          capabilities: {
            canDownload: false,
            canUploadVersion: false,
            canCreateRedactedCopy: false,
            downloadBlockedReason: 'sealed',
          },
        }),
      'me.documents.versions': versions,
      'buyer.audit.entityHistory': () => page([]),
    });
    renderPage(<DocumentViewerPage />, VIEWER);
    expect(await screen.findByText(/Sealed submission content/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
  });

  it('links a redacted copy to its controlled original', async () => {
    routeCalls({
      'me.documents.get': () =>
        documentDetail({
          id: 208,
          isRedactedCopy: true,
          classification: 'participating_suppliers',
          status: 'redacted',
          redactedFrom: {
            documentId: 207,
            title: 'Evaluation report',
            classification: 'restricted_assessment',
            status: 'approved',
          },
          capabilities: {
            canDownload: true,
            canUploadVersion: false,
            canCreateRedactedCopy: false,
            downloadBlockedReason: null,
          },
        }),
      'me.documents.versions': versions,
      'buyer.audit.entityHistory': () => page([]),
    });
    renderPage(<DocumentViewerPage />, VIEWER);
    expect(
      await screen.findByText(/This is a redacted copy of Evaluation report/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the original' })).toHaveAttribute(
      'href',
      '/me/documents/207',
    );
  });

  it('offers only wider audiences for a redacted copy and asks for the file', async () => {
    routeCalls({
      'me.documents.get': () => documentDetail(),
      'me.documents.versions': versions,
      'buyer.audit.entityHistory': () => page([]),
    });
    renderPage(<DocumentViewerPage />, VIEWER);
    fireEvent.click(await screen.findByRole('button', { name: 'Create a redacted copy' }));
    const dialog = await screen.findByRole('dialog');
    const audience = within(dialog).getByLabelText(/Audience of the copy/);
    const values = within(audience)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);
    expect(values).toEqual(expect.arrayContaining(['public', 'participating_suppliers']));
    expect(values).not.toContain('sealed');
    fireEvent.change(within(dialog).getByLabelText(/Why is this copy released/), {
      target: { value: 'Debrief' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create copy' }));
    expect(await within(dialog).findByText('Choose the redacted file.')).toBeInTheDocument();
  });

  it('names the exact version an approval covered and offers its download, even when a newer one exists', async () => {
    const current = documentDetail().currentVersion;
    const earlier =
      current === null ? null : { ...current, id: 2032, versionNo: 2, fileName: 'spec-v2.docx' };
    routeCalls({
      'me.documents.get': () => documentDetail(),
      'me.documents.versions': () => ({ items: [current, earlier] }),
      'buyer.audit.entityHistory': () => page([]),
    });
    renderPage(<DocumentViewerPage />, { ...VIEWER, route: '/me/documents/203?version=2032' });
    expect(await screen.findByText('You opened version 2 of this document')).toBeInTheDocument();
    expect(
      screen.getByText(/spec-v2.docx .* This is the exact version the linked decision covered/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Version 4 has replaced it since/)).toBeInTheDocument();
    // One download in the banner, one in the version history row.
    expect(screen.getAllByRole('button', { name: /spec-v2.docx/ })).toHaveLength(2);
  });

  it('says so when the linked version is not in the history', async () => {
    routeCalls({
      'me.documents.get': () => documentDetail(),
      'me.documents.versions': versions,
      'buyer.audit.entityHistory': () => page([]),
    });
    renderPage(<DocumentViewerPage />, { ...VIEWER, route: '/me/documents/203?version=9999' });
    expect(await screen.findByText('Version not available')).toBeInTheDocument();
  });

  it('shows the language by name and lists every redacted copy with its full title', async () => {
    const longTitle =
      'Evaluation report — Reservoir rehabilitation works (redacted for debrief of unsuccessful bidders)';
    routeCalls({
      'me.documents.get': () =>
        documentDetail({
          language: 'tn',
          redactedCopies: [
            {
              documentId: 208,
              title: longTitle,
              classification: 'participating_suppliers',
              status: 'redacted',
            },
          ],
        }),
      'me.documents.versions': versions,
      'buyer.audit.entityHistory': () => page([]),
    });
    renderPage(<DocumentViewerPage />, VIEWER);
    expect(await screen.findByText('Tswana')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: longTitle })).toHaveAttribute(
      'href',
      '/me/documents/208',
    );
  });
});
