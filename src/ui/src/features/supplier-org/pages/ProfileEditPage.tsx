/**
 * SUP-03 — maintain current profile information: trading names, contacts, locations, categories, service areas,
 * languages and the capacity overview. Saving applies immediately (it is not a review). The legal name, registration
 * and ownership are read-only here: they change only through a reviewed identity change, and submissions already
 * made keep their original representation. There are no banking fields (FR-02).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { FieldError } from '@contracts/common';
import { UpdateProfileBody, suppliersEndpoints } from '@contracts/suppliers';
import type { ReferenceOptions, SupplierProfile } from '@contracts/suppliers';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  DetailList,
  FormErrorSummary,
  MultiSelect,
  PageHeader,
  QueryView,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { CategoryPicker, LocationsEditor } from '../components/OrganizationFields';
import { supplierErrorMessage } from '../lib/errors';
import { useDeferredNavigate } from '../lib/hooks';
import { joinList, splitList, textOrNull } from '../lib/lists';
import { emptyLocation, languageOptions, toLocationInputs } from '../lib/organizationForm';
import type { LocationDraft } from '../lib/organizationForm';
import { supplierOrgPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

const FIELDS = [
  'tradingNames',
  'website',
  'description',
  'yearEstablished',
  'employeeCountBand',
  'annualTurnoverBand',
  'capacityOverview',
  'serviceAreas',
  'preferredLanguages',
  'primaryContactUserId',
  'locations',
  'categories',
] as const;

export default function ProfileEditPage() {
  const query = useApiQuery(suppliersEndpoints.getProfile, {});
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-org.edit.title')}
        subtitle={t('supplier-org.edit.intro')}
        back={{ to: supplierOrgPaths.profile, label: t('supplier-org.edit.back') }}
      />
      <QueryView query={query}>
        {(profile) => <ProfileForm key={profile.updatedAt} profile={profile} />}
      </QueryView>
    </div>
  );
}

interface Draft {
  tradingNames: string;
  website: string;
  description: string;
  yearEstablished: string;
  employeeCountBand: string;
  annualTurnoverBand: string;
  capacityOverview: string;
  serviceAreas: string;
  languages: string[];
  primaryContact: string;
  locations: LocationDraft[];
  categories: string[];
}

function draftOf(profile: SupplierProfile): Draft {
  return {
    tradingNames: joinList(profile.tradingNames),
    website: profile.website ?? '',
    description: profile.description ?? '',
    yearEstablished: profile.yearEstablished === null ? '' : String(profile.yearEstablished),
    employeeCountBand: profile.employeeCountBand ?? '',
    annualTurnoverBand: profile.annualTurnoverBand ?? '',
    capacityOverview: profile.capacityOverview ?? '',
    serviceAreas: joinList(profile.serviceAreas),
    languages: [...profile.preferredLanguages],
    primaryContact: profile.primaryContact === null ? '' : String(profile.primaryContact.userId),
    locations: profile.locations.map((location) => ({
      ...emptyLocation(location.isRegisteredOffice),
      name: location.name,
      address: location.address,
      region: location.region ?? '',
      country: location.country,
    })),
    categories: profile.categories.map((category) => category.catalogCode),
  };
}

function bodyOf(draft: Draft, reference: ReferenceOptions | undefined) {
  const year = draft.yearEstablished.trim();
  return {
    tradingNames: splitList(draft.tradingNames),
    website: textOrNull(draft.website),
    description: textOrNull(draft.description),
    yearEstablished: year === '' ? null : Number(year),
    employeeCountBand: textOrNull(draft.employeeCountBand),
    annualTurnoverBand: textOrNull(draft.annualTurnoverBand),
    capacityOverview: textOrNull(draft.capacityOverview),
    serviceAreas: splitList(draft.serviceAreas),
    preferredLanguages: draft.languages,
    primaryContactUserId: draft.primaryContact === '' ? null : Number(draft.primaryContact),
    locations: toLocationInputs(draft.locations, reference),
    categories: draft.categories,
  };
}

function ProfileForm({ profile }: { readonly profile: SupplierProfile }) {
  const navigate = useNavigate();
  const toast = useToast();
  const leave = useDeferredNavigate();
  const categories = useApiQuery(suppliersEndpoints.categoryOptions, {});
  const reference = useApiQuery(suppliersEndpoints.referenceOptions, {});
  const save = useApiMutation(suppliersEndpoints.updateProfile);
  const [draft, setDraft] = useState<Draft>(() => draftOf(profile));
  const [dirty, setDirty] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, save.error, FIELDS);

  const change = (patch: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const submit = async (): Promise<void> => {
    const body = bodyOf(draft, reference.data);
    const found = validateWith(UpdateProfileBody, body);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      await save.mutate({ body });
      setDirty(false);
      invalidateApiQueries('supplier.suppliers.profile.');
      toast.show(t('supplier-org.edit.saved'), 'success');
      leave(supplierOrgPaths.profile);
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <div className="tiq-stack">
      <UnsavedChangesGuard when={dirty && !save.pending} />
      {save.error !== null && (
        <FormErrorSummary title={supplierErrorMessage(save.error)} errors={errors.other} />
      )}
      {save.error === null && errors.other.length > 0 && <FormErrorSummary errors={errors.other} />}
      <Card
        title={t('supplier-org.edit.identityTitle')}
        subtitle={t('supplier-org.edit.identityHint')}
        actions={
          <Link to={supplierOrgPaths.newIdentityChange}>
            {t('supplier-org.profile.requestChange')}
          </Link>
        }
      >
        <DetailList
          items={[
            { key: 'legal', label: t('supplier-org.fields.legalName'), value: profile.legalName },
            {
              key: 'registration',
              label: t('supplier-org.fields.registrationNumber'),
              value: profile.registrationNumber,
            },
            {
              key: 'jurisdiction',
              label: t('supplier-org.fields.jurisdiction'),
              value: profile.registrationJurisdiction,
            },
            {
              key: 'ownership',
              label: t('supplier-org.fields.ownership'),
              value: profile.ownershipDisclosure,
            },
          ]}
        />
      </Card>
      <Card title={t('supplier-org.edit.businessTitle')}>
        <div className="tiq-form-grid">
          <TextField
            label={t('supplier-org.fields.tradingNames')}
            hint={t('supplier-org.fields.listHint')}
            value={draft.tradingNames}
            onChange={(tradingNames) => change({ tradingNames })}
            error={errors.forField('tradingNames')}
          />
          <TextField
            label={t('supplier-org.fields.website')}
            hint={t('supplier-org.fields.websiteHint')}
            type="url"
            value={draft.website}
            onChange={(website) => change({ website })}
            error={errors.forField('website')}
          />
          <TextField
            label={t('supplier-org.fields.yearEstablished')}
            inputMode="numeric"
            value={draft.yearEstablished}
            onChange={(yearEstablished) => change({ yearEstablished })}
            error={errors.forField('yearEstablished')}
          />
          <Select
            label={t('supplier-org.fields.primaryContact')}
            placeholder={t('supplier-org.edit.noPrimaryContact')}
            value={draft.primaryContact}
            options={profile.memberOptions.map((person) => ({
              value: String(person.userId),
              label: person.fullName,
            }))}
            onChange={(primaryContact) => change({ primaryContact })}
            error={errors.forField('primaryContactUserId')}
          />
          <TextField
            label={t('supplier-org.fields.employees')}
            value={draft.employeeCountBand}
            onChange={(employeeCountBand) => change({ employeeCountBand })}
            error={errors.forField('employeeCountBand')}
          />
          <TextField
            label={t('supplier-org.fields.turnover')}
            value={draft.annualTurnoverBand}
            onChange={(annualTurnoverBand) => change({ annualTurnoverBand })}
            error={errors.forField('annualTurnoverBand')}
          />
          <TextArea
            label={t('supplier-org.fields.description')}
            fieldClassName="tiq-form-full"
            rows={3}
            value={draft.description}
            onChange={(description) => change({ description })}
            error={errors.forField('description')}
          />
          <TextArea
            label={t('supplier-org.fields.capacityOverview')}
            hint={t('supplier-org.fields.capacityHint')}
            fieldClassName="tiq-form-full"
            rows={3}
            value={draft.capacityOverview}
            onChange={(capacityOverview) => change({ capacityOverview })}
            error={errors.forField('capacityOverview')}
          />
          <TextField
            label={t('supplier-org.fields.serviceAreas')}
            hint={t('supplier-org.fields.listHint')}
            value={draft.serviceAreas}
            onChange={(serviceAreas) => change({ serviceAreas })}
            error={errors.forField('serviceAreas')}
          />
          <MultiSelect
            label={t('supplier-org.fields.languages')}
            required
            value={draft.languages}
            options={languageOptions()}
            onChange={(languages) => change({ languages })}
            error={errors.forField('preferredLanguages')}
          />
          <CategoryPicker
            options={categories.data?.items}
            loadFailed={categories.status === 'error'}
            value={draft.categories}
            onChange={(value) => change({ categories: value })}
            error={errors.forField('categories')}
          />
        </div>
      </Card>
      <Card title={t('supplier-org.profile.locationsCard')}>
        <LocationsEditor
          locations={draft.locations}
          onChange={(locations) => change({ locations })}
          errorFor={errors.forField}
          reference={reference.data}
        />
      </Card>
      <Banner tone="info" title={t('supplier-org.banking.title')}>
        <p>{profile.bankingNotice}</p>
      </Banner>
      <Banner tone="info" title={t('supplier-org.edit.savedVsReviewedTitle')}>
        <p>{t('supplier-org.edit.savedVsReviewed')}</p>
      </Banner>
      <div className="tiq-inline">
        <Button onClick={() => void navigate(supplierOrgPaths.profile)} disabled={save.pending}>
          {t('supplier-org.edit.cancel')}
        </Button>
        <Button variant="primary" icon="check" loading={save.pending} onClick={() => void submit()}>
          {t('supplier-org.edit.save')}
        </Button>
      </div>
    </div>
  );
}
