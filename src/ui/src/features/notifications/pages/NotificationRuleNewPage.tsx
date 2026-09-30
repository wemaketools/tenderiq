/**
 * ADM-12 — a rule for an event that has none yet. The event catalog provides the default recipients, the roles
 * that apply, the placeholders and whether the event is a mandatory formal notice (then the rule is locked
 * mandatory).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { createNotificationRule, listNotificationEvents } from '@contracts/notification-rules';
import type {
  NotificationEventCatalogItem,
  NotificationRuleDetail,
} from '@contracts/notification-rules';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  PageHeader,
  QueryView,
  Select,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { localizeError } from '../../tasks/lib/shared';
import { RuleForm } from '../components/RuleForm';
import { notificationPaths } from '../lib/paths';
import { ruleFields, validateRule } from '../lib/rules';
import type { RuleFormValues } from '../lib/rules';

function initialValues(item: NotificationEventCatalogItem): RuleFormValues {
  return {
    recipientRoles: item.defaultRecipientRoles,
    mandatory: item.mandatory,
    subjectTemplate: '',
    bodyTemplate: '',
    reminderOffsetsHours: [],
    escalateAfterHours: '',
    escalationRole: '',
  };
}

function NewRuleForm({ items }: { readonly items: readonly NotificationEventCatalogItem[] }) {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const toast = useToast();
  const available = items.filter((item) => item.ruleId === null);
  const [eventType, setEventType] = useState('');
  const [values, setValues] = useState<RuleFormValues | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [eventMissing, setEventMissing] = useState(false);
  const create = useApiMutation(createNotificationRule);
  const item = available.find((candidate) => candidate.eventType === eventType);
  const [created, setCreated] = useState<NotificationRuleDetail | null>(null);
  const dirty = values !== null && created === null;

  useEffect(() => {
    if (created !== null) {
      void navigate(notificationPaths.rule(created.id), { state: { record: created } });
    }
  }, [created, navigate]);

  const ask = (): void => {
    if (item === undefined || values === null) {
      setEventMissing(true);
      return;
    }
    const found = validateRule(values);
    setProblems(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  };

  if (available.length === 0) {
    return <Banner tone="info">{t('notifications.rule.noEventLeft')}</Banner>;
  }

  return (
    <Card
      title={t('notifications.rule.newTitle')}
      subtitle={item?.description}
      footer={
        <Button variant="primary" icon="plus" onClick={ask}>
          {t('notifications.rule.create')}
        </Button>
      }
    >
      <UnsavedChangesGuard when={dirty} />
      <div className="tiq-stack">
        <Select
          label={t('notifications.rule.eventType')}
          placeholder={t('notifications.rule.chooseEvent')}
          required
          value={eventType}
          error={
            eventMissing && item === undefined ? t('notifications.rule.chooseEvent') : undefined
          }
          options={available.map((candidate) => ({
            value: candidate.eventType,
            label: tEnum('notification_rules.event_type', candidate.eventType),
          }))}
          onChange={(next) => {
            setEventType(next);
            const chosen = available.find((candidate) => candidate.eventType === next);
            setValues(chosen === undefined ? null : initialValues(chosen));
            setProblems({});
          }}
        />
        {item !== undefined && values !== null && (
          <RuleForm
            eventType={item.eventType}
            values={values}
            onChange={setValues}
            placeholders={item.placeholders}
            allowedRecipientRoles={item.allowedRecipientRoles}
            mandatoryLocked={item.mandatory}
            supportsReminders={item.supportsReminders}
            problems={problems}
            error={create.error}
          />
        )}
      </div>
      {item !== undefined && values !== null && (
        <ConfirmActionDialog
          open={confirming}
          title={t('notifications.rule.createTitle')}
          scope={t('notifications.rule.scope', {
            event: tEnum('notification_rules.event_type', item.eventType),
            organization: tenant?.name ?? '',
          })}
          consequence={t('notifications.rule.createConsequence')}
          confirmLabel={t('notifications.rule.create')}
          pending={create.pending}
          error={localizeError(create.error, 'notifications')}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            const result = await create
              .mutate({
                body: { eventType: item.eventType, ...ruleFields(values), active: true },
              })
              .catch(() => null);
            setConfirming(false);
            if (result !== null) {
              toast.show(t('notifications.rule.created'), 'success');
              setCreated(result);
            }
          }}
        />
      )}
    </Card>
  );
}

export default function NotificationRuleNewPage() {
  const events = useApiQuery(listNotificationEvents, {});
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('notifications.rule.newTitle')}
        back={{ to: notificationPaths.rules, label: t('notifications.rule.back') }}
      />
      <QueryView query={events}>{(data) => <NewRuleForm items={data.items} />}</QueryView>
    </div>
  );
}
