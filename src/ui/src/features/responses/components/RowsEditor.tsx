/**
 * An editable list of rows (subcontractors, key personnel, consortium members, contract exceptions): add, change and
 * remove rows, then save the whole list. Field errors of the save bind to `<prefix>.<index>.<field>`.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { ApiError } from '../../../api/client';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormErrorSummary,
  NumberInput,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { responseErrorMessage } from '../lib/errors';

export type RowValues = Readonly<Record<string, string | boolean>>;

export interface RowField {
  readonly key: string;
  readonly label: string;
  readonly kind: 'text' | 'textarea' | 'decimal' | 'checkbox';
  readonly required?: boolean;
  readonly hint?: string;
  readonly suffix?: string;
}

export interface RowsEditorProps {
  readonly title: string;
  readonly subtitle?: ReactNode;
  /** Field-error prefix of the rows in the request body, for example `subcontractors`. */
  readonly prefix: string;
  readonly fields: readonly RowField[];
  readonly initialRows: readonly RowValues[];
  readonly emptyRow: RowValues;
  /** A noun for one row, used in the add and remove labels. */
  readonly rowNoun: string;
  readonly canEdit: boolean;
  readonly emptyTitle: string;
  readonly onSave: (rows: readonly RowValues[]) => Promise<void>;
  readonly pending: boolean;
  readonly error: ApiError | null;
  /** Extra controls above the rows (for example the consortium switch) and whether they changed. */
  readonly header?: ReactNode;
  readonly headerDirty?: boolean;
  readonly onDiscard?: () => void;
  /** Validates before saving; returns a message to block the save. */
  readonly validate?: (rows: readonly RowValues[]) => string | null;
}

export function RowsEditor({
  title,
  subtitle,
  prefix,
  fields,
  initialRows,
  emptyRow,
  rowNoun,
  canEdit,
  emptyTitle,
  onSave,
  pending,
  error,
  header,
  headerDirty = false,
  onDiscard,
  validate,
}: RowsEditorProps) {
  const [rows, setRows] = useState<readonly RowValues[]>(initialRows);
  const [problem, setProblem] = useState<string | null>(null);
  const errors = formErrors(error, [prefix]);
  const listErrors = (error?.fieldErrors ?? []).filter(
    (item) => item.field === prefix || !item.field.startsWith(`${prefix}.`),
  );
  const dirty = headerDirty || JSON.stringify(rows) !== JSON.stringify(initialRows);

  const update = (index: number, key: string, value: string | boolean): void => {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, [key]: value } : row)),
    );
  };

  const save = async (): Promise<void> => {
    const message = validate?.(rows) ?? null;
    setProblem(message);
    if (message !== null) return;
    try {
      await onSave(rows);
    } catch {
      // The caller's mutation keeps the error, shown below.
    }
  };

  const fieldError = (index: number, key: string): string | undefined =>
    errors.forField(`${prefix}.${index}.${key}`);

  return (
    <Card
      title={title}
      subtitle={subtitle}
      actions={
        canEdit ? (
          <Button
            size="sm"
            icon="plus"
            onClick={() => setRows((current) => [...current, emptyRow])}
          >
            {t('responses.rows.add', { noun: rowNoun })}
          </Button>
        ) : undefined
      }
    >
      <UnsavedChangesGuard when={dirty} />
      {header}
      {rows.length === 0 ? (
        <EmptyState compact title={emptyTitle} />
      ) : (
        <div className="tiq-stack">
          {rows.map((row, index) => (
            <fieldset key={index} className="tiq-fieldset" disabled={!canEdit}>
              <legend>{t('responses.rows.legend', { noun: rowNoun, no: index + 1 })}</legend>
              <div className="tiq-form-grid">
                {fields.map((field) => {
                  const value = row[field.key];
                  if (field.kind === 'checkbox') {
                    return (
                      <Checkbox
                        key={field.key}
                        label={field.label}
                        hint={field.hint}
                        checked={value === true}
                        onChange={(checked) => update(index, field.key, checked)}
                        error={fieldError(index, field.key)}
                      />
                    );
                  }
                  const text = typeof value === 'string' ? value : '';
                  if (field.kind === 'textarea') {
                    return (
                      <TextArea
                        key={field.key}
                        label={field.label}
                        hint={field.hint}
                        required={field.required}
                        value={text}
                        rows={2}
                        onChange={(next) => update(index, field.key, next)}
                        error={fieldError(index, field.key)}
                      />
                    );
                  }
                  if (field.kind === 'decimal') {
                    return (
                      <NumberInput
                        key={field.key}
                        label={field.label}
                        hint={field.hint}
                        required={field.required}
                        value={text}
                        places={2}
                        suffix={field.suffix}
                        onChange={(next) => update(index, field.key, next)}
                        error={fieldError(index, field.key)}
                      />
                    );
                  }
                  return (
                    <TextField
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      required={field.required}
                      value={text}
                      onChange={(next) => update(index, field.key, next)}
                      error={fieldError(index, field.key)}
                    />
                  );
                })}
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="danger-soft"
                  icon="trash"
                  onClick={() =>
                    setRows((current) => current.filter((_, position) => position !== index))
                  }
                >
                  {t('responses.rows.remove', { noun: rowNoun, no: index + 1 })}
                </Button>
              )}
            </fieldset>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="tiq-inline tiq-stack--spaced">
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={!dirty}
            onClick={() => void save()}
          >
            {t('responses.rows.save')}
          </Button>
          <Button
            size="sm"
            disabled={!dirty || pending}
            onClick={() => {
              setRows(initialRows);
              setProblem(null);
              onDiscard?.();
            }}
          >
            {t('responses.answer.discard')}
          </Button>
        </div>
      )}
      {problem !== null && (
        <Banner tone="error" title={t('responses.rows.invalid')}>
          <p>{problem}</p>
        </Banner>
      )}
      {error !== null && (
        <FormErrorSummary title={responseErrorMessage(error)} errors={listErrors} />
      )}
    </Card>
  );
}
