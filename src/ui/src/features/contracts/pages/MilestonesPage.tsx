/**
 * CON-06 — Milestones and acceptance: deliverables and milestones with acceptance criteria, official due dates,
 * inspection evidence, acceptance decisions and rejected work. Open a milestone to submit completion evidence,
 * inspect, accept or reject with remediation (AC-30).
 */
import { useState } from 'react';

import { usePermission } from '../../../auth/permissions';
import { Banner, Button } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { ObligationsPanel } from '../components/ObligationsPanel';
import { CONTRACT_MANAGE } from '../lib/permissions';

export default function MilestonesPage() {
  const canManage = usePermission(CONTRACT_MANAGE);
  const [creating, setCreating] = useState(false);
  return (
    <ContractWorkspace
      screen="CON-06"
      primaryAction={(contract) =>
        canManage && contract.status !== 'closed' ? (
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t('contracts.milestones.add')}
          </Button>
        ) : undefined
      }
    >
      {(contract) => (
        <div className="tiq-stack">
          <Banner tone="info" title={t('contracts.milestones.paymentRule')}>
            {t('contracts.milestones.paymentRuleDetail')}
          </Banner>
          <ObligationsPanel
            screen="CON-06"
            contractId={contract.id}
            contractReference={contract.reference}
            timeZone={contract.timeZone}
            currency={contract.value.currency}
            canManage={canManage && contract.status !== 'closed'}
            kinds={['milestone', 'deliverable']}
            creating={creating}
            onCreateClose={() => setCreating(false)}
          />
        </div>
      )}
    </ContractWorkspace>
  );
}
