import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, callsTo, renderPage, routeCalls } from '../../tasks/test/kit';
import {
  notification,
  notificationSummary,
  page,
  preferences,
} from '../../tasks/test/workspaceData';
import NotificationCenterPage from './NotificationCenterPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/me/notifications', route: '/me/notifications' };
const SUPPLIER = { ...PATH, kind: 'supplier' as const, capacity: 'Bid Manager' };

describe('NotificationCenterPage (COM-06)', () => {
  it('lists unread notices with their official deadline and required acknowledgment', async () => {
    const calls = routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () => page([notification()]),
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    expect(await screen.findByText('Invitation to respond: T-2026-0006')).toBeInTheDocument();
    expect(screen.getByText('Acknowledgment required')).toBeInTheDocument();
    expect(screen.getByText('Terms not accepted')).toBeInTheDocument();
    expect(screen.getAllByText(/Africa\/Gaborone/).length).toBeGreaterThan(0);
    expect(callsTo(calls, 'me.notifications.list')[0]?.request.query).toMatchObject({
      unread: true,
    });
  });

  it('marks a notice read without acknowledging it (BR-41)', async () => {
    const calls = routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () => page([notification()]),
      'me.notifications.markRead': () => notification({ readAt: '2026-10-02T08:00:00Z' }),
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as read' }));
    expect(
      await screen.findByText('Marked as read. This does not acknowledge the notice.'),
    ).toBeInTheDocument();
    expect(callsTo(calls, 'me.notifications.markRead')[0]?.options).toMatchObject({ tenantId: 4 });
    expect(callsTo(calls, 'me.notifications.acknowledge')).toHaveLength(0);
    expect(screen.getByText('Acknowledgment required')).toBeInTheDocument();
  });

  it('acknowledges and separately accepts the terms when chosen', async () => {
    const calls = routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () => page([notification()]),
      'me.notifications.acknowledge': () =>
        notification({
          readAt: '2026-10-02T08:00:00Z',
          acknowledgedAt: '2026-10-02T08:00:00Z',
          termsAcceptedAt: '2026-10-02T08:00:00Z',
        }),
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Tsodilo Engineering')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Also accept the terms/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(callsTo(calls, 'me.notifications.acknowledge')).toHaveLength(1));
    expect(callsTo(calls, 'me.notifications.acknowledge')[0]?.request).toMatchObject({
      body: { acceptTerms: true },
    });
    expect(await screen.findByText(/Terms accepted/)).toBeInTheDocument();
  });

  it('explains when the member may not acknowledge for the organization', async () => {
    routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () => page([notification()]),
      'me.notifications.acknowledge': () => {
        throw businessError('me.notifications.acknowledge', 'ACKNOWLEDGMENT_NOT_AUTHORIZED', 403);
      },
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Acknowledge' }));
    expect(
      await within(dialog).findByText(/You may not acknowledge formal notices/),
    ).toBeInTheDocument();
  });

  it('shows who handles the acknowledgment instead of a button the member may not use (DD-23)', async () => {
    const calls = routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () =>
        page([notification({ canAcknowledge: false, acknowledgeBlockedReason: 'not_authorized' })]),
    });
    renderPage(<NotificationCenterPage />, { ...SUPPLIER, capacity: 'Contributor' });
    expect(await screen.findByText('Handled by your bid manager')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    expect(screen.getByText('Acknowledgment required')).toBeInTheDocument();
    expect(callsTo(calls, 'me.notifications.acknowledge')).toHaveLength(0);
  });

  it('shows a failed delivery and that the deadline is unchanged (BR-42)', async () => {
    routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () =>
        page([
          notification({
            deliveries: [
              { channel: 'in_app', status: 'delivered', attemptedAt: null, failureReason: null },
              {
                channel: 'email',
                status: 'failed',
                attemptedAt: '2026-10-01T08:00:00Z',
                failureReason: 'Mailbox unavailable',
              },
            ],
          }),
        ]),
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    expect(await screen.findByText(/Mailbox unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/The deadline is unchanged/)).toBeInTheDocument();
  });

  it('marks everything read and says acknowledgments did not change', async () => {
    routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () => page([notification()]),
      'me.notifications.markAllRead': () => ({
        updated: 1,
        summary: notificationSummary({ unread: 0 }),
      }),
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    await screen.findByText('Invitation to respond: T-2026-0006');
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(
      await screen.findByText('1 notification marked as read. Acknowledgments were not changed.'),
    ).toBeInTheDocument();
  });

  it('locks mandatory notices in the preferences and saves only the changes', async () => {
    const calls = routeCalls({
      'me.notifications.summary': () => notificationSummary(),
      'me.notifications.list': () => page([]),
      'me.notifications.preferences': () => preferences(),
      'me.notifications.updatePreferences': () => preferences(),
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    fireEvent.click(await screen.findByRole('tab', { name: 'Preferences' }));
    const locked = await screen.findByRole('checkbox', {
      name: 'Deliver Tender issued in the app',
    });
    expect(locked).toBeDisabled();
    expect(locked).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email Closing approaching' }));
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await waitFor(() =>
      expect(callsTo(calls, 'me.notifications.updatePreferences')).toHaveLength(1),
    );
    expect(callsTo(calls, 'me.notifications.updatePreferences')[0]?.request).toEqual({
      body: {
        items: [{ eventType: 'closing_approaching', inApp: true, email: true, digest: 'none' }],
      },
    });
    expect(await screen.findByText('Preferences saved.')).toBeInTheDocument();
  });

  it('shows the empty unread view', async () => {
    routeCalls({
      'me.notifications.summary': () => notificationSummary({ unread: 0 }),
      'me.notifications.list': () => page([]),
    });
    renderPage(<NotificationCenterPage />, SUPPLIER);
    expect(await screen.findByText('You have read everything.')).toBeInTheDocument();
  });
});
