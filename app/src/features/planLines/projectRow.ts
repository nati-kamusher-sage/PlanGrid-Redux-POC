import type { PlanLine } from './types'

/**
 * Produces a plain, writable row object for AG Grid's row model from a
 * canonical (Immer-frozen) Redux entity. AG Grid's cell editors write the
 * in-progress edit value onto the row object it was given; the Redux entity
 * itself must never be mutated directly.
 */
export function projectPlanLineForGrid(entity: PlanLine): PlanLine {
  return {
    ...entity,
    monthlyValuesByPeriodId: { ...entity.monthlyValuesByPeriodId },
  }
}
