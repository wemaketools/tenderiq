/**
 * Workspace — ADM-10 calendars and deadline policies (BR-12). Buyer administration: administrators maintain and
 * approve calendars (`org.calendars.manage`); tender owners and viewers may read them.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { CALENDAR_READ } from './lib/calendars';

export const features: FeatureModule[] = [
  {
    id: 'calendars',
    area: 'buyer',
    routes: [
      {
        path: 'admin/calendars',
        load: () => import('./pages/CalendarsPage'),
        permission: CALENDAR_READ,
        title: 'calendars.list.title',
      },
      {
        path: 'admin/calendars/new',
        load: () => import('./pages/CalendarNewPage'),
        permission: 'org.calendars.manage',
        title: 'calendars.new.title',
      },
      {
        path: 'admin/calendars/:calendarId',
        load: () => import('./pages/CalendarPage'),
        permission: CALENDAR_READ,
        title: 'calendars.detail.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'buyer.calendars',
        label: 'calendars.nav.calendars',
        path: 'admin/calendars',
        section: 'admin',
        order: 50,
        icon: 'clock',
        permission: 'org.calendars.manage',
        sectionAction: {
          label: 'calendars.list.new',
          path: 'admin/calendars/new',
          icon: 'plus',
          permission: 'org.calendars.manage',
        },
      },
    ],
  },
];
