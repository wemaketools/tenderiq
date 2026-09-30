/**
 * Support and accessibility contacts (PRD §19: service hours, submission-period support, accessibility assistance,
 * incident escalation) with the standing statement that support is not a submission channel, and the glossary of
 * terms used where decisions are made.
 */
import type { HelpCentreContacts } from '@contracts/operations';

import { Banner, Card, DetailList } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function ContactsCard({ contacts }: { readonly contacts: HelpCentreContacts }) {
  return (
    <Card title={t('help.contacts.title')}>
      <DetailList
        stacked
        items={[
          { key: 'hours', label: t('help.contacts.hours'), value: contacts.serviceHours },
          {
            key: 'submission',
            label: t('help.contacts.submission'),
            value: contacts.submissionPeriodSupport,
          },
          {
            key: 'accessibility',
            label: t('help.contacts.accessibility'),
            value: contacts.accessibilityAssistance,
          },
          {
            key: 'incidents',
            label: t('help.contacts.incidents'),
            value: contacts.incidentEscalation,
          },
        ]}
      />
      <Banner tone="warning" title={t('help.notChannelTitle')}>
        <p>{contacts.notASubmissionChannel}</p>
      </Banner>
    </Card>
  );
}

export function GlossaryCard({ contacts }: { readonly contacts: HelpCentreContacts }) {
  return (
    <Card title={t('help.glossary.title')} subtitle={t('help.glossary.subtitle')}>
      <DetailList
        stacked
        items={contacts.glossary.map((entry) => ({
          key: entry.term,
          label: entry.term,
          value: entry.definition,
        }))}
      />
    </Card>
  );
}
