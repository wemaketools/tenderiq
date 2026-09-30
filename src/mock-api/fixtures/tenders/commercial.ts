/**
 * Pricing schedules, pricing items and commercial terms of the demo tenders (BUY-10).
 *
 * Id scheme: schedule `tenderId*100 + 50 + n`, item `scheduleId*100 + n`, term `tenderId*100 + 80 + n`.
 * One-time and recurring charges, optional and provisional items and evaluation periods all appear. T-2026-0012
 * shows the pricing warnings: an empty schedule, recurring charges without evaluation periods, discounts accepted
 * without a stated comparison basis, no draft contract. Discount rules and accepted price entries (priced, zero,
 * included, not offered: distinct answers, PRD §7.4) are declared per schedule.
 */
import { TENANT_IDS } from '../platform.js';
import { DEFAULT_PRICE_ENTRIES } from '../../../contracts/tenders.js';
import type { FxPricingItem, FxPricingSchedule, FxTerm } from './types.js';

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

const VAT = 'Quote prices exclusive of VAT (14 %); show VAT separately. Import duties and delivery to site are included.';

type ItemSpec = readonly [
  itemCode: string,
  description: string,
  unit: string,
  quantity: string,
  options?: Partial<Pick<FxPricingItem, 'chargeType' | 'recurrence' | 'isOptional' | 'isProvisional' | 'includeInEvaluation'>>,
];

function schedule(
  tenderId: number,
  n: number,
  fields: Omit<FxPricingSchedule, 'id' | 'tenantId' | 'tenderId' | 'items' | 'discountsAccepted' | 'discountEvaluationNote' | 'priceEntries'> &
    Partial<Pick<FxPricingSchedule, 'discountsAccepted' | 'discountEvaluationNote' | 'priceEntries'>> & { tenantId?: number },
  items: readonly ItemSpec[],
): FxPricingSchedule {
  const id = tenderId * 100 + 50 + n;
  return {
    id,
    tenantId: KWU,
    tenderId,
    discountsAccepted: [],
    discountEvaluationNote: null,
    priceEntries: DEFAULT_PRICE_ENTRIES,
    ...fields,
    items: items.map(([itemCode, description, unit, quantity, options = {}], index) => ({
      id: id * 100 + index + 1,
      itemCode,
      description,
      unit,
      quantity,
      chargeType: 'one_time',
      recurrence: null,
      isOptional: false,
      isProvisional: false,
      includeInEvaluation: true,
      sortOrder: (index + 1) * 10,
      ...options,
    })),
  };
}

/** T-2026-0005: conditional and multi-lot package discounts, applied only to award combinations that meet them. */
const CHEMICAL_DISCOUNTS = {
  discountsAccepted: ['conditional', 'package'],
  discountEvaluationNote:
    'Package discounts across lots enter comparison only for award combinations that meet their conditions. Conditional discounts (volume, early payment) are recorded but not evaluated.',
} as const;

const MONTHLY = { chargeType: 'recurring', recurrence: 'monthly' } as const;
const OPTIONAL = { isOptional: true, includeInEvaluation: false } as const;
const PROVISIONAL = { isProvisional: true, includeInEvaluation: false } as const;

