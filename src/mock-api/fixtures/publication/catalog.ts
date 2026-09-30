/**
 * Publication fixtures: the shared category taxonomy, buyer portal settings, published advance-notice teasers and
 * the participation guidance articles (docs/plan/demo-storyline.md; blueprint `category_catalog`,
 * `portal_settings`, `org_settings`, `advance_notices`, `help_articles`).
 *
 * Static data only: nothing here changes at runtime.
 */
import type { CategoryLabel } from '../../../contracts/publication.js';
import type {
  HelpArticlesAudience,
  HelpArticlesStatus,
  HelpArticlesTopic,
  PortalSettingsPublicDocumentPolicy,
} from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

/** The time zone of every demo event (both buyers are in Botswana). */
export const OFFICIAL_TZ = 'Africa/Gaborone';

/**
 * `category_catalog` rows (the shared taxonomy; the suppliers domain owns the catalog, these are the same codes
 * and names so discovery, search filters and supplier profiles agree).
 */
export const CATEGORIES: readonly CategoryLabel[] = Object.freeze([
  { code: 'WTR-INFRA', name: 'Water infrastructure', parentCode: null },
  { code: 'WTR-PUMP', name: 'Pumps and mechanical equipment', parentCode: 'WTR-INFRA' },
  { code: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentCode: 'WTR-INFRA' },
  { code: 'WTR-METER', name: 'Water meters and metering', parentCode: null },
  { code: 'WTR-TREAT', name: 'Water treatment', parentCode: null },
  { code: 'WTR-CHEM', name: 'Treatment chemicals', parentCode: 'WTR-TREAT' },
  { code: 'WTR-DOSE', name: 'Dosing equipment', parentCode: 'WTR-TREAT' },
  { code: 'ICT', name: 'ICT and telemetry', parentCode: null },
  { code: 'ICT-SCADA', name: 'SCADA and telemetry', parentCode: 'ICT' },
  { code: 'ICT-NET', name: 'Networks and communications', parentCode: 'ICT' },
  { code: 'CIV', name: 'Civil works', parentCode: null },
  { code: 'CIV-RES', name: 'Reservoirs and tanks', parentCode: 'CIV' },
  { code: 'CIV-GEN', name: 'General civil works', parentCode: 'CIV' },
  { code: 'ENV', name: 'Environmental services', parentCode: null },
  { code: 'ENV-LEAK', name: 'Leak detection', parentCode: 'ENV' },
  { code: 'ENV-CONS', name: 'Environmental consulting', parentCode: 'ENV' },
  { code: 'FAC', name: 'Facilities services', parentCode: null },
  { code: 'FAC-CLEAN', name: 'Cleaning services', parentCode: 'FAC' },
  { code: 'FLT', name: 'Fleet services', parentCode: null },
  { code: 'FLT-MAINT', name: 'Vehicle maintenance', parentCode: 'FLT' },
]);

/** Delivery regions of Botswana, named as the supplier profiles name their service areas. */
export const REGIONS: readonly string[] = Object.freeze([
  'Bobirwa',
  'Boteti',
  'Central District',
  'Chobe',
  'Kgalagadi',
  'Kgatleng',
  'Kweneng',
  'Ngamiland',
  'North-East District',
  'North-West',
  'Selebi-Phikwe',
  'South-East District',
  'Southern District',
]);

/** The public portal settings of a buyer (`portal_settings` + `org_settings` portal columns). */
export interface FixturePortalSettings {
  readonly tenantId: number;
  readonly publicPortalEnabled: boolean;
  readonly portalIntro: string;
  readonly guidanceMarkdown: string | null;
  readonly showAdvanceNotices: boolean;
  readonly showAwards: boolean;
  readonly showBidderCounts: boolean;
  readonly publicDocumentPolicy: PortalSettingsPublicDocumentPolicy;
  readonly languages: readonly string[];
}

export const PORTAL_SETTINGS: readonly FixturePortalSettings[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    publicPortalEnabled: true,
    portalIntro:
      'Kalahari Water Utilities buys pumps, pipework, treatment chemicals and services for water supply across the Central, Kgalagadi, Kweneng, Southern and South-East districts. Every notice on this portal is an official notice of the Corporation.',
    guidanceMarkdown:
      '## Taking part in a KWU procurement\n\n- Register your organization on TenderIQ before you download restricted documents.\n- Pumps and pipework events require the **Water Infrastructure Suppliers — Category A** qualification.\n- Deadlines are stated in official Botswana time (Africa/Gaborone). Late responses are not accepted.\n- Questions go through the clarification channel of each notice, never by e-mail to staff.',
    showAdvanceNotices: true,
    showAwards: true,
    showBidderCounts: false,
    publicDocumentPolicy: 'public',
    languages: ['en'],
  },
  {
    tenantId: TENANT_IDS.odc,
    publicPortalEnabled: true,
    portalIntro:
      'Okavango District Council procures facilities, community water and maintenance services for the North-West district. Documents are available to registered suppliers.',
    guidanceMarkdown: null,
    showAdvanceNotices: false,
    showAwards: false,
    showBidderCounts: false,
    publicDocumentPolicy: 'registered',
    languages: ['en'],
  },
]);

