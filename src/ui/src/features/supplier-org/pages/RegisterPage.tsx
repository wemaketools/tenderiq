/**
 * SUP-02 — Organization registration and membership (public `/register`, FR-02, BR-03, BR-44, AC-07).
 *
 * 1. Identity: legal name, jurisdiction, registration number, country and contact e-mail, then a duplicate check.
 *    A possible duplicate shows only "an organization with similar details exists — request membership or continue"
 *    and discloses nothing else.
 * 2. Details: trading names, contact, locations, categories, service areas, languages (no banking details).
 * 3. Review and submit (terms), confirmed with the acting party and the result.
 * 4. Outcome: registration, contact verification, membership, identity verification and qualification stay separate;
 *    the verification e-mail can be re-sent.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import type { FieldError } from '@contracts/common';
import {
  BANKING_NOT_COLLECTED_NOTICE,
  DuplicateCheckBody,
  RegistrationBody,
  suppliersEndpoints,
} from '@contracts/suppliers';
import type {
  DuplicateCheckResult,
  ReferenceOptions,
  RegistrationResult,
} from '@contracts/suppliers';

import { isApiError } from '../../../api/client';
import { useApiQuery } from '../../../api/hooks';
import { checkDuplicate, registerSupplier } from '../../../api/suppliers';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  FormErrorSummary,
  MultiSelect,
  PageHeader,
  Select,
  Stepper,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import type { StepItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { MembershipRequestForm } from '../components/MembershipRequestForm';
import { CategoryPicker, LocationsEditor } from '../components/OrganizationFields';
import { RegistrationOutcome } from '../components/RegistrationOutcome';
import { supplierErrorMessage, withSupplierMessage } from '../lib/errors';
import { splitList } from '../lib/lists';
import {
  countryName,
  countryOptions,
  effectiveCountry,
  emptyLocation,
  languageName,
  languageOptions,
  toLocationInputs,
} from '../lib/organizationForm';
import type { LocationDraft } from '../lib/organizationForm';
import { supplierOrgPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

type Step = 'identity' | 'details' | 'review' | 'done';
const STEPS: readonly Step[] = ['identity', 'details', 'review', 'done'];

const IDENTITY_FIELDS = [
  'legalName',
  'registrationJurisdiction',
  'registrationNumber',
  'country',
  'contactEmail',
  'contact.email',
] as const;
const DETAIL_FIELDS = [
  'tradingNames',
  'taxIdentifier',
  'website',
  'contact.fullName',
  'contact.phone',
  'contact.jobTitle',
  'locations',
  'categories',
  'serviceAreas',
  'preferredLanguages',
] as const;
const ALL_FIELDS = [...IDENTITY_FIELDS, ...DETAIL_FIELDS, 'acceptTerms'] as const;

interface Draft {
  legalName: string;
  registrationJurisdiction: string;
  registrationNumber: string;
  country: string;
  email: string;
  tradingNames: string;
  taxIdentifier: string;
  website: string;
  fullName: string;
  phone: string;
  jobTitle: string;
  locations: LocationDraft[];
  categories: string[];
  serviceAreas: string;
  languages: string[];
  acceptTerms: boolean;
}

function initialDraft(): Draft {
  return {
    legalName: '',
    registrationJurisdiction: '',
    registrationNumber: '',
    country: '',
    email: '',
    tradingNames: '',
    taxIdentifier: '',
    website: '',
    fullName: '',
    phone: '',
    jobTitle: '',
    locations: [emptyLocation(true)],
    categories: [],
    serviceAreas: '',
    languages: ['en'],
    acceptTerms: false,
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function registrationBody(
  draft: Draft,
  continueToken: string | null,
  reference: ReferenceOptions | undefined,
) {
  const phone = optional(draft.phone);
  const jobTitle = optional(draft.jobTitle);
  const taxIdentifier = optional(draft.taxIdentifier);
  const website = optional(draft.website);
  return {
    legalName: draft.legalName.trim(),
    tradingNames: splitList(draft.tradingNames),
    country: effectiveCountry(draft.country, reference),
    registrationJurisdiction: draft.registrationJurisdiction.trim(),
    registrationNumber: draft.registrationNumber.trim(),
    ...(taxIdentifier === undefined ? {} : { taxIdentifier }),
    ...(website === undefined ? {} : { website }),
    contact: {
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
      ...(phone === undefined ? {} : { phone }),
      ...(jobTitle === undefined ? {} : { jobTitle }),
    },
    locations: toLocationInputs(draft.locations, reference),
    categories: draft.categories,
    serviceAreas: splitList(draft.serviceAreas),
    preferredLanguages: draft.languages,
    ...(continueToken === null ? {} : { continueDespiteMatchToken: continueToken }),
    acceptTerms: draft.acceptTerms as true,
  };
}

function stepState(step: Step, current: Step): StepItem['state'] {
  const index = STEPS.indexOf(step);
  const at = STEPS.indexOf(current);
  if (index < at) return 'complete';
  return index === at ? 'current' : 'upcoming';
}

export default function RegisterPage() {
  const categories = useApiQuery(suppliersEndpoints.categoryOptions, {});
  const reference = useApiQuery(suppliersEndpoints.referenceOptions, {});
  const [step, setStep] = useState<Step>('identity');
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [dirty, setDirty] = useState(false);
  const [check, setCheck] = useState<DuplicateCheckResult | null>(null);
  const [continueToken, setContinueToken] = useState<string | null>(null);
  const [requestingMembership, setRequestingMembership] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [serverError, setServerError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const errors = errorLookup(clientErrors, serverError, ALL_FIELDS);
  const errorFor = (path: string): string | undefined => errors.forField(path);

  const change = (patch: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const changeIdentity = (patch: Partial<Draft>): void => {
    change(patch);
    // Changed identity details need a new duplicate check.
    setCheck(null);
    setContinueToken(null);
    setRequestingMembership(false);
  };

  const runCheck = async (): Promise<void> => {
    setServerError(null);
    const body = {
      legalName: draft.legalName,
      country: effectiveCountry(draft.country, reference.data),
      contactEmail: draft.email,
      ...(draft.registrationJurisdiction.trim() === ''
        ? {}
        : { registrationJurisdiction: draft.registrationJurisdiction }),
      ...(draft.registrationNumber.trim() === ''
        ? {}
        : { registrationNumber: draft.registrationNumber }),
    };
    const found = validateWith(DuplicateCheckBody, body).concat(
      draft.registrationJurisdiction.trim() === ''
        ? [
            {
              field: 'registrationJurisdiction',
              code: 'JURISDICTION_REQUIRED',
              message: t('supplier-org.register.jurisdictionRequired'),
            },
          ]
        : [],
      draft.registrationNumber.trim() === ''
        ? [
            {
              field: 'registrationNumber',
              code: 'REGISTRATION_NUMBER_REQUIRED',
              message: t('supplier-org.register.numberRequired'),
            },
          ]
        : [],
    );
    setClientErrors(found);
    if (found.length > 0) return;
    setChecking(true);
    try {
      const outcome = await checkDuplicate({
        legalName: draft.legalName.trim(),
        country: effectiveCountry(draft.country, reference.data),
        contactEmail: draft.email.trim(),
        registrationJurisdiction: draft.registrationJurisdiction.trim(),
        registrationNumber: draft.registrationNumber.trim(),
      });
      setCheck(outcome);
      if (outcome.outcome === 'no_match') setStep('details');
    } catch (caught) {
      setServerError(caught);
    } finally {
      setChecking(false);
    }
  };

  const toReview = (): void => {
    setServerError(null);
    const found = validateWith(RegistrationBody, {
      ...registrationBody(draft, continueToken, reference.data),
      acceptTerms: true,
    });
    setClientErrors(found);
    if (found.length === 0) setStep('review');
  };

  const openConfirm = (): void => {
    const found = validateWith(
      RegistrationBody,
      registrationBody(draft, continueToken, reference.data),
    );
    setClientErrors(found);
    if (found.length === 0) setConfirming(true);
  };

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setServerError(null);
    try {
      const outcome = await registerSupplier(
        registrationBody(draft, continueToken, reference.data),
      );
      setResult(outcome);
      setDirty(false);
      setConfirming(false);
      setStep('done');
    } catch (caught) {
      setServerError(caught);
      if (isApiError(caught)) {
        setConfirming(false);
        if (caught.code === 'POSSIBLE_DUPLICATE_UNACKNOWLEDGED') {
          setCheck(null);
          setContinueToken(null);
          setStep('identity');
        } else if (caught.fieldErrors.some((item) => item.field.startsWith('contact.email'))) {
          setStep('identity');
        } else if (caught.code === 'EMAIL_ALREADY_REGISTERED') {
          setStep('identity');
        } else if (caught.kind === 'validation') {
          setStep('details');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const steps: StepItem[] = STEPS.map((id) => ({
    id,
    label: t(`supplier-org.register.step.${id}`),
    description: t(`supplier-org.register.stepHint.${id}`),
    state: step === 'done' && id === 'done' ? 'complete' : stepState(id, step),
  }));

  const summaryError =
    serverError !== null ? (
      <FormErrorSummary title={supplierErrorMessage(serverError)} errors={errors.other} />
    ) : errors.other.length > 0 ? (
      <FormErrorSummary errors={errors.other} />
    ) : null;

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty && step !== 'done'} />
      <PageHeader
        title={t('supplier-org.register.title')}
        subtitle={t('supplier-org.register.intro')}
      />
      <Stepper steps={steps} label={t('supplier-org.register.progress')} />
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          {step === 'identity' && (
            <Card
              title={t('supplier-org.register.identityTitle')}
              subtitle={t('supplier-org.register.identityIntro')}
              footer={
                check === null ? (
                  <Button variant="primary" loading={checking} onClick={() => void runCheck()}>
                    {t('supplier-org.register.check')}
                  </Button>
                ) : undefined
              }
            >
              <div className="tiq-stack">
                {summaryError}
                <div className="tiq-form-grid">
                  <TextField
                    label={t('supplier-org.fields.legalName')}
                    hint={t('supplier-org.fields.legalNameHint')}
                    required
                    fieldClassName="tiq-form-full"
                    autoComplete="organization"
                    value={draft.legalName}
                    onChange={(legalName) => changeIdentity({ legalName })}
                    error={errorFor('legalName')}
                  />
                  <Select
                    label={t('supplier-org.fields.country')}
                    required
                    value={effectiveCountry(draft.country, reference.data)}
                    options={countryOptions(reference.data)}
                    onChange={(country) => changeIdentity({ country })}
                    error={errorFor('country')}
                  />
                  <TextField
                    label={t('supplier-org.fields.jurisdiction')}
                    hint={t('supplier-org.fields.jurisdictionHint')}
                    required
                    value={draft.registrationJurisdiction}
                    onChange={(registrationJurisdiction) =>
                      changeIdentity({ registrationJurisdiction })
                    }
                    error={errorFor('registrationJurisdiction')}
                  />
                  <TextField
                    label={t('supplier-org.fields.registrationNumber')}
                    required
                    value={draft.registrationNumber}
                    onChange={(registrationNumber) => changeIdentity({ registrationNumber })}
                    error={errorFor('registrationNumber')}
                  />
                  <TextField
                    label={t('supplier-org.fields.contactEmail')}
                    hint={t('supplier-org.fields.contactEmailHint')}
                    type="email"
                    required
                    autoComplete="email"
                    value={draft.email}
                    onChange={(email) => changeIdentity({ email })}
                    error={errorFor('contactEmail') ?? errorFor('contact.email')}
                  />
                </div>
                {check !== null && check.outcome === 'possible_duplicate' && (
                  <Banner
                    tone="warning"
                    title={t('supplier-org.register.duplicateTitle')}
                    actions={
                      requestingMembership ? undefined : (
                        <>
                          <Button size="sm" onClick={() => setRequestingMembership(true)}>
                            {t('supplier-org.register.requestMembership')}
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setContinueToken(check.matchToken);
                              setStep('details');
                            }}
                          >
                            {t('supplier-org.register.continueAnyway')}
                          </Button>
                        </>
                      )
                    }
                  >
                    <p>{check.message}</p>
                    <p className="tiq-text-muted">{t('supplier-org.register.duplicateNote')}</p>
                  </Banner>
                )}
                {check !== null &&
                  check.outcome === 'possible_duplicate' &&
                  check.matchToken !== null &&
                  requestingMembership && (
                    <MembershipRequestForm
                      matchToken={check.matchToken}
                      defaultEmail={draft.email}
                      defaultName={draft.fullName}
                      onCancel={() => setRequestingMembership(false)}
                    />
                  )}
              </div>
            </Card>
          )}

          {step === 'details' && (
            <Card
              title={t('supplier-org.register.detailsTitle')}
              subtitle={t('supplier-org.register.detailsIntro')}
              footer={
                <div className="tiq-inline">
                  <Button icon="arrowLeft" onClick={() => setStep('identity')}>
                    {t('supplier-org.register.back')}
                  </Button>
                  <Button variant="primary" iconAfter="arrowRight" onClick={toReview}>
                    {t('supplier-org.register.toReview')}
                  </Button>
                </div>
              }
            >
              <div className="tiq-stack">
                {summaryError}
                {continueToken !== null && (
                  <Banner tone="info" title={t('supplier-org.register.continuingTitle')}>
                    <p>{t('supplier-org.register.continuing')}</p>
                  </Banner>
                )}
                <h3 className="tiq-form-section-title">
                  {t('supplier-org.register.contactSection')}
                </h3>
                <div className="tiq-form-grid">
                  <TextField
                    label={t('supplier-org.fields.contactName')}
                    required
                    autoComplete="name"
                    value={draft.fullName}
                    onChange={(fullName) => change({ fullName })}
                    error={errorFor('contact.fullName')}
                  />
                  <TextField
                    label={t('supplier-org.fields.jobTitle')}
                    autoComplete="organization-title"
                    value={draft.jobTitle}
                    onChange={(jobTitle) => change({ jobTitle })}
                    error={errorFor('contact.jobTitle')}
                  />
                  <TextField
                    label={t('supplier-org.fields.phone')}
                    hint={t('supplier-org.fields.phoneHint')}
                    type="tel"
                    autoComplete="tel"
                    value={draft.phone}
                    onChange={(phone) => change({ phone })}
                    error={errorFor('contact.phone')}
                  />
                </div>
                <h3 className="tiq-form-section-title">
                  {t('supplier-org.register.businessSection')}
                </h3>
                <div className="tiq-form-grid">
                  <TextField
                    label={t('supplier-org.fields.tradingNames')}
                    hint={t('supplier-org.fields.listHint')}
                    value={draft.tradingNames}
                    onChange={(tradingNames) => change({ tradingNames })}
                    error={errorFor('tradingNames')}
                  />
                  <TextField
                    label={t('supplier-org.fields.taxIdentifier')}
                    value={draft.taxIdentifier}
                    onChange={(taxIdentifier) => change({ taxIdentifier })}
                    error={errorFor('taxIdentifier')}
                  />
                  <TextField
                    label={t('supplier-org.fields.website')}
                    hint={t('supplier-org.fields.websiteHint')}
                    type="url"
                    value={draft.website}
                    onChange={(website) => change({ website })}
                    error={errorFor('website')}
                  />
                  <TextField
                    label={t('supplier-org.fields.serviceAreas')}
                    hint={t('supplier-org.fields.listHint')}
                    value={draft.serviceAreas}
                    onChange={(serviceAreas) => change({ serviceAreas })}
                    error={errorFor('serviceAreas')}
                  />
                  <MultiSelect
                    label={t('supplier-org.fields.languages')}
                    required
                    value={draft.languages}
                    options={languageOptions()}
                    onChange={(languages) => change({ languages })}
                    error={errorFor('preferredLanguages')}
                  />
                  <CategoryPicker
                    options={categories.data?.items}
                    loadFailed={categories.status === 'error'}
                    value={draft.categories}
                    onChange={(value) => change({ categories: value })}
                    error={errorFor('categories')}
                  />
                </div>
                <h3 className="tiq-form-section-title">
                  {t('supplier-org.register.locationsSection')}
                </h3>
                <LocationsEditor
                  locations={draft.locations}
                  onChange={(locations) => change({ locations })}
                  errorFor={errorFor}
                  reference={reference.data}
                />
              </div>
            </Card>
          )}

          {step === 'review' && (
            <Card
              title={t('supplier-org.register.reviewTitle')}
              subtitle={t('supplier-org.register.reviewIntro')}
              footer={
                <div className="tiq-inline">
                  <Button icon="arrowLeft" onClick={() => setStep('details')}>
                    {t('supplier-org.register.back')}
                  </Button>
                  <Button variant="primary" icon="send" onClick={openConfirm}>
                    {t('supplier-org.register.submit')}
                  </Button>
                </div>
              }
            >
              <div className="tiq-stack">
                {summaryError}
                <DetailList
                  items={[
                    {
                      key: 'legal',
                      label: t('supplier-org.fields.legalName'),
                      value: draft.legalName,
                    },
                    {
                      key: 'registration',
                      label: t('supplier-org.fields.registrationNumber'),
                      value: `${draft.registrationNumber} · ${draft.registrationJurisdiction}`,
                    },
                    {
                      key: 'country',
                      label: t('supplier-org.fields.country'),
                      value: countryName(
                        effectiveCountry(draft.country, reference.data),
                        reference.data,
                      ),
                    },
                    {
                      key: 'trading',
                      label: t('supplier-org.fields.tradingNames'),
                      value: splitList(draft.tradingNames).join(', '),
                    },
                    {
                      key: 'contact',
                      label: t('supplier-org.register.contactSection'),
                      value: [draft.fullName, draft.jobTitle, draft.email, draft.phone]
                        .filter((part) => part.trim() !== '')
                        .join(' · '),
                    },
                    {
                      key: 'categories',
                      label: t('supplier-org.fields.categories'),
                      value: (categories.data?.items ?? [])
                        .filter((option) => draft.categories.includes(option.code))
                        .map((option) => option.name)
                        .join(', '),
                    },
                    {
                      key: 'locations',
                      label: t('supplier-org.register.locationsSection'),
                      value: draft.locations
                        .map((location) =>
                          location.isRegisteredOffice
                            ? t('supplier-org.register.registeredOfficeAt', {
                                name: location.name,
                              })
                            : location.name,
                        )
                        .join(', '),
                    },
                    {
                      key: 'areas',
                      label: t('supplier-org.fields.serviceAreas'),
                      value: splitList(draft.serviceAreas).join(', '),
                    },
                    {
                      key: 'languages',
                      label: t('supplier-org.fields.languages'),
                      value: draft.languages.map(languageName).join(', '),
                    },
                  ]}
                />
                <Banner tone="info" title={t('supplier-org.banking.title')}>
                  <p>{BANKING_NOT_COLLECTED_NOTICE}</p>
                </Banner>
                <Checkbox
                  label={t('supplier-org.register.acceptTerms')}
                  checked={draft.acceptTerms}
                  onChange={(acceptTerms) => change({ acceptTerms })}
                  error={errorFor('acceptTerms')}
                />
              </div>
            </Card>
          )}

          {step === 'done' && result !== null && (
            <RegistrationOutcome result={result} email={draft.email.trim()} />
          )}
        </div>

        <aside className="tiq-stack" aria-label={t('supplier-org.register.asideLabel')}>
          <Card title={t('supplier-org.register.invitedTitle')}>
            <p>{t('supplier-org.register.invited')}</p>
          </Card>
          <Card title={t('supplier-org.register.separateTitle')}>
            <ul className="tiq-stack">
              <li>{t('supplier-org.register.separate.contact')}</li>
              <li>{t('supplier-org.register.separate.membership')}</li>
              <li>{t('supplier-org.register.separate.identity')}</li>
              <li>{t('supplier-org.register.separate.qualification')}</li>
            </ul>
          </Card>
          <Card title={t('supplier-org.banking.title')}>
            <p>{BANKING_NOT_COLLECTED_NOTICE}</p>
          </Card>
          <p className="tiq-text-muted">
            {t('supplier-org.register.haveAccount')}{' '}
            <Link to={supplierOrgPaths.signIn}>{t('supplier-org.register.signIn')}</Link>
          </p>
        </aside>
      </div>

      <ConfirmActionDialog
        open={confirming}
        title={t('supplier-org.register.confirmTitle')}
        organization={{
          name: draft.legalName.trim(),
          capacity: t('supplier-org.register.registrantCapacity'),
        }}
        scope={t('supplier-org.register.confirmScope', {
          name: draft.legalName.trim(),
          email: draft.email.trim(),
        })}
        consequence={t('supplier-org.register.confirmResult')}
        confirmLabel={t('supplier-org.register.submit')}
        onConfirm={() => submit()}
        onCancel={() => setConfirming(false)}
        pending={submitting}
        error={isApiError(serverError) ? withSupplierMessage(serverError) : null}
      />
    </div>
  );
}
