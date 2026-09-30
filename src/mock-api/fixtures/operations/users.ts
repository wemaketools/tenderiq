/**
 * Persona user ids used by the operations fixtures (foundation-contract §5). A module of its own so every
 * operations fixture can name people without importing `customers.ts`, which derives usage counts from the
 * integrations fixture (no import cycle).
 */
export const OPS_USERS = {
  opsAdmin: 1,
  supportAgent: 2,
  adminKwu: 3,
  mphoManager: 4,
  tebogoOfficer: 5,
  lesegoFinance: 9,
  masegoContracts: 19,
  puleAuditor: 20,
  adminOdc: 22,
  officerOdc: 23,
  tsodiloAdmin: 24,
  tsodiloBidManager: 25,
  chobeAdmin: 28,
  chobeBidManager: 29,
  seroweAdmin: 32,
  gaboroneMeterAdmin: 36,
  gaboroneMeterBidManager: 37,
  makgadikgadiAdmin: 40,
  limpopoAdmin: 41,
} as const;
