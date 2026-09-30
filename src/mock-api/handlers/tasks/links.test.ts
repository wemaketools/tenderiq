/**
 * No dead ends from the workspace (COM-04, COM-06, plan §2): every task and notification link opens a screen its
 * recipient may open. Evaluation links are proven against the evaluation module itself (it answers 404 to anyone
 * outside the panel); guarded buyer screens are checked against the recipient's permissions in that organization.
 * The AC-18 escalation is also checked against the evaluation record it reports on.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { getEvaluation } from '../../../contracts/evaluation.js';
import { EVALUATIONS, EVALUATION_ASSIGNMENTS } from '../../fixtures/evaluation.js';
import { NOTIFICATIONS } from '../../fixtures/notifications.js';
import { TASKS } from '../../fixtures/tasks.js';
import { activeMemberships, findPersonaById, membershipPermissions } from '../../persona.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { subjectLinkGuard } from '../approvals/links.js';
import { register as registerEvaluation } from '../evaluation/index.js';

interface WorkspaceLink {
  readonly label: string;
  readonly userId: number;
  readonly tenantId: number;
  readonly link: string;
}

const EVALUATION_LINK = /^\/buyer\/evaluation\/tenders\/(\d+)$/;

function workspaceLinks(): WorkspaceLink[] {
  const links: WorkspaceLink[] = [];
  for (const task of TASKS) {
    if (task.sourceLinkPath === null || (task.status !== 'open' && task.status !== 'in_progress')) continue;
    const owners = task.assigneeUserId === null ? [] : [task.assigneeUserId];
    for (const userId of owners) {
      links.push({ label: `task ${task.id}`, userId, tenantId: task.tenantId, link: task.sourceLinkPath });
    }
  }
  for (const notification of NOTIFICATIONS) {
    if (notification.linkPath === null) continue;
    links.push({
      label: `notification ${notification.id}`,
      userId: notification.recipientUserId,
      tenantId: notification.tenantId,
      link: notification.linkPath,
    });
  }
  return links;
}

function permissionsOf(userId: number, tenantId: number): readonly string[] {
  const persona = findPersonaById(userId);
  const membership = persona === undefined ? undefined : activeMemberships(persona).find((row) => row.tenantId === tenantId);
  return membership === undefined ? [] : membershipPermissions(membership);
}

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'evaluation', register: registerEvaluation }] });
});

describe('workspace links', () => {
  it('open an evaluation only for people the evaluation module lets in', async () => {
    const evaluationLinks = workspaceLinks().filter((row) => EVALUATION_LINK.test(row.link));
    expect(evaluationLinks.length).toBeGreaterThan(0);
    for (const row of evaluationLinks) {
      const persona = findPersonaById(row.userId);
      const tenderId = Number(EVALUATION_LINK.exec(row.link)?.[1]);
      expect(persona, row.label).toBeDefined();
      const response = await api.callAs(persona?.email ?? '', getEvaluation, { params: { tenderId }, tenant: row.tenantId });
      expect(response.status, `${row.label} → ${row.link} as ${persona?.email ?? row.userId}`).not.toBe(404);
    }
  });

  it('open guarded buyer screens only for recipients holding the screen permission', () => {
    for (const row of workspaceLinks()) {
      const guard = subjectLinkGuard(row.link);
      if (guard === undefined || guard.anyOf.length === 0) continue;
      const held = permissionsOf(row.userId, row.tenantId);
      expect(guard.anyOf.some((code) => held.includes(code)), `${row.label} → ${row.link}`).toBe(true);
    }
  });

  it('send the procurement manager’s AC-18 escalation to the tender overview, never to the evaluation', () => {
    const escalation = TASKS.find((task) => task.id === 120);
    expect(escalation?.sourceLinkPath).toBe('/buyer/tenders/3');
    const notice = NOTIFICATIONS.find((row) => row.id === 507);
    expect(notice?.linkPath).toBe('/buyer/tenders/3');
  });
});

describe('AC-18 on T-2026-0003', () => {
  it('names the evaluator, criterion and bidder that the evaluation record shows as missing', () => {
    const t3 = EVALUATIONS.find((row) => row.tender.tenderId === 3 && row.lot === null);
    expect(t3).toBeDefined();
    const assignments = EVALUATION_ASSIGNMENTS.filter((row) => row.evaluationKey === t3?.key);
    const incomplete = assignments.filter((row) => !row.isCommercial && row.status === 'in_progress');
    const evaluator = findPersonaById(incomplete[0]?.evaluatorUserId ?? 0);
    expect(incomplete).toHaveLength(1);
    expect(evaluator?.fullName).toBe('Amantle Segwai');
    const criterion = t3?.plan.criteria.find((row) => row.code === 'C3');
    expect(criterion?.name).toBe('Relevant experience');

    const escalation = TASKS.find((task) => task.id === 120);
    const alerts = NOTIFICATIONS.filter((row) => [507, 522, 524].includes(row.id));
    for (const text of [escalation?.title ?? '', escalation?.description ?? '', ...alerts.flatMap((row) => [row.title, row.body])]) {
      expect(text).not.toMatch(/\bT4\b|Kabo/);
    }
    expect(escalation?.description).toContain('Amantle Segwai');
    expect(escalation?.description).toContain('C3 Relevant experience');

    // Submitted assessments and the finalized moderation are completed work in the inbox.
    const submitted = assignments.filter((row) => row.status === 'submitted').map((row) => row.evaluatorUserId);
    const scoringTasks = TASKS.filter((task) => task.title === 'Score technical criteria for T-2026-0003');
    for (const task of scoringTasks) {
      const done = submitted.includes(task.assigneeUserId ?? 0);
      expect(task.status === 'completed', `task ${task.id}`).toBe(done);
    }
    expect(TASKS.find((task) => task.id === 125)?.status).toBe('completed');
    expect(t3?.moderation?.status).toBe('finalized');
  });
});
