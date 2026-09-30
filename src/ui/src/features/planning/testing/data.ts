/**
 * Planning feature test data (BUY-05, PUB-06).
 * Test data only: contract-valid responses captured from the mock API fixtures, never imported by application code.
 */
import type {
  AdvanceNoticeDetail,
  PlanCalendar,
  PlanItemDetail,
  PublicAdvanceNoticePage,
  PublicPlanSummary,
  ResourceDemand,
} from '@contracts/requests';

export const planItem: PlanItemDetail = {
  id: 203,
  title: 'Northern wellfield pipeline extension',
  project: {
    id: 3,
    reference: 'PP-2026-0003',
    title: 'Network pressure management',
  },
  request: {
    id: 3,
    reference: 'PR-2026-0003',
    title: 'Northern wellfield pipeline extension',
    status: 'under_review',
  },
  category: {
    id: 3,
    code: 'WTR-PIPE',
    name: 'Pipes, valves and fittings',
  },
  department: {
    id: 3,
    code: 'NET',
    name: 'Network Operations',
  },
  owner: {
    userId: 5,
    fullName: 'Tebogo Molefe',
  },
  budgetPeriod: 'FY2026/27',
  expectedValue: {
    amount: '4850000.00',
    currency: 'BWP',
  },
  plannedReleaseDate: '2027-01-18',
  plannedAwardDate: '2027-04-16',
  resourceDemandDays: 22,
  priority: 'critical',
  dependsOn: {
    id: 202,
    title: 'Pressure-reducing valve replacement',
    status: 'scheduled',
  },
  status: 'scheduled',
  tender: null,
  advanceNotice: {
    id: 402,
    title: 'Northern wellfield pipeline extension',
    status: 'published',
  },
  expiringContract: null,
  warnings: ['Tebogo Molefe is over capacity in 2027-01 (22 of 18 days).'],
  dependents: [],
  advanceNotices: [
    {
      id: 402,
      title: 'Northern wellfield pipeline extension',
      status: 'published',
    },
  ],
  createdAt: '2026-09-15T08:00:00Z',
  updatedAt: '2026-09-29T07:00:00Z',
  allowedActions: ['edit', 'defer', 'cancel'],
};

export const notice: AdvanceNoticeDetail = {
  id: 403,
  title: 'Laboratory water quality analysers',
  summary:
    'Planned procurement of two multi-parameter laboratory analysers with installation, training and calibration support.',
  planItem: {
    id: 204,
    title: 'Laboratory water quality analysers',
    status: 'planned',
  },
  category: {
    id: 8,
    code: 'LAB-EQP',
    name: 'Laboratory equipment',
  },
  indicativeTiming: 'Q1 2027',
  estimatedValueBand: 'BWP 0.5–1 million',
  eoiInstructions: null,
  status: 'draft',
  publishedAt: null,
  publishedBy: null,
  publicPath: null,
  updatedAt: '2026-09-24T11:00:00Z',
  withdrawnReason: null,
  publishReadiness: [
    {
      id: 'summary',
      label: 'Summary',
      status: 'passed',
      detail: null,
    },
    {
      id: 'indicativeTiming',
      label: 'Indicative timing',
      status: 'passed',
      detail: null,
    },
    {
      id: 'eoiInstructions',
      label: 'Expression-of-interest instructions',
      status: 'blocking',
      detail: 'Tell suppliers how to express interest.',
    },
    {
      id: 'estimatedValueBand',
      label: 'Estimated value band',
      status: 'passed',
      detail: null,
    },
    {
      id: 'planItem',
      label: 'Plan item scheduled',
      status: 'blocking',
      detail: 'Only scheduled or in-progress plan items can be announced.',
    },
    {
      id: 'portal',
      label: 'Public portal shows advance notices',
      status: 'passed',
      detail: null,
    },
  ],
  portalShowsAdvanceNotices: true,
  allowedActions: ['edit'],
};