/** A published advance notice teaser (`advance_notices`; the planning domain owns the rows and PUB-06). */
export interface FixtureAdvanceNotice {
  readonly id: number;
  readonly tenantId: number;
  readonly title: string;
  readonly summary: string;
  readonly indicativeTiming: string;
  readonly categoryCode: string;
  readonly publishedAt: string;
}

export const ADVANCE_NOTICES: readonly FixtureAdvanceNotice[] = Object.freeze([
  {
    id: 401,
    tenantId: TENANT_IDS.kwu,
    title: 'Pressure-reducing valve replacement — Gaborone West and Tlokweng',
    summary:
      'Kalahari Water Utilities plans to procure the supply and installation of 22 pressure-reducing valves with chambers and data loggers in two Gaborone distribution zones.',
    indicativeTiming: 'Q4 2026 (tender expected in November)',
    categoryCode: 'WTR-PIPE',
    publishedAt: '2026-09-25T09:30:00Z',
  },
  {
    id: 402,
    tenantId: TENANT_IDS.kwu,
    title: 'Northern wellfield pipeline extension',
    summary:
      'Planned open tender for the supply and laying of about 14 km of 315 mm HDPE pipeline with valve chambers and two road crossings in the northern wellfield corridor.',
    indicativeTiming: 'Q1 2027 (tender expected in January)',
    categoryCode: 'WTR-PIPE',
    publishedAt: '2026-09-29T08:00:00Z',
  },
]);

/** A help article (`help_articles` [G]). */
export interface FixtureHelpArticle {
  readonly slug: string;
  readonly title: string;
  readonly topic: HelpArticlesTopic;
  readonly audience: HelpArticlesAudience;
  readonly language: string;
  readonly status: HelpArticlesStatus;
  readonly excerpt: string;
  readonly bodyMarkdown: string;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
}

