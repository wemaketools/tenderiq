import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocationProbe, renderWithProviders } from '../../../test/render';
import { buyerState } from '../testData';
import BuyerClarificationsHome from './BuyerClarificationsHome';

const targets = [
  { path: '/buyer/clarifications/questions', element: <LocationProbe label="questions" /> },
  { path: '/buyer/clarifications/addenda', element: <LocationProbe label="addenda" /> },
  { path: '/buyer/clarifications/sessions', element: <LocationProbe label="sessions" /> },
];

describe('BuyerClarificationsHome', () => {
  it('opens Tender Q&A for a member who manages clarifications', async () => {
    renderWithProviders(<BuyerClarificationsHome />, {
      state: buyerState(['tender.clarifications.manage', 'tender.sessions.manage']),
      route: '/buyer/clarifications',
      path: '/buyer/clarifications',
      routes: targets,
    });
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('questions');
  });

  it('opens the addenda for an approver who only approves addenda', async () => {
    renderWithProviders(<BuyerClarificationsHome />, {
      state: buyerState(['tender.addenda.approve']),
      route: '/buyer/clarifications',
      path: '/buyer/clarifications',
      routes: targets,
    });
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('addenda');
  });

  it('opens the sessions for a member who only manages sessions', async () => {
    renderWithProviders(<BuyerClarificationsHome />, {
      state: buyerState(['tender.sessions.manage']),
      route: '/buyer/clarifications',
      path: '/buyer/clarifications',
      routes: targets,
    });
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('sessions');
  });
});
