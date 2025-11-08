import React from 'react'

// Settings model and helpers (moved from src/settings.ts)
export type Settings = {
  worldSize: [number, number]
  initialOrbHP: [number, number]
  initialOrbsCount: number
  newGenStrongestCount: number
  newGenOffspringPerParent: number
  initialEnergyOnMap: number
  resetEnergyOnNewGenerations: boolean
  splitHPThreshold: number
  hpGainByEnergyConsumption: number
  energyCreatedOnDeath: number
  dnaLength: number
  reactionsLength: number
  reactionDirectionsLength: number
  idLength: number
  initialTurnDuration: number
}

export const defaultSettings: Settings = {
  worldSize: [15, 25],
  initialOrbHP: [8, 16],
  initialOrbsCount: 30,
  newGenStrongestCount: 10,
  newGenOffspringPerParent: 3,
  initialEnergyOnMap: 300,
  resetEnergyOnNewGenerations: false,
  splitHPThreshold: 6,
  hpGainByEnergyConsumption: 3,
  energyCreatedOnDeath: 2,
  dnaLength: 36,
  reactionsLength: 5,
  reactionDirectionsLength: 4,
  idLength: 6,
  initialTurnDuration: 100,
}

const STORAGE_KEY = 'life1_settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    const merged: Settings = {
      ...defaultSettings,
      ...parsed
    }
    return sanitizeSettings(merged)
  } catch {
    return defaultSettings
  }
}

export function saveSettings(next: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(next)))
}

export function resetSettings() {
  localStorage.removeItem(STORAGE_KEY)
}

function clamp(n: number, min: number, max?: number): number {
  const base = isFinite(n) ? Math.floor(n) : min
  const clampedMin = Math.max(min, base)
  if (typeof max === 'number' && isFinite(max)) {
    return Math.min(clampedMin, max)
  }
  return clampedMin
}

export function sanitizeSettings(s: Settings): Settings {
  const rows = clamp(s.worldSize?.[0] ?? defaultSettings.worldSize[0], 1)
  const cols = clamp(s.worldSize?.[1] ?? defaultSettings.worldSize[1], 1)
  const hpMin = clamp(s.initialOrbHP?.[0] ?? defaultSettings.initialOrbHP[0], 1)
  const hpMaxRaw = s.initialOrbHP?.[1] ?? defaultSettings.initialOrbHP[1]
  const hpMax = clamp(hpMaxRaw, hpMin)

  return {
    worldSize: [rows, cols],
    initialOrbHP: [hpMin, hpMax],
    initialOrbsCount: clamp(s.initialOrbsCount ?? defaultSettings.initialOrbsCount, 1),
    newGenStrongestCount: clamp(s.newGenStrongestCount ?? defaultSettings.newGenStrongestCount, 1),
    newGenOffspringPerParent: clamp(s.newGenOffspringPerParent ?? defaultSettings.newGenOffspringPerParent, 1),
    initialEnergyOnMap: clamp(s.initialEnergyOnMap ?? defaultSettings.initialEnergyOnMap, 0),
    resetEnergyOnNewGenerations: Boolean(s.resetEnergyOnNewGenerations),
    splitHPThreshold: clamp(s.splitHPThreshold ?? defaultSettings.splitHPThreshold, 1),
    hpGainByEnergyConsumption: clamp(s.hpGainByEnergyConsumption ?? defaultSettings.hpGainByEnergyConsumption, 0),
    energyCreatedOnDeath: clamp(s.energyCreatedOnDeath ?? defaultSettings.energyCreatedOnDeath, 0),
    dnaLength: clamp(s.dnaLength ?? defaultSettings.dnaLength, 1),
    reactionsLength: clamp(s.reactionsLength ?? defaultSettings.reactionsLength, 1),
    reactionDirectionsLength: clamp(s.reactionDirectionsLength ?? defaultSettings.reactionDirectionsLength, 1),
    idLength: clamp(s.idLength ?? defaultSettings.idLength, 1),
    initialTurnDuration: clamp(s.initialTurnDuration ?? defaultSettings.initialTurnDuration, 1),
  }
}

type SettingsPanelProps = {
  draftSettings: Settings
  setDraftSettings: React.Dispatch<React.SetStateAction<Settings>>
  onClose: () => void
}

