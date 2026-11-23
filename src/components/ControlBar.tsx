/** Turn duration at the slow end of the speed slider, in ms. */
export const SLOWEST_TURN_MS = 500
/** Turn duration at the fast end of the speed slider, in ms. */
export const FASTEST_TURN_MS = 1

type ControlBarProps = {
  generation: number
  turn: number
  paused: boolean
  /** Milliseconds per turn. */
  turnDuration: number
  graphicsEnabled: boolean
  onTogglePause: () => void
  onStep: () => void
  onRestart: () => void
  onNextGeneration: () => void
  onTurnDurationChange: (ms: number) => void
  onGraphicsChange: (enabled: boolean) => void
  onOpenSettings: () => void
  onOpenOrbsList: () => void
}

export function ControlBar({
  generation,
  turn,
  paused,
  turnDuration,
  graphicsEnabled,
  onTogglePause,
  onStep,
  onRestart,
  onNextGeneration,
  onTurnDurationChange,
  onGraphicsChange,
  onOpenSettings,
  onOpenOrbsList
}: ControlBarProps) {
  // The slider runs slow to fast, the opposite of the turn duration.
  const sliderSpan = SLOWEST_TURN_MS + FASTEST_TURN_MS
  const sliderValue = Math.max(FASTEST_TURN_MS, Math.min(SLOWEST_TURN_MS, sliderSpan - turnDuration))

  return (
    <div className="actions-bar">
      <div className='actions-bar-panel'>
        <div>gen: {generation}</div>
        <div>turn: {turn}</div>
      </div>

      <div className='actions-bar-panel'>
        <button disabled={turn === 0} onClick={onRestart}>
          ↪️ Restart
        </button>

        <div>
          <label style={{ marginRight: 6 }}>Speed</label>
          <input
            type="range"
            min={FASTEST_TURN_MS}
            max={SLOWEST_TURN_MS}
            step={1}
            value={sliderValue}
            onChange={(e) => onTurnDurationChange(sliderSpan - Number(e.target.value))}
            style={{ width: 160, margin: '0 8px', verticalAlign: 'middle' }}
            title="Turn speed (slow ↔ fast)"
          />
          <button onClick={onTogglePause} title={paused ? 'Resume' : 'Pause'}>
            {paused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
          <button onClick={onStep} disabled={!paused} title="Step one turn">
            ➡️
          </button>
        </div>

        <button disabled={turn === 0} onClick={onNextGeneration}>
          ⏭️ New Gen
        </button>

        <label title="Toggle graphics effects (animations, glows)">
          Graphics
          <input
            type="checkbox"
            checked={graphicsEnabled}
            onChange={(e) => onGraphicsChange(e.target.checked)}
            style={{ marginLeft: 6 }}
          />
        </label>

        <button onClick={onOpenSettings} title="Open settings">
          ⚙️
        </button>

        <button onClick={onOpenOrbsList} title="Open Orbs List">
          Orbs List
        </button>
      </div>
    </div>
  )
}
