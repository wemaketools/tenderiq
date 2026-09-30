/**
 * SUP-06 dialogs: create or edit a saved search, and subscribe to a buyer's or a category's notices. Both belong to
 * the signed-in user in the active supplier organization.
 */
import { useState } from 'react';

import { TENDERS_PROCEDURE_WRITE } from '@contracts/enums';
import { publicationEndpoints } from '@contracts/publication';
import type {
  NoticeSubscription,
  OpportunityFilters,
  SavedSearch,
  SavedSearchBody,
} from '@contracts/publication';

import type { ApiError } from '../../../api/client';
import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Checkbox,
  Dialog,
  FormErrorSummary,
  MultiSelect,
  Select,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { fieldMessage, publicationErrorMessage } from '../../publication/lib/errors';
import { buyerOptions, categoryOptions, regionOptions } from '../lib/options';

function FailureBanner({
  error,
  known,
}: {
  readonly error: ApiError | null;
  readonly known: readonly string[];
}) {
  if (error === null) return null;
  const apiError = error;
  const other = apiError.fieldErrors.filter(
    (item) => !known.some((name) => item.field.startsWith(name)),
  );
  if (apiError.fieldErrors.length > 0) {
    return other.length > 0 ? <FormErrorSummary errors={other} /> : null;
  }
  return (
    <Banner tone="error" title={t('opportunities.dialogs.failed')}>
      <p>{publicationErrorMessage(apiError)}</p>
    </Banner>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Saved search
// ---------------------------------------------------------------------------------------------------------

export interface SavedSearchDialogProps {
  readonly open: boolean;
  /** The search to edit, or null to create one. */
  readonly search: SavedSearch | null;
  /** Initial values for a new search (the current discovery filters). */
  readonly initial?: Partial<SavedSearchBody>;
  readonly filters: OpportunityFilters | undefined;
  readonly onClose: () => void;
  readonly onSaved: (search: SavedSearch) => void;
}

export function SavedSearchDialog({
  open,
  search,
  initial,
  filters,
  onClose,
  onSaved,
}: SavedSearchDialogProps) {
  const create = useApiMutation(publicationEndpoints.createSavedSearch);
  const update = useApiMutation(publicationEndpoints.updateSavedSearch);
  const [name, setName] = useState(search?.name ?? initial?.name ?? '');
  const [keywords, setKeywords] = useState(search?.keywords ?? initial?.keywords ?? '');
  const [catalogCodes, setCatalogCodes] = useState<string[]>([
    ...(search?.catalogCodes ?? initial?.catalogCodes ?? []),
  ]);
  const [buyers, setBuyers] = useState<string[]>(
    (search?.buyerTenantIds ?? initial?.buyerTenantIds ?? []).map(String),
  );
  const [regions, setRegions] = useState<string[]>([
    ...(search?.regions ?? initial?.regions ?? []),
  ]);
  const [procedures, setProcedures] = useState<string[]>([
    ...(search?.procedures ?? initial?.procedures ?? []).filter((value) =>
      (TENDERS_PROCEDURE_WRITE as readonly string[]).includes(value),
    ),
  ]);
  const [notify, setNotify] = useState(search?.notify ?? initial?.notify ?? true);
  const [touched, setTouched] = useState(false);

  const mutation = search === null ? create : update;
  const nameMissing = name.trim().length < 2;
  const empty =
    keywords.trim() === '' &&
    catalogCodes.length === 0 &&
    buyers.length === 0 &&
    regions.length === 0 &&
    procedures.length === 0;

  const close = (): void => {
    create.reset();
    update.reset();
    onClose();
  };

  const save = async (): Promise<void> => {
    setTouched(true);
    if (nameMissing || empty) return;
    const body: SavedSearchBody = {
      name: name.trim(),
      keywords: keywords.trim() === '' ? null : keywords.trim(),
      catalogCodes,
      buyerTenantIds: buyers.map(Number),
      regions,
      procedures: procedures.filter((value): value is SavedSearchBody['procedures'][number] =>
        (TENDERS_PROCEDURE_WRITE as readonly string[]).includes(value),
      ),
      notify,
    };
    try {
      const saved =
        search === null
          ? await create.mutate({ body })
          : await update.mutate({ params: { savedSearchId: search.id }, body });
      onSaved(saved);
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <Dialog
      open={open}
      size="lg"
      title={
        search === null
          ? t('opportunities.searches.newTitle')
          : t('opportunities.searches.editTitle')
      }
      description={t('opportunities.searches.dialogIntro')}
      onClose={close}
      dismissible={!mutation.pending}
      footer={
        <>
          <Button onClick={close} disabled={mutation.pending}>
            {t('opportunities.actions.cancel')}
          </Button>
          <Button variant="primary" loading={mutation.pending} onClick={() => void save()}>
            {t('opportunities.searches.save')}
          </Button>
        </>
      }
    >
      <div className="tiq-stack">
        <FailureBanner
          error={mutation.error}
          known={['name', 'keywords', 'catalogCodes', 'buyerTenantIds', 'regions', 'procedures']}
        />
        <div className="tiq-form-grid">
          <TextField
            label={t('opportunities.searches.name')}
            required
            value={name}
            onChange={setName}
            error={
              fieldMessage(mutation.error, 'name') ??
              (touched && nameMissing ? t('opportunities.searches.nameRequired') : undefined)
            }
          />
          <TextField
            label={t('opportunities.searches.keywords')}
            value={keywords}
            onChange={setKeywords}
            error={
              fieldMessage(mutation.error, 'keywords') ??
              (touched && empty ? t('opportunities.searches.emptyError') : undefined)
            }
          />
          <MultiSelect
            label={t('opportunities.searches.categories')}
            value={catalogCodes}
            onChange={setCatalogCodes}
            options={categoryOptions(filters)}
            error={fieldMessage(mutation.error, 'catalogCodes')}
          />
          <MultiSelect
            label={t('opportunities.searches.buyers')}
            value={buyers}
            onChange={setBuyers}
            options={buyerOptions(filters)}
            error={fieldMessage(mutation.error, 'buyerTenantIds')}
          />
          <MultiSelect
            label={t('opportunities.searches.regions')}
            value={regions}
            onChange={setRegions}
            options={regionOptions(filters)}
            error={fieldMessage(mutation.error, 'regions')}
          />
          <MultiSelect
            label={t('opportunities.searches.procedures')}
            value={procedures}
            onChange={setProcedures}
            options={TENDERS_PROCEDURE_WRITE.map((value) => ({
              value,
              label: tEnum('tenders.procedure', value),
            }))}
            error={fieldMessage(mutation.error, 'procedures')}
          />
        </div>
        <Checkbox
          label={t('opportunities.searches.notify')}
          hint={t('opportunities.searches.notifyHint')}
          checked={notify}
          onChange={setNotify}
        />
        <p className="tiq-text-muted">{t('opportunities.discover.matchNote')}</p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------------------------------------

export interface SubscriptionDialogProps {
  readonly open: boolean;
  readonly filters: OpportunityFilters | undefined;
  readonly onClose: () => void;
  readonly onSaved: (subscription: NoticeSubscription) => void;
}

export function SubscriptionDialog({ open, filters, onClose, onSaved }: SubscriptionDialogProps) {
  const create = useApiMutation(publicationEndpoints.createSubscription);
  const [buyer, setBuyer] = useState('');
  const [category, setCategory] = useState('');
  const [touched, setTouched] = useState(false);
  const empty = buyer === '' && category === '';

  const close = (): void => {
    create.reset();
    setBuyer('');
    setCategory('');
    setTouched(false);
    onClose();
  };

  const save = async (): Promise<void> => {
    setTouched(true);
    if (empty) return;
    try {
      const subscription = await create.mutate({
        body: {
          buyerTenantId: buyer === '' ? null : Number(buyer),
          catalogCode: category === '' ? null : category,
        },
      });
      close();
      onSaved(subscription);
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <Dialog
      open={open}
      title={t('opportunities.subscriptions.newTitle')}
      description={t('opportunities.subscriptions.dialogIntro')}
      onClose={close}
      dismissible={!create.pending}
      footer={
        <>
          <Button onClick={close} disabled={create.pending}>
            {t('opportunities.actions.cancel')}
          </Button>
          <Button variant="primary" loading={create.pending} onClick={() => void save()}>
            {t('opportunities.subscriptions.subscribe')}
          </Button>
        </>
      }
    >
      <div className="tiq-stack">
        <FailureBanner error={create.error} known={['buyerTenantId', 'catalogCode']} />
        <Select
          label={t('opportunities.subscriptions.buyer')}
          placeholder={t('opportunities.subscriptions.anyBuyer')}
          value={buyer}
          onChange={setBuyer}
          options={buyerOptions(filters)}
          error={
            fieldMessage(create.error, 'buyerTenantId') ??
            (touched && empty ? t('opportunities.subscriptions.scopeRequired') : undefined)
          }
        />
        <Select
          label={t('opportunities.subscriptions.category')}
          placeholder={t('opportunities.subscriptions.anyCategory')}
          value={category}
          onChange={setCategory}
          options={categoryOptions(filters)}
          error={fieldMessage(create.error, 'catalogCode')}
        />
      </div>
    </Dialog>
  );
}
