/**
 * The ADM-12 rule editor: recipients, mandatory flag (locked on for formal notices), subject and message templates
 * with the event's placeholders, reminders before the deadline and the escalation of overdue work. A preview renders
 * the templates with sample values and reports unknown or confidential placeholders (BR-43) before saving.
 */
import { useState } from 'react';

import { previewNotificationTemplate } from '@contracts/notification-rules';
import type { NotificationRecipientRole, TemplatePlaceholder } from '@contracts/notification-rules';
import type { NotificationRulesEventType } from '@contracts/enums';

import type { ApiError } from '../../../api/client';
import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DetailList,
  FormErrorSummary,
  IconButton,
  MultiSelect,
  NumberInput,
  OfficialDeadline,
  Select,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { errorMessage, formatHours } from '../../tasks/lib/shared';
import { RULE_FIELDS } from '../lib/rules';
import type { RuleFormValues } from '../lib/rules';

export interface RuleFormProps {
  readonly eventType: NotificationRulesEventType;
  readonly values: RuleFormValues;
  readonly onChange: (values: RuleFormValues) => void;
  readonly placeholders: readonly TemplatePlaceholder[];
  readonly allowedRecipientRoles: readonly NotificationRecipientRole[];
  readonly mandatoryLocked: boolean;
  readonly supportsReminders: boolean;
  /** Client-side problems, shown after a submit attempt. */
  readonly problems: Readonly<Record<string, string>>;
  readonly error: ApiError | null;
}

