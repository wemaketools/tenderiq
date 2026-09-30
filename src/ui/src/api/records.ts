/**
 * Records client (the `records` contract; FR-22, PRD §18): the ADM-14 summary, audit viewer, retention classes,
 * legal and investigation holds, disposal requests (blocked while held, AC-35), evidence packs and the record
 * lookup. Pages use the hooks with the contract endpoints directly; these typed wrappers serve code outside hooks.
 */
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';
import { recordsEndpoints } from '@contracts/records';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof recordsEndpoints;
/** The request (`params`, `query`, `body`) of a records endpoint. */
export type RecordsRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of a records endpoint. */
export type RecordsResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: RecordsRequest<K>,
  options?: CallOptions,
): Promise<RecordsResponse<K>> {
  return call(recordsEndpoints[key], request, options);
}

/** GET /api/v1/buyer/records/summary (`buyer.records.summary`). */
export function getRecordsSummary(
  request: RecordsRequest<'getRecordsSummary'>,
  options?: CallOptions,
): Promise<RecordsResponse<'getRecordsSummary'>> {
  return send('getRecordsSummary', request, options);
}
/** GET /api/v1/buyer/records/audit-events (`buyer.records.auditEvents`). */
export function listAuditEvents(
  request: RecordsRequest<'listAuditEvents'>,
  options?: CallOptions,
): Promise<RecordsResponse<'listAuditEvents'>> {
  return send('listAuditEvents', request, options);
}
/** GET /api/v1/buyer/records/retention-classes (`buyer.records.retentionClasses.list`). */
export function listRetentionClasses(
  request: RecordsRequest<'listRetentionClasses'>,
  options?: CallOptions,
): Promise<RecordsResponse<'listRetentionClasses'>> {
  return send('listRetentionClasses', request, options);
}
/** PUT /api/v1/buyer/records/retention-classes/:retentionClassId (`buyer.records.retentionClasses.update`). */
export function updateRetentionClass(
  request: RecordsRequest<'updateRetentionClass'>,
  options?: CallOptions,
): Promise<RecordsResponse<'updateRetentionClass'>> {
  return send('updateRetentionClass', request, options);
}
/** GET /api/v1/buyer/records/holds (`buyer.records.holds.list`). */
export function listHolds(
  request: RecordsRequest<'listHolds'>,
  options?: CallOptions,
): Promise<RecordsResponse<'listHolds'>> {
  return send('listHolds', request, options);
}
/** GET /api/v1/buyer/records/holds/:holdId (`buyer.records.holds.get`). */
export function getHold(
  request: RecordsRequest<'getHold'>,
  options?: CallOptions,
): Promise<RecordsResponse<'getHold'>> {
  return send('getHold', request, options);
}
/** POST /api/v1/buyer/records/holds (`buyer.records.holds.create`). */
export function createHold(
  request: RecordsRequest<'createHold'>,
  options?: CallOptions,
): Promise<RecordsResponse<'createHold'>> {
  return send('createHold', request, options);
}
/** POST /api/v1/buyer/records/holds/:holdId/release (`buyer.records.holds.release`). */
export function releaseHold(
  request: RecordsRequest<'releaseHold'>,
  options?: CallOptions,
): Promise<RecordsResponse<'releaseHold'>> {
  return send('releaseHold', request, options);
}
/** GET /api/v1/buyer/records/disposal-requests (`buyer.records.disposals.list`). */
export function listDisposalRequests(
  request: RecordsRequest<'listDisposalRequests'>,
  options?: CallOptions,
): Promise<RecordsResponse<'listDisposalRequests'>> {
  return send('listDisposalRequests', request, options);
}
/** GET /api/v1/buyer/records/disposal-requests/:disposalRequestId (`buyer.records.disposals.get`). */
export function getDisposalRequest(
  request: RecordsRequest<'getDisposalRequest'>,
  options?: CallOptions,
): Promise<RecordsResponse<'getDisposalRequest'>> {
  return send('getDisposalRequest', request, options);
}
/** POST …/disposal-requests/:disposalRequestId/approve (`buyer.records.disposals.approve`). */
export function approveDisposalRequest(
  request: RecordsRequest<'approveDisposalRequest'>,
  options?: CallOptions,
): Promise<RecordsResponse<'approveDisposalRequest'>> {
  return send('approveDisposalRequest', request, options);
}
/** POST …/disposal-requests/:disposalRequestId/reject (`buyer.records.disposals.reject`). */
export function rejectDisposalRequest(
  request: RecordsRequest<'rejectDisposalRequest'>,
  options?: CallOptions,
): Promise<RecordsResponse<'rejectDisposalRequest'>> {
  return send('rejectDisposalRequest', request, options);
}
/** POST …/disposal-requests/:disposalRequestId/execute (`buyer.records.disposals.execute`). */
export function executeDisposalRequest(
  request: RecordsRequest<'executeDisposalRequest'>,
  options?: CallOptions,
): Promise<RecordsResponse<'executeDisposalRequest'>> {
  return send('executeDisposalRequest', request, options);
}
/** GET /api/v1/buyer/records/evidence-packs (`buyer.records.evidencePacks.list`). */
export function listEvidencePacks(
  request: RecordsRequest<'listEvidencePacks'>,
  options?: CallOptions,
): Promise<RecordsResponse<'listEvidencePacks'>> {
  return send('listEvidencePacks', request, options);
}
/** POST /api/v1/buyer/records/evidence-packs (`buyer.records.evidencePacks.create`). */
export function createEvidencePack(
  request: RecordsRequest<'createEvidencePack'>,
  options?: CallOptions,
): Promise<RecordsResponse<'createEvidencePack'>> {
  return send('createEvidencePack', request, options);
}
/** GET /api/v1/buyer/records/subjects (`buyer.records.subjects`). */
export function listRecordSubjects(
  request: RecordsRequest<'listRecordSubjects'>,
  options?: CallOptions,
): Promise<RecordsResponse<'listRecordSubjects'>> {
  return send('listRecordSubjects', request, options);
}
