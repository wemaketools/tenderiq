/**
 * Test kit of the evaluation screens: a session for a persona's role templates and a router for the mocked `call` of
 * the API client module. Every routed response is parsed with the endpoint's contract schema, so the test data stays
 * contract-valid.
 *
 * Each test file mocks the client module itself (hoisted):
 * `vi.mock('../../../api/client', async (original) => ({ ...(await original<object>()), call: vi.fn() }));`
 */
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { AnyEndpoint } from '@contracts/endpoint';
import { permissionsForTemplates } from '@contracts/permissions';
import type { RoleTemplateCode } from '@contracts/permissions';

import { ApiError, call } from '../../../api/client';
import { makeTenant, makeUser, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';

export interface Persona {
  readonly userId: number;
  readonly fullName: string;
  readonly capacity: string;
  readonly templates: readonly RoleTemplateCode[];
}

export const CHAIR: Persona = {
  userId: 10,
  fullName: 'Boitumelo Kgari',
  capacity: 'Evaluation Chair',
  templates: ['evaluation_chair'],
};
export const EVALUATOR: Persona = {
  userId: 13,
  fullName: 'Amantle Segwai',
  capacity: 'Evaluator, Water Quality',
  templates: ['evaluator'],
};
export const COMMERCIAL: Persona = {
  userId: 14,
  fullName: 'Refilwe Motsumi',
  capacity: 'Commercial Reviewer',
  templates: ['commercial_reviewer'],
};
export const OFFICER: Persona = {
  userId: 5,
  fullName: 'Tebogo Molefe',
  capacity: 'Procurement Officer',
  templates: ['procurement_officer'],
};
export const THATO: Persona = {
  userId: 11,
  fullName: 'Thato Mokgosi',
  capacity: 'Evaluator, Technical Services',
  templates: ['evaluator'],
};

export function sessionFor(persona: Persona) {
  return signedInSession({
    user: makeUser({ id: persona.userId, fullName: persona.fullName }),
    activeTenant: makeTenant(
      { capacity: persona.capacity },
      permissionsForTemplates([...persona.templates]),
    ),
  });
}

export interface RenderPageOptions {
  readonly path: string;
  readonly route: string;
  readonly persona?: Persona;
}

export function renderPage(element: ReactElement, options: RenderPageOptions) {
  return renderWithProviders(element, {
    path: options.path,
    route: options.route,
    state: { session: sessionFor(options.persona ?? CHAIR) },
    routes: [{ path: '*', element: <p data-testid="elsewhere">elsewhere</p> }],
  });
}

export interface RecordedCall {
  readonly id: string;
  readonly request: Record<string, unknown>;
}

type Handler = (request: Record<string, unknown>) => unknown;

/**
 * Routes `call(endpoint, request)` by endpoint id and validates each response with the contract. Unrouted calls fail
 * with 404. Returns the recorded calls.
 */
export function routeCalls(handlers: Record<string, Handler>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.mocked(call).mockImplementation(((endpoint: AnyEndpoint, request: Record<string, unknown>) => {
    calls.push({ id: endpoint.id, request });
    const handler = handlers[endpoint.id];
    if (handler === undefined) {
      return Promise.reject(
        new ApiError({
          kind: 'not_found',
          status: 404,
          title: 'Not Found',
          endpointId: endpoint.id,
        }),
      );
    }
    try {
      return Promise.resolve(endpoint.response.parse(handler(request)));
    } catch (error) {
      return Promise.reject(error);
    }
  }) as typeof call);
  return calls;
}

export function businessError(
  endpointId: string,
  code: string,
  status = 409,
  detail: string | null = null,
): ApiError {
  return new ApiError({
    kind:
      status === 422
        ? 'validation'
        : status === 403
          ? 'forbidden'
          : status === 404
            ? 'not_found'
            : 'conflict',
    status,
    title: 'Request refused',
    code,
    detail,
    correlationId: 'corr-1',
    endpointId,
  });
}
