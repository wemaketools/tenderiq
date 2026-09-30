/**
 * The three task commands of COM-04 (complete, return, reassign within authority). Each is confirmed with the
 * task's organization and the caller's capacity there (COM-02, DD-21) and runs with that organization as
 * `X-Tenant-Id`.
 */
import { useState } from 'react';

import {
  completeMyTask,
  listReassignCandidates,
  reassignMyTask,
  returnMyTask,
} from '@contracts/tasks';
import type { TaskAction, TaskDetail, TaskItem } from '@contracts/tasks';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  ConfirmActionDialog,
  Select,
  SkeletonBlock,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { errorMessage, localizeError, useRowOrganization } from '../lib/shared';

export interface TaskActionDialogProps {
  readonly task: TaskItem;
  readonly action: TaskAction;
  readonly onClose: () => void;
  readonly onDone: (result: TaskDetail) => void;
}

function scopeOf(task: TaskItem): string {
  return task.sourceReference === null
    ? t('tasks.action.scopeNoReference', { title: task.title })
    : t('tasks.action.scope', { title: task.title, reference: task.sourceReference });
}

export function TaskActionDialog({ task, action, onClose, onDone }: TaskActionDialogProps) {
  const rowOrganization = useRowOrganization();
  const organization = rowOrganization(task.organization);
  const toast = useToast();
  const complete = useApiMutation(completeMyTask);
  const giveBack = useApiMutation(returnMyTask);
  const reassign = useApiMutation(reassignMyTask);
  const [assignee, setAssignee] = useState('');
  const [missingAssignee, setMissingAssignee] = useState(false);
  const candidates = useApiQuery(
    listReassignCandidates,
    action === 'reassign' ? { params: { taskId: task.id } } : null,
  );
  const options = { tenantId: task.organization.tenantId };

  if (action === 'complete') {
    return (
      <ConfirmActionDialog
        open
        title={t('tasks.action.completeTitle')}
        scope={scopeOf(task)}
        consequence={t('tasks.action.completeConsequence')}
        confirmLabel={t('tasks.action.complete')}
        organization={organization}
        reason={{ label: t('tasks.action.completeReason'), required: false }}
        pending={complete.pending}
        error={localizeError(complete.error, 'tasks')}
        onCancel={onClose}
        onConfirm={async ({ reason }) => {
          const result = await complete
            .mutate(
              { params: { taskId: task.id }, body: reason === '' ? {} : { outcomeNote: reason } },
              options,
            )
            .catch(() => null);
          if (result !== null) {
            toast.show(t('tasks.action.completed'), 'success');
            onDone(result);
          }
        }}
      />
    );
  }

  if (action === 'return') {
    return (
      <ConfirmActionDialog
        open
        title={t('tasks.action.returnTitle')}
        scope={scopeOf(task)}
        consequence={t('tasks.action.returnConsequence')}
        confirmLabel={t('tasks.action.return')}
        tone="danger"
        organization={organization}
        reason={{ label: t('tasks.action.returnReason'), required: true }}
        pending={giveBack.pending}
        error={localizeError(giveBack.error, 'tasks')}
        onCancel={onClose}
        onConfirm={async ({ reason }) => {
          const result = await giveBack
            .mutate({ params: { taskId: task.id }, body: { reason } }, options)
            .catch(() => null);
          if (result !== null) {
            toast.show(t('tasks.action.returned'), 'success');
            onDone(result);
          }
        }}
      />
    );
  }

  const items = candidates.data?.items ?? [];
  const chosen = items.find((item) => String(item.userId) === assignee);
  const assigneeError =
    reassign.error?.fieldErrors.find((item) => item.field === 'assigneeUserId')?.message ??
    (missingAssignee && chosen === undefined ? t('tasks.action.assigneeRequired') : undefined);
  return (
    <ConfirmActionDialog
      open
      title={t('tasks.action.reassignTitle')}
      scope={scopeOf(task)}
      consequence={t('tasks.action.reassignConsequence')}
      confirmLabel={t('tasks.action.reassign')}
      organization={organization}
      reason={{ label: t('tasks.action.reassignReason'), required: true }}
      pending={reassign.pending}
      error={localizeError(reassign.error, 'tasks')}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        if (chosen === undefined) {
          setMissingAssignee(true);
          return;
        }
        const result = await reassign
          .mutate(
            { params: { taskId: task.id }, body: { assigneeUserId: chosen.userId, reason } },
            options,
          )
          .catch(() => null);
        if (result !== null) {
          toast.show(t('tasks.action.reassigned', { name: chosen.fullName }), 'success');
          onDone(result);
        }
      }}
    >
      {candidates.data === undefined && candidates.error === null && (
        <div aria-label={t('tasks.action.candidatesLoading')}>
          <SkeletonBlock lines={1} />
        </div>
      )}
      {candidates.error !== null && (
        <Banner tone="error">{errorMessage(candidates.error, 'tasks')}</Banner>
      )}
      {candidates.data !== undefined && items.length === 0 && (
        <Banner tone="warning">{t('tasks.action.noCandidates')}</Banner>
      )}
      {items.length > 0 && (
        <Select
          label={t('tasks.action.reassignTo')}
          required
          placeholder={t('tasks.action.chooseColleague')}
          value={assignee}
          error={assigneeError}
          options={items.map((item) => ({
            value: String(item.userId),
            label:
              item.capacity === null
                ? t('tasks.action.candidateNoCapacity', {
                    name: item.fullName,
                    count: item.openTasks,
                  })
                : t('tasks.action.candidateLine', {
                    name: item.fullName,
                    capacity: item.capacity,
                    count: item.openTasks,
                  }),
          }))}
          onChange={setAssignee}
        />
      )}
    </ConfirmActionDialog>
  );
}
