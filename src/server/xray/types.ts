export interface XrayConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

export interface XrayScenarioInput {
  sourceId: string;
  summary: string;
  gherkin: string;
}

export interface CreateXrayTestsInput {
  testSetKey: string;
  scenarios: XrayScenarioInput[];
}

export interface CreatedXrayTest {
  sourceId: string;
  issueId: string;
  key: string;
}

export interface CreateXrayTestsResult {
  created: CreatedXrayTest[];
  warnings: string[];
}
