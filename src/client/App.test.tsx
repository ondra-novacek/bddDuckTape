import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows the preview only after loading and submits edited scenarios through the Jira modal', async () => {
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
              },
              {
                id: 'note-3',
                content: '<p>Given a locked user</p>',
                plainText: 'Unsuccessful login\nScenario: user is denied access',
                fillColor: 'green',
                position: { x: 1, y: 200 }
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
                  },
                  {
                    id: 'note-3',
                    content: '<p>Given a locked user</p>',
                    plainText: 'Unsuccessful login\nScenario: user is denied access',
                    fillColor: 'green',
                    position: { x: 1, y: 200 }
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
            testSet: {
              key: 'LW1-28042',
              url: 'https://levelworks.atlassian.net/browse/LW1-28042'
            },
            created: [
              {
                sourceId: 'note-2',
                issueId: '10001',
                key: 'PROJ-1',
                url: 'https://levelworks.atlassian.net/browse/PROJ-1'
              }
            ],
            warnings: []
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 500 });
    }) as typeof fetch;

    render(<App />);

    const input = screen.getByLabelText('Miro board ID or URL');
    expect(screen.queryByRole('button', { name: 'Submit to Jira' })).not.toBeInTheDocument();
    await userEvent.type(input, 'board-123');

    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));

    expect(await screen.findByLabelText('Xray scenario 1 header')).toHaveValue('Successful login');
    expect(screen.getByLabelText('Xray scenario 2 header')).toHaveValue('Unsuccessful login');
    expect(screen.getByLabelText('Xray scenario 1 header').closest('li')).toHaveClass('scenarioCard');
    expect(screen.getByText('1', { selector: '.scenarioIndex' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Move scenario 2 up' }));
    expect(screen.getByLabelText('Xray scenario 1 header')).toHaveValue('Unsuccessful login');
    expect(screen.getByLabelText('Xray scenario 2 header')).toHaveValue('Successful login');

    await userEvent.click(screen.getByRole('button', { name: 'Delete scenario 1' }));

    const headerEditor = screen.getByLabelText('Xray scenario 1 header');
    const gherkinEditor = screen.getByLabelText('Xray scenario 1 Gherkin');

    expect(headerEditor).toHaveValue('Successful login');
    expect(gherkinEditor).toHaveValue('Scenario: user logs in');
    expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Xray scenario 2 header')).not.toBeInTheDocument();

    await userEvent.clear(headerEditor);
    expect(screen.getByText('Add a summary in the header field.')).toHaveClass('fieldNotice');
    await userEvent.type(headerEditor, 'Edited login');
    await userEvent.clear(gherkinEditor);
    await userEvent.type(gherkinEditor, 'Scenario: edited user logs in');

    await userEvent.click(screen.getByRole('button', { name: 'Submit to Jira' }));
    const jiraDialog = await screen.findByRole('dialog', { name: 'Submit to Jira' });
    expect(jiraDialog).toHaveTextContent(
      'Create-only export: running this again creates duplicate Xray Tests.'
    );
    await userEvent.type(
      screen.getByLabelText('Xray Test Set key or URL'),
      'https://levelworks.atlassian.net/browse/LW1-28042'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit tests' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('1 test added to LW1-28042');
    });
    expect(screen.getByRole('link', { name: 'LW1-28042' })).toHaveAttribute(
      'href',
      'https://levelworks.atlassian.net/browse/LW1-28042'
    );
    expect(screen.queryByRole('link', { name: 'Open Test Set in Jira' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'PROJ-1' })).not.toBeInTheDocument();

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
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/miro/sticky-notes?boardId=uXjVLzqAbCd%3D'
    );
  });

  it('appends a blank scenario from the add scenario control', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          boardId: 'board-123',
          count: 1,
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
                  plainText: 'Customer login\nScenario: customer logs in',
                  fillColor: 'green',
                  position: { x: 1, y: 100 }
                }
              ]
            }
          ]
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    render(<App />);
    await userEvent.type(screen.getByLabelText('Miro board ID or URL'), 'board-123');
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));

    await screen.findByLabelText('Xray scenario 1 header');
    await userEvent.click(screen.getByRole('button', { name: 'Add scenario' }));

    const newSummary = screen.getByLabelText('Xray scenario 2 header');
    expect(newSummary).toHaveValue('');
    expect(screen.getByLabelText('Xray scenario 2 Gherkin')).toHaveValue('');
    expect(newSummary).toHaveFocus();
    expect(screen.getByText('Add a summary in the header field. Add Gherkin in the free-form text field.')).toBeInTheDocument();
  });

  it('fills every missing header without replacing an existing header', async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target === '/api/miro/sticky-notes?boardId=board-123') {
        return new Response(
          JSON.stringify({
            boardId: 'board-123',
            count: 1,
            groupCount: 1,
            notes: [],
            groups: [
              {
                header: {
                  id: 'note-1', content: '<p>Login</p>', plainText: 'Login', fillColor: 'blue', position: { x: 1, y: 2 }
                },
                items: [
                  {
                    id: 'note-2', content: '<p>Scenario</p>', plainText: 'Existing title\nScenario: customer signs out', fillColor: 'green', position: { x: 1, y: 100 }
                  }
                ]
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (target === '/api/ai/polish' && init?.method === 'POST') {
        return new Response(JSON.stringify({ proposal: 'Customer signs in' }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 500 });
    }) as typeof fetch;

    render(<App />);
    await userEvent.type(screen.getByLabelText('Miro board ID or URL'), 'board-123');
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add scenario' }));
    await userEvent.type(screen.getByLabelText('Xray scenario 2 Gherkin'), 'Scenario: customer signs in');

    await userEvent.click(await screen.findByRole('button', { name: 'Fill 1 missing header' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Xray scenario 2 header')).toHaveValue('Customer signs in');
    });
    expect(screen.getByLabelText('Xray scenario 1 header')).toHaveValue('Existing title');
    expect(screen.queryByRole('button', { name: /Fill .*missing header/ })).not.toBeInTheDocument();
  });

  it('hides the imported missing-summary error after AI fills the header', async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target === '/api/miro/sticky-notes?boardId=board-123') {
        return new Response(
          JSON.stringify({
            boardId: 'board-123',
            count: 1,
            groupCount: 1,
            notes: [],
            groups: [
              {
                header: {
                  id: 'note-1', content: '<p>Login</p>', plainText: 'Login', fillColor: 'blue', position: { x: 1, y: 2 }
                },
                items: [
                  {
                    id: 'note-2', content: '<p>Scenario</p>', plainText: 'Given an active customer', fillColor: 'green', position: { x: 1, y: 100 }
                  }
                ]
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (target === '/api/ai/polish' && init?.method === 'POST') {
        return new Response(JSON.stringify({ proposal: 'Customer login' }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 500 });
    }) as typeof fetch;

    render(<App />);
    await userEvent.type(screen.getByLabelText('Miro board ID or URL'), 'board-123');
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));

    expect(await screen.findByText('Add a summary on the first line.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fill 1 missing header' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Xray scenario 1 header')).toHaveValue('Customer login');
    });
    expect(screen.queryByText('Add a summary on the first line.')).not.toBeInTheDocument();
  });

  it('shows an AI error above the scenario list', async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === '/api/miro/sticky-notes?boardId=board-123') {
        return new Response(
          JSON.stringify({
            boardId: 'board-123',
            count: 1,
            groupCount: 1,
            notes: [],
            groups: [
              {
                header: {
                  id: 'note-1', content: '<p>Login</p>', plainText: 'Login', fillColor: 'blue', position: { x: 1, y: 2 }
                },
                items: [
                  {
                    id: 'note-2', content: '<p>Scenario</p>', plainText: 'Customer login\nScenario: customer logs in', fillColor: 'green', position: { x: 1, y: 100 }
                  }
                ]
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (String(url) === '/api/ai/polish' && init?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'AI request limit reached.' }), { status: 429 });
      }

      return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 500 });
    }) as typeof fetch;

    render(<App />);
    await userEvent.type(screen.getByLabelText('Miro board ID or URL'), 'board-123');
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Polish summary for scenario 1' }));

    const error = await screen.findByRole('alert');
    const scenarios = screen.getByRole('list');
    expect(error).toHaveTextContent('AI request limit reached.');
    expect(error.compareDocumentPosition(scenarios) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Fetch notes' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/miro/sticky-notes?boardId=https%3A%2F%2Fevilmiro.com%2Fapp%2Fboard%2Fnot-a-miro-board%2F'
    );
  });

  it('shows a scroll-to-top action after the page is scrolled', async () => {
    render(<App />);

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
    fireEvent.scroll(window);

    const backToTop = screen.getByRole('button', { name: 'Back to top' });
    expect(backToTop).toBeInTheDocument();

    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    await userEvent.click(backToTop);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
