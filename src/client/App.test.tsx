import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  const originalFetch = globalThis.fetch;
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('edits Xray scenario headers and free-form Gherkin before exporting', async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target === '/api/miro/sticky-notes?boardId=board-123') {
        return new Response(
          JSON.stringify({
            boardId: 'board-123',
            count: 2,
            groupCount: 1,
            notes: [
              {
                id: 'note-1',
                content: '<p>Login</p>',
                plainText: 'Login',
                fillColor: 'blue',
                position: { x: 1, y: 2 }
              },
              {
                id: 'note-2',
                content: '<p>Given a valid user</p>',
                plainText: 'Successful login\nScenario: user logs in',
                fillColor: 'green',
                position: { x: 1, y: 100 }
              }
            ],
            groups: [
              {
                header: {
                  id: 'note-1',
                  content: '<p>Login</p>',
                  plainText: 'Login',
                  fillColor: 'blue',
                  position: { x: 1, y: 2 }
                },
                items: [
                  {
                    id: 'note-2',
                    content: '<p>Given a valid user</p>',
                    plainText: 'Successful login\nScenario: user logs in',
                    fillColor: 'green',
                    position: { x: 1, y: 100 }
                  }
                ]
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (target === '/api/xray/tests' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          testSetKey: 'https://levelworks.atlassian.net/browse/LW1-28042',
          scenarios: [
            {
              sourceId: 'note-2',
              summary: 'Edited login',
              gherkin: 'Scenario: edited user logs in'
            }
          ]
        });

        return new Response(
          JSON.stringify({
            created: [{ sourceId: 'note-2', issueId: '10001', key: 'PROJ-1' }],
            warnings: []
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 500 });
    }) as typeof fetch;

    render(<App />);

    const input = screen.getByLabelText('Miro board ID or URL');
    await userEvent.type(input, 'board-123');

    await userEvent.click(screen.getByRole('button', { name: 'Fetch sticky notes' }));

    const headerEditor = await screen.findByLabelText('Xray scenario 1 header');
    const gherkinEditor = screen.getByLabelText('Xray scenario 1 Gherkin');

    expect(headerEditor).toHaveValue('Successful login');
    expect(gherkinEditor).toHaveValue('Scenario: user logs in');
    expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();

    await userEvent.clear(headerEditor);
    await userEvent.type(headerEditor, 'Edited login');
    await userEvent.clear(gherkinEditor);
    await userEvent.type(gherkinEditor, 'Scenario: edited user logs in');

    await userEvent.type(
      screen.getByLabelText('Xray Test Set key or URL'),
      'https://levelworks.atlassian.net/browse/LW1-28042'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create in Xray' }));

    await waitFor(() => {
      expect(screen.getByText('Created 1 Xray Test')).toBeInTheDocument();
    });
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();

    expect(logSpy).toHaveBeenCalledWith('Fetched Miro sticky notes', [
      {
        id: 'note-1',
        content: '<p>Login</p>',
        plainText: 'Login',
        fillColor: 'blue',
        position: { x: 1, y: 2 }
      },
      {
        id: 'note-2',
        content: '<p>Given a valid user</p>',
        plainText: 'Successful login\nScenario: user logs in',
        fillColor: 'green',
        position: { x: 1, y: 100 }
      }
    ]);
  });

  it('extracts a board ID from a Miro board URL before fetching sticky notes', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          boardId: 'uXjVLzqAbCd=',
          count: 0,
          groupCount: 0,
          notes: [],
          groups: []
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    render(<App />);

    await userEvent.type(
      screen.getByLabelText('Miro board ID or URL'),
      'https://miro.com/app/board/uXjVLzqAbCd=/?share_link_id=123'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fetch sticky notes' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/miro/sticky-notes?boardId=uXjVLzqAbCd%3D'
    );
  });

  it('does not extract a board ID from a lookalike domain', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ boardId: '', count: 0, groupCount: 0, notes: [], groups: [] }), {
        status: 200
      });
    }) as typeof fetch;

    render(<App />);

    await userEvent.type(
      screen.getByLabelText('Miro board ID or URL'),
      'https://evilmiro.com/app/board/not-a-miro-board/'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fetch sticky notes' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/miro/sticky-notes?boardId=https%3A%2F%2Fevilmiro.com%2Fapp%2Fboard%2Fnot-a-miro-board%2F'
    );
  });
});
