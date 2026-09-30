/**
 * Leaver handling (AC-04, BR-38): the deactivation review lists open work to reassign, delegations and grants that
 * end, tender assignments, and the history that stays attributed; deactivation needs every formal work item
 * reassigned and both confirmations. "Reassign work" moves open responsibilities to other active members at any
 * time. Submitted bids, approvals and contracts are never withdrawn by these commands.
 */
import { useState } from 'react';

import type {
  DeactivationReview,
  LifecycleResult,
  MemberDetail,
  WorkItem,
} from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  OfficialDeadline,
  OverdueChip,
  QueryView,
  Select,
} from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';

type Assignments = Readonly<Record<number, string>>;

function WorkItemLine({ item }: { readonly item: WorkItem }) {
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  return (
    <span className="tiq-stack">
      <span>
        {item.reference !== null && <span className="tiq-ref">{item.reference} </span>}
        {item.title}
      </span>
      <span className="tiq-cell-sub tiq-inline">
        {t(`admin-access.workKind.${item.kind}`)}
        {item.dueAt !== null && (
          <OfficialDeadline deadline={{ at: item.dueAt, timeZone }} showLocal={false} />
        )}
        {item.isOverdue && <OverdueChip />}
      </span>
    </span>
  );
}

function ReassignmentFields({
  items,
  candidates,
  value,
  onChange,
  showMissing,
}: {
  readonly items: readonly WorkItem[];
  readonly candidates: readonly { userId: number; fullName: string; capacity: string | null }[];
  readonly value: Assignments;
  readonly onChange: (value: Assignments) => void;
  readonly showMissing: boolean;
}) {
  const options = candidates.map((person) => ({
    value: String(person.userId),
    label: person.capacity === null ? person.fullName : `${person.fullName} (${person.capacity})`,
  }));
  return (
    <ul className="tiq-stack" aria-label={t('admin-access.work.listLabel')}>
      {items.map((item) => (
        <li key={item.workItemId} className="tiq-stack">
          <WorkItemLine item={item} />
          <Select
            label={t('admin-access.work.reassignTo', { title: item.title })}
            value={value[item.workItemId] ?? ''}
            onChange={(next) => onChange({ ...value, [item.workItemId]: next })}
            options={options}
            placeholder={
              item.requiresReassignment
                ? t('admin-access.common.choosePerson')
                : t('admin-access.work.mayLapse')
            }
            required={item.requiresReassignment}
            error={
              showMissing && item.requiresReassignment && (value[item.workItemId] ?? '') === ''
                ? t('admin-access.work.required')
                : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}

function reassignmentsOf(value: Assignments) {
  return Object.entries(value)
    .filter(([, userId]) => userId !== '')
    .map(([workItemId, userId]) => ({ workItemId: Number(workItemId), toUserId: Number(userId) }));
}

function ReviewSummary({ review }: { readonly review: DeactivationReview }) {
  return (
    <>
      {review.blockers.length > 0 && (
        <Banner tone="error" title={t('admin-access.deactivate.blockers')}>
          <ul>
            {review.blockers.map((blocker) => (
              <li key={blocker.code}>{blocker.message}</li>
            ))}
          </ul>
        </Banner>
      )}
      <DetailList
        items={[
          {
            key: 'work',
            label: t('admin-access.deactivate.openWork'),
            value: formatCount(review.openWork.length),
          },
          {
            key: 'delegations',
            label: t('admin-access.deactivate.delegations'),
            value: t('admin-access.deactivate.delegationsValue', {
              given: review.delegationsGiven.length,
              received: review.delegationsReceived.length,
            }),
          },
          {
            key: 'grants',
            label: t('admin-access.deactivate.grants'),
            value: formatCount(review.activeGrants.length),
          },
          {
            key: 'roles',
            label: t('admin-access.deactivate.roles'),
            value: formatCount(review.activeRoleAssignments),
          },
          {
            key: 'assignments',
            label: t('admin-access.deactivate.tenderAssignments'),
            value:
              review.tenderAssignments.length === 0
                ? null
                : review.tenderAssignments
                    .map(
                      (row) =>
                        `${row.tender.reference} (${tEnum('pursuit_team_members.responsibility', row.responsibility)})`,
                    )
                    .join(', '),
          },
          {
            key: 'history',
            label: t('admin-access.deactivate.history'),
            value: t('admin-access.deactivate.historyValue', {
              count: review.attributedHistory.length,
            }),
          },
        ]}
      />
      {[...review.delegationsGiven, ...review.delegationsReceived].length > 0 && (
        <ul className="tiq-stack" aria-label={t('admin-access.deactivate.delegations')}>
          {[...review.delegationsGiven, ...review.delegationsReceived].map((delegation) => (
            <li key={delegation.delegationId} className="tiq-cell-sub">
              {t('admin-access.deactivate.delegationLine', {
                from: delegation.delegator.fullName,
                to: delegation.delegate.fullName,
                decisions: delegation.decisionTypes.length,
              })}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function DeactivateDialog({
  member,
  onClose,
  onDone,
}: {
  readonly member: MemberDetail;
  readonly onClose: () => void;
  /** `endedAt`: when access ended (live roles, grants and delegations end then). */
  readonly onDone: (result: LifecycleResult, endedAt: string) => void;
}) {
  const { endpoints } = useMemberAdmin();
  const review = useApiQuery(endpoints.getDeactivationReview, {
    params: { userId: member.userId },
  });
  const deactivate = useApiMutation(endpoints.deactivateMember);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [delegationsReviewed, setDelegationsReviewed] = useState(false);
  const [checked, setChecked] = useState(false);
  const data = review.data;
  const missing =
    data?.openWork.some(
      (item) => item.requiresReassignment && (assignments[item.workItemId] ?? '') === '',
    ) ?? true;
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-access.deactivate.title', { name: member.fullName })}
      scope={t('admin-access.deactivate.scope', { name: member.fullName })}
      consequence={t('admin-access.deactivate.consequence')}
      confirmLabel={t('admin-access.deactivate.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      acknowledgement={t('admin-access.deactivate.confirmHistory')}
      pending={deactivate.pending}
      error={dialogError(deactivate.error, ['reassignments', 'confirmDelegationsReviewed'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (data === undefined || missing || !delegationsReviewed) return;
        try {
          const result = await deactivate.mutate({
            params: { userId: member.userId },
            body: {
              reason,
              reassignments: reassignmentsOf(assignments),
              confirmDelegationsReviewed: true,
              confirmHistoryRetained: true,
            },
          });
          onDone(result, new Date().toISOString());
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <QueryView query={review}>
        {(loaded) => (
          <div className="tiq-stack">
            <ReviewSummary review={loaded} />
            {loaded.openWork.length > 0 && (
              <fieldset className="tiq-fieldset">
                <legend>{t('admin-access.deactivate.reassign')}</legend>
                <ReassignmentFields
                  items={loaded.openWork}
                  candidates={loaded.candidates}
                  value={assignments}
                  onChange={setAssignments}
                  showMissing={checked}
                />
              </fieldset>
            )}
            <Checkbox
              label={t('admin-access.deactivate.confirmDelegations')}
              checked={delegationsReviewed}
              onChange={setDelegationsReviewed}
              error={
                checked && !delegationsReviewed
                  ? t('admin-access.deactivate.confirmDelegationsRequired')
                  : undefined
              }
            />
          </div>
        )}
      </QueryView>
    </ConfirmActionDialog>
  );
}

export function ReassignWorkDialog({
  member,
  onClose,
  onDone,
}: {
  readonly member: MemberDetail;
  readonly onClose: () => void;
  /** `workItemIds`: the items that moved to other members. */
  readonly onDone: (result: LifecycleResult, workItemIds: readonly number[]) => void;
}) {
  const { endpoints } = useMemberAdmin();
  const candidates = useApiQuery(endpoints.listMembers, {
    query: { status: ['active'], sort: 'fullName', pageSize: 100 },
  });
  const reassign = useApiMutation(endpoints.reassignWork);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [checked, setChecked] = useState(false);
  const chosen = reassignmentsOf(assignments);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.reassign.title', { name: member.fullName })}
      scope={t('admin-access.reassign.scope', { count: member.openWork.length })}
      consequence={t('admin-access.reassign.consequence')}
      confirmLabel={t('admin-access.reassign.confirm')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={reassign.pending}
      error={dialogError(reassign.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (chosen.length === 0) return;
        try {
          const result = await reassign.mutate({
            params: { userId: member.userId },
            body: { reason, reassignments: chosen },
          });
          onDone(
            result,
            chosen.map((item) => item.workItemId),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      {checked && chosen.length === 0 && (
        <Banner tone="warning" title={t('admin-access.reassign.chooseOne')} />
      )}
      <ReassignmentFields
        items={member.openWork}
        candidates={(candidates.data?.items ?? [])
          .filter((row) => row.userId !== member.userId)
          .map((row) => ({ userId: row.userId, fullName: row.fullName, capacity: row.capacity }))}
        value={assignments}
        onChange={setAssignments}
        showMissing={false}
      />
    </ConfirmActionDialog>
  );
}