export function SettingsPanel({
  draftSettings,
  setDraftSettings,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div>Settings</div>
        <button onClick={onClose}>⤫</button>
      </div>
      <div className="settings-content">
        <div className="settings-row">
          <label>World rows</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.worldSize[0]}
                 onChange={(e) => setDraftSettings(s => ({ ...s, worldSize: [ Math.max(1, Number(e.target.value)), s.worldSize[1] ] }))} />
        </div>
        <div className="settings-row">
          <label>World cols</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.worldSize[1]}
                 onChange={(e) => setDraftSettings(s => ({ ...s, worldSize: [ s.worldSize[0], Math.max(1, Number(e.target.value)) ] }))} />
        </div>

        <div className="settings-row">
          <label>Initial Orb HP min</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.initialOrbHP[0]}
                 onChange={(e) => setDraftSettings(s => ({ ...s, initialOrbHP: [ Math.max(1, Number(e.target.value)), Math.max(Math.max(1, Number(e.target.value)), s.initialOrbHP[1]) ] }))} />
        </div>
        <div className="settings-row">
          <label>Initial Orb HP max</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.initialOrbHP[1]}
                 onChange={(e) => setDraftSettings(s => ({ ...s, initialOrbHP: [ s.initialOrbHP[0], Math.max(s.initialOrbHP[0], Number(e.target.value)) ] }))} />
        </div>

        <div className="settings-row">
          <label>Initial Orbs Count</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.initialOrbsCount}
                 onChange={(e) => setDraftSettings(s => ({ ...s, initialOrbsCount: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>New Gen Strongest Count</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.newGenStrongestCount}
                 onChange={(e) => setDraftSettings(s => ({ ...s, newGenStrongestCount: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Offspring per Parent</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.newGenOffspringPerParent}
                 onChange={(e) => setDraftSettings(s => ({ ...s, newGenOffspringPerParent: Math.max(1, Number(e.target.value)) }))} />
        </div>

        <div className="settings-row">
          <label>Initial Energy on Map</label>
          <input className="settings-input" type="number" min={0} value={draftSettings.initialEnergyOnMap}
                 onChange={(e) => setDraftSettings(s => ({ ...s, initialEnergyOnMap: Math.max(0, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Reset Energy on New Gens</label>
          <input type="checkbox" checked={draftSettings.resetEnergyOnNewGenerations}
                 onChange={(e) => setDraftSettings(s => ({ ...s, resetEnergyOnNewGenerations: e.target.checked }))} />
        </div>

        <div className="settings-row">
          <label>Split HP Threshold</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.splitHPThreshold}
                 onChange={(e) => setDraftSettings(s => ({ ...s, splitHPThreshold: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>HP Gain by Energy</label>
          <input className="settings-input" type="number" min={0} value={draftSettings.hpGainByEnergyConsumption}
                 onChange={(e) => setDraftSettings(s => ({ ...s, hpGainByEnergyConsumption: Math.max(0, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Energy generated on death</label>
          <input className="settings-input" type="number" min={0} value={draftSettings.energyCreatedOnDeath}
                 onChange={(e) => setDraftSettings(s => ({ ...s, energyCreatedOnDeath: Math.max(0, Number(e.target.value)) }))} />
        </div>

        <div className="settings-row">
          <label>DNA Length</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.dnaLength}
                 onChange={(e) => setDraftSettings(s => ({ ...s, dnaLength: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Reactions Columns</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.reactionsLength}
                 onChange={(e) => setDraftSettings(s => ({ ...s, reactionsLength: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Reaction Directions Rows</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.reactionDirectionsLength}
                 onChange={(e) => setDraftSettings(s => ({ ...s, reactionDirectionsLength: Math.max(1, Number(e.target.value)) }))} />
        </div>

        <div className="settings-row">
          <label>ID Length</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.idLength}
                 onChange={(e) => setDraftSettings(s => ({ ...s, idLength: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Initial Turn Duration (ms)</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.initialTurnDuration}
                 onChange={(e) => setDraftSettings(s => ({ ...s, initialTurnDuration: Math.max(1, Number(e.target.value)) }))} />
        </div>

        <div className="settings-actions">
          <button
            onClick={() => {
              const sanitized = sanitizeSettings(draftSettings)
              saveSettings(sanitized)
              window.location.reload()
            }}
            title="Save settings and restart the game"
          >
            💾 Save & Restart
          </button>
          <button onClick={onClose} title="Close settings">Cancel</button>
          <button
            onClick={() => {
              resetSettings()
              window.location.reload()
            }}
            title="Reset to defaults and restart"
          >
            ♻️ Reset Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
