/**
 * Reporting client (the `reporting` contract; FR-21, PRD §15): the buyer and supplier dashboards (BUY-01, SUP-01),
 * management reports (REP-01), report definitions and controlled exports (REP-02, ADM-13), and global search with
 * saved views (COM-08). Pages use the hooks with the contract endpoints directly; these typed wrappers serve code
 * outside hooks, plus `saveExportDownload`, which hands a delivered export to the browser.
 */
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';
import { reportingEndpoints } from '@contracts/reporting';
import type { ExportDownload } from '@contracts/reporting';

import { downloadBlob, downloadFromUrl } from '../lib/download';
import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof reportingEndpoints;
/** The request (`params`, `query`, `body`) of a reporting endpoint. */
export type ReportingRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of a reporting endpoint. */
export type ReportingResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: ReportingRequest<K>,
  options?: CallOptions,
): Promise<ReportingResponse<K>> {
  return call(reportingEndpoints[key], request, options);
}

/** GET /api/v1/buyer/dashboard (`buyer.dashboard.get`). */
export function getBuyerDashboard(
  request: ReportingRequest<'getBuyerDashboard'>,
  options?: CallOptions,
): Promise<ReportingResponse<'getBuyerDashboard'>> {
  return send('getBuyerDashboard', request, options);
}
/** GET /api/v1/supplier/dashboard (`supplier.dashboard.get`). */
export function getSupplierDashboard(
  request: ReportingRequest<'getSupplierDashboard'>,
  options?: CallOptions,
): Promise<ReportingResponse<'getSupplierDashboard'>> {
  return send('getSupplierDashboard', request, options);
}
/** GET /api/v1/buyer/reports (`buyer.reports.families`). */
export function listReportFamilies(
  request: ReportingRequest<'listReportFamilies'>,
  options?: CallOptions,
): Promise<ReportingResponse<'listReportFamilies'>> {
  return send('listReportFamilies', request, options);
}
/** GET /api/v1/buyer/reports/:family (`buyer.reports.run`). */
export function runReport(
  request: ReportingRequest<'runReport'>,
  options?: CallOptions,
): Promise<ReportingResponse<'runReport'>> {
  return send('runReport', request, options);
}
/** GET /api/v1/buyer/report-definitions (`buyer.reportDefinitions.list`). */
export function listReportDefinitions(
  request: ReportingRequest<'listReportDefinitions'>,
  options?: CallOptions,
): Promise<ReportingResponse<'listReportDefinitions'>> {
  return send('listReportDefinitions', request, options);
}
/** GET /api/v1/buyer/report-definitions/:definitionId (`buyer.reportDefinitions.get`). */
export function getReportDefinition(
  request: ReportingRequest<'getReportDefinition'>,
  options?: CallOptions,
): Promise<ReportingResponse<'getReportDefinition'>> {
  return send('getReportDefinition', request, options);
}
/** POST /api/v1/buyer/report-definitions (`buyer.reportDefinitions.create`). */
export function createReportDefinition(
  request: ReportingRequest<'createReportDefinition'>,
  options?: CallOptions,
): Promise<ReportingResponse<'createReportDefinition'>> {
  return send('createReportDefinition', request, options);
}
/** PUT /api/v1/buyer/report-definitions/:definitionId (`buyer.reportDefinitions.update`). */
export function updateReportDefinition(
  request: ReportingRequest<'updateReportDefinition'>,
  options?: CallOptions,
): Promise<ReportingResponse<'updateReportDefinition'>> {
  return send('updateReportDefinition', request, options);
}
/** POST /api/v1/buyer/report-definitions/preview (`buyer.reportDefinitions.preview`). */
export function previewReportDefinition(
  request: ReportingRequest<'previewReportDefinition'>,
  options?: CallOptions,
): Promise<ReportingResponse<'previewReportDefinition'>> {
  return send('previewReportDefinition', request, options);
}
/** POST /api/v1/buyer/report-definitions/:definitionId/activation (`buyer.reportDefinitions.setActive`). */
export function setReportDefinitionActive(
  request: ReportingRequest<'setReportDefinitionActive'>,
  options?: CallOptions,
): Promise<ReportingResponse<'setReportDefinitionActive'>> {
  return send('setReportDefinitionActive', request, options);
}
/** POST /api/v1/buyer/report-definitions/:definitionId/runs (`buyer.reportDefinitions.run`). */
export function runReportDefinition(
  request: ReportingRequest<'runReportDefinition'>,
  options?: CallOptions,
): Promise<ReportingResponse<'runReportDefinition'>> {
  return send('runReportDefinition', request, options);
}
/** GET /api/v1/buyer/report-recipients (`buyer.reportDefinitions.recipients`). */
export function listRecipientCandidates(
  request: ReportingRequest<'listRecipientCandidates'>,
  options?: CallOptions,
): Promise<ReportingResponse<'listRecipientCandidates'>> {
  return send('listRecipientCandidates', request, options);
}
/** GET /api/v1/buyer/exports (`buyer.exports.list`). */
export function listExports(
  request: ReportingRequest<'listExports'>,
  options?: CallOptions,
): Promise<ReportingResponse<'listExports'>> {
  return send('listExports', request, options);
}
/** GET /api/v1/buyer/exports/:exportId (`buyer.exports.get`). */
export function getExport(
  request: ReportingRequest<'getExport'>,
  options?: CallOptions,
): Promise<ReportingResponse<'getExport'>> {
  return send('getExport', request, options);
}
/** POST /api/v1/buyer/exports (`buyer.exports.create`). */
export function createReportExport(
  request: ReportingRequest<'createReportExport'>,
  options?: CallOptions,
): Promise<ReportingResponse<'createReportExport'>> {
  return send('createReportExport', request, options);
}
/** GET /api/v1/buyer/exports/:exportId/download (`buyer.exports.download`). */
export function downloadExport(
  request: ReportingRequest<'downloadExport'>,
  options?: CallOptions,
): Promise<ReportingResponse<'downloadExport'>> {
  return send('downloadExport', request, options);
}
/** GET /api/v1/me/search (`me.search.query`). */
export function search(
  request: ReportingRequest<'search'>,
  options?: CallOptions,
): Promise<ReportingResponse<'search'>> {
  return send('search', request, options);
}
/** GET /api/v1/me/saved-views (`me.savedViews.list`). */
export function listSavedViews(
  request: ReportingRequest<'listSavedViews'>,
  options?: CallOptions,
): Promise<ReportingResponse<'listSavedViews'>> {
  return send('listSavedViews', request, options);
}
/** POST /api/v1/me/saved-views (`me.savedViews.create`); `tenantId` names the organization of the view. */
export function createSavedView(
  tenantId: number,
  request: ReportingRequest<'createSavedView'>,
  options?: Omit<CallOptions, 'tenantId'>,
): Promise<ReportingResponse<'createSavedView'>> {
  return send('createSavedView', request, { ...options, tenantId });
}
/** PUT /api/v1/me/saved-views/:viewId (`me.savedViews.update`); `tenantId` is the view's organization. */
export function updateSavedView(
  tenantId: number,
  request: ReportingRequest<'updateSavedView'>,
  options?: Omit<CallOptions, 'tenantId'>,
): Promise<ReportingResponse<'updateSavedView'>> {
  return send('updateSavedView', request, { ...options, tenantId });
}
/** DELETE /api/v1/me/saved-views/:viewId (`me.savedViews.delete`); `tenantId` is the view's organization. */
export function deleteSavedView(
  tenantId: number,
  request: ReportingRequest<'deleteSavedView'>,
  options?: Omit<CallOptions, 'tenantId'>,
): Promise<ReportingResponse<'deleteSavedView'>> {
  return send('deleteSavedView', request, { ...options, tenantId });
}

/** Hands a delivered export to the browser: inline text becomes a file, a signed URL is opened. */
export function saveExportDownload(download: ExportDownload): void {
  if (download.delivery.kind === 'inline') {
    downloadBlob(
      new Blob([download.delivery.content], { type: download.contentType }),
      download.fileName,
    );
    return;
  }
  downloadFromUrl(download.delivery.url, download.fileName);
}
