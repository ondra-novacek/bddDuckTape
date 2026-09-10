export type AiField = 'summary' | 'gherkin';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface PolishInput {
  field: AiField;
  summary: string;
  gherkin: string;
}

export class GeminiApiError extends Error {}

const transientStatusCodes = new Set([429, 503]);
const retryDelayMs = 250;

export async function polishScenarioField(
  config: GeminiConfig,
  input: PolishInput
): Promise<string> {
  const model = config.model ?? 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const request: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(input) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: { proposal: { type: 'string' } },
          required: ['proposal']
        }
      }
    })
  };
  let response = await fetch(url, request);

  if (transientStatusCodes.has(response.status)) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    response = await fetch(url, request);
  }

  const body = (await response.json()) as {
    error?: { message?: unknown };
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };

  if (!response.ok) {
    throw new GeminiApiError(
      typeof body.error?.message === 'string' ? body.error.message : 'Gemini could not create a suggestion.'
    );
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new GeminiApiError('Gemini returned an empty suggestion.');
  }

  try {
    const proposal = (JSON.parse(text) as { proposal?: unknown }).proposal;
    if (typeof proposal !== 'string' || !proposal.trim()) {
      throw new Error('missing proposal');
    }
    return proposal.trim();
  } catch {
    throw new GeminiApiError('Gemini returned an invalid suggestion.');
  }
}

function buildPrompt(input: PolishInput): string {
  if (input.field === 'summary') {
    return `You edit BDD test titles. Return JSON only. Return the original text verbatim unless there is an unambiguous spelling error or a clearly inconsistent term. Do not rewrite grammar, style, articles, capitalization, acronyms, token names, or domain language. If the supplied summary is empty, derive a concise, behaviour-focused title from the Gherkin. Do not mention request paths, endpoints, IDs, payloads, or implementation details. Do not add behaviour.\n\nSummary:\n${input.summary}\n\nGherkin context:\n${input.gherkin}`;
  }

  return `You edit BDD Gherkin. Return JSON only. Return the original text verbatim unless there is an unambiguous spelling error or a clearly inconsistent term. Do not rewrite grammar, style, articles, capitalization, acronyms, token names, or domain language. Preserve the scenario's meaning and valid Gherkin structure. Do not invent steps or behaviour.\n\nSummary context:\n${input.summary}\n\nGherkin:\n${input.gherkin}`;
}
