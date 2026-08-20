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
[the POC PRD](docs/planning-grid-redux-ag-grid-prd.md).
