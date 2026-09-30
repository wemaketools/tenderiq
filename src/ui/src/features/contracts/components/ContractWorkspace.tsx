/**
 * The contract workspace frame (CON-02 … CON-11): loads the contract, shows the record context required by PRD §19
 * (reference, status, supplier, contracting entity, next decision with its official deadline), active holds, the
 * imported-record provenance and the workspace tabs, then renders the screen for the loaded contract.
 */
import type { ReactNode } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { ContractDetail } from '@contracts/contracts';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Chip,
  ErrorState,
  LinkTabs,
  OfficialDeadline,
  PageHeader,
  Reference,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import { formatCalendarDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useIdParam } from '../lib/hooks';
import { contractPaths } from '../lib/paths';
import { CONTRACT_FINANCIALS } from '../lib/permissions';

export type ContractScreen =
  | 'CON-02'
  | 'CON-03'
  | 'CON-04'
  | 'CON-05'
  | 'CON-06'
  | 'CON-07'
  | 'CON-08'
  | 'CON-09'
  | 'CON-10'
  | 'CON-11';

export interface ContractWorkspaceProps {
  readonly screen: ContractScreen;
  readonly primaryAction?: (contract: ContractDetail) => ReactNode;
  readonly actions?: (contract: ContractDetail) => ReactNode;
  readonly children: (contract: ContractDetail) => ReactNode;
}

export function ContractTabs({ contractId }: { readonly contractId: number }) {
  const canSeeFinancials = usePermission(CONTRACT_FINANCIALS);
  const tabs = [
    { to: contractPaths.overview(contractId), label: t('contracts.tabs.overview'), end: true },
    { to: contractPaths.preparation(contractId), label: t('contracts.tabs.preparation') },
    { to: contractPaths.signature(contractId), label: t('contracts.tabs.signature') },
    { to: contractPaths.handover(contractId), label: t('contracts.tabs.handover') },
    { to: contractPaths.milestones(contractId), label: t('contracts.tabs.milestones') },
    { to: contractPaths.performance(contractId), label: t('contracts.tabs.performance') },
    ...(canSeeFinancials
      ? [{ to: contractPaths.financials(contractId), label: t('contracts.tabs.financials') }]
      : []),
    { to: contractPaths.changes(contractId), label: t('contracts.tabs.changes') },
    { to: contractPaths.renewals(contractId), label: t('contracts.tabs.renewals') },
    { to: contractPaths.closeout(contractId), label: t('contracts.tabs.closeout') },
  ];
  return <LinkTabs label={t('contracts.tabs.label')} tabs={tabs} />;
}

function ContractMeta({ contract }: { readonly contract: ContractDetail }) {
  const decision = contract.nextDecision;
  return (
    <span className="tiq-stack">
      <span className="tiq-inline">
        <Reference value={contract.reference} />
        <StatusChip enum="contracts.status" value={contract.status} />
        <span>{contract.supplier.name}</span>
        <span className="tiq-text-muted">{contract.legalEntity.name}</span>
        {contract.differsFromAward && (
          <Chip tone="warning" size="sm" icon="alertTriangle">
            {t('contracts.workspace.differs')}
          </Chip>
        )}
      </span>
      <span className="tiq-inline">
        <span className="tiq-text-muted">{t('contracts.workspace.nextDecision')}</span>
        {decision === null ? (
          <span>{t('contracts.decision.none')}</span>
        ) : (
          <>
            <strong>{t(`contracts.decision.${decision.kind}`)}</strong>
            {decision.dueAt !== null && (
              <OfficialDeadline deadline={decision.dueAt} showLocal={false} />
            )}
            {decision.detail !== null && <span className="tiq-text-muted">{decision.detail}</span>}
          </>
        )}
      </span>
    </span>
  );
}

export function ContractWorkspace({
  screen,
  primaryAction,
  actions,
  children,
}: ContractWorkspaceProps) {
  const contractId = useIdParam('contractId');
  const query = useApiQuery(
    contractsEndpoints.get,
    contractId === null ? null : { params: { contractId } },
  );
  const title = t(`contracts.screens.${screen}`);
  const back = { to: contractPaths.register, label: t('contracts.workspace.back') };

  if (contractId === null) {
    return (
      <>
        <PageHeader title={title} back={back} />
        <Banner tone="error" title={t('contracts.workspace.invalidId')} />
      </>
    );
  }

  const contract = query.data;
  if (contract === undefined) {
    return (
      <>
        <PageHeader title={title} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={6} />
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={contract.title}
        back={back}
        meta={<ContractMeta contract={contract} />}
        primaryAction={primaryAction?.(contract)}
        actions={actions?.(contract)}
      />
      <ContractTabs contractId={contract.id} />
      {contract.holds.map((hold) => (
        <Banner
          key={hold.holdId}
          tone="warning"
          title={t('contracts.workspace.hold', { type: tEnum('holds.hold_type', hold.holdType) })}
        >
          <p>{hold.reason}</p>
          <p>
            {t('contracts.workspace.holdBlocks', {
              actions: hold.blockedActions
                .map((action) => tEnum('holds.blocked_actions', action))
                .join(', '),
            })}
          </p>
        </Banner>
      ))}
      {contract.origin !== null && (
        <Banner tone="info" title={t('contracts.workspace.imported')}>
          {t('contracts.workspace.importedDetail', {
            origin: contract.origin,
            date:
              contract.originalBusinessDate === null
                ? t('contracts.common.unknown')
                : formatCalendarDate(contract.originalBusinessDate),
          })}
        </Banner>
      )}
      {children(contract)}
    </>
  );
}
