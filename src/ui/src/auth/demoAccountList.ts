/**
 * The demo accounts of the local development quick-pick (DD-43, docs/technical/09-frontend.md §11).
 *
 * DEVELOPMENT BUILDS ONLY: this module is reached only through the dynamic import in SignInPage, which sits behind
 * `import.meta.env.DEV`, so Vite drops it from production builds. `scan-bundle` fails the build if
 * `DEMO_ACCOUNTS_MARKER` appears in `src/ui/dist`.
 *
 * The accounts are the demo personas of docs/plan/demo-storyline.md, created in LOCAL Supabase Auth by
 * `npm run auth:personas` with the password `test1234`. This list only fills the sign-in form: signing in is real
 * (supabase-js), and the mock API maps the verified email to its fixture persona. Business data never comes from here.
 */

export const DEMO_ACCOUNTS_MARKER = 'tiq-demo-accounts-dev-only-quick-pick';

/** The local-only password of every demo persona (never valid outside the local Docker stack). */
export const DEMO_PASSWORD = 'test1234';

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
