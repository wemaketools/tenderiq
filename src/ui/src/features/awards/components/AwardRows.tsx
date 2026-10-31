/**
 * The award files of the register as work rows (docs/plan/design1 §5): tender and reference, the value labelled by
 * its basis (BR-31: never "awarded" before the final award), the next step with what qualifies it (standstill end,
 * holds, complaints), an explicit action for that step, and a disclosure that reveals the award progress
 * milestones built from the row's own fields.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import type { AwardRegisterRow } from '@contracts/awards';

import {
  ButtonLink,
  DisclosurePanel,
  DisclosureToggle,
  Icon,
  IconTile,
  Milestones,
  MoneyText,
  OfficialDeadline,
  Reference,
  StatusLabel,
} from '../../../components/ui';
import { WorkList, WorkRow } from '../../../components/ui/WorkRow';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { NEXT_STEP_TONE, nextStepLabel, valueBasisLabel } from '../lib/labels';
import { rowMilestones } from '../lib/milestones';
import { awardPaths } from '../lib/paths';
import { nextStepPath } from '../lib/stages';

function NextStep({ row }: { readonly row: AwardRegisterRow }) {
  const details: string[] = [];
  if (row.activeHoldCount > 0)
    details.push(t('awards.register.holds', { count: row.activeHoldCount }));
  if (row.openComplaintCount > 0) {
    details.push(t('awards.register.complaints', { count: row.openComplaintCount }));
  }
  return (
    <StatusLabel
      tone={NEXT_STEP_TONE[row.nextStep]}
      sub={
        row.standstillEndsAt !== null ? (
          <>
            {t('awards.register.standstillEnds')}{' '}
            <OfficialDeadline deadline={row.standstillEndsAt} showLocal={false} />
            {details.length > 0 && ` · ${details.join(' · ')}`}
          </>
        ) : details.length > 0 ? (
          details.join(' · ')
        ) : undefined
      }
    >
      {nextStepLabel(row.nextStep)}
    </StatusLabel>
  );
}

function AwardFileRow({
  row,
  timeZone,
}: {
  readonly row: AwardRegisterRow;
  readonly timeZone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `award-progress-${row.tender.tenderId}`;
  const lots =
    row.lotsWithOutcome === 0 && row.lotsWithProposedOutcome > 0
      ? t('awards.register.lotsProposedOf', {
          done: formatCount(row.lotsWithProposedOutcome),
          total: formatCount(row.lotCount),
        })
      : t('awards.register.lotsOf', {
          done: formatCount(row.lotsWithOutcome),
          total: formatCount(row.lotCount),
        });
  const progressLabel = t('awards.progress.label', { reference: row.tender.reference });
  const openLabel = t('awards.register.open', {
    reference: row.tender.reference,
    title: row.tender.title,
  });
  return (
    <WorkRow
      lead={<IconTile icon="award" />}
      title={row.tender.title}
      to={awardPaths.file(row.tender.tenderId)}
      openLabel={openLabel}
      status={<NextStep row={row} />}
      meta={[
        <Reference key="ref" value={row.tender.reference} />,
        lots,
        t('awards.register.owner', { name: row.owner.fullName }),
        t('awards.register.updated', { date: formatInstantDate(row.updatedAt, timeZone) }),
      ]}
      aside={
        <>
          <span className="tiq-row-aside--strong">
            {row.value === null ? (
              <span className="tiq-text-muted">{t('awards.register.noValue')}</span>
            ) : (
              <MoneyText value={row.value.total} />
            )}
          </span>
          {row.value !== null && <span>{valueBasisLabel(row.value.basis)}</span>}
          <ButtonLink to={nextStepPath(row)} variant="link" size="sm" iconAfter="arrowRight">
            {nextStepLabel(row.nextStep)}
          </ButtonLink>
        </>
      }
      trailing={
        <span className="tiq-inline tiq-award-row-controls">
          <DisclosureToggle
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            label={progressLabel}
            panelId={panelId}
          />
          <Link
            to={awardPaths.file(row.tender.tenderId)}
            className="tiq-row-arrow"
            aria-label={openLabel}
            title={openLabel}
          >
            <Icon name="arrowRight" />
          </Link>
        </span>
      }
    >
      {expanded && (
        <DisclosurePanel id={panelId} title={t('awards.progress.title')}>
          <Milestones items={rowMilestones(row)} label={progressLabel} />
        </DisclosurePanel>
      )}
    </WorkRow>
  );
}

export function AwardRows({
  rows,
  timeZone,
}: {
  readonly rows: readonly AwardRegisterRow[];
  readonly timeZone: string;
}) {
  return (
    <WorkList label={t('awards.register.rows')}>
      {rows.map((row) => (
        <AwardFileRow key={row.tender.tenderId} row={row} timeZone={timeZone} />
      ))}
    </WorkList>
  );
}
