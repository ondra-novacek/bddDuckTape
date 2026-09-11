import { Router } from 'express';
import type { AppConfig } from '../config';
import {
  GeminiApiError,
  polishScenarioField,
  type AiField,
  type GeminiConfig,
  type PolishInput
} from '../ai/client';

type AiPolisher = (config: GeminiConfig, input: PolishInput) => Promise<string>;

function isField(value: unknown): value is AiField {
  return value === 'summary' || value === 'gherkin';
}

export function createAiRouter(config: AppConfig, polisher: AiPolisher = polishScenarioField) {
  const router = Router();

  router.post('/ai/polish', async (req, res) => {
    if (!config.geminiApiKey) {
      res.status(500).json({ error: 'Set GEMINI_API_KEY in .env before using AI suggestions.' });
      return;
    }

    const body = req.body as { field?: unknown; summary?: unknown; gherkin?: unknown };
    if (!isField(body.field) || typeof body.summary !== 'string' || typeof body.gherkin !== 'string') {
      res.status(400).json({ error: 'Provide a field, summary, and Gherkin text for an AI suggestion.' });
      return;
    }
    if (body.field === 'summary' && !body.summary.trim() && !body.gherkin.trim()) {
      res.status(400).json({ error: 'Add Gherkin before asking AI to create a summary.' });
      return;
    }

    if (body.field === 'gherkin' && !body.gherkin.trim()) {
      res.status(400).json({ error: 'Add Gherkin before asking AI to polish it.' });
      return;
    }

    try {
      const proposal = await polisher(
        { apiKey: config.geminiApiKey, model: 'gemini-3.5-flash-lite' },
        { field: body.field, summary: body.summary, gherkin: body.gherkin }
      );
      res.json({ proposal });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gemini could not create a suggestion.';
      res.status(error instanceof GeminiApiError ? 502 : 502).json({ error: message });
    }
  });

  return router;
}
