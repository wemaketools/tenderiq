/**
 * Organization and capacity selection (COM-02): every membership of the user with its capacity and roles, the
 * current context, and an explanation for memberships that cannot be used yet (pending approval, invitation not
 * accepted, suspended, revoked, or an organization that is not active). Nothing about other organizations is shown.
 * Entering an organization sets the active tenant, which clears all tenant-scoped state (BR-02).
 */
import { useNavigate } from 'react-router';

import type { SessionMembership } from '@contracts/session';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { isEnterableMembership, selectTenant } from '../../app/sessionActions';
import { tenantErrorDismissed } from '../../app/slices/session';
import { AREA_ROOTS, TENANT_KIND_AREA } from '../../app/featureTypes';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/authContext';
import { t, tEnum } from '../../lib/i18n';
import { Banner } from '../ui/Banner';
import { Button, ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { StatusChip } from '../ui/StatusChip';

const KIND_ICON: Readonly<Record<SessionMembership['tenantKind'], IconName>> = {
  buyer: 'building',
  supplier: 'briefcase',
  operator: 'server',
};

/** Why a membership cannot be entered (the i18n key), or `null` when it can. */
function unavailableReason(membership: SessionMembership): string | null {
  if (membership.status !== 'active') {
    return `shell.selectOrg.reason.membership.${membership.status}`;
  }
  if (!isEnterableMembership(membership)) {
    return `shell.selectOrg.reason.tenant.${membership.tenantStatus}`;
  }
  return null;
}

export function SelectOrganizationPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const auth = useAuth();
  const memberships = useAppSelector((state) => state.session.memberships);
  const activeTenant = useAppSelector((state) => state.session.activeTenant);
  const tenantStatus = useAppSelector((state) => state.session.tenantStatus);
  const pendingTenantId = useAppSelector((state) => state.session.pendingTenantId);
  const tenantError = useAppSelector((state) => state.session.tenantError);

  const enter = async (membership: SessionMembership): Promise<void> => {
    const ok = await dispatch(selectTenant(membership.tenantId));
    if (ok) {
      void navigate(AREA_ROOTS[TENANT_KIND_AREA[membership.tenantKind]]);
    }
  };

  const sorted = [...memberships].sort((a, b) => {
    const rank = (m: SessionMembership): number => (unavailableReason(m) === null ? 0 : 1);
    return rank(a) - rank(b) || a.tenantName.localeCompare(b.tenantName);
  });

  return (
    <AuthLayout title={t('shell.selectOrg.title')} subtitle={t('shell.selectOrg.subtitle')} wide>
      <div className="tiq-stack tiq-stack--spaced">
        {activeTenant !== null && (
          <Banner
            tone="info"
            title={t('shell.selectOrg.current', {
              organization: activeTenant.name,
              capacity: activeTenant.capacity ?? t('shell.user.member'),
            })}
            actions={
              <ButtonLink size="sm" to={AREA_ROOTS[TENANT_KIND_AREA[activeTenant.kind]]}>
                {t('shell.selectOrg.stay')}
              </ButtonLink>
            }
          >
            {t('shell.selectOrg.switchNote')}
          </Banner>
        )}
        {tenantError !== null && (
          <Banner
            tone="error"
            title={t('shell.selectOrg.failed')}
            actions={
              <Button size="sm" variant="ghost" onClick={() => dispatch(tenantErrorDismissed())}>
                {t('ui.action.dismiss')}
              </Button>
            }
          >
            {tenantError.correlationId !== null && (
              <p className="tiq-mono">
                {t('ui.error.correlation', { id: tenantError.correlationId })}
              </p>
            )}
          </Banner>
        )}
        {sorted.length === 0 ? (
          <EmptyState
            icon="building"
            title={t('shell.selectOrg.noneTitle')}
            description={t('shell.selectOrg.none')}
          />
        ) : (
          <ul className="tiq-org-list" aria-label={t('shell.selectOrg.listLabel')}>
            {sorted.map((membership) => {
              const reason = unavailableReason(membership);
              const current = activeTenant?.tenantId === membership.tenantId;
              const entering =
                tenantStatus === 'switching' && pendingTenantId === membership.tenantId;
              const roles = membership.roles.map((role) => role.name).join(', ');
              const content = (
                <>
                  <Icon name={KIND_ICON[membership.tenantKind]} />
                  <span>
                    <span className="tiq-org-name">{membership.tenantName}</span>
                    <span className="tiq-org-detail">
                      {' · '}
                      {tEnum('tenants.kind', membership.tenantKind)}
                    </span>
                    <span className="tiq-cell-sub">
                      {membership.capacity ?? t('shell.user.member')}
                      {roles !== '' && ` — ${roles}`}
                    </span>
                    {reason !== null && <span className="tiq-cell-sub">{t(reason)}</span>}
                  </span>
                  <span className="tiq-inline">
                    {current && (
                      <StatusChip enum="memberships.status" value="active" icon="check" />
                    )}
                    {reason !== null && (
                      <StatusChip enum="memberships.status" value={membership.status} />
                    )}
                    {reason === null && !current && <Icon name="chevronRight" />}
                  </span>
                </>
              );
              return (
                <li key={membership.membershipId}>
                  {reason === null ? (
                    <button
                      type="button"
                      className={
                        current ? 'tiq-org-option tiq-org-option--current' : 'tiq-org-option'
                      }
                      aria-current={current || undefined}
                      aria-busy={entering || undefined}
                      disabled={tenantStatus === 'switching'}
                      onClick={() => void enter(membership)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      className="tiq-org-option tiq-org-option--unavailable"
                      aria-disabled="true"
                    >
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="tiq-auth-links">
          <Button variant="ghost" icon="logOut" onClick={() => void auth.signOut()}>
            {t('shell.user.signOut')}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
