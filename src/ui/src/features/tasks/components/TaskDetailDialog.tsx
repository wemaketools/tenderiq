/**
 * The task drawer of COM-04: source record, owner, assignee or group, delegation, escalation, due date, priority,
 * the task history and the actions the caller may take. Only the caller's own task is shown (never unrelated task
 * details).
 */
import { getMyTask } from '@contracts/tasks';
import type { TaskAction, TaskDetail, TaskItem } from '@contracts/tasks';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  DetailList,
  Dialog,
  OrDash,
  OverdueChip,
  QueryView,
  Reference,
  StatusChip,
  Timeline,
} from '../../../components/ui';
import type { TimelineTone } from '../../../components/ui';
import { formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useDisplayTimeZone } from '../lib/shared';
import { sourceTypeLabel } from '../lib/labels';

const STATUS_TONE: Readonly<Record<TaskItem['status'], TimelineTone>> = {
  open: 'info',
  in_progress: 'accent',
  completed: 'success',
  returned: 'warning',
  cancelled: 'neutral',
  reassigned: 'info',
};

export interface TaskDetailDialogProps {
  readonly task: TaskItem;
  /** The result of the last command on this task (the prototype does not persist commands). */
  readonly result: TaskDetail | null;
  readonly onClose: () => void;
  readonly onAction: (action: TaskAction) => void;
}

export function TaskDetailDialog({ task, result, onClose, onAction }: TaskDetailDialogProps) {
  const timeZone = useDisplayTimeZone();
  const query = useApiQuery(getMyTask, { params: { taskId: task.id } });
  const shown = result ?? query.data;
  const actions = shown?.allowedActions ?? [];

  return (
    <Dialog
      open
      size="lg"
      title={task.title}
      description={t('tasks.detail.title')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('ui.action.close')}</Button>
          {actions.includes('reassign') && (
            <Button icon="users" onClick={() => onAction('reassign')}>
              {t('tasks.action.reassign')}
            </Button>
          )}
          {actions.includes('return') && (
            <Button icon="arrowLeft" onClick={() => onAction('return')}>
              {t('tasks.action.return')}
            </Button>
          )}
          {actions.includes('complete') && (
            <Button variant="primary" icon="check" onClick={() => onAction('complete')}>
              {t('tasks.action.complete')}
            </Button>
          )}
        </>
      }
    >
      <QueryView query={{ ...query, data: shown }}>
        {(detail) => (
          <div className="tiq-stack">
            {detail.allowedActions.length === 0 && (
              <Banner tone="info">{t('tasks.detail.noActions')}</Banner>
            )}
            {detail.allowedActions.length > 0 && !detail.allowedActions.includes('complete') && (
              <Banner tone="info">{t('tasks.detail.sourceCompleted')}</Banner>
            )}
            <DetailList
              items={[
                {
                  key: 'org',
                  label: t('tasks.detail.organization'),
                  value: detail.organization.tenantName,
                },
                {
                  key: 'type',
                  label: t('tasks.detail.type'),
                  value: tEnum('tasks.task_type', detail.taskType),
                },
                {
                  key: 'source',
                  label: t('tasks.detail.source'),
                  value: (
                    <span className="tiq-inline">
                      {detail.sourceReference !== null && (
                        <Reference value={detail.sourceReference} to={detail.sourceLinkPath} />
                      )}
                      <span className="tiq-text-muted">{sourceTypeLabel(detail.sourceType)}</span>
                    </span>
                  ),
                },
                {
                  key: 'owner',
                  label: t('tasks.detail.owner'),
                  value: detail.sourceOwner?.fullName ?? null,
                },
                {
                  key: 'assignee',
                  label: t('tasks.detail.assignee'),
                  value: detail.assignee?.fullName ?? null,
                },
                {
                  key: 'group',
                  label: t('tasks.detail.group'),
                  value: detail.assigneeGroup?.name ?? null,
                },
                {
                  key: 'delegated',
                  label: t('tasks.detail.delegatedFrom'),
                  value: detail.delegatedFrom?.fullName ?? null,
                },
                {
                  key: 'escalation',
                  label: t('tasks.detail.escalation'),
                  value: (detail.escalationUser ?? detail.escalationTo)?.fullName ?? null,
                },
                {
                  key: 'priority',
                  label: t('tasks.detail.priority'),
                  value: <StatusChip enum="tasks.priority" value={detail.priority} size="sm" />,
                },
                {
                  key: 'status',
                  label: t('tasks.detail.status'),
                  value: <StatusChip enum="tasks.status" value={detail.status} size="sm" />,
                },
                {
                  key: 'due',
                  label: t('tasks.detail.due'),
                  value:
                    detail.dueAt === null ? null : (
                      <span className="tiq-inline">
                        <span className={detail.isOverdue ? 'tiq-text-danger' : undefined}>
                          {formatOfficialTime(detail.dueAt, timeZone)}
                        </span>
                        {detail.isOverdue && <OverdueChip />}
                      </span>
                    ),
                },
                {
                  key: 'created',
                  label: t('tasks.detail.created'),
                  value: formatOfficialTime(detail.createdAt, timeZone),
                },
                {
                  key: 'description',
                  label: t('tasks.detail.description'),
                  value: detail.description,
                },
                {
                  key: 'completed',
                  label: t('tasks.detail.completed'),
                  value:
                    detail.completedAt === null ? null : (
                      <OrDash>
                        {t('tasks.detail.completedBy', {
                          time: formatOfficialTime(detail.completedAt, timeZone),
                          name: detail.completedBy?.fullName ?? t('tasks.detail.system'),
                        })}
                      </OrDash>
                    ),
                },
                { key: 'outcome', label: t('tasks.detail.outcome'), value: detail.outcomeNote },
              ]}
            />
            <h3 className="tiq-form-section-title">{t('tasks.detail.history')}</h3>
            {detail.history.length === 0 ? (
              <p className="tiq-text-muted">{t('tasks.detail.historyEmpty')}</p>
            ) : (
              <Timeline
                label={t('tasks.detail.history')}
                items={detail.history.map((event, index) => ({
                  id: `${event.at}-${index}`,
                  title: tEnum('tasks.status', event.status),
                  meta: [
                    formatOfficialTime(event.at, timeZone),
                    t('tasks.detail.historyBy', {
                      name: event.actor?.fullName ?? t('tasks.detail.system'),
                    }),
                  ].join(' · '),
                  detail: event.note ?? undefined,
                  tone: STATUS_TONE[event.status],
                }))}
              />
            )}
          </div>
        )}
      </QueryView>
    </Dialog>
  );
}
