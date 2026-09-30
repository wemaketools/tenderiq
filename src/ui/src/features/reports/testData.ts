/**
 * Contract-valid reporting responses for the REP-01, REP-02 and ADM-13 tests (test data only).
 * Captured from the Stage A mock API and parsed with the contract schemas, so a drift fails loudly.
 */
import { pageOf } from '@contracts/common';
import {
  ExportRecord,
  RecipientCandidate,
  ReportDefinition,
  ReportDefinitionRow,
  ReportFamilyCatalog,
  ReportPreview,
  ReportResult,
} from '@contracts/reporting';

export const FAMILIES = ReportFamilyCatalog.parse({
  asOf: '2026-10-07T12:00:00Z',
  currency: 'BWP',
  families: [
    {
      family: 'pipeline',
      title: 'Procurement pipeline',
      description:
        'Planned, approved, active, delayed and awaiting-decision events with their estimated value.',
      questions: 'What is planned, approved, active, delayed, or awaiting a decision?',
      dimensions: [
        'Entity',
        'Department',
        'Category',
        'Owner',
        'Stage',
        'Dates',
        'Estimated value',
      ],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'title',
          label: 'Title',
          kind: 'text',
          description: 'Business title of the record.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'stage',
          label: 'Stage',
          kind: 'status',
          description: 'Current lifecycle stage.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'department',
          label: 'Department',
          kind: 'text',
          description: 'Owning department.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'category',
          label: 'Category',
          kind: 'text',
          description: 'Procurement category.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'owner',
          label: 'Owner',
          kind: 'text',
          description: 'Accountable tender owner (BR-01).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'estimatedValue',
          label: 'Estimated value',
          kind: 'money',
          description: 'Approved estimate; internal budget detail stays buyer-internal.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'daysInStage',
          label: 'Days in stage',
          kind: 'days',
          description: 'Calendar days in the current stage.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'nextMilestone',
          label: 'Next milestone',
          kind: 'text',
          description: 'Next dated milestone or decision.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-10-05T06:00:00Z',
      savedDefinitions: 1,
    },
    {
      family: 'cycle_time',
      title: 'Cycle time and workload',
      description:
        'Where work waits: request-to-release, release-to-close, evaluation, approval, award and handover.',
      questions: 'Where does work wait and who needs support?',
      dimensions: [
        'Request-to-release',
        'Release-to-close',
        'Evaluation',
        'Approval',
        'Award',
        'Handover',
      ],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'title',
          label: 'Title',
          kind: 'text',
          description: 'Business title of the record.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'requestToRelease',
          label: 'Request to release',
          kind: 'days',
          description: 'Calendar days from request approval to release.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'releaseToClose',
          label: 'Release to close',
          kind: 'days',
          description: 'Calendar days from release to the submission deadline.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'evaluationDays',
          label: 'Evaluation',
          kind: 'days',
          description: 'Calendar days from opening to evaluation sign-off.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'approvalDays',
          label: 'Approval',
          kind: 'days',
          description: 'Calendar days awaiting award approval.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'calendarElapsed',
          label: 'Calendar elapsed',
          kind: 'days',
          description: 'Total calendar days so far.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'holdAdjusted',
          label: 'Hold-adjusted',
          kind: 'days',
          description:
            'Elapsed days minus approved holds; shown next to calendar time, never instead of it.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-10-01T06:00:00Z',
      savedDefinitions: 0,
    },
    {
      family: 'participation',
      title: 'Competition and participation',
      description:
        'Invited organizations, registered interest, unique bidders, submitted revisions and compliant bids.',
      questions:
        'How many relevant suppliers were invited, participated, declined, or submitted compliant offers?',
      dimensions: ['Procedure', 'Category', 'Tender', 'Lot', 'No-bid reason'],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'scope',
          label: 'Level',
          kind: 'text',
          description: 'Whole event or the named lot (PRD §15.2).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'invited',
          label: 'Invited organizations',
          kind: 'count',
          description:
            'Organizations formally invited. Not additive: the total counts distinct organizations across events.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'registeredInterest',
          label: 'Registered interest',
          kind: 'count',
          description:
            'Organizations that registered interest or requested access. Not additive: the total counts distinct organizations across events.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'uniqueBidders',
          label: 'Unique bidding organizations',
          kind: 'count',
          description:
            'Distinct organizations with an effective submission; withdrawn and unsubmitted bids do not compete. Not additive: the total counts distinct organizations across events.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'submittedRevisions',
          label: 'Submitted revisions',
          kind: 'count',
          description: 'Official receipts, including superseded revisions.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'compliantBids',
          label: 'Compliant bids',
          kind: 'count',
          description: 'Bids passing the compliance review; missing before opening.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'noBid',
          label: 'Shared no-bid',
          kind: 'count',
          description:
            'Organizations that shared a no-bid decision with the buyer. Not additive: the total counts distinct organizations across events.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-10-04T14:20:00Z',
      savedDefinitions: 1,
    },
    {
      family: 'qualification_risk',
      title: 'Qualification and risk',
      description:
        'Suppliers, documents and conditions needing review, with active-contract exposure.',
      questions: 'Which suppliers, documents, or conditions need review?',
      dimensions: [
        'Program',
        'Scope',
        'Risk',
        'Validity',
        'Assessor',
        'Condition',
        'Active-contract exposure',
      ],
      fields: [
        {
          key: 'supplier',
          label: 'Supplier',
          kind: 'text',
          description: 'Supplier legal name.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'program',
          label: 'Program',
          kind: 'text',
          description: 'Qualification program.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'status',
          description: 'Effective qualification status (buyer-specific, BR-24).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'validTo',
          label: 'Valid to',
          kind: 'date',
          description: 'End of the decision’s validity.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'condition',
          label: 'Condition or review reason',
          kind: 'text',
          description: 'Conditions, expiring evidence or open information requests.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'activeExposure',
          label: 'Active-contract exposure',
          kind: 'money',
          description: 'Value of live contracts with the supplier.',
          sensitivity: 'restricted',
          redactionRule: 'Redacted for viewers without contract.view.',
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-09-30T06:00:00Z',
      savedDefinitions: 0,
    },
    {
      family: 'evaluation_integrity',
      title: 'Evaluation integrity',
      description:
        'Assignment completeness, missing scores, score variance, moderation, conflicts and overrides.',
      questions: 'Are assessments complete and do differences have explanations?',
      dimensions: [
        'Assignment',
        'Missing evidence',
        'Score variance',
        'Moderation',
        'Conflicts',
        'Overrides',
      ],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'scope',
          label: 'Level',
          kind: 'text',
          description: 'Whole event or the named lot (PRD §15.2).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'assignments',
          label: 'Assignments',
          kind: 'count',
          description: 'Evaluator assignments.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'missingScores',
          label: 'Criteria not scored',
          kind: 'count',
          description: 'Criteria without a submitted score (never counted as zero, AC-18).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'maxVariance',
          label: 'Largest score spread',
          kind: 'decimal',
          description: 'Largest difference between evaluators on one criterion.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'moderatedChanges',
          label: 'Moderated changes',
          kind: 'count',
          description: 'Scores changed in moderation (originals preserved, AC-20).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'conflictsDeclared',
          label: 'Conflicts declared',
          kind: 'count',
          description: 'Conflict declarations routed for review.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'overrides',
          label: 'Overrides',
          kind: 'count',
          description: 'Recorded corrections after submission.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-10-02T09:00:00Z',
      savedDefinitions: 1,
    },
    {
      family: 'awards',
      title: 'Awards and commitments',
      description: 'What was awarded, to whom, per lot, against which approved budget.',
      questions: 'What was awarded, to whom, and against which approved budget?',
      dimensions: [
        'Supplier',
        'Legal entity',
        'Category',
        'Lot',
        'Funding',
        'Value',
        'Currency',
        'Date',
      ],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'scope',
          label: 'Level',
          kind: 'text',
          description: 'Whole event or the named lot (PRD §15.2).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'supplier',
          label: 'Supplier',
          kind: 'text',
          description: 'Awarded supplier legal party.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'outcome',
          label: 'Outcome',
          kind: 'status',
          description: 'Lot outcome status.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'recommendedValue',
          label: 'Recommended or intended value',
          kind: 'money',
          description:
            'Value of the recommendation or intent notice. A recommendation or intent is not an award (BR-31).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'awardValue',
          label: 'Final award value',
          kind: 'money',
          description:
            'Value of the final award decision only; missing while only recommended or intended.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'approvedBudget',
          label: 'Approved budget',
          kind: 'money',
          description: 'Approved funding for the event (buyer-internal).',
          sensitivity: 'restricted',
          redactionRule:
            'Redacted for viewers without request.view_all or report.manage or contract.financials.view.',
        },
        {
          key: 'awardDate',
          label: 'Final award date',
          kind: 'date',
          description:
            'Date of the final award decision; an intent notice date is never shown here.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-09-28T06:00:00Z',
      savedDefinitions: 0,
    },
    {
      family: 'commercial_outcomes',
      title: 'Commercial outcomes',
      description: 'Estimate, offer, award and delivery against an approved, dated baseline.',
      questions: 'What changed from estimate to offer, award, and actual delivery?',
      dimensions: [
        'Approved comparison basis',
        'Quantities',
        'Scope',
        'Price effects',
        'Realized results',
      ],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'scope',
          label: 'Level',
          kind: 'text',
          description: 'Whole event or the named lot (PRD §15.2).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'baselineDate',
          label: 'Baseline date',
          kind: 'date',
          description: 'Date of the approved comparison baseline.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'estimate',
          label: 'Approved estimate',
          kind: 'money',
          description: 'Baseline estimate with equivalent quantities and scope.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'offer',
          label: 'Best compliant offer',
          kind: 'money',
          description: 'Lowest evaluated compliant offer.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'award',
          label: 'Award',
          kind: 'money',
          description: 'Awarded value.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'priceReduction',
          label: 'Price reduction',
          kind: 'money',
          description: 'Estimate minus award for the same scope; not a realized saving.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'realizedSavings',
          label: 'Realized savings',
          kind: 'money',
          description: 'Measured after delivery; missing while the contract runs.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: null,
      savedDefinitions: 1,
    },
    {
      family: 'contract_performance',
      title: 'Contract performance',
      description:
        'Obligations, service measures, changes and renewals by supplier and contract owner.',
      questions: 'Are obligations, service measures, changes, and renewals under control?',
      dimensions: [
        'Supplier',
        'Contract owner',
        'Milestone',
        'Period',
        'Risk',
        'Corrective action',
      ],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'title',
          label: 'Title',
          kind: 'text',
          description: 'Business title of the record.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'supplier',
          label: 'Supplier',
          kind: 'text',
          description: 'Supplier legal party.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'status',
          description: 'Contract status.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'obligationsAccepted',
          label: 'Obligations accepted',
          kind: 'count',
          description: 'Obligations and milestones accepted.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'obligationsOverdue',
          label: 'Overdue or rejected',
          kind: 'count',
          description: 'Overdue obligations and rejected evidence.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'changeRequests',
          label: 'Change requests',
          kind: 'count',
          description: 'Change requests raised.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'ceiling',
          label: 'Contract ceiling',
          kind: 'money',
          description: 'Signed contract value.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'invoiced',
          label: 'Invoiced',
          kind: 'money',
          description: 'Invoiced to date (finance source, freshness stated).',
          sensitivity: 'restricted',
          redactionRule: 'Redacted for viewers without contract.financials.view.',
        },
        {
          key: 'paid',
          label: 'Paid',
          kind: 'money',
          description: 'Paid to date.',
          sensitivity: 'restricted',
          redactionRule: 'Redacted for viewers without contract.financials.view.',
        },
        {
          key: 'nextRenewal',
          label: 'Renewal decision due',
          kind: 'date',
          description: 'Next renewal or extension decision date.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-10-01T07:00:00Z',
      savedDefinitions: 1,
    },
    {
      family: 'complaints',
      title: 'Complaints and exceptions',
      description:
        'Challenges and authorized departures with grounds, owner, stage, age, holds and resolution.',
      questions: 'What is challenged or proceeding through an exception?',
      dimensions: [
        'Grounds',
        'Owner',
        'Stage',
        'Age',
        'Resolution',
        'Hold',
        'Authorized departure',
      ],
      fields: [
        {
          key: 'caseRef',
          label: 'Case',
          kind: 'text',
          description: 'Complaint or exception reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'grounds',
          label: 'Grounds',
          kind: 'status',
          description: 'Subject of the complaint.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'stage',
          label: 'Stage',
          kind: 'status',
          description: 'Current stage.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'owner',
          label: 'Owner',
          kind: 'text',
          description: 'Case owner.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'ageDays',
          label: 'Age',
          kind: 'days',
          description: 'Calendar days since receipt.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'hold',
          label: 'Hold',
          kind: 'text',
          description: 'Hold in force and the actions it blocks.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: null,
      savedDefinitions: 0,
    },
    {
      family: 'audit_records',
      title: 'Audit and records',
      description:
        'Whether decisions can be reconstructed and retention duties are met, including legal holds.',
      questions: 'Can decisions be reconstructed and are retention duties being met?',
      dimensions: [
        'Event',
        'Actor',
        'Decision',
        'Version',
        'Disclosure',
        'Retention classification',
        'Legal hold',
      ],
      fields: [
        {
          key: 'reference',
          label: 'Reference',
          kind: 'reference',
          description: 'Event or contract reference.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'title',
          label: 'Title',
          kind: 'text',
          description: 'Business title of the record.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'decisionsRecorded',
          label: 'Decisions recorded',
          kind: 'count',
          description: 'Formal decisions in the audit trail.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'versionsRetained',
          label: 'Versions retained',
          kind: 'count',
          description: 'Immutable snapshots retained (BR-09).',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'disclosures',
          label: 'Disclosures',
          kind: 'count',
          description: 'Public notices and approved disclosures.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'retentionEnds',
          label: 'Retention ends',
          kind: 'date',
          description: 'End of the ordinary retention period.',
          sensitivity: 'normal',
          redactionRule: null,
        },
        {
          key: 'legalHold',
          label: 'Legal hold',
          kind: 'text',
          description: 'Active legal or investigation hold.',
          sensitivity: 'normal',
          redactionRule: null,
        },
      ],
      restricted: false,
      restrictionReason: null,
      lastRunAt: '2026-07-01T08:00:00Z',
      savedDefinitions: 1,
    },
  ],
});

export const PARTICIPATION = ReportResult.parse({
  family: 'participation',
  title: 'Competition and participation',
  description:
    'Invited organizations, registered interest, unique bidders, submitted revisions and compliant bids.',
  asOf: '2026-10-07T12:00:00Z',
  period: {
    from: null,
    to: null,
  },
  levelBasis: {
    level: 'both',
    note: 'Event rows and lot rows are shown separately. Totals use event rows only.',
  },
  currencyBasis: {
    currency: 'BWP',
    conversionDate: null,
    note: 'All amounts are in BWP as recorded; no currency conversion was needed or applied.',
  },
  countingBasis: [
    {
      metric: 'Unique bidding organizations',
      definition:
        'Each organization counts once per event or lot, however many revisions it submitted (AC-34).',
    },
    {
      metric: 'Submitted revisions',
      definition:
        'Official receipts; multiple revisions do not count as additional competing suppliers.',
    },
    {
      metric: 'Event vs lot',
      definition:
        'Event rows count organizations once across all lots; lot rows count them per lot and are never summed into the event.',
    },
    {
      metric: 'Totals',
      definition:
        'Organization counts are not added across events: the totals row shows the number of distinct organizations. Submitted revisions and compliant bids are additive.',
    },
  ],
  completeness: {
    complete: false,
    recordsIncluded: 12,
    recordsWithMissingData: 4,
    notes: [
      'Missing values are shown as missing, never as zero (PRD §15.2).',
      'Not opened: the event is still open.',
      'RFI responses are not assessed for compliance.',
      'Sealed: opening deferred to the next opening committee sitting.',
    ],
  },
  highlights: [
    {
      key: 'rows',
      label: 'Events',
      cell: {
        kind: 'count',
        value: 9,
      },
    },
    {
      key: 'lots',
      label: 'Lot rows (shown separately)',
      cell: {
        kind: 'count',
        value: 3,
      },
    },
    {
      key: 'distinctBidders',
      label: 'Distinct bidding organizations (all events)',
      cell: {
        kind: 'count',
        value: 6,
      },
    },
    {
      key: 'total_invited',
      label: 'Total invited organizations',
      cell: {
        kind: 'count',
        value: 3,
      },
    },
  ],
  columns: [
    {
      key: 'reference',
      label: 'Reference',
      kind: 'reference',
      numeric: false,
    },
    {
      key: 'scope',
      label: 'Level',
      kind: 'text',
      numeric: false,
    },
    {
      key: 'invited',
      label: 'Invited organizations',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'registeredInterest',
      label: 'Registered interest',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'uniqueBidders',
      label: 'Unique bidding organizations',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'submittedRevisions',
      label: 'Submitted revisions',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'compliantBids',
      label: 'Compliant bids',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'noBid',
      label: 'Shared no-bid',
      kind: 'count',
      numeric: true,
    },
  ],
  rows: [
    {
      id: 'pa-1',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Whole event (3 lots)',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 3,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 4,
        },
        compliantBids: {
          kind: 'count',
          value: 2,
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-1-1',
      level: 'lot',
      parentId: 'pa-1',
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Lot 1: Submersible borehole pumps — Central District',
        },
        invited: {
          kind: 'text',
          value: 'Event level only',
        },
        registeredInterest: {
          kind: 'text',
          value: 'Event level only',
        },
        uniqueBidders: {
          kind: 'count',
          value: 2,
        },
        submittedRevisions: {
          kind: 'count',
          value: 3,
        },
        compliantBids: {
          kind: 'count',
          value: 2,
        },
        noBid: {
          kind: 'text',
          value: 'Event level only',
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-1-2',
      level: 'lot',
      parentId: 'pa-1',
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Lot 2: Solar pumping systems — Kgalagadi (cancelled)',
        },
        invited: {
          kind: 'text',
          value: 'Event level only',
        },
        registeredInterest: {
          kind: 'text',
          value: 'Event level only',
        },
        uniqueBidders: {
          kind: 'count',
          value: 2,
        },
        submittedRevisions: {
          kind: 'count',
          value: 2,
        },
        compliantBids: {
          kind: 'count',
          value: 0,
        },
        noBid: {
          kind: 'text',
          value: 'Event level only',
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-1-3',
      level: 'lot',
      parentId: 'pa-1',
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Lot 3: Pump controls and telemetry panels',
        },
        invited: {
          kind: 'text',
          value: 'Event level only',
        },
        registeredInterest: {
          kind: 'text',
          value: 'Event level only',
        },
        uniqueBidders: {
          kind: 'count',
          value: 2,
        },
        submittedRevisions: {
          kind: 'count',
          value: 3,
        },
        compliantBids: {
          kind: 'count',
          value: 2,
        },
        noBid: {
          kind: 'text',
          value: 'Event level only',
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-2',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0002',
          to: '/buyer/tenders/2',
        },
        scope: {
          kind: 'text',
          value: 'Whole event',
        },
        invited: {
          kind: 'count',
          value: 1,
        },
        registeredInterest: {
          kind: 'count',
          value: 5,
        },
        uniqueBidders: {
          kind: 'count',
          value: 2,
        },
        submittedRevisions: {
          kind: 'count',
          value: 3,
        },
        compliantBids: {
          kind: 'missing',
          reason: 'Not opened: the event is still open.',
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/2',
    },
    {
      id: 'pa-3',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0003',
          to: '/buyer/tenders/3',
        },
        scope: {
          kind: 'text',
          value: 'Whole event',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 3,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 3,
        },
        compliantBids: {
          kind: 'count',
          value: 2,
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/3',
    },
    {
      id: 'pa-4',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0004',
          to: '/buyer/tenders/4',
        },
        scope: {
          kind: 'text',
          value: 'Whole event (RFI responses)',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 3,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 3,
        },
        compliantBids: {
          kind: 'missing',
          reason: 'RFI responses are not assessed for compliance.',
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/4',
    },
    {
      id: 'pa-6',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0006',
          to: '/buyer/tenders/6',
        },
        scope: {
          kind: 'text',
          value: 'Whole event (invitation only)',
        },
        invited: {
          kind: 'count',
          value: 2,
        },
        registeredInterest: {
          kind: 'count',
          value: 3,
        },
        uniqueBidders: {
          kind: 'count',
          value: 1,
        },
        submittedRevisions: {
          kind: 'count',
          value: 1,
        },
        compliantBids: {
          kind: 'missing',
          reason: 'Not opened: the event is still open.',
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/6',
    },
    {
      id: 'pa-7',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0007',
          to: '/buyer/tenders/7',
        },
        scope: {
          kind: 'text',
          value: 'Whole event',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 3,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 3,
        },
        compliantBids: {
          kind: 'count',
          value: 3,
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/7',
    },
    {
      id: 'pa-8',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0008',
          to: '/buyer/tenders/8',
        },
        scope: {
          kind: 'text',
          value: 'Whole event (sealed until opening)',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 4,
        },
        uniqueBidders: {
          kind: 'count',
          value: 1,
        },
        submittedRevisions: {
          kind: 'count',
          value: 2,
        },
        compliantBids: {
          kind: 'missing',
          reason: 'Sealed: opening deferred to the next opening committee sitting.',
        },
        noBid: {
          kind: 'count',
          value: 1,
        },
      },
      drillThrough: '/buyer/tenders/8',
    },
    {
      id: 'pa-9',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0009',
          to: '/buyer/tenders/9',
        },
        scope: {
          kind: 'text',
          value: 'Whole event (restricted, two stages)',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 4,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 5,
        },
        compliantBids: {
          kind: 'count',
          value: 3,
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/9',
    },
    {
      id: 'pa-10',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0010',
          to: '/buyer/tenders/10',
        },
        scope: {
          kind: 'text',
          value: 'Whole event',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 2,
        },
        uniqueBidders: {
          kind: 'count',
          value: 2,
        },
        submittedRevisions: {
          kind: 'count',
          value: 2,
        },
        compliantBids: {
          kind: 'count',
          value: 2,
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/10',
    },
  ],
  totals: {
    invited: {
      kind: 'count',
      value: 3,
    },
    registeredInterest: {
      kind: 'count',
      value: 6,
    },
    uniqueBidders: {
      kind: 'count',
      value: 6,
    },
    submittedRevisions: {
      kind: 'count',
      value: 26,
    },
    compliantBids: {
      kind: 'count',
      value: 12,
    },
    noBid: {
      kind: 'count',
      value: 1,
    },
    reference: {
      kind: 'text',
      value: 'Total (9 rows, lots excluded)',
    },
  },
  chart: {
    title: 'Unique bidding organizations per event',
    items: [
      {
        id: 'pa-1',
        label: 'T-2026-0001',
        value: 3,
        display: '3',
      },
      {
        id: 'pa-2',
        label: 'T-2026-0002',
        value: 2,
        display: '2',
      },
      {
        id: 'pa-3',
        label: 'T-2026-0003',
        value: 3,
        display: '3',
      },
      {
        id: 'pa-4',
        label: 'T-2026-0004',
        value: 3,
        display: '3',
      },
      {
        id: 'pa-6',
        label: 'T-2026-0006',
        value: 1,
        display: '1',
      },
      {
        id: 'pa-7',
        label: 'T-2026-0007',
        value: 3,
        display: '3',
      },
      {
        id: 'pa-8',
        label: 'T-2026-0008',
        value: 1,
        display: '1',
      },
      {
        id: 'pa-9',
        label: 'T-2026-0009',
        value: 3,
        display: '3',
      },
      {
        id: 'pa-10',
        label: 'T-2026-0010',
        value: 2,
        display: '2',
      },
    ],
  },
  redactions: [],
});

export const DEFINITIONS = pageOf(ReportDefinitionRow).parse({
  total: 6,
  page: 1,
  pageSize: 25,
  items: [
    {
      id: 4,
      name: 'Audit and records quarterly',
      family: 'audit_records',
      owner: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      audiencePermission: 'audit.view',
      currencyBasis: 'BWP',
      schedule: {
        cron: '0 8 1 1,4,7,10 *',
        description: 'Quarterly on the 1st of Jan, Apr, Jul and Oct at 08:00 (Africa/Gaborone)',
        timeZone: 'Africa/Gaborone',
        nextRunAt: '2027-01-01T06:00:00Z',
      },
      active: true,
      recipientCount: 2,
      lastRunAt: '2026-07-01T06:00:00Z',
      updatedAt: '2026-07-01T08:05:00Z',
    },
    {
      id: 5,
      name: 'Commercial outcomes FY2026',
      family: 'commercial_outcomes',
      owner: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      audiencePermission: 'contract.financials.view',
      currencyBasis: 'BWP',
      schedule: null,
      active: false,
      recipientCount: 1,
      lastRunAt: null,
      updatedAt: '2026-08-14T11:30:00Z',
    },
    {
      id: 3,
      name: 'Contract performance monthly',
      family: 'contract_performance',
      owner: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      audiencePermission: 'contract.view',
      currencyBasis: 'BWP',
      schedule: {
        cron: '0 7 1 * *',
        description: 'On the 1st of every month at 07:00 (Africa/Gaborone)',
        timeZone: 'Africa/Gaborone',
        nextRunAt: '2026-11-01T05:00:00Z',
      },
      active: true,
      recipientCount: 3,
      lastRunAt: '2026-10-01T05:00:00Z',
      updatedAt: '2026-09-30T16:20:00Z',
    },
    {
      id: 6,
      name: 'Evaluation integrity — SCADA telemetry upgrade',
      family: 'evaluation_integrity',
      owner: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      audiencePermission: 'audit.view',
      currencyBasis: 'BWP',
      schedule: null,
      active: true,
      recipientCount: 1,
      lastRunAt: null,
      updatedAt: '2026-10-02T08:50:00Z',
    },
    {
      id: 2,
      name: 'Participation by tender (unique organizations)',
      family: 'participation',
      owner: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      audiencePermission: 'report.view',
      currencyBasis: 'BWP',
      schedule: null,
      active: true,
      recipientCount: 0,
      lastRunAt: '2026-10-04T14:20:00Z',
      updatedAt: '2026-10-04T14:15:00Z',
    },
    {
      id: 1,
      name: 'Weekly pipeline for ExCo',
      family: 'pipeline',
      owner: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      audiencePermission: 'report.view',
      currencyBasis: 'BWP',
      schedule: {
        cron: '0 6 * * 1',
        description: 'Every Monday at 06:00 (Africa/Gaborone)',
        timeZone: 'Africa/Gaborone',
        nextRunAt: '2026-10-12T04:00:00Z',
      },
      active: true,
      recipientCount: 4,
      lastRunAt: '2026-10-05T04:00:00Z',
      updatedAt: '2026-09-02T10:12:00Z',
    },
  ],
});

export const DEFINITION = ReportDefinition.parse({
  id: 1,
  name: 'Weekly pipeline for ExCo',
  family: 'pipeline',
  owner: {
    userId: 4,
    fullName: 'Mpho Dikgang',
  },
  audiencePermission: 'report.view',
  currencyBasis: 'BWP',
  schedule: {
    cron: '0 6 * * 1',
    description: 'Every Monday at 06:00 (Africa/Gaborone)',
    timeZone: 'Africa/Gaborone',
    nextRunAt: '2026-10-12T04:00:00Z',
  },
  active: true,
  recipientCount: 4,
  lastRunAt: '2026-10-05T04:00:00Z',
  updatedAt: '2026-09-02T10:12:00Z',
  fields: ['reference', 'title', 'stage', 'department', 'owner', 'estimatedValue', 'nextMilestone'],
  filters: {
    from: null,
    to: null,
    legalEntityIds: [],
    departmentIds: [],
    categoryIds: [],
    ownerUserIds: [],
    stages: [],
    eventTypes: [],
    level: 'both',
  },
  conversionDate: null,
  recipients: [
    {
      user: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      authorized: true,
      reason: null,
    },
    {
      user: {
        userId: 18,
        fullName: 'Keabetswe Nkwe',
      },
      authorized: true,
      reason: null,
    },
    {
      user: {
        userId: 7,
        fullName: 'Onalenna Tau',
      },
      authorized: true,
      reason: null,
    },
    {
      user: {
        userId: 20,
        fullName: 'Pule Modise',
      },
      authorized: true,
      reason: null,
    },
  ],
  runs: [
    {
      id: 3,
      definitionId: 1,
      runBy: null,
      runAt: '2026-10-05T04:00:00Z',
      rowCount: 11,
      export: {
        id: 3,
        format: 'xlsx',
        status: 'running',
        fileName: null,
      },
      recipients: [
        {
          userId: 4,
          fullName: 'Mpho Dikgang',
        },
        {
          userId: 18,
          fullName: 'Keabetswe Nkwe',
        },
        {
          userId: 7,
          fullName: 'Onalenna Tau',
        },
        {
          userId: 20,
          fullName: 'Pule Modise',
        },
      ],
      excludedRecipients: [],
    },
    {
      id: 2,
      definitionId: 1,
      runBy: null,
      runAt: '2026-09-28T04:00:00Z',
      rowCount: 11,
      export: {
        id: 2,
        format: 'csv',
        status: 'ready',
        fileName: 'pipeline-2026-09-28.csv',
      },
      recipients: [
        {
          userId: 4,
          fullName: 'Mpho Dikgang',
        },
        {
          userId: 18,
          fullName: 'Keabetswe Nkwe',
        },
        {
          userId: 7,
          fullName: 'Onalenna Tau',
        },
        {
          userId: 20,
          fullName: 'Pule Modise',
        },
      ],
      excludedRecipients: [
        {
          user: {
            userId: 21,
            fullName: 'Gaone Letsholo',
          },
          reason:
            'Membership revoked on 18 Sep 2026: no longer authorized when the run was issued.',
        },
      ],
    },
    {
      id: 1,
      definitionId: 1,
      runBy: null,
      runAt: '2026-09-21T04:00:00Z',
      rowCount: 11,
      export: {
        id: 1,
        format: 'csv',
        status: 'ready',
        fileName: 'pipeline-2026-09-21.csv',
      },
      recipients: [
        {
          userId: 4,
          fullName: 'Mpho Dikgang',
        },
        {
          userId: 18,
          fullName: 'Keabetswe Nkwe',
        },
        {
          userId: 7,
          fullName: 'Onalenna Tau',
        },
        {
          userId: 20,
          fullName: 'Pule Modise',
        },
      ],
      excludedRecipients: [],
    },
  ],
  createdAt: '2026-06-01T08:30:00Z',
});

export const EXPORTS = pageOf(ExportRecord).parse({
  total: 9,
  page: 1,
  pageSize: 5,
  items: [
    {
      id: 9,
      exportType: 'evidence_pack',
      format: 'csv',
      status: 'queued',
      scopeDescription: 'Evidence pack — C-2026-0001 change requests',
      subjectType: 'contract',
      subjectId: 1,
      subjectLabel: 'C-2026-0001 Fleet vehicle maintenance',
      reportFamily: null,
      definitionId: null,
      requestedBy: {
        userId: 19,
        fullName: 'Masego Rakgosi',
      },
      requestedAt: '2026-10-05T05:55:00Z',
      completedAt: null,
      error: null,
      documentId: null,
      fileName: null,
      sizeBytes: null,
      manifest: null,
    },
    {
      id: 3,
      exportType: 'report',
      format: 'xlsx',
      status: 'running',
      scopeDescription: 'Weekly pipeline for ExCo — run of 5 Oct 2026',
      subjectType: 'report_definition',
      subjectId: 1,
      subjectLabel: 'Weekly pipeline for ExCo',
      reportFamily: 'pipeline',
      definitionId: 1,
      requestedBy: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      requestedAt: '2026-10-05T04:00:00Z',
      completedAt: null,
      error: null,
      documentId: null,
      fileName: null,
      sizeBytes: null,
      manifest: null,
    },
    {
      id: 4,
      exportType: 'report',
      format: 'csv',
      status: 'ready',
      scopeDescription: 'Participation by tender (unique organizations), 2026',
      subjectType: 'report_definition',
      subjectId: 2,
      subjectLabel: 'Participation by tender (unique organizations)',
      reportFamily: 'participation',
      definitionId: 2,
      requestedBy: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      requestedAt: '2026-10-04T14:20:00Z',
      completedAt: '2026-10-04T14:20:22Z',
      error: null,
      documentId: 7004,
      fileName: 'participation-2026-10-04.csv',
      sizeBytes: 1630,
      manifest: {
        contents: [
          {
            label: 'Competition and participation',
            description:
              'Event rows and lot rows, labelled; unique organizations per event and per lot.',
            recordCount: 12,
          },
        ],
        versions: [
          {
            label: 'Report definition',
            reference: 'Participation by tender (unique organizations)',
            version: 'v1 (15 Sep 2026)',
          },
        ],
        omissions: [
          {
            label: 'Compliance counts for unopened events',
            reason:
              'Shown as missing until the opening gate (T-2026-0002, T-2026-0006, T-2026-0008).',
          },
        ],
        redactions: [
          {
            field: 'Bidder names for sealed events',
            reason: 'Only receipt metadata is available before opening.',
          },
        ],
      },
    },
    {
      id: 8,
      exportType: 'evidence_pack',
      format: 'html',
      status: 'ready',
      scopeDescription: 'Evidence pack — T-2026-0008 closing and receipts',
      subjectType: 'tender',
      subjectId: 8,
      subjectLabel: 'T-2026-0008 Pipeline valves bulk supply',
      reportFamily: null,
      definitionId: null,
      requestedBy: {
        userId: 20,
        fullName: 'Pule Modise',
      },
      requestedAt: '2026-10-01T10:40:00Z',
      completedAt: '2026-10-01T10:41:12Z',
      error: null,
      documentId: 7008,
      fileName: 'evidence-pack-T-2026-0008.html',
      sizeBytes: 21877,
      manifest: {
        contents: [
          {
            label: 'Tender versions and addenda',
            description: 'Issued package and the one addendum.',
            recordCount: 2,
          },
          {
            label: 'Receipt metadata',
            description: 'Receipt numbers, times and the withdrawal record.',
            recordCount: 2,
          },
        ],
        versions: [
          {
            label: 'Tender snapshot',
            reference: 'T-2026-0008',
            version: 'v2 (addendum 1)',
          },
        ],
        omissions: [
          {
            label: 'Bid contents',
            reason: 'Sealed until the opening session on 7 Oct 2026 (BR-17).',
          },
        ],
        redactions: [],
      },
    },
    {
      id: 5,
      exportType: 'report',
      format: 'html',
      status: 'ready',
      scopeDescription: 'Contract performance monthly — run of 1 Oct 2026',
      subjectType: 'report_definition',
      subjectId: 3,
      subjectLabel: 'Contract performance monthly',
      reportFamily: 'contract_performance',
      definitionId: 3,
      requestedBy: {
        userId: 19,
        fullName: 'Masego Rakgosi',
      },
      requestedAt: '2026-10-01T05:00:00Z',
      completedAt: '2026-10-01T05:01:02Z',
      error: null,
      documentId: 7005,
      fileName: 'contract-performance-2026-10.html',
      sizeBytes: 9412,
      manifest: {
        contents: [
          {
            label: 'Contract performance',
            description: 'One row per contract: obligations, changes, ceiling and renewal dates.',
            recordCount: 3,
          },
        ],
        versions: [
          {
            label: 'Report definition',
            reference: 'Contract performance monthly',
            version: 'v2 (30 Sep 2026)',
          },
        ],
        omissions: [
          {
            label: 'Recipient Kagiso Phiri',
            reason: 'Not authorized for the audience permission at issue time.',
          },
        ],
        redactions: [
          {
            field: 'Invoiced and paid amounts',
            reason: 'Requires contract.financials.view.',
          },
        ],
      },
    },
  ],
});

export const EXPORT = ExportRecord.parse({
  id: 4,
  exportType: 'report',
  format: 'csv',
  status: 'ready',
  scopeDescription: 'Participation by tender (unique organizations), 2026',
  subjectType: 'report_definition',
  subjectId: 2,
  subjectLabel: 'Participation by tender (unique organizations)',
  reportFamily: 'participation',
  definitionId: 2,
  requestedBy: {
    userId: 4,
    fullName: 'Mpho Dikgang',
  },
  requestedAt: '2026-10-04T14:20:00Z',
  completedAt: '2026-10-04T14:20:22Z',
  error: null,
  documentId: 7004,
  fileName: 'participation-2026-10-04.csv',
  sizeBytes: 1630,
  manifest: {
    contents: [
      {
        label: 'Competition and participation',
        description:
          'Event rows and lot rows, labelled; unique organizations per event and per lot.',
        recordCount: 12,
      },
    ],
    versions: [
      {
        label: 'Report definition',
        reference: 'Participation by tender (unique organizations)',
        version: 'v1 (15 Sep 2026)',
      },
    ],
    omissions: [
      {
        label: 'Compliance counts for unopened events',
        reason: 'Shown as missing until the opening gate (T-2026-0002, T-2026-0006, T-2026-0008).',
      },
    ],
    redactions: [
      {
        field: 'Bidder names for sealed events',
        reason: 'Only receipt metadata is available before opening.',
      },
    ],
  },
});

export const RECIPIENTS = pageOf(RecipientCandidate).parse({
  total: 4,
  page: 1,
  pageSize: 100,
  items: [
    {
      user: {
        userId: 18,
        fullName: 'Keabetswe Nkwe',
      },
      capacity: 'Chief Executive (Award Approver)',
      authorized: true,
      reason: null,
    },
    {
      user: {
        userId: 19,
        fullName: 'Masego Rakgosi',
      },
      capacity: 'Contract Manager',
      authorized: true,
      reason: null,
    },
    {
      user: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      capacity: 'Procurement Manager',
      authorized: true,
      reason: null,
    },
    {
      user: {
        userId: 7,
        fullName: 'Onalenna Tau',
      },
      capacity: 'Budget Owner, Operations',
      authorized: true,
      reason: null,
    },
  ],
});

export const PREVIEW = ReportPreview.parse({
  family: 'participation',
  scopeDescription: 'Competition and participation: 11 rows for Kalahari Water Utilities (Pilot).',
  estimatedRowCount: 11,
  fields: [
    {
      key: 'reference',
      label: 'Reference',
      included: true,
      redacted: false,
      reason: null,
    },
    {
      key: 'scope',
      label: 'Level',
      included: true,
      redacted: false,
      reason: null,
    },
    {
      key: 'invited',
      label: 'Invited organizations',
      included: true,
      redacted: false,
      reason: null,
    },
    {
      key: 'registeredInterest',
      label: 'Registered interest',
      included: true,
      redacted: false,
      reason: null,
    },
    {
      key: 'uniqueBidders',
      label: 'Unique bidding organizations',
      included: true,
      redacted: false,
      reason: null,
    },
    {
      key: 'submittedRevisions',
      label: 'Submitted revisions',
      included: true,
      redacted: false,
      reason: null,
    },
    {
      key: 'compliantBids',
      label: 'Compliant bids',
      included: true,
      redacted: false,
      reason: null,
    },
    {
      key: 'noBid',
      label: 'Shared no-bid',
      included: true,
      redacted: false,
      reason: null,
    },
  ],
  columns: [
    {
      key: 'reference',
      label: 'Reference',
      kind: 'reference',
      numeric: false,
    },
    {
      key: 'scope',
      label: 'Level',
      kind: 'text',
      numeric: false,
    },
    {
      key: 'invited',
      label: 'Invited organizations',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'registeredInterest',
      label: 'Registered interest',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'uniqueBidders',
      label: 'Unique bidding organizations',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'submittedRevisions',
      label: 'Submitted revisions',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'compliantBids',
      label: 'Compliant bids',
      kind: 'count',
      numeric: true,
    },
    {
      key: 'noBid',
      label: 'Shared no-bid',
      kind: 'count',
      numeric: true,
    },
  ],
  sampleRows: [
    {
      id: 'pa-1',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Whole event (3 lots)',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 5,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 4,
        },
        compliantBids: {
          kind: 'count',
          value: 3,
        },
        noBid: {
          kind: 'count',
          value: 1,
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-1-1',
      level: 'lot',
      parentId: 'pa-1',
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Lot 1: Submersible borehole pumps — Central District',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 4,
        },
        uniqueBidders: {
          kind: 'count',
          value: 2,
        },
        submittedRevisions: {
          kind: 'count',
          value: 3,
        },
        compliantBids: {
          kind: 'count',
          value: 2,
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-1-2',
      level: 'lot',
      parentId: 'pa-1',
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Lot 2: Solar pumping systems — Kgalagadi (cancelled)',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 3,
        },
        uniqueBidders: {
          kind: 'count',
          value: 2,
        },
        submittedRevisions: {
          kind: 'count',
          value: 2,
        },
        compliantBids: {
          kind: 'missing',
          reason: 'Lot cancelled before the compliance review.',
        },
        noBid: {
          kind: 'count',
          value: 0,
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-1-3',
      level: 'lot',
      parentId: 'pa-1',
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0001',
          to: '/buyer/tenders/1',
        },
        scope: {
          kind: 'text',
          value: 'Lot 3: Pump controls and telemetry panels',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 4,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 4,
        },
        compliantBids: {
          kind: 'count',
          value: 3,
        },
        noBid: {
          kind: 'count',
          value: 1,
        },
      },
      drillThrough: '/buyer/tenders/1',
    },
    {
      id: 'pa-2',
      level: 'event',
      parentId: null,
      cells: {
        reference: {
          kind: 'reference',
          value: 'T-2026-0002',
          to: '/buyer/tenders/2',
        },
        scope: {
          kind: 'text',
          value: 'Whole event',
        },
        invited: {
          kind: 'count',
          value: 0,
        },
        registeredInterest: {
          kind: 'count',
          value: 5,
        },
        uniqueBidders: {
          kind: 'count',
          value: 3,
        },
        submittedRevisions: {
          kind: 'count',
          value: 5,
        },
        compliantBids: {
          kind: 'missing',
          reason: 'Not opened: the event is still open.',
        },
        noBid: {
          kind: 'count',
          value: 1,
        },
      },
      drillThrough: '/buyer/tenders/2',
    },
  ],
  redactions: [],
  omissions: [
    'Records you are not authorized to read are excluded and not counted (BR-43).',
    'Each recipient receives only the rows they may read when the report is issued (DD-19).',
    'Bid contents of sealed events are never included; only receipt metadata is counted.',
  ],
  recipients: [],
  currencyBasis: {
    currency: 'BWP',
    conversionDate: null,
    note: 'All amounts are in BWP as recorded; no currency conversion was needed or applied.',
  },
  completeness: {
    complete: false,
    recordsIncluded: 11,
    recordsWithMissingData: 5,
    notes: [
      'Missing values are shown as missing, never as zero (PRD §15.2).',
      'Lot cancelled before the compliance review.',
      'Not opened: the event is still open.',
      'RFI responses are not assessed for compliance.',
      'Sealed: not opened yet (opening 7 Oct 2026).',
    ],
  },
  schedule: null,
});

