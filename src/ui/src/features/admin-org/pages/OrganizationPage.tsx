/**
 * ADM-01 — Organization and legal entities (FR-01, DD-10): identity, legal entities, branding, working languages,
 * official time zone, currencies, the responsible people (procurement owner, administrator, budget approval,
 * publication, complaints, records, contracts, support contact) and policy ownership, with setup readiness.
 * Settings changes are reviewed first: their effects on public notices and active work are listed and must be
 * acknowledged before they are saved (the change applies at once; nothing is submitted for approval).
 */
import { useState } from 'react';

import { ORGANIZATION_RESPONSIBILITIES, orgAdminEndpoints } from '@contracts/org-admin';
import type {
  OrganizationResponsibility,
  OrganizationSettings,
  SettingsImpact,
  SettingsImpactReview,
  UpdateOrganizationBody,
} from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DetailList,
  FormErrorSummary,
  PageHeader,
  QueryView,
  ReadinessChecklist,
  Select,
  StatusChip,
  Tabs,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { MemberSelect } from '../../admin-access/components/Pickers';
import { orgAdminErrorMessage } from '../../admin-access/lib/errors';
import { useOfficialTimeZone } from '../../admin-access/lib/hooks';
import { OrgLayout } from '../components/OrgLayout';
import { StructureRegister } from '../components/StructureRegister';
import { legalEntityKind } from '../lib/structureKinds';
import { ORG_MANAGE } from '../lib/permissions';

interface Draft {
  tradingName: string;
  brandingDisplayName: string;
  officialTimeZone: string;
  workingLanguages: string;
  defaultCurrency: string;
  acceptedCurrencies: string;
  responsibilities: Record<OrganizationResponsibility, string>;
  publicPortalEnabled: boolean;
  portalIntro: string;
}

const FIELDS = [
  'tradingName',
  'brandingDisplayName',
  'officialTimeZone',
  'workingLanguages',
  'defaultCurrency',
  'acceptedCurrencies',
  'responsibilities',
  'publicPortalEnabled',
  'portalIntro',
];

function draftOf(settings: OrganizationSettings): Draft {
  const responsibilities = {} as Record<OrganizationResponsibility, string>;
  for (const key of ORGANIZATION_RESPONSIBILITIES) {
    const person = settings.settings.responsibilities[key];
    responsibilities[key] = person === null ? '' : String(person.userId);
  }
  return {
    tradingName: settings.identity.tradingName ?? '',
    brandingDisplayName: settings.settings.brandingDisplayName ?? '',
    officialTimeZone: settings.identity.officialTimeZone,
    workingLanguages: settings.identity.workingLanguages.join(', '),
    defaultCurrency: settings.identity.defaultCurrency,
    acceptedCurrencies: settings.settings.acceptedCurrencies.join(', '),
    responsibilities,
    publicPortalEnabled: settings.settings.publicPortalEnabled,
    portalIntro: settings.settings.portalIntro ?? '',
  };
}

