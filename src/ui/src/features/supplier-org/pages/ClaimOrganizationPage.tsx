/**
 * SUP-02 — Claim an invited organization (public `/register/claim/:token`, FR-02, DD-17, AC-07).
 *
 * A buyer recorded a provisional supplier and invited a contact. The page shows the organization as the buyer recorded
 * it, the inviting buyer and a masked invited address (never the buyer's notes or assessments). The contact completes
 * the legal identity, locations and categories, confirms (COM-02: organization, capacity, scope, result), and gets the
 * same separate statuses as a registration: claiming is not qualification. Expired, claimed and revoked invitations
 * explain why they cannot be used and point to registration or sign-in.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import type { FieldError } from '@contracts/common';
import { ClaimOrganizationBody, ClaimToken, suppliersEndpoints } from '@contracts/suppliers';
import type {
  ClaimInvitationView,
  ReferenceOptions,
  RegistrationResult,
} from '@contracts/suppliers';

import { isApiError } from '../../../api/client';
import { useApiQuery } from '../../../api/hooks';
import { claimOrganization } from '../../../api/suppliers';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  ErrorState,
  FormErrorSummary,
  MultiSelect,
  PageHeader,
  SkeletonBlock,
  StatusChip,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { browserTimeZone, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CategoryPicker, LocationsEditor } from '../components/OrganizationFields';
import { RegistrationOutcome } from '../components/RegistrationOutcome';
import { supplierErrorMessage, withSupplierMessage } from '../lib/errors';
import { emptyLocation, languageOptions, toLocationInputs } from '../lib/organizationForm';
import type { LocationDraft } from '../lib/organizationForm';
import { supplierOrgPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

const FIELDS = [
  'fullName',
  'email',
  'phone',
  'jobTitle',
  'registrationJurisdiction',
  'registrationNumber',
  'locations',
  'categories',
  'preferredLanguages',
  'acceptTerms',
] as const;

interface Draft {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  registrationJurisdiction: string;
  registrationNumber: string;
  locations: LocationDraft[];
  categories: string[];
  languages: string[];
  acceptTerms: boolean;
}

function draftOf(view: ClaimInvitationView): Draft {
  return {
    fullName: view.contactName,
    email: '',
    phone: '',
    jobTitle: '',
    registrationJurisdiction: '',
    registrationNumber: view.organization.registrationNumber ?? '',
    locations: [emptyLocation(true)],
    categories: view.organization.categories.map((category) => category.catalogCode),
    languages: ['en'],
    acceptTerms: false,
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function bodyOf(draft: Draft, reference: ReferenceOptions | undefined) {
  const phone = optional(draft.phone);
  const jobTitle = optional(draft.jobTitle);
  return {
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    ...(phone === undefined ? {} : { phone }),
    ...(jobTitle === undefined ? {} : { jobTitle }),
    registrationJurisdiction: draft.registrationJurisdiction.trim(),
    registrationNumber: draft.registrationNumber.trim(),
    locations: toLocationInputs(draft.locations, reference),
    categories: draft.categories,
    preferredLanguages: draft.languages,
    acceptTerms: draft.acceptTerms as true,
  };
}

export default function ClaimOrganizationPage() {
  const raw = useParams().token ?? '';
  const valid = ClaimToken.safeParse(raw).success;
  const query = useApiQuery(
    suppliersEndpoints.getClaimInvitation,
    valid ? { params: { token: raw } } : null,
  );

  const header = (
    <PageHeader title={t('supplier-org.claim.title')} subtitle={t('supplier-org.claim.intro')} />
  );
  const alternatives = (
    <div className="tiq-inline">
      <Link to={supplierOrgPaths.register}>{t('supplier-org.claim.registerInstead')}</Link>
      <Link to={supplierOrgPaths.signIn}>{t('supplier-org.claim.signIn')}</Link>
    </div>
  );

  if (!valid) {
    return (
      <div className="tiq-page">
        {header}
        <Banner tone="error" title={t('supplier-org.claim.invalidTitle')}>
          <p>{t('supplier-org.claim.invalidText')}</p>
          {alternatives}
        </Banner>
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        {header}
        {query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : isApiError(query.error) && query.error.status === 404 ? (
          <Banner tone="error" title={t('supplier-org.claim.notFoundTitle')}>
            <p>{t('supplier-org.claim.invalidText')}</p>
            {alternatives}
          </Banner>
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  const view = query.data;
  if (view.state !== 'pending') {
    return (
      <div className="tiq-page">
        {header}
        <Banner tone="warning" title={t('supplier-org.claim.unavailableTitle')}>
          <p>{view.stateNote ?? tEnum('invitations.status', view.state)}</p>
          {alternatives}
        </Banner>
        <InvitationCard view={view} />
      </div>
    );
  }
  return <ClaimForm token={raw} view={view} header={header} />;
}

function InvitationCard({ view }: { readonly view: ClaimInvitationView }) {
  const zone = browserTimeZone();
  return (
    <Card
      title={t('supplier-org.claim.invitationTitle')}
      subtitle={t('supplier-org.claim.buyerRecordNote')}
    >
      <DetailList
        items={[
          {
            key: 'organization',
            label: t('supplier-org.claim.organization'),
            value: view.organization.legalName,
          },
          {
            key: 'invitedBy',
            label: t('supplier-org.claim.invitedBy'),
            value: view.invitedBy.tenantName,
          },
          { key: 'contact', label: t('supplier-org.claim.contact'), value: view.contactName },
          { key: 'sentTo', label: t('supplier-org.claim.sentTo'), value: view.emailHint },
          {
            key: 'expires',
            label: t('supplier-org.claim.expires'),
            value: formatDateTime(view.expiresAt, zone),
          },
          {
            key: 'registrationNumber',
            label: t('supplier-org.claim.registrationNumber'),
            value: view.organization.registrationNumber ?? t('supplier-org.claim.notRecorded'),
          },
          {
            key: 'categories',
            label: t('supplier-org.claim.categories'),
            value:
              view.organization.categories.length === 0
                ? t('supplier-org.claim.notRecorded')
                : view.organization.categories.map((category) => category.name).join(', '),
          },
        ]}
      />
    </Card>
  );
}

function ClaimForm({
  token,
  view,
  header,
}: {
  readonly token: string;
  readonly view: ClaimInvitationView;
  readonly header: ReactNode;
}) {
  const categories = useApiQuery(suppliersEndpoints.categoryOptions, {});
  const reference = useApiQuery(suppliersEndpoints.referenceOptions, {});
  const [draft, setDraft] = useState<Draft>(() => draftOf(view));
  const [dirty, setDirty] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [serverError, setServerError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const errors = errorLookup(clientErrors, serverError, FIELDS);

  const change = (patch: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const review = (): void => {
    setServerError(null);
    const found = validateWith(ClaimOrganizationBody, bodyOf(draft, reference.data));
    setClientErrors(found);
    if (found.length === 0) setConfirming(true);
  };

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const outcome = await claimOrganization(token, bodyOf(draft, reference.data));
      setResult(outcome);
      setDirty(false);
      setConfirming(false);
    } catch (caught) {
      setServerError(caught);
      if (isApiError(caught) && caught.code !== null) setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (result !== null) {
    return (
      <div className="tiq-page">
        {header}
        <RegistrationOutcome result={result} email={draft.email.trim()} />
      </div>
    );
  }

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      {header}
      <div className="tiq-grid tiq-grid--sidebar">
        <Card
          title={t('supplier-org.claim.formTitle')}
          subtitle={t('supplier-org.claim.formIntro')}
          footer={
            <Button variant="primary" icon="check" onClick={review}>
              {t('supplier-org.claim.submit')}
            </Button>
          }
        >
          <div className="tiq-stack">
            {serverError !== null ? (
              <FormErrorSummary title={supplierErrorMessage(serverError)} errors={errors.other} />
            ) : errors.other.length > 0 ? (
              <FormErrorSummary errors={errors.other} />
            ) : null}
            <h3 className="tiq-form-section-title">{t('supplier-org.claim.contactSection')}</h3>
            <div className="tiq-form-grid">
              <TextField
                label={t('supplier-org.fields.contactName')}
                required
                autoComplete="name"
                value={draft.fullName}
                onChange={(fullName) => change({ fullName })}
                error={errors.forField('fullName')}
              />
              <TextField
                label={t('supplier-org.fields.contactEmail')}
                hint={t('supplier-org.claim.emailHint', { hint: view.emailHint })}
                required
                type="email"
                autoComplete="email"
                value={draft.email}
                onChange={(email) => change({ email })}
                error={errors.forField('email')}
              />
              <TextField
                label={t('supplier-org.fields.jobTitle')}
                autoComplete="organization-title"
                value={draft.jobTitle}
                onChange={(jobTitle) => change({ jobTitle })}
                error={errors.forField('jobTitle')}
              />
              <TextField
                label={t('supplier-org.fields.phone')}
                hint={t('supplier-org.fields.phoneHint')}
                type="tel"
                autoComplete="tel"
                value={draft.phone}
                onChange={(phone) => change({ phone })}
                error={errors.forField('phone')}
              />
            </div>
            <h3 className="tiq-form-section-title">{t('supplier-org.claim.identitySection')}</h3>
            <div className="tiq-form-grid">
              <TextField
                label={t('supplier-org.fields.jurisdiction')}
                hint={t('supplier-org.fields.jurisdictionHint')}
                required
                value={draft.registrationJurisdiction}
                onChange={(registrationJurisdiction) => change({ registrationJurisdiction })}
                error={errors.forField('registrationJurisdiction')}
              />
              <TextField
                label={t('supplier-org.fields.registrationNumber')}
                required
                value={draft.registrationNumber}
                onChange={(registrationNumber) => change({ registrationNumber })}
                error={errors.forField('registrationNumber')}
              />
              <CategoryPicker
                options={categories.data?.items}
                loadFailed={categories.status === 'error'}
                value={draft.categories}
                onChange={(value) => change({ categories: value })}
                error={errors.forField('categories')}
              />
              <MultiSelect
                label={t('supplier-org.fields.languages')}
                required
                value={draft.languages}
                options={languageOptions()}
                onChange={(languages) => change({ languages })}
                error={errors.forField('preferredLanguages')}
              />
            </div>
            <h3 className="tiq-form-section-title">{t('supplier-org.claim.locationsSection')}</h3>
            <LocationsEditor
              locations={draft.locations}
              onChange={(locations) => change({ locations })}
              errorFor={errors.forField}
              reference={reference.data}
            />
            <Checkbox
              label={t('supplier-org.register.acceptTerms')}
              checked={draft.acceptTerms}
              onChange={(acceptTerms) => change({ acceptTerms })}
              error={errors.forField('acceptTerms')}
            />
          </div>
        </Card>
        <aside className="tiq-stack" aria-label={t('supplier-org.claim.invitationTitle')}>
          <InvitationCard view={view} />
          <Banner tone="info" title={t('supplier-org.claim.notQualifiedTitle')}>
            <p>
              {t('supplier-org.claim.notQualified', {
                status: tEnum('v_qualification_status.effective_status', view.qualificationStatus),
              })}
            </p>
            <StatusChip
              enum="v_qualification_status.effective_status"
              value={view.qualificationStatus}
            />
          </Banner>
          <Card title={t('supplier-org.banking.title')}>
            <p>{view.bankingNotice}</p>
          </Card>
        </aside>
      </div>
      <ConfirmActionDialog
        open={confirming}
        title={t('supplier-org.claim.confirmTitle')}
        organization={{
          name: view.organization.legalName,
          capacity: t('supplier-org.claim.confirmCapacity'),
        }}
        scope={t('supplier-org.claim.confirmScope', {
          name: view.organization.legalName,
          buyer: view.invitedBy.tenantName,
          email: draft.email.trim(),
        })}
        consequence={t('supplier-org.claim.confirmResult')}
        confirmLabel={t('supplier-org.claim.submit')}
        onConfirm={() => submit()}
        onCancel={() => setConfirming(false)}
        pending={submitting}
        error={isApiError(serverError) ? withSupplierMessage(serverError) : null}
      />
    </div>
  );
}
