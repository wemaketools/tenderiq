/**
 * Policy client (the `policy` contract): policy profiles (ADM-06), custom fields and form definitions (ADM-07),
 * templates (ADM-08) and the public portal policy (ADM-11). Pages use the hooks with the contract endpoints
 * directly; these wrappers serve code outside hooks.
 */
import {
  approvePolicyVersion,
  approvePortalProposal,
  approveTemplateVersion,
  comparePolicyVersions,
  createCustomField,
  createPolicyProfile,
  createPolicyVersion,
  createTemplate,
  createTemplateVersion,
  deactivateCustomField,
  getCustomField,
  getCustomFieldForm,
  getPolicyProfile,
  getPolicyVersion,
  getPortalPolicy,
  getPublicPortalPolicy,
  getSupplierCustomFieldForm,
  getTemplate,
  getTemplateAuthoringOptions,
  getTemplateVersion,
  listCustomFields,
  listPolicyProfiles,
  listPolicyVersionOptions,
  listTemplateOptions,
  listTemplates,
  reactivateCustomField,
  reorderCustomFields,
  resolveTemplateOption,
  retirePolicyProfile,
  retirePolicyVersion,
  retireTemplate,
  returnPolicyVersion,
  returnPortalProposal,
  returnTemplateVersion,
  savePortalProposal,
  submitPolicyVersion,
  submitPortalProposal,
  submitTemplateVersion,
  updateCustomField,
  updatePolicyVersion,
  updateTemplate,
  updateTemplateVersion,
  withdrawPortalProposal,
} from '@contracts/policy';
import type {
  ApprovePolicyVersionBody,
  ApprovePortalProposalBody,
  ApproveTemplateVersionBody,
  CreateCustomFieldBody,
  CreatePolicyProfileBody,
  CreatePolicyVersionBody,
  CreateTemplateBody,
  CreateTemplateVersionBody,
  CustomFieldDetail,
  CustomFieldForm,
  CustomFieldListQuery,
  CustomFieldPage,
  PolicyProfileDetail,
  PolicyProfileListQuery,
  PolicyProfilePage,
  PolicyVersionComparison,
  PolicyVersionDetail,
  PolicyVersionOption,
  PolicyVersionOptionsQuery,
  PortalPolicy,
  PublicPortalPolicy,
  ReorderCustomFieldsBody,
  SavePortalProposalBody,
  TemplateAuthoringOptions,
  TemplateDetail,
  TemplateListQuery,
  TemplateOption,
  TemplateOptionsQuery,
  TemplatePage,
  TemplateVersionDetail,
  UpdateCustomFieldBody,
  UpdatePolicyVersionBody,
  UpdateTemplateBody,
  UpdateTemplateVersionBody,
} from '@contracts/policy';
import type { CustomFieldsEntityType } from '@contracts/enums';

import { call } from './client';

// ---------------------------------------------------------------------------------------------------------
// Policy profiles (ADM-06)
// ---------------------------------------------------------------------------------------------------------

export function fetchPolicyProfiles(
  query: PolicyProfileListQuery = {},
): Promise<PolicyProfilePage> {
  return call(listPolicyProfiles, { query });
}

export function fetchPolicyProfile(profileId: number): Promise<PolicyProfileDetail> {
  return call(getPolicyProfile, { params: { profileId } });
}

export function fetchPolicyVersion(
  profileId: number,
  versionId: number,
): Promise<PolicyVersionDetail> {
  return call(getPolicyVersion, { params: { profileId, versionId } });
}

export function fetchPolicyComparison(
  profileId: number,
  versionId: number,
  against?: number,
): Promise<PolicyVersionComparison> {
  return call(comparePolicyVersions, {
    params: { profileId, versionId },
    query: against === undefined ? {} : { against },
  });
}

export function createProfile(body: CreatePolicyProfileBody): Promise<PolicyProfileDetail> {
  return call(createPolicyProfile, { body });
}

