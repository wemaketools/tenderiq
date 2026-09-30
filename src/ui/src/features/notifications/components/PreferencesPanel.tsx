/**
 * Notification preferences (COM-06 / COM-03): in-app, email and digest per event type. Mandatory formal notices
 * are locked on (PRD §14.3); email is disabled where the channel is not configured (DD-44). Saved vs unsaved is
 * always visible, and leaving with unsaved changes asks first.
 */
import { useState } from 'react';

import { USER_NOTIFICATION_PREFERENCES_DIGEST } from '@contracts/enums';
import type { UserNotificationPreferencesDigest } from '@contracts/enums';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@contracts/notifications';
import type { NotificationPreference, NotificationPreferences } from '@contracts/notifications';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  FormErrorSummary,
  QueryView,
  Select,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { errorMessage } from '../../tasks/lib/shared';

type Draft = ReadonlyMap<string, NotificationPreference>;

function PreferencesEditor({ saved }: { readonly saved: NotificationPreferences }) {
  const [base, setBase] = useState(saved);
  const [draft, setDraft] = useState<Draft>(new Map());
  const save = useApiMutation(updateNotificationPreferences);
  const toast = useToast();
  const rows = base.items.map((item) => draft.get(item.eventType) ?? item);
  const changed = rows.filter((row) => {
    const original = base.items.find((item) => item.eventType === row.eventType);
    return (
      original !== undefined &&
      (original.inApp !== row.inApp ||
        original.email !== row.email ||
        original.digest !== row.digest)
    );
  });
  const dirty = changed.length > 0;

  const update = (row: NotificationPreference, patch: Partial<NotificationPreference>): void => {
    setDraft((previous) => new Map(previous).set(row.eventType, { ...row, ...patch }));
  };

  const submit = async (): Promise<void> => {
    const result = await save
      .mutate({
        body: {
          items: changed.map((row) => ({
            eventType: row.eventType,
            inApp: row.inApp,
            email: row.email,
            digest: row.digest,
          })),
        },
      })
      .catch(() => null);
    if (result !== null) {
      setBase(result);
      setDraft(new Map());
      toast.show(t('notifications.prefs.saved'), 'success');
    }
  };

  return (
    <Card
      title={t('notifications.prefs.title')}
      subtitle={t('notifications.prefs.intro')}
      flush
      footer={
        <div className="tiq-inline">
          <span className={dirty ? 'tiq-text-warning' : 'tiq-text-muted'} role="status">
            {dirty ? t('notifications.prefs.unsaved') : t('notifications.prefs.upToDate')}
          </span>
          <Button
            variant="primary"
            disabled={!dirty}
            loading={save.pending}
            onClick={() => void submit()}
          >
            {t('notifications.prefs.save')}
          </Button>
        </div>
      }
    >
      <UnsavedChangesGuard when={dirty} />
      {!base.emailEnabled && <Banner tone="info">{t('notifications.prefs.emailOff')}</Banner>}
      {save.error !== null && (
        <Banner tone="error">{errorMessage(save.error, 'notifications')}</Banner>
      )}
      {save.error !== null && save.error.fieldErrors.length > 0 && (
        <FormErrorSummary title={save.error.title} errors={save.error.fieldErrors} />
      )}
      <DataTable
        caption={t('notifications.prefs.caption')}
        rows={rows}
        rowKey={(row) => row.eventType}
        columns={[
          {
            id: 'event',
            header: t('notifications.prefs.event'),
            cell: (row) => (
              <span className="tiq-inline">
                <span>{tEnum('notification_rules.event_type', row.eventType)}</span>
                {row.mandatory && (
                  <Chip tone="neutral" size="sm" icon="lock">
                    {t('notifications.prefs.mandatory')}
                  </Chip>
                )}
              </span>
            ),
          },
          {
            id: 'inApp',
            header: t('notifications.prefs.inApp'),
            cell: (row) => (
              <Checkbox
                label={
                  <span className="tiq-visually-hidden">
                    {t('notifications.prefs.inAppLabel', {
                      event: tEnum('notification_rules.event_type', row.eventType),
                    })}
                  </span>
                }
                checked={row.mandatory || row.inApp}
                disabled={row.mandatory}
                onChange={(inApp) => update(row, { inApp })}
              />
            ),
          },
          {
            id: 'email',
            header: t('notifications.prefs.email'),
            cell: (row) => (
              <Checkbox
                label={
                  <span className="tiq-visually-hidden">
                    {t('notifications.prefs.emailLabel', {
                      event: tEnum('notification_rules.event_type', row.eventType),
                    })}
                  </span>
                }
                checked={base.emailEnabled && (row.mandatory || row.email)}
                disabled={row.mandatory || !base.emailEnabled}
                onChange={(email) => update(row, { email })}
              />
            ),
          },
          {
            id: 'digest',
            header: t('notifications.prefs.digest'),
            cell: (row) =>
              row.mandatory ? (
                <span className="tiq-text-muted">{t('notifications.prefs.locked')}</span>
              ) : (
                <Select
                  label={
                    <span className="tiq-visually-hidden">
                      {t('notifications.prefs.digestLabel', {
                        event: tEnum('notification_rules.event_type', row.eventType),
                      })}
                    </span>
                  }
                  value={row.digest}
                  options={USER_NOTIFICATION_PREFERENCES_DIGEST.map((value) => ({
                    value,
                    label: tEnum('user_notification_preferences.digest', value),
                  }))}
                  onChange={(digest) =>
                    update(row, { digest: digest as UserNotificationPreferencesDigest })
                  }
                />
              ),
          },
        ]}
      />
    </Card>
  );
}

export function PreferencesPanel() {
  const query = useApiQuery(getNotificationPreferences, {});
  return <QueryView query={query}>{(data) => <PreferencesEditor saved={data} />}</QueryView>;
}
