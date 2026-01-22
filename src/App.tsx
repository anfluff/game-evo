import React, { useEffect, useRef, useState } from 'react'
import './styles/App.css'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData
} from 'chart.js'
import { SettingsPanel, loadSettings, saveSettings, type Settings } from './components/SettingsPanel'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

// ---- SETUP -----

const settings = loadSettings()

const worldSize: number[] = settings.worldSize

const initialOrbHP: number[] = settings.initialOrbHP
const initialOrbsCount = settings.initialOrbsCount
const newGenStrongestCount = settings.newGenStrongestCount
const newGenOffspringPerParent = settings.newGenOffspringPerParent

const initialEnergyOnMap = settings.initialEnergyOnMap
const resetEnergyOnNewGenerations = settings.resetEnergyOnNewGenerations // true - сбрасывать энергию на новую генерацию, false - сохранять

const hpGainByEnergyConsumption = settings.hpGainByEnergyConsumption
const energyCreatedOnDeath = settings.energyCreatedOnDeath
const scanRadius = settings.scanRadius

const energyReplenishIntervalTurns = settings.energyReplenishIntervalTurns
const energySpreadThreshold = settings.energySpreadThreshold

const bitePercentOfAttackerHp = settings.bitePercentOfAttackerHp
const biteMineralDropFraction = settings.biteMineralDropFraction
const biteMineralDropMin = settings.biteMineralDropMin
const kinshipMaxDepth = settings.kinshipMaxDepth

const idLength = settings.idLength
const initialTurnDuration = settings.initialTurnDuration
const birthTaxPercent = settings.birthTaxPercent

const cellSize = 48
const cellGap = 4
const orbSize = 36

let graphicsEffectsEnabled = settings.graphicEffects

type AttackEffectType = 'attack' | 'bite' | 'spawn'

type AttackEffect = {
  id: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  type: AttackEffectType
}

let attackEffects: AttackEffect[] = []
let attackEffectCounter = 0

// ---- CLASSES -----

// Helper for clamping values
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

interface Genes {
  // 1. HP & Sensitivities
  fear_hp_sensitivity: number
  hunger_hp_sensitivity: number
  aggression_hp_sensitivity: number
  exploration_hp_sensitivity: number
  risk_tolerance: number
  recovery_optimism: number
  hp_healthy_norm: number

  // 2. Weights
  fear_weight: number
  hunger_weight: number
  aggression_weight: number
  reproduction_weight: number
  exploration_weight: number

  // 3. Attack / Cannibalism
  cannibalism_factor: number
  attack_margin: number
  retaliation_fear: number
  defense_instinct: number
  kill_greed: number
  territoriality: number

  // 3.1 Kinship
  trust_in_relatives: number
  aggression_towards_relatives: number
  recognized_ancestry_depth: number

  // 4. Reproduction
  min_hp_to_divide: number
  division_risk_aversion: number
  offspring_investment: number
  reproduction_urgency: number
  reproduction_cooldown: number

  // 5. Spatial / Environment
  max_energy_norm: number
  diagonal_awareness: number
  distance_decay: number
  crowd_preference: number
  inertia_bias: number

  // 6. Stochastic / Evo
  decision_noise: number
  impulsiveness: number
  mutation_resilience: number
}

const DEFAULT_GENES: Genes = {
  fear_hp_sensitivity: 1.2,
  hunger_hp_sensitivity: 1.0,
  aggression_hp_sensitivity: 0.35,
  exploration_hp_sensitivity: 0.3,
  risk_tolerance: 0.3,
  recovery_optimism: 0.3,
  hp_healthy_norm: 15.0,

  fear_weight: 1.3,
  hunger_weight: 1.1,
  aggression_weight: 0.9,
  reproduction_weight: 0.6,
  exploration_weight: 0.4,

  cannibalism_factor: 0.8,
  attack_margin: 1.2,
  retaliation_fear: 1.0,
  defense_instinct: 0.35,
  kill_greed: 0.5,
  territoriality: 0.3,

  trust_in_relatives: 0.6,
  aggression_towards_relatives: 0.25,
  recognized_ancestry_depth: 4,

  min_hp_to_divide: 0.5,
  division_risk_aversion: 0.3,
  offspring_investment: 0.5,
  reproduction_urgency: 0.7,
  reproduction_cooldown: 3,

  max_energy_norm: 5.0,
  diagonal_awareness: 0.5,
  distance_decay: 0.7,
  crowd_preference: 0.2,
  inertia_bias: 0.8,

  decision_noise: 0.2,
  impulsiveness: 0.03,
  mutation_resilience: 0.4
}

const AGGRESSIVE_INDIVIDUAL_GENES: Genes = {
  ...DEFAULT_GENES,
  fear_hp_sensitivity: 0.8,
  aggression_hp_sensitivity: 0.6,
  risk_tolerance: 0.75,
  fear_weight: 0.45,
  hunger_weight: 1.35,
  aggression_weight: 1.8,
  reproduction_weight: 0.45,
  exploration_weight: 0.35,
  cannibalism_factor: 1.0,
  attack_margin: 0.9,
  retaliation_fear: 0.2,
  defense_instinct: 0.25,
  kill_greed: 0.95,
  territoriality: 0.9,
  trust_in_relatives: 0.2,
  aggression_towards_relatives: 0.6,
  recognized_ancestry_depth: 2,
  crowd_preference: 0.05,
  decision_noise: 0.25,
  impulsiveness: 0.06,
  offspring_investment: 0.45
}

const HERD_HERBIVORE_GENES: Genes = {
  ...DEFAULT_GENES,
  fear_hp_sensitivity: 1.4,
  aggression_hp_sensitivity: 0.2,
  exploration_hp_sensitivity: 0.2,
  risk_tolerance: 0.15,
  recovery_optimism: 0.4,
  fear_weight: 1.6,
  hunger_weight: 1.2,
  aggression_weight: 0.4,
  reproduction_weight: 0.9,
  exploration_weight: 0.25,
  cannibalism_factor: 0.1,
  attack_margin: 1.4,
  retaliation_fear: 1.2,
  defense_instinct: 0.75,
  kill_greed: 0.05,
  territoriality: 0.1,
  trust_in_relatives: 0.95,
  aggression_towards_relatives: 0.02,
  recognized_ancestry_depth: 6,
  division_risk_aversion: 0.25,
  offspring_investment: 0.6,
  reproduction_urgency: 0.85,
  crowd_preference: 0.7,
  inertia_bias: 0.9,
  decision_noise: 0.15,
  impulsiveness: 0.02
}

const ADVENTUROUS_EXPLORER_GENES: Genes = {
  ...DEFAULT_GENES,
  fear_hp_sensitivity: 0.9,
  aggression_hp_sensitivity: 0.3,
  exploration_hp_sensitivity: 0.65,
  risk_tolerance: 0.65,
  fear_weight: 0.9,
  hunger_weight: 1.0,
  aggression_weight: 0.75,
  reproduction_weight: 0.4,
  exploration_weight: 1.0,
  cannibalism_factor: 0.4,
  attack_margin: 1.15,
  retaliation_fear: 0.75,
  defense_instinct: 0.4,
  kill_greed: 0.3,
  territoriality: 0.2,
  trust_in_relatives: 0.5,
  aggression_towards_relatives: 0.2,
  recognized_ancestry_depth: 4,
  offspring_investment: 0.45,
  reproduction_urgency: 0.6,
  diagonal_awareness: 0.8,
  distance_decay: 0.9,
  crowd_preference: 0.1,
  inertia_bias: 0.5,
  decision_noise: 0.35,
  impulsiveness: 0.08
}

const SPAWN_ARCHETYPES: Genes[] = [
  DEFAULT_GENES,
  AGGRESSIVE_INDIVIDUAL_GENES,
  HERD_HERBIVORE_GENES,
  ADVENTUROUS_EXPLORER_GENES
]

let spawnArchetypeCursor = 0

// Action types for the new engine
type ActionType = 'WAIT' | 'MOVE' | 'CONSUME' | 'BITE' | 'ATTACK' | 'DIVIDE'

interface ActionDecision {
  type: ActionType
  targetX?: number
  targetY?: number
  utility: number
  description: string
}

type OrbMotivations = {
  hpNorm: number
  riskDrive: number
  hunger: number
  fear: number
  fearEffective: number
  aggression: number
  reproduction: number
  exploration: number
  maxThreat: number
  maxPrey: number
}

type PerceivedCell = {
  dx: number
  dy: number
  x: number
  y: number
  inBounds: boolean
  energy: number
  threat: number
  prey: number
  kinAffinity: number
  occupied: boolean
  localDensity: number
}

class Orb {
  id: string
  name: string
  age: number = 0

  x: number
  y: number
  hp: number

  genes: Genes

  parentId: string | null
  ancestorIds: string[]
  private lineageDistancesCache: Map<string, number> | null = null
  private lineageDistancesCacheByDepth: Map<number, Map<string, number>> = new Map()
  
  // State for inertia
  lastActionUtility: number = 0
  lastActionType: ActionType | null = null
  lastMotivations: OrbMotivations | null = null
  lastPerception: PerceivedCell[] = []
  lastScanRadius: number = 0

  log: string[][] = []
  deathReason: DeathReason | null = null
  preventAgingThisTurn: boolean = false
  glow: string = ''
  reproductionCooldownRemaining: number = 0

  constructor(x: number, y: number, hp: number, genes: Genes, parent?: Orb | null) {
    this.x = x
    this.y = y
    this.hp = hp
    this.genes = genes
    this.id = getRandomId(idLength)
    // Simple naming based on ID since DNA is gone
    this.name = `Orb ${this.id.substring(0, 4)}` + (parent ? ` of ${parent.name}` : '')
    this.parentId = parent?.id ?? null
    this.ancestorIds = parent ? [ parent.id, ...parent.ancestorIds ].slice(0, kinshipMaxDepth) : []
    this.addToLog(`I was born with ❤️${hp}hp`)
  }

  private getLineageDistances(maxDepth?: number): Map<string, number> {
    if (maxDepth === undefined) {
      if (this.lineageDistancesCache) {
        return this.lineageDistancesCache
      }
      const distances = new Map<string, number>()
      distances.set(this.id, 0)
      for (let i = 0; i < this.ancestorIds.length; i++) {
        distances.set(this.ancestorIds[i], i + 1)
      }
      this.lineageDistancesCache = distances
      return distances
    }

    const depth = clamp(Math.round(maxDepth), 0, kinshipMaxDepth)
    const cached = this.lineageDistancesCacheByDepth.get(depth)
    if (cached) {
      return cached
    }
    const distances = new Map<string, number>()
    distances.set(this.id, 0)
    for (let i = 0; i < Math.min(depth, this.ancestorIds.length); i++) {
      distances.set(this.ancestorIds[i], i + 1)
    }
    this.lineageDistancesCacheByDepth.set(depth, distances)
    return distances
  }

  kinshipTo(other: Orb): number {
    if (this.id === other.id) {
      return 1
    }
    const recognizedDepth = clamp(Math.round(this.genes.recognized_ancestry_depth), 0, kinshipMaxDepth)
    const a = this.getLineageDistances(recognizedDepth)
    const b = other.getLineageDistances()
    const [small, big] = a.size <= b.size ? [a, b] : [b, a]

    let bestSum = Infinity
    for (const [ancestorId, d1] of small) {
      const d2 = big.get(ancestorId)
      if (d2 === undefined) continue
      const sum = d1 + d2
      if (sum < bestSum) {
        bestSum = sum
      }
    }

    if (!Number.isFinite(bestSum)) {
      return 0
    }
    if (bestSum <= 0) {
      return 1
    }
    const exponent = Math.max(0, bestSum - 1)
    return Math.pow(0.5, exponent)
  }

  triggerGlow(className: 'glow-white' | 'glow-red' | 'glow-green' | 'glow-orange') {
    // Suppress glow when graphic effects are disabled
    if (!graphicsEffectsEnabled) {
      return
    }
    this.glow = className
    // request immediate re-render so UI reflects glow state even when paused
    forceRerender?.()
    setTimeout(() => {
      if (this.glow === className) {
        this.glow = ''
        // request re-render to clear the glow in UI
        forceRerender?.()
      }
    }, 300)
  }

  act() {
    if (this.hp <= 0) {
      return
    }

    // Reset aging prevention flag for this turn
    this.preventAgingThisTurn = false

    // Start a new log block for this turn
    this.log.push([])

    const decision = this.decideAction()
    this.executeDecision(decision)

    // Apply unified aging once per act if not prevented by action
    if (!this.preventAgingThisTurn) {
      this.addToLog(`> I aged and lost 1 hp`)
      this.loseHp(1)
    }
    if (this.reproductionCooldownRemaining > 0) {
      this.reproductionCooldownRemaining = Math.max(0, this.reproductionCooldownRemaining - 1)
    }
    this.age += 1
  }

  refreshSnapshot(radius: number) {
    const snapshot = this.computeSnapshot(radius)
    this.lastPerception = snapshot.perception
    this.lastMotivations = snapshot.motivations
    this.lastScanRadius = radius
  }

