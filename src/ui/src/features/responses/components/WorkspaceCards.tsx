/**
 * Cards of the response workspace overview (SUP-12): lot selection, the response team and the issued addenda.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import { updateBidLots } from '@contracts/bids';
import type { BidAddendum, BidDetail, BidLotOption, BidTeamMember } from '@contracts/bids';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  EmptyState,
  OfficialDeadline,
  StatusChip,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { responseErrorMessage } from '../lib/errors';

// ---------------------------------------------------------------------------------------------------------
// Lot selection
// ---------------------------------------------------------------------------------------------------------

export interface LotSelectionCardProps {
  readonly bid: BidDetail;
  readonly editable: boolean;
  readonly revisionId: number | null;
  readonly onSaved: () => void;
}

export function LotSelectionCard({ bid, editable, revisionId, onSaved }: LotSelectionCardProps) {
  const toast = useToast();
  const initial = bid.lotOptions.filter((lot) => lot.selected).map((lot) => lot.lotId);
  const [selected, setSelected] = useState<number[]>(initial);
  const save = useApiMutation(updateBidLots);
  const dirty =
    selected.length !== initial.length || selected.some((lotId) => !initial.includes(lotId));
  const canEdit = editable && bid.viewer.canEditResponse && revisionId !== null;

  const toggle = (lot: BidLotOption, checked: boolean): void => {
    setSelected((current) =>
      checked ? [...current, lot.lotId] : current.filter((lotId) => lotId !== lot.lotId),
    );
  };

  const submit = async (): Promise<void> => {
    if (revisionId === null) return;
    try {
      await save.mutate({ params: { bidId: bid.id }, body: { revisionId, lotIds: selected } });
      toast.show(t('responses.lots.saved'), 'success');
      onSaved();
    } catch {
      // The error is shown in the card.
    }
  };

  return (
    <Card
      title={t('responses.lots.title')}
      subtitle={
        bid.partialBidsAllowed
          ? t('responses.lots.partialAllowed', {
              max: bid.maxLotsPerSupplier ?? bid.lotOptions.length,
            })
          : t('responses.lots.allLotsRequired')
      }
      footer={
        canEdit ? (
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || selected.length === 0}
            loading={save.pending}
            onClick={() => void submit()}
          >
            {t('responses.lots.save')}
          </Button>
        ) : undefined
      }
    >
      <UnsavedChangesGuard when={dirty} />
      <div className="tiq-stack">
        {bid.lotOptions.map((lot) => (
          <div key={lot.lotId} className="tiq-stack">
            <Checkbox
              label={t('responses.lots.option', { no: lot.lotNo, title: lot.title })}
              checked={selected.includes(lot.lotId)}
              disabled={!canEdit || !lot.eligible}
              onChange={(checked) => toggle(lot, checked)}
              hint={lot.ineligibleReason ?? lot.description ?? undefined}
            />
            <span className="tiq-inline tiq-text-muted">
              <StatusChip enum="lots.stage" value={lot.stage} size="sm" />
              <OfficialDeadline deadline={lot.deadline} showLocal={false} />
            </span>
          </div>
        ))}
      </div>
      {selected.length === 0 && canEdit && (
        <p className="tiq-field-error">{t('responses.lots.noneSelected')}</p>
      )}
      {save.error !== null && (
        <Banner tone="error" title={t('responses.lots.saveFailed')}>
          <p>{responseErrorMessage(save.error)}</p>
        </Banner>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------------------------------------

export function TeamCard({ team }: { readonly team: readonly BidTeamMember[] }) {
  const columns: DataTableColumn<BidTeamMember>[] = [
    {
      id: 'name',
      header: t('responses.team.col.name'),
      cell: (row) => (
        <>
          <span>{row.fullName}</span>
          <span className="tiq-cell-sub">{row.capacity ?? ''}</span>
        </>
      ),
    },
    {
      id: 'responsibility',
      header: t('responses.team.col.responsibility'),
      cell: (row) => tEnum('pursuit_team_members.responsibility', row.responsibility),
    },
    {
      id: 'rights',
      header: t('responses.team.col.rights'),
      cell: (row) => (
        <span className="tiq-inline">
          {row.canViewPricing && <Chip tone="info">{t('responses.team.pricing')}</Chip>}
          {row.canApprove && <Chip tone="accent">{t('responses.team.approve')}</Chip>}
          {row.canSubmit && <Chip tone="success">{t('responses.team.submit')}</Chip>}
        </span>
      ),
    },
  ];
  return (
    <Card title={t('responses.team.title')} subtitle={t('responses.team.subtitle')} flush>
      <DataTable
        caption={t('responses.team.title')}
        columns={columns}
        rows={team}
        rowKey={(row) => String(row.userId)}
        empty={<EmptyState compact title={t('responses.team.empty')} />}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Addenda
// ---------------------------------------------------------------------------------------------------------

export function AddendaCard({
  addenda,
  timeZone,
}: {
  readonly addenda: readonly BidAddendum[];
  readonly timeZone: string;
}) {
  return (
    <Card title={t('responses.addenda.title')} subtitle={t('responses.addenda.subtitle')}>
      {addenda.length === 0 ? (
        <EmptyState compact title={t('responses.addenda.empty')} />
      ) : (
        <ul className="tiq-stack" aria-label={t('responses.addenda.title')}>
          {addenda.map((addendum) => (
            <li key={addendum.addendumId} className="tiq-stack">
              <span className="tiq-inline">
                <strong>
                  {t('responses.addenda.item', { no: addendum.number, title: addendum.title })}
                </strong>
                {addendum.material && (
                  <Chip tone="warning" size="sm">
                    {t('responses.addenda.material')}
                  </Chip>
                )}
                {addendum.acknowledged ? (
                  <Chip tone="success" size="sm">
                    {t('responses.addenda.acknowledged')}
                  </Chip>
                ) : (
                  <Chip tone="danger" size="sm">
                    {t('responses.addenda.notAcknowledged')}
                  </Chip>
                )}
              </span>
              <span className="tiq-text-muted">
                {t('responses.addenda.meta', {
                  issued: formatDateTime(addendum.issuedAt, timeZone),
                  version: addendum.resultingVersionNo,
                  action: tEnum(
                    'addenda.existing_submission_action',
                    addendum.existingSubmissionAction,
                  ),
                })}
              </span>
              {addendum.acknowledged ? (
                <span className="tiq-text-muted">
                  {t('responses.addenda.ackBy', {
                    name: addendum.acknowledgedBy?.fullName ?? '',
                    time:
                      addendum.acknowledgedAt === null
                        ? ''
                        : formatDateTime(addendum.acknowledgedAt, timeZone),
                  })}
                </span>
              ) : (
                <Link to={addendum.link}>{t('responses.addenda.acknowledge')}</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
