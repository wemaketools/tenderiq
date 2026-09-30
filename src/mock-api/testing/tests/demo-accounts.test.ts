/**
 * The dev-only demo-accounts quick-pick of the SPA (src/ui/src/auth/demoAccountList.ts, DD-43) must list exactly the
 * fixture personas that can sign in. The SPA may not import the mock API, so this test compares the two from here.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { PERSONAS } from '../../fixtures/platform.js';

const DemoAccountGroups = z.array(
  z.object({
    organization: z.string().min(1),
    accounts: z.array(z.object({ email: z.string().min(3), fullName: z.string().min(1), role: z.string().min(1) })),
  }),
);

const demoAccountListPath = fileURLToPath(new URL('../../../ui/src/auth/demoAccountList.ts', import.meta.url));

let accounts: Array<{ email: string; fullName: string }>;

beforeAll(async () => {
  const module = (await import(pathToFileURL(demoAccountListPath).href)) as { DEMO_ACCOUNT_GROUPS?: unknown };
  accounts = DemoAccountGroups.parse(module.DEMO_ACCOUNT_GROUPS).flatMap((group) => group.accounts);
});

describe('demo accounts quick-pick', () => {
  it('lists every fixture persona exactly once', () => {
    // Arrange
    const listed = accounts.map((account) => account.email);

    // Act
    const missing = PERSONAS.map((persona) => persona.email).filter((email) => !listed.includes(email));
    const duplicated = listed.filter((email, index) => listed.indexOf(email) !== index);

    // Assert
    expect(missing).toEqual([]);
    expect(duplicated).toEqual([]);
  });

  it('lists no account without a fixture persona, and shows each persona under its fixture name', () => {
    const byEmail = new Map(PERSONAS.map((persona) => [persona.email, persona.fullName]));
    expect(accounts.filter((account) => !byEmail.has(account.email)).map((account) => account.email)).toEqual([]);
    expect(accounts.filter((account) => byEmail.get(account.email) !== account.fullName).map((account) => account.email)).toEqual([]);
  });
});