  computeSnapshot(radius: number): { perception: PerceivedCell[]; motivations: OrbMotivations } {
    const { genes } = this
    const hpNorm = clamp(this.hp / genes.hp_healthy_norm, 0, 1)
    const riskDrive = clamp(hpNorm * genes.risk_tolerance, 0, 1)

    const minX = this.x - radius - 1
    const maxX = this.x + radius + 1
    const minY = this.y - radius - 1
    const maxY = this.y + radius + 1
    const occupantsByPos = new Map<string, Orb[]>()
    for (const orb of orbs) {
      if (orb.x < minX || orb.x > maxX || orb.y < minY || orb.y > maxY) continue
      const key = `${orb.x},${orb.y}`
      const list = occupantsByPos.get(key)
      if (list) {
        list.push(orb)
      } else {
        occupantsByPos.set(key, [orb])
      }
    }
    const getOccupants = (x: number, y: number, excludeId: string | null = null) => {
      const list = occupantsByPos.get(`${x},${y}`) ?? []
      if (!excludeId) return list
      if (list.length === 0) return list
      if (list.length === 1) return list[0].id === excludeId ? [] : list
      return list.filter(o => o.id !== excludeId)
    }

    const localDensityAt = (x: number, y: number) => {
      let occupiedNeighbors = 0
      let total = 0
      for (let ddy = -1; ddy <= 1; ddy++) {
        for (let ddx = -1; ddx <= 1; ddx++) {
          if (ddx === 0 && ddy === 0) continue
          const nx = x + ddx
          const ny = y + ddy
          if (!withinWorldBoundaries(nx, ny)) continue
          total += 1
          if (getCellOrbs(nx, ny).length > 0) {
            occupiedNeighbors += 1
          }
        }
      }
      return total > 0 ? occupiedNeighbors / total : 0
    }

    const perception: PerceivedCell[] = []
    let maxThreat = 0
    let maxPrey = 0

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = this.x + dx
        const ty = this.y + dy

        const inBounds = withinWorldBoundaries(tx, ty)
        const energy = inBounds ? getCellEnergy(ty, tx) : 0

        const dist = Math.sqrt(dx * dx + dy * dy)
        const kernel = Math.pow(genes.distance_decay, dist)
        const isDiagonal = dx !== 0 && dy !== 0
        const diagModifier = isDiagonal ? genes.diagonal_awareness : 1.0

        let threatSum = 0
        let preySum = 0
        let kinAffinitySum = 0
        let occupied = false

        if (inBounds) {
          const directOccupants = getOccupants(tx, ty, this.id)
          occupied = directOccupants.length > 0

          for (let ddy = -1; ddy <= 1; ddy++) {
            for (let ddx = -1; ddx <= 1; ddx++) {
              const sx = tx + ddx
              const sy = ty + ddy
              if (!withinWorldBoundaries(sx, sy)) continue
              const sources = getOccupants(sx, sy, this.id)
              if (sources.length === 0) continue

              const spreadDist = Math.sqrt(ddx * ddx + ddy * ddy)
              const spreadKernel = Math.pow(genes.distance_decay, spreadDist)
              const spreadDiagModifier = ddx !== 0 && ddy !== 0 ? genes.diagonal_awareness : 1.0

              for (const other of sources) {
                const enemyHpNorm = clamp(other.hp / genes.hp_healthy_norm, 0, 1)
                const kinship = this.kinshipTo(other)
                kinAffinitySum +=
                  kinship * kernel * diagModifier * spreadKernel * spreadDiagModifier * clamp(genes.trust_in_relatives, 0, 1)

                const enemyAdvantage = enemyHpNorm / Math.max(hpNorm, 0.001)
                const trustedThreatReduction = clamp(kinship * genes.trust_in_relatives, 0, 1)
                const threatModifier = clamp(1 - trustedThreatReduction, 0, 1)
                threatSum += enemyAdvantage * kernel * diagModifier * spreadKernel * spreadDiagModifier * threatModifier

                const ourAdvantage = hpNorm / Math.max(enemyHpNorm, 0.001)
                const attackFeasibility = ourAdvantage / genes.attack_margin
                const attackSignal = clamp(attackFeasibility - 1, 0, 1)

                const fRetaliation = clamp(genes.retaliation_fear * enemyAdvantage * (1 - riskDrive), 0, 1)
                const preySource = attackSignal * genes.cannibalism_factor * genes.territoriality * (1 - fRetaliation)
                const relativeAggression = clamp(genes.aggression_towards_relatives, 0, 1)
                const preyModifier = clamp((1 - kinship) + kinship * relativeAggression, 0, 1)
                preySum += preySource * kernel * diagModifier * spreadKernel * spreadDiagModifier * preyModifier
              }
            }
          }
        }

        const threat = clamp(threatSum, 0, 1)
        const prey = clamp(preySum, 0, 1)
        const kinAffinity = clamp(kinAffinitySum, 0, 1)
        const localDensity = inBounds ? localDensityAt(tx, ty) : 0

        if (threat > maxThreat) {
          maxThreat = threat
        }
        if (prey > maxPrey) {
          maxPrey = prey
        }

        perception.push({
          dx,
          dy,
          x: tx,
          y: ty,
          inBounds,
          energy,
          threat,
          prey,
          kinAffinity,
          occupied,
          localDensity
        })
      }
    }

    const hungerBase = clamp((1 - hpNorm) * genes.hunger_hp_sensitivity, 0, 1)
    const starvationBoost = clamp((0.2 - hpNorm) / 0.2, 0, 1)
    const hunger = clamp(hungerBase + starvationBoost * (1 - hungerBase), 0, 1)

    const fearRaw = maxThreat * (1 - hpNorm) * genes.fear_hp_sensitivity
    const fear = clamp(fearRaw, 0, 1)
    const fearEffective = clamp(fear * (1 - riskDrive), 0, 1)

    const aggression = clamp(maxPrey * hpNorm * genes.aggression_hp_sensitivity, 0, 1)

    const effectiveDivRiskAversion = clamp(genes.division_risk_aversion * (1 - genes.recovery_optimism), 0, 1)
    let reproduction = 0
    if (hpNorm > genes.min_hp_to_divide) {
      reproduction = clamp(
        ((hpNorm - genes.min_hp_to_divide) / Math.max(1 - genes.min_hp_to_divide, 0.001)) *
          genes.reproduction_urgency *
          (1 - effectiveDivRiskAversion),
        0,
        1
      )
    }

    const exploration = clamp(hpNorm * genes.exploration_hp_sensitivity, 0, 1)

    return {
      perception,
      motivations: {
        hpNorm,
        riskDrive,
        hunger,
        fear,
        fearEffective,
        aggression,
        reproduction,
        exploration,
        maxThreat,
        maxPrey
      }
    }
  }

  decideAction(): ActionDecision {
    const radius = scanRadius
    this.refreshSnapshot(radius)

    const motivations = this.lastMotivations ?? this.computeSnapshot(radius).motivations
    const perception = this.lastPerception
    const { genes } = this

    const current = perception.find(c => c.dx === 0 && c.dy === 0) ?? null
    const currentEnergy = current?.energy ?? 0
    const currentEnergyNorm = clamp(currentEnergy / Math.max(genes.max_energy_norm, 1), 0, 1)
    const currentThreat = current?.threat ?? 0
    const currentLocalDensity = current?.localDensity ?? 0

    const decisions: ActionDecision[] = []
    const debug = selectedOrbIdForDebug === this.id
    const debugRows: Array<{
      type: ActionType
      whyLines: string[]
      target: string
      dx?: number | null
      dy?: number | null
      base: number
      inertia: number
      noise: number
      final: number
    }> = []

    const directionFromDelta = (dx: number, dy: number) => {
      if (dx === 0 && dy === 0) {
        return 'here'
      }
      const vertical = dy < 0 ? 'top' : dy > 0 ? 'bottom' : ''
      const horizontal = dx < 0 ? 'left' : dx > 0 ? 'right' : ''
      if (vertical && horizontal) {
        return `${vertical} ${horizontal}`
      }
      return vertical || horizontal || 'here'
    }

    const W_hunger = genes.hunger_weight
    const W_aggression = genes.aggression_weight
    const W_exploration = genes.exploration_weight
    const W_fear = genes.fear_weight
    const W_reproduction = genes.reproduction_weight

    let bestEnergyTarget:
      | {
          x: number
          y: number
          dist: number
          strength: number
        }
      | null = null
    for (const c of perception) {
      if (!c.inBounds) {
        continue
      }
      if (c.energy <= 0) {
        continue
      }
      if (c.dx === 0 && c.dy === 0) {
        continue
      }

      const energyNorm = clamp(c.energy / Math.max(genes.max_energy_norm, 1), 0, 1)
      if (energyNorm <= 0) {
        continue
      }

      const dist = Math.sqrt(c.dx * c.dx + c.dy * c.dy)
      const strength = energyNorm * Math.pow(genes.distance_decay, dist)
      if (!bestEnergyTarget || strength > bestEnergyTarget.strength) {
        bestEnergyTarget = { x: c.x, y: c.y, dist, strength }
      }
    }

    const spacePrefCurrent = clamp(
      (1 - currentLocalDensity) * (1 - genes.crowd_preference) + currentLocalDensity * genes.crowd_preference,
      0,
      1
    )

    const waitFear = (1 - currentThreat) * (W_fear * motivations.fearEffective)
    const waitExplore = spacePrefCurrent * (W_exploration * motivations.exploration)
    const waitHunger = W_hunger * motivations.hunger
    const waitUtility = waitFear + waitExplore - waitHunger
    const waitDecision: ActionDecision = {
      type: 'WAIT',
      utility: waitUtility,
      description: 'wait'
    }
    decisions.push(waitDecision)
    if (debug) {
      debugRows.push({
        type: waitDecision.type,
        whyLines: [
          `I consider WAIT (stay at ${this.x},${this.y}).`,
          `My hunger feeling is ${motivations.hunger.toFixed(3)} (0=full, 1=starving).`,
          `My fear feeling is ${motivations.fear.toFixed(3)}, but effective fear is ${motivations.fearEffective.toFixed(3)} (fear reduced by risk-taking).`,
          `Threat at my current cell is ${currentThreat.toFixed(3)} (0=safe, 1=danger).`,
          ``,
          `Good thing about waiting: it feels safer when threat is low.`,
          `Safety factor = 1 - threat = ${(1 - currentThreat).toFixed(3)}.`,
          `I care about safety with fear weight W_fear=${W_fear.toFixed(3)}.`,
          `Safety desire = W_fear * effectiveFear = ${W_fear.toFixed(3)} * ${motivations.fearEffective.toFixed(3)} = ${(W_fear * motivations.fearEffective).toFixed(3)}.`,
          `So the safety bonus for WAIT is: safetyFactor * safetyDesire = ${(1 - currentThreat).toFixed(3)} * ${(W_fear * motivations.fearEffective).toFixed(3)} = ${waitFear.toFixed(3)}.`,
          ``,
          `Another good thing about waiting: I like comfortable space.`,
          `Local crowding here is ${currentLocalDensity.toFixed(3)} (0=alone, 1=crowded).`,
          `My crowd preference gene is ${genes.crowd_preference.toFixed(3)} (0=prefer space, 1=prefer crowds).`,
          `So "space preference here" becomes ${spacePrefCurrent.toFixed(3)}.`,
          `I care about exploration with W_explore=${W_exploration.toFixed(3)} and my exploration mood is ${motivations.exploration.toFixed(3)}.`,
          `Explore desire = W_explore * explorationMood = ${W_exploration.toFixed(3)} * ${motivations.exploration.toFixed(3)} = ${(W_exploration * motivations.exploration).toFixed(3)}.`,
          `So the explore bonus for WAIT is: spacePref * exploreDesire = ${spacePrefCurrent.toFixed(3)} * ${(W_exploration * motivations.exploration).toFixed(3)} = ${waitExplore.toFixed(3)}.`,
          ``,
          `Bad thing about waiting: hunger pushes me to act.`,
          `Hunger penalty = W_hunger * hunger = ${W_hunger.toFixed(3)} * ${motivations.hunger.toFixed(3)} = ${waitHunger.toFixed(3)}.`,
          ``,
          `Base score for WAIT = safetyBonus + exploreBonus - hungerPenalty = ${waitFear.toFixed(3)} + ${waitExplore.toFixed(3)} - ${waitHunger.toFixed(3)} = ${waitUtility.toFixed(3)}.`
        ],
        target: `${this.x},${this.y}`,
        dx: 0,
        dy: 0,
        base: waitUtility,
        inertia: 0,
        noise: 0,
        final: 0
      })
    }

    if (currentEnergy > 0) {
      const consumeGainNorm = clamp(hpGainByEnergyConsumption / Math.max(genes.hp_healthy_norm, 1), 0, 1)
      const arriveHungry = this.lastActionType === 'MOVE' && motivations.hunger > 0.15
      const continueConsuming = this.lastActionType === 'CONSUME' && motivations.hunger > 0.05
      const consumeStickiness = (arriveHungry ? 0.6 : 0) + (continueConsuming ? 0.3 : 0)
      const consumeGain = W_hunger * motivations.hunger * (consumeGainNorm + currentEnergyNorm + consumeStickiness)
      const consumeFear = W_fear * currentThreat * motivations.fearEffective
      const consumeUtility = consumeGain - consumeFear
      const consumeDecision: ActionDecision = {
        type: 'CONSUME',
        utility: consumeUtility,
        description: 'consume energy'
      }
      decisions.push(consumeDecision)
      if (debug) {
        debugRows.push({
          type: consumeDecision.type,
          whyLines: [
            `I consider CONSUME (eat 1 energy from the ground at ${this.x},${this.y}).`,
            `There is ${currentEnergy.toFixed(3)} energy on this cell.`,
            `Energy normalized (relative to maxEnergyNorm=${genes.max_energy_norm.toFixed(3)}) is ${currentEnergyNorm.toFixed(3)}.`,
            `Eating 1 energy would heal me by ${hpGainByEnergyConsumption.toFixed(3)} hp.`,
            `That heal amount normalized (relative to my healthy hp norm ${genes.hp_healthy_norm.toFixed(3)}) is ${consumeGainNorm.toFixed(3)}.`,
            ``,
            `How hungry am I? hunger=${motivations.hunger.toFixed(3)} and I care with W_hunger=${W_hunger.toFixed(3)}.`,
            `Sometimes I "stick" with consuming if I just arrived hungry or I was already consuming.`,
            `Last action type was "${this.lastActionType ?? ''}".`,
            `Arrived hungry? ${this.lastActionType === 'MOVE' && motivations.hunger > 0.15 ? 'yes' : 'no'} (needs lastAction=MOVE and hunger>0.15).`,
            `Continue consuming? ${this.lastActionType === 'CONSUME' && motivations.hunger > 0.05 ? 'yes' : 'no'} (needs lastAction=CONSUME and hunger>0.05).`,
            `Stickiness bonus = ${consumeStickiness.toFixed(3)}.`,
            ``,
            `The "food attraction" for consuming is: W_hunger * hunger * (healNorm + energyNormHere + stickiness).`,
            `= ${W_hunger.toFixed(3)} * ${motivations.hunger.toFixed(3)} * (${consumeGainNorm.toFixed(3)} + ${currentEnergyNorm.toFixed(3)} + ${consumeStickiness.toFixed(3)})`,
            `= ${consumeGain.toFixed(3)}.`,
            ``,
            `But I also fear staying here if it's dangerous.`,
            `Fear cost = W_fear * threatHere * effectiveFear = ${W_fear.toFixed(3)} * ${currentThreat.toFixed(3)} * ${motivations.fearEffective.toFixed(3)} = ${consumeFear.toFixed(3)}.`,
            ``,
            `Base score for CONSUME = foodAttraction - fearCost = ${consumeGain.toFixed(3)} - ${consumeFear.toFixed(3)} = ${consumeUtility.toFixed(3)}.`
          ],
          target: `${this.x},${this.y}`,
          dx: 0,
          dy: 0,
          base: consumeUtility,
          inertia: 0,
          noise: 0,
          final: 0
        })
      }
    }

    const hasEmptyNeighbor = perception.some(
      c => c.inBounds && !(c.dx === 0 && c.dy === 0) && Math.abs(c.dx) <= 1 && Math.abs(c.dy) <= 1 && !c.occupied
    )

    if (canGiveBirth(this) && hasEmptyNeighbor) {
      const birthCost = computeBirthCost(this.hp, genes)
      const divideRepro = W_reproduction * motivations.reproduction
      const divideFear = W_fear * currentThreat * motivations.fearEffective
      const divideHunger = W_hunger * motivations.hunger * birthCost.costFraction
      const divideUtility = divideRepro - divideFear - divideHunger
      const divideDecision: ActionDecision = {
        type: 'DIVIDE',
        utility: divideUtility,
        description: 'divide'
      }
      decisions.push(divideDecision)
      if (debug) {
        debugRows.push({
          type: divideDecision.type,
          whyLines: [
            `I consider DIVIDE (make a child near ${this.x},${this.y}).`,
            `Can I give birth right now? ${canGiveBirth(this) ? 'yes' : 'no'}.`,
            `Is there an empty neighboring cell to place a child? ${hasEmptyNeighbor ? 'yes' : 'no'}.`,
            ``,
            `My reproduction desire is ${motivations.reproduction.toFixed(3)} and I care with W_reproduction=${W_reproduction.toFixed(3)}.`,
            `Reproduction bonus = W_reproduction * reproduction = ${W_reproduction.toFixed(3)} * ${motivations.reproduction.toFixed(3)} = ${divideRepro.toFixed(3)}.`,
            ``,
            `But dividing is scary if the area is dangerous.`,
            `Fear cost = W_fear * threatHere * effectiveFear = ${W_fear.toFixed(3)} * ${currentThreat.toFixed(3)} * ${motivations.fearEffective.toFixed(3)} = ${divideFear.toFixed(3)}.`,
            ``,
            `And dividing makes me pay an hp cost (I invest into the child).`,
            `Offspring investment gene is ${genes.offspring_investment.toFixed(3)} (fraction of my hp).`,
            `Birth tax is ${birthTaxPercent.toFixed(0)}% of my current hp.`,
            `So total hp cost fraction is ${birthCost.costFraction.toFixed(3)} (child=${birthCost.childHp}, tax=${birthCost.tax}, total=${birthCost.totalCost}).`,
            `So hunger makes dividing feel more expensive.`,
            `Hunger cost = W_hunger * hunger * totalCostFraction = ${W_hunger.toFixed(3)} * ${motivations.hunger.toFixed(3)} * ${birthCost.costFraction.toFixed(3)} = ${divideHunger.toFixed(3)}.`,
            ``,
            `Base score for DIVIDE = reproBonus - fearCost - hungerCost = ${divideRepro.toFixed(3)} - ${divideFear.toFixed(3)} - ${divideHunger.toFixed(3)} = ${divideUtility.toFixed(3)}.`
          ],
          target: `near ${this.x},${this.y}`,
          dx: null,
          dy: null,
          base: divideUtility,
          inertia: 0,
          noise: 0,
          final: 0
        })
      }
    }

    const neighbors = perception.filter(
      c => c.inBounds && !(c.dx === 0 && c.dy === 0) && Math.abs(c.dx) <= 1 && Math.abs(c.dy) <= 1
    )

    const attackDrive =
      (W_aggression * motivations.aggression + W_hunger * motivations.hunger) / Math.max(W_aggression + W_hunger, 0.001)
    const defenseDrive =
      (W_aggression * motivations.aggression + W_fear * motivations.fearEffective * genes.defense_instinct) /
      Math.max(W_aggression + W_fear * genes.defense_instinct, 0.001)

    for (const cell of neighbors) {
      const cellEnergyNorm = clamp(cell.energy / Math.max(genes.max_energy_norm, 1), 0, 1)
      const spacePref = clamp(
        (1 - cell.localDensity) * (1 - genes.crowd_preference) + cell.localDensity * genes.crowd_preference,
        0,
        1
      )

      const moveHunger = W_hunger * cellEnergyNorm * motivations.hunger
      const seekInfo =
        bestEnergyTarget && bestEnergyTarget.strength > 0
          ? (() => {
              const newDist = Math.sqrt(
                (bestEnergyTarget.x - cell.x) * (bestEnergyTarget.x - cell.x) +
                  (bestEnergyTarget.y - cell.y) * (bestEnergyTarget.y - cell.y)
              )
              const toward = Math.max(0, bestEnergyTarget.dist - newDist)
              const pull = clamp(bestEnergyTarget.strength * toward, 0, 1)
              const score = W_hunger * motivations.hunger * pull
              return {
                bestX: bestEnergyTarget.x,
                bestY: bestEnergyTarget.y,
                bestDist: bestEnergyTarget.dist,
                bestStrength: bestEnergyTarget.strength,
                newDist,
                toward,
                pull,
                score
              }
            })()
          : null
      const moveSeekEnergy = seekInfo?.score ?? 0
      const moveAggro = W_aggression * cell.prey * motivations.aggression
      const moveExplore = W_exploration * spacePref * motivations.exploration
      const moveFear = W_fear * cell.threat * motivations.fearEffective
      const moveKin = (W_exploration * motivations.exploration + W_fear * motivations.fearEffective) * cell.kinAffinity
      const moveUtil = moveHunger + moveSeekEnergy + moveAggro + moveExplore + moveKin - moveFear

      if (!cell.occupied) {
        const moveDecision: ActionDecision = {
          type: 'MOVE',
          targetX: cell.x,
          targetY: cell.y,
          utility: moveUtil,
          description: `move to ${cell.x},${cell.y}`
        }
        decisions.push(moveDecision)
        if (debug) {
          debugRows.push({
            type: moveDecision.type,
            whyLines: [
              `I consider MOVE to ${cell.x},${cell.y} (dx=${cell.dx}, dy=${cell.dy}).`,
              `Is the destination occupied? no.`,
              ``,
              `Food on destination: this cell has ${cell.energy.toFixed(3)} energy.`,
              `Energy normalized is ${cellEnergyNorm.toFixed(3)} (relative to maxEnergyNorm=${genes.max_energy_norm.toFixed(3)}).`,
              `My hunger is ${motivations.hunger.toFixed(3)} and W_hunger is ${W_hunger.toFixed(3)}.`,
              `So this cell looks attractive for food by: W_hunger * hunger * energyNorm = ${W_hunger.toFixed(3)} * ${motivations.hunger.toFixed(3)} * ${cellEnergyNorm.toFixed(3)} = ${moveHunger.toFixed(3)}.`,
              ...(seekInfo
                ? [
                    ``,
                    `I also see a "best energy spot" somewhere: ${seekInfo.bestX},${seekInfo.bestY}.`,
                    `Its strength (after distance decay) is ${seekInfo.bestStrength.toFixed(3)}.`,
                    `If I go to ${cell.x},${cell.y}, my distance to that best spot becomes ${seekInfo.newDist.toFixed(3)}.`,
                    `Right now my distance to that best spot is ${seekInfo.bestDist.toFixed(3)}.`,
                    `Moving toward it by ${seekInfo.toward.toFixed(3)} gives me a pull of ${seekInfo.pull.toFixed(3)} (0..1).`,
                    `That pull becomes extra motivation: W_hunger * hunger * pull = ${W_hunger.toFixed(3)} * ${motivations.hunger.toFixed(3)} * ${seekInfo.pull.toFixed(3)} = ${moveSeekEnergy.toFixed(3)}.`
                  ]
                : []),
              ``,
              `Hunting/attack opportunity: prey score at destination is ${cell.prey.toFixed(3)}.`,
              `My aggression mood is ${motivations.aggression.toFixed(3)} and W_aggression is ${W_aggression.toFixed(3)}.`,
              `So prey bonus = W_aggression * aggression * prey = ${W_aggression.toFixed(3)} * ${motivations.aggression.toFixed(3)} * ${cell.prey.toFixed(3)} = ${moveAggro.toFixed(3)}.`,
              ``,
              `Comfort/exploration: local density there is ${cell.localDensity.toFixed(3)}, crowd preference gene is ${genes.crowd_preference.toFixed(3)}.`,
              `So space preference there is ${spacePref.toFixed(3)}.`,
              `Exploration mood is ${motivations.exploration.toFixed(3)} and W_explore is ${W_exploration.toFixed(3)}.`,
              `Explore bonus = W_explore * exploration * spacePref = ${W_exploration.toFixed(3)} * ${motivations.exploration.toFixed(3)} * ${spacePref.toFixed(3)} = ${moveExplore.toFixed(3)}.`,
              ``,
              `Relatives: kin affinity there is ${cell.kinAffinity.toFixed(3)}.`,
              `So I get a comfort bonus from kin: (W_explore*exploration + W_fear*effectiveFear) * kinAffinity`,
              `= (${W_exploration.toFixed(3)}*${motivations.exploration.toFixed(3)} + ${W_fear.toFixed(3)}*${motivations.fearEffective.toFixed(3)}) * ${cell.kinAffinity.toFixed(3)} = ${moveKin.toFixed(3)}.`,
              ``,
              `Fear: threat there is ${cell.threat.toFixed(3)} and my effective fear is ${motivations.fearEffective.toFixed(3)} with W_fear=${W_fear.toFixed(3)}.`,
              `Fear cost = W_fear * threat * effectiveFear = ${W_fear.toFixed(3)} * ${cell.threat.toFixed(3)} * ${motivations.fearEffective.toFixed(3)} = ${moveFear.toFixed(3)}.`,
              ``,
              `Base score for MOVE = food + seekFood + prey + explore + kin - fear`,
              `= ${moveHunger.toFixed(3)} + ${moveSeekEnergy.toFixed(3)} + ${moveAggro.toFixed(3)} + ${moveExplore.toFixed(3)} + ${moveKin.toFixed(3)} - ${moveFear.toFixed(3)} = ${moveUtil.toFixed(3)}.`
            ],
            target: `${cell.x},${cell.y} (dx=${cell.dx},dy=${cell.dy})`,
            dx: cell.dx,
            dy: cell.dy,
            base: moveUtil,
            inertia: 0,
            noise: 0,
            final: 0
          })
        }
      } else {
        const occupants = getCellOrbs(cell.x, cell.y, this.id)
        const distToCell = Math.sqrt(cell.dx * cell.dx + cell.dy * cell.dy)
        const kernelToCell = Math.pow(genes.distance_decay, distToCell)
        const diagToCell = cell.dx !== 0 && cell.dy !== 0 ? genes.diagonal_awareness : 1.0

        let directThreatSum = 0
        let directPreySum = 0
        for (const other of occupants) {
          const enemyHpNorm = clamp(other.hp / genes.hp_healthy_norm, 0, 1)
          const enemyAdvantage = enemyHpNorm / Math.max(motivations.hpNorm, 0.001)
          const kinship = this.kinshipTo(other)
          const trustedThreatReduction = clamp(kinship * genes.trust_in_relatives, 0, 1)
          const threatModifier = clamp(1 - trustedThreatReduction, 0, 1)
          const threatContribution = enemyAdvantage * kernelToCell * diagToCell * threatModifier

          const ourAdvantage = motivations.hpNorm / Math.max(enemyHpNorm, 0.001)
          const attackFeasibility = ourAdvantage / genes.attack_margin
          const attackSignal = clamp(attackFeasibility - 1, 0, 1)

          const fRetaliation = clamp(genes.retaliation_fear * enemyAdvantage * (1 - motivations.riskDrive), 0, 1)
          const retaliationFactor = clamp(1 - fRetaliation * (1 - genes.defense_instinct), 0, 1)
          directThreatSum += threatContribution * retaliationFactor
          const preyBase = attackSignal * genes.cannibalism_factor * genes.territoriality * (1 - fRetaliation)

          const relativeAggression = clamp(genes.aggression_towards_relatives, 0, 1)
          const preyModifier = clamp((1 - kinship) + kinship * relativeAggression, 0, 1)
          directPreySum += preyBase * kernelToCell * diagToCell * preyModifier
        }

        const directThreat = clamp(directThreatSum, 0, 1)
        const directPrey = clamp(directPreySum, 0, 1)
        const interaction = debug
          ? (() => {
              const dist = Math.sqrt(cell.dx * cell.dx + cell.dy * cell.dy)
              const kernel = Math.pow(genes.distance_decay, dist)
              const isDiagonal = cell.dx !== 0 && cell.dy !== 0
              const diagModifier = isDiagonal ? genes.diagonal_awareness : 1.0

              const lines: string[] = []
              if (occupants.length === 0) {
                lines.push(`I expected an orb here, but found none when checking the cell directly.`)
                return {
                  lines,
                  threatSum: 0,
                  preySum: 0,
                  threat: 0,
                  prey: 0,
                  kernel,
                  diagModifier
                }
              }

              let threatSum = 0
              let preySum = 0

              lines.push(`This cell has ${occupants.length} orb(s): ${occupants.map(o => o.name).join(', ')}.`)
              lines.push(`I evaluate kinship (shared ancestors) and adjust threat and prey signals.`)
              lines.push(
                `My kinship genes: trust_in_relatives=${genes.trust_in_relatives.toFixed(3)}, aggression_towards_relatives=${genes.aggression_towards_relatives.toFixed(3)}.`
              )
              lines.push(`Distance decay kernel here is distance_decay^dist = ${genes.distance_decay.toFixed(3)}^${dist.toFixed(3)} = ${kernel.toFixed(3)}.`)
              lines.push(`Diagonal modifier is ${diagModifier.toFixed(3)}.`)

              for (const other of occupants) {
                const enemyHpNorm = clamp(other.hp / genes.hp_healthy_norm, 0, 1)
                const enemyAdvantage = enemyHpNorm / Math.max(motivations.hpNorm, 0.001)
                const kinship = this.kinshipTo(other)
                const trustedThreatReduction = clamp(kinship * genes.trust_in_relatives, 0, 1)
                const threatModifier = clamp(1 - trustedThreatReduction, 0, 1)
                const threatContribution = enemyAdvantage * kernel * diagModifier * threatModifier
                threatSum += threatContribution

                const ourAdvantage = motivations.hpNorm / Math.max(enemyHpNorm, 0.001)
                const attackFeasibility = ourAdvantage / genes.attack_margin
                const attackSignal = clamp(attackFeasibility - 1, 0, 1)

                const fRetaliation = clamp(genes.retaliation_fear * enemyAdvantage * (1 - motivations.riskDrive), 0, 1)
                const preyBase = attackSignal * genes.cannibalism_factor * genes.territoriality * (1 - fRetaliation)
                const preyModifier = clamp((1 - kinship) + kinship * clamp(genes.aggression_towards_relatives, 0, 1), 0, 1)
                const preyContribution = preyBase * kernel * diagModifier * preyModifier
                preySum += preyContribution

                lines.push(
                  `Kinship to ${other.name} is ${kinship.toFixed(3)}. threatModifier=(1-kinship*trust)=(1-${kinship.toFixed(3)}*${genes.trust_in_relatives.toFixed(3)})=${threatModifier.toFixed(3)}.`
                )
                lines.push(
                  `Threat contribution: enemyAdvantage*kernel*diag*threatModifier = ${enemyAdvantage.toFixed(3)}*${kernel.toFixed(3)}*${diagModifier.toFixed(3)}*${threatModifier.toFixed(3)} = ${threatContribution.toFixed(3)}.`
                )
                lines.push(
                  `Prey modifier: (1-kinship)+kinship*aggrRel = (1-${kinship.toFixed(3)})+${kinship.toFixed(3)}*${genes.aggression_towards_relatives.toFixed(3)} = ${preyModifier.toFixed(3)}.`
                )
                lines.push(
                  `Prey contribution: preyBase*kernel*diag*preyModifier = ${preyBase.toFixed(3)}*${kernel.toFixed(3)}*${diagModifier.toFixed(3)}*${preyModifier.toFixed(3)} = ${preyContribution.toFixed(3)}.`
                )
              }

              const threat = clamp(threatSum, 0, 1)
              const prey = clamp(preySum, 0, 1)
              lines.push(`After summing all occupants, threatSum=${threatSum.toFixed(3)} -> threat(clamped)=${threat.toFixed(3)}.`)
              lines.push(`After summing all occupants, preySum=${preySum.toFixed(3)} -> prey(clamped)=${prey.toFixed(3)}.`)

              return { lines, threatSum, preySum, threat, prey, kernel, diagModifier }
            })()
          : null

        if (directThreat > 0) {
          const attackUtility = directThreat * defenseDrive
          const attackDecision: ActionDecision = {
            type: 'ATTACK',
            targetX: cell.x,
            targetY: cell.y,
            utility: attackUtility,
            description: `attack at ${cell.x},${cell.y}`
          }
          decisions.push(attackDecision)
          if (debug && interaction) {
            debugRows.push({
              type: attackDecision.type,
              whyLines: [
                `I consider ATTACK at ${cell.x},${cell.y} (dx=${cell.dx}, dy=${cell.dy}).`,
                `Is there threat there? yes (threat score=${directThreat.toFixed(3)}).`,
                ``,
                ...interaction.lines,
                ``,
                `I combine aggression and fear into a "defenseDrive" so I know how much I want to fight back.`,
                `defenseDrive=${defenseDrive.toFixed(3)} (aggression + fear * defense_instinct).`,
                `Base score for ATTACK = threat * defenseDrive = ${directThreat.toFixed(3)} * ${defenseDrive.toFixed(3)} = ${attackUtility.toFixed(3)}.`
              ],
              target: `${cell.x},${cell.y} (dx=${cell.dx},dy=${cell.dy})`,
              dx: cell.dx,
              dy: cell.dy,
              base: attackUtility,
              inertia: 0,
              noise: 0,
              final: 0
            })
          }
        }

        if (directPrey <= 0) {
          continue
        }

        const bitePreyDrive = directPrey * attackDrive
        const biteGreed = genes.kill_greed * directPrey
        const biteFear = W_fear * cell.threat * motivations.fearEffective
        const biteUtility = bitePreyDrive + biteGreed - biteFear
        const biteDecision: ActionDecision = {
          type: 'BITE',
          targetX: cell.x,
          targetY: cell.y,
          utility: biteUtility,
          description: `bite at ${cell.x},${cell.y}`
        }
        decisions.push(biteDecision)
        if (debug && interaction) {
          debugRows.push({
            type: biteDecision.type,
            whyLines: [
              `I consider BITE at ${cell.x},${cell.y} (dx=${cell.dx}, dy=${cell.dy}).`,
              `Is there prey there? yes (prey score=${directPrey.toFixed(3)}).`,
              `Threat there is ${cell.threat.toFixed(3)}.`,
              ``,
              ...interaction.lines,
              ``,
              `I combine hunger and aggression into an "attackDrive" so I know how much I want to bite.`,
              `attackDrive=${attackDrive.toFixed(3)} (mix of hunger and aggression weights/moods).`,
              `So the main bite drive is: prey * attackDrive = ${directPrey.toFixed(3)} * ${attackDrive.toFixed(3)} = ${bitePreyDrive.toFixed(3)}.`,
              ``,
              `I also have a "kill greed" gene that makes me want to attack even beyond pure need.`,
              `kill_greed=${genes.kill_greed.toFixed(3)} so greed bonus = kill_greed * prey = ${genes.kill_greed.toFixed(3)} * ${directPrey.toFixed(3)} = ${biteGreed.toFixed(3)}.`,
              ``,
              `But biting is risky if the area is dangerous.`,
              `Fear cost = W_fear * threat * effectiveFear = ${W_fear.toFixed(3)} * ${cell.threat.toFixed(3)} * ${motivations.fearEffective.toFixed(3)} = ${biteFear.toFixed(3)}.`,
              ``,
              `Base score for BITE = drive + greed - fearCost = ${bitePreyDrive.toFixed(3)} + ${biteGreed.toFixed(3)} - ${biteFear.toFixed(3)} = ${biteUtility.toFixed(3)}.`
            ],
            target: `${cell.x},${cell.y} (dx=${cell.dx},dy=${cell.dy})`,
            dx: cell.dx,
            dy: cell.dy,
            base: biteUtility,
            inertia: 0,
            noise: 0,
            final: 0
          })
        }
      }
    }

    for (let i = 0; i < decisions.length; i++) {
      const d = decisions[i]
      const base = d.utility
      const inertia = (1 - genes.inertia_bias) * base + genes.inertia_bias * this.lastActionUtility
      const noise = (Math.random() * 2 - 1) * genes.decision_noise
      const finalUtil = inertia + noise
      d.utility = finalUtil
      if (debug) {
        debugRows[i].inertia = inertia
        debugRows[i].noise = noise
        debugRows[i].final = finalUtil
        debugRows[i].whyLines.push(
          ``,
          `Now I turn this base score into a final score (because I'm not perfectly rational).`,
          `Base score = ${base.toFixed(3)}.`,
          `My inertia_bias gene is ${genes.inertia_bias.toFixed(3)}.`,
          `My last action score was ${this.lastActionUtility.toFixed(3)}.`,
          `I blend them: inertia = (1-inertia_bias)*base + inertia_bias*last = ${(1 - genes.inertia_bias).toFixed(3)}*${base.toFixed(3)} + ${genes.inertia_bias.toFixed(3)}*${this.lastActionUtility.toFixed(3)} = ${inertia.toFixed(3)}.`,
          `Then I add randomness: decision_noise gene is ${genes.decision_noise.toFixed(3)}.`,
          `Random noise sampled this turn is ${noise.toFixed(3)}.`,
          `Final score = inertia + noise = ${inertia.toFixed(3)} + ${noise.toFixed(3)} = ${finalUtil.toFixed(3)}.`
        )
      }
    }

    const impulsiveRoll = Math.random()
    if (impulsiveRoll < genes.impulsiveness) {
      const pickRoll = Math.random()
      const picked = decisions[Math.floor(pickRoll * decisions.length)]
      if (debug) {
        console.groupCollapsed(
          `Decision: ${this.name} age=${this.age} hp=${this.hp.toFixed(2)} @${this.x},${this.y} (impulsive)`
        )
        console.table({
          id: this.id,
          hpNorm: Number(motivations.hpNorm.toFixed(3)),
          hunger: Number(motivations.hunger.toFixed(3)),
          fear: Number(motivations.fear.toFixed(3)),
          fearEffective: Number(motivations.fearEffective.toFixed(3)),
          aggression: Number(motivations.aggression.toFixed(3)),
          reproduction: Number(motivations.reproduction.toFixed(3)),
          exploration: Number(motivations.exploration.toFixed(3))
        })
        console.table({
          W_hunger: Number(W_hunger.toFixed(3)),
          W_aggression: Number(W_aggression.toFixed(3)),
          W_exploration: Number(W_exploration.toFixed(3)),
          W_fear: Number(W_fear.toFixed(3)),
          inertia_bias: Number(genes.inertia_bias.toFixed(3)),
          decision_noise: Number(genes.decision_noise.toFixed(3)),
          impulsiveness: Number(genes.impulsiveness.toFixed(3)),
          trust_in_relatives: Number(genes.trust_in_relatives.toFixed(3)),
          aggression_towards_relatives: Number(genes.aggression_towards_relatives.toFixed(3))
        })
        console.table({
          currentEnergy: Number(currentEnergy.toFixed(3)),
          currentEnergyNorm: Number(currentEnergyNorm.toFixed(3)),
          currentThreat: Number(currentThreat.toFixed(3)),
          currentLocalDensity: Number(currentLocalDensity.toFixed(3)),
          spacePrefCurrent: Number(spacePrefCurrent.toFixed(3)),
          lastActionUtility: Number(this.lastActionUtility.toFixed(3)),
          lastActionType: this.lastActionType ?? ''
        })
        console.log(`impulsiveRoll=${impulsiveRoll.toFixed(3)} pickRoll=${pickRoll.toFixed(3)}`)
        console.table(
          debugRows.map(r => ({
            type: r.type,
            target: r.target,
            direction:
              typeof r.dx === 'number' && typeof r.dy === 'number' ? directionFromDelta(r.dx, r.dy) : '',
            dx: typeof r.dx === 'number' ? r.dx : '',
            dy: typeof r.dy === 'number' ? r.dy : '',
            base: Number(r.base.toFixed(3)),
            inertia: Number(r.inertia.toFixed(3)),
            noise: Number(r.noise.toFixed(3)),
            final: Number(r.final.toFixed(3)),
          }))
        )
        for (const r of debugRows) {
          const dx = r.dx
          const dy = r.dy
          const hasDelta = typeof dx === 'number' && typeof dy === 'number'
          const direction = hasDelta ? directionFromDelta(dx, dy) : ''
          const deltaText = hasDelta ? ` (${direction}, dx=${dx}, dy=${dy})` : ''
          console.groupCollapsed(`${r.type} to ${r.target}${deltaText}`)
          for (const line of r.whyLines) {
            if (line.length === 0) console.log('')
            else console.log(`  ${line}`)
          }
          console.groupEnd()
        }
        const pickedIndex = decisions.indexOf(picked)
        const pickedRow = pickedIndex >= 0 ? debugRows[pickedIndex] : null
        const pickedDir =
          pickedRow && typeof pickedRow.dx === 'number' && typeof pickedRow.dy === 'number'
            ? directionFromDelta(pickedRow.dx, pickedRow.dy)
            : ''
        const pickedDirText = pickedDir ? ` (${pickedDir})` : ''
        const pickedTarget = pickedRow ? ` to ${pickedRow.target}` : ''
        console.log(`picked: ${picked.type}${pickedTarget}${pickedDirText} (${picked.description}) u=${picked.utility.toFixed(3)}`)
        console.groupEnd()
      }
      return picked
    }

    let best = decisions[0]
    for (const d of decisions) {
      if (d.utility > best.utility) best = d
    }

    if (debug) {
      console.groupCollapsed(`Decision: ${this.name} age=${this.age} hp=${this.hp.toFixed(2)} @${this.x},${this.y}`)
      console.log('My motivations:')
      console.table({
        hpNorm: Number(motivations.hpNorm.toFixed(3)),
        fearEffective: Number(motivations.fearEffective.toFixed(3)),
        hunger: Number(motivations.hunger.toFixed(3)),
        fear: Number(motivations.fear.toFixed(3)),
        aggression: Number(motivations.aggression.toFixed(3)),
        reproduction: Number(motivations.reproduction.toFixed(3)),
        exploration: Number(motivations.exploration.toFixed(3))
      })
      console.log('My gene motivation weights:')
      console.table({
          W_hunger: Number(W_hunger.toFixed(3)),
          W_aggression: Number(W_aggression.toFixed(3)),
          W_exploration: Number(W_exploration.toFixed(3)),
          W_fear: Number(W_fear.toFixed(3)),
          W_reproductions: Number(W_reproduction.toFixed(3)),
      })
      console.log('My gene decision modifiers:')
      console.table({
        inertia_bias: Number(genes.inertia_bias.toFixed(3)),
        decision_noise: Number(genes.decision_noise.toFixed(3)),
        impulsiveness: Number(genes.impulsiveness.toFixed(3)),
        trust_in_relatives: Number(genes.trust_in_relatives.toFixed(3)),
        aggression_towards_relatives: Number(genes.aggression_towards_relatives.toFixed(3))
      })
      console.table({
        currentEnergy: Number(currentEnergy.toFixed(3)),
        currentEnergyNorm: Number(currentEnergyNorm.toFixed(3)),
        currentThreat: Number(currentThreat.toFixed(3)),
        currentLocalDensity: Number(currentLocalDensity.toFixed(3)),
        spacePrefCurrent: Number(spacePrefCurrent.toFixed(3)),
        lastActionUtility: Number(this.lastActionUtility.toFixed(3)),
        lastActionType: this.lastActionType ?? ''
      })
      console.log(`impulsiveRoll=${impulsiveRoll.toFixed(3)}`)
      console.table(
        debugRows.map(r => ({
          type: r.type,
          target: r.target,
          base: Number(r.base.toFixed(3)),
          inertia: Number(r.inertia.toFixed(3)),
          noise: Number(r.noise.toFixed(3)),
          final: Number(r.final.toFixed(3)),
        }))
      )
      for (const r of debugRows) {
        const dx = r.dx
        const dy = r.dy
        const hasDelta = typeof dx === 'number' && typeof dy === 'number'
        const direction = hasDelta ? directionFromDelta(dx, dy) : ''
        const deltaText = hasDelta ? ` (${direction}, dx=${dx}, dy=${dy})` : ''
        console.groupCollapsed(`${r.type} to ${r.target}${deltaText}`)
        for (const line of r.whyLines) {
          if (line.length === 0) console.log('')
          else console.log(`  ${line}`)
        }
        console.groupEnd()
      }
      console.log(`best: ${best.type} (${best.description}) u=${best.utility.toFixed(3)}`)
      console.groupEnd()
    }

    this.lastActionUtility = best.utility
    return best
  }

  executeDecision(d: ActionDecision) {
    this.lastActionType = d.type
    this.addToLog(`I decided to ${d.description} (u=${d.utility.toFixed(2)})`)
    
    switch (d.type) {
      case 'WAIT':
        this.addToLog('zZz...')
        break
      case 'CONSUME':
        this.consumeEnergy()
        break
      case 'MOVE':
        if (d.targetX !== undefined && d.targetY !== undefined) {
           this.move(d.targetX, d.targetY)
        }
        break
      case 'BITE':
        if (d.targetX !== undefined && d.targetY !== undefined) {
           this.bite(d.targetX, d.targetY)
        }
        break
      case 'ATTACK':
        if (d.targetX !== undefined && d.targetY !== undefined) {
           this.attack(d.targetX, d.targetY)
        }
        break
      case 'DIVIDE':
        // Try to divide into a free neighbor
        this.attemptDivide()
        break
    }
  }

  // -- Actions --

  move(x: number, y: number) {
    const occupants = getCellOrbs(x, y)
    if (occupants.length > 0) {
      this.addToLog(`It is occupied`)
      return
    }

    this.x = x
    this.y = y

    if (!withinWorldBoundaries(x, y)) {
      this.addToLog(`I jump out of the world`)
      this.deathReason = deathReasons.OUT_OF_WORLD
      this.die()
      return
    }

    this.addToLog(`It worked`)
    if (getCellEnergy(this.y, this.x) > 0) {
      this.consumeEnergy()
    }
  }

  bite(x: number, y: number) {
    this.triggerGlow('glow-red')

    let cellOrbs = getCellOrbs(x, y, this.id)
    if (cellOrbs.length === 0) {
      this.addToLog(`No one is there`)
      return
    }

    this.bitePrey(cellOrbs[0])
  }

  attack(x: number, y: number) {
    this.triggerGlow('glow-orange')

    const cellOrbs = getCellOrbs(x, y, this.id)
    if (cellOrbs.length === 0) {
      this.addToLog(`No one is there`)
      return
    }

    this.attackTarget(cellOrbs[0])
  }

  bitePrey(prey: Orb) {
    addAttackEffect('bite', this.x, this.y, prey.x, prey.y)
    const intendedBite = Math.round(this.hp * bitePercentOfAttackerHp)
    const biteAmount = Math.min(intendedBite, prey.hp)

    const mineralDropRaw = Math.floor(biteAmount * biteMineralDropFraction)
    const mineralDrop = Math.min(biteAmount, Math.max(biteMineralDropMin, mineralDropRaw))
    const hpTransfer = biteAmount - mineralDrop

    const preyX = prey.x
    const preyY = prey.y
    const dropX = preyX
    const dropY = withinWorldBoundaries(preyX, preyY + 1) ? preyY + 1 : preyY

    const kills = prey.hp - biteAmount <= 0
    prey.addToLog(`I was bitten by ${this.name} and lost ${biteAmount} hp`)
    if (kills) {
      prey.deathReason = deathReasons.EATEN
    }
    prey.loseHp(biteAmount)

    if (hpTransfer > 0) {
      this.gainHp(hpTransfer)
      registerHpGainedFromEating(hpTransfer)
    }

    if (mineralDrop > 0) {
      addCellEnergy(dropY, dropX, mineralDrop)
    }

    this.addToLog(`I bit Orb ${prey.id}: -${biteAmount}hp, +${hpTransfer}hp, dropped ${mineralDrop}`)
    this.preventAgingThisTurn = true
  }

  attackTarget(target: Orb) {
    addAttackEffect('attack', this.x, this.y, target.x, target.y)
    const intendedAttack = Math.round(this.hp * bitePercentOfAttackerHp)
    const attackAmount = Math.min(intendedAttack, target.hp)

    target.addToLog(`I was attacked by ${this.name} and lost ${attackAmount} hp`)
    target.loseHp(attackAmount)

    this.addToLog(`I attacked Orb ${target.id}: -${attackAmount}hp`)
    this.preventAgingThisTurn = true
  }

  attemptDivide() {
    // Find empty neighbor
    const neighbors = [
      [this.x - 1, this.y], [this.x + 1, this.y],
      [this.x, this.y - 1], [this.x, this.y + 1]
    ]
    for (const [nx, ny] of neighbors) {
       if (withinWorldBoundaries(nx, ny) && getCellOrbs(nx, ny).length === 0) {
         this.giveBirth(nx, ny)
         return
       }
    }
    this.addToLog('No space to divide')
  }

  giveBirth(x: number, y: number) {
    if (canGiveBirth(this)) {
      this.triggerGlow('glow-green')
      
      const { childHp, totalCost } = computeBirthCost(this.hp, this.genes)
      
      // Safety check
      if (this.hp - totalCost <= 0) {
         this.addToLog('Too weak to divide')
         return
      }

      const child = spawnOrb(x, y, childHp, this.genes, this)
      addAttackEffect('spawn', this.x, this.y, x, y)

      this.loseHp(totalCost)
      this.reproductionCooldownRemaining = Math.max(0, Math.round(this.genes.reproduction_cooldown))
      this.addToLog(`It spawned ${child.name}`)
      registerBirth()
    } else {
      this.addToLog(`I cannot give birth right now`)
    }
  }

  consumeEnergy() {
    const energyHere = getCellEnergy(this.y, this.x)
    if (energyHere > 0) {
      consumeCellEnergy(this.y, this.x, 1)
      registerEnergyConsumed(1)
      this.addToLog(`It worked`)
      this.gainHp(hpGainByEnergyConsumption)
      registerHpGainedFromConsumingEnergy(hpGainByEnergyConsumption)
      this.preventAgingThisTurn = true
      this.triggerGlow('glow-white')
    } else {
      this.addToLog(`No energy here`)
    }
  }

  // -- helpers --

  gainHp(amount: number) {
    this.hp += amount
    this.addToLog(`❤️${this.hp}`)
  }

  loseHp(amount: number) {
    this.hp -= amount
    this.addToLog(`❤️${this.hp}`)
    if (this.hp <= 0) {
      this.die()
    }
  }

  layDownEnergy(value: number) {
    if (value <= 0) {
      return
    }
    addCellEnergy(this.y, this.x, value)
  }

  die() {
    if (withinWorldBoundaries(this.x, this.y)) {
      this.layDownEnergy(energyCreatedOnDeath)
    }
    if (!this.deathReason) {
      this.deathReason = deathReasons.NO_HP
    }

    this.addToLog(`☠️ I died at age of ${this.age}`)
    registerDeath(this.deathReason ?? deathReasons.NO_HP, this.age)
    lastTurnDeadOrbs.push(this)

    removeWorldObject(this)
  }

  addToLog(entry: string) {
    // Ensure there is a current turn block to append to
    if (!this.log[this.log.length - 1]) {
      this.log.push([])
    }
    const cleaned = entry.replace(/>/g, '').trim()
    if (cleaned.length > 0) {
      this.log[this.log.length - 1].push(cleaned)
    }
  }

  getColor() {
    // Color based on genes
    // Aggression -> Red
    // Consumption/Hunger -> Green
    // Fear/Social -> Blue
    
    const r = Math.min(255, this.genes.aggression_weight * 100 + this.genes.aggression_hp_sensitivity * 100)
    const g = Math.min(255, this.genes.hunger_weight * 100 + this.genes.hunger_hp_sensitivity * 50)
    const b = Math.min(255, this.genes.fear_weight * 100 + this.genes.exploration_weight * 20)

    return {
      reds: r,
      greens: g,
      blues: b
    }
  }
}

