/**
 * OPS-07 help article editor: slug, title, topic, audience, language, one-line summary and body. Saving keeps a
 * draft; publishing (by a reviewer other than the last editor) makes it visible in the help centre and the public
 * guidance; archiving withdraws it.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { HelpArticleInput, operationsEndpoints } from '@contracts/operations';
import type { HelpArticleDetail } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { fieldErrorOnly } from '../lib/errors';
import { useValidatedForm } from '../lib/forms';
import { opsPaths } from '../lib/paths';
import { CONTENT_MANAGE } from '../lib/permissions';
import { ActionError } from '../components/ActionError';

const FIELDS = [
  'slug',
  'title',
  'topic',
  'audience',
  'language',
  'excerpt',
  'bodyMarkdown',
] as const;

export default function HelpArticleEditorPage() {
  const { articleId } = useParams();
  const isNew = articleId === undefined;
  const article = useApiQuery(
    operationsEndpoints.getHelpArticle,
    isNew ? null : { params: { articleId: Number(articleId) } },
  );
  return (
    <div className="tiq-page">
      {isNew ? (
        <ArticleEditor existing={null} />
      ) : (
        <>
          {article.data === undefined && (
            <PageHeader
              title={t('ops.article.title')}
              back={{ to: opsPaths.helpArticles, label: t('ops.content.title') }}
            />
          )}
          <QueryView query={article}>
            {(data) => <ArticleEditor key={data.updatedAt} existing={data} />}
          </QueryView>
        </>
      )}
    </div>
  );
}

function ArticleEditor({ existing }: { readonly existing: HelpArticleDetail | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CONTENT_MANAGE);
  const initial = {
    slug: existing?.slug ?? '',
    title: existing?.title ?? '',
    topic: existing?.topic ?? '',
    audience: existing?.audience ?? '',
    language: existing?.language ?? 'en',
    excerpt: existing?.excerpt ?? '',
    bodyMarkdown: existing?.bodyMarkdown ?? '',
  };
  const [draft, setDraft] = useState(initial);
  const [confirming, setConfirming] = useState<'publish' | 'archive' | null>(null);
  const create = useApiMutation(operationsEndpoints.createHelpArticle);
  const save = useApiMutation(operationsEndpoints.updateHelpArticle);
  const publish = useApiMutation(operationsEndpoints.publishHelpArticle);
  const archive = useApiMutation(operationsEndpoints.archiveHelpArticle);
  const editable = canManage && existing?.status !== 'archived';
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const body = {
    ...draft,
    topic: draft.topic === '' ? undefined : draft.topic,
    audience: draft.audience === '' ? undefined : draft.audience,
  };
  const lastError = existing === null ? create.error : save.error;
  const form = useValidatedForm(HelpArticleInput, body, lastError, FIELDS);
  const set = (field: keyof typeof initial) => (value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));
  const command = confirming === 'publish' ? publish : archive;

  const submit = async (): Promise<void> => {
    const parsed = form.check();
    if (parsed === null) return;
    try {
      if (existing === null) {
        const created = await create.mutate({ body: parsed });
        toast.show(t('ops.article.saved'), 'success');
        invalidateApiQueries('ops.operations.helpArticles.');
        navigate(opsPaths.helpArticle(created.id), { replace: true });
      } else {
        await save.mutate({ params: { articleId: existing.id }, body: parsed });
        toast.show(t('ops.article.saved'), 'success');
        invalidateApiQueries('ops.operations.helpArticles.');
      }
    } catch {
      // Shown below the form.
    }
  };

  return (
    <>
      <UnsavedChangesGuard when={dirty && !create.pending && !save.pending} />
      <PageHeader
        title={existing === null ? t('ops.article.newTitle') : existing.title}
        back={{ to: opsPaths.helpArticles, label: t('ops.content.title') }}
        meta={
          existing === null ? (
            <span>{t('ops.announcement.notSaved')}</span>
          ) : (
            <>
              <StatusChip enum="help_articles.status" value={existing.status} />
              <StatusChip enum="help_articles.audience" value={existing.audience} />
              <span>
                {t('ops.article.updated', {
                  name: existing.updatedBy.fullName,
                  at: formatDateTime(existing.updatedAt, timeZone),
                })}
              </span>
            </>
          )
        }
        actions={
          canManage && existing !== null && existing.status !== 'archived' ? (
            <Button
              variant="danger-soft"
              icon="archive"
              onClick={() => {
                archive.reset();
                setConfirming('archive');
              }}
            >
              {t('ops.announcement.archive')}
            </Button>
          ) : undefined
        }
        primaryAction={
          canManage && existing !== null && existing.status === 'draft' ? (
            <Button
              variant="primary"
              icon="bookOpen"
              disabled={dirty}
              onClick={() => {
                publish.reset();
                setConfirming('publish');
              }}
            >
              {t('ops.announcement.publish')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('ops.article.bindingTitle')}>
        <p>{t('ops.article.binding')}</p>
      </Banner>
      {existing !== null && existing.status === 'published' && (
        <Banner tone="warning" title={t('ops.article.liveTitle')}>
          <p>{t('ops.article.live')}</p>
        </Banner>
      )}
      <Card
        title={t('ops.announcement.content')}
        footer={
          editable ? (
            <div className="tiq-inline">
              <Button
                variant={existing === null ? 'primary' : 'secondary'}
                icon="check"
                loading={create.pending || save.pending}
                disabled={existing !== null && !dirty}
                onClick={() => void submit()}
              >
                {t('ops.article.save')}
              </Button>
              <span className="tiq-text-muted">
                {dirty ? t('ops.common.unsaved') : t('ops.announcement.draftSaved')}
              </span>
            </div>
          ) : undefined
        }
      >
        <div className="tiq-form-grid">
          <TextField
            fieldClassName="tiq-form-full"
            label={t('ops.content.col.title')}
            required
            value={draft.title}
            onChange={set('title')}
            disabled={!editable}
            error={form.errorFor('title')}
          />
          <TextField
            label={t('ops.article.slug')}
            hint={t('ops.article.slugHint')}
            required
            value={draft.slug}
            onChange={set('slug')}
            disabled={!editable}
            error={form.errorFor('slug')}
          />
          <Select
            label={t('ops.content.col.language')}
            required
            value={draft.language}
            onChange={set('language')}
            options={[{ value: 'en', label: t('ops.content.english') }]}
            disabled={!editable}
            error={form.errorFor('language')}
          />
          <Select
            label={t('ops.content.col.topic')}
            required
            placeholder={t('ops.common.choose')}
            value={draft.topic}
            onChange={set('topic')}
            options={enumOptions('help_articles.topic')}
            disabled={!editable}
            error={form.errorFor('topic')}
          />
          <Select
            label={t('ops.content.col.audience')}
            required
            placeholder={t('ops.common.choose')}
            value={draft.audience}
            onChange={set('audience')}
            options={enumOptions('help_articles.audience')}
            disabled={!editable}
            error={form.errorFor('audience')}
          />
          <TextField
            fieldClassName="tiq-form-full"
            label={t('ops.article.excerpt')}
            required
            value={draft.excerpt}
            onChange={set('excerpt')}
            disabled={!editable}
            error={form.errorFor('excerpt')}
          />
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('ops.article.body')}
            hint={t('ops.article.bodyHint')}
            required
            rows={12}
            value={draft.bodyMarkdown}
            onChange={set('bodyMarkdown')}
            disabled={!editable}
            error={form.errorFor('bodyMarkdown')}
          />
        </div>
        <ActionError error={lastError} fields={FIELDS} />
      </Card>

      <ConfirmActionDialog
        open={confirming !== null && existing !== null}
        title={
          confirming === 'publish' ? t('ops.article.publishTitle') : t('ops.article.archiveTitle')
        }
        scope={existing === null ? '' : `${existing.title} (${existing.slug})`}
        consequence={
          confirming === 'publish'
            ? t('ops.article.publishConsequence')
            : t('ops.article.archiveConsequence')
        }
        confirmLabel={
          confirming === 'publish' ? t('ops.announcement.publish') : t('ops.announcement.archive')
        }
        tone={confirming === 'archive' ? 'danger' : 'primary'}
        pending={command.pending}
        error={fieldErrorOnly(command.error)}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          if (existing === null) return;
          try {
            await command.mutate({ params: { articleId: existing.id } });
            toast.show(
              confirming === 'publish' ? t('ops.article.published') : t('ops.article.archived'),
              'success',
            );
            invalidateApiQueries('ops.operations.helpArticles.');
            setConfirming(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <ActionError error={command.error} />
      </ConfirmActionDialog>
    </>
  );
}
