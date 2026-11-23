import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Simulation } from '../game/simulation'

/** Re-renders the component after every change of the simulation. */
export function useSimulationVersion(simulation: Simulation): number {
  return useSyncExternalStore(simulation.subscribe, simulation.getVersion)
}

/**
 * Re-renders the component when the simulation changes, but no more often
 * than once per `intervalMs`. For panels that would otherwise redo heavy
 * work on every turn of a fast-running game.
 */
export function useThrottledSimulationVersion(simulation: Simulation, intervalMs: number): number {
  const [ version, setVersion ] = useState(simulation.getVersion)

  useEffect(() => {
    let timer: number | null = null
    let lastFlush = 0
    const flush = () => {
      timer = null
      lastFlush = performance.now()
      setVersion(simulation.getVersion())
    }
    const unsubscribe = simulation.subscribe(() => {
      if (timer !== null) {
        return
      }
      const wait = intervalMs - (performance.now() - lastFlush)
      if (wait <= 0) {
        flush()
      } else {
        timer = window.setTimeout(flush, wait)
      }
    })
    return () => {
      unsubscribe()
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [ simulation, intervalMs ])

  return version
}
