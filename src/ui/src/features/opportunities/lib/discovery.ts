/**
 * The default SUP-06 discovery filters (kept per tenant in the screen filters store).
 */
export const DISCOVER_DEFAULTS = {
  q: '',
  buyer: '',
  category: '',
  region: '',
  procedure: '',
  eventType: '',
  status: '',
  closingFrom: '',
  closingTo: '',
  matchedOnly: false,
  watchedOnly: false,
  participatingOnly: false,
  includeDismissed: false,
  savedSearchId: '',
  sort: 'closingAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};
