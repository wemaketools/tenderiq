/**
 * Tasks contract: the personal task inbox (COM-04; DD-16 tasks belong to the approvals service; DD-21).
 *
 * `/api/v1/me/tasks` lists the caller's OWN tasks across every active membership, each row labelled with its
 * organization. Reads need no `X-Tenant-Id`. Completing, returning or reassigning a task sends
 * `X-Tenant-Id` equal to the task's tenant (`rowTenant`). Supplier tasks live in the supplier tenant.
 * Reassigning somebody else's work (a leaver, AC-04) is the ADM-03 action of the identity domain, not this one.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  OrganizationLabel,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import { TasksPriority, TasksStatus, TasksTaskType } from './enums.js';

/** Actions the caller may take on a task right now (the SPA shows only these). */
export const TASK_ACTIONS = ['complete', 'return', 'reassign'] as const;
export const TaskAction = z.enum(TASK_ACTIONS);
export type TaskAction = z.infer<typeof TaskAction>;

/** A group a task is assigned to (`user_groups`). */
export const GroupRef = z.object({
  groupId: Id,
  name: z.string().min(1),
});
export type GroupRef = z.infer<typeof GroupRef>;

/** One task row (`tasks`), labelled with its organization. */
export const TaskItem = z.object({
  id: Id,
  organization: OrganizationLabel,
  title: z.string().min(1),
  taskType: TasksTaskType,
  sourceType: z.string().min(1),
  sourceId: Id.nullable(),
  sourceReference: z.string().nullable(),
  /** In-app path of the source record, when the caller may open it. */
  sourceLinkPath: LinkPath.nullable(),
  dueAt: Instant.nullable(),
  priority: TasksPriority,
  status: TasksStatus,
  /** Open or in progress past `dueAt`. */
  isOverdue: z.boolean(),
  assignee: PersonRef.nullable(),
  assigneeGroup: GroupRef.nullable(),
  /** Set when the task reached the caller through a delegation (COM-04 "delegation"). */
  delegatedFrom: PersonRef.nullable(),
  createdAt: Instant,
  allowedActions: z.array(TaskAction),
  /** The accountable owner of the source record (FR-21 "owner"), when there is one. */
  sourceOwner: PersonRef.nullable().optional(),
  /** Who the task escalates to when overdue (FR-21 "escalation route"). */
  escalationTo: PersonRef.nullable().optional(),
});
export type TaskItem = z.infer<typeof TaskItem>;

/** One entry of a task's history. */
export const TaskEvent = z.object({
  at: Instant,
  actor: PersonRef.nullable(),
  status: TasksStatus,
  note: z.string().nullable(),
});
export type TaskEvent = z.infer<typeof TaskEvent>;

/** The full task, for the detail drawer. */
export const TaskDetail = TaskItem.extend({
  description: z.string().nullable(),
  escalationUser: PersonRef.nullable(),
  completedAt: Instant.nullable(),
  completedBy: PersonRef.nullable(),
  outcomeNote: z.string().nullable(),
  history: z.array(TaskEvent),
});
export type TaskDetail = z.infer<typeof TaskDetail>;

export const TASK_SORT_FIELDS = ['dueAt', 'priority', 'createdAt', 'title', 'status'] as const;

export const TaskListQuery = listQueryWithSort(TASK_SORT_FIELDS).extend({
  status: queryList(TasksStatus).optional(),
  taskType: queryList(TasksTaskType).optional(),
  priority: queryList(TasksPriority).optional(),
  tenantId: IdParam.optional(),
  overdue: QueryBoolean.optional(),
  dueFrom: CalendarDate.optional(),
  dueTo: CalendarDate.optional(),
  /** Source record types, e.g. `approval_request`, `tender`, `contract`. */
  sourceType: queryList(z.string().regex(/^[a-z][a-z0-9_]{1,62}$/, issue('INVALID_SOURCE_TYPE', 'Use a snake_case source type.'))).optional(),
  /** Only tasks that reached the caller through a delegation (true) or directly (false). */
  delegated: QueryBoolean.optional(),
  /** Only tasks assigned to one of the caller's groups rather than to the caller personally (true), or the reverse. */
  groupAssigned: QueryBoolean.optional(),
});
export type TaskListQuery = z.input<typeof TaskListQuery>;

export const TaskPage = pageOf(TaskItem);
export type TaskPage = z.infer<typeof TaskPage>;

/** Per-organization counts for the inbox tabs and the shell badge. */
export const TaskOrganizationCount = OrganizationLabel.extend({
  open: z.number().int().min(0),
  overdue: z.number().int().min(0),
});

export const TaskSummary = z.object({
  /** Open or in-progress tasks of the caller. */
  open: z.number().int().min(0),
  /** Of those, past their due date. */
  overdue: z.number().int().min(0),
  /** Of those, due within the next 48 hours and not overdue. */
  dueSoon: z.number().int().min(0),
  byOrganization: z.array(TaskOrganizationCount),
});
export type TaskSummary = z.infer<typeof TaskSummary>;

export const TaskParams = z.object({ taskId: IdParam });

