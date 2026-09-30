/**
 * ADM-12 — one notification rule: recipients, mandatory flag, templates, reminders, escalation, delivery channels
 * and the last 30 days of deliveries. Saving applies to notifications created afterwards; mandatory formal notices
 * can never be made optional or deactivated (PRD §14.3).
 */
import { useState } from 'react';

import {
  getNotificationRule,
  listNotificationEvents,
  setNotificationRuleStatus,
  updateNotificationRule,
} from '@contracts/notification-rules';
import type { NotificationRuleDetail } from '@contracts/notification-rules';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { HistoryTimeline } from '../../../components/audit';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonBlock,
  StatusChip,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { formatCount, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  localizeError,
  useCommandResult,
  useDisplayTimeZone,
  useIdParam,
} from '../../tasks/lib/shared';
import { RuleForm } from '../components/RuleForm';
import { notificationPaths } from '../lib/paths';
import { ruleFields, sameValues, validateRule, valuesOf } from '../lib/rules';
import type { RuleFormValues } from '../lib/rules';

function RuleEditor({
  rule,
  onSaved,
}: {
  readonly rule: NotificationRuleDetail;
  readonly onSaved: (rule: NotificationRuleDetail) => void;
}) {
  const events = useApiQuery(listNotificationEvents, {});
  const catalogItem = events.data?.items.find((item) => item.eventType === rule.eventType);
  const timeZone = useDisplayTimeZone();
  const tenant = useActiveTenant();
  const canAudit = usePermission('audit.view');
  const toast = useToast();
  const saved = valuesOf(rule);
  const [values, setValues] = useState<RuleFormValues>(saved);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<'save' | 'status' | null>(null);
  const save = useApiMutation(updateNotificationRule);
  const status = useApiMutation(setNotificationRuleStatus);
  const dirty = !sameValues(values, saved);
  const eventLabel = tEnum('notification_rules.event_type', rule.eventType);
  const scope = t('notifications.rule.scope', {
    event: eventLabel,
    organization: tenant?.name ?? '',
  });

  const askSave = (): void => {
    const found = validateRule(values);
    setProblems(found);
    if (Object.keys(found).length === 0) setConfirm('save');
  };

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={eventLabel}
        back={{ to: notificationPaths.rules, label: t('notifications.rule.back') }}
        subtitle={
          rule.updatedBy === null
            ? t('notifications.rule.lastUpdatedSystem', {
                time: formatOfficialTime(rule.updatedAt, timeZone),
              })
            : t('notifications.rule.lastUpdated', {
                time: formatOfficialTime(rule.updatedAt, timeZone),
                name: rule.updatedBy.fullName,
              })
        }
        meta={
          <>
            <StatusChip enum="notifications.category" value={rule.category} size="sm" />
            {rule.mandatory && (
              <Chip tone="neutral" size="sm" icon="lock">
                {rule.mandatoryLocked
                  ? t('notifications.rules.locked')
                  : t('notifications.rules.mandatory')}
              </Chip>
            )}
            <Chip tone={rule.active ? 'success' : 'neutral'} size="sm">
              {rule.active ? t('notifications.rules.active') : t('notifications.rules.inactive')}
            </Chip>
            <span className={dirty ? 'tiq-text-warning' : 'tiq-text-muted'} role="status">
              {dirty
                ? t('notifications.rule.unsavedChanges')
                : rule.active
                  ? t('notifications.rule.statusSaved')
                  : t('notifications.rule.statusInactive')}
            </span>
          </>
        }
        primaryAction={
          <Button variant="primary" icon="check" disabled={!dirty} onClick={askSave}>
            {t('notifications.rule.save')}
          </Button>
        }
        actions={
          <Button
            icon={rule.active ? 'pause' : 'play'}
            disabled={rule.active && rule.mandatory}
            title={
              rule.active && rule.mandatory ? t('notifications.rule.cannotDeactivate') : undefined
            }
            onClick={() => setConfirm('status')}
          >
            {rule.active ? t('notifications.rule.deactivate') : t('notifications.rule.activate')}
          </Button>
        }
      />
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('notifications.rule.loadingTitle')} subtitle={catalogItem?.description}>
          <RuleForm
            eventType={rule.eventType}
            values={values}
            onChange={setValues}
            placeholders={rule.placeholders}
            allowedRecipientRoles={rule.allowedRecipientRoles}
            mandatoryLocked={rule.mandatoryLocked}
            supportsReminders={
              catalogItem?.supportsReminders ?? rule.reminderOffsetsHours.length > 0
            }
            problems={problems}
            error={save.error}
          />
        </Card>
        <div className="tiq-stack">
          <Card title={t('notifications.rule.channels')}>
            <span className="tiq-inline">
              {rule.channels.map((channel) => (
                <Chip key={channel} tone="info" size="sm">
                  {tEnum('notification_deliveries.channel', channel)}
                </Chip>
              ))}
            </span>
          </Card>
          <Card title={t('notifications.rule.stats')}>
            <DetailList
              items={[
                {
                  key: 'sent',
                  label: t('notifications.rule.sent'),
                  value: formatCount(rule.deliveryStats.sent),
                },
                {
                  key: 'delivered',
                  label: t('notifications.rule.delivered'),
                  value: formatCount(rule.deliveryStats.delivered),
                },
                {
                  key: 'failed',
                  label: t('notifications.rule.failed'),
                  value: (
                    <span className={rule.deliveryStats.failed > 0 ? 'tiq-text-danger' : undefined}>
                      {formatCount(rule.deliveryStats.failed)}
                    </span>
                  ),
                },
                {
                  key: 'notConfigured',
                  label: t('notifications.rule.notConfigured'),
                  value: formatCount(rule.deliveryStats.notConfigured),
                },
              ]}
            />
          </Card>
          {canAudit && (
            <HistoryTimeline
              entityType="notification_rule"
              entityId={rule.id}
              title={t('notifications.rule.history')}
            />
          )}
        </div>
      </div>
      <ConfirmActionDialog
        open={confirm === 'save'}
        title={t('notifications.rule.saveTitle')}
        scope={scope}
        consequence={t('notifications.rule.saveConsequence')}
        confirmLabel={t('notifications.rule.save')}
        reason={{
          label: t('notifications.rule.changeNote'),
          hint: t('notifications.rule.changeNoteHint'),
          required: false,
        }}
        pending={save.pending}
        error={localizeError(save.error, 'notifications')}
        onCancel={() => setConfirm(null)}
        onConfirm={async ({ reason }) => {
          const result = await save
            .mutate({
              params: { ruleId: rule.id },
              body: { ...ruleFields(values), ...(reason === '' ? {} : { changeNote: reason }) },
            })
            .catch(() => null);
          setConfirm(null);
          if (result !== null) {
            toast.show(t('notifications.rule.saved'), 'success');
            onSaved(result);
          }
        }}
      />
      <ConfirmActionDialog
        open={confirm === 'status'}
        title={
          rule.active
            ? t('notifications.rule.deactivateTitle')
            : t('notifications.rule.activateTitle')
        }
        scope={scope}
        consequence={
          rule.active
            ? t('notifications.rule.deactivateConsequence')
            : t('notifications.rule.activateConsequence')
        }
        confirmLabel={
          rule.active ? t('notifications.rule.deactivate') : t('notifications.rule.activate')
        }
        tone={rule.active ? 'danger' : 'primary'}
        reason={{ label: t('notifications.rule.statusReason'), required: true }}
        pending={status.pending}
        error={localizeError(status.error, 'notifications')}
        onCancel={() => setConfirm(null)}
        onConfirm={async ({ reason }) => {
          const result = await status
            .mutate({ params: { ruleId: rule.id }, body: { active: !rule.active, reason } })
            .catch(() => null);
          if (result !== null) {
            setConfirm(null);
            toast.show(
              result.active
                ? t('notifications.rule.activated')
                : t('notifications.rule.deactivated'),
              'success',
            );
            onSaved(result);
          }
        }}
      />
    </div>
  );
}

export default function NotificationRulePage() {
  const ruleId = useIdParam('ruleId');
  const query = useApiQuery(getNotificationRule, ruleId === null ? null : { params: { ruleId } });
  const [result, setResult] = useCommandResult<NotificationRuleDetail>(ruleId);
  const rule = result ?? query.data;
  if (rule === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('notifications.rule.loadingTitle')}
          back={{ to: notificationPaths.rules, label: t('notifications.rule.back') }}
        />
        {ruleId === null ? (
          <EmptyState icon="alertCircle" title={t('notifications.errors.RULE_NOT_FOUND')} />
        ) : query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return (
    <RuleEditor
      key={`${rule.id}:${rule.updatedAt}:${String(rule.active)}`}
      rule={rule}
      onSaved={setResult}
    />
  );
}