// ---- WORLD -----

let world: any = []
let worldEnergy: number[][] = []

let orbs: Orb[] = []
let lastTurnDeadOrbs: Orb[] = []

function generateWorld(worldIteration: number = 0) {
  if (deathStatsPerGeneration.length === 0) {
    startNewGeneration()
  }

  generateMap()

  if (worldIteration > 0) {
    // последующие геренации
    // Build strongest list from last generation's dead orbs, ensuring unique IDs
    const sorted = [...lastTurnDeadOrbs].sort((a, b) => b.age - a.age)
    const strongestOrbs: Orb[] = []
    const seen = new Set<string>()
    for (const orb of sorted) {
      if (seen.has(orb.id)) {
        continue
      }
      seen.add(orb.id)
      strongestOrbs.push(orb)
      if (strongestOrbs.length >= newGenStrongestCount) {
        break
      }
    }

    orbs = []
    lastTurnDeadOrbs = []

    // каждый орб дает двух потомков
    for (const strongestOrb of strongestOrbs) {
      for (let i = 0; i < newGenOffspringPerParent; i++) {
        const [ x, y ] = getRandomEmptyCell()
        const hp = getRandomMinMax(initialOrbHP[0], initialOrbHP[1])
        // First orbs of a new generation should have only one name (DNA-based)
        spawnOrb(x, y, hp, strongestOrb.genes, strongestOrb)
      }
    }

    // переносим  
    if (resetEnergyOnNewGenerations) {
      // Reset energy on each subsequent generation
      reseedRandomEnergy()
    } else {
      // Keep existing energy grid; no redistribution
      if (!Array.isArray(worldEnergy) || worldEnergy.length === 0) {
        worldEnergy = []
        for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
          worldEnergy.push(Array(worldSize[1]).fill(0))
        }
        distributeEnergyOnMap(initialEnergyOnMap)
      }
    }
  } else {
    // первая генерация
    orbs = []
    spawnArchetypeCursor = 0
    for (let i = 0; i < initialOrbsCount; i++) {
      const [ x, y ] = getRandomEmptyCell()
      const hp = getRandomMinMax(initialOrbHP[0], initialOrbHP[1])
      spawnOrb(x, y, hp)
    }

    // заполняем мир пурвой энергией
    reseedRandomEnergy()
  }

  // Record energy present at the beginning of this generation
  if (currentGeneration > 0) {
    deathStatsPerGeneration[currentGeneration - 1].energyStart = sumWorldEnergy()
  }
}

