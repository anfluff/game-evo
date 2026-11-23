import { clamp } from './math'
import type { Orb } from './orb'
import type { World } from './world'

export type OrbMotivations = {
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

export type PerceivedCell = {
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

export type Snapshot = {
  perception: PerceivedCell[]
  motivations: OrbMotivations
}

/** How one orb reads another, before distance is taken into account. */
export type OrbAssessment = {
  kinship: number
  /** Their normalised hp over ours. */
  enemyAdvantage: number
  /** 1 for a stranger, lower for trusted relatives. */
  threatModifier: number
  /** Expected fear of being hit back, 0..1. */
  retaliationFear: number
  /** How attractive they are as prey, ignoring kinship. */
  preyBase: number
  /** 1 for a stranger, lower for relatives we are reluctant to attack. */
  preyModifier: number
}

export function assessOther(self: Orb, other: Orb, hpNorm: number, riskDrive: number): OrbAssessment {
  const { genes } = self
  const enemyHpNorm = clamp(other.hp / genes.hp_healthy_norm, 0, 1)
  const kinship = self.kinshipTo(other)

  const enemyAdvantage = enemyHpNorm / Math.max(hpNorm, 0.001)
  const trustedThreatReduction = clamp(kinship * genes.trust_in_relatives, 0, 1)
  const threatModifier = clamp(1 - trustedThreatReduction, 0, 1)

  const ourAdvantage = hpNorm / Math.max(enemyHpNorm, 0.001)
  const attackFeasibility = ourAdvantage / genes.attack_margin
  const attackSignal = clamp(attackFeasibility - 1, 0, 1)

  const retaliationFear = clamp(genes.retaliation_fear * enemyAdvantage * (1 - riskDrive), 0, 1)
  const preyBase = attackSignal * genes.cannibalism_factor * (1 - retaliationFear)
  const relativeAggression = clamp(genes.aggression_towards_relatives, 0, 1)
  const preyModifier = clamp((1 - kinship) + kinship * relativeAggression, 0, 1)

  return { kinship, enemyAdvantage, threatModifier, retaliationFear, preyBase, preyModifier }
}

/** Share of the in-bounds cells around (x, y) that are occupied. */
function localDensityAt(world: World<Orb>, x: number, y: number): number {
  let occupiedNeighbors = 0
  let total = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (!world.contains(nx, ny)) continue
      total += 1
      if (world.isOccupied(nx, ny)) {
        occupiedNeighbors += 1
      }
    }
  }
  return total > 0 ? occupiedNeighbors / total : 0
}

/**
 * What the orb senses in the square of the given radius around it, and the
 * motivation levels that follow from its hp and those surroundings.
 */
export function perceive(orb: Orb, world: World<Orb>, radius: number): Snapshot {
  const { genes } = orb
  const hpNorm = clamp(orb.hp / genes.hp_healthy_norm, 0, 1)
  const riskDrive = clamp(hpNorm * genes.risk_tolerance, 0, 1)
  const trust = clamp(genes.trust_in_relatives, 0, 1)

  // An orb near several perceived cells is assessed once and reused.
  const assessments = new Map<Orb, OrbAssessment>()
  const assess = (other: Orb): OrbAssessment => {
    let assessment = assessments.get(other)
    if (!assessment) {
      assessment = assessOther(orb, other, hpNorm, riskDrive)
      assessments.set(other, assessment)
    }
    return assessment
  }

  const perception: PerceivedCell[] = []
  let maxThreat = 0
  let maxPrey = 0

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = orb.x + dx
      const ty = orb.y + dy

      const inBounds = world.contains(tx, ty)
      const energy = world.energyAt(tx, ty)

      const dist = Math.sqrt(dx * dx + dy * dy)
      const kernel = Math.pow(genes.distance_decay, dist)
      const isDiagonal = dx !== 0 && dy !== 0
      const diagModifier = isDiagonal ? genes.diagonal_awareness : 1.0

      let threatSum = 0
      let preySum = 0
      let kinAffinitySum = 0
      let occupied = false

      if (inBounds) {
        occupied = world.otherOccupantAt(tx, ty, orb) !== null

        // Every orb radiates threat, prey appeal and kin comfort onto the cells around it.
        for (let ddy = -1; ddy <= 1; ddy++) {
          for (let ddx = -1; ddx <= 1; ddx++) {
            const sources = world.occupantsAt(tx + ddx, ty + ddy)
            if (sources.length === 0) continue

            const spreadDist = Math.sqrt(ddx * ddx + ddy * ddy)
            const spreadKernel = Math.pow(genes.distance_decay, spreadDist)
            const spreadDiagModifier = ddx !== 0 && ddy !== 0 ? genes.diagonal_awareness : 1.0

            for (const other of sources) {
              if (other === orb) continue
              const a = assess(other)
              kinAffinitySum += a.kinship * kernel * diagModifier * spreadKernel * spreadDiagModifier * trust
              threatSum += a.enemyAdvantage * kernel * diagModifier * spreadKernel * spreadDiagModifier * a.threatModifier
              preySum += a.preyBase * kernel * diagModifier * spreadKernel * spreadDiagModifier * a.preyModifier
            }
          }
        }
      }

      const threat = clamp(threatSum, 0, 1)
      const prey = clamp(preySum, 0, 1)
      const kinAffinity = clamp(kinAffinitySum, 0, 1)
      const localDensity = inBounds ? localDensityAt(world, tx, ty) : 0

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

  // How far hp is above the division threshold: 0 at the threshold, 1 at full health.
  let reproduction = 0
  if (hpNorm > genes.min_hp_to_divide) {
    reproduction = clamp((hpNorm - genes.min_hp_to_divide) / Math.max(1 - genes.min_hp_to_divide, 0.001), 0, 1)
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
