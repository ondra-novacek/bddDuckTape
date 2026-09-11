# BDD Duck Tape

Fetch BDD scenarios from Miro stickers and load them into Jira X-ray.

## Setup

Create `.env` from `.env.example`:

```dotenv
MIRO_ACCESS_TOKEN=replace-with-miro-token
XRAY_CLIENT_ID=replace-with-xray-client-id
XRAY_CLIENT_SECRET=replace-with-xray-client-secret
JIRA_BASE_URL=https://levelworks.atlassian.net
JIRA_EMAIL=replace-with-atlassian-account-email
JIRA_API_TOKEN=replace-with-jira-api-token
GEMINI_API_KEY=replace-with-gemini-api-key
```

## Run

```bash
npm install
npm run dev
```
