export interface ChangedRow {
  planLineId: string
  row: number
  columns: string[]
}

type Listener = (changedRows: ChangedRow[]) => void

/**
 * The changed-row notification boundary (Phase 2 plan, PR 4): a result
 * mutation names its row and affected columns directly (no diffing of the
 * result collection).
 *
 * `notifyChangedRow` flushes synchronously by default -- same call stack as
 * the dispatch that produced it -- so a single normal edit's grid-refresh
 * cost is part of the same synchronous CPU measurement window, matching the
 * plan's edit flow (valueSetter -> dispatch -> reducer -> notifier ->
 * refreshCells, no async boundary).
 *
 * A burst (paste, a formula/cascade, or any caller issuing several
 * synchronous dispatches together) opts into coalescing explicitly by
 * wrapping those dispatches in `batchChangedRowNotifications`: notifications
 * raised inside the callback are merged by row/column and flushed once, at
 * an animation-frame boundary, instead of one grid operation per action.
 */
let pendingBatch: Map<string, ChangedRow> | null = null
const listeners = new Set<Listener>()

function mergeInto(target: Map<string, ChangedRow>, row: ChangedRow): void {
  const existing = target.get(row.planLineId)
  if (!existing) {
    target.set(row.planLineId, { ...row, columns: [...row.columns] })
    return
  }
  for (const column of row.columns) {
    if (!existing.columns.includes(column)) {
      existing.columns.push(column)
    }
  }
}

function notifyListeners(changedRows: ChangedRow[]): void {
  if (changedRows.length === 0) {
    return
  }
  for (const listener of listeners) {
    listener(changedRows)
  }
}

export function subscribeToChangedRows(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Notifies that one plan line's result changed. Outside a batch, this
 * flushes to listeners synchronously before returning. Inside
 * `batchChangedRowNotifications`, it instead merges into that batch.
 */
export function notifyChangedRow(row: ChangedRow): void {
  if (pendingBatch) {
    mergeInto(pendingBatch, row)
    return
  }
  notifyListeners([row])
}

/**
 * Runs `work`, coalescing every `notifyChangedRow` call it makes (directly
 * or through nested dispatches) into one row/column-deduplicated batch,
 * flushed once at the next animation-frame boundary after `work` returns.
 * Intended for a bulk/cascade path (paste, formula recalculation); an
 * ordinary single-cell edit must not use this.
 */
export function batchChangedRowNotifications(work: () => void): void {
  const outerBatch = pendingBatch
  const batch = outerBatch ?? new Map<string, ChangedRow>()
  pendingBatch = batch

  try {
    work()
  } finally {
    pendingBatch = outerBatch
  }

  if (outerBatch) {
    // Nested batch: let the outermost call own the flush.
    return
  }

  requestAnimationFrame(() => {
    notifyListeners(Array.from(batch.values()))
  })
}

/** Test-only: clears listeners and any in-flight batch between tests. */
export function resetChangedRowNotifierForTest(): void {
  pendingBatch = null
  listeners.clear()
}