export const calendar: PlanCalendar = {
  month: '2026-11',
  timeZone: 'Africa/Gaborone',
  entries: [
    {
      id: 'release-210',
      date: '2026-11-02',
      kind: 'planned_release',
      title: 'Mobile water tanker hire for drought relief',
      reference: null,
      planItemId: 210,
      owner: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
      link: '/buyer/planning/items/210',
    },
    {
      id: 'release-201',
      date: '2026-11-09',
      kind: 'planned_release',
      title: 'Borehole pumps — Lot 2 re-procurement',
      reference: null,
      planItemId: 201,
      owner: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
      link: '/buyer/planning/items/201',
    },
    {
      id: 'release-202',
      date: '2026-11-16',
      kind: 'planned_release',
      title: 'Pressure-reducing valve replacement',
      reference: null,
      planItemId: 202,
      owner: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
      link: '/buyer/planning/items/202',
    },
    {
      id: 'award-206',
      date: '2026-11-30',
      kind: 'planned_award',
      title: 'Acoustic leak detection services',
      reference: 'T-2026-0009',
      planItemId: 206,
      owner: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
      link: '/buyer/planning/items/206',
    },
  ],
  resourceDemand: [
    {
      owner: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
      demandDays: 41,
      capacityDays: 18,
      overAllocated: true,
      itemCount: 3,
    },
  ],
  unscheduledCount: 1,
};

export const demand: ResourceDemand = {
  months: ['2026-10', '2026-11', '2026-12'],
  owners: [
    {
      owner: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      capacityDaysPerMonth: 8,
      months: [
        {
          month: '2026-10',
          demandDays: 0,
          overAllocated: false,
        },
        {
          month: '2026-11',
          demandDays: 0,
          overAllocated: false,
        },
        {
          month: '2026-12',
          demandDays: 0,
          overAllocated: false,
        },
      ],
    },
    {
      owner: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
      capacityDaysPerMonth: 18,
      months: [
        {
          month: '2026-10',
          demandDays: 20,
          overAllocated: true,
        },
        {
          month: '2026-11',
          demandDays: 41,
          overAllocated: true,
        },
        {
          month: '2026-12',
          demandDays: 0,
          overAllocated: false,
        },
      ],
    },
  ],
  unassigned: [
    {
      month: '2026-10',
      demandDays: 0,
    },
    {
      month: '2026-11',
      demandDays: 0,
    },
    {
      month: '2026-12',
      demandDays: 0,
    },
  ],
};

export const publicSummary: PublicPlanSummary = {
  buyers: [
    {
      buyer: {
        slug: 'kwu',
        name: 'Kalahari Water Utilities (Pilot)',
      },
      noticeCount: 2,
      categories: [
        {
          code: 'WTR-PIPE',
          name: 'Pipes, valves and fittings',
          noticeCount: 2,
          timings: [
            'Q4 2026 (tender expected in November)',
            'Q1 2027 (tender expected in January)',
          ],
        },
      ],
      lastPublishedAt: '2026-09-29T08:00:00Z',
    },
  ],
};

export const publicNotices: PublicAdvanceNoticePage = {
  total: 2,
  page: 1,
  pageSize: 25,
  items: [
    {
      id: 402,
      buyer: {
        slug: 'kwu',
        name: 'Kalahari Water Utilities (Pilot)',
      },
      title: 'Northern wellfield pipeline extension',
      summary:
        'Planned open tender for the supply and laying of about 14 km of 315 mm HDPE pipeline with valve chambers and two road crossings in the northern wellfield corridor.',
      category: {
        code: 'WTR-PIPE',
        name: 'Pipes, valves and fittings',
      },
      indicativeTiming: 'Q1 2027 (tender expected in January)',
      estimatedValueBand: 'BWP 2.5–10 million',
      eoiInstructions:
        'Contractors with pipeline experience may register under category WTR-PIPE. A site briefing is planned after release; its date will be announced in the tender notice.',
      planStatus: 'scheduled',
      publishedAt: '2026-09-29T08:00:00Z',
      path: '/plans/kwu/402',
    },
    {
      id: 401,
      buyer: {
        slug: 'kwu',
        name: 'Kalahari Water Utilities (Pilot)',
      },
      title: 'Pressure-reducing valve replacement — Gaborone West and Tlokweng',
      summary:
        'Kalahari Water Utilities plans to procure the supply and installation of 22 pressure-reducing valves with chambers and data loggers in two Gaborone distribution zones.',
      category: {
        code: 'WTR-PIPE',
        name: 'Pipes, valves and fittings',
      },
      indicativeTiming: 'Q4 2026 (tender expected in November)',
      estimatedValueBand: 'BWP 1–2.5 million',
      eoiInstructions:
        'Register on the platform under category WTR-PIPE and send an expression of interest through the buyer’s contact channel by 30 October 2026. An expression of interest is not a bid; the tender will state the conditions to respond.',
      planStatus: 'scheduled',
      publishedAt: '2026-09-25T09:30:00Z',
      path: '/plans/kwu/401',
    },
  ],
};
