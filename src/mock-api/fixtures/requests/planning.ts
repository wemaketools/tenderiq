/**
 * Procurement plan items and advance notices (docs/plan/demo-storyline.md "Seed plan items for 2026 Q4 and 2027
 * Q1, with two published advance notices"; PRD BUY-05, PUB-06).
 *
 * KWU: ten plan items across FY2026/27 and FY2027/28, a dependency (pipeline extension after the valve programme),
 * an owner over capacity in November 2026, a contract expiry (C-2026-0001) and six advance notices (two published,
 * one incomplete draft, one complete draft whose plan item is not yet scheduled, one complete draft on a scheduled
 * item that can be published (406), one withdrawn). Plan items reference only submitted requests: a draft stays
 * private to its parties (PRD §4.3). ODC: one plan item and a draft notice; its portal
 * does not show advance notices, so nothing of ODC reaches PUB-06.
 *
 * Static data: never mutated at runtime.
 */
import type { Money } from '../../../contracts/common.js';
import type { AdvanceNoticesStatus, PlanItemsStatus, ProcurementRequestsPriority } from '../../../contracts/enums.js';
import { KWU, ODC, USERS, bwp } from './reference.js';

export interface FixturePlanItem {
  readonly id: number;
  readonly tenantId: number;
  readonly title: string;
  readonly projectId: number | null;
  readonly requestId: number | null;
  readonly categoryId: number | null;
  readonly departmentId: number | null;
  readonly ownerUserId: number | null;
  readonly budgetPeriod: string;
  readonly expectedValue: Money | null;
  readonly plannedReleaseDate: string | null;
  readonly plannedAwardDate: string | null;
  readonly resourceDemandDays: number;
  readonly priority: ProcurementRequestsPriority;
  readonly dependsOnId: number | null;
  readonly status: PlanItemsStatus;
  readonly tenderId: number | null;
  /** A contract whose expiry the item prepares for. */
  readonly expiringContractId: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FixtureAdvanceNotice {
  readonly id: number;
  readonly tenantId: number;
  readonly planItemId: number;
  readonly title: string;
  readonly summary: string;
  readonly categoryId: number | null;
  readonly indicativeTiming: string;
  readonly estimatedValueBand: string | null;
  readonly eoiInstructions: string | null;
  readonly status: AdvanceNoticesStatus;
  readonly publishedAt: string | null;
  readonly publishedByUserId: number | null;
  readonly withdrawnReason: string | null;
  readonly updatedAt: string;
}

export const PLAN_ITEMS: readonly FixturePlanItem[] = Object.freeze([
  {
    id: 201,
    tenantId: KWU,
    title: 'Borehole pumps — Lot 2 re-procurement',
    projectId: 1,
    requestId: null,
    categoryId: 2,
    departmentId: 1,
    ownerUserId: USERS.tebogo,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('1450000.00'),
    plannedReleaseDate: '2026-11-09',
    plannedAwardDate: '2027-01-29',
    resourceDemandDays: 18,
    priority: 'high',
    dependsOnId: null,
    status: 'scheduled',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-09-02T08:00:00Z',
    updatedAt: '2026-09-26T08:00:00Z',
  },
  {
    id: 202,
    tenantId: KWU,
    title: 'Pressure-reducing valve replacement',
    projectId: 3,
    requestId: 5,
    categoryId: 3,
    departmentId: 3,
    ownerUserId: USERS.tebogo,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('1770000.00'),
    plannedReleaseDate: '2026-11-16',
    plannedAwardDate: '2027-02-12',
    resourceDemandDays: 15,
    priority: 'high',
    dependsOnId: null,
    status: 'scheduled',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-09-18T15:00:00Z',
    updatedAt: '2026-09-25T09:00:00Z',
  },
  {
    id: 203,
    tenantId: KWU,
    title: 'Northern wellfield pipeline extension',
    projectId: 3,
    requestId: 3,
    categoryId: 3,
    departmentId: 3,
    ownerUserId: USERS.tebogo,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('4850000.00'),
    plannedReleaseDate: '2027-01-18',
    plannedAwardDate: '2027-04-16',
    resourceDemandDays: 22,
    priority: 'critical',
    dependsOnId: 202,
    status: 'scheduled',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-09-29T07:00:00Z',
  },
  {
    id: 204,
    tenantId: KWU,
    title: 'Laboratory water quality analysers',
    projectId: null,
    requestId: 4,
    categoryId: 8,
    departmentId: 4,
    ownerUserId: USERS.tebogo,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('780000.00'),
    plannedReleaseDate: '2027-02-15',
    plannedAwardDate: '2027-03-26',
    resourceDemandDays: 10,
    priority: 'normal',
    dependsOnId: null,
    status: 'planned',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-09-11T08:00:00Z',
    updatedAt: '2026-09-24T10:30:00Z',
  },
  {
    id: 205,
    tenantId: KWU,
    title: 'Water treatment chemicals framework',
    projectId: null,
    requestId: null,
    categoryId: 5,
    departmentId: 1,
    ownerUserId: USERS.tebogo,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('3200000.00'),
    plannedReleaseDate: '2026-10-26',
    plannedAwardDate: '2027-01-15',
    resourceDemandDays: 20,
    priority: 'high',
    dependsOnId: null,
    status: 'in_progress',
    tenderId: 5,
    expiringContractId: null,
    createdAt: '2026-06-15T08:00:00Z',
    updatedAt: '2026-09-28T12:00:00Z',
  },
  {
    id: 206,
    tenantId: KWU,
    title: 'Acoustic leak detection services',
    projectId: 2,
    requestId: null,
    categoryId: 11,
    departmentId: 2,
    ownerUserId: USERS.tebogo,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('2600000.00'),
    plannedReleaseDate: '2026-07-06',
    plannedAwardDate: '2026-11-30',
    resourceDemandDays: 12,
    priority: 'high',
    dependsOnId: null,
    status: 'released',
    tenderId: 9,
    expiringContractId: null,
    createdAt: '2026-05-10T08:00:00Z',
    updatedAt: '2026-07-06T08:00:00Z',
  },
  {
    id: 207,
    tenantId: KWU,
    title: 'Fleet maintenance re-competition (contingency)',
    projectId: null,
    requestId: null,
    categoryId: 6,
    departmentId: 7,
    ownerUserId: USERS.mpho,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('2100000.00'),
    plannedReleaseDate: '2027-01-11',
    plannedAwardDate: '2027-03-19',
    resourceDemandDays: 14,
    priority: 'normal',
    dependsOnId: null,
    status: 'planned',
    tenderId: null,
    expiringContractId: 1,
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-09-20T08:00:00Z',
  },
  {
    id: 208,
    tenantId: KWU,
    title: 'Solar power for remote boreholes',
    projectId: 1,
    requestId: 11,
    categoryId: 12,
    departmentId: 1,
    ownerUserId: null,
    budgetPeriod: 'FY2027/28',
    expectedValue: bwp('2400000.00'),
    plannedReleaseDate: '2027-05-03',
    plannedAwardDate: '2027-07-30',
    resourceDemandDays: 16,
    priority: 'normal',
    dependsOnId: null,
    status: 'deferred',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-06-02T08:00:00Z',
    updatedAt: '2026-06-24T15:30:00Z',
  },
  {
    id: 209,
    tenantId: KWU,
    title: 'Customer contact centre telephony refresh',
    projectId: null,
    requestId: null,
    categoryId: 10,
    departmentId: 5,
    ownerUserId: null,
    budgetPeriod: 'FY2027/28',
    expectedValue: null,
    plannedReleaseDate: null,
    plannedAwardDate: null,
    resourceDemandDays: 8,
    priority: 'low',
    dependsOnId: null,
    status: 'planned',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-09-28T08:00:00Z',
    updatedAt: '2026-09-28T08:00:00Z',
  },
  {
    id: 210,
    tenantId: KWU,
    title: 'Mobile water tanker hire for drought relief',
    projectId: 3,
    requestId: 13,
    categoryId: 1,
    departmentId: 1,
    ownerUserId: USERS.tebogo,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('1650000.00'),
    plannedReleaseDate: '2026-11-02',
    plannedAwardDate: '2026-12-04',
    resourceDemandDays: 8,
    priority: 'critical',
    dependsOnId: null,
    status: 'scheduled',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-08-28T13:00:00Z',
    updatedAt: '2026-09-21T10:00:00Z',
  },
  {
    id: 301,
    tenantId: ODC,
    title: 'Council vehicle fuel supply',
    projectId: 11,
    requestId: null,
    categoryId: 23,
    departmentId: 11,
    ownerUserId: USERS.officerOdc,
    budgetPeriod: 'FY2026/27',
    expectedValue: bwp('900000.00'),
    plannedReleaseDate: '2026-12-01',
    plannedAwardDate: '2027-02-01',
    resourceDemandDays: 10,
    priority: 'normal',
    dependsOnId: null,
    status: 'scheduled',
    tenderId: null,
    expiringContractId: null,
    createdAt: '2026-09-10T08:00:00Z',
    updatedAt: '2026-09-10T08:00:00Z',
  },
] satisfies FixturePlanItem[]);

export const ADVANCE_NOTICES: readonly FixtureAdvanceNotice[] = Object.freeze([
  {
    id: 401,
    tenantId: KWU,
    planItemId: 202,
    title: 'Pressure-reducing valve replacement — Gaborone West and Tlokweng',
    summary:
      'Kalahari Water Utilities plans to procure the supply and installation of 22 pressure-reducing valves with chambers and data loggers in two Gaborone distribution zones.',
    categoryId: 3,
    indicativeTiming: 'Q4 2026 (tender expected in November)',
    estimatedValueBand: 'BWP 1–2.5 million',
    eoiInstructions:
      'Register on the platform under category WTR-PIPE and send an expression of interest through the buyer’s contact channel by 30 October 2026. An expression of interest is not a bid; the tender will state the conditions to respond.',
    status: 'published',
    publishedAt: '2026-09-25T09:30:00Z',
    publishedByUserId: USERS.tebogo,
    withdrawnReason: null,
    updatedAt: '2026-09-25T09:30:00Z',
  },
  {
    id: 402,
    tenantId: KWU,
    planItemId: 203,
    title: 'Northern wellfield pipeline extension',
    summary:
      'Planned open tender for the supply and laying of about 14 km of 315 mm HDPE pipeline with valve chambers and two road crossings in the northern wellfield corridor.',
    categoryId: 3,
    indicativeTiming: 'Q1 2027 (tender expected in January)',
    estimatedValueBand: 'BWP 2.5–10 million',
    eoiInstructions:
      'Contractors with pipeline experience may register under category WTR-PIPE. A site briefing is planned after release; its date will be announced in the tender notice.',
    status: 'published',
    publishedAt: '2026-09-29T08:00:00Z',
    publishedByUserId: USERS.tebogo,
    withdrawnReason: null,
    updatedAt: '2026-09-29T08:00:00Z',
  },
  {
    id: 403,
    tenantId: KWU,
    planItemId: 204,
    title: 'Laboratory water quality analysers',
    summary: 'Planned procurement of two multi-parameter laboratory analysers with installation, training and calibration support.',
    categoryId: 8,
    indicativeTiming: 'Q1 2027',
    estimatedValueBand: 'BWP 0.5–1 million',
    eoiInstructions: null,
    status: 'draft',
    publishedAt: null,
    publishedByUserId: null,
    withdrawnReason: null,
    updatedAt: '2026-09-24T11:00:00Z',
  },
  {
    id: 404,
    tenantId: KWU,
    planItemId: 208,
    title: 'Solar power for remote boreholes',
    summary: 'Planned design, supply and installation of solar pumping systems at 22 remote boreholes.',
    categoryId: 12,
    indicativeTiming: 'Q2 2027',
    estimatedValueBand: 'BWP 2.5–10 million',
    eoiInstructions: 'Suppliers of solar pumping systems may register under category ENERGY.',
    status: 'withdrawn',
    publishedAt: '2026-06-10T08:00:00Z',
    publishedByUserId: USERS.tebogo,
    withdrawnReason: 'The procurement is deferred to the FY2027/28 budget pending grant confirmation.',
    updatedAt: '2026-06-24T16:00:00Z',
  },
  {
    id: 405,
    tenantId: KWU,
    planItemId: 207,
    title: 'Fleet vehicle maintenance — possible re-competition',
    summary:
      'Depending on the renewal decision on the current fleet maintenance contract, Kalahari Water Utilities may re-compete fleet servicing for about 60 vehicles from April 2027.',
    categoryId: 6,
    indicativeTiming: 'Q1 2027 (only if the current contract is not renewed)',
    estimatedValueBand: 'BWP 1–2.5 million',
    eoiInstructions: 'Workshops able to service light and medium utility vehicles may register under category FLEET-SVC.',
    status: 'draft',
    publishedAt: null,
    publishedByUserId: null,
    withdrawnReason: null,
    updatedAt: '2026-09-26T08:00:00Z',
  },
  {
    id: 406,
    tenantId: KWU,
    planItemId: 201,
    title: 'Borehole pumps — central wellfield (Lot 2) re-procurement',
    summary:
      'Kalahari Water Utilities plans to re-procure the supply and installation of submersible borehole pumps for the central wellfield after Lot 2 of T-2026-0001 was cancelled.',
    categoryId: 2,
    indicativeTiming: 'November 2026 (request for quotations expected mid-November)',
    estimatedValueBand: 'BWP 1–2.5 million',
    eoiInstructions:
      'Pump suppliers may register under category WTR-PUMP and apply for the "Water Infrastructure Suppliers — Category A" qualification before 6 November 2026. An expression of interest is not a bid and gives no right to an award.',
    status: 'draft',
    publishedAt: null,
    publishedByUserId: null,
    withdrawnReason: null,
    updatedAt: '2026-09-29T10:15:00Z',
  },
  {
    id: 411,
    tenantId: ODC,
    planItemId: 301,
    title: 'Council vehicle fuel supply',
    summary: 'Planned supply of diesel and petrol for the council fleet through fuel cards for two years.',
    categoryId: 23,
    indicativeTiming: 'December 2026',
    estimatedValueBand: 'BWP 0.5–1 million',
    eoiInstructions: 'Fuel retailers in the Maun area may register their interest with Council Administration.',
    status: 'draft',
    publishedAt: null,
    publishedByUserId: null,
    withdrawnReason: null,
    updatedAt: '2026-09-12T08:00:00Z',
  },
] satisfies FixtureAdvanceNotice[]);
