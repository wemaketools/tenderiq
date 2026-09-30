/**
 * Mock handlers of the tasks contract (`src/contracts/tasks.ts`; COM-04, FR-21, DD-16, DD-21).
 *
 * - The inbox lists the caller's OWN tasks (assigned personally, or to one of the caller's groups) across every
 *   active membership, each labelled with its organization. Nobody else's task is ever visible: another person's
 *   task is simply not found.
 * - Actions carry `X-Tenant-Id` = the task's tenant; a mismatch answers TASK_TENANT_MISMATCH. Commands return the
 *   task as it would be after the action; nothing is stored.
 */
import type { ReassignCandidate, TaskAction, TaskDetail, TaskItem, TaskSummary } from '../../../contracts/tasks.js';
import {
  completeMyTask,
  getMyTask,
  getMyTaskSummary,
  listMyTasks,
  listReassignCandidates,
  reassignMyTask,
  returnMyTask,
} from '../../../contracts/tasks.js';
import type { TasksStatus } from '../../../contracts/enums.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { WORKSPACE_AS_OF, storylineInstant } from '../../fixtures/approvals/world.js';
import { TASKS, findFixtureTask, findGroup } from '../../fixtures/tasks.js';
import type { FixtureTask } from '../../fixtures/tasks.js';
import { activeMemberships, allPersonas, membershipPermissions, organizationLabel, personRef } from '../../persona.js';
import type { Persona } from '../../persona.js';

const OPEN_STATUSES: readonly TasksStatus[] = ['open', 'in_progress'];
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const DUE_SOON_MS = 48 * 60 * 60 * 1000;

/** Actions are stamped on the storyline clock: never before the fixtures' "as of" instant. */
function iso(date: Date): string {
  return storylineInstant(date);
}

function isOpen(task: FixtureTask): boolean {
  return OPEN_STATUSES.includes(task.status);
}

/** Open or in progress past its due date (relative to the storyline "now"). */
export function isTaskOverdue(task: FixtureTask): boolean {
  return isOpen(task) && task.dueAt !== null && Date.parse(task.dueAt) < Date.parse(WORKSPACE_AS_OF);
}

function isGroupMember(task: FixtureTask, userId: number): boolean {
  return task.assigneeUserId === null && task.groupId !== null && (findGroup(task.groupId)?.memberUserIds.includes(userId) ?? false);
}

/** True when the task belongs to the persona through an active membership in the task's tenant. */
function isMine(task: FixtureTask, persona: Persona): boolean {
  const member = activeMemberships(persona).some((membership) => membership.tenantId === task.tenantId);
  return member && (task.assigneeUserId === persona.userId || isGroupMember(task, persona.userId));
}

/** Eligible colleagues: active members of the task's tenant with a qualifying permission and no known conflict. */
function candidatesFor(task: FixtureTask, callerId: number): ReassignCandidate[] {
  if (task.reassignPermissions.length === 0) {
    return [];
  }
  const candidates: ReassignCandidate[] = [];
  for (const persona of allPersonas()) {
    if (persona.userId === callerId || persona.status !== 'active' || task.conflictedUserIds.includes(persona.userId)) {
      continue;
    }
    const membership = activeMemberships(persona).find((candidate) => candidate.tenantId === task.tenantId);
    if (membership === undefined) {
      continue;
    }
    const permissions = membershipPermissions(membership);
    if (!task.reassignPermissions.some((code) => permissions.includes(code))) {
      continue;
    }
    candidates.push({
      ...personRef(persona.userId),
      capacity: membership.capacity,
      openTasks: TASKS.filter((candidate) => candidate.assigneeUserId === persona.userId && isOpen(candidate)).length,
    });
  }
  return candidates.sort((a, b) => a.openTasks - b.openTasks || a.fullName.localeCompare(b.fullName));
}

function actionsFor(task: FixtureTask, callerId: number): TaskAction[] {
  if (!isOpen(task)) {
    return [];
  }
  const actions: TaskAction[] = [];
  if (!task.completedBySource) {
    actions.push('complete');
  }
  actions.push('return');
  if (candidatesFor(task, callerId).length > 0) {
    actions.push('reassign');
  }
  return actions;
}