export const PRICING_SCHEDULES: readonly FxPricingSchedule[] = Object.freeze([
  schedule(1, 1, { lotId: 101, name: 'Lot 1 — Submersible pumps', instructions: 'Price each pump size installed and commissioned.', taxTreatment: VAT, evaluationPeriods: null }, [
    ['L1-01', 'Submersible pump 7.5 kW with motor and cable', 'each', '10'],
    ['L1-02', 'Submersible pump 15 kW with motor and cable', 'each', '8'],
    ['L1-03', 'Submersible pump 30 kW with motor and cable', 'each', '6'],
    ['L1-04', 'Installation and commissioning per site', 'site', '24'],
    ['L1-05', 'Spare motor kit (optional)', 'each', '4', OPTIONAL],
  ]),
  schedule(1, 2, { lotId: 102, name: 'Lot 2 — Solar pumping systems', instructions: null, taxTreatment: VAT, evaluationPeriods: null }, [
    ['L2-01', 'Solar pumping system with 8 kWp array', 'each', '12'],
    ['L2-02', 'Security fencing per site', 'site', '12'],
  ]),
  schedule(1, 3, { lotId: 103, name: 'Lot 3 — Controls and telemetry', instructions: null, taxTreatment: VAT, evaluationPeriods: null }, [
    ['L3-01', 'Variable-speed control panel', 'each', '36'],
    ['L3-02', 'Telemetry integration per site', 'site', '36'],
    ['L3-03', 'Provisional sum: SCADA vendor interface fees', 'sum', '1', PROVISIONAL],
  ]),
  schedule(2, 1, { lotId: null, name: 'Smart meters', instructions: 'Unit prices delivered to Gaborone central stores.', taxTreatment: VAT, evaluationPeriods: null, discountsAccepted: ['unconditional'], discountEvaluationNote: 'Unconditional volume discounts are deducted from the evaluated price. Early-payment discounts are recorded but not evaluated.' }, [
    ['M-01', 'Ultrasonic meter DN15 with AMR module', 'each', '5200'],
    ['M-02', 'Ultrasonic meter DN20 with AMR module', 'each', '800'],
    ['M-03', 'Head-end software licence (first year)', 'lot', '1'],
    ['M-04', 'Head-end software licence renewal', 'year', '4', { chargeType: 'recurring', recurrence: 'annual', ...OPTIONAL }],
  ]),
  schedule(3, 1, { lotId: null, name: 'SCADA upgrade and support', instructions: 'Evaluated cost includes five years of support.', taxTreatment: VAT, evaluationPeriods: 60 }, [
    ['S-01', 'RTU hardware and installation', 'site', '42'],
    ['S-02', 'Master station software and configuration', 'lot', '1'],
    ['S-03', 'Training (operators and engineers)', 'course', '4'],
    ['S-04', 'Support and maintenance', 'month', '60', MONTHLY],
  ]),
  schedule(4, 1, { lotId: null, name: 'Indicative pricing (information only)', instructions: 'Indicative only; not evaluated.', taxTreatment: null, evaluationPeriods: null }, [
    ['I-01', 'Indicative rate per km surveyed', 'km', '1', { includeInEvaluation: false }],
    ['I-02', 'Indicative rate per confirmed leak', 'leak', '1', { includeInEvaluation: false }],
  ]),
  schedule(5, 1, { lotId: 501, name: 'Lot 1 — Aluminium sulphate', instructions: 'Year-one fixed price per tonne delivered; years two and three adjust by the published formula.', taxTreatment: VAT, evaluationPeriods: 3, ...CHEMICAL_DISCOUNTS }, [
    ['C1-01', 'Aluminium sulphate, granular, delivered', 'tonne', '1800'],
  ]),
  schedule(5, 2, { lotId: 502, name: 'Lot 2 — Calcium hypochlorite', instructions: 'Price per 45 kg drum delivered.', taxTreatment: VAT, evaluationPeriods: 3, ...CHEMICAL_DISCOUNTS }, [
    ['C2-01', 'Calcium hypochlorite granules 65–70 %, 45 kg drum', 'drum', '5333'],
    ['C2-02', 'Drum return and recycling', 'drum', '5333', OPTIONAL],
  ]),
  schedule(5, 3, { lotId: 503, name: 'Lot 3 — Polyelectrolyte', instructions: 'Price per 25 kg bag delivered.', taxTreatment: VAT, evaluationPeriods: 3, ...CHEMICAL_DISCOUNTS }, [
    ['C3-01', 'Cationic polyelectrolyte, 25 kg bag', 'bag', '2400'],
    ['C3-02', 'On-site jar testing (provisional)', 'visit', '6', PROVISIONAL],
  ]),
  schedule(6, 1, { lotId: null, name: 'Chlorine dosing equipment', instructions: null, taxTreatment: VAT, evaluationPeriods: null }, [
    ['D-01', 'Gas chlorinator 10 kg/h with vacuum regulator', 'each', '4'],
    ['D-02', 'Dosing control panel', 'each', '2'],
    ['D-03', 'Installation and commissioning', 'site', '2'],
  ]),
  schedule(7, 1, { lotId: null, name: 'Bill of quantities', instructions: 'Complete every item. Mark an item “included” when its cost is carried in another item; a zero rate is a price of zero and is evaluated as zero. Every item must be offered.', taxTreatment: VAT, evaluationPeriods: null, priceEntries: ['priced', 'zero', 'included'] }, [
    ['B-01', 'Preliminaries and general', 'sum', '1'],
    ['B-02', 'Concrete repairs', 'm2', '1450'],
    ['B-03', 'Epoxy relining', 'm2', '6200'],
    ['B-04', 'Roof replacement', 'm2', '2100'],
    ['B-05', 'Provisional sum: unforeseen structural repairs', 'sum', '1', PROVISIONAL],
  ]),
  schedule(8, 1, { lotId: 801, name: 'Lot 1 — Gate and butterfly valves', instructions: null, taxTreatment: VAT, evaluationPeriods: null }, [
    ['V1-01', 'Gate valve DN100–DN300 (all sizes)', 'each', '220'],
    ['V1-02', 'Butterfly valve DN350–DN600 (all sizes)', 'each', '90'],
  ]),
  schedule(8, 2, { lotId: 802, name: 'Lot 2 — Air-release valves', instructions: null, taxTreatment: VAT, evaluationPeriods: null }, [
    ['V2-01', 'Double-orifice air-release valve DN80', 'each', '120'],
  ]),
  schedule(9, 1, { lotId: null, name: 'Survey rates', instructions: 'Rates for stage 2 invitees only.', taxTreatment: VAT, evaluationPeriods: null }, [
    ['A-01', 'Acoustic survey per km of mains', 'km', '1200'],
    ['A-02', 'Leak pinpointing per confirmed leak', 'leak', '350'],
    ['A-03', 'Mobilization', 'sum', '1'],
  ]),
  schedule(10, 1, { lotId: null, name: 'Fleet maintenance fees', instructions: 'Monthly fee per vehicle class; parts at cost plus the quoted margin.', taxTreatment: VAT, evaluationPeriods: 12 }, [
    ['F-01', 'Light vehicle scheduled maintenance', 'vehicle-month', '62', MONTHLY],
    ['F-02', 'Heavy vehicle scheduled maintenance', 'vehicle-month', '24', MONTHLY],
    ['F-03', 'Parts margin (%)', 'percent', '1', { includeInEvaluation: false }],
  ]),
  schedule(11, 1, { tenantId: ODC, lotId: null, name: 'Cleaning services', instructions: 'Monthly fee per site.', taxTreatment: VAT, evaluationPeriods: 24 }, [
    ['CL-01', 'Daily cleaning, Maun offices', 'month', '24', MONTHLY],
    ['CL-02', 'Daily cleaning, Shakawe offices', 'month', '24', MONTHLY],
    ['CL-03', 'Deep cleaning (quarterly)', 'visit', '8'],
  ]),
  schedule(12, 1, { lotId: 1201, name: 'Lot 1 — Switchgear and motors', instructions: 'Monthly maintenance fee per works.', taxTreatment: VAT, evaluationPeriods: null, discountsAccepted: ['unconditional'] }, [
    ['E1-01', 'Preventive maintenance, per works', 'works-month', '4', MONTHLY],
    ['E1-02', 'Emergency call-out', 'call-out', '24'],
    ['E1-03', 'Thermographic survey (provisional)', 'survey', '4', { isProvisional: true }],
  ]),
  schedule(12, 2, { lotId: 1202, name: 'Lot 2 — Standby generators', instructions: null, taxTreatment: VAT, evaluationPeriods: null }, []),
]);

