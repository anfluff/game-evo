export type Settings = {
  worldSize: [number, number]
  initialOrbHP: [number, number]
  initialOrbsCount: number
  newGenStrongestCount: number
  newGenOffspringPerParent: number
  birthTaxPercent: number
  initialEnergyOnMap: number
  resetEnergyOnNewGenerations: boolean
  /** Energy units that fall on random cells every turn, per 1000 cells of the world. */
  energyRainPer1000Cells: number
  /** Rain that lands on a cell already holding this much energy is lost. */
  energyCellCap: number
  /** Every turn costs an orb 1 hp plus this percent of its hp. */
  upkeepPercentOfHp: number
  /** Turns after which the statistics start a new generation while the world lives on. 0 = only on extinction. */
  generationLengthTurns: number
  graphicEffects: boolean
  hpGainByEnergyConsumption: number
  energyCreatedOnDeath: number
  bitePercentOfAttackerHp: number
  /** Share of a bite the attacker does not get. It falls to the ground as energy at the eating rate. */
  biteWasteFraction: number
  biteWasteMin: number
  scanRadius: number
  idLength: number
  initialTurnDuration: number
  kinshipMaxDepth: number
}

export const defaultSettings: Settings = {
  worldSize: [60, 100],
  graphicEffects: true,
  initialTurnDuration: 200,

  initialEnergyOnMap: 3200,
  resetEnergyOnNewGenerations: true,

  initialOrbHP: [10, 20],
  initialOrbsCount: 240,
  newGenStrongestCount: 20,
  newGenOffspringPerParent: 6,

  energyRainPer1000Cells: 48,
  energyCellCap: 4,
  upkeepPercentOfHp: 3,
  generationLengthTurns: 500,

  birthTaxPercent: 20,

  biteWasteMin: 1,
  biteWasteFraction: 0.2,
  bitePercentOfAttackerHp: 0.3,

  hpGainByEnergyConsumption: 3,
  energyCreatedOnDeath: 0,

  scanRadius: 1,

  idLength: 6,
  kinshipMaxDepth: 12
}

// The version suffix changes when the rules change enough that saved values would mislead.
const STORAGE_KEY = 'life1_settings_v2'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    const merged = {
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

function clampInt(n: number, min: number, max?: number): number {
  const base = isFinite(n) ? Math.floor(n) : min
  const clampedMin = Math.max(min, base)
  if (typeof max === 'number' && isFinite(max)) {
    return Math.min(clampedMin, max)
  }
  return clampedMin
}

function clampFloat(n: number, min: number, max?: number): number {
  const base = isFinite(n) ? n : min
  const clampedMin = Math.max(min, base)
  if (typeof max === 'number' && isFinite(max)) {
    return Math.min(clampedMin, max)
  }
  return clampedMin
}

export function sanitizeSettings(s: Partial<Settings>): Settings {
  const rows = clampInt(s.worldSize?.[0] ?? defaultSettings.worldSize[0], 1)
  const cols = clampInt(s.worldSize?.[1] ?? defaultSettings.worldSize[1], 1)
  const hpMin = clampInt(s.initialOrbHP?.[0] ?? defaultSettings.initialOrbHP[0], 1)
  const hpMaxRaw = s.initialOrbHP?.[1] ?? defaultSettings.initialOrbHP[1]
  const hpMax = clampInt(hpMaxRaw, hpMin)

  return {
    worldSize: [rows, cols],
    initialOrbHP: [hpMin, hpMax],
    initialOrbsCount: clampInt(s.initialOrbsCount ?? defaultSettings.initialOrbsCount, 1),
    newGenStrongestCount: clampInt(s.newGenStrongestCount ?? defaultSettings.newGenStrongestCount, 1),
    newGenOffspringPerParent: clampInt(s.newGenOffspringPerParent ?? defaultSettings.newGenOffspringPerParent, 1),
    birthTaxPercent: clampInt(s.birthTaxPercent ?? defaultSettings.birthTaxPercent, 0, 100),
    initialEnergyOnMap: clampInt(s.initialEnergyOnMap ?? defaultSettings.initialEnergyOnMap, 0),
    resetEnergyOnNewGenerations: Boolean(s.resetEnergyOnNewGenerations),
    energyRainPer1000Cells: clampFloat(s.energyRainPer1000Cells ?? defaultSettings.energyRainPer1000Cells, 0),
    energyCellCap: clampInt(s.energyCellCap ?? defaultSettings.energyCellCap, 1),
    upkeepPercentOfHp: clampFloat(s.upkeepPercentOfHp ?? defaultSettings.upkeepPercentOfHp, 0, 100),
    generationLengthTurns: clampInt(s.generationLengthTurns ?? defaultSettings.generationLengthTurns, 0),
    graphicEffects: typeof s.graphicEffects === 'boolean' ? s.graphicEffects : defaultSettings.graphicEffects,
    hpGainByEnergyConsumption: clampInt(s.hpGainByEnergyConsumption ?? defaultSettings.hpGainByEnergyConsumption, 0),
    energyCreatedOnDeath: clampInt(s.energyCreatedOnDeath ?? defaultSettings.energyCreatedOnDeath, 0),
    bitePercentOfAttackerHp: clampFloat(
      s.bitePercentOfAttackerHp ?? defaultSettings.bitePercentOfAttackerHp,
      0,
      2
    ),
    biteWasteFraction: clampFloat(s.biteWasteFraction ?? defaultSettings.biteWasteFraction, 0, 1),
    biteWasteMin: clampInt(s.biteWasteMin ?? defaultSettings.biteWasteMin, 0),
    scanRadius: clampInt(s.scanRadius ?? defaultSettings.scanRadius, 1),
    idLength: clampInt(s.idLength ?? defaultSettings.idLength, 1),
    initialTurnDuration: clampInt(s.initialTurnDuration ?? defaultSettings.initialTurnDuration, 1),
    kinshipMaxDepth: clampInt(s.kinshipMaxDepth ?? defaultSettings.kinshipMaxDepth, 1),
  }
}
