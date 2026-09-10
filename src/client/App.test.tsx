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

  it('shows only changed Gherkin lines with diff colors before applying an AI suggestion', async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target === '/api/miro/sticky-notes?boardId=board-123') {
        return new Response(
          JSON.stringify({
            boardId: 'board-123',
            count: 2,
            groupCount: 1,
            notes: [],
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
                    content: '<p>Scenario</p>',
                    plainText: 'Customer login\nScenario: customer logs in\nGiven an active user',
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

      if (target === '/api/ai/polish' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          field: 'gherkin',
          summary: 'Customer login',
          gherkin: 'Scenario: customer logs in\nGiven an active user'
        });
        return new Response(
          JSON.stringify({ proposal: 'Scenario: customer logs in\nGiven an existing account\nGiven an active user' }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 500 });
    }) as typeof fetch;

    render(<App />);
    await userEvent.type(screen.getByLabelText('Miro board ID or URL'), 'board-123');
    await userEvent.click(screen.getByRole('button', { name: 'Fetch sticky notes' }));

    const gherkin = await screen.findByLabelText('Xray scenario 1 Gherkin');
    await userEvent.click(screen.getByRole('button', { name: 'Polish Gherkin for scenario 1' }));

    const dialog = await screen.findByRole('dialog', { name: 'Review AI suggestion' });
    expect(screen.getByRole('heading', { name: 'Changes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Current' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Proposed' })).not.toBeInTheDocument();
    expect(screen.getByText('Scenario: customer logs in').closest('.diffLine')).toHaveClass('diffUnchanged');
    expect(screen.getByText('Given an existing account').closest('.diffLine')).toHaveClass('diffAdded');
    expect(screen.getByText('Given an active user').closest('.diffLine')).toHaveClass('diffUnchanged');
    expect(screen.getByLabelText('Diff line 1')).toHaveTextContent('1');
    expect(screen.getByLabelText('Diff line 2')).toHaveTextContent('2');
    expect(screen.getByLabelText('Diff line 3')).toHaveTextContent('3');
    expect(dialog).toHaveTextContent('Scenario: customer logs in');
    expect(gherkin).toHaveValue('Scenario: customer logs in\nGiven an active user');

    await userEvent.click(screen.getByRole('button', { name: 'Accept changes' }));
    expect(gherkin).toHaveValue('Scenario: customer logs in\nGiven an existing account\nGiven an active user');
    expect(screen.queryByRole('dialog', { name: 'Review AI suggestion' })).not.toBeInTheDocument();
  });

  it('opens the AI review modal while the suggestion is loading', async () => {
    let resolveSuggestion: ((response: Response) => void) | undefined;
    const suggestionResponse = new Promise<Response>((resolve) => {
      resolveSuggestion = resolve;
    });

    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === '/api/miro/sticky-notes?boardId=board-123') {
        return new Response(
          JSON.stringify({
            boardId: 'board-123',
            count: 2,
            groupCount: 1,
            notes: [],
            groups: [
              {
                header: {
                  id: 'note-1', content: '<p>Login</p>', plainText: 'Login', fillColor: 'blue', position: { x: 1, y: 2 }
                },
                items: [
                  {
                    id: 'note-2', content: '<p>Scenario</p>', plainText: 'succesful login\nScenario: customer logs in', fillColor: 'green', position: { x: 1, y: 100 }
                  }
                ]
              }
            ]
          }),
          { status: 200 }
        );
      }

      return suggestionResponse;
    }) as typeof fetch;

    render(<App />);
    await userEvent.type(screen.getByLabelText('Miro board ID or URL'), 'board-123');
    await userEvent.click(screen.getByRole('button', { name: 'Fetch sticky notes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Polish summary for scenario 1' }));

    expect(await screen.findByRole('dialog', { name: 'Review AI suggestion' })).toHaveTextContent(
      'Creating suggestion…'
    );

    resolveSuggestion?.(new Response(JSON.stringify({ proposal: 'Successful login' }), { status: 200 }));
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
