/**
 * COM-09 for the public: platform service notices (announcements and incidents, without any customer or event
 * detail), support and accessibility contacts, and the glossary. Suppliers without an account find how to get help
 * here; support is never a way to submit a bid.
 */
import { operationsEndpoints } from '@contracts/operations';

import { useApiQuery } from '../../../api/hooks';
import { ButtonLink, PageHeader, QueryView } from '../../../components/ui';
import { browserTimeZone } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ContactsCard, GlossaryCard } from '../components/ContactsCard';
import { ServiceNotices } from '../components/ServiceNotices';

export default function PublicServicePage() {
  const notices = useApiQuery(operationsEndpoints.listPublicServiceNotices, {});
  const contacts = useApiQuery(operationsEndpoints.getPublicHelpContacts, {});
  const timeZone = browserTimeZone();
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('help.public.title')}
        subtitle={t('help.public.subtitle')}
        actions={
          <ButtonLink icon="logIn" to="/signin">
            {t('help.public.signIn')}
          </ButtonLink>
        }
      />
      <QueryView query={notices}>
        {(data) => (
          <ServiceNotices list={data} timeZone={timeZone} title={t('help.public.notices')} />
        )}
      </QueryView>
      <QueryView query={contacts}>
        {(data) => (
          <div className="tiq-grid tiq-grid--2">
            <ContactsCard contacts={data} />
            <GlossaryCard contacts={data} />
          </div>
        )}
      </QueryView>
    </div>
  );
}
