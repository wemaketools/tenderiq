/**
 * ADM-08 — new template. Saving creates a DRAFT template with version 1; it becomes selectable for new work only
 * after its version is submitted for review and approved (saved ≠ submitted ≠ approved).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import type { FieldError } from '@contracts/common';
import type { TemplatesKind } from '@contracts/enums';
import { CreateTemplateBody, createTemplate, getTemplateAuthoringOptions } from '@contracts/policy';
import type { TemplateDetail } from '@contracts/policy';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useAppSelector } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  FormErrorSummary,
  PageHeader,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { PolicyLayout } from '../components/PolicyLayout';
import { TemplateContentForm, TemplateMetaForm } from '../components/TemplateForms';
import { policyErrorMessage } from '../lib/errors';
import { policyPaths } from '../lib/paths';
import {
  CONTENT_FIELDS,
  EMPTY_CONTENT,
  EMPTY_META,
  META_FIELDS,
  metaToBody,
} from '../lib/templateDrafts';
import type { ContentDraft, TemplateMetaDraft } from '../lib/templateDrafts';
import { errorLookup, validateWith } from '../lib/validation';

export default function TemplateNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const options = useApiQuery(getTemplateAuthoringOptions, {});
  const [meta, setMeta] = useState<TemplateMetaDraft>(() => ({
    ...EMPTY_META,
    ownerUserId: userId === null ? '' : String(userId),
  }));
  const [content, setContent] = useState<ContentDraft>(EMPTY_CONTENT);
  const [dirty, setDirty] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [created, setCreated] = useState<TemplateDetail | null>(null);
  const create = useApiMutation(createTemplate);
  const errors = errorLookup(clientErrors, create.error, [...META_FIELDS, ...CONTENT_FIELDS]);

  useEffect(() => {
    if (created !== null) {
      void navigate(policyPaths.template(created.id), { state: { record: created } });
    }
  }, [created, navigate]);

  const save = async (): Promise<void> => {
    const body = {
      ...metaToBody(meta),
      kind: meta.kind as TemplatesKind,
      sourceTenderId: null,
      bodyMarkdown: content.bodyMarkdown,
      checklistItems: content.checklistItems.map((item) => ({ ...item })),
    };
    const problems = validateWith(CreateTemplateBody, body);
    setClientErrors(problems);
    if (problems.length > 0) return;
    try {
      const template = await create.mutate({ body });
      toast.show(t('admin-policy.templateNew.saved', { name: template.name }), 'success');
      setCreated(template);
    } catch {
      // Shown in the form.
    }
  };

  return (
    <PolicyLayout>
      <UnsavedChangesGuard when={dirty && created === null} />
      <PageHeader
        title={t('admin-policy.templateNew.title')}
        subtitle={t('admin-policy.templateNew.intro')}
        back={{ to: policyPaths.templates, label: t('admin-policy.templates.back') }}
        primaryAction={
          <Button
            variant="primary"
            icon="check"
            loading={create.pending}
            onClick={() => void save()}
          >
            {t('admin-policy.templateNew.save')}
          </Button>
        }
      />
      <Banner tone="info" title={t('admin-policy.templateNew.lifecycleTitle')}>
        <p>{t('admin-policy.templateNew.lifecycle')}</p>
      </Banner>
      {(errors.other.length > 0 || (create.error !== null && errors.count === 0)) && (
        <FormErrorSummary
          title={create.error === null ? null : policyErrorMessage(create.error)}
          errors={errors.other}
        />
      )}
      <Card title={t('admin-policy.templateNew.governance')}>
        <TemplateMetaForm
          value={meta}
          onChange={(value) => {
            setMeta(value);
            setDirty(true);
          }}
          errors={errors}
          options={options.data}
          kindEditable
        />
      </Card>
      <Card title={t('admin-policy.templateNew.content')}>
        <TemplateContentForm
          kind={meta.kind}
          value={content}
          onChange={(value) => {
            setContent(value);
            setDirty(true);
          }}
          errors={errors}
          withChangeNote={false}
        />
      </Card>
    </PolicyLayout>
  );
}
