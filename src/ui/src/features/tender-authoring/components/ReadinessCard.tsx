/**
 * Readiness by section (BUY-08, BUY-13): blocking errors stop the release approval request and publication;
 * warnings do not stop the approval request; passed sections are listed so the reviewer sees what was checked.
 * Publication stays blocked while anything required is incomplete, including pending release checks and a missing
 * approval (FR-07). A released, cancelled or archived tender shows its lifecycle instead of the gate.
 */
import { getTenderReadiness } from '@contracts/tenders';
import type { PublicationGate, ReleaseApprovalState } from '@contracts/tenders';

import { useApiQuery } from '../../../api/hooks';
import { Banner, Card, EmptyState, QueryView, ReadinessChecklist } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { closedGateText } from '../lib/lifecycle';
import type { TenderLifecycle } from '../lib/lifecycle';
import { readinessItems } from '../lib/readiness';

export interface GateBannerProps {
  readonly gate: PublicationGate;
  /** The current release approval, so a pending or granted approval is not reported as missing. */
  readonly approval?: ReleaseApprovalState | null;
  /**
   * The tender's lifecycle: once it is no longer authored in place (released, cancelled or archived) the banner
   * says so instead of reporting the package as ready for publication (BUY-08, BR-16).
   */
  readonly tender: TenderLifecycle;
}

function nextStep(gate: PublicationGate, approval: ReleaseApprovalState | null): string {
  if (gate.canRequestReleaseApproval) return t('tender-authoring.readiness.canRequest');
  if (approval !== null && approval.coversCurrentRevision && approval.status === 'pending') {
    return t('tender-authoring.readiness.awaitingApproval', { id: approval.approvalId });
  }
  if (approval !== null && approval.coversCurrentRevision && approval.status === 'approved') {
    return t('tender-authoring.readiness.approvalGranted', { id: approval.approvalId });
  }
  return t('tender-authoring.readiness.cannotRequest');
}

export function GateBanner({ gate, approval = null, tender }: GateBannerProps) {
  const closed = closedGateText(tender);
  if (closed !== null) {
    return (
      <Banner tone="info" title={closed.title}>
        <p>{closed.detail}</p>
      </Banner>
    );
  }
  if (!gate.publicationBlocked) {
    return (
      <Banner tone="success" title={t('tender-authoring.readiness.publishable')}>
        <p>{t('tender-authoring.readiness.publishableDetail')}</p>
      </Banner>
    );
  }
  return (
    <Banner tone="error" title={t('tender-authoring.readiness.blocked')}>
      <ul>
        {gate.blockedReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p>{nextStep(gate, approval)}</p>
    </Banner>
  );
}

export function ReadinessCard({
  tender,
  approval = null,
}: {
  readonly tender: TenderLifecycle & { readonly id: number };
  readonly approval?: ReleaseApprovalState | null;
}) {
  const query = useApiQuery(getTenderReadiness, { params: { tenderId: tender.id } });
  return (
    <Card
      title={t('tender-authoring.readiness.title')}
      subtitle={t('tender-authoring.readiness.subtitle')}
    >
      <QueryView
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState compact icon="clipboardCheck" title={t('tender-authoring.readiness.empty')} />
        }
      >
        {(data) => (
          <div className="tiq-stack">
            <GateBanner gate={data.gate} approval={approval} tender={tender} />
            <ReadinessChecklist
              label={t('tender-authoring.readiness.label')}
              items={readinessItems(data.items)}
            />
          </div>
        )}
      </QueryView>
    </Card>
  );
}
