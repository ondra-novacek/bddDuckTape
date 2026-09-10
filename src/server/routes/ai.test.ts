import request from 'supertest';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAiRouter } from './ai';

describe('AI routes', () => {
  it('returns a proposed summary without changing the submitted scenario', async () => {
    const polisher = vi.fn().mockResolvedValue('Successful customer login');
    const app = express();
    app.use(express.json());
    app.use(createAiRouter({ geminiApiKey: 'gemini-key' }, polisher));

    const response = await request(app).post('/ai/polish').send({
      field: 'summary',
      summary: '',
      gherkin: 'Scenario: customer logs in\nGiven a registered customer'
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ proposal: 'Successful customer login' });
    expect(polisher).toHaveBeenCalledWith(
      { apiKey: 'gemini-key', model: 'gemini-3.5-flash' },
      {
        field: 'summary',
        summary: '',
        gherkin: 'Scenario: customer logs in\nGiven a registered customer'
      }
    );
  });

  it('requires a Gemini API key before making a proposal', async () => {
    const app = express();
    app.use(express.json());
    app.use(createAiRouter({}));

    const response = await request(app).post('/ai/polish').send({
      field: 'gherkin',
      summary: 'Customer login',
      gherkin: 'Scenario: customer logs in'
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Set GEMINI_API_KEY in .env before using AI suggestions.');
  });
});
