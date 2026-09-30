/**
 * Publication fixtures: the supplier-private pursuits (`pursuits`, `pursuit_team_members`, `pursuit_notes`;
 * SUP-09; DD-41). The buyer never reads any of this.
 *
 * Ids: pursuit `supplier tenant * 1000 + tender`, team member `pursuit * 10 + k` (k = 1..4), note
 * `pursuit * 10 + k` (k = 6..9).
 */
import type { PursuitTeamMembersResponsibility, PursuitsDecision } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureTeamMember {
  readonly id: number;
  readonly userId: number;
  readonly responsibility: PursuitTeamMembersResponsibility;
  readonly sectionScope: readonly string[];
  readonly lotIds: readonly number[];
  readonly dueAt: string | null;
  readonly canViewPricing: boolean;
}

export interface FixturePursuitNote {
  readonly id: number;
  readonly authorUserId: number;
  readonly body: string;
  readonly createdAt: string;
}

export interface FixturePursuit {
  readonly id: number;
  /** The supplier tenant that owns the pursuit. */
  readonly tenantId: number;
  readonly buyerTenantId: number;
  readonly tenderId: number;
  readonly attractiveness: number | null;
  readonly capacityNote: string | null;
  readonly estimatedEffortHours: number | null;
  readonly risks: string | null;
  readonly pursuitOwnerUserId: number | null;
  readonly decision: PursuitsDecision;
  readonly internalRationale: string | null;
  readonly decidedAt: string | null;
  readonly decidedByUserId: number | null;
  readonly team: readonly FixtureTeamMember[];
  readonly notes: readonly FixturePursuitNote[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

/** A pursuit decided to bid with the owner as the only team member. */
function simple(
  tenantId: number,
  buyerTenantId: number,
  tenderId: number,
  ownerUserId: number,
  decision: PursuitsDecision,
  decidedAt: string | null,
  fields: Partial<FixturePursuit> = {},
): FixturePursuit {
  const id = tenantId * 1000 + tenderId;
  return {
    id,
    tenantId,
    buyerTenantId,
    tenderId,
    attractiveness: 3,
    capacityNote: null,
    estimatedEffortHours: null,
    risks: null,
    pursuitOwnerUserId: ownerUserId,
    decision,
    internalRationale: decision === 'undecided' ? null : 'Fits our core capability and current capacity.',
    decidedAt,
    decidedByUserId: decidedAt === null ? null : ownerUserId,
    team: [{ id: id * 10 + 1, userId: ownerUserId, responsibility: 'bid_manager', sectionScope: [], lotIds: [], dueAt: null, canViewPricing: true }],
    notes: [],
    createdAt: decidedAt ?? '2026-09-20T08:00:00Z',
    updatedAt: decidedAt ?? '2026-09-20T08:00:00Z',
    ...fields,
  };
}

const TSODILO = TENANT_IDS.tsodilo;
const CHOBE = TENANT_IDS['chobe-pipe'];
const MAKGADIKGADI = TENANT_IDS.makgadikgadi;
const SEROWE = TENANT_IDS['serowe-ict'];
const LIMPOPO = TENANT_IDS['limpopo-env'];
const GABORONE_METER = TENANT_IDS['gaborone-meter'];

export const PURSUITS: readonly FixturePursuit[] = Object.freeze([
  // Tsodilo ----------------------------------------------------------------------------------------------------
  {
    id: 4006,
    tenantId: TSODILO,
    buyerTenantId: KWU,
    tenderId: 6,
    attractiveness: 5,
    capacityNote: 'The Francistown workshop has two dosing skids free from November; installers are available for the February shutdown.',
    estimatedEffortHours: 120,
    risks: 'Mandatory site visit on 8 October. Installers need current chlorine-gas handling certificates. Lead time of the changeover panel is 10 weeks.',
    pursuitOwnerUserId: 25,
    decision: 'bid',
    internalRationale: 'Core product line with a strong reference at the Mahalapye works; margin acceptable at the expected price.',
    decidedAt: '2026-09-22T09:00:00Z',
    decidedByUserId: 25,
    team: [
      { id: 40061, userId: 25, responsibility: 'bid_manager', sectionScope: ['Technical', 'Commercial'], lotIds: [], dueAt: '2026-10-13T15:00:00Z', canViewPricing: true },
      { id: 40062, userId: 26, responsibility: 'contributor', sectionScope: ['Specification compliance'], lotIds: [], dueAt: '2026-10-09T15:00:00Z', canViewPricing: false },
      { id: 40063, userId: 27, responsibility: 'signatory', sectionScope: [], lotIds: [], dueAt: '2026-10-13T15:00:00Z', canViewPricing: true },
      { id: 40064, userId: 42, responsibility: 'contributor', sectionScope: ['Installation method statement'], lotIds: [], dueAt: '2026-10-07T15:00:00Z', canViewPricing: false },
    ],
    notes: [
      { id: 40066, authorUserId: 25, body: 'Confirmed with Motsamai that we respond as Tsodilo Engineering (Pty) Ltd, not through the Francistown branch.', createdAt: '2026-09-22T09:15:00Z' },
      { id: 40067, authorUserId: 26, body: 'Datasheets for the 20 kg/h chlorinator requested from the manufacturer; expected by 7 October.', createdAt: '2026-09-24T11:00:00Z' },
    ],
    createdAt: '2026-09-21T09:00:00Z',
    updatedAt: '2026-09-24T11:00:00Z',
  },
  simple(TSODILO, KWU, 2, 25, 'bid', '2026-09-16T09:00:00Z', {
    attractiveness: 3,
    capacityNote: 'We supply the ultrasonic meters through our manufacturer partnership and install with our own crews.',
    estimatedEffortHours: 60,
    risks: 'Addendum 1 requires OIML R49 certificates for every model; the manufacturer must reissue two of them.',
    internalRationale: 'A good entry into metering; the partner carries the product risk.',
    team: [
      { id: 40021, userId: 25, responsibility: 'bid_manager', sectionScope: [], lotIds: [], dueAt: null, canViewPricing: true },
      { id: 40022, userId: 27, responsibility: 'signatory', sectionScope: [], lotIds: [], dueAt: '2026-10-20T15:00:00Z', canViewPricing: true },
    ],
    notes: [
      {
        id: 40026,
        authorUserId: 25,
        body: 'Supplement with the OIML R49 certificates sent on 25 September; keep the receipt with the bid file.',
        createdAt: '2026-09-25T08:10:00Z',
      },
    ],
    createdAt: '2026-09-14T11:00:00Z',
    updatedAt: '2026-09-25T08:10:00Z',
  }),
  simple(TSODILO, KWU, 1, 25, 'bid', '2026-06-20T08:00:00Z', {
    attractiveness: 4,
    estimatedEffortHours: 160,
    team: [
      { id: 40011, userId: 25, responsibility: 'bid_manager', sectionScope: [], lotIds: [101, 103], dueAt: null, canViewPricing: true },
      { id: 40012, userId: 26, responsibility: 'contributor', sectionScope: ['Pump selection'], lotIds: [101, 103], dueAt: '2026-07-17T15:00:00Z', canViewPricing: false },
      { id: 40013, userId: 27, responsibility: 'signatory', sectionScope: [], lotIds: [101, 103], dueAt: '2026-07-23T15:00:00Z', canViewPricing: true },
    ],
  }),
  simple(TSODILO, KWU, 3, 25, 'bid', '2026-07-29T08:00:00Z'),
  simple(TSODILO, KWU, 4, 25, 'bid', '2026-05-06T08:05:00Z', { internalRationale: 'Information response only: positions us for the follow-on procurement.' }),
  simple(TSODILO, KWU, 7, 25, 'bid', '2026-05-28T08:00:00Z'),
  simple(TSODILO, KWU, 8, 25, 'bid', '2026-08-28T08:00:00Z', { risks: 'Lot 1 only; the bid was later withdrawn after a pricing error was found.' }),
  simple(TSODILO, KWU, 10, 25, 'bid', '2026-03-10T08:00:00Z'),
  // Chobe Pipe & Valve -------------------------------------------------------------------------------------------
  simple(CHOBE, KWU, 6, 29, 'bid', '2026-09-23T10:05:00Z', {
    attractiveness: 4,
    capacityNote: 'Dosing is adjacent to our valve range; the installation is subcontracted.',
    estimatedEffortHours: 90,
    risks: 'Our insurance certificate (a qualification condition) must be renewed by 8 October.',
  }),
  simple(CHOBE, KWU, 2, 29, 'bid', '2026-09-16T10:00:00Z'),
  simple(CHOBE, KWU, 1, 29, 'bid', '2026-06-22T09:00:00Z'),
  simple(CHOBE, KWU, 8, 29, 'bid', '2026-08-27T08:00:00Z'),
  // Serowe ICT ---------------------------------------------------------------------------------------------------
  simple(SEROWE, KWU, 2, 33, 'bid', '2026-09-17T08:00:00Z', { attractiveness: 3, estimatedEffortHours: 70 }),
  simple(SEROWE, KWU, 3, 33, 'bid', '2026-07-24T08:00:00Z', { attractiveness: 5, estimatedEffortHours: 240 }),
  simple(SEROWE, KWU, 9, 33, 'bid', '2026-07-10T08:00:00Z', { attractiveness: 4 }),
  simple(SEROWE, KWU, 4, 33, 'bid', '2026-05-08T08:05:00Z'),
  // Gaborone Metering --------------------------------------------------------------------------------------------
  simple(GABORONE_METER, KWU, 2, 37, 'bid', '2026-09-15T08:00:00Z', { attractiveness: 5, estimatedEffortHours: 80 }),
  simple(GABORONE_METER, KWU, 8, 37, 'no_bid', '2026-09-02T08:00:00Z', {
    attractiveness: 2,
    internalRationale: 'Butterfly valves above DN300 are outside our range; partnering is not worth it for Lot 1 alone.',
  }),
  simple(GABORONE_METER, KWU, 9, 37, 'bid', '2026-07-10T10:00:00Z'),
  // Makgadikgadi (administrator only) -----------------------------------------------------------------------------
  simple(MAKGADIKGADI, KWU, 2, 40, 'undecided', null, {
    attractiveness: 3,
    capacityNote: 'Two installation crews free from November.',
    risks: 'The invitation expires on 9 October; we do not stock meters and would need a supplier partner.',
    createdAt: '2026-09-25T12:00:00Z',
    updatedAt: '2026-09-25T12:00:00Z',
  }),
  simple(MAKGADIKGADI, KWU, 1, 40, 'bid', '2026-06-25T10:00:00Z'),
  simple(MAKGADIKGADI, KWU, 3, 40, 'bid', '2026-07-31T08:00:00Z'),
  simple(MAKGADIKGADI, KWU, 7, 40, 'bid', '2026-05-25T08:00:00Z'),
  simple(MAKGADIKGADI, KWU, 10, 40, 'bid', '2026-03-11T08:00:00Z'),
  simple(MAKGADIKGADI, ODC, 11, 40, 'bid', '2026-09-18T09:00:00Z', { attractiveness: 3, capacityNote: 'Cleaning crews available from January.' }),
  // Limpopo Environmental (administrator only) -------------------------------------------------------------------
  simple(LIMPOPO, ODC, 11, 41, 'bid', '2026-09-18T08:00:00Z', { attractiveness: 4, estimatedEffortHours: 30 }),
  simple(LIMPOPO, KWU, 7, 41, 'bid', '2026-05-26T08:00:00Z'),
  simple(LIMPOPO, KWU, 4, 41, 'bid', '2026-05-07T08:05:00Z'),
  simple(LIMPOPO, KWU, 9, 41, 'bid', '2026-07-10T09:00:00Z'),
] satisfies FixturePursuit[]);
