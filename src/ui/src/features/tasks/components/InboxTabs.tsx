/**
 * The two views of the COM-04 inbox: tasks and approvals. Both are personal (`/me`) and span every active
 * membership (DD-21).
 */
import { LinkTabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { INBOX_PATHS } from '../lib/paths';

export function InboxTabs({
  taskCount,
  approvalCount,
}: {
  readonly taskCount?: number;
  readonly approvalCount?: number;
}) {
  return (
    <LinkTabs
      label={t('tasks.inbox.tabs')}
      tabs={[
        { to: INBOX_PATHS.tasks, label: t('tasks.inbox.tasksTab'), count: taskCount, end: true },
        {
          to: INBOX_PATHS.approvals,
          label: t('tasks.inbox.approvalsTab'),
          count: approvalCount,
          end: true,
        },
      ]}
    />
  );
}