function term(tenderId: number, n: number, termType: FxTerm['termType'], content: string, updatedAt: string, tenantId: number = KWU): FxTerm {
  return { id: tenderId * 100 + 80 + n, tenantId, tenderId, termType, content, documentId: null, updatedAt };
}

const COMPLAINTS =
  'Complaints go to the KWU independent complaints officer within 10 working days of the notice concerned. The procurement is held while an admissible complaint is decided.';
const PRECEDENCE = '1. Addenda (latest first); 2. Instructions to tenderers; 3. Specification; 4. Pricing schedule; 5. Draft contract.';

function standardTerms(tenderId: number, at: string, draftContract: string, extra: readonly FxTerm[] = []): FxTerm[] {
  return [
    { ...term(tenderId, 1, 'draft_contract', draftContract, at), documentId: 7000 + tenderId * 10 + 4 },
    term(tenderId, 2, 'insurance', 'Public liability of at least BWP 5 million and employer’s liability as required by law.', at),
    term(tenderId, 3, 'confidentiality', 'Tender documents are confidential to participating suppliers and may not be shared.', at),
    term(tenderId, 4, 'complaint_process', COMPLAINTS, at),
    term(tenderId, 5, 'payment', 'Payment within 30 days of an undisputed invoice.', at),
    term(tenderId, 6, 'document_precedence', PRECEDENCE, at),
    ...extra,
  ];
}

