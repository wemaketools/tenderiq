/**
 * COM-03 — Personal profile and preferences (FR-03): name, language and personal display time zone (official
 * deadlines always keep their organization's official zone, DD-33), contact details whose changes need
 * confirmation, notification choices (mandatory formal notices cannot be muted), memberships, and the personal
 * access settings of every active organization (roles, direct grants, restrictions and delegations).
 */
import { useState } from 'react';

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@contracts/notifications';
import type { NotificationPreferences } from '@contracts/notifications';
import { USER_NOTIFICATION_PREFERENCES_DIGEST } from '@contracts/enums';
import type { UserNotificationPreferencesDigest } from '@contracts/enums';
import { SUPPORTED_LOCALES, orgAdminEndpoints } from '@contracts/org-admin';
import type {
  ContactChange,
  ContactChangeField,
  MyAccessInOrganization,
  MyAccessItem,
  MyProfile,
} from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessStatusChip } from '../../admin-access/components/AccessBits';
import { dialogError, orgAdminErrorMessage } from '../../admin-access/lib/errors';

const ORGANIZATION_ZONE = '';

function zoneOptions(current: string | null): { value: string; label: string }[] {
  const zones = Intl.supportedValuesOf('timeZone');
  const all = current !== null && !zones.includes(current) ? [current, ...zones] : zones;
  return [
    { value: ORGANIZATION_ZONE, label: t('account.profile.useOfficialZone') },
    ...all.map((zone) => ({ value: zone, label: zone })),
  ];
}

function ProfileForm({
  profile,
  onSaved,
}: {
  readonly profile: MyProfile;
  readonly onSaved: (next: MyProfile) => void;
}) {
  const toast = useToast();
  const update = useApiMutation(orgAdminEndpoints.updateMyProfile);
  const initial = {
    fullName: profile.fullName,
    locale: profile.locale,
    displayTimeZone: profile.displayTimeZone ?? ORGANIZATION_ZONE,
  };
  const [draft, setDraft] = useState(initial);
  const [checked, setChecked] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const server = formErrors(update.error, ['fullName', 'locale', 'displayTimeZone']);
  const nameInvalid = draft.fullName.trim().length < 2;
  const save = async (): Promise<void> => {
    setChecked(true);
    if (nameInvalid) return;
    try {
      const next = await update.mutate({
        body: {
          fullName: draft.fullName.trim(),
          locale: draft.locale as (typeof SUPPORTED_LOCALES)[number],
          displayTimeZone:
            draft.displayTimeZone === ORGANIZATION_ZONE ? null : draft.displayTimeZone,
        },
      });
      setChecked(false);
      onSaved(next);
      toast.show(t('account.profile.saved'), 'success');
    } catch {
      // Shown under the form.
    }
  };
  return (
    <Card
      title={t('account.profile.detailsTitle')}
      subtitle={t('account.profile.detailsIntro')}
      footer={
        <div className="tiq-inline">
          <Button
            variant="primary"
            icon="check"
            disabled={!dirty}
            loading={update.pending}
            onClick={() => void save()}
          >
            {t('account.profile.save')}
          </Button>
          <Button disabled={!dirty} onClick={() => setDraft(initial)}>
            {t('account.profile.discard')}
          </Button>
          <span className="tiq-text-muted">
            {dirty ? t('account.profile.unsaved') : t('account.profile.upToDate')}
          </span>
        </div>
      }
    >
      <UnsavedChangesGuard when={dirty} />
      {update.error !== null && !server.hasFieldErrors && (
        <Banner tone="error" title={t('account.profile.saveFailed')}>
          <p>{orgAdminErrorMessage(update.error)}</p>
        </Banner>
      )}
      <div className="tiq-form-grid">
        <TextField
          label={t('account.profile.fullName')}
          value={draft.fullName}
          onChange={(fullName) => setDraft({ ...draft, fullName })}
          error={
            checked && nameInvalid ? t('account.profile.nameRequired') : server.forField('fullName')
          }
          required
          autoComplete="name"
        />
        <Select
          label={t('account.profile.language')}
          hint={t('account.profile.languageHint')}
          value={draft.locale}
          options={SUPPORTED_LOCALES.map((value) => ({
            value,
            label: t(`account.locale.${value}`),
          }))}
          onChange={(locale) => setDraft({ ...draft, locale })}
          error={server.forField('locale')}
          required
        />
        <Select
          label={t('account.profile.displayZone')}
          hint={t('account.profile.displayZoneHint')}
          value={draft.displayTimeZone}
          options={zoneOptions(profile.displayTimeZone)}
          onChange={(displayTimeZone) => setDraft({ ...draft, displayTimeZone })}
          error={server.forField('displayTimeZone')}
        />
      </div>
    </Card>
  );
}

