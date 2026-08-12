# Sleeper Sidekick

Fantasy football analytics that Sleeper doesn't compute for you. See [PLAN.md](PLAN.md) for the architecture and build plan, [PROMPT.md](PROMPT.md) for the original brief.

## Local dev

```bash
npm install
npm run dev
```

Serves at `http://localhost:5173`.

```bash
npm test       # run the stat-function test suite
npm run players  # regenerate public/players.json from the Sleeper API
```
