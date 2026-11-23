import { ORB_ICON, type ActionDecision } from './actions'
import { logDecisionTrace } from './decisionTrace'
import { clamp } from './math'
import type { BirthCost, Orb, OrbHost } from './orb'
import { assessOther, type OrbAssessment, type OrbMotivations, type PerceivedCell } from './perception'

/** Values shared by every candidate action of one decision. */
export type DecisionFrame = {
  orb: Orb
  motivations: OrbMotivations
  currentEnergy: number
  currentEnergyNorm: number
  currentThreat: number
  currentLocalDensity: number
  spacePrefCurrent: number
  /** How much the orb wants to bite: hunger and aggression mixed by their weights. */
  attackDrive: number
  /** How much the orb wants to hit back: aggression and fear mixed by their weights. */
  defenseDrive: number
  hpGainByEnergyConsumption: number
  birthTaxPercent: number
  /** How much the orb wants relatives around it: steady comfort that fades with hunger, plus fear. */
  kinDrive: number
  /** `kinDrive` times the kin affinity of the cell the orb is on. Every action that stays there earns it. */
  kinHere: number
}

export type EnergyTarget = {
  x: number
  y: number
  dist: number
  strength: number
}

export type SeekInfo = {
  target: EnergyTarget
  newDist: number
  toward: number
  pull: number
  score: number
}

export type EncounterPart = {
  other: Orb
  assessment: OrbAssessment
  threatContribution: number
  retaliationFactor: number
  preyContribution: number
}

/** What stands in an adjacent occupied cell, weighed as a threat and as prey. */
export type Encounter = {
  dist: number
  kernel: number
  diagModifier: number
  threatSum: number
  preySum: number
  threat: number
  prey: number
  /** Per-occupant breakdown, collected only when the decision is being traced. */
  parts: EncounterPart[] | null
}

/** The numbers behind a candidate's base utility, kept only for the decision trace. */
export type CandidateTerms =
  | { kind: 'WAIT'; fear: number; explore: number; hunger: number; kin: number }
  | { kind: 'CONSUME'; gainNorm: number; stickiness: number; gain: number; fear: number; kin: number }
  | { kind: 'DIVIDE'; repro: number; fear: number; hunger: number; kin: number; birthCost: BirthCost }
  | {
      kind: 'MOVE'
      cell: PerceivedCell
      energyNorm: number
      spacePref: number
      hunger: number
      seek: SeekInfo | null
      seekScore: number
      aggro: number
      explore: number
      kin: number
      fear: number
    }
  | { kind: 'ATTACK'; cell: PerceivedCell; encounter: Encounter }
  | { kind: 'BITE'; cell: PerceivedCell; encounter: Encounter; preyDrive: number; greed: number; fear: number }

export type CandidateScore = {
  base: number
  inertia: number
  noise: number
  final: number
}

export type Candidate = {
  /** `utility` starts as the base score and is replaced by the final score. */
  decision: ActionDecision
  terms: CandidateTerms | null
  score: CandidateScore | null
}

export type Choice = {
  decision: ActionDecision
  /** True when the action was picked at random instead of by utility. */
  impulsive: boolean
}

/**
 * Utility of standing right beside a fully trusted parent or child when not hungry.
 * `trust_in_relatives` scales it down, so that gene sets how strongly an orb herds.
 */
export const KIN_COMFORT = 0.5

/** The most a full `inertia_bias` adds to the utility of repeating the last action. */
export const INERTIA_BONUS = 0.2

/** Identifies an action by its type and, for directed actions, the step it points along. */
export function actionKey(orb: Orb, decision: ActionDecision): string {
  if (decision.targetX === undefined || decision.targetY === undefined) {
    return decision.type
  }
  return `${decision.type}:${decision.targetX - orb.x},${decision.targetY - orb.y}`
}

export function directionFromDelta(dx: number, dy: number): string {
  if (dx === 0 && dy === 0) {
    return 'here'
  }
  const vertical = dy < 0 ? 'up' : dy > 0 ? 'down' : ''
  const horizontal = dx < 0 ? 'left' : dx > 0 ? 'right' : ''
  if (vertical && horizontal) {
    return `${vertical}-${horizontal}`
  }
  return vertical || horizontal || 'here'
}

