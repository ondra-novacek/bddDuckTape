import { afterEach, describe, expect, it, vi } from 'vitest';
import { polishScenarioField } from './client';

describe('polishScenarioField', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses the quality model and instructs Gemini to preserve valid domain phrasing', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"proposal":"Given there is external user with HQ token"}' }] } }] }),
        { status: 200 }
      )
    ) as typeof fetch;

    await polishScenarioField(
      { apiKey: 'gemini-key' },
      {
        field: 'gherkin',
        summary: 'Access token',
        gherkin: 'Given there is external user with HQ token'
      }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/models/gemini-3.5-flash:generateContent?key=gemini-key'),
      expect.objectContaining({
        body: expect.stringContaining('Return the original text verbatim unless there is an unambiguous spelling error')
      })
    );
  });

  it('instructs Gemini to repair invalid Gherkin syntax without changing the behaviour', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"proposal":"Scenario: customer signs in\\n  Given an active customer\\n  When they submit valid credentials\\n  Then access is granted"}' }] } }] }),
        { status: 200 }
      )
    ) as typeof fetch;

    await polishScenarioField(
      { apiKey: 'gemini-key' },
      {
        field: 'gherkin',
        summary: 'Customer sign in',
        gherkin: 'Scenario customer signs in\nGiven an active customer\nWhen they submit valid credentials\nThen access is granted'
      }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('Repair invalid Gherkin syntax while preserving the scenario\'s behaviour.')
      })
    );
  });

  it('retries once after a temporary Gemini capacity error', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'High demand' } }), { status: 503 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"proposal":"Polished title"}' }] } }] }),
          { status: 200 }
        )
      ) as typeof fetch;

    await expect(
      polishScenarioField(
        { apiKey: 'gemini-key' },
        { field: 'summary', summary: 'Polished title', gherkin: 'Given a scenario' }
      )
    ).resolves.toBe('Polished title');

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('asks for a behaviour-focused summary without implementation details', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"proposal":"User signs in"}' }] } }] }),
        { status: 200 }
      )
    ) as typeof fetch;

    await polishScenarioField(
      { apiKey: 'gemini-key' },
      { field: 'summary', summary: '', gherkin: 'When the client posts to /api/login' }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('Do not mention request paths, endpoints, IDs, payloads, or implementation details.')
      })
    );
  });
});
