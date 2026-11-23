import { useEffect, useEffectEvent } from 'react'
import type { Simulation } from '../game/simulation'
import { useSimulationVersion } from './useSimulation'

/**
 * While not paused, plays one turn every `turnDuration` ms. The next turn is
 * scheduled only after the previous one has rendered, so a slow frame delays
 * the game instead of queueing turns. When every orb is dead, calls `onExtinction`,
 * which is expected to reseed the world.
 */
export function useGameLoop(
  simulation: Simulation,
  options: { paused: boolean; turnDuration: number; onExtinction: () => void }
) {
  const { paused, turnDuration, onExtinction } = options
  const version = useSimulationVersion(simulation)

  const tick = useEffectEvent(() => {
    if (simulation.orbs.length > 0) {
      simulation.step()
    } else if (simulation.turn > 0) {
      onExtinction()
    }
  })

  useEffect(() => {
    if (paused) {
      return
    }
    const timeout = setTimeout(() => tick(), turnDuration)
    return () => clearTimeout(timeout)
  }, [ version, turnDuration, paused ])
}
