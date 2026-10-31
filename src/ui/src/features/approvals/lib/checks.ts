/**
 * The checks and the route of an approval as the workspace shows them (docs/plan/design1 §4). Every "done" check
 * comes from data that establishes it (the authority check, the declared conflict position, the independence rule,
 * the version comparison); a gate or blocker the API reports is shown as failed with its explanation. Nothing is
 * assumed to pass.
 */
import type { ApprovalBlocker, ApprovalDetail } from '@contracts/approvals';

import type { CheckItem, CheckState, PathNode } from '../../../components/ui';
import { formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';

/** Blockers the specific checks already explain. */
const EXPLAINED: readonly ApprovalBlocker[] = [
  'version_changed',
  'authority_insufficient',
  'conflict_declaration_required',
  'conflict_unresolved',
  'sod_blocked',
  'subject_gate_blocked',
];

function stateLabel(state: CheckState): string {
  return t(`approvals.checks.state.${state}`);
}

function check(id: string, state: CheckState, label: string, detail?: string): CheckItem {
  return {
    id,
    state,
    label,
    stateLabel: stateLabel(state),
    ...(detail === undefined ? {} : { detail }),
  };
}

/**
 * The checks of the record (version, gates) and, for a decider, of the caller's position (authority, conflict,
 * independence, delegation, conversion) plus any other blocker the API reports.
 */
export function decisionChecks(approval: ApprovalDetail, decider: boolean): CheckItem[] {
  const items: CheckItem[] = [];
  const blockers = approval.myStep?.blockers ?? [];
  const current = approval.currentSubjectVersion ?? approval.subjectVersion;
  if (blockers.includes('version_changed') || current !== approval.subjectVersion) {
    items.push(
      check(
        'version',
        'danger',
        t('approvals.readiness.versionChanged', { current, version: approval.subjectVersion }),
      ),
    );
  } else {
    items.push(
      check('version', 'done', t('approvals.checks.version', { version: approval.subjectVersion })),
    );
  }

  const gates = approval.subjectGates ?? [];
  if (gates.length > 0) {
    for (const gate of gates) {
      items.push(check(`gate-${gate.code}`, 'danger', t('approvals.readiness.gate'), gate.detail));
    }
  } else if (blockers.includes('subject_gate_blocked')) {
    items.push(check('gate', 'danger', t('approvals.blocker.subject_gate_blocked')));
  }

  if (!decider) {
    return items;
  }

  const authority = approval.authority;
  if (blockers.includes('authority_insufficient') || authority?.sufficient === false) {
    items.push(check('authority', 'danger', t('approvals.blocker.authority_insufficient')));
  } else if (
    blockers.includes('exchange_rate_missing') ||
    authority?.missingExchangeRate === true
  ) {
    items.push(check('authority', 'danger', t('approvals.blocker.exchange_rate_missing')));
  } else if (authority !== null && authority.amount !== null) {
    items.push(
      check(
        'authority',
        'done',
        authority.limit === null
          ? t('approvals.readiness.authorityOk', { amount: formatMoney(authority.amount) })
          : t('approvals.checks.withinLimit', { limit: formatMoney(authority.limit) }),
      ),
    );
  } else if (authority !== null) {
    items.push(check('authority', 'done', t('approvals.readiness.authorityNone')));
  }
  if (authority?.conversion !== null && authority?.conversion !== undefined) {
    items.push(check('conversion', 'warning', t('approvals.readiness.conversion')));
  }
  if (approval.myStep?.actingFor !== null && approval.myStep?.actingFor !== undefined) {
    items.push(
      check(
        'delegation',
        'warning',
        t('approvals.readiness.actingFor', { name: approval.myStep.actingFor.fullName }),
      ),
    );
  }

  const conflictBlocker = blockers.find(
    (code) => code === 'conflict_declaration_required' || code === 'conflict_unresolved',
  );
  const conflict = approval.conflict;
  if (conflictBlocker !== undefined || conflict.blocksDecision) {
    items.push(
      check(
        'conflict',
        'danger',
        t(`approvals.blocker.${conflictBlocker ?? 'conflict_unresolved'}`),
      ),
    );
  } else if (conflict.declared && conflict.hasConflict === false) {
    items.push(check('conflict', 'done', t('approvals.independence.declaredNone')));
  } else if (conflict.declared && conflict.disposition !== null) {
    items.push(
      check(
        'conflict',
        'done',
        t('approvals.independence.declaredConflict', {
          disposition: tEnum('conflict_declarations.disposition', conflict.disposition),
        }),
      ),
    );
  } else if (conflict.declarationRequired) {
    items.push(check('conflict', 'warning', t('approvals.independence.declarationRequired')));
  } else {
    items.push(check('conflict', 'done', t('approvals.independence.notRequired')));
  }

  const sod = approval.sod;
  if (blockers.includes('sod_blocked') || sod.blocked) {
    items.push(check('sod', 'danger', t('approvals.blocker.sod_blocked')));
  } else if (sod.alternativeOversightNote !== null) {
    items.push(
      check('sod', 'warning', t('approvals.readiness.sodNote'), sod.alternativeOversightNote),
    );
  } else {
    items.push(check('sod', 'done', t('approvals.readiness.sodOk')));
  }

  for (const code of blockers) {
    if (EXPLAINED.includes(code) || code === 'exchange_rate_missing') continue;
    // A decided approval's status chip already says it is no longer pending: not a failed check.
    if (code === 'approval_not_pending' && approval.status !== 'pending') continue;
    items.push(check(code, 'danger', t(`approvals.blocker.${code}`)));
  }
  return items;
}

const STEP_STATE: Readonly<Record<ApprovalDetail['steps'][number]['status'], CheckState>> = {
  pending: 'pending',
  approved: 'done',
  approved_with_conditions: 'done',
  returned: 'warning',
  rejected: 'danger',
  skipped: 'warning',
  invalidated: 'danger',
};

/** The approval route as path nodes, the caller's own step labelled "You". */
export function pathNodes(approval: ApprovalDetail): PathNode[] {
  return [...approval.steps]
    .sort((a, b) => a.sequence - b.sequence)
    .map((step) => {
      const mine = approval.myStep?.stepId === step.id;
      const name =
        step.committee?.name ??
        step.approver?.fullName ??
        t('approvals.detail.stepUnassigned', { sequence: step.sequence });
      const current = step.status === 'pending' && approval.currentStep?.id === step.id;
      const note =
        step.decidedBy !== null && step.decidedBy.userId !== step.approver?.userId
          ? t('approvals.detail.decidedBy', { name: step.decidedBy.fullName })
          : step.status === 'skipped'
            ? tEnum('approval_steps.status', step.status)
            : undefined;
      return {
        id: String(step.id),
        label: mine ? t('approvals.path.you', { name }) : name,
        state: STEP_STATE[step.status],
        stateLabel: tEnum('approval_steps.status', step.status),
        current,
        ...(note === undefined ? {} : { note }),
      };
    });
}
