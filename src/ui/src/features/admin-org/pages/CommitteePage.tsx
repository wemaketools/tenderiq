/**
 * ADM-05 — Committee detail: purpose, quorum (and whether the active voting members reach it), chair, members,
 * alternates (substitutes) and secretary with effective dates, and the committee's authority limits. Add a member,
 * end a membership (refused when it would break the quorum) or deactivate the committee (it stays interpretable on
 * historical decisions).
 */
import { useState } from 'react';
import { useLocation } from 'react-router';

import { COMMITTEE_MEMBERS_MEMBER_ROLE } from '@contracts/enums';
import type { CommitteeMembersMemberRole } from '@contracts/enums';
import { orgAdminEndpoints } from '@contracts/org-admin';
import type { CommitteeDetail, CommitteeMemberRow } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  DetailList,
  EmptyState,
  MoneyText,
  PageHeader,
  QueryView,
  Select,
  useToast,
} from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { AccessStatusChip, PersonCell } from '../../admin-access/components/AccessBits';
import { MemberSelect } from '../../admin-access/components/Pickers';
import { dialogError } from '../../admin-access/lib/errors';
import { useIdParam, useOfficialTimeZone } from '../../admin-access/lib/hooks';
import { OrgLayout } from '../components/OrgLayout';
import { orgPaths } from '../lib/paths';
import { AUTHORITY_MANAGE } from '../lib/permissions';

type Open =
  | { readonly kind: 'add' }
  | { readonly kind: 'end'; readonly member: CommitteeMemberRow }
  | { readonly kind: 'deactivate' };

