/**
 * Tasks client (the `tasks` contract, COM-04). Reads span every active membership; actions carry the task's
 * tenant as `X-Tenant-Id` (DD-21), so each action takes the row's `tenantId`.
 */
import {
  completeMyTask,
  getMyTask,
  getMyTaskSummary,
  listMyTasks,
  listReassignCandidates,
  reassignMyTask,
  returnMyTask,
} from '@contracts/tasks';
import type {
  CompleteTaskBody,
  ReassignCandidates,
  ReassignTaskBody,
  ReturnTaskBody,
  TaskDetail,
  TaskPage,
  TaskSummary,
} from '@contracts/tasks';
import type { EndpointQuery } from '@contracts/endpoint';

import { call } from './client';

/** GET /api/v1/me/tasks: the caller's own tasks, filtered, sorted and paginated. */
export function fetchMyTasks(query: EndpointQuery<typeof listMyTasks> = {}): Promise<TaskPage> {
  return call(listMyTasks, { query });
}

/** GET /api/v1/me/task-summary: open, overdue and due-soon counts per organization. */
export function fetchMyTaskSummary(): Promise<TaskSummary> {
  return call(getMyTaskSummary, {});
}

/** GET /api/v1/me/tasks/:taskId. */
export function fetchMyTask(taskId: number): Promise<TaskDetail> {
  return call(getMyTask, { params: { taskId } });
}

/** GET /api/v1/me/tasks/:taskId/reassign-candidates. */
export function fetchReassignCandidates(taskId: number): Promise<ReassignCandidates> {
  return call(listReassignCandidates, { params: { taskId } });
}

/** POST /api/v1/me/tasks/:taskId/complete in the task's organization. */
export function completeTask(
  taskId: number,
  tenantId: number,
  body: CompleteTaskBody = {},
): Promise<TaskDetail> {
  return call(completeMyTask, { params: { taskId }, body }, { tenantId });
}

/** POST /api/v1/me/tasks/:taskId/return in the task's organization. */
export function returnTask(
  taskId: number,
  tenantId: number,
  body: ReturnTaskBody,
): Promise<TaskDetail> {
  return call(returnMyTask, { params: { taskId }, body }, { tenantId });
}

/** POST /api/v1/me/tasks/:taskId/reassign in the task's organization. */
export function reassignTask(
  taskId: number,
  tenantId: number,
  body: ReassignTaskBody,
): Promise<TaskDetail> {
  return call(reassignMyTask, { params: { taskId }, body }, { tenantId });
}
