# BDD Duck Tape

Local TypeScript app for fetching sticky note text from a Miro board. It reads blue and green sticky notes, groups green items under blue headers, and displays/logs the result locally.

## Setup

Create `.env` from `.env.example`:

```dotenv
MIRO_ACCESS_TOKEN=replace-with-miro-token
PORT=3001
```

The Miro token needs board read access for the board you want to inspect.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and paste the Miro board ID into the form.

Blue sticky notes are treated as group headers. Green sticky notes are treated as group items and assigned to the nearest blue header above them in the same visual column. Other sticky note colors are ignored.

## Verify

```bash
npm run test
npm run typecheck
npm run build
```