export function RuleForm({
  eventType,
  values,
  onChange,
  placeholders,
  allowedRecipientRoles,
  mandatoryLocked,
  supportsReminders,
  problems,
  error,
}: RuleFormProps) {
  const preview = useApiMutation(previewNotificationTemplate);
  const [reminder, setReminder] = useState('');
  const [reminderError, setReminderError] = useState<string | undefined>(undefined);
  const serverErrors = formErrors(error, RULE_FIELDS);
  const fieldError = (name: string): string | undefined =>
    problems[name] ?? serverErrors.forField(name);
  const set = (patch: Partial<RuleFormValues>): void => onChange({ ...values, ...patch });
  const roleOptions = allowedRecipientRoles.map((value) => ({
    value,
    label: t(`notifications.recipient.${value}`),
  }));

  const addReminder = (): void => {
    const trimmed = reminder.trim();
    if (!/^[1-9]\d*$/.test(trimmed) || Number(trimmed) > 1440) {
      setReminderError(t('notifications.errors.reminderHours'));
      return;
    }
    const hours = Number(trimmed);
    if (values.reminderOffsetsHours.includes(hours)) {
      setReminderError(t('notifications.errors.reminderDuplicate'));
      return;
    }
    if (values.reminderOffsetsHours.length >= 6) {
      setReminderError(t('notifications.errors.reminderTooMany'));
      return;
    }
    setReminderError(undefined);
    setReminder('');
    set({ reminderOffsetsHours: [...values.reminderOffsetsHours, hours].sort((a, b) => b - a) });
  };

  const runPreview = (): void => {
    void preview
      .mutate({
        body: {
          eventType,
          subjectTemplate: values.subjectTemplate,
          bodyTemplate: values.bodyTemplate,
        },
      })
      .catch(() => null);
  };

  const result = preview.data;
  return (
    <div className="tiq-stack">
      {error !== null && error.fieldErrors.length === 0 && (
        <Banner tone="error" title={error.title}>
          {errorMessage(error, 'notifications')}
        </Banner>
      )}
      {serverErrors.other.length > 0 && (
        <FormErrorSummary title={error?.title ?? null} errors={serverErrors.other} />
      )}
      <div className="tiq-form-grid">
        <div className="tiq-form-full">
          <Checkbox
            label={t('notifications.rule.mandatory')}
            hint={
              mandatoryLocked
                ? t('notifications.rule.mandatoryLockedHint')
                : t('notifications.rule.mandatoryHint')
            }
            checked={mandatoryLocked || values.mandatory}
            disabled={mandatoryLocked}
            onChange={(mandatory) => set({ mandatory })}
            error={fieldError('mandatory')}
          />
        </div>
        <MultiSelect
          label={t('notifications.rule.recipients')}
          hint={t('notifications.rule.recipientsHint')}
          required
          fieldClassName="tiq-form-full"
          value={values.recipientRoles}
          options={roleOptions}
          onChange={(roles) => set({ recipientRoles: roles as NotificationRecipientRole[] })}
          error={fieldError('recipientRoles')}
        />
        <TextField
          label={t('notifications.rule.subject')}
          hint={t('notifications.rule.templateHint')}
          required
          fieldClassName="tiq-form-full"
          value={values.subjectTemplate}
          onChange={(subjectTemplate) => set({ subjectTemplate })}
          error={fieldError('subjectTemplate')}
        />
        <TextArea
          label={t('notifications.rule.body')}
          required
          rows={5}
          fieldClassName="tiq-form-full"
          value={values.bodyTemplate}
          onChange={(bodyTemplate) => set({ bodyTemplate })}
          error={fieldError('bodyTemplate')}
        />
        <div className="tiq-form-full">
          <h3 className="tiq-form-section-title">{t('notifications.rule.placeholders')}</h3>
          <ul className="tiq-check-list">
            {placeholders.map((item) => (
              <li key={item.name}>
                <span className="tiq-mono">{`{{${item.name}}}`}</span>{' '}
                <span className="tiq-text-muted">
                  {t('notifications.rule.placeholderLine', {
                    description: item.description,
                    example: item.example,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="tiq-form-full">
          <h3 className="tiq-form-section-title">{t('notifications.rule.reminders')}</h3>
          {supportsReminders ? (
            <div className="tiq-stack">
              <span className="tiq-inline">
                {values.reminderOffsetsHours.map((hours) => (
                  <span key={hours} className="tiq-inline">
                    <Chip tone="info" size="sm">
                      {formatHours(hours)}
                    </Chip>
                    <IconButton
                      icon="x"
                      size="sm"
                      variant="ghost"
                      label={t('notifications.rule.removeReminder', { hours })}
                      onClick={() =>
                        set({
                          reminderOffsetsHours: values.reminderOffsetsHours.filter(
                            (value) => value !== hours,
                          ),
                        })
                      }
                    />
                  </span>
                ))}
              </span>
              <span className="tiq-inline">
                <NumberInput
                  label={t('notifications.rule.reminderHours')}
                  hint={t('notifications.rule.remindersHint')}
                  value={reminder}
                  places={0}
                  onChange={setReminder}
                  error={reminderError ?? fieldError('reminderOffsetsHours')}
                />
                <Button icon="plus" onClick={addReminder}>
                  {t('notifications.rule.addReminder')}
                </Button>
              </span>
            </div>
          ) : (
            <p className="tiq-text-muted">{t('notifications.rule.noReminderSupport')}</p>
          )}
        </div>
        <NumberInput
          label={t('notifications.rule.escalateAfter')}
          value={values.escalateAfterHours}
          places={0}
          onChange={(escalateAfterHours) => set({ escalateAfterHours })}
          error={fieldError('escalateAfterHours')}
        />
        <Select
          label={t('notifications.rule.escalationRole')}
          placeholder={t('notifications.rule.noEscalation')}
          value={values.escalationRole}
          options={roleOptions}
          onChange={(escalationRole) => set({ escalationRole })}
          error={fieldError('escalationRole')}
        />
      </div>
      <div className="tiq-inline">
        <Button icon="eye" loading={preview.pending} onClick={runPreview}>
          {t('notifications.rule.preview')}
        </Button>
      </div>
      {preview.error !== null && (
        <Banner tone="error">{errorMessage(preview.error, 'notifications')}</Banner>
      )}
      {result !== undefined && (
        <Card
          title={t('notifications.rule.previewTitle')}
          subtitle={t('notifications.rule.previewIntro')}
        >
          {result.unknownPlaceholders.length > 0 && (
            <Banner tone="error">
              {t('notifications.rule.unknownPlaceholders', {
                list: result.unknownPlaceholders.join(', '),
              })}
            </Banner>
          )}
          {result.confidentialPlaceholders.length > 0 && (
            <Banner tone="error">
              {t('notifications.rule.confidentialPlaceholders', {
                list: result.confidentialPlaceholders.join(', '),
              })}
            </Banner>
          )}
          <DetailList
            stacked
            items={[
              {
                key: 'subject',
                label: t('notifications.rule.previewSubject'),
                value: result.subject,
              },
              { key: 'body', label: t('notifications.rule.previewBody'), value: result.body },
              {
                key: 'email',
                label: t('notifications.rule.previewEmail'),
                value: (
                  <span className="tiq-stack">
                    <strong>{result.emailSubject}</strong>
                    <span>{result.emailBody}</span>
                  </span>
                ),
              },
              {
                key: 'deadline',
                label: t('notifications.rule.previewDeadline'),
                value:
                  result.sampleDeadline === null ? null : (
                    <OfficialDeadline deadline={result.sampleDeadline} showLocal={false} />
                  ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
