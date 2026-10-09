/**
 * OPS-07 announcement editor: audience, language, title and body of a release notice or service message. Saving
 * keeps a draft; publishing (by a reviewer other than the last editor) makes it visible to its audience; archiving
 * withdraws it. An announcement must never carry a formal tender notice (no tender references).
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  AnnouncementInput,
  TENDER_REFERENCE_IN_TEXT,
  operationsEndpoints,
} from '@contracts/operations';
import type { Announcement } from '@contracts/operations';
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
import { personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { CONTENT_MANAGE } from '../lib/permissions';
import { ActionError } from '../components/ActionError';

const FIELDS = ['audience', 'title', 'body', 'language'] as const;

export default function AnnouncementEditorPage() {
  const { announcementId } = useParams();
  const isNew = announcementId === undefined;
  const announcement = useApiQuery(
    operationsEndpoints.getAnnouncement,
    isNew ? null : { params: { announcementId: Number(announcementId) } },
  );
  return (
    <div className="tiq-page">
      {isNew ? (
        <Editor existing={null} />
      ) : (
        <>
          {announcement.data === undefined && (
            <PageHeader
              title={t('ops.announcement.title')}
              back={{ to: opsPaths.announcements, label: t('ops.content.title') }}
            />
          )}
          <QueryView query={announcement}>
            {(data) => <Editor key={data.updatedAt} existing={data} />}
          </QueryView>
        </>
      )}
    </div>
  );
}

function Editor({ existing }: { readonly existing: Announcement | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CONTENT_MANAGE);
  const initial = {
    audience: existing?.audience ?? '',
    title: existing?.title ?? '',
    body: existing?.body ?? '',
    language: existing?.language ?? 'en',
  };
  const [draft, setDraft] = useState(initial);
  const [confirming, setConfirming] = useState<'publish' | 'archive' | null>(null);
  const create = useApiMutation(operationsEndpoints.createAnnouncement);
  const save = useApiMutation(operationsEndpoints.updateAnnouncement);
  const publish = useApiMutation(operationsEndpoints.publishAnnouncement);
  const archive = useApiMutation(operationsEndpoints.archiveAnnouncement);
  const editable = canManage && (existing === null || existing.status === 'draft');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const body = { ...draft, audience: draft.audience === '' ? undefined : draft.audience };
  const lastError = existing === null ? create.error : save.error;
  const form = useValidatedForm(AnnouncementInput, body, lastError, FIELDS);
  const namesTender = TENDER_REFERENCE_IN_TEXT.test(`${draft.title} ${draft.body}`);
  const set = (field: keyof typeof initial) => (value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));

  const submit = async (): Promise<void> => {
    const parsed = form.check();
    if (parsed === null) return;
    try {
      if (existing === null) {
        const created = await create.mutate({ body: parsed });
        toast.show(t('ops.announcement.savedDraft'), 'success');
        invalidateApiQueries('ops.operations.announcements.');
        navigate(opsPaths.announcement(created.id), { replace: true });
      } else {
        await save.mutate({ params: { announcementId: existing.id }, body: parsed });
        toast.show(t('ops.announcement.savedDraft'), 'success');
        invalidateApiQueries('ops.operations.announcements.');
      }
    } catch {
      // Shown below the form.
    }
  };

  const command = confirming === 'publish' ? publish : archive;

  return (
    <>
      <UnsavedChangesGuard when={dirty && !create.pending && !save.pending} />
      <PageHeader
        title={existing === null ? t('ops.announcement.newTitle') : existing.title}
        back={{ to: opsPaths.announcements, label: t('ops.content.title') }}
        meta={
          existing === null ? (
            <span>{t('ops.announcement.notSaved')}</span>
          ) : (
            <>
              <StatusChip enum="announcements.status" value={existing.status} />
              <StatusChip enum="announcements.audience" value={existing.audience} />
              <span>
                {existing.status === 'draft'
                  ? t('ops.announcement.next.review')
                  : existing.status === 'published'
                    ? t('ops.announcement.publishedBy', {
                        name: personName(existing.publishedBy),
                        at:
                          existing.publishedAt === null
                            ? ''
                            : formatDateTime(existing.publishedAt, timeZone),
                      })
                    : t('ops.announcement.archivedNote')}
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
              icon="megaphone"
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
      <Banner tone="info" title={t('ops.content.distinctionTitle')}>
        <p>{t('ops.content.distinction')}</p>
      </Banner>
      {existing !== null && existing.status === 'draft' && (
        <Banner tone="warning" title={t('ops.announcement.reviewTitle')}>
          <p>{t('ops.announcement.review', { name: existing.updatedBy.fullName })}</p>
        </Banner>
      )}
      <Card
        title={t('ops.announcement.content')}
        subtitle={
          editable
            ? t('ops.announcement.contentHint')
            : existing !== null && existing.status !== 'draft'
              ? t('ops.announcement.readOnly')
              : undefined
        }
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
                {t('ops.announcement.saveDraft')}
              </Button>
              <span className="tiq-text-muted">
                {dirty ? t('ops.common.unsaved') : t('ops.announcement.draftSaved')}
              </span>
            </div>
          ) : undefined
        }
      >
        <div className="tiq-form-grid">
          <Select
            label={t('ops.content.col.audience')}
            required
            placeholder={t('ops.common.choose')}
            value={draft.audience}
            onChange={set('audience')}
            options={enumOptions('announcements.audience')}
            disabled={!editable}
            error={form.errorFor('audience')}
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
          <TextField
            fieldClassName="tiq-form-full"
            label={t('ops.content.col.title')}
            required
            value={draft.title}
            onChange={set('title')}
            disabled={!editable}
            error={form.errorFor('title')}
          />
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('ops.announcement.body')}
            required
            rows={8}
            value={draft.body}
            onChange={set('body')}
            disabled={!editable}
            error={form.errorFor('body')}
          />
        </div>
        {namesTender && (
          <Banner tone="error" title={t('ops.announcement.tenderRefTitle')}>
            <p>{t('ops.errors.FORMAL_NOTICE_NOT_ANNOUNCEMENT')}</p>
          </Banner>
        )}
        <ActionError error={lastError} fields={FIELDS} />
      </Card>

      <ConfirmActionDialog
        open={confirming !== null && existing !== null}
        title={
          confirming === 'publish'
            ? t('ops.announcement.publishTitle')
            : t('ops.announcement.archiveTitle')
        }
        scope={existing === null ? '' : `${existing.title} · ${existing.audience}`}
        consequence={
          confirming === 'publish'
            ? t('ops.announcement.publishConsequence')
            : t('ops.announcement.archiveConsequence')
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
            await command.mutate({ params: { announcementId: existing.id } });
            toast.show(
              confirming === 'publish'
                ? t('ops.announcement.published')
                : t('ops.announcement.archived'),
              'success',
            );
            invalidateApiQueries('ops.operations.announcements.');
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
