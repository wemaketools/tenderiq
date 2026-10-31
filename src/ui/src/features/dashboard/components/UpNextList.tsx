/**
 * "Up next" (docs/plan/design1 §3): approvals and deadlines as work rows, soonest first. The right side says when
 * (Overdue / Today / Tomorrow in attention colours with their text, or the date) and a deadline always carries its
 * official time and zone (DD-33) under that line.
 */
import type { DashboardApproval, DashboardDeadline } from '@contracts/reporting';

import { Attention, IconTile, MoneyText, OfficialDeadline } from '../../../components/ui';
import { WorkList, WorkRow } from '../../../components/ui/WorkRow';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { relativeDay } from '../lib/upNext';
import type { RelativeDay, UpNextItem } from '../lib/upNext';

function WhenLabel({
  when,
  at,
  timeZone,
}: {
  readonly when: RelativeDay;
  readonly at: string;
  readonly timeZone: string;
}) {
  if (when === 'overdue') {
    return (
      <Attention tone="danger" icon="alertCircle">
        {t('dashboard.upNext.overdue')}
      </Attention>
    );
  }
  if (when === 'today') {
    return <Attention icon="clock">{t('dashboard.upNext.today')}</Attention>;
  }
  if (when === 'tomorrow') {
    return <span className="tiq-row-aside--strong">{t('dashboard.upNext.tomorrow')}</span>;
  }
  return <span>{formatInstantDate(at, timeZone)}</span>;
}

function ApprovalRow({
  approval,
  now,
  timeZone,
}: {
  readonly approval: DashboardApproval;
  readonly now: number;
  readonly timeZone: string;
}) {
  const when: RelativeDay | null =
    approval.dueAt === null
      ? null
      : approval.overdue
        ? 'overdue'
        : relativeDay(approval.dueAt, now, timeZone);
  return (
    <WorkRow
      lead={<IconTile icon="clipboardCheck" tone={approval.overdue ? 'danger' : 'warning'} />}
      title={approval.title}
      to={approval.to}
      openLabel={t('dashboard.upNext.open', { title: approval.title })}
      meta={[
        tEnum('approval_requests.subject_type', approval.subjectType),
        approval.amount === null ? null : <MoneyText value={approval.amount} />,
        t('dashboard.upNext.requestedBy', { name: approval.requestedBy.fullName }),
      ]}
      aside={
        when === null || approval.dueAt === null ? (
          <span>{t('dashboard.approvals.noDue')}</span>
        ) : (
          <WhenLabel when={when} at={approval.dueAt} timeZone={timeZone} />
        )
      }
    />
  );
}

function DeadlineRow({
  deadline,
  now,
}: {
  readonly deadline: DashboardDeadline;
  readonly now: number;
}) {
  const when = relativeDay(deadline.deadline.at, now, deadline.deadline.timeZone);
  return (
    <WorkRow
      lead={<IconTile icon="calendar" tone={when === 'today' ? 'warning' : 'accent'} />}
      title={
        deadline.lotLabel === null
          ? tEnum('tender_milestones.milestone', deadline.milestone)
          : t('dashboard.deadlines.milestoneLot', {
              milestone: tEnum('tender_milestones.milestone', deadline.milestone),
              lot: deadline.lotLabel,
            })
      }
      to={deadline.to}
      openLabel={t('dashboard.upNext.open', { title: `${deadline.reference} ${deadline.title}` })}
      meta={[
        `${deadline.reference} ${deadline.title}`,
        t('dashboard.deadlines.owner', { name: deadline.owner.fullName }),
      ]}
      aside={
        <>
          <WhenLabel when={when} at={deadline.deadline.at} timeZone={deadline.deadline.timeZone} />
          <OfficialDeadline deadline={deadline.deadline} showLocal={false} />
        </>
      }
    />
  );
}

export function UpNextList({
  items,
  now,
  timeZone,
}: {
  readonly items: readonly UpNextItem[];
  readonly now: number;
  readonly timeZone: string;
}) {
  return (
    <WorkList label={t('dashboard.upNext.title')}>
      {items.map((item) =>
        item.kind === 'approval' ? (
          <ApprovalRow key={item.id} approval={item.approval} now={now} timeZone={timeZone} />
        ) : (
          <DeadlineRow key={item.id} deadline={item.deadline} now={now} />
        ),
      )}
    </WorkList>
  );
}
