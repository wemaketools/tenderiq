/**
 * The header shared by the tender publication (BUY-14) and participant (BUY-15) pages. PRD §19: it shows the record
 * (reference and title), its stage, the submission deadline in the official zone and the next required action; the
 * organization is in the shell. Route tabs switch between publication and participants.
 */
import type { ReactNode } from 'react';

import type { OfficialDeadline as OfficialDeadlineValue } from '@contracts/common';
import { publicationEndpoints } from '@contracts/publication';
import type { TenderLabel } from '@contracts/publication';

import { useCanCall } from '../../../auth/permissions';

import {
  Chip,
  LinkTabs,
  OfficialDeadline,
  PageHeader,
  Reference,
  StatusChip,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { publicationPaths } from '../lib/paths';

export interface TenderPublicationHeaderProps {
  readonly tender: TenderLabel & { readonly submissionDeadline: OfficialDeadlineValue | null };
  readonly section: 'publication' | 'participants';
  readonly nextAction: string | null;
  readonly primaryAction?: ReactNode;
  readonly actions?: ReactNode;
  readonly counts?: { readonly participants?: number };
}

export function TenderPublicationHeader({
  tender,
  section,
  nextAction,
  primaryAction,
  actions,
  counts,
}: TenderPublicationHeaderProps) {
  // DD-49: a membership that cannot read participants has no Participants tab (the page still explains a URL visit).
  const canReadParticipants = useCanCall(publicationEndpoints.participantSummary);
  const title =
    section === 'publication'
      ? t('publication.tender.title', { reference: tender.reference })
      : t('publication.participants.title', { reference: tender.reference });
  return (
    <>
      <PageHeader
        title={title}
        subtitle={tender.title}
        back={{ to: publicationPaths.register, label: t('publication.common.backToRegister') }}
        primaryAction={primaryAction}
        actions={actions}
        meta={
          <>
            <Reference
              value={tender.reference}
              to={publicationPaths.tenderOverview(tender.tenderId)}
            />
            <StatusChip enum="tenders.status" value={tender.status} />
            <Chip tone="neutral" size="sm">
              {tEnum('tenders.participation', tender.participation)}
            </Chip>
            {tender.submissionDeadline !== null && (
              <OfficialDeadline
                deadline={tender.submissionDeadline}
                label={t('publication.common.submissionDeadline')}
                showLocal={false}
              />
            )}
            <span className="tiq-text-muted">
              {t('publication.common.nextAction')}:{' '}
              <strong>{nextAction ?? t('publication.common.noNextAction')}</strong>
            </span>
          </>
        }
      />
      <LinkTabs
        label={t('publication.tabs.label')}
        tabs={[
          {
            to: publicationPaths.tender(tender.tenderId),
            label: t('publication.tabs.publication'),
          },
          ...(canReadParticipants
            ? [
                {
                  to: publicationPaths.participants(tender.tenderId),
                  label: t('publication.tabs.participants'),
                  count: counts?.participants,
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