export function draftPolicyVersion(
  profileId: number,
  body: CreatePolicyVersionBody = {},
): Promise<PolicyVersionDetail> {
  return call(createPolicyVersion, { params: { profileId }, body });
}

export function savePolicyVersion(
  profileId: number,
  versionId: number,
  body: UpdatePolicyVersionBody,
): Promise<PolicyVersionDetail> {
  return call(updatePolicyVersion, { params: { profileId, versionId }, body });
}

export function submitVersion(
  profileId: number,
  versionId: number,
  note?: string,
): Promise<PolicyVersionDetail> {
  return call(submitPolicyVersion, {
    params: { profileId, versionId },
    body: note === undefined ? {} : { note },
  });
}

export function approveVersion(
  profileId: number,
  versionId: number,
  body: ApprovePolicyVersionBody = {},
): Promise<PolicyVersionDetail> {
  return call(approvePolicyVersion, { params: { profileId, versionId }, body });
}

export function returnVersion(
  profileId: number,
  versionId: number,
  reason: string,
): Promise<PolicyVersionDetail> {
  return call(returnPolicyVersion, { params: { profileId, versionId }, body: { reason } });
}

export function retireVersion(
  profileId: number,
  versionId: number,
  reason: string,
): Promise<PolicyVersionDetail> {
  return call(retirePolicyVersion, { params: { profileId, versionId }, body: { reason } });
}

export function retireProfile(profileId: number, reason: string): Promise<PolicyProfileDetail> {
  return call(retirePolicyProfile, { params: { profileId }, body: { reason } });
}

/** The approved policy versions a new strategy or tender may adopt. */
export function fetchPolicyVersionOptions(
  query: PolicyVersionOptionsQuery = {},
): Promise<PolicyVersionOption[]> {
  return call(listPolicyVersionOptions, { query });
}

// ---------------------------------------------------------------------------------------------------------
// Custom fields (ADM-07)
// ---------------------------------------------------------------------------------------------------------

export function fetchCustomFields(query: CustomFieldListQuery = {}): Promise<CustomFieldPage> {
  return call(listCustomFields, { query });
}

export function fetchCustomField(fieldId: number): Promise<CustomFieldDetail> {
  return call(getCustomField, { params: { fieldId } });
}

export function createField(body: CreateCustomFieldBody): Promise<CustomFieldDetail> {
  return call(createCustomField, { body });
}

export function saveField(
  fieldId: number,
  body: UpdateCustomFieldBody,
): Promise<CustomFieldDetail> {
  return call(updateCustomField, { params: { fieldId }, body });
}

export function deactivateField(fieldId: number, reason: string): Promise<CustomFieldDetail> {
  return call(deactivateCustomField, { params: { fieldId }, body: { reason } });
}

export function reactivateField(fieldId: number): Promise<CustomFieldDetail> {
  return call(reactivateCustomField, { params: { fieldId } });
}

export function reorderFields(body: ReorderCustomFieldsBody): Promise<CustomFieldForm> {
  return call(reorderCustomFields, { body });
}

/** The active fields of a buyer form (request, tender, qualification application, contract). */
export function fetchCustomFieldForm(entityType: CustomFieldsEntityType): Promise<CustomFieldForm> {
  return call(getCustomFieldForm, { params: { entityType } });
}

/** The supplier-visible fields of a buyer's qualification, tender or contract form. */
export function fetchSupplierCustomFieldForm(
  buyerSlug: string,
  entityType: 'qualification_application' | 'tender' | 'contract',
): Promise<CustomFieldForm> {
  return call(getSupplierCustomFieldForm, { params: { buyerSlug, entityType } });
}

// ---------------------------------------------------------------------------------------------------------
// Templates (ADM-08)
// ---------------------------------------------------------------------------------------------------------

