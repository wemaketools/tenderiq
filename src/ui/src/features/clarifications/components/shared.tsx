/**
 * Presentational pieces shared by the buyer, supplier and public clarification screens.
 */
import type {
  ClarificationHistoryEntry,
  RequirementChange,
  SharedAnswer,
} from '@contracts/clarifications';

import { Chip, DataTable, EmptyState, StatusChip, Timeline } from '../../../components/ui';
import type { TimelineItem } from '../../../components/ui';
import { EMPTY_VALUE, formatDateTime, formatOfficialTime } from '../../../lib/format';
import { hasTranslation, t } from '../../../lib/i18n';

function humanize(action: string): string {
  const text = action.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The handling history of a question, addendum or session (audit-derived). */
export function ClarificationHistory({
  entries,
  timeZone,
}: {
  readonly entries: readonly ClarificationHistoryEntry[];
  readonly timeZone: string;
}) {
  if (entries.length === 0) {
    return <EmptyState compact icon="history" title={t('clarifications.history.empty')} />;
  }
  const items: TimelineItem[] = [...entries]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry, index) => {
      const key = `clarifications.history.${entry.action}`;
      return {
        id: `${entry.at}-${index}`,
        title: hasTranslation(key) ? t(key) : humanize(entry.action),
        meta: `${formatOfficialTime(entry.at, timeZone)} · ${
          entry.actor?.fullName ?? t('clarifications.history.system')
        }`,
        detail: entry.note ?? undefined,
        tone: 'accent' as const,
      };
    });
  return <Timeline label={t('clarifications.history.title')} items={items} />;
}

/** Scope, terms, submission and evaluation change flags. */
export function ChangeAreaChips({
  areas,
}: {
  readonly areas: {
    readonly changesScope: boolean;
    readonly changesTerms: boolean;
    readonly changesSubmission: boolean;
    readonly changesEvaluation: boolean;
  };
}) {
  const flags = [
    areas.changesScope ? 'scope' : null,
    areas.changesTerms ? 'terms' : null,
    areas.changesSubmission ? 'submission' : null,
    areas.changesEvaluation ? 'evaluation' : null,
  ].filter((value): value is string => value !== null);
  if (flags.length === 0) {
    return <span className="tiq-text-muted">{t('clarifications.changeAreas.none')}</span>;
  }
  return (
    <span className="tiq-inline">
      {flags.map((flag) => (
        <Chip key={flag} tone="info" size="sm">
          {t(`clarifications.changeAreas.${flag}`)}
        </Chip>
      ))}
    </span>
  );
}

function treatmentText(value: RequirementChange['newTreatment']) {
  return value === null ? null : (
    <StatusChip enum="requirements.treatment" value={value} size="sm" />
  );
}

/** Requirement changes of an addendum, before and after (BR-16). */
export function RequirementChangesTable({
  changes,
  lotLabel,
}: {
  readonly changes: readonly Omit<RequirementChange, 'id' | 'requirementId'>[];
  readonly lotLabel: (lotId: number | null) => string;
}) {
  return (
    <DataTable
      caption={t('clarifications.requirementChanges.caption')}
      rows={changes}
      rowKey={(row) => `${row.refCode}-${row.changeType}`}
      empty={<EmptyState compact title={t('clarifications.requirementChanges.empty')} />}
      columns={[
        {
          id: 'ref',
          header: t('clarifications.requirementChanges.requirement'),
          cell: (row) => (
            <>
              <span className="tiq-ref">{row.refCode}</span>
              <div className="tiq-cell-sub">{lotLabel(row.lotId)}</div>
            </>
          ),
        },
        {
          id: 'type',
          header: t('clarifications.requirementChanges.change'),
          cell: (row) => (
            <StatusChip enum="addendum_requirement_changes.change_type" value={row.changeType} />
          ),
        },
        {
          id: 'before',
          header: t('clarifications.requirementChanges.before'),
          cell: (row) => (
            <div className="tiq-stack">
              <span>{row.previousText ?? EMPTY_VALUE}</span>
              {treatmentText(row.previousTreatment)}
            </div>
          ),
        },
        {
          id: 'after',
          header: t('clarifications.requirementChanges.after'),
          cell: (row) => (
            <div className="tiq-stack">
              <span>{row.newText ?? EMPTY_VALUE}</span>
              {treatmentText(row.newTreatment)}
            </div>
          ),
        },
      ]}
    />
  );
}

/** Published, sanitized answers: never the questioner's identity (BR-14). */
export function SharedAnswerList({
  answers,
  timeZone,
  emptyTitle,
}: {
  readonly answers: readonly SharedAnswer[];
  readonly timeZone: string;
  readonly emptyTitle?: string;
}) {
  if (answers.length === 0) {
    return (
      <EmptyState
        compact
        icon="messageQuestion"
        title={emptyTitle ?? t('clarifications.answers.empty')}
      />
    );
  }
  return (
    <div
      className="tiq-stack tiq-stack--spaced"
      role="list"
      aria-label={t('clarifications.answers.title')}
    >
      {answers.map((answer) => (
        <article key={answer.questionId} className="tiq-card" role="listitem">
          <div className="tiq-stack">
            <div className="tiq-inline">
              <Chip tone={answer.audience === 'public' ? 'accent' : 'info'} size="sm">
                {t(`clarifications.audience.${answer.audience}`)}
              </Chip>
              {answer.lot !== null && (
                <Chip tone="neutral" size="sm">
                  {t('clarifications.common.lotLabel', {
                    no: answer.lot.lotNo,
                    title: answer.lot.title,
                  })}
                </Chip>
              )}
              {answer.requirement !== null && (
                <span className="tiq-ref">{answer.requirement.refCode}</span>
              )}
              {answer.sessionId !== null && (
                <Chip tone="neutral" size="sm" icon="mapPin">
                  {t('clarifications.answers.fromSession')}
                </Chip>
              )}
              <span className="tiq-text-muted">
                {t('clarifications.answers.publishedAt', {
                  at: formatDateTime(answer.publishedAt, timeZone),
                })}
              </span>
            </div>
            <p>
              <strong>{t('clarifications.answers.question')}</strong> {answer.sanitizedQuestion}
            </p>
            <p>
              <strong>{t('clarifications.answers.answer')}</strong> {answer.answerText}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
