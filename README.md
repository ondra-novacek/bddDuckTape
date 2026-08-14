# BDD Duck Tape

Local TypeScript app for fetching sticky note text from a Miro board. It reads blue and green sticky notes, groups green items under blue headers, and displays/logs the result locally.

## Setup

Create `.env` from `.env.example`:

```dotenv
MIRO_ACCESS_TOKEN=replace-with-miro-token
XRAY_CLIENT_ID=replace-with-xray-client-id
XRAY_CLIENT_SECRET=replace-with-xray-client-secret
XRAY_BASE_URL=https://xray.cloud.getxray.app
PORT=3001
```

The Miro token needs board read access for the board you want to inspect.
The Xray credentials need permission to create Tests and add Tests to the target Test Set.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and paste the Miro board ID into the form.

Blue sticky notes are treated as group headers. Green sticky notes are treated as group items and assigned to the nearest blue header above them in the same visual column. Other sticky note colors are ignored.

For Xray export, each green sticky note is parsed as one Cucumber Test. The first non-empty line is the Test summary and the remaining lines are the Gherkin body. Blue notes are only used to order groups. Enter the Xray Test Set key or Jira issue URL, for example `LW1-28042` or `https://levelworks.atlassian.net/browse/LW1-28042`, then create the Tests in Xray. The app derives the project key from the Test Set key and resolves Xray's internal Test Set issue ID through Xray Cloud. Export is create-only, so running it again creates duplicate Tests.

## Verify

```bash
npm run test
npm run typecheck
npm run build
```
