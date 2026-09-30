import { describe, expect, it } from 'vitest';

import { isPermitted } from '@contracts/endpoint';
import { permissionsForTemplates } from '@contracts/permissions';
import type { PermissionCode } from '@contracts/permissions';
import { requestEndpoints } from '@contracts/requests';

import { features } from './routes';

function allows(
  requirement: PermissionCode | readonly PermissionCode[] | undefined,
  held: readonly string[],
) {
  if (requirement === undefined) return true;
  const list: readonly string[] = typeof requirement === 'string' ? [requirement] : requirement;
  return list.some((code) => held.includes(code));
}

const requester = permissionsForTemplates(['requester']);
const officer = permissionsForTemplates(['procurement_officer']);
const auditor = permissionsForTemplates(['auditor']);

describe('requests feature routes and navigation', () => {
  const [module] = features;
  const nav = module?.nav ?? [];
  const route = (path: string) => module?.routes.find((item) => item.path === path);

  it('registers every screen route in the buyer area', () => {
    expect(module?.area).toBe('buyer');
    expect(module?.routes.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        'requests',
        'requests/new',
        'requests/:requestId',
        'requests/:requestId/edit',
        'requests/:requestId/decision',
        'strategies',
        'strategies/:strategyId',
      ]),
    );
  });

  it('shows the requests entry to a requester but hides strategy when the requester lacks strategy access', () => {
    const visible = nav.filter((item) => allows(item.permission, requester)).map((item) => item.id);
    expect(visible).toEqual(['buyer.requests']);
  });

  it('shows both entries to a procurement officer in the planning section', () => {
    const visible = nav.filter((item) => allows(item.permission, officer));
    expect(visible.map((item) => item.id)).toEqual(['buyer.requests', 'buyer.strategies']);
    expect(visible.every((item) => item.section === 'planning')).toBe(true);
  });

  it('guards the decision workspace so a requester cannot open it', () => {
    expect(allows(route('requests/:requestId/decision')?.permission, requester)).toBe(false);
    expect(allows(route('requests/:requestId/decision')?.permission, auditor)).toBe(true);
    expect(allows(route('requests/new')?.permission, auditor)).toBe(false);
  });

  it('matches the route guards with the API permissions of the endpoints they call', () => {
    expect(isPermitted(requestEndpoints.listRequests, requester)).toBe(
      allows(route('requests')?.permission, requester),
    );
    expect(isPermitted(requestEndpoints.listStrategies, auditor)).toBe(
      allows(route('strategies')?.permission, auditor),
    );
  });
});
