# PlanGrid Redux POC

A browser-based proof of concept for a Planning Grid backed by Redux Toolkit and
AG Grid. It is intended to show that editing one planning cell can update only the
affected grid row, without replacing the entire grid data set.

## Scope

- 1,000 deterministic, editable planning lines by default
- Redux as the authoritative state for plan-line values
- Targeted AG Grid row transactions after an edit
- Instrumentation and browser benchmarks for update scope and latency

The project is an experiment for evaluating the integration pattern; it is not a
production Planning Grid or an ECP-1 implementation.

## Product requirements

The detailed requirements and acceptance criteria are in
[the POC PRD](docs/planning-grid-redux-ag-grid-prd.md). Delivery is sequenced as a
series of small pull requests; see the
[implementation plan](docs/implementation-plan.md).

## App

The standalone demo app lives in [`app/`](app/).

### Run it locally

```sh
cd app
npm install
npm run dev
```

Then open the URL Vite prints (typically <http://localhost:5173>) in a
browser to see the Planning Grid.

**Do not use the dev server to judge performance.** The instrumentation
panel's sync-CPU and edit-to-paint numbers are only meaningful against a
production build — dev mode leaves React in development mode and keeps
Redux Toolkit's `immutableCheck`/`serializableCheck` active, which alone
accounts for roughly a 10x inflation over production numbers at 50,000 rows.
To see representative timings:

```sh
npm run build
npm run preview
```

then open the printed preview URL. Every benchmark number in
[`docs/benchmark-results/`](docs/benchmark-results/) was captured this way
(`npm run test:browser`, which builds and serves production automatically —
see below). See [`app/README.md`](app/README.md) for the full command
reference.

## How the integration works

[`docs/redux-ag-grid-integration.md`](docs/redux-ag-grid-integration.md)
walks through the three techniques that keep a cell edit to a single-row AG
Grid update: normalized Redux state, a one-time (not live) projection from
Redux into `rowData`, and a bridge that hands the grid a one-row
`applyTransaction` instead of replacing the dataset.

## Benchmark result

The POC's final result and recommendation, at the 50,000-row scale required
by [demo preview results](docs/demo%20preview%20results.md), are in the
[Phase 2 decision
record](docs/benchmark-results/phase-2/decision-record.md): **proceed**,
adopting the typed hot-result buffer, with the tradeoffs that need
production-design review listed there.

The original 1,000-row result,
[`docs/benchmark-results/README.md`](docs/benchmark-results/README.md), is
superseded by the above but kept for history — it validated the grid
integration pattern before the 50,000-row scale and normalized XPNA model
were in scope. Its own reference environment was recorded after the fact
(at PR 7 of the original plan, not before PR 1 as intended); the Phase 2
decision record repeats and updates that caveat.
