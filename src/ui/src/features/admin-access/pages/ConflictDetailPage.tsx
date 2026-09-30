/**
 * ADM-04 — Conflict declaration review (PRD §5.4, AC-02, DD-25): the declaration, the record and supplier
 * concerned, the declarant's supplier memberships (shown to the reviewer only), the restriction that blocks
 * restricted access while the review is pending, and the history. The reviewer records the disposition: cleared or
 * mitigated resume access; recused or reassigned keep it blocked (reassigned names who takes over). A reviewer
 * never decides their own declaration.
 */
import { useState } from 'react';

import { orgAdminEndpoints } from '@contracts/org-admin';
import type { ConflictDeclarationDetail, DecisionDisposition } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  RadioGroup,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import { formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { AccessStatusChip } from '../components/AccessBits';
import { MemberSelect } from '../components/Pickers';
import { dialogError } from '../lib/errors';
import { useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { buyerAccessPaths } from '../lib/paths';

function DecideDialog({
  declaration,
  onClose,
  onDecided,
}: {
  readonly declaration: ConflictDeclarationDetail;
  readonly onClose: () => void;
  readonly onDecided: (next: ConflictDeclarationDetail) => void;
}) {
  const decide = useApiMutation(orgAdminEndpoints.decideConflictDeclaration);
  const [disposition, setDisposition] = useState<DecisionDisposition | ''>('');
  const [reassignTo, setReassignTo] = useState('');
  const [checked, setChecked] = useState(false);
  const blocks = disposition === 'recused' || disposition === 'reassigned';
  return (
    <ConfirmActionDialog
      open
      tone={blocks ? 'danger' : 'primary'}
      title={t('admin-access.conflicts.decideTitle')}
      scope={t('admin-access.conflicts.decideScope', {
        name: declaration.declarant.fullName,
        subject: declaration.subject.reference ?? declaration.subject.title,
      })}
      consequence={
        disposition === ''
          ? t('admin-access.conflicts.decideChoose')
          : t(`admin-access.conflicts.consequence.${disposition}`)
      }
      confirmLabel={t('admin-access.conflicts.decide')}
      reason={{ label: t('admin-access.conflicts.reviewNote'), required: true }}
      pending={decide.pending}
      error={dialogError(decide.error, ['disposition', 'reassignToUserId'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (disposition === '' || (disposition === 'reassigned' && reassignTo === '')) return;
        try {
          const next = await decide.mutate({
            params: { declarationId: declaration.declarationId },
            body: {
              disposition,
              reviewNote: reason,
              reassignToUserId: disposition === 'reassigned' ? Number(reassignTo) : null,
            },
          });
          onDecided(next);
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <RadioGroup
        label={t('admin-access.conflicts.disposition')}
        value={disposition}
        onChange={(value) => setDisposition(value as DecisionDisposition)}
        options={declaration.allowedDispositions.map((value) => ({
          value,
          label: tEnum('conflict_declarations.disposition', value),
          hint: t(`admin-access.conflicts.consequence.${value}`),
        }))}
        error={
          checked && disposition === ''
            ? t('admin-access.conflicts.dispositionRequired')
            : undefined
        }
        required
      />
      {disposition === 'reassigned' && (
        <MemberSelect
          label={t('admin-access.conflicts.reassignTo')}
          value={reassignTo}
          onChange={setReassignTo}
          exclude={[declaration.declarant.userId]}
          error={checked && reassignTo === '' ? t('admin-access.common.personRequired') : undefined}
          required
        />
      )}
    </ConfirmActionDialog>
  );
}

function DeclarationView({
  declaration: loaded,
}: {
  readonly declaration: ConflictDeclarationDetail;
}) {
  const timeZone = useOfficialTimeZone();
  const toast = useToast();
  const [declaration, setDeclaration] = useState(loaded);
  const [deciding, setDeciding] = useState(false);
  const pending = declaration.disposition === 'pending_review';
  return (
    <>
      <PageHeader
        title={t('admin-access.conflicts.detailTitle', { name: declaration.declarant.fullName })}
        subtitle={declaration.subject.title}
        back={{ to: buyerAccessPaths.conflicts, label: t('admin-access.conflicts.title') }}
        meta={
          <span className="tiq-inline">
            {declaration.subject.reference !== null && (
              <span className="tiq-ref">{declaration.subject.reference}</span>
            )}
            <StatusChip enum="conflict_declarations.disposition" value={declaration.disposition} />
            {declaration.accessBlocked && (
              <Chip tone="danger" icon="lock">
                {t('admin-access.conflicts.blocked')}
              </Chip>
            )}
          </span>
        }
        primaryAction={
          declaration.allowedDispositions.length > 0 ? (
            <Button variant="primary" icon="gavel" onClick={() => setDeciding(true)}>
              {t('admin-access.conflicts.decide')}
            </Button>
          ) : undefined
        }
      />
      {pending && (
        <Banner tone="warning" title={t('admin-access.conflicts.pendingTitle')}>
          <p>
            {declaration.allowedDispositions.length > 0
              ? t('admin-access.conflicts.pendingBody')
              : t('admin-access.conflicts.pendingOwn')}
          </p>
        </Banner>
      )}
      {declaration.holdsSupplierMemberships && (
        <Banner tone="info" title={t('admin-access.conflicts.dualTitle')}>
          <p>{t('admin-access.conflicts.dualBody')}</p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-access.conflicts.declaration')}>
          <DetailList
            stacked
            items={[
              {
                key: 'declarant',
                label: t('admin-access.conflicts.col.declarant'),
                value: `${declaration.declarant.fullName}${declaration.capacity === null ? '' : ` (${declaration.capacity})`}`,
              },
              {
                key: 'subject',
                label: t('admin-access.conflicts.col.subject'),
                value: `${tEnum('conflict_declarations.subject_type', declaration.subject.subjectType)}: ${declaration.subject.reference ?? ''} ${declaration.subject.title}`,
              },
              {
                key: 'supplier',
                label: t('admin-access.conflicts.supplier'),
                value: declaration.supplierName,
              },
              {
                key: 'nature',
                label: t('admin-access.conflicts.col.nature'),
                value: declaration.hasConflict
                  ? declaration.nature === null
                    ? t('admin-access.conflicts.declared')
                    : tEnum('conflict_declarations.nature', declaration.nature)
                  : t('admin-access.conflicts.noConflict'),
              },
              {
                key: 'details',
                label: t('admin-access.conflicts.details'),
                value: declaration.details,
              },
              {
                key: 'declared',
                label: t('admin-access.conflicts.col.declared'),
                value: formatDateTime(declaration.declaredAt, timeZone),
              },
              {
                key: 'review',
                label: t('admin-access.conflicts.review'),
                value:
                  declaration.reviewedBy === null
                    ? null
                    : `${declaration.reviewedBy.fullName}${declaration.reviewedAt === null ? '' : `, ${formatInstantDate(declaration.reviewedAt, timeZone)}`}${declaration.reviewNote === null ? '' : ` — ${declaration.reviewNote}`}`,
              },
            ]}
          />
        </Card>
        <div className="tiq-stack">
          <Card
            title={t('admin-access.conflicts.supplierMemberships')}
            subtitle={t('admin-access.conflicts.supplierMembershipsIntro')}
            flush
          >
            <DataTable
              caption={t('admin-access.conflicts.supplierMemberships')}
              rows={declaration.supplierMemberships}
              rowKey={(row) => `${row.organizationName}-${row.capacity ?? ''}`}
              empty={
                <EmptyState compact title={t('admin-access.conflicts.noSupplierMemberships')} />
              }
              columns={[
                {
                  id: 'org',
                  header: t('admin-access.conflicts.col.organization'),
                  cell: (row) => row.organizationName,
                },
                {
                  id: 'capacity',
                  header: t('admin-access.invite.capacity'),
                  cell: (row) => row.capacity ?? '—',
                },
                {
                  id: 'status',
                  header: t('admin-access.member.col.status'),
                  cell: (row) => (
                    <StatusChip enum="memberships.status" value={row.status} size="sm" />
                  ),
                },
              ]}
            />
          </Card>
          <Card title={t('admin-access.conflicts.restriction')}>
            {declaration.restriction === null ? (
              <EmptyState compact title={t('admin-access.conflicts.noRestriction')} />
            ) : (
              <DetailList
                items={[
                  {
                    key: 'scope',
                    label: t('admin-access.member.col.scope'),
                    value: declaration.restriction.scope.scopeLabel,
                  },
                  {
                    key: 'status',
                    label: t('admin-access.member.col.status'),
                    value: <AccessStatusChip status={declaration.restriction.status} />,
                  },
                  {
                    key: 'since',
                    label: t('admin-access.grants.col.starts'),
                    value: formatInstantDate(declaration.restriction.startsAt, timeZone),
                  },
                  {
                    key: 'reason',
                    label: t('admin-access.restrictions.col.reason'),
                    value: declaration.restriction.reason,
                  },
                ]}
              />
            )}
          </Card>
        </div>
      </div>
      <Card title={t('admin-access.conflicts.history')}>
        {declaration.history.length === 0 ? (
          <EmptyState compact title={t('admin-access.conflicts.noHistory')} />
        ) : (
          <Timeline
            label={t('admin-access.conflicts.history')}
            items={declaration.history.map((entry, index) => ({
              id: `${entry.at}-${index}`,
              title: entry.action,
              meta: `${formatDateTime(entry.at, timeZone)} · ${entry.actor.fullName}`,
              detail: entry.note ?? undefined,
              tone: 'neutral',
            }))}
          />
        )}
      </Card>
      {deciding && (
        <DecideDialog
          declaration={declaration}
          onClose={() => setDeciding(false)}
          onDecided={(next) => {
            setDeclaration(next);
            setDeciding(false);
            toast.show(t('admin-access.conflicts.decided'), 'success');
          }}
        />
      )}
    </>
  );
}

export default function ConflictDetailPage() {
  const declarationId = useIdParam('declarationId');
  const query = useApiQuery(
    orgAdminEndpoints.getConflictDeclaration,
    declarationId === null ? null : { params: { declarationId } },
  );
  return (
    <AccessLayout>
      {declarationId === null ? (
        <EmptyState title={t('admin-access.conflicts.notFound')} />
      ) : (
        <QueryView query={query}>
          {(declaration) => (
            <DeclarationView key={declaration.declarationId} declaration={declaration} />
          )}
        </QueryView>
      )}
    </AccessLayout>
  );
}
