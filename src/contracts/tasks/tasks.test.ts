import { describe, expect, it } from 'vitest';

import { TaskListQuery } from '../tasks.js';

describe('tasks contract extensions (COM-04)', () => {
  it('parses source-type, delegation and group filters', () => {
    expect(TaskListQuery.parse({ sourceType: 'approval_request', delegated: 'true', groupAssigned: 'false' })).toMatchObject({
      sourceType: ['approval_request'],
      delegated: true,
      groupAssigned: false,
    });
  });

  it('refuses a malformed source type', () => {
    expect(TaskListQuery.safeParse({ sourceType: 'Approval Request' }).success).toBe(false);
  });
});
