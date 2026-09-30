/**
 * Supplier organizations of the demo world (demo storyline "Organizations"): the six platform supplier tenants with
 * their profiles (`supplier_profiles`, `supplier_locations`, `supplier_categories`, `supplier_legal_names`), plus the
 * supplier tenants that exist only as records here: buyer-created provisional suppliers (FR-02, DD-17), pending and
 * closed self-registrations (DD-27) and a record merged into another (BR-44). These extra tenants have no members who
 * can sign in; their ids (50+) never collide with the platform tenants (1..9).
 *
 * People who are not demo personas (registrants and requesters, user ids 70+) are listed in `EXTERNAL_PEOPLE`.
 */
import type { LegalNameEntry, SupplierLocation } from '../../../contracts/suppliers.js';
import type { InvitationsStatus, TenantsStatus, TenantsVerificationStatus } from '../../../contracts/enums.js';
import { TENANTS, TENANT_IDS } from '../platform.js';
import type { TenantSlug } from '../platform.js';

export interface ExternalPerson {
  readonly userId: number;
  readonly fullName: string;
  readonly email: string;
}

/** Users that exist in the story but are not sign-in personas (registrants, membership requesters). */
export const EXTERNAL_PEOPLE: readonly ExternalPerson[] = Object.freeze([
  { userId: 70, fullName: 'Kopano Moeng', email: 'kopano.moeng@tsodilo-services.example' },
  { userId: 71, fullName: 'Neo Kgathi', email: 'neo.kgathi@chobe-pipe.example' },
  { userId: 72, fullName: 'Tiro Masilo', email: 'tiro.masilo@gaborone-meter.example' },
  { userId: 73, fullName: 'Ame Kebaabetswe', email: 'ame.kebaabetswe@mailbox.example' },
  { userId: 74, fullName: 'Lorato Serame', email: 'lorato.serame@serowe-it.example' },
  { userId: 75, fullName: 'Boipelo Seleka', email: 'boipelo@letlhakane-solar.example' },
  { userId: 76, fullName: 'Mpule Kgalagadi', email: 'mpule@kgalagadi-traders.example' },
  { userId: 77, fullName: 'Onkemetse Dube', email: 'onkemetse.dube@kasane-drilling.example' },
  { userId: 78, fullName: 'Masego Tlhalefang', email: 'masego@maun-hygiene.example' },
  { userId: 79, fullName: 'Kabelo Chobe', email: 'kabelo@chobe-valves-kasane.example' },
] satisfies ExternalPerson[]);

export interface FixtureSupplierProfile {
  readonly tradingNames: readonly string[];
  readonly website: string | null;
  readonly description: string | null;
  readonly yearEstablished: number | null;
  readonly employeeCountBand: string | null;
  readonly annualTurnoverBand: string | null;
  readonly capacityOverview: string | null;
  readonly ownershipDisclosure: string | null;
  readonly ultimateParentName: string | null;
  readonly serviceAreas: readonly string[];
  readonly preferredLanguages: readonly string[];
  readonly primaryContactUserId: number | null;
  readonly updatedAt: string;
}

/** A self-registration or provisional invitation still in progress (DD-27). */
export interface FixtureRegistration {
  readonly registrantUserId: number;
  readonly verificationEmailStatus: InvitationsStatus;
  readonly verificationEmailSentCount: number;
  readonly lastActivityAt: string;
}

export interface FixtureSupplierOrg {
  readonly tenantId: number;
  readonly slug: string;
  readonly legalName: string;
  readonly tradingName: string | null;
  readonly status: TenantsStatus;
  readonly verificationStatus: TenantsVerificationStatus;
  readonly isProvisional: boolean;
  readonly createdByTenantId: number | null;
  readonly country: string;
  readonly registrationJurisdiction: string | null;
  readonly registrationNumber: string | null;
  readonly taxIdentifier: string | null;
  readonly defaultCurrency: string | null;
  readonly officialTimeZone: string;
  readonly emailDomain: string | null;
  readonly memberCount: number;
  readonly createdAt: string;
  readonly profile: FixtureSupplierProfile;
  readonly locations: readonly SupplierLocation[];
  readonly categories: readonly string[];
  readonly legalNames: readonly LegalNameEntry[];
  /** Present for self-registrations and provisional records that are not complete. */
  readonly registration: FixtureRegistration | null;
}

