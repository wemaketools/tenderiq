/**
 * Saved views (COM-08, PRD §15.2 "saved filters"): the caller's own named filter sets per screen. A view belongs to
 * one organization (the active one when it is saved); editing or deleting a view acts in the view's organization
 * (DD-21). Used by global search, the procurement dashboard (BUY-01) and management reports (REP-01).
 */
import { useState } from 'react';

import type { JsonObject } from '@contracts/common';
import { reportingEndpoints } from '@contracts/reporting';
import type { SavedView } from '@contracts/reporting';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Checkbox,
  ConfirmActionDialog,
  Dialog,
  FormErrorSummary,
  Menu,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { MenuEntry } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { businessErrorMessage } from '../../reports/lib/errors';

// ---------------------------------------------------------------------------------------------------------
// Save (create or rename) dialog
// ---------------------------------------------------------------------------------------------------------

export interface SaveViewDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Screen id, for example `COM-08`. */
  readonly scope: string;
  /** The filters to save (the current filters for a new view). */
  readonly filters: JsonObject;
  /** Edits this view instead of creating one. */
  readonly view?: SavedView;
}

export function SaveViewDialog({ open, onClose, scope, filters, view }: SaveViewDialogProps) {
  return open ? (
    <SaveViewForm onClose={onClose} scope={scope} filters={filters} view={view} />
  ) : null;
}