function isAdjacent(cell: PerceivedCell): boolean {
  return cell.inBounds && !(cell.dx === 0 && cell.dy === 0) && Math.abs(cell.dx) <= 1 && Math.abs(cell.dy) <= 1
}

/** 1 when the local crowding matches the orb's taste, 0 when it is the opposite. */
function spacePreference(orb: Orb, localDensity: number): number {
  const { crowd_preference } = orb.genes
  return clamp((1 - localDensity) * (1 - crowd_preference) + localDensity * crowd_preference, 0, 1)
}

/** The most attractive energy in sight away from the current cell, discounted by distance. */
function findBestEnergyTarget(orb: Orb, perception: PerceivedCell[]): EnergyTarget | null {
  const { genes } = orb
  let best: EnergyTarget | null = null
  for (const c of perception) {
    if (!c.inBounds || c.energy <= 0 || (c.dx === 0 && c.dy === 0)) {
      continue
    }
    const energyNorm = clamp(c.energy / Math.max(genes.max_energy_norm, 1), 0, 1)
    if (energyNorm <= 0) {
      continue
    }
    const dist = Math.sqrt(c.dx * c.dx + c.dy * c.dy)
    const strength = energyNorm * Math.pow(genes.distance_decay, dist)
    if (!best || strength > best.strength) {
      best = { x: c.x, y: c.y, dist, strength }
    }
  }
  return best
}

function evaluateWait(frame: DecisionFrame, tracing: boolean): Candidate {
  const { orb, motivations } = frame
  const { genes } = orb
  const fear = (1 - frame.currentThreat) * (genes.fear_weight * motivations.fearEffective)
  const explore = frame.spacePrefCurrent * (genes.exploration_weight * motivations.exploration)
  const hunger = genes.hunger_weight * motivations.hunger
  return {
    decision: { type: 'WAIT', utility: fear + explore + frame.kinHere - hunger, description: 'wait', icon: '💤' },
    terms: tracing ? { kind: 'WAIT', fear, explore, hunger, kin: frame.kinHere } : null,
    score: null
  }
}

function evaluateConsume(frame: DecisionFrame, tracing: boolean): Candidate {
  const { orb, motivations } = frame
  const { genes } = orb
  const gainNorm = clamp(frame.hpGainByEnergyConsumption / Math.max(genes.hp_healthy_norm, 1), 0, 1)
  const arriveHungry = orb.lastActionType === 'MOVE' && motivations.hunger > 0.15
  const continueConsuming = orb.lastActionType === 'CONSUME' && motivations.hunger > 0.05
  const stickiness = (arriveHungry ? 0.6 : 0) + (continueConsuming ? 0.3 : 0)
  const gain = genes.hunger_weight * motivations.hunger * (gainNorm + frame.currentEnergyNorm + stickiness)
  const fear = genes.fear_weight * frame.currentThreat * motivations.fearEffective
  return {
    decision: { type: 'CONSUME', utility: gain + frame.kinHere - fear, description: 'consume energy', icon: '🍗⚡️' },
    terms: tracing ? { kind: 'CONSUME', gainNorm, stickiness, gain, fear, kin: frame.kinHere } : null,
    score: null
  }
}

function evaluateDivide(frame: DecisionFrame, tracing: boolean): Candidate {
  const { orb, motivations } = frame
  const { genes } = orb
  const birthCost = orb.birthCost()
  const repro = genes.reproduction_weight * motivations.reproduction
  const fear = genes.fear_weight * frame.currentThreat * motivations.fearEffective
  const hunger = genes.hunger_weight * motivations.hunger * birthCost.costFraction
  return {
    decision: {
      type: 'DIVIDE',
      utility: repro + frame.kinHere - fear - hunger,
      description: 'divide',
      icon: `🙌${ORB_ICON}`
    },
    terms: tracing ? { kind: 'DIVIDE', repro, fear, hunger, kin: frame.kinHere, birthCost } : null,
    score: null
  }
}

