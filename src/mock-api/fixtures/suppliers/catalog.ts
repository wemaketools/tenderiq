/**
 * The shared category catalog (`category_catalog` [G], blueprint Migration 02) used for supplier discovery:
 * registration, profiles and the buyer directory filter. `WTR-INFRA` is the parent of `WTR-PUMP` and `WTR-PIPE`; a category scope includes its descendants (DD-26, demo storyline "Qualification").
 */
import type { CategoryOption, ReferenceOptions } from '../../../contracts/suppliers.js';

export const CATEGORY_CATALOG: readonly CategoryOption[] = Object.freeze([
  { code: 'WTR-INFRA', name: 'Water infrastructure', parentCode: null, description: 'Supply, installation and maintenance of water network assets.' },
  { code: 'WTR-PUMP', name: 'Pumps and mechanical equipment', parentCode: 'WTR-INFRA', description: 'Borehole and booster pumps, motors, mechanical installation.' },
  { code: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentCode: 'WTR-INFRA', description: 'Pipeline materials, bulk valves and fittings.' },
  { code: 'WTR-METER', name: 'Water meters and metering', parentCode: null, description: 'Customer and bulk meters, smart metering and meter reading.' },
  { code: 'WTR-TREAT', name: 'Water treatment', parentCode: null, description: 'Treatment works, chemicals and dosing.' },
  { code: 'WTR-CHEM', name: 'Treatment chemicals', parentCode: 'WTR-TREAT', description: 'Chlorine, coagulants and other treatment chemicals.' },
  { code: 'WTR-DOSE', name: 'Dosing equipment', parentCode: 'WTR-TREAT', description: 'Chemical dosing systems and controls.' },
  { code: 'ICT', name: 'ICT and telemetry', parentCode: null, description: 'Information and operational technology.' },
  { code: 'ICT-SCADA', name: 'SCADA and telemetry', parentCode: 'ICT', description: 'Supervisory control, telemetry and remote monitoring.' },
  { code: 'ICT-NET', name: 'Networks and communications', parentCode: 'ICT', description: 'Data networks, radio links and communications.' },
  { code: 'CIV', name: 'Civil works', parentCode: null, description: 'Construction and rehabilitation works.' },
  { code: 'CIV-RES', name: 'Reservoirs and tanks', parentCode: 'CIV', description: 'Reservoir construction and rehabilitation.' },
  { code: 'CIV-GEN', name: 'General civil works', parentCode: 'CIV', description: 'Earthworks, trenching and structures.' },
  { code: 'ENV', name: 'Environmental services', parentCode: null, description: 'Environmental and network loss services.' },
  { code: 'ENV-LEAK', name: 'Leak detection', parentCode: 'ENV', description: 'Acoustic and correlator leak detection services.' },
  { code: 'ENV-CONS', name: 'Environmental consulting', parentCode: 'ENV', description: 'Impact assessments and environmental monitoring.' },
  { code: 'FAC', name: 'Facilities services', parentCode: null, description: 'Building and facilities services.' },
  { code: 'FAC-CLEAN', name: 'Cleaning services', parentCode: 'FAC', description: 'Office and facility cleaning.' },
  { code: 'FLT', name: 'Fleet services', parentCode: null, description: 'Vehicle fleet services.' },
  { code: 'FLT-MAINT', name: 'Vehicle maintenance', parentCode: 'FLT', description: 'Servicing and repair of fleet vehicles.' },
] satisfies CategoryOption[]);

const byCode = new Map(CATEGORY_CATALOG.map((category) => [category.code, category]));

export function findCategory(code: string): CategoryOption | undefined {
  return byCode.get(code);
}

/** The code itself plus every descendant (a category scope includes descendants, DD-26). */
export function categoryWithDescendants(code: string): Set<string> {
  const result = new Set<string>([code]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of CATEGORY_CATALOG) {
      if (category.parentCode !== null && result.has(category.parentCode) && !result.has(category.code)) {
        result.add(category.code);
        grew = true;
      }
    }
  }
  return result;
}

/**
 * Reference lists of the supplier forms (platform configuration in Stage B): the countries the platform serves, the
 * currencies accepted on evidence and the deployment's default country (demo storyline: Botswana, BWP).
 */
export const REFERENCE_OPTIONS: ReferenceOptions = Object.freeze({
  countries: [
    { code: 'BW', name: 'Botswana' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'NA', name: 'Namibia' },
    { code: 'ZM', name: 'Zambia' },
    { code: 'ZW', name: 'Zimbabwe' },
  ],
  currencies: [
    { code: 'BWP', name: 'Botswana pula' },
    { code: 'ZAR', name: 'South African rand' },
    { code: 'USD', name: 'US dollar' },
    { code: 'EUR', name: 'Euro' },
  ],
  defaultCountry: 'BW',
} satisfies ReferenceOptions);
