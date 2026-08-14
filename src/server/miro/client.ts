import { createHttpError } from '../errors';
import { normalizeStickyNote } from './normalize';
import type { MiroItemsPage, StickyNote } from './types';

interface FetchStickyNotesInput {
  boardId: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export async function fetchStickyNotesFromMiro({
  boardId,
  accessToken,
  fetchImpl = fetch
}: FetchStickyNotesInput): Promise<StickyNote[]> {
  const notes: StickyNote[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`https://api.miro.com/v2/boards/${encodeURIComponent(boardId)}/items`);
    url.searchParams.set('type', 'sticky_note');
    url.searchParams.set('limit', '50');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw createHttpError(
        response.status === 401 || response.status === 403 ? response.status : 502,
        `Miro request failed with status ${response.status}`
      );
    }

    const page = (await response.json()) as MiroItemsPage;
    for (const item of page.data ?? []) {
      const note = normalizeStickyNote(item);
      if (note) {
        notes.push(note);
      }
    }
    cursor = page.cursor;
  } while (cursor);

  return notes;
}
