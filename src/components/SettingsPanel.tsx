import React from 'react'
import type { Settings } from '../game/settings'

type SettingsPanelProps = {
  draftSettings: Settings
  setDraftSettings: React.Dispatch<React.SetStateAction<Settings>>
  onSave: () => void
  onResetDefaults: () => void
  onClose: () => void
}

export function SettingsPanel({
  draftSettings,
  setDraftSettings,
  onSave,
  onResetDefaults,
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
          <label>Birth Tax (%)</label>
          <input
            className="settings-input"
            type="number"
            min={0}
            max={100}
            value={draftSettings.birthTaxPercent}
            onChange={(e) =>
              setDraftSettings(s => ({
                ...s,
                birthTaxPercent: Math.min(100, Math.max(0, Number(e.target.value)))
              }))
            }
          />
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
          <label>Energy rain per turn, per 1000 cells</label>
          <input className="settings-input" type="number" min={0} step="1" value={draftSettings.energyRainPer1000Cells}
                 onChange={(e) => setDraftSettings(s => ({ ...s, energyRainPer1000Cells: Math.max(0, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Energy cap per cell</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.energyCellCap}
                 onChange={(e) => setDraftSettings(s => ({ ...s, energyCellCap: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Upkeep, % of HP per turn (plus 1)</label>
          <input className="settings-input" type="number" min={0} step="0.5" value={draftSettings.upkeepPercentOfHp}
                 onChange={(e) => setDraftSettings(s => ({ ...s, upkeepPercentOfHp: Math.max(0, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Generation length in turns (0 = until extinction)</label>
          <input className="settings-input" type="number" min={0} value={draftSettings.generationLengthTurns}
                 onChange={(e) => setDraftSettings(s => ({ ...s, generationLengthTurns: Math.max(0, Number(e.target.value)) }))} />
        </div>

        {/* Graphics effects toggle moved to the top actions bar */}

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
          <label>Bite % of attacker HP</label>
          <input className="settings-input" type="number" min={0} step="0.01" value={draftSettings.bitePercentOfAttackerHp}
                 onChange={(e) => setDraftSettings(s => ({ ...s, bitePercentOfAttackerHp: Math.max(0, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Bite waste fraction</label>
          <input className="settings-input" type="number" min={0} step="0.01" value={draftSettings.biteWasteFraction}
                 onChange={(e) => setDraftSettings(s => ({ ...s, biteWasteFraction: Math.max(0, Number(e.target.value)) }))} />
        </div>
        <div className="settings-row">
          <label>Bite waste min (HP)</label>
          <input className="settings-input" type="number" min={0} value={draftSettings.biteWasteMin}
                 onChange={(e) => setDraftSettings(s => ({ ...s, biteWasteMin: Math.max(0, Number(e.target.value)) }))} />
        </div>

        <div className="settings-row">
          <label>Scan radius</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.scanRadius}
                 onChange={(e) => setDraftSettings(s => ({ ...s, scanRadius: Math.max(1, Number(e.target.value)) }))} />
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
        <div className="settings-row">
          <label>Kinship Max Depth</label>
          <input className="settings-input" type="number" min={1} value={draftSettings.kinshipMaxDepth}
                  onChange={(e) => setDraftSettings(s => ({ ...s, kinshipMaxDepth: Math.max(1, Number(e.target.value)) }))} />
        </div>

        <div className="settings-actions">
          <button
            onClick={onSave}
            title="Save settings and restart the game"
          >
            💾 Save & Restart
          </button>
          <button onClick={onClose} title="Close settings">Cancel</button>
          <button
            onClick={onResetDefaults}
            title="Reset to defaults and restart"
          >
            ♻️ Reset Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
