/**
 * The workspace frame of one evaluation (a tender, or one lot of it; docs/plan/design1): the page heading with the
 * record context of PRD §19 (organization, reference, stage, next due date and the caller's own next action, which
 * the API derives from their role: the chair's committee step, an evaluator's own step, none for an observer) and the
 * segmented route tabs to the overview, commercial comparison (EVA-04), moderation (EVA-05) and ranking and report
 * (EVA-06). Tabs are offered by permission; the API still limits every record to the caller's assignments (BR-26).
 * The overview passes a friendlier `headline`; the other screens keep their plain titles.
 */
import type { ReactNode } from 'react';

import { getEvaluation } from '@contracts/evaluation';
import type { EvaluationLotRef, EvaluationTenderRef } from '@contracts/evaluation';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { LinkTabs, OfficialDeadline, PageHeader, Reference } from '../../../components/ui';
import type { LinkTabItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { lotLabel } from '../lib/labels';
import { evaluationPaths } from '../lib/paths';
import {
  COMMERCIAL_VIEW_PERMISSIONS,
  EVALUATION_OVERVIEW_PERMISSIONS,
  MODERATION_VIEW_PERMISSIONS,
  RESULTS_VIEW_PERMISSIONS,
} from '../lib/permissions';
import { PriceGateChip, StageChip } from './chips';

export interface EvaluationWorkspaceProps {
  readonly tenderId: number;
  readonly lotId: number | null;
  /** The screen title (document title, and the eyebrow when a headline is given). */
  readonly title: string;
  /** A friendlier headline for the H1 (buyer presentation); the plain title stays as the eyebrow. */
  readonly headline?: string;
  /** The record as the page's own query returned it (shown before the overview query settles). */
  readonly tender?: EvaluationTenderRef;
  readonly lot?: EvaluationLotRef | null;
  readonly primaryAction?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function EvaluationWorkspace({
  tenderId,
  lotId,
  title,
  headline,
  tender,
  lot,
  primaryAction,
  actions,
  children,
}: EvaluationWorkspaceProps) {
  const activeTenant = useActiveTenant();
  const canOverview = usePermission(EVALUATION_OVERVIEW_PERMISSIONS);
  const canCommercial = usePermission(COMMERCIAL_VIEW_PERMISSIONS);
  const canModerate = usePermission(MODERATION_VIEW_PERMISSIONS);
  const canResults = usePermission(RESULTS_VIEW_PERMISSIONS);
  const overview = useApiQuery(
    getEvaluation,
    canOverview ? { params: { tenderId }, query: lotId === null ? {} : { lotId } } : null,
  );
  const summary = overview.data;
  const record = summary?.tender ?? tender;
  const recordLot = summary?.lot ?? lot ?? null;

  const tabs: LinkTabItem[] = [];
  if (canOverview) {
    tabs.push({
      to: evaluationPaths.overview(tenderId, lotId),
      label: t('evaluation.tabs.overview'),
      end: true,
    });
  }
  if (canCommercial) {
    tabs.push({
      to: evaluationPaths.commercial(tenderId, lotId),
      label: t('evaluation.tabs.commercial'),
    });
  }
  if (canModerate) {
    tabs.push({
      to: evaluationPaths.moderation(tenderId, lotId),
      label: t('evaluation.tabs.moderation'),
    });
  }
  if (canResults) {
    tabs.push({
      to: evaluationPaths.results(tenderId, lotId),
      label: t('evaluation.tabs.results'),
    });
  }

  const subtitle =
    record === undefined
      ? undefined
      : [record.title, record.reference, lotLabel(recordLot)]
          .filter((part) => part !== null)
          .join(' · ');

  return (
    <div className="tiq-page">
      <PageHeader
        title={title}
        headline={headline}
        subtitle={subtitle}
        back={{ to: evaluationPaths.list, label: t('evaluation.list.title') }}
        primaryAction={primaryAction}
        actions={actions}
        meta={
          record === undefined ? undefined : (
            <>
              <Reference value={record.reference} to={evaluationPaths.tender(record.tenderId)} />
              {activeTenant !== null && <span className="tiq-text-muted">{activeTenant.name}</span>}
              {summary !== undefined && <StageChip stage={summary.stage} />}
              {summary !== undefined && <PriceGateChip gate={summary.priceGate} size="sm" />}
              {summary !== undefined && (
                <span>{t('evaluation.common.chairIs', { name: summary.chair.fullName })}</span>
              )}
              {summary?.nextDueAt !== null && summary?.nextDueAt !== undefined && (
                <OfficialDeadline
                  deadline={summary.nextDueAt}
                  label={t('evaluation.common.nextDue')}
                  showLocal={false}
                />
              )}
              {summary !== undefined && summary.myNextAction !== 'none' && (
                <span>
                  <strong>{t('evaluation.common.nextAction')}</strong>{' '}
                  {t(`evaluation.myNext.${summary.myNextAction}`)}
                </span>
              )}
            </>
          )
        }
      />
      {tabs.length > 1 && (
        <LinkTabs tabs={tabs} label={t('evaluation.tabs.label')} variant="segmented" />
      )}
      {children}
    </div>
  );
}
