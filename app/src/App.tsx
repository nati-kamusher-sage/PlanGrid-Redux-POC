import { useSelector } from 'react-redux'
import type { RootState } from './app/store'
import { FixtureSizeSelector } from './features/planningModel/FixtureSizeSelector'
import { PlanningGrid } from './features/planningModel/PlanningGrid'
import { InstrumentationPanel } from './instrumentation/InstrumentationPanel'

function App() {
  const fixtureSize = useSelector((state: RootState) => state.planningModel.fixtureSize)

  return (
    <main
      data-testid="planning-grid-poc"
      style={{
        padding: '24px 32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 1360,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Planning Grid POC</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Plan / Version: FY26 Budget (demo)</p>
        <FixtureSizeSelector />
      </header>
      <InstrumentationPanel />
      <div
        data-testid="planning-grid"
        style={{ height: 600, width: '100%', border: '1px solid var(--border)', borderRadius: 8 }}
      >
        <PlanningGrid key={fixtureSize} />
      </div>
    </main>
  )
}

export default App
