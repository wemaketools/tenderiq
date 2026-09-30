/**
 * CON-04 — Procurement handover: final scope, winning commitments, negotiated exceptions, risks, obligations, pricing
 * of the WINNING offer only, milestones, outstanding conditions, contacts and supporting award evidence. Procurement
 * submits the package; the named contract manager accepts it or returns it with omissions. An incomplete handover
 * stays visible and blocks the procurement event closeout (AC-29). Losing bids are never included.
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { ContractDetail, ContractHandover } from '@contracts/contracts';

import { useApiQuery } from '../../../api/hooks';
import { useAppSelector } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  MoneyText,
  Reference,
  SkeletonBlock,
  StatusChip,
  TextArea,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { ChecksPanel, DeadlineText, InstantText, PersonName } from '../components/shared';
import { splitCommandError } from '../lib/errors';
import { useContractCommand } from '../lib/hooks';
import { optionalText } from '../lib/lists';
import { CONTRACT_MANAGE, CONTRACT_PREPARE } from '../lib/permissions';

type PriceLine = ContractHandover['pricing'][number];
type HandoverMilestone = ContractHandover['milestones'][number];

function Package({ handover }: { readonly handover: ContractHandover }) {
  const priceColumns: DataTableColumn<PriceLine>[] = [
    { id: 'item', header: t('contracts.handover.price.item'), cell: (row) => row.item },
    { id: 'unit', header: t('contracts.handover.price.unit'), cell: (row) => row.unit },
    {
      id: 'quantity',
      header: t('contracts.handover.price.quantity'),
      numeric: true,
      cell: (row) => formatDecimalString(row.quantity),
    },
    {
      id: 'rate',
      header: t('contracts.handover.price.rate'),
      numeric: true,
      cell: (row) => <MoneyText value={row.rate} />,
    },
    {
      id: 'total',
      header: t('contracts.handover.price.total'),
      numeric: true,
      cell: (row) => <MoneyText value={row.total} />,
    },
  ];
  const milestoneColumns: DataTableColumn<HandoverMilestone>[] = [
    { id: 'title', header: t('contracts.handover.ms.title'), cell: (row) => row.title },
    {
      id: 'due',
      header: t('contracts.handover.ms.due'),
      cell: (row) => <DeadlineText deadline={row.dueAt} />,
    },
    {
      id: 'amount',
      header: t('contracts.handover.ms.amount'),
      numeric: true,
      cell: (row) => <MoneyText value={row.amount} />,
    },
  ];
  return (
    <>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('contracts.handover.scopeTitle')}>
          <DetailList
            stacked
            items={[
              { label: t('contracts.handover.finalScope'), value: handover.finalScope },
              { label: t('contracts.handover.commitments'), value: handover.winningCommitments },
              { label: t('contracts.handover.exceptions'), value: handover.negotiatedExceptions },
              {
                label: t('contracts.handover.measures'),
                value: handover.performanceMeasuresSummary,
              },
            ]}
          />
        </Card>
        <Card title={t('contracts.handover.risksTitle')}>
          <DetailList
            stacked
            items={[
              { label: t('contracts.handover.risks'), value: handover.risks },
              { label: t('contracts.handover.conditions'), value: handover.outstandingConditions },
              { label: t('contracts.handover.renewalDates'), value: handover.renewalDatesSummary },
              {
                label: t('contracts.handover.securityExpiry'),
                value: handover.securityExpirySummary,
              },
              {
                label: t('contracts.handover.obligations'),
                value: t('contracts.handover.obligationsCount', {
                  count: handover.obligationsCount,
                }),
              },
            ]}
          />
        </Card>
      </div>
      <Card
        flush
        title={t('contracts.handover.pricing')}
        subtitle={t('contracts.handover.pricingHint')}
      >
        <DataTable
          caption={t('contracts.handover.pricing')}
          columns={priceColumns}
          rows={handover.pricing}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('contracts.handover.noPricing')} />}
        />
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card flush title={t('contracts.handover.milestones')}>
          <DataTable
            caption={t('contracts.handover.milestones')}
            columns={milestoneColumns}
            rows={handover.milestones}
            rowKey={(row) => String(row.obligationId)}
            empty={<EmptyState compact title={t('contracts.handover.noMilestones')} />}
          />
        </Card>
        <Card title={t('contracts.handover.contacts')}>
          {handover.keyContacts.length === 0 ? (
            <EmptyState compact title={t('contracts.overview.noContacts')} />
          ) : (
            <DetailList
              stacked
              items={handover.keyContacts.map((contact, index) => ({
                key: `${contact.party}-${index}`,
                label: `${tEnum('obligations.party', contact.party)} · ${contact.role}`,
                value: `${contact.name}${contact.email === null ? '' : ` · ${contact.email}`}${
                  contact.phone === null ? '' : ` · ${contact.phone}`
                }`,
              }))}
            />
          )}
        </Card>
      </div>
      <Card title={t('contracts.handover.evidence')}>
        {handover.awardEvidence.length === 0 ? (
          <EmptyState compact title={t('contracts.handover.noEvidence')} />
        ) : (
          <ul className="tiq-check-list">
            {handover.awardEvidence.map((document) => (
              <li key={document.documentId}>
                {document.title}
                {document.fileName !== null && (
                  <span className="tiq-cell-sub">{document.fileName}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

type DialogKind = 'submit' | 'accept' | 'return' | null;

function HandoverBody({ contract }: { readonly contract: ContractDetail }) {
  const myUserId = useAppSelector((state) => state.session.user?.id ?? null);
  const canPrepare = usePermission(CONTRACT_PREPARE);
  const canManage = usePermission(CONTRACT_MANAGE);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [note, setNote] = useState('');
  const [omissions, setOmissions] = useState('');
  const [omissionsError, setOmissionsError] = useState<string | undefined>(undefined);
  const query = useApiQuery(contractsEndpoints.handover, { params: { contractId: contract.id } });
  const submit = useContractCommand(contractsEndpoints.submitHandover, (r) => r.message);
  const accept = useContractCommand(contractsEndpoints.acceptHandover, (r) => r.message);
  const giveBack = useContractCommand(contractsEndpoints.returnHandover, (r) => r.message);
  const returnErrors = splitCommandError(giveBack.error, ['omissions']);
  const acceptErrors = splitCommandError(accept.error, ['note']);

  if (query.data === undefined) {
    if (query.error?.code === 'HANDOVER_NOT_APPLICABLE') {
      return (
        <EmptyState
          title={t('contracts.handover.notApplicable')}
          description={query.error.detail ?? undefined}
        />
      );
    }
    return query.error !== null ? (
      <ErrorState error={query.error} onRetry={query.reload} />
    ) : (
      <SkeletonBlock lines={6} />
    );
  }

  const handover = query.data;
  const isManager =
    handover.contractManager !== null && handover.contractManager.userId === myUserId;
  const close = (): void => {
    setDialog(null);
    setNote('');
    setOmissions('');
    setOmissionsError(undefined);
  };
  const scope = `${handover.reference} · ${contract.title}`;

  return (
    <div className="tiq-stack">
      <Banner
        tone={handover.closeoutGate.blocksEventCloseout ? 'warning' : 'success'}
        title={
          handover.closeoutGate.blocksEventCloseout
            ? t('contracts.handover.gateBlocks', {
                tender: handover.closeoutGate.tenderReference ?? t('contracts.common.none'),
              })
            : t('contracts.handover.gateClear')
        }
      >
        {handover.closeoutGate.detail}
      </Banner>
      {handover.status === 'returned' && handover.omissions !== null && (
        <Banner tone="error" title={t('contracts.handover.returnedWith')}>
          {handover.omissions}
        </Banner>
      )}
      <Card
        title={t('contracts.handover.statusTitle')}
        actions={
          <span className="tiq-inline">
            {canPrepare && (handover.status === 'draft' || handover.status === 'returned') && (
              <Button
                variant="primary"
                icon="send"
                onClick={() => {
                  submit.reset();
                  setDialog('submit');
                }}
              >
                {t('contracts.handover.submit')}
              </Button>
            )}
            {canManage && handover.status === 'submitted' && (
              <>
                <Button
                  onClick={() => {
                    giveBack.reset();
                    setDialog('return');
                  }}
                  disabled={!isManager}
                >
                  {t('contracts.handover.return')}
                </Button>
                <Button
                  variant="primary"
                  icon="checkCircle"
                  onClick={() => {
                    accept.reset();
                    setDialog('accept');
                  }}
                  disabled={!isManager}
                >
                  {t('contracts.handover.accept')}
                </Button>
              </>
            )}
          </span>
        }
      >
        <DetailList
          items={[
            {
              label: t('contracts.handover.status'),
              value: <StatusChip enum="handovers.status" value={handover.status} />,
            },
            {
              label: t('contracts.handover.tender'),
              value:
                handover.tender === null ? null : <Reference value={handover.tender.reference} />,
            },
            { label: t('contracts.handover.supplier'), value: handover.supplier.name },
            {
              label: t('contracts.handover.manager'),
              value: <PersonName person={handover.contractManager} />,
            },
            {
              label: t('contracts.handover.submittedBy'),
              value: <PersonName person={handover.submittedBy} />,
            },
            {
              label: t('contracts.handover.submittedAt'),
              value: <InstantText at={handover.submittedAt} timeZone={contract.timeZone} />,
            },
            {
              label: t('contracts.handover.acceptedAt'),
              value: <InstantText at={handover.acceptedAt} timeZone={contract.timeZone} />,
            },
            {
              label: t('contracts.handover.returnedAt'),
              value: <InstantText at={handover.returnedAt} timeZone={contract.timeZone} />,
            },
          ]}
        />
        {canManage && handover.status === 'submitted' && !isManager && (
          <p className="tiq-text-muted">{t('contracts.handover.onlyManager')}</p>
        )}
        <ChecksPanel checks={handover.checks} label={t('contracts.handover.checks')} />
      </Card>
      <Banner tone="info" title={t('contracts.handover.excludes')}>
        {t('contracts.handover.excludesDetail')}
      </Banner>
      <Package handover={handover} />
      <ConfirmActionDialog
        open={dialog === 'submit'}
        title={t('contracts.handover.submitTitle')}
        scope={scope}
        consequence={t('contracts.handover.submitConsequence')}
        confirmLabel={t('contracts.handover.submit')}
        onConfirm={async () => {
          const result = await submit.run({ params: { contractId: contract.id } });
          if (result !== null) close();
        }}
        onCancel={close}
        pending={submit.pending}
        error={submit.error}
      >
        <ChecksPanel checks={handover.checks} label={t('contracts.handover.checks')} />
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={dialog === 'accept'}
        title={t('contracts.handover.acceptTitle')}
        scope={scope}
        consequence={t('contracts.handover.acceptConsequence')}
        confirmLabel={t('contracts.handover.accept')}
        onConfirm={async () => {
          const text = optionalText(note);
          const result = await accept.run({
            params: { contractId: contract.id },
            body: text === undefined ? {} : { note: text },
          });
          if (result !== null) close();
        }}
        onCancel={close}
        pending={accept.pending}
        error={acceptErrors.dialogError}
      >
        <TextArea
          label={t('contracts.common.note')}
          value={note}
          onChange={setNote}
          rows={2}
          error={acceptErrors.fieldErrors.forField('note')}
        />
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={dialog === 'return'}
        tone="danger"
        title={t('contracts.handover.returnTitle')}
        scope={scope}
        consequence={t('contracts.handover.returnConsequence')}
        confirmLabel={t('contracts.handover.return')}
        onConfirm={async () => {
          if (omissions.trim() === '') {
            setOmissionsError(t('contracts.handover.omissionsRequired'));
            return;
          }
          const result = await giveBack.run({
            params: { contractId: contract.id },
            body: { omissions: omissions.trim() },
          });
          if (result !== null) close();
        }}
        onCancel={close}
        pending={giveBack.pending}
        error={returnErrors.dialogError}
      >
        <TextArea
          label={t('contracts.handover.omissions')}
          hint={t('contracts.handover.omissionsHint')}
          required
          value={omissions}
          onChange={(value) => {
            setOmissions(value);
            setOmissionsError(undefined);
          }}
          error={omissionsError ?? returnErrors.fieldErrors.forField('omissions')}
        />
      </ConfirmActionDialog>
    </div>
  );
}

export default function HandoverPage() {
  return (
    <ContractWorkspace screen="CON-04">
      {(contract) => <HandoverBody contract={contract} />}
    </ContractWorkspace>
  );
}
