/**
 * The organization switcher of the buyer utility bar (COM-02 in place; docs/plan/design1 §2): the active
 * organization's name opens a menu of the user's enterable organizations with the capacity they act in; choosing one
 * enters it (the same `selectTenant` as the selection page: every tenant-scoped state is cleared, BR-02) and lands on
 * that organization's home. The last entry opens the full selection page, which also explains memberships that
 * cannot be entered yet. A failed switch is announced inline; the user stays where they were.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import type { ActiveTenantContext, SessionMembership } from '@contracts/session';

import { AREA_ROOTS, TENANT_KIND_AREA } from '../../app/featureTypes';
import { useAppDispatch, useMemberships } from '../../app/hooks';
import { isEnterableMembership, selectTenant } from '../../app/sessionActions';
import { t } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import type { MenuEntry } from '../ui/Menu';
import { useToast } from '../ui/toastContext';

export function OrgSwitcher({ tenant }: { readonly tenant: ActiveTenantContext }) {
  const memberships = useMemberships();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const enterable = memberships.filter(
    (membership) => membership.status === 'active' && isEnterableMembership(membership),
  );
  const seen = new Set<number>();
  const options = enterable.filter((membership) => {
    if (seen.has(membership.tenantId)) return false;
    seen.add(membership.tenantId);
    return true;
  });

  const enter = async (membership: SessionMembership): Promise<void> => {
    if (membership.tenantId === tenant.tenantId) return;
    setPending(membership.tenantName);
    const ok = await dispatch(selectTenant(membership.tenantId));
    setPending(null);
    if (ok) {
      void navigate(AREA_ROOTS[TENANT_KIND_AREA[membership.tenantKind]]);
    } else {
      toast.show(t('shell.org.failed', { organization: membership.tenantName }), 'error');
    }
  };

  const entries: MenuEntry[] = [
    { kind: 'text', id: 'heading', label: t('shell.org.menu') },
    ...options.map((membership): MenuEntry => {
      const current = membership.tenantId === tenant.tenantId;
      const icon: IconName = current ? 'check' : 'building';
      return {
        id: `org-${membership.tenantId}`,
        current,
        label: (
          <span className="tiq-org-menu-entry">
            <span>{membership.tenantName}</span>
            <span className="tiq-org-menu-capacity">
              {current ? t('shell.org.current') : (membership.capacity ?? t('shell.user.member'))}
            </span>
          </span>
        ),
        icon,
        onSelect: () => void enter(membership),
      };
    }),
    { kind: 'separator', id: 'sep' },
    {
      kind: 'link',
      id: 'choose',
      label: t('shell.org.choose'),
      icon: 'switchOrg',
      to: '/select-organization',
    },
  ];

  return (
    <div className="tiq-org-menu">
      <Menu
        label={t('shell.org.menu')}
        entries={entries}
        trigger={(props) => (
          <button
            type="button"
            className="tiq-org-switch"
            aria-label={t('shell.org.switchFor', { organization: tenant.name })}
            aria-busy={pending !== null || undefined}
            {...props}
          >
            <Icon name="building" />
            <span className="tiq-org-switch-name">
              {pending === null ? tenant.name : t('shell.org.entering', { organization: pending })}
            </span>
            <Icon name="chevronDown" className="tiq-org-switch-chevron" />
          </button>
        )}
      />
    </div>
  );
}