function reseedRandomEnergy() {
  worldEnergy = []
  for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
    worldEnergy.push(Array(worldSize[1]).fill(0))
  }
  distributeEnergyOnMap(initialEnergyOnMap)
}

function generateMap() {
  world = []
  for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
    world.push(Array(worldSize[1]).fill(0))
  }
}

function distributeEnergyOnMap(total: number) {
  if (!total || total <= 0) {
    return
  }
  for (let i = 0; i < total; i++) {
    const rowIndex = getRandomMinMax(0, worldSize[0] - 1)
    const colIndex = getRandomMinMax(0, worldSize[1] - 1)
    addCellEnergy(rowIndex, colIndex, 1)
  }
}

function spawnOrb(
  x: number,
  y: number,
  hp: number,
  ancestorGenes?: Genes,
  parent?: Orb | null
): Orb {
  const genes = ancestorGenes
    ? getMutatedGenes(ancestorGenes)
    : getRandomGenes()

  const orb = new Orb(x, y, hp, genes, parent)
  orbs.push(orb)

  return orb
}

function updateWorldEnergy(turnNum: number) {
  if (!worldEnergy || worldEnergy.length === 0) {
    return
  }

  const shouldReplenish =
    energyReplenishIntervalTurns > 0 && (turnNum + 1) % energyReplenishIntervalTurns === 0

  const base: number[][] = []
  for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
    base.push([ ...(worldEnergy[rowIndex] ?? Array(worldSize[1]).fill(0)) ])
  }

  const spreadTargets = new Set<string>()

  for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
    for (let colIndex = 0; colIndex < worldSize[1]; colIndex++) {
      const energy = base[rowIndex]?.[colIndex] ?? 0

      if (shouldReplenish && energy > 0 && getCellOrbs(colIndex, rowIndex).length === 0) {
        addCellEnergy(rowIndex, colIndex, 1)
      }

      if (energy >= energySpreadThreshold) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) {
              continue
            }
            const nextRow = rowIndex + dy
            const nextCol = colIndex + dx
            if (!withinWorldBoundaries(nextCol, nextRow)) {
              continue
            }
            if ((base[nextRow]?.[nextCol] ?? 0) === 0) {
              spreadTargets.add(`${nextRow},${nextCol}`)
            }
          }
        }
      }
    }
  }

  for (const key of spreadTargets) {
    const [ rowIndex, colIndex ] = key.split(',').map(Number)
    addCellEnergy(rowIndex, colIndex, 1)
  }
}

