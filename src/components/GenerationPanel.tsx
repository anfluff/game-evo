import { memo } from 'react'
import type { Orb } from '../game/orb'
import type { Simulation } from '../game/simulation'
import { createGenerationStats, type GenerationStats } from '../game/stats'
import { useThrottledSimulationVersion } from '../hooks/useSimulation'
import { orbColor } from '../render/orbColor'
import { GenerationChart } from './GenerationChart'
import { GENERATION_METRICS, metricsInOrder } from './generationMetrics'

/** How often the panel catches up with a running game, in ms. */
const REFRESH_MS = 250

const SUMMARY_METRICS = metricsInOrder([
  'turns',
  'avg_population',
  'highest_age',
  'energy_start',
  'births',
  'consumed_energy',
  'hp_gained_consuming_energy',
  'hp_gained_eating',
  'eaten',
  'killed',
  'no_hp'
])

type GenerationPanelProps = {
  simulation: Simulation
  /** Index of the generation whose numbers are shown. */
  activeTab: number
  onTabChange: (index: number) => void
  chartAnimated: boolean
  onSelectOrb: (orb: Orb) => void
}

/** History of the run: per-generation numbers, the most successful orbs of each generation, and trends. */
export const GenerationPanel = memo(function GenerationPanel({
  simulation,
  activeTab,
  onTabChange,
  chartAnimated,
  onSelectOrb
}: GenerationPanelProps) {
  useThrottledSimulationVersion(simulation, REFRESH_MS)

  const generations = simulation.generationStats
  const lastTab = Math.max(0, generations.length - 1)
  const stats = generations[activeTab] ?? createGenerationStats()
  const strongest = simulation.strongestPerGeneration[activeTab] ?? []

  return (
    <div className="bottom-panels">
      <div className="gen-tabs">
        <button onClick={() => onTabChange(0)} disabled={activeTab === 0}>
          first
        </button>
        <button onClick={() => onTabChange(Math.max(0, activeTab - 1))} disabled={activeTab === 0}>
          &lt;
        </button>
        <input
          type="number"
          min={1}
          max={lastTab + 1}
          value={Math.min(Math.max(1, activeTab + 1), lastTab + 1)}
          onChange={(e) => {
            const value = Number(e.target.value)
            if (Number.isNaN(value)) return
            onTabChange(Math.max(1, Math.min(value, lastTab + 1)) - 1)
          }}
        />
        <button onClick={() => onTabChange(Math.min(lastTab, activeTab + 1))} disabled={activeTab >= lastTab}>
          &gt;
        </button>
        <button onClick={() => onTabChange(lastTab)} disabled={activeTab >= lastTab}>
          last
        </button>
      </div>

      <div className="gen-tab-content">
        <ul>
          {SUMMARY_METRICS.map(metric => (
            <li key={metric.key}>{metric.key}: {metric.value(stats)}</li>
          ))}
        </ul>
        <div className="strongest-orbs-section">
          <div className="strongest-orbs-title">Strongest Orbs</div>
          <div className="saved-orbs-grid">
            {strongest.length > 0 ? (
              strongest.map((orb, index) => (
                <div
                  key={`saved-orb-${activeTab}-${index}-${orb.id}`}
                  className="saved-orb"
                  title={`Children: ${orb.children}, age: ${orb.age}`}
                  onClick={() => onSelectOrb(orb)}
                >
                  <div className="saved-orb-circle" style={{ backgroundColor: orbColor(orb.genes) }} />
                  <div className="saved-orb-id">{orb.name}</div>
                  <div className="saved-orb-age">kids: {orb.children}, age: {orb.age}</div>
                </div>
              ))
            ) : (
              <div className="saved-orbs-empty">No strongest orbs saved yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="gen-chart">
        <GenerationChart generations={generations} animated={chartAnimated} />
      </div>

      <div className="gen-top-bottom">
        <TopBottomStats generations={generations} />
      </div>
    </div>
  )
})

/** For every metric, the five generations with the highest and the lowest value. */
function TopBottomStats({ generations }: { generations: GenerationStats[] }) {
  // The generation in progress has partial totals, so it is ranked only while it is the only one.
  const finished = generations.length > 1 ? generations.slice(0, -1) : generations
  if (finished.length === 0) {
    return <div className="empty">No data yet</div>
  }
  const count = Math.min(5, finished.length)

  return (
    <div>
      <div className="strongest-orbs-title">Top 5 / Bottom 5 by stat (finished generations)</div>
      {GENERATION_METRICS.map(metric => {
        const pairs = finished.map((stats, index) => ({ index, value: metric.value(stats) }))
        const top = [ ...pairs ].sort((a, b) => b.value - a.value).slice(0, count)
        const bottom = [ ...pairs ].sort((a, b) => a.value - b.value).slice(0, count)
        return (
          <div key={metric.key} className="metric-block">
            <div className="metric-name">{metric.key}</div>
            <div className="metric-lists">
              <div className="metric-list">
                <div className="list-title">most</div>
                <ul>
                  {top.map(pair => (
                    <li key={pair.index}>Gen {pair.index + 1}: {pair.value}</li>
                  ))}
                </ul>
              </div>
              <div className="metric-list">
                <div className="list-title">least</div>
                <ul>
                  {bottom.map(pair => (
                    <li key={pair.index}>Gen {pair.index + 1}: {pair.value}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