export const CREATED_DEFINITION = ReportDefinition.parse({
  id: 900,
  name: 'Participation review',
  family: 'participation',
  owner: {
    userId: 4,
    fullName: 'Mpho Dikgang',
  },
  audiencePermission: 'report.view',
  currencyBasis: 'BWP',
  schedule: null,
  active: true,
  recipientCount: 0,
  lastRunAt: null,
  updatedAt: '2026-09-30T05:53:42Z',
  fields: [
    'reference',
    'scope',
    'invited',
    'registeredInterest',
    'uniqueBidders',
    'submittedRevisions',
    'compliantBids',
    'noBid',
  ],
  filters: {
    from: null,
    to: null,
    legalEntityIds: [],
    departmentIds: [],
    categoryIds: [],
    ownerUserIds: [],
    stages: [],
    eventTypes: [],
    level: 'both',
  },
  conversionDate: null,
  recipients: [],
  runs: [],
  createdAt: '2026-09-30T05:53:42Z',
});

export const NEW_DEFINITION_BODY = {
  name: 'Participation review',
  family: 'participation',
  fields: [
    'reference',
    'scope',
    'invited',
    'registeredInterest',
    'uniqueBidders',
    'submittedRevisions',
    'compliantBids',
    'noBid',
  ],
  filters: {
    from: null,
    to: null,
    legalEntityIds: [],
    departmentIds: [],
    categoryIds: [],
    ownerUserIds: [],
    stages: [],
    eventTypes: [],
    level: 'both',
  },
  currencyBasis: 'BWP',
  conversionDate: null,
  audiencePermission: 'report.view',
  scheduleCron: null,
  recipientUserIds: [],
};
