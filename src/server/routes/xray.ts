import { Router } from 'express';
import type { AppConfig } from '../config';
import { createXrayTestsInTestSet, XrayApiError } from '../xray/client';
import { extractIssueKey } from '../xray/issueKey';
import type { CreateXrayTestsInput, CreateXrayTestsResult, XrayConfig } from '../xray/types';

type XrayExporter = (
  config: XrayConfig,
  input: CreateXrayTestsInput
) => Promise<CreateXrayTestsResult>;

function isScenario(value: unknown): value is CreateXrayTestsInput['scenarios'][number] {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { sourceId?: unknown }).sourceId === 'string' &&
    (value as { sourceId: string }).sourceId.trim().length > 0 &&
    typeof (value as { summary?: unknown }).summary === 'string' &&
    (value as { summary: string }).summary.trim().length > 0 &&
    typeof (value as { gherkin?: unknown }).gherkin === 'string' &&
    (value as { gherkin: string }).gherkin.trim().length > 0
  );
}

export function createXrayRouter(
  config: AppConfig,
  exporter: XrayExporter = createXrayTestsInTestSet
) {
  const router = Router();

  router.post('/xray/tests', async (req, res) => {
    if (!config.xrayClientId || !config.xrayClientSecret) {
      res.status(500).json({
        error: 'Set XRAY_CLIENT_ID and XRAY_CLIENT_SECRET in .env before exporting to Xray.'
      });
      return;
    }

    const body = req.body as {
      testSetKey?: unknown;
      scenarios?: unknown;
    };

    const testSetKey = typeof body.testSetKey === 'string' ? extractIssueKey(body.testSetKey) : null;
    if (!testSetKey) {
      res
        .status(400)
        .json({ error: 'Provide a Jira issue key or Jira issue URL for the Xray Test Set.' });
      return;
    }

    if (
      !Array.isArray(body.scenarios) ||
      body.scenarios.length === 0 ||
      !body.scenarios.every(isScenario)
    ) {
      res.status(400).json({ error: 'Each scenario needs a sourceId, summary, and gherkin body.' });
      return;
    }

    try {
      const result = await exporter(
        {
          clientId: config.xrayClientId,
          clientSecret: config.xrayClientSecret,
          baseUrl: config.xrayBaseUrl ?? 'https://xray.cloud.getxray.app'
        },
        {
          testSetKey,
          scenarios: body.scenarios.map((scenario) => ({
            sourceId: scenario.sourceId.trim(),
            summary: scenario.summary.trim(),
            gherkin: scenario.gherkin.trim()
          }))
        }
      );
      res.json(result);
    } catch (error) {
      if (error instanceof XrayApiError) {
        res.status(error.status).json({
          error: error.message,
          scenarioIndex: error.scenarioIndex,
          created: error.created
        });
        return;
      }

      res.status(502).json({ error: error instanceof Error ? error.message : 'Xray export failed.' });
    }
  });

  return router;
}