function makeTurn(_turnNum: number) {
  updateWorldEnergy(_turnNum)
  for (const orb of orbs) {
    if (orb.hp > 0) {
      orb.act()
    } else {

    }
  }
}

// ----- HELPERS -----

function computeBirthCost(parentHp: number, genes: Genes): {
  childHp: number
  tax: number
  totalCost: number
  costFraction: number
} {
  const childHp = Math.ceil(parentHp * genes.offspring_investment)
  const tax = Math.ceil(parentHp * (birthTaxPercent / 100))
  const totalCost = childHp + tax
  const costFraction = totalCost / Math.max(parentHp, 1)
  return { childHp, tax, totalCost, costFraction }
}

function canGiveBirth(orb: Orb): boolean {
  const hpNorm = clamp(orb.hp / Math.max(orb.genes.hp_healthy_norm, 1), 0, 1)
  const { totalCost } = computeBirthCost(orb.hp, orb.genes)
  return (
    hpNorm >= orb.genes.min_hp_to_divide &&
    orb.reproductionCooldownRemaining <= 0 &&
    orb.hp - totalCost > 0
  )
}

function withinWorldBoundaries(x: number, y: number) {
  // x is column index (horizontal), y is row index (vertical)
  return x >= 0 &&
    x < worldSize[1] &&
    y >= 0 &&
    y < worldSize[0]
}

