export interface AppConfig {
  miroAccessToken?: string;
  xrayClientId?: string;
  xrayClientSecret?: string;
  xrayBaseUrl?: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    miroAccessToken: env.MIRO_ACCESS_TOKEN,
    xrayClientId: env.XRAY_CLIENT_ID,
    xrayClientSecret: env.XRAY_CLIENT_SECRET,
    xrayBaseUrl: env.XRAY_BASE_URL ?? 'https://xray.cloud.getxray.app'
  };
}
