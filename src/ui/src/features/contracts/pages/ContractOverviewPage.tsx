/**
 * CON-05 — Contract overview and obligations: agreed scope, parties, contacts, commitments, insurance, licenses,
 * securities, dates, owners and status; assign and track obligations, submit and review evidence, escalate overdue
 * commitments (FR-19).
 */
import { useState } from 'react';

import type { ContractDetail } from '@contracts/contracts';

import { usePermission } from '../../../auth/permissions';
import { Button, Card, DetailList, EmptyState, MoneyText, Reference } from '../../../components/ui';
import { formatCalendarDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AssignOwnersDialog } from '../components/AssignOwnersDialog';
import { AllocationsTable, SecuritiesTable } from '../components/ContractTables';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { ObligationsPanel } from '../components/ObligationsPanel';
import { DateText, InstantText, MilestoneTrack } from '../components/shared';
import { CONTRACT_MANAGE, CONTRACT_MANAGE_OR_PREPARE } from '../lib/permissions';

function ContractFacts({ contract }: { readonly contract: ContractDetail }) {
  return (
    <DetailList
      items={[
        { label: t('contracts.overview.supplier'), value: contract.supplier.name },
        {
          label: t('contracts.overview.legalEntity'),
          value:
            contract.legalEntity.registrationNumber === null
              ? contract.legalEntity.name
              : `${contract.legalEntity.name} (${contract.legalEntity.registrationNumber})`,
        },
        {
          label: t('contracts.overview.tender'),
          value:
            contract.tender === null ? null : (
              <>
                <Reference value={contract.tender.reference} /> {contract.tender.title}
              </>
            ),
        },
        { label: t('contracts.overview.owner'), value: contract.owner?.fullName },
        { label: t('contracts.overview.manager'), value: contract.contractManager?.fullName },
        { label: t('contracts.overview.value'), value: <MoneyText value={contract.value} /> },
        {
          label: t('contracts.overview.currentValue'),
          value: <MoneyText value={contract.currentValue} />,
        },
        { label: t('contracts.overview.ceiling'), value: <MoneyText value={contract.ceiling} /> },
        {
          label: t('contracts.overview.remaining'),
          value: <MoneyText value={contract.remainingCeiling} />,
        },
        {
          label: t('contracts.overview.term'),
          value:
            contract.termStart === null && contract.termEnd === null
              ? null
              : `${contract.termStart === null ? '…' : formatCalendarDate(contract.termStart)} – ${
                  contract.termEnd === null ? '…' : formatCalendarDate(contract.termEnd)
                }`,
        },
        {
          label: t('contracts.overview.effective'),
          value: <DateText date={contract.effectiveDate} />,
        },
        {
          label: t('contracts.overview.signed'),
          value: <InstantText at={contract.signedAt} timeZone={contract.timeZone} />,
        },
        {
          label: t('contracts.overview.paymentTerms'),
          value: contract.paymentTerms,
        },
        { label: t('contracts.overview.locations'), value: contract.serviceLocations },
        { label: t('contracts.overview.options'), value: contract.optionsSummary },
        { label: t('contracts.overview.securitiesSummary'), value: contract.securitiesSummary },
      ]}
    />
  );
}

export default function ContractOverviewPage() {
  const canManage = usePermission(CONTRACT_MANAGE);
  const canAssign = usePermission(CONTRACT_MANAGE_OR_PREPARE);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  return (
    <ContractWorkspace
      screen="CON-05"
      primaryAction={(contract) =>
        canManage && contract.status !== 'closed' ? (
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t('contracts.obligations.add')}
          </Button>
        ) : undefined
      }
      actions={(contract) =>
        canAssign && contract.status !== 'closed' ? (
          <Button icon="userPlus" onClick={() => setAssigning(true)}>
            {t('contracts.assign.title')}
          </Button>
        ) : undefined
      }
    >
      {(contract) => (
        <div className="tiq-stack">
          <Card title={t('contracts.milestone.label')} subtitle={t('contracts.signature.separate')}>
            <MilestoneTrack milestones={contract.milestones} timeZone={contract.timeZone} />
          </Card>
          <div className="tiq-grid tiq-grid--sidebar">
            <Card title={t('contracts.overview.agreement')}>
              <div className="tiq-stack">
                <p>{contract.scope === '' ? t('contracts.overview.noScope') : contract.scope}</p>
                <ContractFacts contract={contract} />
              </div>
            </Card>
            <div className="tiq-stack">
              <Card title={t('contracts.overview.contacts')}>
                {contract.contacts.length === 0 ? (
                  <EmptyState compact title={t('contracts.overview.noContacts')} />
                ) : (
                  <DetailList
                    stacked
                    items={contract.contacts.map((contact, index) => ({
                      key: `${contact.party}-${index}`,
                      label: `${tEnum('obligations.party', contact.party)} · ${contact.role}`,
                      value: (
                        <>
                          <span>{contact.name}</span>
                          <span className="tiq-cell-sub">
                            {[contact.email, contact.phone]
                              .filter((part) => part !== null)
                              .join(' · ')}
                          </span>
                        </>
                      ),
                    }))}
                  />
                )}
              </Card>
            </div>
          </div>
          <Card flush title={t('contracts.overview.allocations')}>
            <AllocationsTable allocations={contract.allocations} />
          </Card>
          <Card
            flush
            title={t('contracts.securities.title')}
            subtitle={t('contracts.securities.hint')}
          >
            <SecuritiesTable contract={contract} canRelease={canManage} />
          </Card>
          <ObligationsPanel
            screen="CON-05"
            contractId={contract.id}
            contractReference={contract.reference}
            timeZone={contract.timeZone}
            currency={contract.value.currency}
            canManage={canManage && contract.status !== 'closed'}
            kinds={['obligation', 'milestone', 'deliverable']}
            creating={creating}
            onCreateClose={() => setCreating(false)}
          />
          {assigning && (
            <AssignOwnersDialog contract={contract} open onClose={() => setAssigning(false)} />
          )}
        </div>
      )}
    </ContractWorkspace>
  );
}
