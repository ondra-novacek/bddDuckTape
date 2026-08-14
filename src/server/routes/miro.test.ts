import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';

describe('Miro routes', () => {
  it('returns 400 when no board ID is provided', async () => {
    const app = createApp({ miroAccessToken: 'token' });

    const response = await request(app).get('/api/miro/sticky-notes');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Provide a board ID in the request.');
  });

  it('returns 500 when the Miro token is missing', async () => {
    const app = createApp({});

    const response = await request(app).get('/api/miro/sticky-notes?boardId=board-123');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Set MIRO_ACCESS_TOKEN in .env before fetching Miro data.');
  });

  it('returns sticky notes from the requested board ID', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      {
        id: 'note-1',
        content: '<p>Scenario</p>',
        plainText: 'Scenario',
        position: { x: 1, y: 2 }
      }
    ]);
    const app = createApp({ miroAccessToken: 'token' }, fetcher);

    const response = await request(app).get('/api/miro/sticky-notes?boardId=board-123');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      boardId: 'board-123',
      count: 1,
      notes: [
        {
          id: 'note-1',
          content: '<p>Scenario</p>',
          plainText: 'Scenario',
          position: { x: 1, y: 2 }
        }
      ]
    });
    expect(fetcher).toHaveBeenCalledWith({
      boardId: 'board-123',
      accessToken: 'token'
    });
  });
});