const TASK_ACTION_ERRORS = ['TASK_NOT_OPEN', 'TASK_NOT_ASSIGNED_TO_CALLER', 'TASK_TENANT_MISMATCH'] as const;

/** GET /api/v1/me/tasks: own tasks across all active memberships (COM-04). */
export const listMyTasks = defineEndpoint({
  id: 'me.tasks.list',
  method: 'GET',
  path: '/api/v1/me/tasks',
  audience: 'me',
  query: TaskListQuery,
  response: TaskPage,
  errors: [],
  screens: ['COM-04'],
  summary: 'The caller’s own tasks across every active membership, each labelled with its organization (DD-21).',
});

/** GET /api/v1/me/task-summary: open and overdue counts for the shell badge (COM-04, BUY-01, SUP-01). */
export const getMyTaskSummary = defineEndpoint({
  id: 'me.tasks.summary',
  method: 'GET',
  path: '/api/v1/me/task-summary',
  audience: 'me',
  response: TaskSummary,
  errors: [],
  screens: ['COM-04', 'BUY-01', 'SUP-01'],
});

/** GET /api/v1/me/tasks/:taskId: one own task with its history. */
export const getMyTask = defineEndpoint({
  id: 'me.tasks.get',
  method: 'GET',
  path: '/api/v1/me/tasks/:taskId',
  audience: 'me',
  params: TaskParams,
  response: TaskDetail,
  errors: ['TASK_NOT_FOUND'],
  screens: ['COM-04'],
});

export const CompleteTaskBody = z.object({
  outcomeNote: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type CompleteTaskBody = z.infer<typeof CompleteTaskBody>;

/** POST /api/v1/me/tasks/:taskId/complete (X-Tenant-Id = the task's tenant). */
export const completeMyTask = defineEndpoint({
  id: 'me.tasks.complete',
  method: 'POST',
  path: '/api/v1/me/tasks/:taskId/complete',
  audience: 'me',
  rowTenant: true,
  params: TaskParams,
  body: CompleteTaskBody,
  response: TaskDetail,
  errors: [...TASK_ACTION_ERRORS, 'TASK_COMPLETED_BY_SOURCE_ACTION'],
  screens: ['COM-04'],
  summary:
    'Completes a task whose work is done outside a source command. Tasks completed by their source command (an approval decision, a score submission) return TASK_COMPLETED_BY_SOURCE_ACTION.',
});

export const ReturnTaskBody = z.object({
  reason: ReasonText,
});
export type ReturnTaskBody = z.infer<typeof ReturnTaskBody>;

/** POST /api/v1/me/tasks/:taskId/return: hands the task back to its source owner with a reason. */
export const returnMyTask = defineEndpoint({
  id: 'me.tasks.return',
  method: 'POST',
  path: '/api/v1/me/tasks/:taskId/return',
  audience: 'me',
  rowTenant: true,
  params: TaskParams,
  body: ReturnTaskBody,
  response: TaskDetail,
  errors: [...TASK_ACTION_ERRORS],
  screens: ['COM-04'],
});

export const ReassignTaskBody = z.object({
  assigneeUserId: Id,
  reason: ReasonText,
});
export type ReassignTaskBody = z.infer<typeof ReassignTaskBody>;

/** POST /api/v1/me/tasks/:taskId/reassign: within the caller's authority, to an eligible colleague. */
export const reassignMyTask = defineEndpoint({
  id: 'me.tasks.reassign',
  method: 'POST',
  path: '/api/v1/me/tasks/:taskId/reassign',
  audience: 'me',
  rowTenant: true,
  params: TaskParams,
  body: ReassignTaskBody,
  response: TaskDetail,
  errors: [...TASK_ACTION_ERRORS, 'REASSIGNEE_NOT_ELIGIBLE', 'REASSIGNEE_CONFLICTED', 'REASSIGN_TO_SELF'],
  screens: ['COM-04'],
});

/** A colleague the task may be reassigned to: same tenant, the capacity the task needs, no known conflict. */
export const ReassignCandidate = PersonRef.extend({
  capacity: z.string().nullable(),
  openTasks: z.number().int().min(0),
});
export type ReassignCandidate = z.infer<typeof ReassignCandidate>;

export const ReassignCandidates = z.object({
  items: z.array(ReassignCandidate),
});
export type ReassignCandidates = z.infer<typeof ReassignCandidates>;

/** GET /api/v1/me/tasks/:taskId/reassign-candidates: eligible colleagues in the task's organization. */
export const listReassignCandidates = defineEndpoint({
  id: 'me.tasks.reassignCandidates',
  method: 'GET',
  path: '/api/v1/me/tasks/:taskId/reassign-candidates',
  audience: 'me',
  params: TaskParams,
  response: ReassignCandidates,
  errors: ['TASK_NOT_FOUND', 'TASK_NOT_OPEN'],
  screens: ['COM-04'],
});

/** The tasks endpoint map. */
export const taskEndpoints = {
  listMyTasks,
  getMyTaskSummary,
  getMyTask,
  completeMyTask,
  returnMyTask,
  reassignMyTask,
  listReassignCandidates,
} as const;
