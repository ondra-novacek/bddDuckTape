import type {
  CreatedXrayTest,
  CreateXrayTestsInput,
  CreateXrayTestsResult,
  XrayConfig,
  XrayScenarioInput,
} from "./types";
import { getProjectKeyFromIssueKey } from "./issueKey";

export class XrayApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly scenarioIndex?: number,
    readonly created: CreatedXrayTest[] = [],
  ) {
    super(message);
  }
}

const createTestMutation = `
mutation CreateTest($testType: UpdateTestTypeInput!, $gherkin: String!, $jira: JSON!) {
  createTest(testType: $testType, gherkin: $gherkin, jira: $jira) {
    test {
      issueId
      jira(fields: ["key"])
    }
    warnings
  }
}`;

const addTestsToTestSetMutation = `
mutation AddTestsToTestSet($issueId: String!, $testIssueIds: [String]!) {
  addTestsToTestSet(issueId: $issueId, testIssueIds: $testIssueIds) {
    addedTests
    warning
  }
}`;

const getTestSetQuery = `
query GetTestSet($jql: String!) {
  getTestSets(jql: $jql, limit: 1) {
    results {
      issueId
      jira(fields: ["key"])
    }
  }
}`;

const getTestSetByIssueIdQuery = `
query GetTestSetByIssueId($issueId: String!) {
  getTestSet(issueId: $issueId) {
    issueId
    jira(fields: ["key"])
  }
}`;

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function authenticate(
  config: XrayConfig,
  fetcher: typeof fetch,
): Promise<string> {
  const response = await fetcher(`${config.baseUrl}/api/v2/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  const body = await readJsonResponse(response);

  if (!response.ok || typeof body !== "string") {
    throw new XrayApiError(
      "Xray authentication failed.",
      response.status || 502,
    );
  }

  return body;
}

async function graphql(
  config: XrayConfig,
  token: string,
  query: string,
  variables: unknown,
  fetcher: typeof fetch,
) {
  const response = await fetcher(`${config.baseUrl}/api/v2/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new XrayApiError(
      "Xray GraphQL request failed.",
      response.status || 502,
    );
  }

  if (
    body &&
    typeof body === "object" &&
    "errors" in body &&
    Array.isArray((body as { errors: unknown }).errors) &&
    (body as { errors: unknown[] }).errors.length > 0
  ) {
    throw new XrayApiError("Xray GraphQL returned errors.");
  }

  return body;
}

function createTestVariables(projectKey: string, scenario: XrayScenarioInput) {
  return {
    testType: { name: "Cucumber" },
    gherkin: scenario.gherkin,
    jira: {
      fields: {
        project: { key: projectKey },
        summary: scenario.summary,
      },
    },
  };
}

async function resolveTestSetIssueId(
  config: XrayConfig,
  token: string,
  testSetKey: string,
  fetcher: typeof fetch,
): Promise<string> {
  const body = (await graphql(
    config,
    token,
    getTestSetQuery,
    { jql: `key = '${testSetKey}'` },
    fetcher,
  )) as {
    data?: {
      getTestSets?: {
        results?: Array<{ issueId?: unknown; jira?: { key?: unknown } }>;
      };
    };
  };

  const testSet = body.data?.getTestSets?.results?.[0];
  console.log("testSet", body);
  if (typeof testSet?.issueId === "string") {
    return testSet.issueId;
  }

  const jiraIssueId = await resolveJiraIssueId(config, testSetKey, fetcher);
  if (!jiraIssueId) {
    throw new XrayApiError(`Xray Test Set ${testSetKey} was not found.`, 404);
  }

  const byIssueIdBody = (await graphql(
    config,
    token,
    getTestSetByIssueIdQuery,
    { issueId: jiraIssueId },
    fetcher,
  )) as {
    data?: {
      getTestSet?: { issueId?: unknown; jira?: { key?: unknown } } | null;
    };
  };

  const testSetByIssueId = byIssueIdBody.data?.getTestSet;
  if (typeof testSetByIssueId?.issueId !== "string") {
    throw new XrayApiError(
      `Jira issue ${testSetKey} exists as ${jiraIssueId}, but Xray did not return it as a Test Set.`,
      404,
    );
  }

  return testSetByIssueId.issueId;
}

async function resolveJiraIssueId(
  config: XrayConfig,
  testSetKey: string,
  fetcher: typeof fetch,
): Promise<string | null> {
  if (!config.jiraBaseUrl || !config.jiraEmail || !config.jiraApiToken) {
    return null;
  }

  const response = await fetcher(
    `${config.jiraBaseUrl.replace(/\/$/, "")}/rest/api/3/issue/${testSetKey}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.jiraEmail}:${config.jiraApiToken}`,
        ).toString("base64")}`,
        Accept: "application/json",
      },
    },
  );
  const body = (await readJsonResponse(response)) as { id?: unknown } | null;
  console.log("body", body);

  if (!response.ok || typeof body?.id !== "string") {
    return null;
  }

  return body.id;
}

export async function createXrayTestsInTestSet(
  config: XrayConfig,
  input: CreateXrayTestsInput,
  fetcher: typeof fetch = fetch,
): Promise<CreateXrayTestsResult> {
  const token = await authenticate(config, fetcher);
  const testSetIssueId = await resolveTestSetIssueId(
    config,
    token,
    input.testSetKey,
    fetcher,
  );
  const projectKey = getProjectKeyFromIssueKey(input.testSetKey);
  const created: CreatedXrayTest[] = [];
  const warnings: string[] = [];

  for (const [index, scenario] of input.scenarios.entries()) {
    try {
      const body = (await graphql(
        config,
        token,
        createTestMutation,
        createTestVariables(projectKey, scenario),
        fetcher,
      )) as {
        data?: {
          createTest?: {
            test?: { issueId?: unknown; jira?: { key?: unknown } };
            warnings?: string[];
          };
        };
      };

      const issueId = body.data?.createTest?.test?.issueId;
      const key = body.data?.createTest?.test?.jira?.key;

      if (typeof issueId !== "string" || typeof key !== "string") {
        throw new XrayApiError("Xray did not return the created Test key.");
      }

      created.push({ sourceId: scenario.sourceId, issueId, key });
      warnings.push(...(body.data?.createTest?.warnings ?? []));
    } catch (error) {
      if (error instanceof XrayApiError) {
        throw new XrayApiError(error.message, error.status, index, created);
      }

      throw new XrayApiError("Xray Test creation failed.", 502, index, created);
    }
  }

  try {
    const body = (await graphql(
      config,
      token,
      addTestsToTestSetMutation,
      {
        issueId: testSetIssueId,
        testIssueIds: created.map((test) => test.issueId),
      },
      fetcher,
    )) as { data?: { addTestsToTestSet?: { warning?: string | null } } };

    const warning = body.data?.addTestsToTestSet?.warning;
    if (warning) {
      warnings.push(warning);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? `Created Tests but failed to attach them to the Test Set: ${error.message}`
        : "Created Tests but failed to attach them to the Test Set.";
    throw new XrayApiError(message, 502, undefined, created);
  }

  return { created, warnings };
}
