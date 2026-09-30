/**
 * Account screens (domain 01, FR-03, BR-02, DD-21, DD-27): COM-01 invitation acceptance on the public site
 * (`/invite/:token`), COM-02 organizations and capacities (`/me/memberships`, beyond the shell's organization
 * picker) and COM-03 the personal profile (`/me/profile`, opened from the user menu). Every signed-in account holder
 * may use them, so no permission applies; the API scopes each request to the caller.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'account-public',
    area: 'public',
    routes: [
      {
        path: 'invite/:token',
        load: () => import('./pages/InvitationPage'),
        title: 'account.invite.title',
      },
    ],
  },
  {
    id: 'account',
    area: 'common',
    routes: [
      {
        path: 'profile',
        load: () => import('./pages/ProfilePage'),
        title: 'account.profile.title',
      },
      {
        path: 'memberships',
        load: () => import('./pages/MembershipsPage'),
        title: 'account.memberships.title',
      },
    ],
    nav: [
      {
        id: 'me.memberships',
        label: 'account.nav.memberships',
        path: 'memberships',
        section: 'admin',
        order: 90,
        icon: 'switchOrg',
      },
    ],
  },
];
