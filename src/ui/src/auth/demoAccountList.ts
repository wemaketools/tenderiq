/**
 * The demo personas of the sign-in page's persona picker (DD-50, docs/plan/demo-storyline.md).
 *
 * The prototype has no passwords: choosing a persona signs in as that persona, and the in-browser mock API maps its
 * e-mail to the fixture persona (a deactivated one gets 401, AC-04). This list only labels the choices; business
 * data never comes from here. `src/mock-api/testing/tests/demo-accounts.test.ts` keeps it equal to the fixture
 * personas.
 */

export interface DemoAccount {
  readonly email: string;
  readonly fullName: string;
  /** What the persona demonstrates, for example "Procurement officer, tender owner". */
  readonly role: string;
}

export interface DemoAccountGroup {
  readonly organization: string;
  readonly accounts: readonly DemoAccount[];
}

const domain = 'tenderiq.local';
const account = (localPart: string, fullName: string, role: string): DemoAccount => ({
  email: `${localPart}@${domain}`,
  fullName,
  role,
});

const supplierTeam = (
  slug: string,
  people: readonly [string, string, string, string],
): readonly DemoAccount[] => [
  account(`${slug}.admin`, people[0], 'Organization administrator'),
  account(`${slug}.bidmanager`, people[1], 'Bid manager'),
  account(`${slug}.contributor`, people[2], 'Contributor'),
  account(`${slug}.signatory`, people[3], 'Authorized signatory'),
];

export const DEMO_ACCOUNT_GROUPS: readonly DemoAccountGroup[] = [
  {
    organization: 'Kalahari Water Utilities (Pilot)',
    accounts: [
      account('tebogo.officer', 'Tebogo Molefe', 'Procurement officer, tender owner'),
      account('mpho.manager', 'Mpho Dikgang', 'Procurement manager (BWP 2,000,000)'),
      account('keabetswe.approver', 'Keabetswe Nkwe', 'Award approver (BWP 10,000,000)'),
      account('boitumelo.chair', 'Boitumelo Kgari', 'Evaluation chair'),
      account('thato.eval', 'Thato Mokgosi', 'Evaluator'),
      account('kabo.eval', 'Kabo Ntsima', 'Evaluator'),
      account('amantle.eval', 'Amantle Segwai', 'Evaluator'),
      account('refilwe.commercial', 'Refilwe Motsumi', 'Commercial reviewer'),
      account('oratile.opener', 'Oratile Baitse', 'Bid opening officer'),
      account('goitse.witness', 'Goitse Mooketsi', 'Opening witness'),
      account('kagiso.requester', 'Kagiso Phiri', 'Requester'),
      account('onalenna.budget', 'Onalenna Tau', 'Budget owner'),
      account('neo.assessor', 'Neo Mothibi', 'Qualification assessor'),
      account('lesego.finance', 'Lesego Seretse', 'Financial reviewer'),
      account('dineo.legal', 'Dineo Masire', 'Legal reviewer'),
      account('masego.contracts', 'Masego Rakgosi', 'Contract manager'),
      account('pule.auditor', 'Pule Modise', 'Auditor (read-only)'),
      account('admin.kwu', 'Lorato Kgosi', 'Organization administrator (no sealed access)'),
      account('former.officer', 'Gaone Letsholo', 'Departed employee (deactivated)'),
    ],
  },
  {
    organization: 'Okavango District Council',
    accounts: [
      account('officer.odc', 'Kefilwe Sekgoma', 'Procurement officer'),
      account('admin.odc', 'Wame Olebile', 'Organization administrator'),
    ],
  },
  {
    organization: 'Several organizations',
    accounts: [
      account('sam.dual', 'Sam Keitumetse', 'Evaluator at KWU and contributor at two suppliers'),
    ],
  },
  {
    organization: 'Tsodilo Engineering',
    accounts: supplierTeam('tsodilo', [
      'Tumelo Sekgoma',
      'Boago Moremi',
      'Ditiro Kebonang',
      'Motsamai Tsodilo',
    ]),
  },
  {
    organization: 'Chobe Pipe & Valve Supplies',
    accounts: supplierTeam('chobe-pipe', [
      'Chedza Ramokate',
      'Bakang Chobe',
      'Thabo Maano',
      'Gorata Mphoeng',
    ]),
  },
  {
    organization: 'Serowe ICT Solutions',
    accounts: supplierTeam('serowe-ict', [
      'Refentse Kgama',
      'Otsile Serowe',
      'Mmoloki Seabo',
      'Tshepiso Khama',
    ]),
  },
  {
    organization: 'Gaborone Metering Co.',
    accounts: supplierTeam('gaborone-meter', [
      'Palesa Gabo',
      'Kagiso Metsi',
      'Omphile Ditshego',
      'Lame Ntshole',
    ]),
  },
  {
    organization: 'Other suppliers',
    accounts: [
      account('makgadikgadi.admin', 'Sethunya Makgadi', 'Makgadikgadi Civil Works administrator'),
      account(
        'limpopo-env.admin',
        'Mothusi Limpopo',
        'Limpopo Environmental Services administrator',
      ),
    ],
  },
  {
    organization: 'TenderIQ Platform Operations',
    accounts: [
      account('ops.admin', 'Naledi Sebego', 'Platform operator'),
      account('support.agent', 'Kitso Ramotswa', 'Support agent'),
    ],
  },
];