// Energy helpers
function getCellEnergy(rowIndex: number, colIndex: number): number {
  if (!withinWorldBoundaries(colIndex, rowIndex)) {
    return 0
  }
  return worldEnergy[rowIndex]?.[colIndex] ?? 0
}

function addCellEnergy(rowIndex: number, colIndex: number, amount: number = 1): number {
  if (!withinWorldBoundaries(colIndex, rowIndex)) {
    return 0
  }
  if (!worldEnergy[rowIndex]) {
    worldEnergy[rowIndex] = Array(worldSize[1]).fill(0)
  }
  const current = worldEnergy[rowIndex][colIndex] ?? 0
  const next = current + Math.max(0, amount)
  worldEnergy[rowIndex][colIndex] = next
  return next
}

function consumeCellEnergy(rowIndex: number, colIndex: number, amount: number = 1): boolean {
  if (!withinWorldBoundaries(colIndex, rowIndex)) {
    return false
  }
  const current = getCellEnergy(rowIndex, colIndex)
  const need = Math.max(0, amount)
  if (current >= need) {
    worldEnergy[rowIndex][colIndex] = current - need
    return true
  }
  return false
}

// Sum all energy present on the field
function sumWorldEnergy(): number {
  if (!worldEnergy || worldEnergy.length === 0) {
    return 0
  }
  let sum = 0
  for (let r = 0; r < worldEnergy.length; r++) {
    const row = worldEnergy[r] || []
    for (let c = 0; c < row.length; c++) {
      sum += row[c] || 0
    }
  }
  return sum
}

