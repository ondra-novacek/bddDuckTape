export interface AppConfig {
  miroAccessToken?: string;
  xrayClientId?: string;
  xrayClientSecret?: string;
  xrayBaseUrl?: string;
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    miroAccessToken: env.MIRO_ACCESS_TOKEN,
    xrayClientId: env.XRAY_CLIENT_ID,
    xrayClientSecret: env.XRAY_CLIENT_SECRET,
    xrayBaseUrl: env.XRAY_BASE_URL ?? 'https://xray.cloud.getxray.app',
    jiraBaseUrl: env.JIRA_BASE_URL,
    jiraEmail: env.JIRA_EMAIL,
    jiraApiToken: env.JIRA_API_TOKEN
  };
}
