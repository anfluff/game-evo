import { useCallback, useEffect, useState } from 'react'
import './styles/App.css'
import { ControlBar, FASTEST_TURN_MS, SLOWEST_TURN_MS } from './components/ControlBar'
import { GenerationPanel } from './components/GenerationPanel'
import { OrbsList } from './components/OrbsList'
import { OrbStory } from './components/OrbStory'
import { SettingsPanel } from './components/SettingsPanel'
import { HelpPanel } from './components/HelpPanel'
import { WorldView } from './components/WorldView'
import type { Orb } from './game/orb'
import { resetSettings, saveSettings, type Settings } from './game/settings'
import type { Simulation } from './game/simulation'
import { useGameLoop } from './hooks/useGameLoop'
import { useKeyboardShortcuts, type Shortcut } from './hooks/useKeyboardShortcuts'
import { useSimulationVersion } from './hooks/useSimulation'

/** Turn durations of the speed presets on keys 1 to 5, in ms. */
const SPEED_PRESETS = [ 500, 350, 200, 100, 1 ]

function App({ simulation }: { simulation: Simulation }) {
  const { settings } = simulation
  useSimulationVersion(simulation)

  const [ paused, setPaused ] = useState(true)
  const [ turnDuration, setTurnDuration ] = useState(settings.initialTurnDuration)
  const [ graphicsEnabled, setGraphicsEnabled ] = useState(settings.graphicEffects)
  const [ selectedOrb, setSelectedOrb ] = useState<Orb | null>(null)
  // null follows the generation in progress, which changes on its own as the world ages.
  const [ pinnedGenTab, setPinnedGenTab ] = useState<number | null>(null)
  const [ showSettings, setShowSettings ] = useState(false)
  const [ draftSettings, setDraftSettings ] = useState<Settings>(settings)
  const [ showHelp, setShowHelp ] = useState(false)
  const [ showOrbsList, setShowOrbsList ] = useState(false)

  // ---- game control ----

  const restart = () => {
    setPaused(true)
    setSelectedOrb(null)
    setPinnedGenTab(null)
    simulation.reset()
  }

  const nextGeneration = () => {
    simulation.advanceGeneration()
    setSelectedOrb(null)
    setPinnedGenTab(null)
  }

  const stepOnce = () => {
    setPaused(true)
    simulation.step()
  }

  useGameLoop(simulation, { paused, turnDuration, onExtinction: nextGeneration })

  const selectOrb = useCallback((orb: Orb) => {
    // A dead orb keeps the last thing it saw. A living one shows what it sees now.
    if (orb.alive) {
      orb.refreshSnapshot()
    }
    setSelectedOrb(orb)
  }, [])

  // The selected orb explains its decisions in the browser console.
  useEffect(() => {
    simulation.setDebugOrb(selectedOrb?.id ?? null)
  }, [ simulation, selectedOrb ])

  // ---- preferences ----

  const changeGraphics = (enabled: boolean) => {
    setGraphicsEnabled(enabled)
    saveSettings({ ...settings, graphicEffects: enabled })
  }

  // CSS transitions and glows outside the canvas follow the same switch.
  useEffect(() => {
    document.body.classList.toggle('no-effects', !graphicsEnabled)
  }, [ graphicsEnabled ])

  const openSettings = () => {
    setPaused(true)
    setShowSettings(true)
  }

  // World size and rules are fixed for the lifetime of a simulation, so new settings need a reload.
  const saveSettingsAndReload = () => {
    saveSettings({ ...draftSettings, graphicEffects: graphicsEnabled })
    window.location.reload()
  }

  const resetSettingsAndReload = () => {
    resetSettings()
    window.location.reload()
  }

  const closeOrbsList = useCallback(() => setShowOrbsList(false), [])

  // ---- keyboard ----

  const shortcuts: Record<string, Shortcut> = {
    Space: { run: () => setPaused(p => !p) },
    Escape: { run: () => setSelectedOrb(null), repeat: true },
    Equal: { run: () => setTurnDuration(d => Math.max(FASTEST_TURN_MS, d - 10)), repeat: true },
    Minus: { run: () => setTurnDuration(d => Math.min(SLOWEST_TURN_MS, d + 10)), repeat: true },
    BracketRight: { run: stepOnce },
    KeyG: { run: () => changeGraphics(!graphicsEnabled) },
    KeyM: { run: restart },
    KeyN: {
      run: () => {
        setPaused(true)
        nextGeneration()
      }
    },
    KeyS: { run: () => (showSettings ? setShowSettings(false) : openSettings()) },
    KeyO: { run: () => setShowOrbsList(open => !open) }
  }
  SPEED_PRESETS.forEach((duration, index) => {
    const preset: Shortcut = { run: () => setTurnDuration(duration) }
    shortcuts[`Digit${index + 1}`] = preset
    shortcuts[`Numpad${index + 1}`] = preset
  })
  useKeyboardShortcuts(shortcuts)

  return (
    <>
      <ControlBar
        generation={simulation.generation}
        turn={simulation.turn}
        paused={paused}
        turnDuration={turnDuration}
        graphicsEnabled={graphicsEnabled}
        onTogglePause={() => setPaused(p => !p)}
        onStep={() => simulation.step()}
        onRestart={restart}
        onNextGeneration={() => {
          setPaused(true)
          nextGeneration()
        }}
        onTurnDurationChange={setTurnDuration}
        onGraphicsChange={changeGraphics}
        onOpenSettings={openSettings}
        onOpenOrbsList={() => setShowOrbsList(true)}
      />

      <div className="content">
        <div className="world-panel">
          {showOrbsList && (
            <OrbsList simulation={simulation} onSelectOrb={selectOrb} onClose={closeOrbsList} />
          )}
          <WorldView
            simulation={simulation}
            selectedOrb={selectedOrb}
            effectsEnabled={graphicsEnabled}
            onSelectOrb={selectOrb}
          />
        </div>

        {selectedOrb && (
          <OrbStory
            orb={selectedOrb}
            defaultScanRadius={settings.scanRadius}
            onClose={() => setSelectedOrb(null)}
          />
        )}

        <GenerationPanel
          simulation={simulation}
          activeTab={pinnedGenTab ?? simulation.generation}
          onTabChange={index => setPinnedGenTab(index >= simulation.generation ? null : index)}
          chartAnimated={graphicsEnabled}
          onSelectOrb={selectOrb}
        />
      </div>

      {showSettings && (
        <SettingsPanel
          draftSettings={draftSettings}
          setDraftSettings={setDraftSettings}
          onSave={saveSettingsAndReload}
          onResetDefaults={resetSettingsAndReload}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHelp && <HelpPanel settings={settings} onClose={() => setShowHelp(false)} />}

      <button className="shortcuts-fab" onClick={() => setShowHelp(s => !s)} title="Rules and shortcuts">
        ?
      </button>
    </>
  )
}

export default App
