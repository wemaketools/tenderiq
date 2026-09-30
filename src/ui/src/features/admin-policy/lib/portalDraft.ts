/**
 * The editable draft of a public portal disclosure proposal (ADM-11) and its conversion to the contract body.
 */
import type {
  PortalSettingsDiscloseBidderIdentities,
  PortalSettingsPublicDocumentPolicy,
  PublicationsChannel,
} from '@contracts/enums';
import type {
  PortalNoticeFieldKey,
  PortalSettings,
  SavePortalProposalBody,
} from '@contracts/policy';

export interface PortalDraft {
  readonly publicPortalEnabled: boolean;
  readonly brandingDisplayName: string;
  readonly portalIntro: string;
  readonly guidanceMarkdown: string;
  readonly showAdvanceNotices: boolean;
  readonly showAwards: boolean;
  readonly showBidderCounts: boolean;
  readonly discloseBidderIdentities: string;
  readonly publicDocumentPolicy: string;
  /** Comma-separated language codes. */
  readonly languages: string;
  readonly visibleNoticeFields: readonly PortalNoticeFieldKey[];
  readonly channels: readonly PublicationsChannel[];
  readonly externalNoticeDescription: string;
  readonly changeNote: string;
}

export function settingsToDraft(settings: PortalSettings, changeNote = ''): PortalDraft {
  return {
    publicPortalEnabled: settings.publicPortalEnabled,
    brandingDisplayName: settings.brandingDisplayName,
    portalIntro: settings.portalIntro,
    guidanceMarkdown: settings.guidanceMarkdown,
    showAdvanceNotices: settings.showAdvanceNotices,
    showAwards: settings.showAwards,
    showBidderCounts: settings.showBidderCounts,
    discloseBidderIdentities: settings.discloseBidderIdentities,
    publicDocumentPolicy: settings.publicDocumentPolicy,
    languages: settings.languages.join(', '),
    visibleNoticeFields: settings.noticeFields
      .filter((field) => field.visible || field.mandatory)
      .map((field) => field.key),
    channels: settings.channels
      .filter((channel) => channel.enabled || channel.mandatory)
      .map((channel) => channel.channel),
    externalNoticeDescription:
      settings.channels.find((channel) => channel.channel === 'external_notice')?.description ?? '',
    changeNote,
  };
}

export function draftToProposal(draft: PortalDraft): SavePortalProposalBody {
  const external = draft.channels.includes('external_notice');
  return {
    changeNote: draft.changeNote,
    settings: {
      publicPortalEnabled: draft.publicPortalEnabled,
      brandingDisplayName: draft.brandingDisplayName,
      portalIntro: draft.portalIntro,
      guidanceMarkdown: draft.guidanceMarkdown,
      showAdvanceNotices: draft.showAdvanceNotices,
      showAwards: draft.showAwards,
      showBidderCounts: draft.showBidderCounts,
      discloseBidderIdentities:
        draft.discloseBidderIdentities as PortalSettingsDiscloseBidderIdentities,
      publicDocumentPolicy: draft.publicDocumentPolicy as PortalSettingsPublicDocumentPolicy,
      languages: draft.languages
        .split(',')
        .map((code) => code.trim().toLowerCase())
        .filter((code) => code !== ''),
      visibleNoticeFields: [...draft.visibleNoticeFields],
      channels: [...draft.channels],
      externalNoticeDescription:
        external && draft.externalNoticeDescription.trim() !== ''
          ? draft.externalNoticeDescription.trim()
          : null,
    },
  };
}

export const PORTAL_FIELDS = [
  'changeNote',
  'settings.brandingDisplayName',
  'settings.portalIntro',
  'settings.guidanceMarkdown',
  'settings.discloseBidderIdentities',
  'settings.publicDocumentPolicy',
  'settings.languages',
  'settings.visibleNoticeFields',
  'settings.channels',
  'settings.externalNoticeDescription',
];
