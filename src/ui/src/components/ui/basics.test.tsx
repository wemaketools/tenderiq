import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/client';
import { Banner } from './Banner';
import { Button, ButtonLink, IconButton, IconLink } from './Button';
import { Card, CardLink } from './Card';
import { DetailList } from './DetailList';
import { EmptyState, ErrorState, RestrictedState } from './EmptyState';
import { Icon } from './Icon';
import { ICON_NAMES } from './icons';
import { KpiCard } from './KpiCard';
import { Skeleton, SkeletonBlock } from './Skeleton';
import { Stepper } from './Stepper';
import { Timeline } from './Timeline';
import { MoneyText, OrDash, Reference } from './Values';

describe('Icon', () => {
  it('provides more than sixty hand-rolled icons, decorative unless labelled', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(60);
    const { container } = render(
      <>
        <Icon name="bell" />
        <Icon name="lock" label="Sealed" />
      </>,
    );
    expect(container.querySelector('[data-icon="bell"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: 'Sealed' })).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('disables itself and reports busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        Submit
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveClass('tiq-btn--primary');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders icon buttons with an accessible name and a capped count', () => {
    render(
      <MemoryRouter>
        <IconButton icon="bell" label="Notifications" count={120} />
        <IconLink to="/me/tasks" icon="checkSquare" label="Tasks, 3 open" count={3} />
        <ButtonLink to="/x" variant="primary">
          Go
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveTextContent('99+');
    expect(screen.getByRole('link', { name: 'Tasks, 3 open' })).toHaveAttribute(
      'href',
      '/me/tasks',
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveClass('tiq-btn', 'tiq-btn--primary');
  });
});

describe('Card, DetailList, values', () => {
  it('renders a card title, subtitle, actions and the em dash for empty values', () => {
    render(
      <MemoryRouter>
        <Card
          title="Pipeline"
          subtitle="By stage"
          actions={<CardLink to="/buyer/tenders">View all</CardLink>}
        >
          <DetailList
            items={[
              { label: 'Owner', value: 'Tebogo Molefe' },
              { label: 'Budget', value: null },
            ]}
          />
          <Reference value="T-2026-0003" to="/buyer/tenders/3" />
          <Reference value="RCPT-2026-000001" />
          <MoneyText value={{ amount: '120000.00', currency: 'BWP' }} />
          <OrDash>{''}</OrDash>
        </Card>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Pipeline' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View all/ })).toHaveAttribute(
      'href',
      '/buyer/tenders',
    );
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'T-2026-0003' })).toHaveClass('tiq-ref');
    expect(screen.getByText('RCPT-2026-000001').tagName).toBe('SPAN');
    expect(screen.getByText('BWP 120,000')).toHaveClass('tiq-num');
  });
});

describe('Banner', () => {
  it('makes blocking errors alerts and the other tones statuses, each visually distinct', () => {
    render(
      <>
        <Banner tone="error" title="Blocked" />
        <Banner tone="warning" title="Careful" />
        <Banner tone="info" title="Note" />
        <Banner tone="success" title="Done" />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveClass('tiq-banner--error');
    const statuses = screen.getAllByRole('status');
    expect(statuses.map((element) => element.getAttribute('data-tone'))).toEqual([
      'warning',
      'info',
      'success',
    ]);
  });
});

describe('Empty, restricted and error states', () => {
  it('explains restricted access instead of showing numbers', () => {
    render(
      <>
        <EmptyState title="No tenders yet" description="Create the first one." />
        <RestrictedState description="Sealed until the opening session." />
      </>,
    );
    expect(screen.getByText('No tenders yet')).toBeInTheDocument();
    expect(screen.getByText('Sealed until the opening session.')).toBeInTheDocument();
  });

  it('renders a 403 as the restricted state and a 5xx with its correlation id and retry', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ErrorState
        error={
          new ApiError({ kind: 'forbidden', status: 403, title: 'Forbidden', endpointId: 'x' })
        }
      />,
    );
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    rerender(
      <ErrorState
        onRetry={onRetry}
        error={
          new ApiError({
            kind: 'server',
            status: 500,
            title: 'Internal',
            correlationId: 'corr-7',
            endpointId: 'x',
          })
        }
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Quote the correlation id');
    expect(screen.getByText('Correlation id: corr-7')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('announces loading skeletons once', () => {
    render(
      <>
        <SkeletonBlock lines={3} />
        <Skeleton width="40%" />
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
});

describe('KpiCard', () => {
  it('shows value and a delta whose colour follows whether the change is good', () => {
    render(
      <>
        <KpiCard
          label="Open tenders"
          value="4"
          icon="fileText"
          delta={{ direction: 'down', text: '-2' }}
        />
        <KpiCard
          label="Overdue tasks"
          value="3"
          icon="alertTriangle"
          delta={{ direction: 'down', text: '-1', positive: true }}
        />
        <KpiCard label="Avg cycle time" value={null} icon="timer" />
        <KpiCard label="Sealed bids" value="9" icon="lock" restricted />
      </>,
    );
    expect(screen.getByText('-2').closest('.tiq-kpi-delta')).toHaveClass('tiq-kpi-delta--down');
    expect(screen.getByText('-1').closest('.tiq-kpi-delta')).toHaveClass('tiq-kpi-delta--up');
    expect(screen.getByRole('region', { name: 'Avg cycle time' })).toHaveTextContent('—');
    // A metric the caller may not see is left out entirely (DD-49).
    expect(screen.queryByRole('region', { name: 'Sealed bids' })).not.toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });
});

describe('Stepper and Timeline', () => {
  it('marks the current step and states each state in text', () => {
    render(
      <Stepper
        label="Tender progress"
        steps={[
          { id: 'a', label: 'Draft', state: 'complete' },
          { id: 'b', label: 'Approval', state: 'current' },
          { id: 'c', label: 'Publish', state: 'upcoming' },
          { id: 'd', label: 'Hold', state: 'blocked' },
        ]}
      />,
    );
    const current = screen.getByText('Approval').closest('li');
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('renders timeline events with tone, meta and detail', () => {
    render(
      <Timeline
        label="History"
        items={[
          {
            id: 1,
            title: 'Published',
            meta: 'Tebogo Molefe',
            detail: 'Version 2',
            tone: 'success',
          },
        ]}
      />,
    );
    expect(screen.getByRole('list', { name: 'History' })).toHaveTextContent(
      'PublishedTebogo MolefeVersion 2',
    );
  });
});