function evaluateMove(
  frame: DecisionFrame,
  cell: PerceivedCell,
  energyTarget: EnergyTarget | null,
  tracing: boolean
): Candidate {
  const { orb, motivations } = frame
  const { genes } = orb
  const energyNorm = clamp(cell.energy / Math.max(genes.max_energy_norm, 1), 0, 1)
  const spacePref = spacePreference(orb, cell.localDensity)

  const hunger = genes.hunger_weight * energyNorm * motivations.hunger

  // Extra pull for steps that bring the orb closer to the best energy in sight.
  let seek: SeekInfo | null = null
  if (energyTarget && energyTarget.strength > 0) {
    const newDist = Math.sqrt(
      (energyTarget.x - cell.x) * (energyTarget.x - cell.x) +
        (energyTarget.y - cell.y) * (energyTarget.y - cell.y)
    )
    const toward = Math.max(0, energyTarget.dist - newDist)
    const pull = clamp(energyTarget.strength * toward, 0, 1)
    const score = genes.hunger_weight * motivations.hunger * pull
    seek = { target: energyTarget, newDist, toward, pull, score }
  }
  const seekScore = seek?.score ?? 0

  const aggro = genes.aggression_weight * cell.prey * motivations.aggression
  const explore = genes.exploration_weight * spacePref * motivations.exploration
  const fear = genes.fear_weight * cell.threat * motivations.fearEffective
  const kin = frame.kinDrive * cell.kinAffinity
  const utility = hunger + seekScore + aggro + explore + kin - fear

  const direction = directionFromDelta(cell.dx, cell.dy)
  return {
    decision: {
      type: 'MOVE',
      targetX: cell.x,
      targetY: cell.y,
      utility,
      description: `move ${direction}`,
      icon: `🦵 ${direction}`
    },
    terms: tracing
      ? { kind: 'MOVE', cell, energyNorm, spacePref, hunger, seek, seekScore, aggro, explore, kin, fear }
      : null,
    score: null
  }
}

/** Weighs the occupants of an adjacent cell as a threat to strike at and as prey to bite. */
function assessEncounter(frame: DecisionFrame, cell: PerceivedCell, host: OrbHost, tracing: boolean): Encounter {
  const { orb, motivations } = frame
  const { genes } = orb
  const dist = Math.sqrt(cell.dx * cell.dx + cell.dy * cell.dy)
  const kernel = Math.pow(genes.distance_decay, dist)
  const diagModifier = cell.dx !== 0 && cell.dy !== 0 ? genes.diagonal_awareness : 1.0
  const parts: EncounterPart[] | null = tracing ? [] : null

  let threatSum = 0
  let preySum = 0
  for (const other of host.world.occupantsAt(cell.x, cell.y)) {
    if (other === orb) continue
    const assessment = assessOther(orb, other, motivations.hpNorm, motivations.riskDrive)
    const threatContribution = assessment.enemyAdvantage * kernel * diagModifier * assessment.threatModifier
    // Striking at someone likely to hit back is less appealing unless defence is instinctive.
    const retaliationFactor = clamp(1 - assessment.retaliationFear * (1 - genes.defense_instinct), 0, 1)
    const preyContribution = assessment.preyBase * kernel * diagModifier * assessment.preyModifier
    threatSum += threatContribution * retaliationFactor
    preySum += preyContribution
    parts?.push({ other, assessment, threatContribution, retaliationFactor, preyContribution })
  }

  return {
    dist,
    kernel,
    diagModifier,
    threatSum,
    preySum,
    threat: clamp(threatSum, 0, 1),
    prey: clamp(preySum, 0, 1),
    parts
  }
}

function evaluateAttack(frame: DecisionFrame, cell: PerceivedCell, encounter: Encounter, tracing: boolean): Candidate {
  const direction = directionFromDelta(cell.dx, cell.dy)
  return {
    decision: {
      type: 'ATTACK',
      targetX: cell.x,
      targetY: cell.y,
      utility: encounter.threat * frame.defenseDrive,
      description: `attack ${direction}`,
      icon: `💥${ORB_ICON} ${direction}`
    },
    terms: tracing ? { kind: 'ATTACK', cell, encounter } : null,
    score: null
  }
}

function evaluateBite(frame: DecisionFrame, cell: PerceivedCell, encounter: Encounter, tracing: boolean): Candidate {
  const { orb, motivations } = frame
  const { genes } = orb
  const preyDrive = encounter.prey * frame.attackDrive
  const greed = genes.kill_greed * encounter.prey
  const fear = genes.fear_weight * cell.threat * motivations.fearEffective
  const direction = directionFromDelta(cell.dx, cell.dy)
  return {
    decision: {
      type: 'BITE',
      targetX: cell.x,
      targetY: cell.y,
      utility: preyDrive + greed - fear,
      description: `bite ${direction}`,
      icon: `🍗${ORB_ICON} ${direction}`
    },
    terms: tracing ? { kind: 'BITE', cell, encounter, preyDrive, greed, fear } : null,
    score: null
  }
}

