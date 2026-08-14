import { describe, expect, it } from 'vitest';
import { fetchStickyNotesFromMiro } from './client';

describe('fetchStickyNotesFromMiro', () => {
  it('requests sticky notes with cursor pagination and normalizes the result', async () => {
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(url);

      if (urls.length === 1) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'note-1',
                type: 'sticky_note',
                data: { content: '<p>First</p>' },
                position: { x: 1, y: 2 }
              }
            ],
            cursor: 'next-page'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'note-2',
              type: 'sticky_note',
              data: { content: '<p>Second</p>' },
              position: { x: 3, y: 4 }
            }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    };

    const notes = await fetchStickyNotesFromMiro({
      boardId: 'board-123',
      accessToken: 'secret-token',
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(notes.map((note) => note.plainText)).toEqual(['First', 'Second']);
    expect(urls[0]).toContain('/v2/boards/board-123/items?');
    expect(urls[0]).toContain('type=sticky_note');
    expect(urls[0]).toContain('limit=50');
    expect(urls[1]).toContain('cursor=next-page');
  });
});
