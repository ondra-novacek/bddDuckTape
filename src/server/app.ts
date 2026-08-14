import express from 'express';
import type { AppConfig } from './config';
import { readConfig } from './config';
import { fetchStickyNotesFromMiro } from './miro/client';
import { createMiroRouter } from './routes/miro';
import { createXrayRouter } from './routes/xray';
import { createXrayTestsInTestSet } from './xray/client';

export function createApp(
  config: AppConfig = readConfig(),
  stickyNotesFetcher = fetchStickyNotesFromMiro,
  xrayExporter = createXrayTestsInTestSet
) {
  const app = express();

  app.use(express.json());
  app.use('/api', createMiroRouter(config, stickyNotesFetcher));
  app.use('/api', createXrayRouter(config, xrayExporter));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