/**
 * Picks the orb's action for this turn.
 *
 * Every possible action gets a base utility from the orb's motivations and
 * surroundings. The candidate that repeats the previous action gets a bonus
 * (`inertia_bias`), every candidate is jittered (`decision_noise`), and the
 * highest result wins, unless the orb acts on impulse and takes a random
 * candidate instead.
 */
export function chooseAction(orb: Orb, host: OrbHost): Choice {
  const { perception, motivations } = orb.refreshSnapshot()
  const { genes } = orb
  const tracing = host.debugOrbId === orb.id

  const current = perception.find(c => c.dx === 0 && c.dy === 0) ?? null
  const currentEnergy = current?.energy ?? 0
  const currentLocalDensity = current?.localDensity ?? 0
  const W_hunger = genes.hunger_weight
  const W_aggression = genes.aggression_weight
  const W_fear = genes.fear_weight

  const kinDrive = KIN_COMFORT * (1 - motivations.hunger) + W_fear * motivations.fearEffective

  const frame: DecisionFrame = {
    orb,
    motivations,
    currentEnergy,
    currentEnergyNorm: clamp(currentEnergy / Math.max(genes.max_energy_norm, 1), 0, 1),
    currentThreat: current?.threat ?? 0,
    currentLocalDensity,
    spacePrefCurrent: spacePreference(orb, currentLocalDensity),
    attackDrive:
      (W_aggression * motivations.aggression + W_hunger * motivations.hunger) / Math.max(W_aggression + W_hunger, 0.001),
    defenseDrive:
      (W_aggression * motivations.aggression + W_fear * motivations.fearEffective * genes.defense_instinct) /
      Math.max(W_aggression + W_fear * genes.defense_instinct, 0.001),
    hpGainByEnergyConsumption: host.settings.hpGainByEnergyConsumption,
    birthTaxPercent: host.settings.birthTaxPercent,
    kinDrive,
    kinHere: kinDrive * (current?.kinAffinity ?? 0)
  }

  const candidates: Candidate[] = [ evaluateWait(frame, tracing) ]

  if (currentEnergy > 0) {
    candidates.push(evaluateConsume(frame, tracing))
  }

  if (orb.canGiveBirth() && orb.findBirthCell()) {
    candidates.push(evaluateDivide(frame, tracing))
  }

  const energyTarget = findBestEnergyTarget(orb, perception)
  for (const cell of perception) {
    if (!isAdjacent(cell)) {
      continue
    }
    if (!cell.occupied) {
      candidates.push(evaluateMove(frame, cell, energyTarget, tracing))
      continue
    }
    const encounter = assessEncounter(frame, cell, host, tracing)
    if (encounter.threat > 0) {
      candidates.push(evaluateAttack(frame, cell, encounter, tracing))
    }
    if (encounter.prey > 0) {
      candidates.push(evaluateBite(frame, cell, encounter, tracing))
    }
  }

  for (const candidate of candidates) {
    const base = candidate.decision.utility
    const repeats = orb.lastActionKey !== null && actionKey(orb, candidate.decision) === orb.lastActionKey
    const inertia = repeats ? genes.inertia_bias * INERTIA_BONUS : 0
    const noise = (Math.random() * 2 - 1) * genes.decision_noise
    const final = base + inertia + noise
    candidate.decision.utility = final
    if (tracing) {
      candidate.score = { base, inertia, noise, final }
    }
  }

  const impulsiveRoll = Math.random()
  const impulsive = impulsiveRoll < genes.impulsiveness
  let pickRoll: number | null = null
  let picked = candidates[0]
  if (impulsive) {
    pickRoll = Math.random()
    picked = candidates[Math.floor(pickRoll * candidates.length)]
  } else {
    for (const candidate of candidates) {
      if (candidate.decision.utility > picked.decision.utility) {
        picked = candidate
      }
    }
  }

  if (tracing) {
    logDecisionTrace(frame, candidates, { picked, impulsive, impulsiveRoll, pickRoll })
  }

  return { decision: picked.decision, impulsive }
}
