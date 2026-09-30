/**
 * BUY-28 waiting period: the governing policy and calendar, each standstill period with its official end date and
 * extensions, the actions currently blocked, the holds that block them and each lot's final-award readiness
 * (FR-17, BR-32, AC-25). An extension is its own decision with a reason and a participant notice.
 */
import { useState } from 'react';

import { extendStandstill, getStandstill } from '@contracts/awards';
import type { StandstillOverview, StandstillPeriod } from '@contracts/awards';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  DetailList,
  EmptyState,
  OfficialDeadline,
  OrDash,
  QueryView,
  StatusChip,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { withAwardMessage } from '../lib/errors';
import { lotLabel, yesNo } from '../lib/labels';
import { awardPaths } from '../lib/paths';
import { GateChecklist } from './GateChecklist';
import { BlockedActions, HoldsCard } from './HoldsCard';

const EXTENDABLE = ['running', 'extended'];

export function StandstillPanel({ tenderId }: { readonly tenderId: number }) {
  const query = useApiQuery(getStandstill, { params: { tenderId } });
  return <QueryView query={query}>{(data) => <StandstillContent overview={data} />}</QueryView>;
}

function StandstillContent({ overview }: { readonly overview: StandstillOverview }) {
  const toast = useToast();
  const canIssue = usePermission('notice.issue');
  const extend = useApiMutation(extendStandstill);
  const [results, setResults] = useState<Readonly<Record<number, StandstillPeriod>>>({});
  const [target, setTarget] = useState<StandstillPeriod | null>(null);
  const [extendedTo, setExtendedTo] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const zone = overview.tender.officialTimeZone;
  const periods = overview.periods.map((period) => results[period.standstillId] ?? period);
  const extendErrors = formErrors(extend.error, ['extendedTo', 'notifyParticipants']);

  const confirmExtend = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (target === null) return;
    if (extendedTo === null) {
      setAttempted(true);
      return;
    }
    try {
      const result = await extend.mutate({
        params: { standstillId: target.standstillId },
        body: { extendedTo, reason: reason.trim(), notifyParticipants: notify },
      });
      setResults((current) => ({ ...current, [result.standstillId]: result }));
      setTarget(null);
      invalidateApiQueries('buyer.awards.get');
      toast.show(t('awards.standstill.extended'), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const columns: DataTableColumn<StandstillPeriod>[] = [
    {
      id: 'lot',
      header: t('awards.standstill.col.lot'),
      cell: (row) => (row.lot === null ? t('awards.common.allLots') : lotLabel(row.lot)),
    },
    {
      id: 'status',
      header: t('awards.standstill.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="standstill_periods.status" value={row.status} />
          {row.notApplicableReason !== null && (
            <span className="tiq-cell-sub">{row.notApplicableReason}</span>
          )}
        </>
      ),
    },
    {
      id: 'starts',
      header: t('awards.standstill.col.starts'),
      cell: (row) => <OfficialDeadline deadline={row.startsAt} showLocal={false} />,
    },
    {
      id: 'ends',
      header: t('awards.standstill.col.ends'),
      cell: (row) => <OfficialDeadline deadline={row.endsAt} showLocal={false} />,
    },
    {
      id: 'extended',
      header: t('awards.standstill.col.extended'),
      cell: (row) =>
        row.extendedTo === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <OfficialDeadline deadline={row.extendedTo} showLocal={false} />
            {row.extensionReason !== null && (
              <span className="tiq-cell-sub">{row.extensionReason}</span>
            )}
          </>
        ),
    },
    {
      id: 'effective',
      header: t('awards.standstill.col.effective'),
      cell: (row) => (
        <>
          <OfficialDeadline deadline={row.effectiveEndsAt} />
          <span className="tiq-cell-sub">
            {tEnum('policy_profile_versions.standstill_day_type', row.dayType)}
          </span>
        </>
      ),
    },
    {
      id: 'actions',
      header: t('awards.standstill.col.actions'),
      cell: (row) =>
        canIssue && EXTENDABLE.includes(row.status) ? (
          <Button
            size="sm"
            icon="calendar"
            onClick={() => {
              extend.reset();
              setExtendedTo(null);
              setNotify(true);
              setAttempted(false);
              setTarget(row);
            }}
          >
            {t('awards.standstill.extend')}
          </Button>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      {overview.blockedActions.length > 0 ? (
        <Banner tone="error" title={t('awards.standstill.blockedTitle')}>
          <BlockedActions actions={overview.blockedActions} />
        </Banner>
      ) : (
        <Banner tone="success" title={t('awards.standstill.nothingBlocked')}>
          {t('awards.standstill.nothingBlockedText')}
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <Card
          title={t('awards.standstill.periodsTitle')}
          subtitle={t('awards.standstill.periodsHint')}
          flush
        >
          <DataTable
            caption={t('awards.standstill.periodsTitle')}
            columns={columns}
            rows={periods}
            rowKey={(row) => String(row.standstillId)}
            empty={
              <EmptyState
                compact
                icon="hourglass"
                title={t('awards.standstill.empty')}
                description={t('awards.standstill.emptyHint')}
              />
            }
          />
        </Card>
        <Card title={t('awards.standstill.policyTitle')}>
          <DetailList
            stacked
            items={[
              { label: t('awards.standstill.policy'), value: overview.policy.policyLabel },
              {
                label: t('awards.standstill.required'),
                value: yesNo(overview.policy.standstillRequired),
              },
              {
                label: t('awards.standstill.length'),
                value: t('awards.standstill.lengthValue', {
                  count: overview.policy.standstillLength,
                  type: tEnum(
                    'policy_profile_versions.standstill_day_type',
                    overview.policy.standstillDayType,
                  ),
                }),
              },
              { label: t('awards.standstill.calendar'), value: overview.policy.calendarName },
              {
                label: t('awards.standstill.complaintWindow'),
                value: t('awards.standstill.days', { count: overview.policy.complaintWindowDays }),
              },
              { label: t('awards.standstill.zone'), value: zone },
            ]}
          />
        </Card>
      </div>
      <Card
        title={t('awards.standstill.readinessTitle')}
        subtitle={t('awards.standstill.readinessHint')}
      >
        {overview.lotReadiness.length === 0 ? (
          <p className="tiq-text-muted">{t('awards.standstill.noReadiness')}</p>
        ) : (
          <div className="tiq-grid tiq-grid--3">
            {overview.lotReadiness.map((row) => (
              <div key={row.lot.lotId} className="tiq-stack">
                <h3 className="tiq-form-section-title">{lotLabel(row.lot)}</h3>
                <GateChecklist
                  checks={row.checks}
                  label={t('awards.file.gateFor', { lot: lotLabel(row.lot) })}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
      <HoldsCard holds={overview.holds} timeZone={zone} complaintPath={awardPaths.complaint} />

      <ConfirmActionDialog
        open={target !== null}
        title={t('awards.standstill.extendTitle')}
        scope={
          target === null
            ? ''
            : `${overview.tender.reference} · ${target.lot === null ? t('awards.common.allLots') : lotLabel(target.lot)}`
        }
        consequence={t('awards.standstill.extendConsequence')}
        confirmLabel={t('awards.standstill.extend')}
        reason={{ label: t('awards.standstill.extendReason'), required: true }}
        pending={extend.pending}
        error={withAwardMessage(extend.error)}
        onCancel={() => setTarget(null)}
        onConfirm={confirmExtend}
      >
        {target !== null && (
          <p>
            {t('awards.standstill.currentEnd')}{' '}
            <OfficialDeadline deadline={target.effectiveEndsAt} />
          </p>
        )}
        <DateTimeInput
          label={t('awards.standstill.newEnd')}
          required
          timeZone={zone}
          value={extendedTo}
          error={
            extendErrors.forField('extendedTo') ??
            (attempted && extendedTo === null ? t('awards.standstill.newEndRequired') : undefined)
          }
          onChange={setExtendedTo}
        />
        <Checkbox
          label={t('awards.standstill.notify')}
          hint={t('awards.standstill.notifyHint')}
          checked={notify}
          onChange={setNotify}
        />
      </ConfirmActionDialog>
    </div>
  );
}