function list(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function bodyOf(draft: Draft, acknowledgeImpact: boolean): UpdateOrganizationBody {
  const responsibilities = {} as Record<OrganizationResponsibility, number | null>;
  for (const key of ORGANIZATION_RESPONSIBILITIES) {
    const value = draft.responsibilities[key];
    responsibilities[key] = value === '' ? null : Number(value);
  }
  return {
    tradingName: draft.tradingName.trim() === '' ? null : draft.tradingName.trim(),
    brandingDisplayName:
      draft.brandingDisplayName.trim() === '' ? null : draft.brandingDisplayName.trim(),
    officialTimeZone: draft.officialTimeZone,
    workingLanguages: list(draft.workingLanguages),
    defaultCurrency: draft.defaultCurrency,
    acceptedCurrencies: list(draft.acceptedCurrencies).map((code) => code.toUpperCase()),
    responsibilities,
    publicPortalEnabled: draft.publicPortalEnabled,
    portalIntro: draft.portalIntro.trim() === '' ? null : draft.portalIntro.trim(),
    acknowledgeImpact,
  };
}

function validate(draft: Draft): Record<string, string> {
  const problems: Record<string, string> = {};
  const languages = list(draft.workingLanguages);
  if (languages.length === 0 || languages.some((code) => !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(code))) {
    problems.workingLanguages = t('admin-org.settings.error.languages');
  }
  const currencies = list(draft.acceptedCurrencies).map((code) => code.toUpperCase());
  if (currencies.length === 0 || currencies.some((code) => !/^[A-Z]{3}$/.test(code))) {
    problems.acceptedCurrencies = t('admin-org.settings.error.currencies');
  } else if (!currencies.includes(draft.defaultCurrency)) {
    problems.defaultCurrency = t('admin-org.settings.error.defaultCurrency');
  }
  return problems;
}

function timeZoneOptions(current: string): { value: string; label: string }[] {
  const zones = Intl.supportedValuesOf('timeZone');
  const all = zones.includes(current) ? zones : [current, ...zones];
  return all.map((zone) => ({ value: zone, label: zone }));
}

function ImpactList({ impacts }: { readonly impacts: readonly SettingsImpact[] }) {
  if (impacts.length === 0) {
    return <p className="tiq-text-muted">{t('admin-org.settings.noImpact')}</p>;
  }
  return (
    <ul className="tiq-stack" aria-label={t('admin-org.settings.impactsLabel')}>
      {impacts.map((impact) => (
        <li key={impact.area} className="tiq-stack">
          <span className="tiq-inline">
            <Chip tone={impact.severity === 'warning' ? 'warning' : 'info'} size="sm">
              {t(`admin-org.settings.impactArea.${impact.area}`)}
            </Chip>
            <span>{impact.description}</span>
          </span>
          {impact.references.length > 0 && (
            <span className="tiq-cell-sub">
              {t('admin-org.settings.affected', {
                count: impact.affectedCount,
                references: impact.references.join(', '),
              })}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function SettingsForm({
  settings,
  onSaved,
}: {
  readonly settings: OrganizationSettings;
  readonly onSaved: (next: OrganizationSettings, impacts: readonly SettingsImpact[]) => void;
}) {
  const canManage = usePermission(ORG_MANAGE);
  const [initial] = useState(() => draftOf(settings));
  const [draft, setDraft] = useState<Draft>(initial);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [review, setReview] = useState<SettingsImpactReview | null>(null);
  const impact = useApiMutation(orgAdminEndpoints.reviewOrganizationImpact);
  const update = useApiMutation(orgAdminEndpoints.updateOrganization);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const server = formErrors(impact.error ?? update.error, FIELDS);
  const errorOf = (field: string): string | undefined => local[field] ?? server.forField(field);
  const setResponsible = (key: OrganizationResponsibility, value: string): void =>
    setDraft({ ...draft, responsibilities: { ...draft.responsibilities, [key]: value } });

  const startReview = async (): Promise<void> => {
    const problems = validate(draft);
    setLocal(problems);
    if (Object.keys(problems).length > 0) return;
    try {
      setReview(await impact.mutate({ body: bodyOf(draft, false) }));
    } catch {
      // Shown under the form.
    }
  };

  const businessError = impact.error ?? null;
  return (
    <Card
      title={t('admin-org.settings.formTitle')}
      subtitle={canManage ? t('admin-org.settings.formIntro') : t('admin-org.settings.readOnly')}
      footer={
        canManage ? (
          <div className="tiq-inline">
            <Button
              variant="primary"
              icon="checkSquare"
              disabled={!dirty}
              loading={impact.pending}
              onClick={() => void startReview()}
            >
              {t('admin-org.settings.review')}
            </Button>
            <Button
              disabled={!dirty}
              onClick={() => {
                setDraft(initial);
                setLocal({});
                impact.reset();
              }}
            >
              {t('admin-org.settings.discard')}
            </Button>
            <span className="tiq-text-muted">
              {dirty ? t('admin-org.settings.unsaved') : t('admin-org.settings.saved')}
            </span>
          </div>
        ) : undefined
      }
    >
      <UnsavedChangesGuard when={dirty} />
      {businessError !== null && businessError.fieldErrors.length === 0 && (
        <Banner tone="error" title={t('admin-org.settings.reviewFailed')}>
          <p>{orgAdminErrorMessage(businessError)}</p>
        </Banner>
      )}
      {server.other.length > 0 && <FormErrorSummary errors={server.other} />}
      <fieldset className="tiq-fieldset" disabled={!canManage}>
        <legend>{t('admin-org.settings.identitySection')}</legend>
        <div className="tiq-form-grid">
          <TextField
            label={t('admin-org.settings.tradingName')}
            value={draft.tradingName}
            onChange={(tradingName) => setDraft({ ...draft, tradingName })}
            error={errorOf('tradingName')}
          />
          <TextField
            label={t('admin-org.settings.branding')}
            hint={t('admin-org.settings.brandingHint')}
            value={draft.brandingDisplayName}
            onChange={(brandingDisplayName) => setDraft({ ...draft, brandingDisplayName })}
            error={errorOf('brandingDisplayName')}
          />
          <Select
            label={t('admin-org.settings.timeZone')}
            hint={t('admin-org.settings.timeZoneHint')}
            value={draft.officialTimeZone}
            options={timeZoneOptions(draft.officialTimeZone)}
            onChange={(officialTimeZone) => setDraft({ ...draft, officialTimeZone })}
            error={errorOf('officialTimeZone')}
            required
          />
          <TextField
            label={t('admin-org.settings.languages')}
            hint={t('admin-org.settings.languagesHint')}
            value={draft.workingLanguages}
            onChange={(workingLanguages) => setDraft({ ...draft, workingLanguages })}
            error={errorOf('workingLanguages')}
            required
          />
          <TextField
            label={t('admin-org.settings.currencies')}
            hint={t('admin-org.settings.currenciesHint')}
            value={draft.acceptedCurrencies}
            onChange={(acceptedCurrencies) => setDraft({ ...draft, acceptedCurrencies })}
            error={errorOf('acceptedCurrencies')}
            required
          />
          <Select
            label={t('admin-org.settings.defaultCurrency')}
            value={draft.defaultCurrency}
            options={list(draft.acceptedCurrencies).map((code) => ({
              value: code.toUpperCase(),
              label: code.toUpperCase(),
            }))}
            onChange={(defaultCurrency) => setDraft({ ...draft, defaultCurrency })}
            error={errorOf('defaultCurrency')}
            required
          />
        </div>
      </fieldset>
      <fieldset className="tiq-fieldset" disabled={!canManage}>
        <legend>{t('admin-org.settings.responsibilitiesSection')}</legend>
        <p className="tiq-text-muted">{t('admin-org.settings.responsibilitiesIntro')}</p>
        <div className="tiq-form-grid">
          {ORGANIZATION_RESPONSIBILITIES.map((key) => (
            <MemberSelect
              key={key}
              label={t(`admin-org.settings.responsibility.${key}`)}
              value={draft.responsibilities[key]}
              onChange={(value) => setResponsible(key, value)}
              error={errorOf(`responsibilities.${key}`)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="tiq-fieldset" disabled={!canManage}>
        <legend>{t('admin-org.settings.portalSection')}</legend>
        <div className="tiq-form-grid">
          <Checkbox
            label={t('admin-org.settings.portalEnabled')}
            hint={t('admin-org.settings.portalEnabledHint')}
            checked={draft.publicPortalEnabled}
            onChange={(publicPortalEnabled) => setDraft({ ...draft, publicPortalEnabled })}
            error={errorOf('publicPortalEnabled')}
          />
          <TextArea
            label={t('admin-org.settings.portalIntro')}
            value={draft.portalIntro}
            onChange={(portalIntro) => setDraft({ ...draft, portalIntro })}
            error={errorOf('portalIntro')}
            rows={3}
            fieldClassName="tiq-form-full"
          />
        </div>
      </fieldset>
      {review !== null && (
        <ConfirmActionDialog
          open
          title={t('admin-org.settings.impactTitle')}
          scope={t('admin-org.settings.impactScope')}
          consequence={t('admin-org.settings.impactConsequence')}
          confirmLabel={t('admin-org.settings.save')}
          acknowledgement={
            review.requiresAcknowledgement ? t('admin-org.settings.acknowledge') : undefined
          }
          pending={update.pending}
          error={update.error === null ? null : update.error}
          onCancel={() => {
            setReview(null);
            update.reset();
          }}
          onConfirm={async () => {
            try {
              const result = await update.mutate({ body: bodyOf(draft, true) });
              setReview(null);
              onSaved(result.organization, result.impacts);
            } catch {
              // Shown in the dialog.
            }
          }}
        >
          <ImpactList impacts={review.impacts} />
        </ConfirmActionDialog>
      )}
    </Card>
  );
}

function OrganizationView({ settings: loaded }: { readonly settings: OrganizationSettings }) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [settings, setSettings] = useState(loaded);
  const [version, setVersion] = useState(0);
  const [applied, setApplied] = useState<readonly SettingsImpact[] | null>(null);
  const identity = settings.identity;
  return (
    <>
      <PageHeader
        title={t('admin-org.settings.title')}
        subtitle={identity.legalName}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="tenants.status" value={identity.status} />
            <StatusChip enum="tenants.verification_status" value={identity.verificationStatus} />
            <span className="tiq-text-muted">
              {t('admin-org.settings.updated', {
                at: formatDateTime(settings.updatedAt, timeZone),
                by: settings.updatedBy?.fullName ?? '—',
              })}
            </span>
          </span>
        }
      />
      {applied !== null && (
        <Banner
          tone="success"
          title={t('admin-org.settings.savedTitle')}
          actions={
            <Button size="sm" variant="ghost" onClick={() => setApplied(null)}>
              {t('admin-access.common.dismiss')}
            </Button>
          }
        >
          <ImpactList impacts={applied} />
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-org.settings.identity')}>
          <DetailList
            items={[
              { key: 'legal', label: t('admin-org.settings.legalName'), value: identity.legalName },
              {
                key: 'trading',
                label: t('admin-org.settings.tradingName'),
                value: identity.tradingName,
              },
              {
                key: 'slug',
                label: t('admin-org.settings.slug'),
                value: <span className="tiq-mono">{identity.slug}</span>,
              },
              { key: 'country', label: t('admin-org.settings.country'), value: identity.country },
              {
                key: 'jurisdiction',
                label: t('admin-org.settings.jurisdiction'),
                value: identity.registrationJurisdiction,
              },
              {
                key: 'registration',
                label: t('admin-org.settings.registration'),
                value: identity.registrationNumber,
              },
              { key: 'tax', label: t('admin-org.settings.tax'), value: identity.taxIdentifier },
              {
                key: 'timeZone',
                label: t('admin-org.settings.timeZone'),
                value: identity.officialTimeZone,
              },
              {
                key: 'languages',
                label: t('admin-org.settings.languages'),
                value: identity.workingLanguages.join(', '),
              },
              {
                key: 'currency',
                label: t('admin-org.settings.defaultCurrency'),
                value: `${identity.defaultCurrency} (${settings.settings.acceptedCurrencies.join(', ')})`,
              },
              {
                key: 'onboarding',
                label: t('admin-org.settings.onboarding'),
                value:
                  identity.onboardingStage === null
                    ? null
                    : tEnum('tenants.onboarding_stage', identity.onboardingStage),
              },
              { key: 'plan', label: t('admin-org.settings.plan'), value: identity.planCode },
              {
                key: 'calendar',
                label: t('admin-org.settings.calendar'),
                value: settings.settings.defaultCalendar?.name,
              },
              {
                key: 'entities',
                label: t('admin-org.settings.entities'),
                value: String(settings.legalEntityCount),
              },
            ]}
          />
        </Card>
        <div className="tiq-stack">
          <Card title={t('admin-org.settings.readiness')}>
            <ReadinessChecklist
              label={t('admin-org.settings.readiness')}
              items={settings.readiness.map((item) => ({
                id: item.id,
                label: item.label,
                detail: item.detail ?? undefined,
                status: item.status,
              }))}
            />
          </Card>
          <Card title={t('admin-org.settings.policy')}>
            <DetailList
              items={[
                {
                  key: 'profile',
                  label: t('admin-org.settings.policyProfile'),
                  value:
                    settings.policyProfile === null
                      ? null
                      : t('admin-org.settings.policyVersion', {
                          name: settings.policyProfile.name,
                          version: settings.policyProfile.versionNo,
                        }),
                },
                {
                  key: 'owner',
                  label: t('admin-org.settings.responsibility.procurementOwner'),
                  value: settings.settings.responsibilities.procurementOwner?.fullName,
                },
                {
                  key: 'sod',
                  label: t('admin-org.settings.sodNote'),
                  value: settings.settings.sodAlternativeOversightNote,
                },
              ]}
            />
          </Card>
        </div>
      </div>
      <SettingsForm
        key={version}
        settings={settings}
        onSaved={(next, impacts) => {
          setSettings(next);
          setVersion(version + 1);
          setApplied(impacts);
          toast.show(t('admin-org.settings.savedTitle'), 'success');
        }}
      />
    </>
  );
}

type Tab = 'organization' | 'entities';

export default function OrganizationPage() {
  const [tab, setTab] = useState<Tab>('organization');
  const query = useApiQuery(orgAdminEndpoints.getOrganization, {});
  return (
    <OrgLayout>
      <Tabs
        label={t('admin-org.settings.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={[
          { id: 'organization', label: t('admin-org.settings.tab.organization') },
          { id: 'entities', label: t('admin-org.settings.tab.entities') },
        ]}
      >
        {tab === 'organization' ? (
          <QueryView query={query}>
            {(settings) => <OrganizationView settings={settings} />}
          </QueryView>
        ) : (
          <>
            <PageHeader
              title={t('admin-org.structure.legalEntities.title')}
              subtitle={t('admin-org.structure.legalEntities.intro')}
            />
            <StructureRegister config={legalEntityKind} />
          </>
        )}
      </Tabs>
    </OrgLayout>
  );
}