function AddMemberDialog({
  committee,
  onClose,
  onDone,
}: {
  readonly committee: CommitteeDetail;
  readonly onClose: () => void;
  readonly onDone: (next: CommitteeDetail) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const now = useNow();
  const add = useApiMutation(orgAdminEndpoints.addCommitteeMember);
  const [userId, setUserId] = useState('');
  const [memberRole, setMemberRole] = useState<CommitteeMembersMemberRole>('member');
  const [startsAt, setStartsAt] = useState<string | null>(() => new Date(now).toISOString());
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const inverted =
    startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-org.committees.addTitle')}
      scope={committee.name}
      consequence={t('admin-org.committees.addConsequence')}
      confirmLabel={t('admin-org.committees.add')}
      pending={add.pending}
      error={dialogError(add.error, ['userId', 'memberRole', 'startsAt', 'endsAt'])}
      onCancel={onClose}
      onConfirm={async () => {
        setChecked(true);
        if (userId === '' || startsAt === null || inverted) return;
        try {
          onDone(
            await add.mutate({
              params: { committeeId: committee.committeeId },
              body: { userId: Number(userId), memberRole, startsAt, endsAt },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <MemberSelect
        label={t('admin-org.committees.person')}
        value={userId}
        onChange={setUserId}
        exclude={committee.members
          .filter((member) => member.status !== 'expired' && member.status !== 'revoked')
          .map((member) => member.person.userId)}
        error={checked && userId === '' ? t('admin-access.common.personRequired') : undefined}
        required
      />
      <Select
        label={t('admin-org.committees.role')}
        value={memberRole}
        options={COMMITTEE_MEMBERS_MEMBER_ROLE.map((value) => ({
          value,
          label: tEnum('committee_members.member_role', value),
        }))}
        onChange={(value) => setMemberRole(value as CommitteeMembersMemberRole)}
        required
      />
      <DateTimeInput
        label={t('admin-org.authority.startsAt')}
        value={startsAt}
        onChange={setStartsAt}
        timeZone={timeZone}
        required
      />
      <DateTimeInput
        label={t('admin-org.authority.endsAt')}
        hint={t('admin-org.authority.effectiveToHint')}
        value={endsAt}
        onChange={setEndsAt}
        timeZone={timeZone}
        error={inverted ? t('admin-access.common.endAfterStart') : undefined}
      />
    </ConfirmActionDialog>
  );
}

function CommitteeView({ committee: loaded }: { readonly committee: CommitteeDetail }) {
  const timeZone = useOfficialTimeZone();
  const toast = useToast();
  const canManage = usePermission(AUTHORITY_MANAGE);
  const [committee, setCommittee] = useState(loaded);
  const [open, setOpen] = useState<Open | null>(null);
  const end = useApiMutation(orgAdminEndpoints.endCommitteeMember);
  const deactivate = useApiMutation(orgAdminEndpoints.deactivateCommittee);
  const manage = canManage && committee.active;
  const saved = (next: CommitteeDetail, message: string): void => {
    setCommittee(next);
    setOpen(null);
    toast.show(message, 'success');
  };
  return (
    <>
      <PageHeader
        title={committee.name}
        subtitle={tEnum('committees.purpose', committee.purpose)}
        back={{ to: orgPaths.authority, label: t('admin-org.authority.title') }}
        meta={
          <span className="tiq-inline">
            {committee.active ? (
              <Chip tone="success">{t('admin-access.common.active')}</Chip>
            ) : (
              <Chip tone="neutral-outlined">{t('admin-access.common.inactive')}</Chip>
            )}
            {committee.quorumMet ? (
              <Chip tone="success">{t('admin-org.committees.quorumMet')}</Chip>
            ) : (
              <Chip tone="danger">{t('admin-org.committees.quorumShort')}</Chip>
            )}
          </span>
        }
        primaryAction={
          manage ? (
            <Button variant="primary" icon="userPlus" onClick={() => setOpen({ kind: 'add' })}>
              {t('admin-org.committees.add')}
            </Button>
          ) : undefined
        }
        actions={
          manage ? (
            <Button
              variant="danger-soft"
              icon="ban"
              onClick={() => setOpen({ kind: 'deactivate' })}
            >
              {t('admin-org.committees.deactivate')}
            </Button>
          ) : undefined
        }
      />
      {!committee.quorumMet && committee.active && (
        <Banner tone="warning" title={t('admin-org.committees.quorumWarning')}>
          <p>
            {t('admin-org.committees.quorumWarningBody', {
              quorum: committee.quorum,
              members: committee.votingMemberCount,
            })}
          </p>
        </Banner>
      )}
      <Card title={t('admin-org.committees.summary')}>
        <DetailList
          items={[
            {
              key: 'purpose',
              label: t('admin-org.committees.purpose'),
              value: tEnum('committees.purpose', committee.purpose),
            },
            {
              key: 'quorum',
              label: t('admin-org.committees.quorum'),
              value: formatCount(committee.quorum),
            },
            {
              key: 'chair',
              label: t('admin-org.committees.chair'),
              value: committee.chair?.fullName ?? t('admin-org.committees.noChair'),
            },
            {
              key: 'members',
              label: t('admin-org.committees.members'),
              value: formatCount(committee.votingMemberCount),
            },
            {
              key: 'seats',
              label: t('admin-org.committees.activeSeats'),
              value: formatCount(committee.activeMemberCount),
            },
            {
              key: 'alternates',
              label: t('admin-org.committees.alternatesLabel'),
              value: formatCount(committee.alternateCount),
            },
            {
              key: 'entity',
              label: t('admin-org.authority.legalEntity'),
              value: committee.legalEntity?.name ?? t('admin-org.authority.allEntities'),
            },
            {
              key: 'deactivated',
              label: t('admin-org.committees.deactivatedAt'),
              value:
                committee.deactivatedAt === null
                  ? null
                  : formatInstantDate(committee.deactivatedAt, timeZone),
            },
          ]}
        />
      </Card>
      <Card title={t('admin-org.committees.membersTitle')} flush>
        <DataTable
          caption={t('admin-org.committees.membersTitle')}
          rows={committee.members}
          rowKey={(row) => String(row.memberId)}
          empty={<EmptyState compact title={t('admin-org.committees.noMembers')} />}
          columns={[
            {
              id: 'person',
              header: t('admin-org.committees.person'),
              cell: (row) => <PersonCell name={row.person.fullName} sub={row.capacity} />,
            },
            {
              id: 'role',
              header: t('admin-org.committees.role'),
              cell: (row) => tEnum('committee_members.member_role', row.memberRole),
            },
            {
              id: 'dates',
              header: t('admin-org.authority.col.dates'),
              cell: (row) => (
                <PersonCell
                  name={formatInstantDate(row.startsAt, timeZone)}
                  sub={
                    row.endsAt === null
                      ? t('admin-access.common.openEnded')
                      : t('admin-access.common.until', {
                          date: formatInstantDate(row.endsAt, timeZone),
                        })
                  }
                />
              ),
            },
            {
              id: 'status',
              header: t('admin-access.member.col.status'),
              cell: (row) => <AccessStatusChip status={row.status} />,
            },
            {
              id: 'actions',
              header: t('admin-access.common.actions'),
              cell: (row) =>
                manage && row.status !== 'expired' && row.status !== 'revoked' ? (
                  <div className="tiq-row-actions">
                    <Button size="sm" onClick={() => setOpen({ kind: 'end', member: row })}>
                      {t('admin-org.committees.endMember')}
                    </Button>
                  </div>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>
      <Card title={t('admin-org.committees.limitsTitle')} flush>
        <DataTable
          caption={t('admin-org.committees.limitsTitle')}
          rows={committee.authorityLimits}
          rowKey={(row) => String(row.limitId)}
          empty={<EmptyState compact title={t('admin-org.committees.noLimits')} />}
          columns={[
            {
              id: 'decision',
              header: t('admin-org.authority.col.decision'),
              cell: (row) => tEnum('authority_limits.decision_type', row.decisionType),
            },
            {
              id: 'max',
              header: t('admin-org.authority.col.max'),
              numeric: true,
              cell: (row) =>
                row.maxAmount === null ? (
                  t('admin-access.common.unlimited')
                ) : (
                  <MoneyText value={row.maxAmount} />
                ),
            },
            {
              id: 'effective',
              header: t('admin-org.authority.col.effective'),
              cell: (row) => (
                <PersonCell
                  name={formatInstantDate(row.effectiveFrom, timeZone)}
                  sub={
                    row.effectiveTo === null
                      ? t('admin-access.common.openEnded')
                      : t('admin-access.common.until', {
                          date: formatInstantDate(row.effectiveTo, timeZone),
                        })
                  }
                />
              ),
            },
            {
              id: 'status',
              header: t('admin-access.member.col.status'),
              cell: (row) => <AccessStatusChip status={row.status} />,
            },
          ]}
        />
      </Card>
      {open?.kind === 'add' && (
        <AddMemberDialog
          committee={committee}
          onClose={() => setOpen(null)}
          onDone={(next) => saved(next, t('admin-org.committees.added'))}
        />
      )}
      {open?.kind === 'end' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('admin-org.committees.endTitle')}
          scope={`${open.member.person.fullName} · ${committee.name}`}
          consequence={t('admin-org.committees.endConsequence')}
          confirmLabel={t('admin-org.committees.endMember')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          pending={end.pending}
          error={dialogError(end.error, [])}
          onCancel={() => {
            end.reset();
            setOpen(null);
          }}
          onConfirm={async ({ reason }) => {
            try {
              saved(
                await end.mutate({
                  params: { committeeId: committee.committeeId, memberId: open.member.memberId },
                  body: { reason },
                }),
                t('admin-org.committees.ended'),
              );
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
      {open?.kind === 'deactivate' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('admin-org.committees.deactivateTitle')}
          scope={committee.name}
          consequence={t('admin-org.committees.deactivateConsequence')}
          confirmLabel={t('admin-org.committees.deactivate')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          pending={deactivate.pending}
          error={dialogError(deactivate.error, [])}
          onCancel={() => {
            deactivate.reset();
            setOpen(null);
          }}
          onConfirm={async ({ reason }) => {
            try {
              saved(
                await deactivate.mutate({
                  params: { committeeId: committee.committeeId },
                  body: { reason },
                }),
                t('admin-org.committees.deactivated'),
              );
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </>
  );
}

export default function CommitteePage() {
  const committeeId = useIdParam('committeeId');
  const location = useLocation();
  const seeded = (location.state as { readonly record?: CommitteeDetail } | null)?.record;
  const fromCommand = seeded !== undefined && seeded.committeeId === committeeId ? seeded : null;
  const query = useApiQuery(
    orgAdminEndpoints.getCommittee,
    committeeId === null || fromCommand !== null ? null : { params: { committeeId } },
  );
  return (
    <OrgLayout>
      {committeeId === null ? (
        <EmptyState title={t('admin-org.committees.notFound')} />
      ) : fromCommand !== null ? (
        <CommitteeView committee={fromCommand} />
      ) : (
        <QueryView query={query}>
          {(committee) => <CommitteeView key={committee.committeeId} committee={committee} />}
        </QueryView>
      )}
    </OrgLayout>
  );
}
