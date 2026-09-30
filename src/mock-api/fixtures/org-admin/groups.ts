/**
 * Org-admin fixtures: user groups and their members (ADM-04, SUP-04). Group role assignments are in `people.ts`
 * (`ROLE_ASSIGNMENTS` rows with a `groupId`). A deactivated group keeps its history.
 */
import { TENANT_IDS } from '../platform.js';
import { uid } from './refs.js';

export interface FixtureGroupMember {
  readonly userId: number;
  readonly addedAt: string;
  readonly addedByUserId: number | null;
  readonly removedAt: string | null;
}

export interface FixtureGroup {
  readonly groupId: number;
  readonly tenantId: number;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly deactivatedAt: string | null;
  readonly members: readonly FixtureGroupMember[];
}

const added = (login: string | number, at: string, by: string, removedAt: string | null = null): FixtureGroupMember => ({
  userId: typeof login === 'number' ? login : uid(login),
  addedAt: at,
  addedByUserId: uid(by),
  removedAt,
});

export const GROUPS: readonly FixtureGroup[] = Object.freeze([
  {
    groupId: 1, tenantId: TENANT_IDS.kwu, name: 'SCADA evaluation panel (T-2026-0003)',
    description: 'Technical evaluators appointed for the SCADA telemetry upgrade.', active: true,
    createdAt: '2026-08-31T07:00:00Z', deactivatedAt: null,
    members: [
      added('thato.eval', '2026-08-31T07:00:00Z', 'admin.kwu'),
      added('kabo.eval', '2026-08-31T07:00:00Z', 'admin.kwu'),
      added('amantle.eval', '2026-08-31T07:00:00Z', 'admin.kwu'),
      added('sam.dual', '2026-08-31T07:00:00Z', 'admin.kwu', '2026-09-16T08:00:00Z'),
    ],
  },
  {
    groupId: 2, tenantId: TENANT_IDS.kwu, name: 'Bid opening panel',
    description: 'Opening officer and Internal Audit witness for every bid opening.', active: true,
    createdAt: '2026-04-01T07:00:00Z', deactivatedAt: null,
    members: [added('oratile.opener', '2026-04-01T07:00:00Z', 'admin.kwu'), added('goitse.witness', '2026-04-01T07:00:00Z', 'admin.kwu')],
  },
  {
    groupId: 3, tenantId: TENANT_IDS.kwu, name: 'Fleet contract management team',
    description: 'Manages obligations, changes and reviews on C-2026-0001.', active: true,
    createdAt: '2026-06-01T07:00:00Z', deactivatedAt: null,
    members: [added('masego.contracts', '2026-06-01T07:00:00Z', 'admin.kwu'), added(102, '2026-06-01T07:00:00Z', 'admin.kwu')],
  },
  {
    groupId: 4, tenantId: TENANT_IDS.kwu, name: 'Tender committee 2025',
    description: 'Former tender committee, replaced by the Tender Award Committee.', active: false,
    createdAt: '2025-02-01T07:00:00Z', deactivatedAt: '2026-01-31T15:00:00Z',
    members: [
      added('mpho.manager', '2025-02-01T07:00:00Z', 'admin.kwu', '2026-01-31T15:00:00Z'),
      added('dineo.legal', '2025-02-01T07:00:00Z', 'admin.kwu', '2026-01-31T15:00:00Z'),
    ],
  },
  {
    groupId: 5, tenantId: TENANT_IDS.odc, name: 'Works procurement team',
    description: 'Council officers preparing works and services procurements.', active: true,
    createdAt: '2026-03-09T07:00:00Z', deactivatedAt: null,
    members: [added('officer.odc', '2026-03-09T07:00:00Z', 'admin.odc'), added(113, '2026-03-09T07:00:00Z', 'admin.odc')],
  },
  {
    groupId: 6, tenantId: TENANT_IDS.tsodilo, name: 'SCADA bid team',
    description: 'Prepares the SCADA telemetry response for Kalahari Water Utilities.', active: true,
    createdAt: '2026-07-20T07:00:00Z', deactivatedAt: null,
    members: [
      added('tsodilo.bidmanager', '2026-07-20T07:00:00Z', 'tsodilo.admin'),
      added('tsodilo.contributor', '2026-07-20T07:00:00Z', 'tsodilo.admin'),
      added('sam.dual', '2026-07-20T07:00:00Z', 'tsodilo.admin'),
    ],
  },
  {
    groupId: 7, tenantId: TENANT_IDS.tsodilo, name: 'Pumps and dosing pursuit team',
    description: 'Borehole pumps and chlorine dosing pursuits.', active: true,
    createdAt: '2026-05-11T07:00:00Z', deactivatedAt: null,
    members: [
      added('tsodilo.bidmanager', '2026-05-11T07:00:00Z', 'tsodilo.admin'),
      added('tsodilo.signatory', '2026-05-11T07:00:00Z', 'tsodilo.admin'),
      added(121, '2026-05-11T07:00:00Z', 'tsodilo.admin', '2026-09-26T16:00:00Z'),
    ],
  },
  {
    groupId: 8, tenantId: TENANT_IDS['chobe-pipe'], name: 'Valves bid team',
    description: 'Valve and pipe supply responses.', active: true,
    createdAt: '2026-08-10T07:00:00Z', deactivatedAt: null,
    members: [
      added('chobe-pipe.bidmanager', '2026-08-10T07:00:00Z', 'chobe-pipe.admin'),
      added('chobe-pipe.contributor', '2026-08-10T07:00:00Z', 'chobe-pipe.admin'),
      added('sam.dual', '2026-08-10T07:00:00Z', 'chobe-pipe.admin'),
    ],
  },
  {
    groupId: 9, tenantId: TENANT_IDS['serowe-ict'], name: 'Telemetry bid team',
    description: 'SCADA and metering data responses.', active: true,
    createdAt: '2026-07-22T07:00:00Z', deactivatedAt: null,
    members: [added('serowe-ict.bidmanager', '2026-07-22T07:00:00Z', 'serowe-ict.admin'), added('serowe-ict.contributor', '2026-07-22T07:00:00Z', 'serowe-ict.admin')],
  },
  {
    groupId: 10, tenantId: TENANT_IDS['gaborone-meter'], name: 'Meter bid team',
    description: 'Smart meter supply responses.', active: true,
    createdAt: '2026-09-01T07:00:00Z', deactivatedAt: null,
    members: [
      added('gaborone-meter.bidmanager', '2026-09-01T07:00:00Z', 'gaborone-meter.admin'),
      added('gaborone-meter.contributor', '2026-09-01T07:00:00Z', 'gaborone-meter.admin'),
      added(124, '2026-09-01T07:00:00Z', 'gaborone-meter.admin'),
    ],
  },
] satisfies FixtureGroup[]);