function toItem(task: FixtureTask, callerId: number): TaskItem {
  const group = task.groupId === null ? undefined : findGroup(task.groupId);
  return {
    id: task.id,
    organization: organizationLabel(task.tenantId),
    title: task.title,
    taskType: task.taskType,
    sourceType: task.sourceType,
    sourceId: task.sourceId,
    sourceReference: task.sourceReference,
    sourceLinkPath: task.sourceLinkPath,
    dueAt: task.dueAt,
    priority: task.priority,
    status: task.status,
    isOverdue: isTaskOverdue(task),
    assignee: task.assigneeUserId === null ? null : personRef(task.assigneeUserId),
    assigneeGroup: group === undefined ? null : { groupId: group.groupId, name: group.name },
    delegatedFrom: task.delegatedFromUserId === null ? null : personRef(task.delegatedFromUserId),
    createdAt: task.createdAt,
    allowedActions: actionsFor(task, callerId),
    sourceOwner: task.sourceOwnerUserId === null ? null : personRef(task.sourceOwnerUserId),
    escalationTo: task.escalationUserId === null ? null : personRef(task.escalationUserId),
  };
}

function toDetail(task: FixtureTask, callerId: number): TaskDetail {
  return {
    ...toItem(task, callerId),
    description: task.description,
    escalationUser: task.escalationUserId === null ? null : personRef(task.escalationUserId),
    completedAt: task.completedAt,
    completedBy: task.completedByUserId === null ? null : personRef(task.completedByUserId),
    outcomeNote: task.outcomeNote,
    history: task.history.map((event) => ({
      at: event.at,
      actor: event.actorUserId === null ? null : personRef(event.actorUserId),
      status: event.status,
      note: event.note,
    })),
  };
}

function myTasks(persona: Persona): FixtureTask[] {
  return TASKS.filter((task) => isMine(task, persona));
}

