import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../app/store'
import { fixtureReset } from './planningModelSlice'
import type { FixtureSize } from './types'

const FIXTURE_SIZES: FixtureSize[] = [100, 1000, 50_000]

export function FixtureSizeSelector() {
  const dispatch = useDispatch<AppDispatch>()
  const fixtureSize = useSelector((state: RootState) => state.planningModel.fixtureSize)

  return (
    <label>
      Fixture size:{' '}
      <select
        value={fixtureSize}
        onChange={(event) => {
          dispatch(fixtureReset({ size: Number(event.target.value) as FixtureSize }))
        }}
      >
        {FIXTURE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size.toLocaleString()} rows
          </option>
        ))}
      </select>
    </label>
  )
}
