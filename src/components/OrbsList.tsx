import { memo } from 'react'
import type { Orb } from '../game/orb'
import type { Simulation } from '../game/simulation'
import { useThrottledSimulationVersion } from '../hooks/useSimulation'

/** How often the list catches up with a running game, in ms. */
const REFRESH_MS = 250

type OrbsListProps = {
  simulation: Simulation
  onSelectOrb: (orb: Orb) => void
  onClose: () => void
}

/** Every living orb by name. */
export const OrbsList = memo(function OrbsList({ simulation, onSelectOrb, onClose }: OrbsListProps) {
  useThrottledSimulationVersion(simulation, REFRESH_MS)
  const orbs = [ ...simulation.orbs ].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="orbs-list">
      <div className="orb-story__header">
        <div>Orbs List ({orbs.length})</div>
        <button onClick={onClose}>⤫</button>
      </div>

      {orbs.map(orb => (
        <div key={orb.id} className="orbs-list-item" onClick={() => onSelectOrb(orb)}>
          {orb.name}, {orb.hp}❤️, age {orb.age}
        </div>
      ))}
    </div>
  )
})
