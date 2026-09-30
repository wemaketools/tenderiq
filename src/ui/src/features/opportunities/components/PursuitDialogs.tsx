/**
 * SUP-09 dialogs: record the PRIVATE bid/no-bid decision, share the bid intent with the buyer (the only way the
 * buyer-visible intent changes, DD-41), and add or edit a bid-team member.
 */
import { useState } from 'react';

import { PURSUIT_TEAM_MEMBERS_RESPONSIBILITY } from '@contracts/enums';
import type { PursuitTeamMembersResponsibility } from '@contracts/enums';
import { publicationEndpoints } from '@contracts/publication';
import type {
  BuyerVisibleIntent,
  PursuitDetail,
  PursuitTeamMember,
  PursuitView,
  TeamCandidate,
} from '@contracts/publication';

import { useApiMutation } from '../../../api/hooks';
import {
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  MultiSelect,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { fieldMessage, withPublicationMessage } from '../../publication/lib/errors';

type Tender = PursuitView['tender'];

function scopeOf(tender: Tender): string {
  return `${tender.reference} ${tender.title}`;
}

// ---------------------------------------------------------------------------------------------------------
// Private decision
// ---------------------------------------------------------------------------------------------------------

export interface DecisionDialogProps {
  readonly open: boolean;
  readonly tender: Tender;
  readonly current: PursuitDetail['decision'];
  readonly onClose: () => void;
  readonly onDone: (pursuit: PursuitDetail) => void;
}

export function DecisionDialog({ open, tender, current, onClose, onDone }: DecisionDialogProps) {
  const decide = useApiMutation(publicationEndpoints.decidePursuit);
  const [decision, setDecision] = useState<PursuitDetail['decision']>(
    current === 'undecided' ? 'bid' : current,
  );
  return (
    <ConfirmActionDialog
      open={open}
      tone={decision === 'no_bid' ? 'danger' : 'primary'}
      title={t('opportunities.pursuit.decisionTitle')}
      scope={scopeOf(tender)}
      consequence={t('opportunities.pursuit.decisionConsequence')}
      confirmLabel={t('opportunities.pursuit.recordDecision')}
      reason={{ label: t('opportunities.pursuit.rationale'), required: true }}
      onCancel={() => {
        decide.reset();
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        try {
          const pursuit = await decide.mutate({
            params: { tenderId: tender.tenderId },
            body: { decision, internalRationale: reason },
          });
          decide.reset();
          onDone(pursuit);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={decide.pending}
      error={withPublicationMessage(decide.error)}
    >
      <RadioGroup
        label={t('opportunities.pursuit.decision')}
        value={decision}
        onChange={(value) =>
          setDecision(value === 'no_bid' ? 'no_bid' : value === 'undecided' ? 'undecided' : 'bid')
        }
        options={(['bid', 'no_bid', 'undecided'] as const).map((value) => ({
          value,
          label: tEnum('pursuits.decision', value),
        }))}
      />
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Notify buyer (DD-41)
// ---------------------------------------------------------------------------------------------------------

export interface NotifyBuyerDialogProps {
  readonly open: boolean;
  readonly tender: Tender;
  readonly buyerName: string;
  readonly suggested: BuyerVisibleIntent['bidIntent'];
  readonly onClose: () => void;
  readonly onDone: (intent: BuyerVisibleIntent) => void;
}

export function NotifyBuyerDialog({
  open,
  tender,
  buyerName,
  suggested,
  onClose,
  onDone,
}: NotifyBuyerDialogProps) {
  const notify = useApiMutation(publicationEndpoints.notifyBuyer);
  const [intent, setIntent] = useState<BuyerVisibleIntent['bidIntent']>(suggested);
  const [share, setShare] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const sharing = intent === 'no_bid' && share;
  const reasonMissing = sharing && reason.trim() === '';

  const close = (): void => {
    notify.reset();
    setShare(false);
    setReason('');
    setTouched(false);
    onClose();
  };

  return (
    <ConfirmActionDialog
      open={open}
      title={t('opportunities.pursuit.notifyTitle')}
      scope={scopeOf(tender)}
      consequence={
        sharing
          ? t('opportunities.pursuit.notifyConsequenceReason', {
              buyer: buyerName,
              intent: tEnum('participants.bid_intent', intent),
            })
          : t('opportunities.pursuit.notifyConsequence', {
              buyer: buyerName,
              intent: tEnum('participants.bid_intent', intent),
            })
      }
      confirmLabel={t('opportunities.pursuit.notify')}
      onCancel={close}
      onConfirm={async () => {
        setTouched(true);
        if (reasonMissing) return;
        try {
          const result = await notify.mutate({
            params: { tenderId: tender.tenderId },
            body: sharing
              ? { bidIntent: intent, sharedNoBidReason: reason.trim() }
              : { bidIntent: intent },
          });
          close();
          onDone(result);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={notify.pending}
      error={withPublicationMessage(notify.error, ['sharedNoBidReason'])}
    >
      <RadioGroup
        label={t('opportunities.pursuit.intent')}
        value={intent}
        onChange={(value) =>
          setIntent(
            value === 'no_bid' ? 'no_bid' : value === 'undecided' ? 'undecided' : 'intends_to_bid',
          )
        }
        options={(['intends_to_bid', 'no_bid', 'undecided'] as const).map((value) => ({
          value,
          label: tEnum('participants.bid_intent', value),
        }))}
      />
      {intent === 'no_bid' && (
        <>
          <Checkbox
            label={t('opportunities.pursuit.shareReason')}
            hint={t('opportunities.pursuit.shareReasonHint')}
            checked={share}
            onChange={setShare}
          />
          {share && (
            <TextArea
              label={t('opportunities.pursuit.sharedReason')}
              required
              rows={3}
              value={reason}
              onChange={setReason}
              error={
                fieldMessage(notify.error, 'sharedNoBidReason') ??
                (touched && reasonMissing
                  ? t('opportunities.pursuit.sharedReasonRequired')
                  : undefined)
              }
            />
          )}
        </>
      )}
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Team member
// ---------------------------------------------------------------------------------------------------------

export interface TeamMemberDialogProps {
  readonly open: boolean;
  readonly tender: Tender;
  readonly timeZone: string;
  readonly lots: PursuitView['lots'];
  readonly candidates: readonly TeamCandidate[];
  /** The member to edit, or null to add one. */
  readonly member: PursuitTeamMember | null;
  readonly existingUserIds: readonly number[];
  readonly onClose: () => void;
  readonly onDone: (member: PursuitTeamMember) => void;
}

export function TeamMemberDialog({
  open,
  tender,
  timeZone,
  lots,
  candidates,
  member,
  existingUserIds,
  onClose,
  onDone,
}: TeamMemberDialogProps) {
  const add = useApiMutation(publicationEndpoints.addTeamMember);
  const update = useApiMutation(publicationEndpoints.updateTeamMember);
  const [userId, setUserId] = useState(member === null ? '' : String(member.user.userId));
  const [responsibility, setResponsibility] = useState<PursuitTeamMembersResponsibility>(
    member?.responsibility ?? 'contributor',
  );
  const [sections, setSections] = useState((member?.sectionScope ?? []).join(', '));
  const [lotIds, setLotIds] = useState<string[]>((member?.lotIds ?? []).map(String));
  const [dueAt, setDueAt] = useState<string | null>(member?.dueAt ?? null);
  const [pricing, setPricing] = useState(member?.canViewPricing ?? false);
  const [touched, setTouched] = useState(false);
  const mutation = member === null ? add : update;
  const candidate = candidates.find((item) => String(item.user.userId) === userId);
  const pricingAllowed =
    member !== null
      ? (candidate?.canViewPricing ?? member.canViewPricing)
      : (candidate?.canViewPricing ?? false);
  const userMissing = member === null && candidate === undefined;

  const close = (): void => {
    add.reset();
    update.reset();
    onClose();
  };

  const sectionScope = sections
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  return (
    <ConfirmActionDialog
      open={open}
      title={member === null ? t('opportunities.team.addTitle') : t('opportunities.team.editTitle')}
      scope={`${scopeOf(tender)} · ${candidate?.user.fullName ?? member?.user.fullName ?? t('opportunities.team.chooseMember')}`}
      consequence={t('opportunities.team.consequence')}
      confirmLabel={member === null ? t('opportunities.team.add') : t('opportunities.team.save')}
      onCancel={close}
      onConfirm={async () => {
        setTouched(true);
        if (userMissing) return;
        const body = {
          responsibility,
          sectionScope,
          lotIds: lotIds.map(Number),
          dueAt,
          canViewPricing: pricing && pricingAllowed,
        };
        try {
          const saved =
            member === null
              ? await add.mutate({
                  params: { tenderId: tender.tenderId },
                  body: { ...body, userId: Number(userId) },
                })
              : await update.mutate({
                  params: { tenderId: tender.tenderId, memberId: member.id },
                  body,
                });
          close();
          onDone(saved);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={mutation.pending}
      error={withPublicationMessage(mutation.error, [
        'userId',
        'responsibility',
        'sectionScope',
        'lotIds',
        'dueAt',
      ])}
    >
      {member === null && (
        <Select
          label={t('opportunities.team.member')}
          required
          placeholder={t('opportunities.team.chooseMember')}
          value={userId}
          onChange={setUserId}
          options={candidates.map((item) => ({
            value: String(item.user.userId),
            label: `${item.user.fullName}${item.capacity === null ? '' : ` (${item.capacity})`}`,
            disabled: existingUserIds.includes(item.user.userId),
          }))}
          error={
            fieldMessage(mutation.error, 'userId') ??
            (touched && userMissing ? t('opportunities.team.memberRequired') : undefined)
          }
          hint={candidate === undefined ? undefined : candidate.roleNames.join(', ')}
        />
      )}
      <Select
        label={t('opportunities.team.responsibility')}
        required
        value={responsibility}
        onChange={(value) => {
          const next = PURSUIT_TEAM_MEMBERS_RESPONSIBILITY.find((item) => item === value);
          if (next !== undefined) setResponsibility(next);
        }}
        options={PURSUIT_TEAM_MEMBERS_RESPONSIBILITY.map((value) => ({
          value,
          label: tEnum('pursuit_team_members.responsibility', value),
        }))}
        error={fieldMessage(mutation.error, 'responsibility')}
      />
      <TextField
        label={t('opportunities.team.sections')}
        hint={t('opportunities.team.sectionsHint')}
        value={sections}
        onChange={setSections}
        error={fieldMessage(mutation.error, 'sectionScope')}
      />
      {lots.length > 0 && (
        <MultiSelect
          label={t('opportunities.team.lots')}
          value={lotIds}
          onChange={setLotIds}
          options={lots.map((lot) => ({
            value: String(lot.lotId),
            label: `${t('publication.common.lotNo', { no: lot.lotNo })} ${lot.title}`,
          }))}
          error={fieldMessage(mutation.error, 'lotIds')}
        />
      )}
      <DateTimeInput
        label={t('opportunities.team.dueAt')}
        value={dueAt}
        onChange={setDueAt}
        timeZone={timeZone}
        error={fieldMessage(mutation.error, 'dueAt')}
      />
      <Checkbox
        label={t('opportunities.team.pricing')}
        hint={
          pricingAllowed
            ? t('opportunities.team.pricingHint')
            : t('opportunities.team.pricingNotAllowed')
        }
        checked={pricing && pricingAllowed}
        disabled={!pricingAllowed}
        onChange={setPricing}
      />
    </ConfirmActionDialog>
  );
}
