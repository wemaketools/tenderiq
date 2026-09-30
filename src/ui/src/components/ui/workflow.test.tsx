import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMyTaskSummary } from '@contracts/tasks';

import { ApiError } from '../../api/client';
import { useApiQuery } from '../../api/hooks';
import { installFetch, problem } from '../../test/fetchMock';
import { makeUser, signedInSession } from '../../test/fixtures';
import { LocationProbe, renderWithProviders } from '../../test/render';
import { FileUpload } from './FileUpload';
import { OfficialDeadline } from './OfficialDeadline';
import { PageHeader } from './PageHeader';
import { PageSlotsContext } from './pageSlots';
import { QueryView } from './QueryView';
import { isReady } from './readiness';
import { ReadinessChecklist } from './ReadinessChecklist';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';

afterEach(() => {
  vi.useRealTimers();
});

describe('OfficialDeadline (BR-11, DD-33)', () => {
  it('always shows the official date, time, offset and IANA zone', () => {
    renderWithProviders(
      <OfficialDeadline deadline={{ at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' }} />,
      {
        state: {
          session: signedInSession({ user: makeUser({ displayTimeZone: 'Africa/Gaborone' }) }),
        },
      },
    );
    const time = screen.getByTestId('official-deadline').querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-10-14T10:00:00Z');
    expect(time?.textContent).toMatch(/^14 Oct 2026, 12:00 \(UTC\+02:00\) Africa\/Gaborone/);
    expect(screen.queryByText(/Your time/)).not.toBeInTheDocument();
  });

  it('adds local-time help for a user in another zone, secondary to the official line', () => {
    renderWithProviders(
      <OfficialDeadline deadline={{ at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' }} />,
      {
        state: {
          session: signedInSession({ user: makeUser({ displayTimeZone: 'Europe/London' }) }),
        },
      },
    );
    expect(screen.getByText('Your time: 14 Oct 2026, 11:00 (UTC+01:00) Europe/London')).toHaveClass(
      'tiq-deadline-local',
    );
  });

  it('never shows the time remaining without the official time', () => {
    vi.useFakeTimers({ now: new Date('2026-10-12T06:00:00Z'), toFake: ['Date'] });
    renderWithProviders(
      <OfficialDeadline
        variant="block"
        label="Submission deadline"
        showRemaining
        deadline={{ at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' }}
      />,
      {
        state: {
          session: signedInSession({ user: makeUser({ displayTimeZone: 'Africa/Gaborone' }) }),
        },
      },
    );
    const block = screen.getByTestId('official-deadline');
    expect(block).toHaveTextContent('Submission deadline');
    expect(block).toHaveTextContent('14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone');
    expect(block).toHaveTextContent('2 d 4 h left');
    expect(block).toHaveClass('tiq-deadline--block');
  });
});

describe('ReadinessChecklist', () => {
  const items = [
    { id: 'p', label: 'Documents attached', status: 'passed' as const },
    { id: 'w', label: 'One optional lot empty', status: 'warning' as const },
    {
      id: 'b',
      label: 'Mandatory declaration missing',
      status: 'blocking' as const,
      detail: 'Sign it on the Declarations tab.',
    },
  ];

  it('orders blocking before warnings before passed checks and summarizes them', () => {
    render(<ReadinessChecklist label="Readiness" items={items} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.map((item) => item.getAttribute('data-status'))).toEqual([
      'blocking',
      'warning',
      'passed',
    ]);
    expect(listItems[0]).toHaveTextContent('Blocking: Mandatory declaration missing');
    expect(screen.getByText('1 blocking')).toHaveClass('tiq-chip--danger');
    expect(screen.getByText('1 warning')).toHaveClass('tiq-chip--warning');
    expect(isReady(items)).toBe(false);
    expect(isReady(items.filter((item) => item.status !== 'blocking'))).toBe(true);
  });
});

describe('FileUpload', () => {
  it('hashes the file with SHA-256 and passes it to the supplied upload function', async () => {
    const onUpload = vi.fn(
      async (_file: File, context: { sha256: string; onProgress: (f: number) => void }) => {
        context.onProgress(0.5);
      },
    );
    render(
      <FileUpload label="Evidence" onUpload={onUpload} accept={['text/plain']} maxBytes={1000} />,
    );
    const file = new File(['abc'], 'note.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText('Evidence'), file);
    await waitFor(() => expect(screen.getByText('Uploaded')).toBeInTheDocument());
    expect(onUpload.mock.calls[0]?.[1].sha256).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('refuses a disallowed type or an oversized file before uploading', async () => {
    const onUpload = vi.fn(() => Promise.resolve());
    render(
      <FileUpload label="Evidence" onUpload={onUpload} accept={['application/pdf']} maxBytes={2} />,
    );
    await userEvent.upload(
      screen.getByLabelText('Evidence'),
      new File(['abc'], 'a.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText(/larger than 2 B/)).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('shows the API reason when the upload is refused', async () => {
    const onUpload = vi.fn(() =>
      Promise.reject(new ApiError({ kind: 'server', status: 500, title: 'x', endpointId: 'x' })),
    );
    render(<FileUpload label="Evidence" onUpload={onUpload} />);
    await userEvent.upload(
      screen.getByLabelText('Evidence'),
      new File(['abc'], 'a.txt', { type: 'text/plain' }),
    );
    expect(await screen.findByText(/Quote the correlation id/)).toBeInTheDocument();
  });
});

describe('UnsavedChangesGuard', () => {
  it('asks before leaving with unsaved changes', async () => {
    renderWithProviders(
      <>
        <UnsavedChangesGuard when />
        <Link to="/elsewhere">leave</Link>
      </>,
      {
        path: '/form',
        route: '/form',
        routes: [{ path: '/elsewhere', element: <LocationProbe label="elsewhere" /> }],
      },
    );
    await userEvent.click(screen.getByRole('link', { name: 'leave' }));
    expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stay on this page' }));
    expect(screen.queryByTestId('location-probe')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'leave' }));
    await userEvent.click(screen.getByRole('button', { name: 'Leave without saving' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent('elsewhere');
  });
});

describe('PageHeader', () => {
  it('portals the title and the primary action into the top bar slots', () => {
    const title = document.createElement('h1');
    const action = document.createElement('div');
    document.body.append(title, action);
    renderWithProviders(
      <PageSlotsContext.Provider value={{ title, primaryAction: action }}>
        <PageHeader
          title="Tenders"
          subtitle="All tenders"
          primaryAction={<button type="button">New tender</button>}
        />
      </PageSlotsContext.Provider>,
    );
    expect(title).toHaveTextContent('Tenders');
    expect(action).toHaveTextContent('New tender');
    expect(screen.getByText('All tenders')).toBeInTheDocument();
    expect(document.title).toBe('Tenders · TenderIQ');
    title.remove();
    action.remove();
  });

  it('renders inline outside the shell', () => {
    renderWithProviders(
      <PageHeader title="Opportunities" primaryAction={<button type="button">Subscribe</button>} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Opportunities' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
  });
});

describe('QueryView', () => {
  function Summary() {
    const query = useApiQuery(getMyTaskSummary, {});
    return (
      <QueryView query={query} isEmpty={(data) => data.open === 0} empty={<p>no tasks</p>}>
        {(data) => <p>{data.open} open</p>}
      </QueryView>
    );
  }

  it('renders loading, then empty or data', async () => {
    installFetch({
      'GET /api/v1/me/task-summary': () => ({
        body: { open: 0, overdue: 0, dueSoon: 0, byOrganization: [] },
      }),
    });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(await screen.findByText('no tasks')).toBeInTheDocument();
  });

  it('renders the restricted state for a 403', async () => {
    installFetch({ 'GET /api/v1/me/task-summary': () => problem(403, 'Forbidden') });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(await screen.findByText('Restricted')).toBeInTheDocument();
    await act(async () => undefined);
  });
});
