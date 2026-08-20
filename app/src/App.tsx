import { useSelector } from 'react-redux'
import type { RootState } from './app/store'
import { FixtureSizeSelector } from './features/planLines/FixtureSizeSelector'
import { PlanningGrid } from './features/planLines/PlanningGrid'

function App() {
  const fixtureSize = useSelector((state: RootState) => state.planLines.fixtureSize)

  return (
    <main data-testid="planning-grid-poc">
      <header>
        <h1>Planning Grid POC</h1>
        <p>Plan / Version: FY26 Budget (demo)</p>
        <FixtureSizeSelector />
      </header>
      <div data-testid="planning-grid" style={{ height: 600, width: '100%' }}>
        <PlanningGrid key={fixtureSize} />
      </div>
    </main>
  )
}

export default App