function getRandomMinMax(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Returns coordinates of a random empty cell to ensure single occupancy
function getRandomEmptyCell(): [ number, number ] {
  // Try up to 1000 random picks to find an empty cell
  for (let i = 0; i < 1000; i++) {
    const x = getRandomMinMax(0, worldSize[1] - 1) // column
    const y = getRandomMinMax(0, worldSize[0] - 1) // row
    if (getCellOrbs(x, y).length === 0) {
      return [ x, y ]
    }
  }
  // Fallback: return any random cell (unlikely to be needed)
  return [ getRandomMinMax(0, worldSize[1] - 1), getRandomMinMax(0, worldSize[0] - 1) ]
}

function getCellOrbs(x: number, y: number, excludeId: string | null = null) {
  let o = orbs.filter(orb => orb.x === x && orb.y === y)
  if (excludeId) {
    o = o.filter(item => item.id !== excludeId)
  }
  return o
}

function removeWorldObject(obj: Orb) {
  for (let i = 0; i < orbs.length; i++) {
    if (orbs[i].id === obj.id) {
      orbs.splice(i, 1)
      return
    }
  }
}

function getRandomId(length: number) {
  let str = ''
  for (let i = 0; i < length; i++) {
    str += (Math.random() * 16 | 0).toString(16)
  }
  return str
}

function getRandomGenes(): Genes {
  const template = SPAWN_ARCHETYPES[spawnArchetypeCursor % SPAWN_ARCHETYPES.length] ?? DEFAULT_GENES
  spawnArchetypeCursor += 1
  return { ...template }
}

function getMutatedGenes(ancestor: Genes): Genes {
  const next = { ...ancestor }
  const mutationResilience = ancestor.mutation_resilience
  const scale = 1 - mutationResilience
  
  // Mutate all keys
  for (const key of Object.keys(next) as (keyof Genes)[]) {
     if (key === 'mutation_resilience') continue 
     if (key === 'reproduction_cooldown') {
       const base = Math.round(Number(next[key]) || 0)
       const delta = Math.round((Math.random() - 0.5) * 2 * 2 * scale)
       next[key] = clamp(base + delta, 0, 10)
       continue
     }
     if (key === 'recognized_ancestry_depth') {
       const base = Math.round(Number(next[key]) || 0)
       const delta = Math.round((Math.random() - 0.5) * 2 * 2 * scale)
       next[key] = clamp(base + delta, 1, kinshipMaxDepth)
       continue
     }

     const val = next[key]
     // Mutate by +/- 20% scaled by resilience
     const delta = (Math.random() - 0.5) * 2 * 0.2 * scale * val 
     // Additive noise for small params
     const additive = (Math.random() - 0.5) * 0.1 * scale
     
     let newVal = val + delta + additive
     
     if (
        key.endsWith('_weight') ||
        key === 'hp_healthy_norm' ||
        key === 'max_energy_norm' ||
        key.endsWith('_sensitivity') ||
        key === 'attack_margin'
      ) {
        newVal = Math.max(0.1, newVal)
     } else {
        newVal = clamp(newVal, 0, 1)
     }
     
     next[key] = newVal
  }
  
  // Mutate resilience
  next.mutation_resilience = clamp(next.mutation_resilience + (Math.random() - 0.5) * 0.1, 0, 1)
  
  return next
}

// Death reasons and per-generation stats
const deathReasons = {
  EATEN: 'eaten',
  OUT_OF_WORLD: 'out_of_world',
  NO_HP: 'no_hp'
} as const

type DeathReason = typeof deathReasons[keyof typeof deathReasons]

type GenerationStats = {
  reasons: Record<DeathReason, number>
  turns: number
  highestAge: number
  energyStart: number
  births: number
  consumedEnergy: number
  hpGainedFromEating: number
  hpGainedFromConsumingEnergy: number
}

let currentGeneration = 0
let deathStatsPerGeneration: GenerationStats[] = []
// Global re-render hook used by non-React objects (like Orb) to refresh UI
let forceRerender: (() => void) | null = null
// Strongest (oldest) orbs saved per generation for later viewing
let strongestOrbsPerGeneration: Orb[][] = []
let selectedOrbIdForDebug: string | null = null

function addAttackEffect(type: AttackEffectType, fromX: number, fromY: number, toX: number, toY: number) {
  if (!graphicsEffectsEnabled) {
    return
  }
  const id = attackEffectCounter++
  attackEffects = [
    ...attackEffects,
    { id, fromX, fromY, toX, toY, type }
  ]
  forceRerender?.()
  setTimeout(() => {
    attackEffects = attackEffects.filter(effect => effect.id !== id)
    forceRerender?.()
  }, 260)
}

function startNewGeneration() {
  currentGeneration += 1
  deathStatsPerGeneration[currentGeneration - 1] = {
    reasons: {
      eaten: 0,
      out_of_world: 0,
      no_hp: 0
    },
    turns: 0,
    highestAge: 0,
    energyStart: 0,
    births: 0,
    consumedEnergy: 0,
    hpGainedFromEating: 0,
    hpGainedFromConsumingEnergy: 0
  }
}

function registerDeath(reason: DeathReason, age: number) {
  if (currentGeneration === 0) {
    // Ensure there is at least one generation bucket
    startNewGeneration()
  }
  const bucket = deathStatsPerGeneration[currentGeneration - 1]
  bucket.reasons[reason] += 1
  if (age > bucket.highestAge) {
    bucket.highestAge = age
  }
}

// Additional per-generation counters
function registerBirth() {
  if (currentGeneration === 0) {
    startNewGeneration()
  }
  deathStatsPerGeneration[currentGeneration - 1].births += 1
}

function registerEnergyConsumed(amount: number) {
  if (currentGeneration === 0) {
    startNewGeneration()
  }
  deathStatsPerGeneration[currentGeneration - 1].consumedEnergy += Math.max(0, amount)
}

function registerHpGainedFromEating(amount: number) {
  if (currentGeneration === 0) {
    startNewGeneration()
  }
  deathStatsPerGeneration[currentGeneration - 1].hpGainedFromEating += Math.max(0, amount)
}

function registerHpGainedFromConsumingEnergy(amount: number) {
  if (currentGeneration === 0) {
    startNewGeneration()
  }
  deathStatsPerGeneration[currentGeneration - 1].hpGainedFromConsumingEnergy += Math.max(0, amount)
}

// -------------

generateWorld()

function App() {
  const [graphicsEnabled, setGraphicsEnabled] = useState(settings.graphicEffects)

  // Toggle global CSS class when graphics effects change
  useEffect(() => {
    graphicsEffectsEnabled = graphicsEnabled
    if (!graphicsEnabled) {
      document.body.classList.add('no-effects')
    } else {
      document.body.classList.remove('no-effects')
    }
  }, [graphicsEnabled])
  const [ turn, setTurn ] = useState(0)
  const [ worldNum, setWorldNum ] = useState(0)
  const worldNumRef = useRef(worldNum)
  const [ turnDuration, setTurnDuration ] = useState(initialTurnDuration)
  const [ selectedOrb, setSelectedOrb ] = useState<Orb | null>(null)
  const [ paused, setPaused ] = useState(true)
  const [ activeGenTab, setActiveGenTab ] = useState(0)
  const [ showSettings, setShowSettings ] = useState(false)
  const [ draftSettings, setDraftSettings ] = useState<Settings>(settings)
  const [ showShortcuts, setShowShortcuts ] = useState(false)

  function trackWorldStats() {
    if (deathStatsPerGeneration.length > 0 && currentGeneration > 0) {
      deathStatsPerGeneration[currentGeneration - 1].turns = turn

      const sorted = [...lastTurnDeadOrbs].sort((a, b) => b.age - a.age)
      const uniqueStrongest: Orb[] = []
      const seen = new Set<string>()
      for (const orb of sorted) {
        if (seen.has(orb.id)) {
          continue
        }
        seen.add(orb.id)
        uniqueStrongest.push(orb)
        if (uniqueStrongest.length >= newGenStrongestCount) {
          break
        }
      }
      strongestOrbsPerGeneration[currentGeneration - 1] = uniqueStrongest
    }
  }

  function resetSimulation() {
    currentGeneration = 0
    deathStatsPerGeneration = []
    strongestOrbsPerGeneration = []
    lastTurnDeadOrbs = []
    selectedOrbIdForDebug = null
    worldNumRef.current = 0

    generateWorld(0)
  }

  function advanceGeneration() {
    if (orbs.length > 0) {
      lastTurnDeadOrbs.push(...orbs)
    }
    const nextWorldNum = worldNumRef.current + 1
    worldNumRef.current = nextWorldNum
    trackWorldStats()
    startNewGeneration()
    generateWorld(nextWorldNum)
    setWorldNum(nextWorldNum)
    setTurn(0)
  }

  useEffect(() => {
    selectedOrbIdForDebug = selectedOrb?.id ?? null
  }, [selectedOrb])

  useEffect(() => {
    worldNumRef.current = worldNum
  }, [worldNum])

  // Helper to visualize genes
  function renderGenesTable(genes: Genes) {
     return (
       <div className="genes-table" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
         {Object.entries(genes).map(([k, v]) => (
           <React.Fragment key={k}>
             <div title={k} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
             <div style={{ textAlign: 'right' }}>{v.toFixed(2)}</div>
           </React.Fragment>
         ))}
       </div>
     )
  }

  function renderMotivationsTable(m: OrbMotivations | null) {
    if (!m) {
      return <div className="empty">No snapshot yet</div>
    }
    const rows: Array<[string, number]> = [
      ['hunger', m.hunger],
      ['fear', m.fear],
      ['aggression', m.aggression],
      ['reproduction', m.reproduction],
      ['exploration', m.exploration],
    ]
    const meta: Array<[string, number]> = [
      ['hp_norm', m.hpNorm],
      ['risk_drive', m.riskDrive],
      ['fear_effective', m.fearEffective],
      ['max_threat', m.maxThreat],
      ['max_prey', m.maxPrey],
    ]
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <div>{k}</div>
            <div style={{ textAlign: 'right' }}>{v.toFixed(2)}</div>
          </React.Fragment>
        ))}
        <div style={{ gridColumn: '1 / -1', opacity: 0.7, marginTop: 6 }}>derived</div>
        {meta.map(([k, v]) => (
          <React.Fragment key={k}>
            <div style={{ opacity: 0.85 }}>{k}</div>
            <div style={{ textAlign: 'right', opacity: 0.85 }}>{v.toFixed(2)}</div>
          </React.Fragment>
        ))}
      </div>
    )
  }

  function renderPerceptionGrid(perception: PerceivedCell[], radius: number, maxEnergyNorm: number) {
    const size = radius * 2 + 1
    const map = new Map(perception.map(c => [`${c.dx},${c.dy}`, c] as const))
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, minmax(56px, 1fr))`,
          gap: 4,
          fontSize: 10
        }}
      >
        {Array.from({ length: size * size }).map((_v, i) => {
          const dx = (i % size) - radius
          const dy = Math.floor(i / size) - radius
          const cell = map.get(`${dx},${dy}`) ?? null
          const isCenter = dx === 0 && dy === 0
          const inBounds = cell?.inBounds ?? false
          const energyNorm = cell ? clamp(cell.energy / Math.max(maxEnergyNorm, 1), 0, 1) : 0
          const bg = !inBounds
            ? 'rgba(0,0,0,0.04)'
            : `rgba(${Math.floor((cell?.threat ?? 0) * 255)}, ${Math.floor(energyNorm * 200)}, ${Math.floor((cell?.prey ?? 0) * 255)}, 0.15)`
          const title = cell
            ? `(${cell.x},${cell.y}) d=(${dx},${dy}) energy=${cell.energy} threat=${cell.threat.toFixed(2)} prey=${cell.prey.toFixed(2)} kin=${cell.kinAffinity.toFixed(2)} density=${cell.localDensity.toFixed(2)} occupied=${cell.occupied}`
            : `d=(${dx},${dy})`
          return (
            <div
              key={`${dx},${dy}`}
              title={title}
              style={{
                border: isCenter ? '2px solid rgba(0,0,0,0.7)' : '1px solid rgba(0,0,0,0.15)',
                borderRadius: 6,
                padding: 6,
                background: bg,
                minHeight: 56
              }}
            >
              {!cell ? (
                <div style={{ opacity: 0.6 }}>n/a</div>
              ) : !cell.inBounds ? (
                <div style={{ opacity: 0.6 }}>out</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ opacity: 0.75 }}>{dx},{dy}</div>
                    <div style={{ opacity: 0.75 }}>{cell.energy}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>T</div>
                    <div>{cell.threat.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>P</div>
                    <div>{cell.prey.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>K</div>
                    <div>{cell.kinAffinity.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.75 }}>
                    <div>D</div>
                    <div>{cell.localDensity.toFixed(2)}</div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const aliveOrbsCount: number = orbs.filter(orb => orb.hp > 0).length

  function triggerTurn() {
    setTurn(turn => turn + 1)
    makeTurn(turn)
  }

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        return
      }

      if (
        e.repeat &&
        (e.code === 'Space' ||
          e.code === 'BracketRight' ||
          e.code === 'KeyG' ||
          e.code === 'KeyM' ||
          e.code === 'KeyN' ||
          e.code === 'KeyS')
      ) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        setPaused(p => !p)
        return
      }

      if (e.code === 'Equal') {
        e.preventDefault()
        setTurnDuration(d => Math.max(1, d - 10))
        return
      }

      if (e.code === 'Minus') {
        e.preventDefault()
        setTurnDuration(d => Math.min(500, d + 10))
        return
      }

      if (e.code === 'BracketRight') {
        e.preventDefault()
        setPaused(true)
        triggerTurn()
        return
      }

      if (e.code === 'KeyG') {
        e.preventDefault()
        setGraphicsEnabled(prev => {
          const next = !prev
          const nextSettings: Settings = { ...settings, graphicEffects: next }
          saveSettings(nextSettings)
          return next
        })
        return
      }

      if (e.code === 'KeyM') {
        e.preventDefault()
        setPaused(true)
        setSelectedOrb(null)
        setWorldNum(0)
        setTurn(0)
        resetSimulation()
        return
      }

      if (e.code === 'KeyN') {
        e.preventDefault()
        setPaused(true)
        setSelectedOrb(null)
        advanceGeneration()
        return
      }

      if (e.code === 'KeyS') {
        e.preventDefault()
        if (showSettings) {
          setShowSettings(false)
        } else {
          setPaused(true)
          setShowSettings(true)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showSettings])

  useEffect(() => {
    if (paused) {
      return
    }
    const timeout = setTimeout(() => {
      if (aliveOrbsCount > 0) {
        triggerTurn()
      } else {
        if (turn === 0) {
          return
        }
        advanceGeneration()
      }
    }, turnDuration)

    return () => {
      clearTimeout(timeout)
    }
  }, [
    turn,
    turnDuration,
    paused
  ])

  useEffect(() => {
    setSelectedOrb(null)
    // Switch to latest generation tab when world changes
    if (deathStatsPerGeneration.length > 0) {
      setActiveGenTab(deathStatsPerGeneration.length - 1)
    }
  }, [
    worldNum
  ])

  function showOrbStory(orb: Orb) {
    orb.refreshSnapshot(scanRadius)
    setSelectedOrb(orb)
  }

  const worldPixelWidth = worldSize[1] * cellSize + (worldSize[1] - 1) * cellGap
  const worldPixelHeight = worldSize[0] * cellSize + (worldSize[0] - 1) * cellGap

  return (
    <>
      <div className="actions-bar">
        <div className='actions-bar-panel'>
          <div>
            gen: {worldNum}
          </div>

          <div>
            turn: {turn}
          </div>
        </div>

        <div className='actions-bar-panel'>
          <button
            disabled={turn === 0}
            onClick={() => {
              setPaused(true)
              setSelectedOrb(null)
              setWorldNum(0)
              setTurn(0)
              resetSimulation()
            }}
          >
            ↪️Restart
          </button>

          <div>
            <label style={{ marginRight: 6 }}>Speed</label>
            <input
              type="range"
              min={1}
              max={500}
              step={1}
              value={Math.max(1, Math.min(500, 501 - turnDuration))}
              disabled={turn === 0}
              onChange={(e) => setTurnDuration(501 - Number(e.target.value))}
              style={{ width: 160, margin: '0 8px', verticalAlign: 'middle' }}
              title="Turn speed (slow ↔ fast)"
            />
            <button
              onClick={() => setPaused(p => !p)}
              title={paused ? 'Resume' : 'Pause'}
            >
              {paused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <button
              onClick={() => triggerTurn()}
              disabled={!paused}
              title="Step one turn"
            >
              ➡️
            </button>
          </div>
          <button
            disabled={turn === 0}
            onClick={() => {
              setPaused(true)
              setSelectedOrb(null)
              advanceGeneration()
            }}
          >
            ⏭️ New Gen
          </button>
          <label title="Toggle graphics effects (animations, glows)">
            Graphics
            <input
              type="checkbox"
              checked={graphicsEnabled}
              onChange={(e) => {
                const enabled = e.target.checked
                setGraphicsEnabled(enabled)
                // Persist setting without restart
                const next: Settings = { ...settings, graphicEffects: enabled }
                saveSettings(next)
              }}
              style={{ marginLeft: 6 }}
            />
          </label>
          <button
            onClick={() => {
              setPaused(true)
              setShowSettings(true)
            }}
            title="Open settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="content">
        <div
          className="world"
          style={{
            width: `${worldPixelWidth}px`,
            height: `${worldPixelHeight}px`
          }}
        >
          <div
            className="grid field"
            style={{
              gridTemplateRows: `repeat(${worldSize[0]}, 48px)`,
              gridTemplateColumns: `repeat(${worldSize[1]}, 48px)`,
              width: `${worldPixelWidth}px`,
              height: `${worldPixelHeight}px`
            }}
          >
            {world.map((row: number[], rowIndex: any) => (
              row.map((_value: number, colIndex: any) => (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  className="cell"
                />
              ))
            ))}
          </div>
          <div
            className="attack-effects-layer"
            style={{
              width: `${worldPixelWidth}px`,
              height: `${worldPixelHeight}px`
            }}
          >
            {attackEffects.map(effect => {
              const cellStride = cellSize + cellGap
              const fromLeft = effect.fromX * cellStride + cellSize / 2
              const fromTop = effect.fromY * cellStride + cellSize / 2
              const toLeft = effect.toX * cellStride + cellSize / 2
              const toTop = effect.toY * cellStride + cellSize / 2
              const dx = toLeft - fromLeft
              const dy = toTop - fromTop
              const distance = Math.sqrt(dx * dx + dy * dy)
              const angle = Math.atan2(dy, dx) * (180 / Math.PI)
              const color = effect.type === 'attack'
                ? 'rgba(255, 165, 0, 0.85)'
                : effect.type === 'spawn'
                  ? 'rgba(46, 204, 113, 0.85)'
                  : 'rgba(255, 0, 0, 0.85)'
              return (
                <div
                  key={`attack-effect-${effect.id}`}
                  className={`attack-effect attack-effect-${effect.type}`}
                  style={{
                    left: fromLeft,
                    top: fromTop,
                    width: distance,
                    transform: `rotate(${angle}deg)`,
                    backgroundColor: color,
                    ['--effect-color' as any]: color
                  }}
                />
              )
            })}
          </div>
          <div
            className="orbs-layer"
            style={{
              width: `${worldPixelWidth}px`,
              height: `${worldPixelHeight}px`
            }}
          >
            {orbs.filter(o => o.hp > 0).map((orb) => {
              const left = orb.x * (cellSize + cellGap) + (cellSize - orbSize) / 2
              const top = orb.y * (cellSize + cellGap) + (cellSize - orbSize) / 2
              const isSelected = selectedOrb?.id === orb.id
              const isRelative = !!selectedOrb && selectedOrb.id !== orb.id && selectedOrb.kinshipTo(orb) > 0
              return (
                <div
                  key={orb.id}
                  id={`orb-${orb.id}`}
                  className={`orb ${orb.glow} ${isSelected ? 'selected' : ''} ${isRelative ? 'relative' : ''}`}
                  style={{
                    backgroundColor: `rgb(${orb.getColor().reds}, ${orb.getColor().greens}, ${orb.getColor().blues})`,
                    transform: `translate(${left}px, ${top}px)`
                  }}
                  onClick={() => showOrbStory(orb)}
                >
                  {orb.hp}
                </div>
              )
            })}
          </div>
          <div
            className="grid energy-layer"
            style={{
              gridTemplateRows: `repeat(${worldSize[0]}, 48px)`,
              gridTemplateColumns: `repeat(${worldSize[1]}, 48px)`,
              width: `${worldPixelWidth}px`,
              height: `${worldPixelHeight}px`
            }}
          >
            {world.map((row: number[], rowIndex: any) => (
              row.map((_value: number, colIndex: any) => (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  className="cell"
                >
                  {worldEnergy[rowIndex]?.[colIndex] > 0 && (
                    <div
                      className={`energy-indicator energy-level-${Math.min(worldEnergy[rowIndex][colIndex], 5)}`}
                    >
                      {worldEnergy[rowIndex][colIndex]}
                    </div>
                  )}
                </div>
              ))
            ))}
          </div>
        </div>

        {selectedOrb && (
          <div className="orb-story">
            <div className="orb-story__header">
              <div>{selectedOrb.name}</div>
              <button onClick={() => setSelectedOrb(null)}>⤫</button>
            </div>

            <div className="orb-story__content">
              <div className="commands-section">
                <div className="commands-title">
                  Genes
                </div>
                {renderGenesTable(selectedOrb.genes)}
              </div>

              <div className="commands-section">
                <div className="commands-title">
                  Motivations
                </div>
                {renderMotivationsTable(selectedOrb.lastMotivations)}
              </div>

              <div className="commands-section">
                <div className="commands-title">
                  Surroundings
                </div>
                {selectedOrb.lastPerception.length > 0 ? (
                  renderPerceptionGrid(
                    selectedOrb.lastPerception,
                    selectedOrb.lastScanRadius || scanRadius,
                    selectedOrb.genes.max_energy_norm
                  )
                ) : (
                  <div className="empty">No snapshot yet</div>
                )}
              </div>

              <div className="commands-section">
                <div className="commands-title">My Story</div>
                <div className="log-column">
                  {selectedOrb.log.map((turnItems, turnIndex) => (
                    <div
                      key={`log-col-${turnIndex}`}
                      className="log-row"
                      title={`Turn ${turnIndex}`}
                    >
                      <div
                        key={`log-${turnIndex}-index`}
                      >
                        {turnIndex}.
                      </div>
                      {turnItems.map((entry, entryIndex) => (
                        <div
                          key={`log-${turnIndex}-${entryIndex}`}
                          className="log-block"
                        >
                          {entry}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bottom-panels">
          <div className="gen-tabs">
            <button
              onClick={() => setActiveGenTab(0)}
              disabled={activeGenTab === 0}
            >
              first
            </button>
            <button
              onClick={() => setActiveGenTab(Math.max(0, activeGenTab - 1))}
              disabled={activeGenTab === 0}
            >
              &lt;
            </button>
            <input
              type="number"
              min={1}
              max={Math.max(1, deathStatsPerGeneration.length)}
              value={Math.min(Math.max(1, activeGenTab + 1), Math.max(1, deathStatsPerGeneration.length))}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isNaN(v)) return
                const clamped = Math.max(1, Math.min(v, Math.max(1, deathStatsPerGeneration.length)))
                setActiveGenTab(clamped - 1)
              }}
            />
            <button
              onClick={() => setActiveGenTab(Math.min(deathStatsPerGeneration.length - 1, activeGenTab + 1))}
              disabled={activeGenTab >= deathStatsPerGeneration.length - 1}
            >
              &gt;
            </button>
            <button
              onClick={() => setActiveGenTab(Math.max(0, deathStatsPerGeneration.length - 1))}
              disabled={activeGenTab >= deathStatsPerGeneration.length - 1}
            >
              last
            </button>
          </div>
          <div className="gen-tab-content">
            {(() => {
              const stats = deathStatsPerGeneration[activeGenTab] || {
                reasons: { eaten: 0, out_of_world: 0, no_hp: 0 },
                turns: 0,
                highestAge: 0,
                energyStart: 0,
                births: 0,
                consumedEnergy: 0,
                hpGainedFromEating: 0,
                hpGainedFromConsumingEnergy: 0
              }
              return (
                <ul>
                  <li>turns: {stats.turns}</li>
                  <li>highest_age: {stats.highestAge}</li>
                  <li>energy_start: {stats.energyStart}</li>
                  <li>births: {stats.births}</li>
                  <li>consumed_energy: {stats.consumedEnergy}</li>
                  <li>hp_gained_consuming_energy: {stats.hpGainedFromConsumingEnergy}</li>
                  <li>hp_gained_eating: {stats.hpGainedFromEating}</li>
                  <li>eaten: {stats.reasons.eaten}</li>
                  <li>out_of_world: {stats.reasons.out_of_world}</li>
                  <li>no_hp: {stats.reasons.no_hp}</li>
                </ul>
              )
            })()}
            <div className="strongest-orbs-section">
              <div className="strongest-orbs-title">Strongest Orbs</div>
              <div className="saved-orbs-grid">
                {((strongestOrbsPerGeneration[activeGenTab] || []) as Orb[]).length > 0 ? (
                  strongestOrbsPerGeneration[activeGenTab].map((orb, idx) => {
                    const color = orb.getColor()
                    return (
                      <div
                        key={`saved-orb-${activeGenTab}-${idx}-${orb.id}`}
                        className="saved-orb"
                        title={`Age: ${orb.age}`}
                        onClick={() => showOrbStory(orb)}
                      >
                        <div
                          className="saved-orb-circle"
                          style={{ backgroundColor: `rgb(${color.reds}, ${color.greens}, ${color.blues})` }}
                        />
                        <div className="saved-orb-id">{orb.name}</div>
                        <div className="saved-orb-age">age: {orb.age}</div>
                      </div>
                    )
                  })
                ) : (
                  <div className="saved-orbs-empty">No strongest orbs saved yet.</div>
                )}
              </div>
            </div>
            {/* Saved Orbs moved to a dedicated bottom panel */}
          </div>
          <div className="gen-chart">
            {(() => {
              const gens = deathStatsPerGeneration
              if (!gens || gens.length === 0) {
                return <div className="empty">No data yet</div>
              }
              const labels = gens.map((_s, idx) => `Gen ${idx + 1}`)
              const data: ChartData<'line'> = {
                labels,
                datasets: [
                  {
                    label: 'turns',
                    data: gens.map(s => s.turns),
                    borderColor: '#4ea1f3',
                    backgroundColor: 'rgba(78, 161, 243, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'highest_age',
                    data: gens.map(s => s.highestAge),
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'energy_start',
                    data: gens.map(s => s.energyStart),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'hp_gained_eating',
                    data: gens.map(s => s.hpGainedFromEating),
                    borderColor: '#f1c40f',
                    backgroundColor: 'rgba(241, 196, 15, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'hp_gained_consuming_energy',
                    data: gens.map(s => s.hpGainedFromConsumingEnergy),
                    borderColor: '#8e44ad',
                    backgroundColor: 'rgba(142, 68, 173, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'births',
                    data: gens.map(s => s.births),
                    borderColor: '#1abc9c',
                    backgroundColor: 'rgba(26, 188, 156, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'consumed_energy',
                    data: gens.map(s => s.consumedEnergy),
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'eaten',
                    data: gens.map(s => s.reasons.eaten),
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'out_of_world',
                    data: gens.map(s => s.reasons.out_of_world),
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  },
                  {
                    label: 'no_hp',
                    data: gens.map(s => s.reasons.no_hp),
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false
                  }
                ]
              }
              const options: ChartOptions<'line'> = {
                responsive: true,
                maintainAspectRatio: false,
                ...(graphicsEnabled ? {} : { animation: false }),
                plugins: {
                  legend: { position: 'bottom' },
                  title: { display: false }
                },
                scales: {
                  x: { title: { display: false } },
                  y: { beginAtZero: true }
                }
              }
              return <Line data={data} options={options}/>
            })()}
          </div>
          <div className="gen-top-bottom">
            {(() => {
              const gens = deathStatsPerGeneration
              if (!gens || gens.length === 0) {
                return <div className="empty">No data yet</div>
              }
              const metrics = [
                { key: 'turns', label: 'turns', getter: (s: GenerationStats) => s.turns },
                { key: 'highest_age', label: 'highest_age', getter: (s: GenerationStats) => s.highestAge },
                { key: 'energy_start', label: 'energy_start', getter: (s: GenerationStats) => s.energyStart },
                { key: 'births', label: 'births', getter: (s: GenerationStats) => s.births },
                { key: 'consumed_energy', label: 'consumed_energy', getter: (s: GenerationStats) => s.consumedEnergy },
                { key: 'hp_gained_eating', label: 'hp_gained_eating', getter: (s: GenerationStats) => s.hpGainedFromEating },
                { key: 'hp_gained_consuming_energy', label: 'hp_gained_consuming_energy', getter: (s: GenerationStats) => s.hpGainedFromConsumingEnergy },
                { key: 'eaten', label: 'eaten', getter: (s: GenerationStats) => s.reasons.eaten },
                { key: 'out_of_world', label: 'out_of_world', getter: (s: GenerationStats) => s.reasons.out_of_world },
                { key: 'no_hp', label: 'no_hp', getter: (s: GenerationStats) => s.reasons.no_hp }
              ]
              const computeTopBottom = (values: number[]) => {
                const pairs = values.map((v, i) => ({ i, v }))
                const count = Math.min(5, pairs.length)
                const top = [...pairs].sort((a, b) => b.v - a.v).slice(0, count)
                const bottom = [...pairs].sort((a, b) => a.v - b.v).slice(0, count)
                return { top, bottom }
              }
              return (
                <div>
                  <div className="strongest-orbs-title">Top 5 / Bottom 5 by stat</div>
                  {metrics.map(m => {
                    const values = gens.map(m.getter)
                    const { top, bottom } = computeTopBottom(values)
                    return (
                      <div key={`metric-${m.key}`} className="metric-block">
                        <div className="metric-name">{m.label}</div>
                        <div className="metric-lists">
                          <div className="metric-list">
                            <div className="list-title">most</div>
                            <ul>
                              {top.map(p => (
                                <li key={`${m.key}-top-${p.i}`}>Gen {p.i + 1}: {p.v}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="metric-list">
                            <div className="list-title">least</div>
                            <ul>
                              {bottom.map(p => (
                                <li key={`${m.key}-bottom-${p.i}`}>Gen {p.i + 1}: {p.v}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          draftSettings={draftSettings}
          setDraftSettings={setDraftSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showShortcuts && (
        <div className="shortcuts-panel" role="dialog" aria-label="Keyboard shortcuts">
          <div className="shortcuts-panel-header">
            <div>Shortcuts</div>
            <button onClick={() => setShowShortcuts(false)}>⤫</button>
          </div>
          <div className="shortcuts-grid">
            <div className="shortcut-key"><kbd>Space</kbd></div>
            <div className="shortcut-desc">Toggle time (pause / resume)</div>

            <div className="shortcut-key"><kbd>+</kbd> / <kbd>-</kbd></div>
            <div className="shortcut-desc">Increase / decrease speed</div>

            <div className="shortcut-key"><kbd>]</kbd></div>
            <div className="shortcut-desc">Next turn (pauses first)</div>

            <div className="shortcut-key"><kbd>G</kbd></div>
            <div className="shortcut-desc">Toggle graphics</div>

            <div className="shortcut-key"><kbd>R</kbd></div>
            <div className="shortcut-desc">Restart</div>

            <div className="shortcut-key"><kbd>N</kbd></div>
            <div className="shortcut-desc">New generation</div>

            <div className="shortcut-key"><kbd>S</kbd></div>
            <div className="shortcut-desc">Settings</div>
          </div>
        </div>
      )}

      <button
        className="shortcuts-fab"
        onClick={() => setShowShortcuts(s => !s)}
        title="Shortcuts"
      >
        ?
      </button>
    </>
  )
}

export default App
