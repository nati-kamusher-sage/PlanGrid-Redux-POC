# Planning Grid POC — app

Standalone Vite + React + TypeScript app for the
[Planning Grid Redux + AG Grid POC](../docs/planning-grid-redux-ag-grid-prd.md).

## Setup

```sh
npm install
npx playwright install --with-deps chromium
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local dev server with HMR — functional use only, **not for judging performance** |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally — use this to check the instrumentation panel's numbers |
| `npm run lint` | Run oxlint |
| `npm run test:unit` | Run Vitest unit tests (`src/**/*.test.ts`) |
| `npm run test:browser` | Run Playwright tests against a production build (builds and serves automatically) |

## Verification

```sh
npm run build
npm run lint
npm run test:unit
npm run test:browser
```

`test:browser` builds the app and serves it via `vite preview` before running
Playwright, so benchmark and functional browser tests always run against a
production-like build.

## Checking performance manually

Always use `npm run build && npm run preview`, never `npm run dev`, when
reading the instrumentation panel's sync-CPU or edit-to-paint numbers by eye.
Dev mode leaves React in development mode and keeps Redux Toolkit's
`immutableCheck`/`serializableCheck` running on every dispatch — together
these inflate sync-CPU by roughly an order of magnitude at 50,000 rows, which
reads as a regression that isn't real. Every number in
[`../docs/benchmark-results/`](../docs/benchmark-results/) was captured
against a production build; compare like for like.

## Versions

Runtime and tooling dependency versions are pinned exact (no `^`/`~` ranges) in
`package.json`. Notable versions:

- React 19.2.8
- AG Grid (community + react) 36.1.0
- Redux Toolkit 2.12.0 / React Redux 9.3.0
- Playwright 1.62.1
- Vite 8.2.2 / TypeScript 6.0.3
