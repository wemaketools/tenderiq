import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/client';
import { t } from '../../lib/i18n';
import { describeError, isBusinessRefusal } from './errors';

function forbidden(code: string | null, detail: string | null): ApiError {
  return new ApiError({
    kind: 'forbidden',
    status: 403,
    title: 'Forbidden',
    code,
    detail,
    endpointId: 'x.y',
  });
}

describe('describeError', () => {
  it('explains a business refusal with the problem detail', () => {
    // Arrange
    const error = forbidden(
      'SELF_APPROVAL_BLOCKED',
      'You requested this approval and cannot decide it (BR-07).',
    );

    // Act
    const text = describeError(error);

    // Assert
    expect(isBusinessRefusal(error)).toBe(true);
    expect(text).toBe('You requested this approval and cannot decide it (BR-07).');
  });

  it.each([
    ['FORBIDDEN', 'You do not have permission for this action in this organization.'],
    ['TENANT_ACCESS_DENIED', 'Access denied.'],
    [null, 'Something'],
    ['SELF_APPROVAL_BLOCKED', null],
  ])('keeps the generic restricted text for code %s', (code, detail) => {
    const error = forbidden(code, detail);

    expect(isBusinessRefusal(error)).toBe(false);
    expect(describeError(error)).toBe(t('ui.restricted.description'));
  });
});
