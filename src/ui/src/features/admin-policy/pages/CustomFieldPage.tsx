/**
 * ADM-07 — one business field: its definition, the fields whose requirement depends on it, how many records hold
 * a value (and how many of those are issued), its change history, and the actions: edit (label and purpose apply
 * to new forms; key, type and existing choices are locked once issued records carry it), deactivate (hidden from
 * new forms, issued records keep their values) and reactivate.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import {
  UpdateCustomFieldBody,
  deactivateCustomField,
  getCustomField,
  listCustomFields,
  reactivateCustomField,
  updateCustomField,
} from '@contracts/policy';
import type { CustomFieldDetail } from '@contracts/policy';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  FormErrorSummary,
  PageHeader,
  QueryView,
  StatusChip,
  Timeline,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { FieldDefinitionForm } from '../components/FieldDefinitionForm';
import { PolicyLayout } from '../components/PolicyLayout';
import { policyErrorMessage, withPolicyMessage } from '../lib/errors';
import { FIELD_FORM_FIELDS, draftToRule, fieldToDraft } from '../lib/fieldDraft';
import type { FieldDraft } from '../lib/fieldDraft';
import { conditionValueLabel, requirementText } from '../lib/fieldText';
import { useCommandResult, useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { policyPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

type Action = 'deactivate' | 'reactivate' | null;

interface FieldViewProps {
  readonly field: CustomFieldDetail;
  readonly onUpdated: (field: CustomFieldDetail) => void;
}

function FieldView({ field, onUpdated }: FieldViewProps) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [editing, setEditing] = useState<FieldDraft | null>(null);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [action, setAction] = useState<Action>(null);
  const update = useApiMutation(updateCustomField);
  const deactivate = useApiMutation(deactivateCustomField);
  const reactivate = useApiMutation(reactivateCustomField);
  const siblings = useApiQuery(listCustomFields, {
    query: { entityType: [field.entityType], pageSize: 100 },
  });
  const caps = field.capabilities;
  const errors = errorLookup(clientErrors, update.error, FIELD_FORM_FIELDS);
  const scope = t('admin-policy.field.scope', {
    label: field.label,
    form: tEnum('custom_fields.entity_type', field.entityType),
  });

  const save = async (): Promise<void> => {
    if (editing === null) return;
    const body = { ...draftToRule(editing), changeNote: editing.changeNote };
    const problems = validateWith(UpdateCustomFieldBody, body);
    setClientErrors(problems);
    if (problems.length > 0) return;
    try {
      const saved = await update.mutate({ params: { fieldId: field.id }, body });
      onUpdated(saved);
      setEditing(null);
      toast.show(t('admin-policy.field.saved'), 'success');
    } catch {
      // Shown above the form.
    }
  };

  const closeAction = (): void => {
    deactivate.reset();
    reactivate.reset();
    setAction(null);
  };

  return (
    <>
      <UnsavedChangesGuard when={editing !== null} />
      <PageHeader
        title={field.label}
        back={{ to: policyPaths.fields, label: t('admin-policy.fields.back') }}
        meta={
          <span className="tiq-inline">
            <span className="tiq-mono">{field.key}</span>
            {field.active ? (
              <Chip tone="success">{t('admin-policy.fields.active')}</Chip>
            ) : (
              <Chip tone="neutral">{t('admin-policy.fields.inactive')}</Chip>
            )}
            <span>{tEnum('custom_fields.entity_type', field.entityType)}</span>
            {caps.structureLocked && (
              <Chip tone="info" icon="lock">
                {t('admin-policy.field.lockedChip')}
              </Chip>
            )}
          </span>
        }
        primaryAction={
          editing !== null ? (
            <Button
              variant="primary"
              icon="check"
              loading={update.pending}
              onClick={() => void save()}
            >
              {t('admin-policy.field.save')}
            </Button>
          ) : caps.canEdit ? (
            <Button variant="primary" icon="edit" onClick={() => setEditing(fieldToDraft(field))}>
              {t('admin-policy.field.edit')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {editing !== null && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setClientErrors([]);
                  update.reset();
                }}
              >
                {t('admin-policy.common.cancelEditing')}
              </Button>
            )}
            {editing === null && caps.canDeactivate && (
              <Button variant="danger-soft" icon="ban" onClick={() => setAction('deactivate')}>
                {t('admin-policy.field.deactivate')}
              </Button>
            )}
            {editing === null && caps.canReactivate && (
              <Button icon="refresh" onClick={() => setAction('reactivate')}>
                {t('admin-policy.field.reactivate')}
              </Button>
            )}
          </>
        }
      />
      {!field.active && (
        <Banner tone="warning" title={t('admin-policy.field.inactiveTitle')}>
          <p>{t('admin-policy.field.inactiveBody')}</p>
        </Banner>
      )}
      {editing !== null ? (
        <Card title={t('admin-policy.field.editTitle')}>
          {(errors.other.length > 0 || (update.error !== null && errors.count === 0)) && (
            <FormErrorSummary
              title={update.error === null ? null : policyErrorMessage(update.error)}
              errors={errors.other}
            />
          )}
          <FieldDefinitionForm
            mode="edit"
            value={editing}
            onChange={setEditing}
            errors={errors}
            structureLocked={caps.structureLocked}
            issuedAudience={field.audience}
            fieldId={field.id}
          />
        </Card>
      ) : (
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack">
            <Card title={t('admin-policy.field.definition')}>
              <DetailList
                items={[
                  { key: 'label', label: t('admin-policy.fieldForm.label'), value: field.label },
                  {
                    key: 'purpose',
                    label: t('admin-policy.fieldForm.purpose'),
                    value: field.purpose,
                  },
                  {
                    key: 'form',
                    label: t('admin-policy.fieldForm.form'),
                    value: tEnum('custom_fields.entity_type', field.entityType),
                  },
                  {
                    key: 'type',
                    label: t('admin-policy.fieldForm.type'),
                    value: tEnum('custom_fields.field_type', field.fieldType),
                  },
                  {
                    key: 'choices',
                    label: t('admin-policy.fieldForm.choices'),
                    value: field.allowedValues.join(', '),
                  },
                  {
                    key: 'required',
                    label: t('admin-policy.fieldForm.requiredMode'),
                    value: requirementText(field, siblings.data?.items ?? []),
                  },
                  {
                    key: 'audience',
                    label: t('admin-policy.fieldForm.audience'),
                    value: (
                      <StatusChip enum="custom_fields.audience" value={field.audience} size="sm" />
                    ),
                  },
                  {
                    key: 'reports',
                    label: t('admin-policy.fieldForm.reports'),
                    value: field.includeInReports
                      ? t('admin-policy.common.yes')
                      : t('admin-policy.common.no'),
                  },
                ]}
              />
            </Card>
            <Card
              title={t('admin-policy.field.dependents')}
              subtitle={t('admin-policy.field.dependentsHint')}
            >
              {field.dependents.length === 0 ? (
                <EmptyState compact title={t('admin-policy.field.noDependents')} />
              ) : (
                <ul className="tiq-stack">
                  {field.dependents.map((dependent) => (
                    <li key={dependent.id}>
                      {t('admin-policy.field.dependent', {
                        label: dependent.label,
                        value: conditionValueLabel(field.key, dependent.requiredConditionValue),
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <div className="tiq-stack">
            <Card title={t('admin-policy.field.usage')}>
              <DetailList
                items={[
                  {
                    key: 'values',
                    label: t('admin-policy.field.valueCount'),
                    value: formatCount(field.valueCount),
                  },
                  {
                    key: 'issued',
                    label: t('admin-policy.field.issuedCount'),
                    value: formatCount(field.issuedRecordCount),
                  },
                  {
                    key: 'created',
                    label: t('admin-policy.field.created'),
                    value: t('admin-policy.common.byOn', {
                      who: field.createdBy?.fullName ?? t('admin-policy.common.unknownPerson'),
                      date: formatDateTime(field.createdAt, timeZone),
                    }),
                  },
                  {
                    key: 'updated',
                    label: t('admin-policy.field.updated'),
                    value: t('admin-policy.common.byOn', {
                      who: field.updatedBy?.fullName ?? t('admin-policy.common.unknownPerson'),
                      date: formatDateTime(field.updatedAt, timeZone),
                    }),
                  },
                ]}
                stacked
              />
            </Card>
            <Card title={t('admin-policy.field.history')}>
              {field.history.length === 0 ? (
                <EmptyState compact title={t('admin-policy.field.noHistory')} />
              ) : (
                <Timeline
                  label={t('admin-policy.field.history')}
                  items={field.history.map((change, index) => ({
                    id: index,
                    title: change.summary,
                    meta: t('admin-policy.common.byOn', {
                      who: change.by?.fullName ?? t('admin-policy.common.unknownPerson'),
                      date: formatDateTime(change.at, timeZone),
                    }),
                  }))}
                />
              )}
            </Card>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={action === 'deactivate'}
        tone="danger"
        title={t('admin-policy.field.deactivateTitle')}
        scope={scope}
        consequence={t('admin-policy.field.deactivateConsequence', {
          count: field.issuedRecordCount,
        })}
        confirmLabel={t('admin-policy.field.deactivate')}
        reason={{ label: t('admin-policy.common.reasonLabel'), required: true }}
        pending={deactivate.pending}
        error={withPolicyMessage(deactivate.error)}
        onCancel={closeAction}
        onConfirm={async ({ reason }) => {
          try {
            const result = await deactivate.mutate({
              params: { fieldId: field.id },
              body: { reason },
            });
            onUpdated(result);
            toast.show(t('admin-policy.field.deactivated'), 'success');
            setAction(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      />
      <ConfirmActionDialog
        open={action === 'reactivate'}
        title={t('admin-policy.field.reactivateTitle')}
        scope={scope}
        consequence={t('admin-policy.field.reactivateConsequence')}
        confirmLabel={t('admin-policy.field.reactivate')}
        pending={reactivate.pending}
        error={withPolicyMessage(reactivate.error)}
        onCancel={closeAction}
        onConfirm={async () => {
          try {
            const result = await reactivate.mutate({ params: { fieldId: field.id } });
            onUpdated(result);
            toast.show(t('admin-policy.field.reactivated'), 'success');
            setAction(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </>
  );
}

export default function CustomFieldPage() {
  const fieldId = useIdParam('fieldId');
  const [latest, setLatest] = useCommandResult<CustomFieldDetail>(fieldId);
  const query = useApiQuery(getCustomField, fieldId === null ? null : { params: { fieldId } });
  return (
    <PolicyLayout>
      {fieldId === null ? (
        <EmptyState title={t('admin-policy.common.notFound')} />
      ) : latest !== null ? (
        <FieldView field={latest} onUpdated={setLatest} />
      ) : (
        <QueryView query={query}>
          {(field) => <FieldView field={field} onUpdated={setLatest} />}
        </QueryView>
      )}
    </PolicyLayout>
  );
}
