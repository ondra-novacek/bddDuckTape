import { Router } from 'express';
import type { AppConfig } from '../config';
import { fetchStickyNotesFromMiro } from '../miro/client';

type StickyNotesFetcher = typeof fetchStickyNotesFromMiro;

export function createMiroRouter(
  config: AppConfig,
  fetcher: StickyNotesFetcher = fetchStickyNotesFromMiro
) {
  const router = Router();

  router.get('/miro/sticky-notes', async (req, res) => {
    const boardId =
      typeof req.query.boardId === 'string' && req.query.boardId.trim()
        ? req.query.boardId.trim()
        : undefined;

    if (!boardId) {
      res.status(400).json({ error: 'Provide a board ID in the request.' });
      return;
    }

    if (!config.miroAccessToken) {
      res.status(500).json({ error: 'Set MIRO_ACCESS_TOKEN in .env before fetching Miro data.' });
      return;
    }

    try {
      const notes = await fetcher({ boardId, accessToken: config.miroAccessToken });
      console.log(`Fetched ${notes.length} sticky notes from Miro board ${boardId}`);
      res.json({ boardId, count: notes.length, notes });
    } catch (error) {
      const status =
        typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status: number }).status
          : 502;
      const message = error instanceof Error ? error.message : 'Miro request failed';
      res.status(status).json({ error: message });
    }
  });

  return router;
}