export function fetchTemplates(query: TemplateListQuery = {}): Promise<TemplatePage> {
  return call(listTemplates, { query });
}

export function fetchTemplate(templateId: number): Promise<TemplateDetail> {
  return call(getTemplate, { params: { templateId } });
}

export function fetchTemplateVersion(
  templateId: number,
  versionId: number,
): Promise<TemplateVersionDetail> {
  return call(getTemplateVersion, { params: { templateId, versionId } });
}

export function createTemplateRecord(body: CreateTemplateBody): Promise<TemplateDetail> {
  return call(createTemplate, { body });
}

export function saveTemplate(
  templateId: number,
  body: UpdateTemplateBody,
): Promise<TemplateDetail> {
  return call(updateTemplate, { params: { templateId }, body });
}

export function draftTemplateVersion(
  templateId: number,
  body: CreateTemplateVersionBody,
): Promise<TemplateDetail> {
  return call(createTemplateVersion, { params: { templateId }, body });
}

export function saveTemplateVersion(
  templateId: number,
  versionId: number,
  body: UpdateTemplateVersionBody,
): Promise<TemplateDetail> {
  return call(updateTemplateVersion, { params: { templateId, versionId }, body });
}

export function submitTemplate(
  templateId: number,
  versionId: number,
  note?: string,
): Promise<TemplateDetail> {
  return call(submitTemplateVersion, {
    params: { templateId, versionId },
    body: note === undefined ? {} : { note },
  });
}

export function approveTemplate(
  templateId: number,
  versionId: number,
  body: ApproveTemplateVersionBody = {},
): Promise<TemplateDetail> {
  return call(approveTemplateVersion, { params: { templateId, versionId }, body });
}

export function returnTemplate(
  templateId: number,
  versionId: number,
  reason: string,
): Promise<TemplateDetail> {
  return call(returnTemplateVersion, { params: { templateId, versionId }, body: { reason } });
}

export function retireTemplateRecord(templateId: number, reason: string): Promise<TemplateDetail> {
  return call(retireTemplate, { params: { templateId }, body: { reason } });
}

/** Owner candidates and categories for the template authoring forms. */
export function fetchTemplateAuthoringOptions(): Promise<TemplateAuthoringOptions> {
  return call(getTemplateAuthoringOptions, {});
}

/** Approved, non-retired templates new work may adopt. */
export function fetchTemplateOptions(query: TemplateOptionsQuery = {}): Promise<TemplateOption[]> {
  return call(listTemplateOptions, { query });
}

/** The version a new record would adopt; rejects a retired or unapproved template. */
export function resolveTemplate(templateId: number): Promise<TemplateOption> {
  return call(resolveTemplateOption, { params: { templateId } });
}

// ---------------------------------------------------------------------------------------------------------
// Portal policy (ADM-11)
// ---------------------------------------------------------------------------------------------------------

export function fetchPortalPolicy(): Promise<PortalPolicy> {
  return call(getPortalPolicy, {});
}

export function savePortalPolicyProposal(body: SavePortalProposalBody): Promise<PortalPolicy> {
  return call(savePortalProposal, { body });
}

export function submitPortalPolicyProposal(): Promise<PortalPolicy> {
  return call(submitPortalProposal, {});
}

export function approvePortalPolicyProposal(
  body: ApprovePortalProposalBody,
): Promise<PortalPolicy> {
  return call(approvePortalProposal, { body });
}

export function returnPortalPolicyProposal(reason: string): Promise<PortalPolicy> {
  return call(returnPortalProposal, { body: { reason } });
}

export function withdrawPortalPolicyProposal(): Promise<PortalPolicy> {
  return call(withdrawPortalProposal, {});
}

/** The approved disclosure settings of a buyer's public portal. */
export function fetchPublicPortalPolicy(buyerSlug: string): Promise<PublicPortalPolicy> {
  return call(getPublicPortalPolicy, { params: { buyerSlug } });
}
