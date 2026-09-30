/**
 * Stage, next required action and readiness of the policy records (PRD §19: every screen shows the record's stage
 * and the next required action; readiness separates blocking conditions from warnings).
 */
import type {
  PolicyProfileDetail,
  PolicyVersionDetail,
  PortalPolicy,
  TemplateDetail,
} from '@contracts/policy';

import type { ReadinessItem, StepItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';

/** The next required action on a profile (PRD §19). */
export function profileNextAction(profile: PolicyProfileDetail): string {
  if (profile.status === 'retired') return t('admin-policy.profile.next.retired');
  const pending = profile.pendingVersion;
  if (pending?.status === 'in_review') {
    return t('admin-policy.profile.next.review', { no: pending.versionNo });
  }
  if (pending?.status === 'draft') {
    return t('admin-policy.profile.next.submit', { no: pending.versionNo });
  }
  if (profile.currentVersion === null) return t('admin-policy.profile.next.noCurrent');
  return t('admin-policy.profile.next.none');
}

/** The lifecycle of a version as steps. */
export function versionSteps(status: PolicyVersionDetail['status']): StepItem[] {
  const order = ['draft', 'in_review', 'approved'] as const;
  const position = status === 'retired' ? 3 : order.indexOf(status);
  const steps: StepItem[] = order.map((step, index) => ({
    id: step,
    label: t(`admin-policy.versionStatus.${step}`),
    state: index < position ? 'complete' : index === position ? 'current' : 'upcoming',
  }));
  if (status === 'retired') {
    steps.push({ id: 'retired', label: t('admin-policy.versionStatus.retired'), state: 'current' });
  }
  return steps;
}

/** The next required action on a version (PRD §19). */
export function versionNextAction(version: PolicyVersionDetail): string {
  const caps = version.capabilities;
  switch (version.status) {
    case 'draft':
      return caps.canSubmit
        ? t('admin-policy.version.next.submit')
        : t('admin-policy.version.next.draftOther');
    case 'in_review':
      if (caps.canApprove) return t('admin-policy.version.next.decide');
      if (caps.approvalBlockedReason !== null) return t('admin-policy.version.next.otherApprover');
      return t('admin-policy.version.next.awaiting');
    case 'approved':
      return version.isCurrent
        ? t('admin-policy.version.next.current')
        : t('admin-policy.version.next.superseded');
    case 'retired':
      return t('admin-policy.version.next.retired');
  }
  return t('admin-policy.version.next.retired');
}

/** Checks a submitter reviews before sending the draft (blocking vs warnings, PRD §19). */
export function draftReadiness(version: PolicyVersionDetail): ReadinessItem[] {
  const rules = version.rules;
  const uncovered = rules.permittedProcedures.filter(
    (procedure) => !rules.thresholds.some((band) => band.procedure === procedure),
  );
  return [
    {
      id: 'procedures',
      label: t('admin-policy.readiness.procedures'),
      status: rules.permittedProcedures.length > 0 ? 'passed' : 'blocking',
    },
    {
      id: 'thresholds',
      label: t('admin-policy.readiness.thresholds'),
      detail:
        uncovered.length === 0
          ? undefined
          : t('admin-policy.readiness.thresholdsMissing', { count: uncovered.length }),
      status: uncovered.length === 0 ? 'passed' : 'warning',
    },
    {
      id: 'release',
      label: t('admin-policy.readiness.release'),
      status: rules.requiresReleaseApproval ? 'passed' : 'warning',
    },
    {
      id: 'standstill',
      label: t('admin-policy.readiness.standstill'),
      status: rules.standstillRequired ? 'passed' : 'warning',
    },
    {
      id: 'route',
      label: t('admin-policy.readiness.route'),
      status: rules.approvalRouteNote === null ? 'warning' : 'passed',
    },
  ];
}

/** The next required action on a template (PRD §19). */
export function templateNextAction(template: TemplateDetail): string {
  const caps = template.capabilities;
  if (template.status === 'retired') return t('admin-policy.template.next.retired');
  const pending = template.versions.find(
    (version) => version.versionStatus === 'draft' || version.versionStatus === 'in_review',
  );
  if (pending?.versionStatus === 'in_review') {
    if (caps.canApprove) return t('admin-policy.template.next.decide', { no: pending.versionNo });
    if (caps.approvalBlockedReason !== null) return t('admin-policy.template.next.otherApprover');
    return t('admin-policy.template.next.awaiting', { no: pending.versionNo });
  }
  if (pending?.versionStatus === 'draft') {
    return t('admin-policy.template.next.submit', { no: pending.versionNo });
  }
  if (template.reviewOverdue) return t('admin-policy.template.next.review');
  return t('admin-policy.template.next.none');
}

/** The next required action on the portal policy (PRD §19). */
export function portalNextAction(policy: PortalPolicy): string {
  const proposal = policy.proposal;
  if (proposal === null) {
    return policy.capabilities.canPropose
      ? t('admin-policy.portal.next.none')
      : t('admin-policy.portal.next.noneReadOnly');
  }
  if (proposal.status === 'in_review') {
    return policy.capabilities.canApprove
      ? t('admin-policy.portal.next.decide')
      : t('admin-policy.portal.next.awaiting');
  }
  return t('admin-policy.portal.next.submit');
}