export const HELP_ARTICLES: readonly FixtureHelpArticle[] = Object.freeze([
  {
    slug: 'registering-your-organization',
    title: 'Registering your organization',
    topic: 'registration',
    audience: 'public',
    language: 'en',
    status: 'published',
    excerpt: 'How a supplier organization registers, who becomes its administrator and how colleagues join.',
    bodyMarkdown:
      '## Who can register\n\nAny business that wants to respond to a notice registers once as an **organization**. The person who registers becomes its first administrator.\n\n## What you need\n\n- The legal name and registration number exactly as on your certificate of incorporation.\n- A work e-mail address you can verify.\n- The categories of goods and services you supply.\n\n## After registering\n\nInvite colleagues from **Users and authority**. Each colleague acts in a named capacity (for example Bid Manager). Submission authority is assigned explicitly.\n\n> General guidance never replaces the binding conditions stated in a particular notice.',
    publishedAt: '2026-03-02T08:00:00Z',
    updatedAt: '2026-07-14T08:00:00Z',
  },
  {
    slug: 'supplier-qualification',
    title: 'Supplier qualification',
    topic: 'qualification',
    audience: 'public',
    language: 'en',
    status: 'published',
    excerpt: 'What qualification programs are, how decisions are scoped and how they gate participation.',
    bodyMarkdown:
      '## Qualification programs\n\nSome buyers pre-qualify suppliers for a category, for example *Water Infrastructure Suppliers — Category A*. A decision states its scope (categories, maximum value), its effective dates and any conditions.\n\n## Effect on participation\n\nA notice states when qualification is required. Without a current decision you may still read public documents, but you cannot be invited to, or submit in, an event that requires it.\n\n## Keeping it current\n\nRenew evidence such as insurance certificates before they expire: an expired condition can suspend the qualification.',
    publishedAt: '2026-03-02T08:00:00Z',
    updatedAt: '2026-08-03T08:00:00Z',
  },
  {
    slug: 'preparing-and-submitting-a-response',
    title: 'Preparing and submitting a response',
    topic: 'submission',
    audience: 'public',
    language: 'en',
    status: 'published',
    excerpt: 'From the opportunity workspace to the official receipt: readiness, internal approval and submission.',
    bodyMarkdown:
      '## Before you start\n\nOpen the opportunity workspace. Accept any confidentiality undertaking, acknowledge every addendum and select the lots you will respond to. The readiness list shows anything that still blocks you.\n\n## Preparing\n\nAssign sections to your bid team. Drafts are private to your organization: the buyer never sees them.\n\n## Submitting\n\nOnly a person with submission authority can submit. A successful submission always produces an official receipt with the exact time in the official time zone. If you do not have a receipt, your response has **not** been submitted.',
    publishedAt: '2026-03-02T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
  {
    slug: 'official-deadlines-and-time-zones',
    title: 'Official deadlines and time zones',
    topic: 'submission',
    audience: 'all',
    language: 'en',
    status: 'published',
    excerpt: 'Every deadline is stated in the official time zone of the event, with the UTC offset.',
    bodyMarkdown:
      '## How deadlines are shown\n\nA deadline reads like **14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone**. The official time zone of the event decides; your local time is shown only as assistance.\n\n## Changes\n\nA deadline changes only by a formal addendum sent to every eligible participant. The amendment history of each notice lists every change.',
    publishedAt: '2026-03-02T08:00:00Z',
    updatedAt: '2026-06-20T08:00:00Z',
  },
  {
    slug: 'complaints-and-challenges',
    title: 'Complaints and challenges',
    topic: 'complaints',
    audience: 'public',
    language: 'en',
    status: 'published',
    excerpt: 'How to raise a complaint about a procurement, the deadlines that apply and what happens next.',
    bodyMarkdown:
      '## When you can complain\n\nParticipants can complain about a procurement decision within the period stated in the outcome notice.\n\n## How it is handled\n\nAn independent case owner acknowledges the complaint, assesses admissibility and investigates. A procurement hold may pause the award while the complaint is reviewed.\n\n## Support is not a submission channel\n\nService support can help with the platform, but it can never accept a bid or a complaint on your behalf.',
    publishedAt: '2026-03-09T08:00:00Z',
    updatedAt: '2026-05-11T08:00:00Z',
  },
  {
    slug: 'accessibility-assistance',
    title: 'Accessibility assistance',
    topic: 'accessibility',
    audience: 'all',
    language: 'en',
    status: 'published',
    excerpt: 'Keyboard access, screen readers, and how to request accommodation for briefings and site visits.',
    bodyMarkdown:
      '## Using TenderIQ with assistive technology\n\nEvery screen works with the keyboard and a screen reader. Colours meet WCAG 2.1 AA contrast in light and dark themes.\n\n## Briefings and site visits\n\nWhen you register for a session, describe any accessibility needs. The buyer confirms the accommodation before the session.',
    publishedAt: '2026-03-09T08:00:00Z',
    updatedAt: '2026-03-09T08:00:00Z',
  },
  {
    slug: 'contacting-the-buyer',
    title: 'Contacting the buyer during a procurement',
    topic: 'general',
    audience: 'public',
    language: 'en',
    status: 'published',
    excerpt: 'Use the official clarification channel of the notice; answers of general interest are published to all.',
    bodyMarkdown:
      '## The official channel\n\nEach notice names its contact channel. Ask questions through the clarification route of the notice before the questions deadline.\n\n## Fair treatment\n\nAnswers of general interest are published to every eligible participant without naming who asked.',
    publishedAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
  },
  {
    slug: 'how-evaluation-works',
    title: 'How evaluation works',
    topic: 'evaluation',
    audience: 'all',
    language: 'en',
    status: 'published',
    excerpt: 'Criteria, weights and price methods are fixed before release; evaluators score independently.',
    bodyMarkdown:
      '## Published rules\n\nThe evaluation criteria, weights, thresholds and price method are approved before the notice is released and are stated in the tender document.\n\n## Independent scoring\n\nEvaluators score independently before moderation. Prices stay sealed until the permitted stage.',
    publishedAt: '2026-04-06T08:00:00Z',
    updatedAt: '2026-04-06T08:00:00Z',
  },
  {
    slug: 'after-award-contracts',
    title: 'After award: contracts and performance',
    topic: 'contracts',
    audience: 'supplier',
    language: 'en',
    status: 'published',
    excerpt: 'Signing, obligations, milestone evidence and performance reviews for awarded suppliers.',
    bodyMarkdown:
      '## Signing\n\nThe authorized signatory signs the contract in TenderIQ. Differences from the award are highlighted before signature.\n\n## Performance\n\nSubmit milestone evidence from the contract workspace. You can dispute a performance finding within the stated period.',
    publishedAt: '2026-04-06T08:00:00Z',
    updatedAt: '2026-04-06T08:00:00Z',
  },
  {
    slug: 'buyer-publication-checklist',
    title: 'Publication checklist for tender owners',
    topic: 'general',
    audience: 'buyer',
    language: 'en',
    status: 'published',
    excerpt: 'Release approval, channels, external confirmation and reconciliation before an event counts as advertised.',
    bodyMarkdown:
      '## Before publishing\n\nThe release approval must match the current draft revision.\n\n## After publishing\n\nAn external notice counts only once its confirmation is received and reconciled with the official version.',
    publishedAt: '2026-04-13T08:00:00Z',
    updatedAt: '2026-04-13T08:00:00Z',
  },
  {
    slug: 'using-tenderiq-in-setswana',
    title: 'Using TenderIQ in Setswana',
    topic: 'general',
    audience: 'public',
    language: 'en',
    status: 'draft',
    excerpt: 'Language options for notices and the user interface.',
    bodyMarkdown: '## Languages\n\nThis article is being prepared.',
    publishedAt: null,
    updatedAt: '2026-09-21T08:00:00Z',
  },
]);
