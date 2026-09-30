/**
 * Contract-valid response bodies for the help centre tests (test data only; the application's data always comes
 * from the API).
 */
import {
  HelpCentreContacts,
  MyHelpArticleDetail,
  MySupportCaseDetail,
  ServiceNoticeList,
} from '@contracts/operations';

import { makeMembership, signedInSession, stateWith } from '../../test/fixtures';
import { KWU, LORATO, pageOf, supportGrant } from '../ops/testData';

export { pageOf };

/** A person with two organizations (buyer active, supplier as a second membership). */
export function personState() {
  return stateWith(
    signedInSession({
      memberships: [
        makeMembership(),
        makeMembership({
          membershipId: 12,
          tenantId: 4,
          tenantKind: 'supplier',
          tenantName: 'Tsodilo Engineering',
          tenantSlug: 'tsodilo',
          capacity: 'Technical Contributor',
        }),
      ],
    }),
  );
}

export function myArticle(overrides: Partial<MyHelpArticleDetail> = {}) {
  return MyHelpArticleDetail.parse({
    id: 3,
    slug: 'official-deadlines',
    title: 'Official deadlines and time zones',
    topic: 'submission',
    audience: 'all',
    excerpt: 'Every deadline is stated in the official time zone of the event.',
    publishedAt: '2026-06-20T08:00:00Z',
    updatedAt: '2026-06-20T08:00:00Z',
    bodyMarkdown:
      '## What counts\n\nThe official time zone decides.\n\n1. Check the zone\n2. Submit early',
    related: [],
    bindingNote: 'General guidance never overrides the conditions of a particular notice.',
    ...overrides,
  });
}

export function notices() {
  return ServiceNoticeList.parse({
    items: [
      {
        id: 'incident-1',
        kind: 'incident',
        title: 'Slow document uploads',
        body: 'Uploads were slow between 09:45 and 10:25.',
        publishedAt: '2026-09-24T08:05:00Z',
        incidentStatus: 'resolved',
        severity: 'high',
        resolvedAt: '2026-09-24T08:25:00Z',
        affectedOrganizations: [
          { tenantId: 2, tenantName: 'Kalahari Water Utilities (Pilot)', tenantKind: 'buyer' },
        ],
      },
    ],
    distinctionNote: 'Formal tender notices are in the notification centre.',
  });
}

export function contacts() {
  return HelpCentreContacts.parse({
    serviceHours: 'Monday to Friday, 07:30–17:00 (UTC+02:00) Africa/Gaborone',
    submissionPeriodSupport: 'Extended hours on closing days.',
    accessibilityAssistance: 'Request an accommodation from the help centre.',
    incidentEscalation: 'Incidents are announced here and to affected buyers.',
    notASubmissionChannel: 'Support never receives bids.',
    glossary: [
      {
        term: 'Official deadline',
        definition: 'The closing time in the event’s official time zone.',
      },
    ],
  });
}

export function myCase(overrides: Partial<MySupportCaseDetail> = {}) {
  return MySupportCaseDetail.parse({
    id: 1,
    reference: 'SC-2026-0001',
    organization: {
      tenantId: 2,
      tenantName: 'Kalahari Water Utilities (Pilot)',
      tenantKind: 'buyer',
    },
    category: 'access',
    subject: 'Evaluator cannot see the technical criteria',
    status: 'awaiting_customer',
    createdAt: '2026-09-27T08:10:00Z',
    updatedAt: '2026-09-29T11:45:00Z',
    closedAt: null,
    description: 'Kabo sees the tender but the Technical section shows no criteria.',
    resolution: null,
    routedTo: null,
    messages: [
      {
        id: 1001,
        author: LORATO,
        authorSide: 'customer',
        body: 'Kabo sees the tender but no criteria.',
        internal: false,
        createdAt: '2026-09-27T08:10:00Z',
      },
    ],
    grants: [supportGrant({ customer: KWU })],
    ...overrides,
  });
}
