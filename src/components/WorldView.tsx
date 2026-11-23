import { memo, useEffect, useRef } from 'react'
import type { Orb } from '../game/orb'
import type { Simulation } from '../game/simulation'
import { WorldRenderer, worldPixelSize } from '../render/worldRenderer'

type WorldViewProps = {
  simulation: Simulation
  selectedOrb: Orb | null
  /** Glows, arrows and gliding movement. */
  effectsEnabled: boolean
  onSelectOrb: (orb: Orb) => void
}

/**
 * The playing field. React only provides the element of the world's full
 * size, so the page lays out and scrolls as usual. The drawing is done by
 * `WorldRenderer`, which follows the simulation on its own.
 */
export const WorldView = memo(function WorldView({
  simulation,
  selectedOrb,
  effectsEnabled,
  onSelectOrb
}: WorldViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WorldRenderer | null>(null)
  const latest = useRef({ selectedOrb, effectsEnabled })

  useEffect(() => {
    latest.current = { selectedOrb, effectsEnabled }
    rendererRef.current?.setSelectedOrb(selectedOrb)
    rendererRef.current?.setEffectsEnabled(effectsEnabled)
  }, [ selectedOrb, effectsEnabled ])

  useEffect(() => {
    const renderer = new WorldRenderer(containerRef.current!, canvasRef.current!, simulation, latest.current)
    rendererRef.current = renderer
    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [ simulation ])

  const { width, height } = worldPixelSize(simulation)

  return (
    <div
      ref={containerRef}
      className="world"
      style={{ width, height }}
      onClick={(e) => {
        const orb = rendererRef.current?.orbAt(e.clientX, e.clientY)
        if (orb) {
          onSelectOrb(orb)
        }
      }}
    >
      <canvas ref={canvasRef} className="world-canvas" role="img" aria-label="World map" />
    </div>
  )
})
