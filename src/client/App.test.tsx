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
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const target = String(url);
      if (target === '/api/miro/sticky-notes?boardId=board-123') {
        return new Response(
          JSON.stringify({
            boardId: 'board-123',
            count: 1,
            notes: [
              {
                id: 'note-1',
                content: '<p>Scenario: Login</p>',
                plainText: 'Scenario: Login',
                position: { x: 1, y: 2 }
              }
            ]
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
      expect(screen.getByText('Scenario: Login')).toBeInTheDocument();
    });
    expect(screen.getByText('1 sticky note')).toBeInTheDocument();
    expect(logSpy).toHaveBeenCalledWith('Fetched Miro sticky notes', [
      {
        id: 'note-1',
        content: '<p>Scenario: Login</p>',
        plainText: 'Scenario: Login',
        position: { x: 1, y: 2 }
      }
    ]);
  });
});
