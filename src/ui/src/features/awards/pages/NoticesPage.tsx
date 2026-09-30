/**
 * BUY-28 — Outcome notices and waiting period: draft and issued notices with disclosure review, recipients,
 * delivery and acknowledgments; the standstill calendar, end dates, extensions, holds and readiness; and the
 * public award notice. The intention to award is always distinct from the final award notice (FR-17, BR-31).
 */
import { useState } from 'react';

import { getAwardOverview } from '@contracts/awards';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { Banner, EmptyState, Tabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { AwardFileLayout } from '../components/AwardFileLayout';
import { NoticesList } from '../components/NoticesList';
import { PublicNoticePanel } from '../components/PublicNoticePanel';
import { StandstillPanel } from '../components/StandstillPanel';
import { useIdParam } from '../lib/hooks';
import { NOTICE_READ } from '../lib/permissions';

type Section = 'notices' | 'standstill' | 'public';

export default function NoticesPage() {
  const tenderId = useIdParam('tenderId');
  const canRead = usePermission(NOTICE_READ);
  const overview = useApiQuery(
    getAwardOverview,
    tenderId === null ? null : { params: { tenderId } },
  );
  const [section, setSection] = useState<Section>('notices');

  if (tenderId === null) {
    return <EmptyState title={t('awards.file.notFound')} icon="award" />;
  }

  const holds = overview.data?.holds.filter((hold) => hold.releasedAt === null).length ?? 0;

  return (
    <AwardFileLayout tenderId={tenderId} overview={overview} subtitle={t('awards.notices.intro')}>
      {overview.data !== undefined && canRead && (
        <div className="tiq-stack tiq-stack--spaced">
          <Banner tone="info" title={t('awards.notices.intentVsFinal')}>
            {t('awards.notices.intentVsFinalText')}
          </Banner>
          <Tabs
            label={t('awards.notices.sections')}
            selected={section}
            onSelect={(id) => {
              if (id === 'notices' || id === 'standstill' || id === 'public') setSection(id);
            }}
            tabs={[
              { id: 'notices', label: t('awards.notices.tab.notices') },
              {
                id: 'standstill',
                label: t('awards.notices.tab.standstill'),
                count: holds > 0 ? holds : undefined,
              },
              { id: 'public', label: t('awards.notices.tab.public') },
            ]}
          >
            {section === 'notices' && <NoticesList overview={overview.data} />}
            {section === 'standstill' && <StandstillPanel tenderId={tenderId} />}
            {section === 'public' && <PublicNoticePanel tenderId={tenderId} />}
          </Tabs>
        </div>
      )}
    </AwardFileLayout>
  );
}