export const TENDER_TERMS: readonly FxTerm[] = Object.freeze([
  ...standardTerms(1, '2026-06-08T08:00:00Z', 'KWU General Conditions of Contract for Goods (2025 edition) with lot-specific particular conditions.'),
  ...standardTerms(2, '2026-09-07T08:00:00Z', 'KWU General Conditions of Contract for Goods (2025 edition).'),
  ...standardTerms(3, '2026-07-13T08:00:00Z', 'KWU conditions for design, supply and support of ICT systems.', [
    term(3, 7, 'security', 'Performance security of 10 % of the contract price until final acceptance.', '2026-07-13T08:00:00Z'),
  ]),
  ...standardTerms(5, '2026-09-28T09:14:00Z', 'KWU framework agreement for consumables with call-off order terms.', [
    term(5, 7, 'security', 'No bid security. Framework suppliers provide a 5 % performance security on each call-off above BWP 100,000.', '2026-09-21T08:00:00Z'),
    term(5, 8, 'other', 'Prices are fixed for year one and adjusted annually by the published chemical price index formula.', '2026-09-21T08:00:00Z'),
  ]),
  ...standardTerms(6, '2026-09-14T08:00:00Z', 'KWU General Conditions of Contract for Goods (2025 edition).'),
  ...standardTerms(7, '2026-05-04T08:00:00Z', 'FIDIC Short Form of Contract (2021) with KWU particular conditions.', [
    term(7, 7, 'security', 'Performance security of 10 % of the contract price; retention of 5 % released after the defects period.', '2026-05-04T08:00:00Z'),
  ]),
  ...standardTerms(8, '2026-08-17T08:00:00Z', 'KWU General Conditions of Contract for Goods (2025 edition).'),
  ...standardTerms(9, '2026-06-29T08:00:00Z', 'KWU services agreement with survey performance schedule.'),
  ...standardTerms(
    10,
    '2025-12-15T08:00:00Z',
    'KWU services agreement (12 months, with one 12-month renewal option and one 3-month extension option) with service-level schedule.',
  ),
  term(11, 1, 'draft_contract', 'ODC standard services contract (24 months).', '2026-09-09T08:00:00Z', ODC),
  term(11, 2, 'payment', 'Payment within 30 days of invoice.', '2026-09-09T08:00:00Z', ODC),
  term(12, 2, 'insurance', 'Public liability of at least BWP 5 million.', '2026-09-29T14:20:00Z'),
  term(12, 5, 'payment', 'Monthly in arrears within 30 days of an undisputed invoice.', '2026-09-29T14:20:00Z'),
]);
