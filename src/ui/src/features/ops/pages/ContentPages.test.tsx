import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HelpArticleRow } from '@contracts/operations';

import { installFetch, problem } from '../../../test/fetchMock';
import { renderWithProviders } from '../../../test/render';
import { announcement, helpArticle, opsState, pageOf } from '../testData';
import AnnouncementEditorPage from './AnnouncementEditorPage';
import AnnouncementsPage from './AnnouncementsPage';
import HelpArticleEditorPage from './HelpArticleEditorPage';
import HelpArticlesPage from './HelpArticlesPage';

const O = '/api/v1/ops';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnnouncementsPage (OPS-07)', () => {
  it('lists announcements with audience, language and status, and states they are not tender notices', async () => {
    installFetch({ [`GET ${O}/announcements`]: () => ({ body: pageOf([announcement()]) }) });
    renderWithProviders(<AnnouncementsPage />, {
      state: opsState(),
      route: '/ops/content/announcements',
    });

    const table = await screen.findByRole('table', { name: 'Announcements' });
    expect(within(table).getByText('Planned maintenance on 12 October')).toBeInTheDocument();
    expect(within(table).getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('Announcements are not tender notices')).toBeInTheDocument();
  });
});

describe('AnnouncementEditorPage (OPS-07)', () => {
  it('warns when the text names a tender and blocks saving before the API is called', async () => {
    const { requests } = installFetch({});
    renderWithProviders(<AnnouncementEditorPage />, {
      state: opsState(),
      route: '/ops/content/announcements/new',
      path: '/ops/content/announcements/new',
    });
    await userEvent.type(await screen.findByLabelText(/^Title/), 'T-2026-0002 is extended');

    expect(screen.getByText('Tender reference found')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('This text is required.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('explains that another person must review before publishing', async () => {
    installFetch({
      [`GET ${O}/announcements/1`]: () => ({ body: announcement() }),
      [`POST ${O}/announcements/1/publish`]: () =>
        problem(409, 'Review required', { code: 'REVIEW_REQUIRED' }),
    });
    renderWithProviders(<AnnouncementEditorPage />, {
      state: opsState(),
      route: '/ops/content/announcements/1',
      path: '/ops/content/announcements/:announcementId',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

    expect(
      await within(dialog).findByText(
        'Content is published by a reviewer other than its last editor.',
      ),
    ).toBeInTheDocument();
  });
});

describe('HelpArticlesPage (OPS-07)', () => {
  it('lists help articles with topic, audience and publication', async () => {
    const detail = helpArticle();
    installFetch({
      [`GET ${O}/help-articles`]: () => ({
        body: pageOf([
          HelpArticleRow.parse({
            id: detail.id,
            slug: detail.slug,
            title: detail.title,
            topic: detail.topic,
            audience: detail.audience,
            language: detail.language,
            status: detail.status,
            excerpt: detail.excerpt,
            publishedAt: detail.publishedAt,
            updatedAt: detail.updatedAt,
            updatedBy: detail.updatedBy,
          }),
        ]),
      }),
    });
    renderWithProviders(<HelpArticlesPage />, { state: opsState(), route: '/ops/content/help' });

    const table = await screen.findByRole('table', { name: 'Help articles' });
    expect(within(table).getByText('How to submit a response')).toBeInTheDocument();
  });

  it('explains when no article matches', async () => {
    installFetch({ [`GET ${O}/help-articles`]: () => ({ body: pageOf([]) }) });
    renderWithProviders(<HelpArticlesPage />, { state: opsState(), route: '/ops/content/help' });

    expect(await screen.findByText('No articles match')).toBeInTheDocument();
  });
});

describe('HelpArticleEditorPage (OPS-07)', () => {
  it('saves a changed published article', async () => {
    const { requests } = installFetch({
      [`GET ${O}/help-articles/1`]: () => ({ body: helpArticle() }),
      [`PATCH ${O}/help-articles/1`]: () => ({
        body: helpArticle({ updatedAt: '2026-09-30T08:00:00Z' }),
      }),
    });
    renderWithProviders(<HelpArticleEditorPage />, {
      state: opsState(),
      route: '/ops/content/help/1',
      path: '/ops/content/help/:articleId',
    });
    expect(await screen.findByText('This article is published')).toBeInTheDocument();
    const excerpt = screen.getByLabelText(/^One-line summary/);
    await userEvent.clear(excerpt);
    await userEvent.type(excerpt, 'Prepare and submit before the official deadline.');
    await userEvent.click(screen.getByRole('button', { name: 'Save article' }));

    await waitFor(() =>
      expect(requests.find((request) => request.method === 'PATCH')?.body).toMatchObject({
        excerpt: 'Prepare and submit before the official deadline.',
      }),
    );
  });
});