export function register(app: MockApp): void {
  mockRoute(app, listMyTasks, ({ requirePersona, query, fixtures }) => {
    const persona = requirePersona();
    const q = query.q?.toLowerCase();
    const rows = myTasks(persona).filter((task) => {
      if (
        q !== undefined &&
        !task.title.toLowerCase().includes(q) &&
        !(task.sourceReference ?? '').toLowerCase().includes(q) &&
        !(task.description ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (query.status !== undefined && !query.status.includes(task.status)) {
        return false;
      }
      if (query.taskType !== undefined && !query.taskType.includes(task.taskType)) {
        return false;
      }
      if (query.priority !== undefined && !query.priority.includes(task.priority)) {
        return false;
      }
      if (query.tenantId !== undefined && task.tenantId !== query.tenantId) {
        return false;
      }
      if (query.overdue !== undefined && isTaskOverdue(task) !== query.overdue) {
        return false;
      }
      const due = task.dueAt?.slice(0, 10) ?? null;
      if (query.dueFrom !== undefined && (due === null || due < query.dueFrom)) {
        return false;
      }
      if (query.dueTo !== undefined && (due === null || due > query.dueTo)) {
        return false;
      }
      if (query.sourceType !== undefined && !query.sourceType.includes(task.sourceType)) {
        return false;
      }
      if (query.delegated !== undefined && (task.delegatedFromUserId !== null) !== query.delegated) {
        return false;
      }
      return !(query.groupAssigned !== undefined && (task.assigneeUserId === null) !== query.groupAssigned);
    });
    const sortKey = query.sort ?? 'dueAt';
    const factor = query.dir === 'desc' ? -1 : 1;
    const value = (task: FixtureTask): string | number => {
      switch (sortKey) {
        case 'priority':
          return PRIORITY_RANK[task.priority];
        case 'createdAt':
          return Date.parse(task.createdAt);
        case 'title':
          return task.title.toLowerCase();
        case 'status':
          return task.status;
        default:
          return task.dueAt === null ? Number.MAX_SAFE_INTEGER : Date.parse(task.dueAt);
      }
    };
    const ordered = [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return factor * (left < right ? -1 : left > right ? 1 : 0) || a.id - b.id;
    });
    return fixtures.page(ordered.map((task) => toItem(task, persona.userId)));
  });

  mockRoute(app, getMyTaskSummary, ({ requirePersona }) => {
    const persona = requirePersona();
    const open = myTasks(persona).filter(isOpen);
    const asOf = Date.parse(WORKSPACE_AS_OF);
    const dueSoon = (task: FixtureTask): boolean =>
      !isTaskOverdue(task) && task.dueAt !== null && Date.parse(task.dueAt) - asOf <= DUE_SOON_MS;
    const summary: TaskSummary = {
      open: open.length,
      overdue: open.filter(isTaskOverdue).length,
      dueSoon: open.filter(dueSoon).length,
      byOrganization: activeMemberships(persona).map((membership) => {
        const inTenant = open.filter((task) => task.tenantId === membership.tenantId);
        return {
          ...organizationLabel(membership.tenantId),
          open: inTenant.length,
          overdue: inTenant.filter(isTaskOverdue).length,
        };
      }),
    };
    return summary;
  });

  mockRoute(app, getMyTask, ({ requirePersona, params, fail }) => {
    const persona = requirePersona();
    const task = findFixtureTask(params.taskId);
    if (task === undefined || !isMine(task, persona)) {
      return fail(404, 'TASK_NOT_FOUND');
    }
    return toDetail(task, persona.userId);
  });

  mockRoute(app, listReassignCandidates, ({ requirePersona, params, fail }) => {
    const persona = requirePersona();
    const task = findFixtureTask(params.taskId);
    if (task === undefined || !isMine(task, persona)) {
      return fail(404, 'TASK_NOT_FOUND');
    }
    if (!isOpen(task)) {
      return fail(409, 'TASK_NOT_OPEN', 'Only open tasks can be reassigned.');
    }
    return { items: candidatesFor(task, persona.userId) };
  });

  /** Resolves the task for an action and checks tenant and state; returns the task or answers the error. */
  function actionable(
    persona: Persona,
    tenantId: number,
    taskId: number,
    notFound: (detail?: string) => never,
    fail: (status: number, code: string, detail?: string) => never,
  ): FixtureTask {
    const task = findFixtureTask(taskId);
    if (task === undefined || !isMine(task, persona)) {
      return notFound('No such task in your inbox.');
    }
    if (task.tenantId !== tenantId) {
      return fail(409, 'TASK_TENANT_MISMATCH', 'Switch to the task’s organization to act on it.');
    }
    if (!isOpen(task)) {
      return fail(409, 'TASK_NOT_OPEN', 'This task is already closed.');
    }
    return task;
  }

  mockRoute(app, completeMyTask, ({ requirePersona, requireTenant, params, body, now, notFound, fail }) => {
    const persona = requirePersona();
    const task = actionable(persona, requireTenant().tenant.id, params.taskId, notFound, fail);
    if (task.completedBySource) {
      return fail(409, 'TASK_COMPLETED_BY_SOURCE_ACTION', 'This task completes when you take the action on its source record.');
    }
    const at = iso(now);
    const note = body.outcomeNote === undefined || body.outcomeNote === '' ? null : body.outcomeNote;
    const completed: FixtureTask = {
      ...task,
      status: 'completed',
      completedAt: at,
      completedByUserId: persona.userId,
      outcomeNote: note,
      history: [...task.history, { at, actorUserId: persona.userId, status: 'completed', note }],
    };
    return toDetail(completed, persona.userId);
  });

  mockRoute(app, returnMyTask, ({ requirePersona, requireTenant, params, body, now, notFound, fail }) => {
    const persona = requirePersona();
    const task = actionable(persona, requireTenant().tenant.id, params.taskId, notFound, fail);
    const at = iso(now);
    const returned: FixtureTask = {
      ...task,
      status: 'returned',
      outcomeNote: body.reason,
      history: [...task.history, { at, actorUserId: persona.userId, status: 'returned', note: body.reason }],
    };
    return toDetail(returned, persona.userId);
  });

  mockRoute(app, reassignMyTask, ({ requirePersona, requireTenant, params, body, now, notFound, fail }) => {
    const persona = requirePersona();
    const task = actionable(persona, requireTenant().tenant.id, params.taskId, notFound, fail);
    if (body.assigneeUserId === persona.userId) {
      return fail(422, 'REASSIGN_TO_SELF', 'Choose a colleague other than yourself.');
    }
    if (task.conflictedUserIds.includes(body.assigneeUserId)) {
      return fail(409, 'REASSIGNEE_CONFLICTED', 'This colleague has a declared conflict on the source record.');
    }
    const candidate = candidatesFor(task, persona.userId).find((entry) => entry.userId === body.assigneeUserId);
    if (candidate === undefined) {
      return fail(409, 'REASSIGNEE_NOT_ELIGIBLE', 'This colleague does not hold the capacity the task needs.');
    }
    const at = iso(now);
    const note = `Reassigned to ${candidate.fullName}: ${body.reason}`;
    const reassigned: FixtureTask = {
      ...task,
      status: 'reassigned',
      outcomeNote: note,
      history: [...task.history, { at, actorUserId: persona.userId, status: 'reassigned', note }],
    };
    return toDetail(reassigned, persona.userId);
  });
}
