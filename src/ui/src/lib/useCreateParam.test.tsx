import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../test/render';
import { useCreateParam } from './useCreateParam';

function Probe() {
  const [open, setOpen] = useCreateParam();
  return (
    <>
      <p>{open ? 'dialog open' : 'dialog closed'}</p>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        close
      </button>
    </>
  );
}

describe('useCreateParam (DD-46)', () => {
  it('opens when the address carries ?new=1, as the top bar section action links it', () => {
    renderWithProviders(<Probe />, { route: '/ops/customers?new=1' });
    expect(screen.getByText('dialog open')).toBeInTheDocument();
  });

  it('stays closed without the parameter or with another value', () => {
    renderWithProviders(<Probe />, { route: '/ops/customers?new=yes' });
    expect(screen.getByText('dialog closed')).toBeInTheDocument();
  });

  it('removes only its parameter on close and keeps the others, replacing the history entry', async () => {
    const { router } = renderWithProviders(<Probe />, {
      route: '/ops/customers?status=active&new=1',
    });
    const entries = router.state.historyAction;
    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.getByText('dialog closed')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?status=active');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(entries).toBe('POP');
  });

  it('adds the parameter on open, keeping the others', async () => {
    const { router } = renderWithProviders(<Probe />, { route: '/ops/customers?status=active' });
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByText('dialog open')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?status=active&new=1');
    expect(router.state.historyAction).toBe('PUSH');
  });
});
