/**
 * Public portal disclosure settings (ADM-11): a read-only view and the proposal editor. Mandatory notice fields
 * and the portal channel are always shown and cannot be switched off (MANDATORY_CONTROL_HIDDEN, PRD §17.3); the
 * editor shows them checked and locked.
 */
import {
  PORTAL_SETTINGS_DISCLOSE_BIDDER_IDENTITIES,
  PORTAL_SETTINGS_PUBLIC_DOCUMENT_POLICY,
  PUBLICATIONS_CHANNEL,
} from '@contracts/enums';
import type { PublicationsChannel } from '@contracts/enums';
import { MANDATORY_CHANNELS, PORTAL_NOTICE_FIELDS } from '@contracts/policy';
import type { PortalNoticeFieldKey, PortalSettings } from '@contracts/policy';

import {
  Checkbox,
  Chip,
  DetailList,
  RadioGroup,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import type { PortalDraft } from '../lib/portalDraft';
import { PlainMarkdown } from './PlainMarkdown';
import type { ErrorLookup } from '../lib/validation';

function yesNo(value: boolean): string {
  return value ? t('admin-policy.common.yes') : t('admin-policy.common.no');
}

export function PortalSettingsView({ settings }: { readonly settings: PortalSettings }) {
  const visible = settings.noticeFields.filter((field) => field.visible);
  const hidden = settings.noticeFields.filter((field) => !field.visible);
  return (
    <DetailList
      items={[
        {
          key: 'enabled',
          label: t('admin-policy.portal.field.enabled'),
          value: yesNo(settings.publicPortalEnabled),
        },
        {
          key: 'name',
          label: t('admin-policy.portal.field.displayName'),
          value: settings.brandingDisplayName,
        },
        {
          key: 'intro',
          label: t('admin-policy.portal.field.intro'),
          value: settings.portalIntro,
        },
        {
          key: 'guidance',
          label: t('admin-policy.portal.field.guidance'),
          value:
            settings.guidanceMarkdown.trim() === '' ? null : (
              <PlainMarkdown text={settings.guidanceMarkdown} />
            ),
        },
        {
          key: 'advance',
          label: t('admin-policy.portal.field.advance'),
          value: yesNo(settings.showAdvanceNotices),
        },
        {
          key: 'awards',
          label: t('admin-policy.portal.field.awards'),
          value: yesNo(settings.showAwards),
        },
        {
          key: 'counts',
          label: t('admin-policy.portal.field.counts'),
          value: yesNo(settings.showBidderCounts),
        },
        {
          key: 'identities',
          label: t('admin-policy.portal.field.identities'),
          value: tEnum(
            'portal_settings.disclose_bidder_identities',
            settings.discloseBidderIdentities,
          ),
        },
        {
          key: 'documents',
          label: t('admin-policy.portal.field.documents'),
          value: tEnum('portal_settings.public_document_policy', settings.publicDocumentPolicy),
        },
        {
          key: 'languages',
          label: t('admin-policy.portal.field.languages'),
          value: settings.languages.map((code) => code.toUpperCase()).join(', '),
        },
        {
          key: 'fields',
          label: t('admin-policy.portal.field.noticeFields'),
          value: (
            <span className="tiq-inline">
              {visible.map((field) => (
                <Chip key={field.key} tone={field.mandatory ? 'accent' : 'neutral'} size="sm">
                  {field.label}
                </Chip>
              ))}
            </span>
          ),
        },
        {
          key: 'hidden',
          label: t('admin-policy.portal.field.hiddenFields'),
          value: hidden.map((field) => field.label).join(', '),
        },
        {
          key: 'channels',
          label: t('admin-policy.portal.field.channels'),
          value: settings.channels
            .filter((channel) => channel.enabled)
            .map((channel) =>
              channel.description === null
                ? tEnum('publications.channel', channel.channel)
                : `${tEnum('publications.channel', channel.channel)} (${channel.description})`,
            )
            .join(', '),
        },
      ]}
    />
  );
}

export interface PortalSettingsFormProps {
  readonly value: PortalDraft;
  readonly onChange: (value: PortalDraft) => void;
  readonly errors: ErrorLookup;
}

export function PortalSettingsForm({ value, onChange, errors }: PortalSettingsFormProps) {
  const set = (patch: Partial<PortalDraft>): void => onChange({ ...value, ...patch });
  const toggleField = (key: PortalNoticeFieldKey, visible: boolean): void =>
    set({
      visibleNoticeFields: visible
        ? [...value.visibleNoticeFields, key]
        : value.visibleNoticeFields.filter((candidate) => candidate !== key),
    });
  const toggleChannel = (channel: PublicationsChannel, enabled: boolean): void =>
    set({
      channels: enabled
        ? [...value.channels, channel]
        : value.channels.filter((candidate) => candidate !== channel),
    });

  return (
    <div className="tiq-form-stack">
      <TextArea
        label={t('admin-policy.portal.changeNote')}
        hint={t('admin-policy.portal.changeNoteHint')}
        required
        rows={2}
        value={value.changeNote}
        onChange={(changeNote) => set({ changeNote })}
        error={errors.forField('changeNote')}
      />
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.portal.section.branding')}</legend>
        <div className="tiq-form-grid">
          <Checkbox
            label={t('admin-policy.portal.field.enabled')}
            hint={t('admin-policy.portal.field.enabledHint')}
            checked={value.publicPortalEnabled}
            onChange={(publicPortalEnabled) => set({ publicPortalEnabled })}
          />
          <TextField
            label={t('admin-policy.portal.field.displayName')}
            required
            value={value.brandingDisplayName}
            onChange={(brandingDisplayName) => set({ brandingDisplayName })}
            error={errors.forField('settings.brandingDisplayName')}
          />
          <TextArea
            label={t('admin-policy.portal.field.intro')}
            rows={3}
            value={value.portalIntro}
            onChange={(portalIntro) => set({ portalIntro })}
            error={errors.forField('settings.portalIntro')}
            fieldClassName="tiq-form-full"
          />
          <TextArea
            label={t('admin-policy.portal.field.guidance')}
            hint={t('admin-policy.portal.field.guidanceHint')}
            rows={5}
            value={value.guidanceMarkdown}
            onChange={(guidanceMarkdown) => set({ guidanceMarkdown })}
            error={errors.forField('settings.guidanceMarkdown')}
            fieldClassName="tiq-form-full"
          />
          <TextField
            label={t('admin-policy.portal.field.languages')}
            hint={t('admin-policy.portal.field.languagesHint')}
            required
            value={value.languages}
            onChange={(languages) => set({ languages })}
            error={errors.forField('settings.languages')}
          />
        </div>
      </fieldset>
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.portal.section.disclosure')}</legend>
        <div className="tiq-form-grid">
          <div className="tiq-stack">
            <Checkbox
              label={t('admin-policy.portal.field.advance')}
              checked={value.showAdvanceNotices}
              onChange={(showAdvanceNotices) => set({ showAdvanceNotices })}
            />
            <Checkbox
              label={t('admin-policy.portal.field.awards')}
              checked={value.showAwards}
              onChange={(showAwards) => set({ showAwards })}
            />
            <Checkbox
              label={t('admin-policy.portal.field.counts')}
              checked={value.showBidderCounts}
              onChange={(showBidderCounts) => set({ showBidderCounts })}
            />
          </div>
          <RadioGroup
            label={t('admin-policy.portal.field.identities')}
            value={value.discloseBidderIdentities}
            options={PORTAL_SETTINGS_DISCLOSE_BIDDER_IDENTITIES.map((option) => ({
              value: option,
              label: tEnum('portal_settings.disclose_bidder_identities', option),
            }))}
            onChange={(discloseBidderIdentities) => set({ discloseBidderIdentities })}
            error={errors.forField('settings.discloseBidderIdentities')}
          />
          <RadioGroup
            label={t('admin-policy.portal.field.documents')}
            value={value.publicDocumentPolicy}
            options={PORTAL_SETTINGS_PUBLIC_DOCUMENT_POLICY.map((option) => ({
              value: option,
              label: tEnum('portal_settings.public_document_policy', option),
              hint: t(`admin-policy.portal.documentPolicy.${option}`),
            }))}
            onChange={(publicDocumentPolicy) => set({ publicDocumentPolicy })}
            error={errors.forField('settings.publicDocumentPolicy')}
          />
        </div>
      </fieldset>
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.portal.section.noticeFields')}</legend>
        <p className="tiq-field-hint">{t('admin-policy.portal.mandatoryHint')}</p>
        <div className="tiq-check-list">
          {PORTAL_NOTICE_FIELDS.map((field) => (
            <Checkbox
              key={field.key}
              label={
                field.mandatory
                  ? t('admin-policy.portal.mandatoryLabel', { label: field.label })
                  : field.label
              }
              checked={field.mandatory || value.visibleNoticeFields.includes(field.key)}
              disabled={field.mandatory}
              onChange={(visible) => toggleField(field.key, visible)}
            />
          ))}
        </div>
        {errors.forField('settings.visibleNoticeFields') !== undefined && (
          <p className="tiq-field-error">{errors.forField('settings.visibleNoticeFields')}</p>
        )}
      </fieldset>
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.portal.section.channels')}</legend>
        <div className="tiq-form-grid">
          <div className="tiq-stack">
            {PUBLICATIONS_CHANNEL.map((channel) => {
              const mandatory = MANDATORY_CHANNELS.includes(channel);
              return (
                <Checkbox
                  key={channel}
                  label={
                    mandatory
                      ? t('admin-policy.portal.mandatoryLabel', {
                          label: tEnum('publications.channel', channel),
                        })
                      : tEnum('publications.channel', channel)
                  }
                  checked={mandatory || value.channels.includes(channel)}
                  disabled={mandatory}
                  onChange={(enabled) => toggleChannel(channel, enabled)}
                />
              );
            })}
            {errors.forField('settings.channels') !== undefined && (
              <p className="tiq-field-error">{errors.forField('settings.channels')}</p>
            )}
          </div>
          {value.channels.includes('external_notice') && (
            <TextField
              label={t('admin-policy.portal.field.external')}
              hint={t('admin-policy.portal.field.externalHint')}
              required
              value={value.externalNoticeDescription}
              onChange={(externalNoticeDescription) => set({ externalNoticeDescription })}
              error={errors.forField('settings.externalNoticeDescription')}
            />
          )}
        </div>
      </fieldset>
    </div>
  );
}
