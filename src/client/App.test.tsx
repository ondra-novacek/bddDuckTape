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

  it('uses the typed board ID and displays fetched sticky notes', async () => {
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

    const input = screen.getByLabelText('Miro board ID');
    await userEvent.type(input, 'board-123');

    await userEvent.click(screen.getByRole('button', { name: 'Fetch sticky notes' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });
    expect(screen.getByText('1 group from 2 blue/green sticky notes')).toBeInTheDocument();
    expect(screen.getAllByText(/Successful login/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Scenario: user logs in/).length).toBeGreaterThan(0);
    expect(screen.getByText('Xray preview')).toBeInTheDocument();
    expect(screen.queryByLabelText('Edit sticky note text')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const itemEditor = screen.getByLabelText('Edit sticky note text');
    await userEvent.clear(itemEditor);
    await userEvent.type(itemEditor, 'Edited login{enter}Scenario: edited user logs in');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByDisplayValue('Edited login\nScenario: edited user logs in')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Edited login/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Scenario: edited user logs in/).length).toBeGreaterThan(0);

    await userEvent.type(
      screen.getByLabelText('Xray Test Set key or URL'),
      'https://levelworks.atlassian.net/browse/LW1-28042'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create in Xray' }));

    await waitFor(() => {
      expect(screen.getByText('Created 1 Xray Test')).toBeInTheDocument();
    });
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Edit sticky note text'));
    await userEvent.type(
      screen.getByLabelText('Edit sticky note text'),
      'Given a cancelled user'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByDisplayValue('Given a cancelled user')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Edited login/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Given a cancelled user')).not.toBeInTheDocument();
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
});
