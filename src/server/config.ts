export interface AppConfig {
  miroAccessToken?: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    miroAccessToken: env.MIRO_ACCESS_TOKEN
  };
}
