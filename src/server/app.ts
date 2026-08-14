import express from 'express';
import type { AppConfig } from './config';
import { readConfig } from './config';
import { fetchStickyNotesFromMiro } from './miro/client';
import { createMiroRouter } from './routes/miro';

export function createApp(
  config: AppConfig = readConfig(),
  stickyNotesFetcher = fetchStickyNotesFromMiro
) {
  const app = express();

  app.use('/api', createMiroRouter(config, stickyNotesFetcher));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