const CIPA = 'Botswana — Companies and Intellectual Property Authority (CIPA)';

function platformTenant(slug: TenantSlug) {
  const tenant = TENANTS.find((candidate) => candidate.slug === slug);
  if (tenant === undefined) {
    throw new Error(`Unknown platform tenant ${slug}.`);
  }
  return tenant;
}

function platformSupplier(
  slug: TenantSlug,
  spec: Omit<
    FixtureSupplierOrg,
    'tenantId' | 'slug' | 'legalName' | 'tradingName' | 'status' | 'isProvisional' | 'createdByTenantId' | 'defaultCurrency' | 'officialTimeZone' | 'createdAt' | 'registration'
  >,
): FixtureSupplierOrg {
  const tenant = platformTenant(slug);
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    legalName: tenant.legalName,
    tradingName: tenant.name,
    status: tenant.status,
    isProvisional: false,
    createdByTenantId: null,
    defaultCurrency: tenant.defaultCurrency,
    officialTimeZone: tenant.officialTimeZone,
    createdAt: tenant.createdAt,
    registration: null,
    ...spec,
  };
}

const NO_PROFILE_DETAILS = {
  website: null,
  description: null,
  yearEstablished: null,
  employeeCountBand: null,
  annualTurnoverBand: null,
  capacityOverview: null,
  ownershipDisclosure: null,
  ultimateParentName: null,
} as const;

