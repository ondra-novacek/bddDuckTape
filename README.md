# BDD Duck Tape

Local TypeScript app for fetching sticky note text from a Miro board. This first slice only reads Miro data and displays/logs it locally.

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

## Verify

```bash
npm run test
npm run typecheck
npm run build
```
