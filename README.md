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

The standalone demo app lives in [`app/`](app/). See
[`app/README.md`](app/README.md) for setup and verification commands.

## How the integration works

[`docs/redux-ag-grid-integration.md`](docs/redux-ag-grid-integration.md)
walks through the three techniques that keep a cell edit to a single-row AG
Grid update: normalized Redux state, a one-time (not live) projection from
Redux into `rowData`, and a bridge that hands the grid a one-row
`applyTransaction` instead of replacing the dataset.

## Benchmark result

The POC's final result and recommendation are in
[`docs/benchmark-results/README.md`](docs/benchmark-results/README.md). The
reference environment was recorded at PR 7 rather than before PR 1 as the
plan intended; see that note for the caveat this implies for the next design
review.
