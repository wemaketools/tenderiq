/**
 * Editable drafts of the template library forms (ADM-08): governance metadata and versioned content, with their
 * conversion to the contract bodies.
 */
import type { TemplatesAudience, TendersProcedureWrite } from '@contracts/enums';
import type { TemplateDetail, TemplateVersionDetail } from '@contracts/policy';

export interface TemplateMetaDraft {
  readonly kind: string;
  readonly name: string;
  readonly procedure: string;
  readonly categoryId: string;
  readonly audience: string;
  readonly ownerUserId: string;
  readonly reviewDate: string;
}

export const EMPTY_META: TemplateMetaDraft = {
  kind: '',
  name: '',
  procedure: '',
  categoryId: '',
  audience: 'buyer_internal',
  ownerUserId: '',
  reviewDate: '',
};

export function templateToMeta(template: TemplateDetail): TemplateMetaDraft {
  return {
    kind: template.kind,
    name: template.name,
    procedure: template.procedure ?? '',
    categoryId: template.category === null ? '' : String(template.category.categoryId),
    audience: template.audience,
    ownerUserId: String(template.owner.userId),
    reviewDate: template.reviewDate ?? '',
  };
}

/** The metadata body (`UpdateTemplateBody`) of a draft; invalid entries stay invalid for the schema. */
export function metaToBody(draft: TemplateMetaDraft) {
  return {
    name: draft.name,
    procedure: draft.procedure === '' ? null : (draft.procedure as TendersProcedureWrite),
    categoryId: draft.categoryId === '' ? null : Number(draft.categoryId),
    audience: draft.audience as TemplatesAudience,
    ownerUserId: draft.ownerUserId === '' ? Number.NaN : Number(draft.ownerUserId),
    reviewDate: draft.reviewDate,
  };
}

export const META_FIELDS = [
  'kind',
  'name',
  'procedure',
  'categoryId',
  'audience',
  'ownerUserId',
  'reviewDate',
];

export interface ChecklistDraft {
  readonly itemText: string;
  readonly mandatory: boolean;
}

export interface ContentDraft {
  readonly bodyMarkdown: string;
  readonly checklistItems: readonly ChecklistDraft[];
  readonly changeNote: string;
}

export const EMPTY_CONTENT: ContentDraft = { bodyMarkdown: '', checklistItems: [], changeNote: '' };

export function versionToContent(version: TemplateVersionDetail, changeNote = ''): ContentDraft {
  return {
    bodyMarkdown: version.bodyMarkdown,
    checklistItems: [...version.checklistItems]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({ itemText: item.itemText, mandatory: item.mandatory })),
    changeNote,
  };
}

export const CONTENT_FIELDS = ['bodyMarkdown', 'checklistItems', 'changeNote'];
