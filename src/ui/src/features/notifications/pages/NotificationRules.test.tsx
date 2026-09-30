import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ADMIN_PERMISSIONS,
  businessError,
  callsTo,
  renderPage,
  routeCalls,
} from '../../tasks/test/kit';
import {
  catalogItem,
  deliveryException,
  page,
  ruleDetail,
  ruleSummary,
} from '../../tasks/test/workspaceData';
import NotificationRuleNewPage from './NotificationRuleNewPage';
import NotificationRulePage from './NotificationRulePage';
import NotificationRulesPage from './NotificationRulesPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const ADMIN = { permissions: ADMIN_PERMISSIONS, capacity: 'Organization Administrator' };

describe('NotificationRulesPage (ADM-12)', () => {
  it('lists rules with recipients, reminders and the mandatory lock', async () => {
    routeCalls({
      'buyer.notificationRules.events': () => ({ items: [catalogItem({ ruleId: null })] }),
      'buyer.notificationRules.list': () =>
        page([
          ruleSummary(),
          ruleSummary({
            id: 5,
            eventType: 'tender_issued',
            category: 'formal_notice',
            mandatory: true,
            mandatoryLocked: true,
            reminderOffsetsHours: [],
          }),
        ]),
      'buyer.notificationRules.deliveryExceptions': () => page([deliveryException()]),
    });
    renderPage(<NotificationRulesPage />, {
      path: '/buyer/admin/notification-rules',
      route: '/buyer/admin/notification-rules',
      ...ADMIN,
    });
    expect(await screen.findByText('7 days, 2 days before')).toBeInTheDocument();
    expect(screen.getByText('Mandatory notice')).toBeInTheDocument();
    expect(screen.getAllByText('Interested supplier users').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'New rule' })).toBeInTheDocument();
  });

  it('shows delivery exceptions with the unchanged deadline and the owner’s task', async () => {
    routeCalls({
      'buyer.notificationRules.events': () => ({ items: [] }),
      'buyer.notificationRules.list': () => page([ruleSummary()]),
      'buyer.notificationRules.deliveryExceptions': () => page([deliveryException()]),
    });
    renderPage(<NotificationRulesPage />, {
      path: '/buyer/admin/notification-rules',
      route: '/buyer/admin/notification-rules',
      ...ADMIN,
    });
    fireEvent.click(await screen.findByRole('tab', { name: /Delivery exceptions/ }));
    expect(await screen.findByText('Mailbox unavailable')).toBeInTheDocument();
    expect(screen.getByText('Owner: Tebogo Molefe')).toBeInTheDocument();
    expect(screen.getByText(/A failed delivery never changes a deadline/)).toBeInTheDocument();
  });
});

describe('NotificationRulePage (ADM-12)', () => {
  const PATH = {
    path: '/buyer/admin/notification-rules/:ruleId',
    route: '/buyer/admin/notification-rules/16',
    ...ADMIN,
  };

  it('saves changed templates with the change note', async () => {
    const calls = routeCalls({
      'buyer.notificationRules.get': () => ruleDetail(),
      'buyer.notificationRules.events': () => ({ items: [catalogItem()] }),
      'buyer.notificationRules.update': () =>
        ruleDetail({ subjectTemplate: 'Closing soon: {{recordReference}}' }),
    });
    renderPage(<NotificationRulePage />, PATH);
    const subject = await screen.findByRole('textbox', { name: /Subject template/ });
    fireEvent.change(subject, { target: { value: 'Closing soon: {{recordReference}}' } });
    expect(screen.getByText('You have unsaved changes to this rule.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Why are you changing this rule/), {
      target: { value: 'Shorter subject' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(callsTo(calls, 'buyer.notificationRules.update')).toHaveLength(1));
    expect(callsTo(calls, 'buyer.notificationRules.update')[0]?.request).toMatchObject({
      params: { ruleId: 16 },
      body: {
        subjectTemplate: 'Closing soon: {{recordReference}}',
        reminderOffsetsHours: [168, 48],
        changeNote: 'Shorter subject',
      },
    });
    expect(await screen.findByText('Rule saved.')).toBeInTheDocument();
  });

  it('refuses a confidential placeholder with a clear message', async () => {
    routeCalls({
      'buyer.notificationRules.get': () => ruleDetail(),
      'buyer.notificationRules.events': () => ({ items: [catalogItem()] }),
      'buyer.notificationRules.update': () => {
        throw businessError(
          'buyer.notificationRules.update',
          'CONFIDENTIAL_PLACEHOLDER_NOT_ALLOWED',
          422,
        );
      },
    });
    renderPage(<NotificationRulePage />, PATH);
    fireEvent.change(await screen.findByRole('textbox', { name: /Subject template/ }), {
      target: { value: '{{bidPrice}}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }));
    expect(
      (await screen.findAllByText(/A template uses confidential content/)).length,
    ).toBeGreaterThan(0);
  });

  it('cannot deactivate a mandatory notice', async () => {
    routeCalls({
      'buyer.notificationRules.get': () =>
        ruleDetail({ mandatory: true, mandatoryLocked: true, eventType: 'tender_issued' }),
      'buyer.notificationRules.events': () => ({ items: [] }),
    });
    renderPage(<NotificationRulePage />, PATH);
    expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Mandatory notice' })).toBeDisabled();
  });

  it('previews the templates and reports confidential placeholders', async () => {
    routeCalls({
      'buyer.notificationRules.get': () => ruleDetail(),
      'buyer.notificationRules.events': () => ({ items: [catalogItem()] }),
      'buyer.notificationRules.preview': () => ({
        eventType: 'closing_approaching',
        subject: 'T-2026-0002 closes on 14 Oct 2026',
        body: 'Reminder',
        emailSubject: 'T-2026-0002 closes',
        emailBody: 'Open TenderIQ',
        usedPlaceholders: ['recordReference'],
        unknownPlaceholders: [],
        confidentialPlaceholders: ['bidPrice'],
        sampleDeadline: null,
      }),
    });
    renderPage(<NotificationRulePage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('T-2026-0002 closes on 14 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText(/Confidential placeholders: bidPrice/)).toBeInTheDocument();
  });
});

describe('NotificationRuleNewPage (ADM-12)', () => {
  it('creates a rule for an event without one and opens it', async () => {
    const calls = routeCalls({
      'buyer.notificationRules.events': () => ({
        items: [catalogItem({ ruleId: null, eventType: 'evidence_expiring' })],
      }),
      'buyer.notificationRules.create': () =>
        ruleDetail({ id: 900, eventType: 'evidence_expiring' }),
    });
    const { router } = renderPage(<NotificationRuleNewPage />, {
      path: '/buyer/admin/notification-rules/new',
      route: '/buyer/admin/notification-rules/new',
      ...ADMIN,
    });
    fireEvent.change(await screen.findByLabelText(/^Event/), {
      target: { value: 'evidence_expiring' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create rule' }));
    expect(await screen.findByText('The subject template is required.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Subject template/ }), {
      target: { value: '{{recordReference}} evidence expires' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Message template/ }), {
      target: { value: 'Renew the evidence.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create rule' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create rule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/admin/notification-rules/900'),
    );
    expect(callsTo(calls, 'buyer.notificationRules.create')[0]?.request).toMatchObject({
      body: { eventType: 'evidence_expiring', recipientRoles: ['interested_supplier_users'] },
    });
  });
});