export const SUPPLIER_ORGS: readonly FixtureSupplierOrg[] = Object.freeze([
  platformSupplier('tsodilo', {
    verificationStatus: 'identity_verified',
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00001234567',
    taxIdentifier: 'P03512345678',
    emailDomain: 'tsodilo-engineering.example',
    memberCount: 5,
    profile: {
      tradingNames: ['Tsodilo Engineering'],
      website: 'https://tsodilo-engineering.example',
      description: 'Mechanical and electrical contractor for water utilities: borehole pumps, dosing plant and telemetry.',
      yearEstablished: 2009,
      employeeCountBand: '51–200',
      annualTurnoverBand: 'BWP 20M–50M',
      capacityOverview:
        'Four installation crews, a pump workshop in Francistown and a 24/7 call-out team; up to 40 borehole installations per quarter.',
      ownershipDisclosure: 'Citizen-owned: Motsamai Tsodilo 60%, Boago Moremi 40%.',
      ultimateParentName: null,
      serviceAreas: ['South-East District', 'Kweneng', 'Central District', 'North-East District'],
      preferredLanguages: ['en', 'tn'],
      primaryContactUserId: 24,
      updatedAt: '2026-07-15T09:20:00Z',
    },
    locations: [
      { id: 401, name: 'Head office', address: 'Plot 54368, Block 3 Industrial, Gaborone', region: 'South-East', country: 'BW', isRegisteredOffice: true },
      { id: 402, name: 'Pump workshop', address: 'Plot 2211, Light Industrial, Francistown', region: 'North-East', country: 'BW', isRegisteredOffice: false },
    ],
    categories: ['WTR-PUMP', 'WTR-DOSE', 'ICT-SCADA'],
    legalNames: [
      { legalName: 'Tsodilo Engineering Services (Pty) Ltd', validFrom: '2009-03-02', validTo: '2026-03-31' },
      { legalName: 'Tsodilo Engineering (Pty) Ltd', validFrom: '2026-04-01', validTo: null },
    ],
  }),
  platformSupplier('chobe-pipe', {
    verificationStatus: 'identity_verified',
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00002345678',
    taxIdentifier: 'P04612345679',
    emailDomain: 'chobe-pipe.example',
    memberCount: 5,
    profile: {
      tradingNames: ['Chobe Pipe & Valve Supplies', 'Chobe Pipe'],
      website: 'https://chobe-pipe.example',
      description: 'Stockist and supplier of pipes, bulk valves, dosing equipment and smart water meters.',
      yearEstablished: 2012,
      employeeCountBand: '11–50',
      annualTurnoverBand: 'BWP 5M–20M',
      capacityOverview: 'Warehouses in Kasane and Francistown holding 1,200 tonnes of pipe stock; delivery fleet of 8 trucks.',
      ownershipDisclosure: 'Chobe Holdings (Pty) Ltd 75%; Gorata Mphoeng 25%.',
      ultimateParentName: 'Chobe Holdings (Pty) Ltd',
      serviceAreas: ['Chobe', 'North-West', 'Central District'],
      preferredLanguages: ['en'],
      primaryContactUserId: 28,
      updatedAt: '2026-06-20T08:00:00Z',
    },
    locations: [
      { id: 501, name: 'Registered office', address: 'Plot 1027, President Avenue, Kasane', region: 'Chobe', country: 'BW', isRegisteredOffice: true },
      { id: 502, name: 'Francistown depot', address: 'Plot 781, Dumela Industrial, Francistown', region: 'North-East', country: 'BW', isRegisteredOffice: false },
    ],
    categories: ['WTR-PIPE', 'WTR-DOSE', 'WTR-METER'],
    legalNames: [{ legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd', validFrom: '2012-08-14', validTo: null }],
  }),
  platformSupplier('makgadikgadi', {
    verificationStatus: 'contact_verified',
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00003456789',
    taxIdentifier: null,
    emailDomain: 'botsmail.example',
    memberCount: 1,
    profile: {
      tradingNames: ['Makgadikgadi Civil Works'],
      website: null,
      description: 'Civil contractor for reservoirs, pipelines and pump station structures.',
      yearEstablished: 2016,
      employeeCountBand: '51–200',
      annualTurnoverBand: 'BWP 20M–50M',
      capacityOverview: 'Two civil crews and owned plant (excavators, cranes) based in Letlhakane.',
      ownershipDisclosure: 'Sethunya Makgadi 100%.',
      ultimateParentName: null,
      serviceAreas: ['Central District', 'Boteti'],
      preferredLanguages: ['en', 'tn'],
      primaryContactUserId: 40,
      updatedAt: '2026-08-10T10:00:00Z',
    },
    locations: [
      { id: 601, name: 'Registered office', address: 'Plot 330, Main Road, Letlhakane', region: 'Central', country: 'BW', isRegisteredOffice: true },
    ],
    categories: ['CIV-RES', 'CIV-GEN', 'WTR-PUMP'],
    legalNames: [{ legalName: 'Makgadikgadi Civil Works (Pty) Ltd', validFrom: '2016-02-01', validTo: null }],
  }),
  platformSupplier('serowe-ict', {
    verificationStatus: 'identity_verified',
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00004567890',
    taxIdentifier: 'P05712345670',
    emailDomain: 'serowe-ict.example',
    memberCount: 4,
    profile: {
      tradingNames: ['Serowe ICT Solutions', 'Serowe ICT'],
      website: 'https://serowe-ict.example',
      description: 'SCADA, telemetry and network integrator for utilities and municipalities.',
      yearEstablished: 2018,
      employeeCountBand: '11–50',
      annualTurnoverBand: 'BWP 5M–20M',
      capacityOverview: 'Twelve certified integrators; 24/7 network operations desk in Serowe.',
      ownershipDisclosure: 'Otsile Serowe 55%; Tshepiso Khama 45%.',
      ultimateParentName: null,
      serviceAreas: ['Central District', 'South-East District', 'Kgatleng'],
      preferredLanguages: ['en'],
      primaryContactUserId: 32,
      updatedAt: '2026-09-10T07:30:00Z',
    },
    locations: [
      { id: 701, name: 'Registered office', address: 'Plot 88, Sekgoma Road, Serowe', region: 'Central', country: 'BW', isRegisteredOffice: true },
    ],
    categories: ['ICT-SCADA', 'ICT-NET', 'WTR-METER'],
    legalNames: [{ legalName: 'Serowe ICT Solutions (Pty) Ltd', validFrom: '2018-05-21', validTo: null }],
  }),
  platformSupplier('limpopo-env', {
    verificationStatus: 'identity_verified',
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00005678901',
    taxIdentifier: 'P06812345671',
    emailDomain: 'botsmail.example',
    memberCount: 1,
    profile: {
      tradingNames: ['Limpopo Environmental Services'],
      website: 'https://limpopo-env.example',
      description: 'Environmental consulting, leak detection surveys and reservoir condition assessments.',
      yearEstablished: 2014,
      employeeCountBand: '11–50',
      annualTurnoverBand: 'BWP 1M–5M',
      capacityOverview: 'Three acoustic survey teams with correlators and ground microphones.',
      ownershipDisclosure: 'Mothusi Limpopo 70%; Limpopo Staff Trust 30%.',
      ultimateParentName: null,
      serviceAreas: ['Bobirwa', 'Selebi-Phikwe', 'Central District', 'Ngamiland'],
      preferredLanguages: ['en', 'tn'],
      primaryContactUserId: 41,
      updatedAt: '2026-05-02T12:00:00Z',
    },
    locations: [
      { id: 801, name: 'Registered office', address: 'Plot 5170, Botshabelo, Selebi-Phikwe', region: 'Central', country: 'BW', isRegisteredOffice: true },
    ],
    categories: ['ENV-LEAK', 'ENV-CONS', 'CIV-RES'],
    legalNames: [{ legalName: 'Limpopo Environmental Services (Pty) Ltd', validFrom: '2014-09-09', validTo: null }],
  }),
  platformSupplier('gaborone-meter', {
    verificationStatus: 'identity_verified',
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00006789012',
    taxIdentifier: 'P07912345672',
    emailDomain: 'gaborone-meter.example',
    memberCount: 5,
    profile: {
      tradingNames: ['Gaborone Metering Co.'],
      website: 'https://gaborone-meter.example',
      description: 'Supplier of smart water meters, AMR equipment and meter reading services.',
      yearEstablished: 2011,
      employeeCountBand: '51–200',
      annualTurnoverBand: 'BWP 20M–50M',
      capacityOverview: 'Meter test bench accredited for 5,000 meters per month; field team of 30 readers.',
      ownershipDisclosure: 'Palesa Gabo 40%; Kagiso Metsi 35%; Lame Ntshole 25%.',
      ultimateParentName: null,
      serviceAreas: ['South-East District', 'Kweneng', 'Southern District'],
      preferredLanguages: ['en'],
      primaryContactUserId: 36,
      updatedAt: '2026-05-22T09:00:00Z',
    },
    locations: [
      { id: 901, name: 'Registered office', address: 'Plot 20611, Gaborone West Industrial, Gaborone', region: 'South-East', country: 'BW', isRegisteredOffice: true },
      { id: 902, name: 'Meter test centre', address: 'Plot 6420, Lobatse Road, Lobatse', region: 'South-East', country: 'BW', isRegisteredOffice: false },
    ],
    categories: ['WTR-METER'],
    legalNames: [{ legalName: 'Gaborone Metering Company (Pty) Ltd', validFrom: '2011-01-17', validTo: null }],
  }),
  // Buyer-created provisional suppliers (FR-02): each visible only to the buyer that created it.
  {
    tenantId: 50,
    slug: 'kasane-borehole-drilling',
    legalName: 'Kasane Borehole Drilling (Pty) Ltd',
    tradingName: null,
    status: 'pending',
    verificationStatus: 'unverified',
    isProvisional: true,
    createdByTenantId: TENANT_IDS.kwu,
    country: 'BW',
    registrationJurisdiction: null,
    registrationNumber: null,
    taxIdentifier: null,
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'kasane-drilling.example',
    memberCount: 0,
    createdAt: '2026-09-10T08:15:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: [], serviceAreas: [], preferredLanguages: ['en'], primaryContactUserId: null, updatedAt: '2026-09-10T08:15:00Z' },
    locations: [],
    categories: ['WTR-PUMP'],
    legalNames: [],
    registration: { registrantUserId: 77, verificationEmailStatus: 'pending', verificationEmailSentCount: 1, lastActivityAt: '2026-09-10T08:15:00Z' },
  },
  {
    tenantId: 51,
    slug: 'maun-hygiene-services',
    legalName: 'Maun Hygiene Services (Pty) Ltd',
    tradingName: null,
    status: 'pending',
    verificationStatus: 'unverified',
    isProvisional: true,
    createdByTenantId: TENANT_IDS.odc,
    country: 'BW',
    registrationJurisdiction: null,
    registrationNumber: 'BW00009876543',
    taxIdentifier: null,
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'maun-hygiene.example',
    memberCount: 0,
    createdAt: '2026-08-20T10:00:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: [], serviceAreas: ['Ngamiland'], preferredLanguages: ['en'], primaryContactUserId: null, updatedAt: '2026-08-20T10:00:00Z' },
    locations: [],
    categories: ['FAC-CLEAN'],
    legalNames: [],
    registration: { registrantUserId: 78, verificationEmailStatus: 'pending', verificationEmailSentCount: 2, lastActivityAt: '2026-09-03T10:00:00Z' },
  },
  {
    tenantId: 53,
    slug: 'chobe-pipe-valves-kasane',
    legalName: 'Chobe Pipe & Valves (Kasane)',
    tradingName: null,
    status: 'pending',
    verificationStatus: 'unverified',
    isProvisional: true,
    createdByTenantId: TENANT_IDS.odc,
    country: 'BW',
    registrationJurisdiction: null,
    registrationNumber: 'BW00002345687',
    taxIdentifier: null,
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'chobe-valves-kasane.example',
    memberCount: 0,
    createdAt: '2026-07-14T09:00:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: [], serviceAreas: ['Chobe'], preferredLanguages: ['en'], primaryContactUserId: null, updatedAt: '2026-07-14T09:00:00Z' },
    locations: [
      { id: 5301, name: 'Address from ODC vendor list', address: 'Plot 1027, President Avenue, Kasane', region: 'Chobe', country: 'BW', isRegisteredOffice: true },
    ],
    categories: ['WTR-PIPE'],
    legalNames: [],
    registration: { registrantUserId: 79, verificationEmailStatus: 'expired', verificationEmailSentCount: 1, lastActivityAt: '2026-07-14T09:00:00Z' },
  },
  // Self-registrations awaiting completion (DD-27) and a closed one.
  {
    tenantId: 52,
    slug: 'tsodilo-engineering-services',
    legalName: 'Tsodilo Engineering Services (Pty) Ltd',
    tradingName: null,
    status: 'pending',
    verificationStatus: 'unverified',
    isProvisional: false,
    createdByTenantId: null,
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00007788990',
    taxIdentifier: null,
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'tsodilo-services.example',
    memberCount: 1,
    createdAt: '2026-09-20T14:05:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: [], serviceAreas: ['North-West'], preferredLanguages: ['en'], primaryContactUserId: 70, updatedAt: '2026-09-20T14:05:00Z' },
    locations: [
      { id: 5201, name: 'Registered office', address: 'Plot 12, Old Mall, Maun', region: 'Ngamiland', country: 'BW', isRegisteredOffice: true },
    ],
    categories: ['WTR-PUMP'],
    legalNames: [{ legalName: 'Tsodilo Engineering Services (Pty) Ltd', validFrom: '2026-09-01', validTo: null }],
    registration: { registrantUserId: 70, verificationEmailStatus: 'send_failed', verificationEmailSentCount: 1, lastActivityAt: '2026-09-20T14:05:00Z' },
  },
  {
    tenantId: 54,
    slug: 'gaborone-meter-services',
    legalName: 'Gaborone Meter Services (Pty) Ltd',
    tradingName: null,
    status: 'closed',
    verificationStatus: 'contact_verified',
    isProvisional: false,
    createdByTenantId: null,
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00006789012',
    taxIdentifier: null,
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'gaborone-meter.example',
    memberCount: 0,
    createdAt: '2026-03-30T11:00:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: [], serviceAreas: [], preferredLanguages: ['en'], primaryContactUserId: null, updatedAt: '2026-04-20T10:00:00Z' },
    locations: [],
    categories: ['WTR-METER'],
    legalNames: [{ legalName: 'Gaborone Meter Services (Pty) Ltd', validFrom: '2026-03-30', validTo: '2026-04-20' }],
    registration: null,
  },
  {
    tenantId: 55,
    slug: 'serowe-information-technology',
    legalName: 'Serowe Information Technology (Pty) Ltd',
    tradingName: null,
    status: 'pending',
    verificationStatus: 'unverified',
    isProvisional: false,
    createdByTenantId: null,
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00004567890',
    taxIdentifier: null,
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'serowe-it.example',
    memberCount: 1,
    createdAt: '2026-08-02T16:40:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: [], serviceAreas: ['Central District'], preferredLanguages: ['en'], primaryContactUserId: 74, updatedAt: '2026-08-02T16:40:00Z' },
    locations: [
      { id: 5501, name: 'Registered office', address: 'Plot 412, Serowe Mall, Serowe', region: 'Central', country: 'BW', isRegisteredOffice: true },
    ],
    categories: ['ICT-NET'],
    legalNames: [{ legalName: 'Serowe Information Technology (Pty) Ltd', validFrom: '2026-08-02', validTo: null }],
    registration: { registrantUserId: 74, verificationEmailStatus: 'pending', verificationEmailSentCount: 2, lastActivityAt: '2026-08-09T09:00:00Z' },
  },
  {
    tenantId: 56,
    slug: 'letlhakane-solar',
    legalName: 'Letlhakane Solar Installations (Pty) Ltd',
    tradingName: null,
    status: 'pending',
    verificationStatus: 'contact_verified',
    isProvisional: false,
    createdByTenantId: null,
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: 'BW00008123456',
    taxIdentifier: 'P09112345673',
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'letlhakane-solar.example',
    memberCount: 1,
    createdAt: '2026-09-26T07:50:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: ['Letlhakane Solar'], serviceAreas: ['Boteti', 'Central District'], preferredLanguages: ['en', 'tn'], primaryContactUserId: 75, updatedAt: '2026-09-27T08:00:00Z' },
    locations: [
      { id: 5601, name: 'Registered office', address: 'Plot 77, Mokubilo Road, Letlhakane', region: 'Central', country: 'BW', isRegisteredOffice: true },
    ],
    categories: ['WTR-PUMP'],
    legalNames: [{ legalName: 'Letlhakane Solar Installations (Pty) Ltd', validFrom: '2026-09-26', validTo: null }],
    registration: { registrantUserId: 75, verificationEmailStatus: 'accepted', verificationEmailSentCount: 1, lastActivityAt: '2026-09-27T08:00:00Z' },
  },
  {
    tenantId: 57,
    slug: 'kgalagadi-traders',
    legalName: 'Kgalagadi Traders (Pty) Ltd',
    tradingName: null,
    status: 'closed',
    verificationStatus: 'unverified',
    isProvisional: false,
    createdByTenantId: null,
    country: 'BW',
    registrationJurisdiction: CIPA,
    registrationNumber: null,
    taxIdentifier: null,
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    emailDomain: 'kgalagadi-traders.example',
    memberCount: 0,
    createdAt: '2026-05-04T13:00:00Z',
    profile: { ...NO_PROFILE_DETAILS, tradingNames: [], serviceAreas: [], preferredLanguages: ['en'], primaryContactUserId: null, updatedAt: '2026-07-30T09:00:00Z' },
    locations: [],
    categories: ['CIV-GEN'],
    legalNames: [],
    registration: { registrantUserId: 76, verificationEmailStatus: 'expired', verificationEmailSentCount: 3, lastActivityAt: '2026-07-30T09:00:00Z' },
  },
] satisfies FixtureSupplierOrg[]);

const orgsById = new Map(SUPPLIER_ORGS.map((org) => [org.tenantId, org]));

export function findSupplierOrg(tenantId: number): FixtureSupplierOrg | undefined {
  return orgsById.get(tenantId);
}

export function findExternalPerson(userId: number): ExternalPerson | undefined {
  return EXTERNAL_PEOPLE.find((person) => person.userId === userId);
}

/**
 * Opaque duplicate-check tokens (SUP-02). A token names an organization for a membership request without
 * disclosing which one; only active or pending, non-provisional organizations can be matched.
 */
export const MATCH_TOKENS: readonly { readonly token: string; readonly tenantId: number }[] = Object.freeze([
  { token: 'dup_q7Lm2Xa9Pt4R', tenantId: TENANT_IDS.tsodilo },
  { token: 'dup_b3Nv8Kc1Wz6E', tenantId: TENANT_IDS['chobe-pipe'] },
  { token: 'dup_h5Ty0Ru2Qe8M', tenantId: TENANT_IDS.makgadikgadi },
  { token: 'dup_m1Gd4Sf7Jk3P', tenantId: TENANT_IDS['serowe-ict'] },
  { token: 'dup_x9Wa6Zc5Vb2L', tenantId: TENANT_IDS['limpopo-env'] },
  { token: 'dup_r4Ke7Yn3Hu1D', tenantId: TENANT_IDS['gaborone-meter'] },
  { token: 'dup_c8Pi5Oq2Lw9F', tenantId: 52 },
  { token: 'dup_t2Bj9Mx4Nd7S', tenantId: 55 },
  { token: 'dup_f6Uv3Ge8Ra5K', tenantId: 56 },
]);

export function tenantOfMatchToken(token: string): number | undefined {
  return MATCH_TOKENS.find((entry) => entry.token === token)?.tenantId;
}

export function matchTokenOf(tenantId: number): string | undefined {
  return MATCH_TOKENS.find((entry) => entry.tenantId === tenantId)?.token;
}
