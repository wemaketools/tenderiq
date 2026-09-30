/**
 * The user card at the bottom of the sidebar: initials, name and current organization, and a menu with switch
 * organization (COM-02), profile (COM-03), theme and sign out.
 */
import { useNavigate } from 'react-router';

import type { ActiveTenantContext } from '@contracts/session';

import { saveTheme } from '../../api/session';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { themeChanged } from '../../app/slices/session';
import { useAuth } from '../../auth/authContext';
import { initialsOf } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { useToast } from '../ui/toastContext';

export interface UserCardProps {
  readonly tenant: ActiveTenantContext;
}

export function UserCard({ tenant }: UserCardProps) {
  const user = useAppSelector((state) => state.session.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  if (user === null) {
    return null;
  }
  const nextTheme = user.theme === 'dark' ? 'light' : 'dark';

  const toggleTheme = async (): Promise<void> => {
    const previous = user.theme;
    dispatch(themeChanged(nextTheme));
    try {
      await saveTheme(nextTheme);
    } catch {
      dispatch(themeChanged(previous));
      toast.show(t('shell.user.themeFailed'), 'error');
    }
  };

  return (
    <div className="tiq-user-card">
      <Menu
        label={t('shell.user.menu')}
        placement="none"
        className="tiq-user-card-menu"
        entries={[
          {
            kind: 'text',
            id: 'context',
            label: t('shell.user.context', {
              capacity: tenant.capacity ?? t('shell.user.member'),
              organization: tenant.name,
            }),
          },
          {
            id: 'switch',
            label: t('shell.user.switch'),
            icon: 'switchOrg',
            onSelect: () => void navigate('/select-organization'),
          },
          {
            kind: 'link',
            id: 'profile',
            label: t('shell.user.profile'),
            icon: 'user',
            to: '/me/profile',
          },
          {
            id: 'theme',
            label: nextTheme === 'dark' ? t('shell.user.themeDark') : t('shell.user.themeLight'),
            icon: nextTheme === 'dark' ? 'moon' : 'sun',
            onSelect: () => void toggleTheme(),
          },
          { kind: 'separator', id: 'sep' },
          {
            id: 'signout',
            label: t('shell.user.signOut'),
            icon: 'logOut',
            danger: true,
            onSelect: () => void auth.signOut(),
          },
        ]}
        trigger={(props) => (
          <button
            type="button"
            className="tiq-user-card-btn"
            aria-label={t('shell.user.open', { name: user.fullName, organization: tenant.name })}
            {...props}
          >
            <span className="tiq-avatar" aria-hidden="true">
              {initialsOf(user.fullName)}
            </span>
            <span className="tiq-user-card-who">
              <span className="tiq-user-card-name">{user.fullName}</span>
              <span className="tiq-user-card-sub">{tenant.name}</span>
            </span>
            <span className="tiq-user-card-chevron" aria-hidden="true">
              <Icon name="chevronUp" />
            </span>
          </button>
        )}
      />
    </div>
  );
}