function SaveViewForm({ onClose, scope, filters, view }: Omit<SaveViewDialogProps, 'open'>) {
  const tenant = useActiveTenant();
  const toast = useToast();
  const create = useApiMutation(reportingEndpoints.createSavedView);
  const update = useApiMutation(reportingEndpoints.updateSavedView);
  const [name, setName] = useState(view?.name ?? '');
  const [isDefault, setIsDefault] = useState(view?.isDefault ?? false);
  const [replaceFilters, setReplaceFilters] = useState(false);
  const [touched, setTouched] = useState(false);
  const pending = create.pending || update.pending;
  const error = create.error ?? update.error;
  const errors = formErrors(error, ['name', 'isDefault', 'filters', 'scope']);
  const trimmed = name.trim();
  const localError =
    touched && trimmed.length < 2
      ? t('search.views.nameTooShort')
      : touched && trimmed.length > 80
        ? t('search.views.nameTooLong')
        : undefined;
  const organizationName = view?.organization.tenantName ?? tenant?.name ?? '';

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (trimmed.length < 2 || trimmed.length > 80) return;
    try {
      if (view === undefined) {
        if (tenant === null) return;
        await create.mutate(
          { body: { scope, name: trimmed, filters, isDefault } },
          { tenantId: tenant.tenantId },
        );
        toast.show(t('search.views.saved', { name: trimmed }), 'success');
      } else {
        await update.mutate(
          {
            params: { viewId: view.id },
            body: {
              scope: view.scope,
              name: trimmed,
              filters: replaceFilters ? filters : view.filters,
              isDefault,
            },
          },
          { tenantId: view.organization.tenantId },
        );
        toast.show(t('search.views.updated', { name: trimmed }), 'success');
      }
      invalidateApiQueries('me.savedViews.');
      onClose();
    } catch {
      // The error is shown in the dialog.
    }
  };

  const conflict = error !== null && error.fieldErrors.length === 0 ? error : null;

  return (
    <Dialog
      open
      title={view === undefined ? t('search.views.saveTitle') : t('search.views.editTitle')}
      description={t('search.views.organization', { organization: organizationName })}
      onClose={onClose}
      dismissible={!pending}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            {t('search.views.cancel')}
          </Button>
          <Button variant="primary" loading={pending} onClick={() => void submit()}>
            {view === undefined ? t('search.views.save') : t('search.views.saveChanges')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-stack">
        <TextField
          label={t('search.views.name')}
          required
          value={name}
          maxLength={80}
          onChange={setName}
          onBlur={() => setTouched(true)}
          error={
            localError ??
            errors.forField('name') ??
            (conflict?.code === 'DUPLICATE_VIEW_NAME' ? businessErrorMessage(conflict) : undefined)
          }
        />
        <Checkbox
          label={t('search.views.default')}
          hint={t('search.views.defaultHint')}
          checked={isDefault}
          onChange={setIsDefault}
        />
        {view !== undefined && (
          <Checkbox
            label={t('search.views.replaceFilters')}
            hint={t('search.views.replaceFiltersHint')}
            checked={replaceFilters}
            onChange={setReplaceFilters}
          />
        )}
        {conflict !== null && conflict.code !== 'DUPLICATE_VIEW_NAME' && (
          <Banner tone="error" title={conflict.title}>
            <p>{businessErrorMessage(conflict)}</p>
          </Banner>
        )}
        {errors.other.length > 0 && (
          <FormErrorSummary title={t('search.views.invalid')} errors={errors.other} />
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------------------------------------

export function DeleteViewDialog({
  view,
  onClose,
}: {
  readonly view: SavedView | null;
  readonly onClose: () => void;
}) {
  const toast = useToast();
  const remove = useApiMutation(reportingEndpoints.deleteSavedView);
  if (view === null) return null;
  return (
    <ConfirmActionDialog
      open
      title={t('search.views.deleteTitle')}
      scope={t('search.views.deleteScope', { name: view.name, scope: view.scope })}
      consequence={t('search.views.deleteConsequence')}
      confirmLabel={t('search.views.delete')}
      tone="danger"
      organization={{ name: view.organization.tenantName, capacity: null }}
      pending={remove.pending}
      error={remove.error}
      onCancel={() => {
        remove.reset();
        onClose();
      }}
      onConfirm={async () => {
        try {
          await remove.mutate(
            { params: { viewId: view.id } },
            { tenantId: view.organization.tenantId },
          );
          toast.show(t('search.views.deleted', { name: view.name }), 'success');
          invalidateApiQueries('me.savedViews.');
          onClose();
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------
// Compact menu for dashboards and reports
// ---------------------------------------------------------------------------------------------------------

export interface SavedViewsMenuProps {
  readonly scope: string;
  readonly current: JsonObject;
  readonly onApply: (view: SavedView) => void;
}

/** "Saved views" menu: apply one of the caller's views of this screen, or save the current filters. */
export function SavedViewsMenu({ scope, current, onApply }: SavedViewsMenuProps) {
  const tenant = useActiveTenant();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SavedView | null>(null);
  const [deleting, setDeleting] = useState<SavedView | null>(null);
  const views = useApiQuery(
    reportingEndpoints.listSavedViews,
    tenant === null ? null : { query: { scope, tenantId: tenant.tenantId, pageSize: 100 } },
  );
  const items = views.data?.items ?? [];

  const entries: MenuEntry[] = [];
  if (views.status === 'error') {
    entries.push({ kind: 'text', id: 'error', label: t('search.views.loadError') });
  } else if (views.data === undefined) {
    entries.push({ kind: 'text', id: 'loading', label: t('search.views.loading') });
  } else if (items.length === 0) {
    entries.push({ kind: 'text', id: 'none', label: t('search.views.none') });
  }
  for (const view of items) {
    entries.push({
      id: `apply-${view.id}`,
      icon: view.isDefault ? 'star' : 'filter',
      label: view.isDefault ? t('search.views.applyDefault', { name: view.name }) : view.name,
      onSelect: () => onApply(view),
    });
  }
  entries.push({ kind: 'separator', id: 'sep' });
  entries.push({
    id: 'save',
    icon: 'plus',
    label: t('search.views.saveCurrent'),
    onSelect: () => setSaving(true),
  });
  for (const view of items) {
    entries.push({
      id: `edit-${view.id}`,
      icon: 'edit',
      label: t('search.views.editNamed', { name: view.name }),
      onSelect: () => setEditing(view),
    });
    entries.push({
      id: `delete-${view.id}`,
      icon: 'trash',
      danger: true,
      label: t('search.views.deleteNamed', { name: view.name }),
      onSelect: () => setDeleting(view),
    });
  }

  return (
    <>
      <Menu
        label={t('search.views.menu')}
        entries={entries}
        trigger={(props) => (
          <Button icon="bookOpen" iconAfter="chevronDown" {...props}>
            {t('search.views.menu')}
          </Button>
        )}
      />
      <SaveViewDialog
        open={saving}
        onClose={() => setSaving(false)}
        scope={scope}
        filters={current}
      />
      <SaveViewDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        scope={scope}
        filters={current}
        view={editing ?? undefined}
      />
      <DeleteViewDialog view={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