function ContactCard({ profile }: { readonly profile: MyProfile }) {
  const toast = useToast();
  const timeZone = profile.officialTimeZones[0]?.timeZone ?? 'UTC';
  const request = useApiMutation(orgAdminEndpoints.requestContactChange);
  const cancel = useApiMutation(orgAdminEndpoints.cancelContactChange);
  const [changes, setChanges] = useState<readonly ContactChange[]>(profile.pendingContactChanges);
  const [field, setField] = useState<ContactChangeField | null>(null);
  const [value, setValue] = useState('');
  const [cancelling, setCancelling] = useState<ContactChange | null>(null);
  const close = (): void => {
    setField(null);
    setValue('');
    request.reset();
  };
  return (
    <Card title={t('account.profile.contactTitle')} subtitle={t('account.profile.contactIntro')}>
      <div className="tiq-stack">
        <DetailList
          items={[
            { key: 'email', label: t('account.profile.email'), value: profile.email },
            { key: 'phone', label: t('account.profile.phone'), value: profile.phone },
          ]}
        />
        <div className="tiq-inline">
          <Button size="sm" icon="mail" onClick={() => setField('email')}>
            {t('account.profile.changeEmail')}
          </Button>
          <Button size="sm" icon="edit" onClick={() => setField('phone')}>
            {t('account.profile.changePhone')}
          </Button>
        </div>
        {changes.length > 0 && (
          <ul className="tiq-stack" aria-label={t('account.profile.pendingChanges')}>
            {changes.map((change) => (
              <li key={change.changeId} className="tiq-stack">
                <span className="tiq-inline">
                  <Chip
                    tone={change.status === 'pending_confirmation' ? 'warning' : 'neutral-outlined'}
                    size="sm"
                  >
                    {t(`account.contactStatus.${change.status}`)}
                  </Chip>
                  <span>
                    {t(`account.profile.field.${change.field}`)}: {change.newValueMasked}
                  </span>
                </span>
                <span className="tiq-cell-sub">
                  {t('account.profile.changeSent', {
                    to: change.confirmationSentTo,
                    expires: formatDateTime(change.expiresAt, timeZone),
                  })}
                </span>
                {change.status === 'pending_confirmation' && (
                  <div className="tiq-inline">
                    <Button size="sm" onClick={() => setCancelling(change)}>
                      {t('account.profile.cancelChange')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {field !== null && (
        <ConfirmActionDialog
          open
          title={t(`account.profile.changeTitle.${field}`)}
          organization={{ name: t('account.profile.personalAccount'), capacity: null }}
          scope={t(`account.profile.field.${field}`)}
          consequence={t('account.profile.changeConsequence')}
          confirmLabel={t('account.profile.sendConfirmation')}
          pending={request.pending}
          error={dialogError(request.error, ['newValue'])}
          onCancel={close}
          onConfirm={async () => {
            if (value.trim().length < 3) return;
            try {
              const change = await request.mutate({ body: { field, newValue: value.trim() } });
              setChanges([change, ...changes]);
              close();
              toast.show(t('account.profile.changeRequested'), 'success');
            } catch {
              // Shown in the dialog.
            }
          }}
        >
          <TextField
            label={t(`account.profile.new.${field}`)}
            type={field === 'email' ? 'email' : 'tel'}
            value={value}
            onChange={setValue}
            hint={field === 'phone' ? t('account.profile.phoneHint') : undefined}
            error={formErrors(request.error, ['newValue']).forField('newValue')}
            required
          />
        </ConfirmActionDialog>
      )}
      {cancelling !== null && (
        <ConfirmActionDialog
          open
          title={t('account.profile.cancelTitle')}
          organization={{ name: t('account.profile.personalAccount'), capacity: null }}
          scope={`${t(`account.profile.field.${cancelling.field}`)}: ${cancelling.newValueMasked}`}
          consequence={t('account.profile.cancelConsequence')}
          confirmLabel={t('account.profile.cancelChange')}
          pending={cancel.pending}
          error={dialogError(cancel.error, [])}
          onCancel={() => {
            cancel.reset();
            setCancelling(null);
          }}
          onConfirm={async () => {
            try {
              const next = await cancel.mutate({ params: { changeId: cancelling.changeId } });
              setChanges(changes.map((item) => (item.changeId === next.changeId ? next : item)));
              setCancelling(null);
              toast.show(t('account.profile.changeCancelled'), 'success');
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </Card>
  );
}

function NotificationCard({ loaded }: { readonly loaded: NotificationPreferences }) {
  const toast = useToast();
  const update = useApiMutation(updateNotificationPreferences);
  const [saved, setSaved] = useState(loaded);
  const [items, setItems] = useState(loaded.items);
  const dirty = JSON.stringify(items) !== JSON.stringify(saved.items);
  const change = (eventType: string, patch: Partial<(typeof items)[number]>): void =>
    setItems(items.map((item) => (item.eventType === eventType ? { ...item, ...patch } : item)));
  return (
    <Card
      title={t('account.profile.notificationsTitle')}
      subtitle={t('account.profile.notificationsIntro')}
      flush
      footer={
        <div className="tiq-inline">
          <Button
            variant="primary"
            size="sm"
            icon="check"
            disabled={!dirty}
            loading={update.pending}
            onClick={() => {
              const optional = items.filter((item) => !item.mandatory);
              if (optional.length === 0) return;
              void update
                .mutate({
                  body: {
                    items: optional.map((item) => ({
                      eventType: item.eventType,
                      inApp: item.inApp,
                      email: item.email,
                      digest: item.digest,
                    })),
                  },
                })
                .then(
                  (next) => {
                    setSaved(next);
                    setItems(next.items);
                    toast.show(t('account.profile.notificationsSaved'), 'success');
                  },
                  () => undefined,
                );
            }}
          >
            {t('account.profile.saveNotifications')}
          </Button>
          {update.error !== null && (
            <span className="tiq-text-danger">{orgAdminErrorMessage(update.error)}</span>
          )}
        </div>
      }
    >
      {!saved.emailEnabled && (
        <Banner tone="info" title={t('account.profile.emailOff')}>
          <p>{t('account.profile.emailOffBody')}</p>
        </Banner>
      )}
      <DataTable
        caption={t('account.profile.notificationsTitle')}
        rows={items}
        rowKey={(row) => row.eventType}
        empty={<EmptyState compact title={t('account.profile.noNotifications')} />}
        columns={[
          {
            id: 'event',
            header: t('account.profile.col.event'),
            cell: (row) => (
              <>
                <span>{tEnum('notification_rules.event_type', row.eventType)}</span>
                {row.mandatory && (
                  <Chip tone="info" size="sm" icon="lock">
                    {t('account.profile.mandatory')}
                  </Chip>
                )}
              </>
            ),
          },
          {
            id: 'inApp',
            header: t('account.profile.col.inApp'),
            cell: (row) => (
              <Checkbox
                label={t('account.profile.inAppFor', {
                  event: tEnum('notification_rules.event_type', row.eventType),
                })}
                checked={row.mandatory || row.inApp}
                disabled={row.mandatory}
                onChange={(inApp) => change(row.eventType, { inApp })}
              />
            ),
          },
          {
            id: 'email',
            header: t('account.profile.col.email'),
            cell: (row) => (
              <Checkbox
                label={t('account.profile.emailFor', {
                  event: tEnum('notification_rules.event_type', row.eventType),
                })}
                checked={row.mandatory ? saved.emailEnabled : row.email}
                disabled={row.mandatory || !saved.emailEnabled}
                onChange={(email) => change(row.eventType, { email })}
              />
            ),
          },
          {
            id: 'digest',
            header: t('account.profile.col.digest'),
            cell: (row) =>
              row.mandatory ? (
                t('account.profile.immediate')
              ) : (
                <Select
                  label={t('account.profile.digestFor', {
                    event: tEnum('notification_rules.event_type', row.eventType),
                  })}
                  value={row.digest}
                  options={USER_NOTIFICATION_PREFERENCES_DIGEST.map((value) => ({
                    value,
                    label: tEnum('user_notification_preferences.digest', value),
                  }))}
                  onChange={(digest) =>
                    change(row.eventType, { digest: digest as UserNotificationPreferencesDigest })
                  }
                />
              ),
          },
        ]}
      />
    </Card>
  );
}

function AccessItems({
  title,
  items,
  timeZone,
}: {
  readonly title: string;
  readonly items: readonly MyAccessItem[];
  readonly timeZone: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="tiq-stack">
      <h3 className="tiq-form-section-title">{title}</h3>
      <ul className="tiq-stack">
        {items.map((item) => (
          <li key={item.id} className="tiq-stack">
            <span className="tiq-inline">
              <span>{item.description}</span>
              <AccessStatusChip status={item.status} />
            </span>
            <span className="tiq-cell-sub">
              {[
                item.permissionCode,
                item.scope?.scopeLabel,
                item.counterpart?.fullName,
                item.endsAt === null
                  ? t('admin-access.common.openEnded')
                  : t('admin-access.common.until', {
                      date: formatInstantDate(item.endsAt, timeZone),
                    }),
              ]
                .filter((part) => part !== null && part !== undefined)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrganizationAccess({
  access,
  timeZone,
}: {
  readonly access: MyAccessInOrganization;
  readonly timeZone: string;
}) {
  return (
    <Card title={access.organization.tenantName} subtitle={access.capacity ?? undefined}>
      <div className="tiq-stack">
        <section className="tiq-stack">
          <h3 className="tiq-form-section-title">{t('account.access.roles')}</h3>
          {access.roles.length === 0 ? (
            <p className="tiq-text-muted">{t('account.access.noRoles')}</p>
          ) : (
            <ul className="tiq-stack">
              {access.roles.map((role) => (
                <li key={role.assignmentId} className="tiq-inline">
                  <span>{role.role.name}</span>
                  <span className="tiq-cell-sub">
                    {role.scope.scopeLabel}
                    {role.viaGroup !== null &&
                      ` · ${t('admin-access.member.viaGroup', { group: role.viaGroup.name })}`}
                  </span>
                  <AccessStatusChip status={role.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <AccessItems
          title={t('account.access.grants')}
          items={access.directGrants}
          timeZone={timeZone}
        />
        <AccessItems
          title={t('account.access.restrictions')}
          items={access.restrictions}
          timeZone={timeZone}
        />
        <AccessItems
          title={t('account.access.delegationsGiven')}
          items={access.delegationsGiven}
          timeZone={timeZone}
        />
        <AccessItems
          title={t('account.access.delegationsReceived')}
          items={access.delegationsReceived}
          timeZone={timeZone}
        />
      </div>
    </Card>
  );
}

function ProfileView({ loaded }: { readonly loaded: MyProfile }) {
  const [profile, setProfile] = useState(loaded);
  const [version, setVersion] = useState(0);
  const timeZone = profile.displayTimeZone ?? profile.officialTimeZones[0]?.timeZone ?? 'UTC';
  const preferences = useApiQuery(getNotificationPreferences, {});
  const memberships = useApiQuery(orgAdminEndpoints.listMyMemberships, {
    query: { pageSize: 100 },
  });
  const access = useApiQuery(orgAdminEndpoints.getMyAccessSummary, {});
  return (
    <>
      <PageHeader
        title={t('account.profile.title')}
        subtitle={profile.email}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="users.status" value={profile.status} />
            {profile.lastSeenAt !== null && (
              <span className="tiq-text-muted">
                {t('account.profile.lastSeen', {
                  at: formatDateTime(profile.lastSeenAt, timeZone),
                })}
              </span>
            )}
          </span>
        }
      />
      <div className="tiq-grid tiq-grid--2">
        <ProfileForm
          key={version}
          profile={profile}
          onSaved={(next) => {
            setProfile(next);
            setVersion(version + 1);
          }}
        />
        <div className="tiq-stack">
          <ContactCard profile={profile} />
          <Card title={t('account.profile.zonesTitle')} subtitle={t('account.profile.zonesIntro')}>
            {profile.officialTimeZones.length === 0 ? (
              <EmptyState compact title={t('account.profile.noZones')} />
            ) : (
              <DetailList
                items={profile.officialTimeZones.map((zone) => ({
                  key: String(zone.organization.tenantId),
                  label: zone.organization.tenantName,
                  value: zone.timeZone,
                }))}
              />
            )}
          </Card>
        </div>
      </div>
      <QueryView query={preferences}>{(data) => <NotificationCard loaded={data} />}</QueryView>
      <Card
        title={t('account.profile.membershipsTitle')}
        actions={
          <ButtonLink size="sm" to="/me/memberships">
            {t('account.profile.allMemberships')}
          </ButtonLink>
        }
        flush
      >
        <DataTable
          caption={t('account.profile.membershipsTitle')}
          rows={memberships.data?.items}
          rowKey={(row) => String(row.membershipId)}
          loading={memberships.isFetching}
          error={memberships.error}
          onRetry={memberships.reload}
          empty={<EmptyState compact title={t('account.memberships.empty')} />}
          columns={[
            {
              id: 'org',
              header: t('account.memberships.col.organization'),
              cell: (row) => row.organization.tenantName,
            },
            {
              id: 'capacity',
              header: t('account.memberships.col.capacity'),
              cell: (row) => row.capacity ?? '—',
            },
            {
              id: 'status',
              header: t('account.memberships.col.status'),
              cell: (row) => <StatusChip enum="memberships.status" value={row.status} size="sm" />,
            },
          ]}
        />
      </Card>
      <Card title={t('account.access.title')} subtitle={t('account.access.intro')}>
        <QueryView
          query={access}
          isEmpty={(data) => data.organizations.length === 0}
          empty={<EmptyState compact title={t('account.access.empty')} />}
        >
          {(data) => (
            <div className="tiq-grid tiq-grid--2">
              {data.organizations.map((organization) => (
                <OrganizationAccess
                  key={organization.organization.tenantId}
                  access={organization}
                  timeZone={timeZone}
                />
              ))}
            </div>
          )}
        </QueryView>
      </Card>
    </>
  );
}

export default function ProfilePage() {
  const query = useApiQuery(orgAdminEndpoints.getMyProfile, {});
  return (
    <div className="tiq-page">
      <QueryView query={query}>{(profile) => <ProfileView loaded={profile} />}</QueryView>
    </div>
  );
}
