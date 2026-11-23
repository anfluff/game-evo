import { ORB_ICON, type ActionDecision, type ActionType } from './actions'
import { actionKey, chooseAction } from './decision'
import type { SimEvent } from './events'
import type { Genes } from './genes'
import { clamp, randomHexId } from './math'
import { perceive, type OrbMotivations, type PerceivedCell, type Snapshot } from './perception'
import type { Settings } from './settings'
import { deathReasons, type DeathReason, type GenerationStats } from './stats'
import type { World } from './world'

/** What an orb needs from the simulation it lives in. */
export interface OrbHost {
  readonly settings: Settings
  readonly world: World<Orb>
  /** Counters of the generation in progress. */
  readonly stats: GenerationStats
  /** Id of the orb whose decisions are explained in the console, if any. */
  readonly debugOrbId: string | null
  spawnChild(parent: Orb, x: number, y: number, hp: number): Orb
  /** Called once when an orb dies; the host drops it from the world. */
  retire(orb: Orb): void
  emit(event: SimEvent): void
}

export type BirthCost = {
  childHp: number
  tax: number
  totalCost: number
  costFraction: number
}

export class Orb {
  readonly id: string
  readonly name: string
  age: number = 0

  /** Position. Changed only through `World.relocate`, which keeps the world index in sync. */
  x: number
  y: number
  hp: number
  alive: boolean = true

  readonly genes: Genes

  readonly parentId: string | null
  readonly ancestorIds: string[]
  private lineageDistancesCache: Map<string, number> | null = null
  private lineageDistancesCacheByDepth: Map<number, Map<string, number>> = new Map()

  lastActionType: ActionType | null = null
  /** Type and direction of the last action. A candidate with the same key counts as repeating it. */
  lastActionKey: string | null = null
  lastMotivations: OrbMotivations | null = null
  lastPerception: PerceivedCell[] = []
  lastScanRadius: number = 0

  /** One list of entries per turn lived. */
  log: string[][] = []
  deathReason: DeathReason | null = null
  reproductionCooldownRemaining: number = 0
  /** Children born by division over the whole life. */
  children: number = 0

  private readonly host: OrbHost

  constructor(host: OrbHost, x: number, y: number, hp: number, genes: Genes, parent?: Orb | null) {
    const { idLength, kinshipMaxDepth } = host.settings
    this.host = host
    this.x = x
    this.y = y
    this.hp = hp
    this.genes = genes
    this.id = randomHexId(idLength)
    this.name = this.id.padEnd(8, '0').substring(0, 8)
    this.parentId = parent?.id ?? null
    this.ancestorIds = parent ? [ parent.id, ...parent.ancestorIds ].slice(0, kinshipMaxDepth) : []
    this.addToLog(`👋${ORB_ICON}, ${hp}❤️`)
  }

  // -- Kinship --

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

    const depth = clamp(Math.round(maxDepth), 0, this.host.settings.kinshipMaxDepth)
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

  /** 1 for self, parent or child; halves with every further step through the closest shared ancestor; 0 for strangers. */
  kinshipTo(other: Orb): number {
    if (this.id === other.id) {
      return 1
    }
    const a = this.getLineageDistances(this.genes.recognized_ancestry_depth)
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

  // -- Turn --

  act() {
    if (!this.alive) {
      return
    }

    this.log.push([])

    const { decision } = chooseAction(this, this.host)
    this.executeDecision(decision)

    if (this.alive) {
      const upkeep = this.upkeepCost()
      this.addToLog(`> ⌛️ –${upkeep}❣️`)
      this.loseHp(upkeep)
    }
    if (this.reproductionCooldownRemaining > 0) {
      this.reproductionCooldownRemaining = Math.max(0, this.reproductionCooldownRemaining - 1)
    }
    this.age += 1
  }

  /** Recomputes and stores what the orb senses right now. */
  refreshSnapshot(): Snapshot {
    const radius = this.host.settings.scanRadius
    const snapshot = perceive(this, this.host.world, radius)
    this.lastPerception = snapshot.perception
    this.lastMotivations = snapshot.motivations
    this.lastScanRadius = radius
    return snapshot
  }

  /** What staying alive costs this turn: 1 hp plus a share of the hp carried, so big bodies are expensive. */
  upkeepCost(): number {
    return 1 + Math.floor(this.hp * (this.host.settings.upkeepPercentOfHp / 100))
  }

  private executeDecision(d: ActionDecision) {
    this.lastActionType = d.type
    this.lastActionKey = actionKey(this, d)
    if (d.type === 'DIVIDE') {
      const { childHp, tax } = this.birthCost()
      this.addToLog(`${d.icon} (child –${childHp}❣️, tax –${tax}❣️)`)
    } else {
      this.addToLog(d.icon)
    }

    switch (d.type) {
      case 'WAIT':
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
        this.divide()
        break
    }
  }

  // -- Actions --

  private move(x: number, y: number) {
    const { world } = this.host
    if (world.isOccupied(x, y)) {
      this.addToLog(`It is occupied`)
      return
    }

    world.relocate(this, x, y)
  }

  private bite(x: number, y: number) {
    const prey = this.host.world.otherOccupantAt(x, y, this)
    if (!prey) {
      this.addToLog(`No one is there`)
      return
    }

    const { settings, world, stats } = this.host
    this.host.emit({ type: 'bite', orbId: this.id, fromX: this.x, fromY: this.y, toX: prey.x, toY: prey.y })

    const intendedBite = Math.round(this.hp * settings.bitePercentOfAttackerHp)
    const biteAmount = Math.min(intendedBite, prey.hp)

    // Part of the bite is wasted, the rest feeds the attacker. The waste falls
    // to the ground as energy at the eating rate, so a bite never creates hp.
    const wasteRaw = Math.floor(biteAmount * settings.biteWasteFraction)
    const waste = Math.min(biteAmount, Math.max(settings.biteWasteMin, wasteRaw))
    const hpTransfer = biteAmount - waste
    const hpPerEnergy = settings.hpGainByEnergyConsumption
    const mineralDrop = hpPerEnergy > 0 ? Math.floor(waste / hpPerEnergy) : 0

    const dropX = prey.x
    const dropY = world.contains(prey.x, prey.y + 1) ? prey.y + 1 : prey.y

    prey.addToLog(`${this.name} 🍗${ORB_ICON} > me, –${biteAmount}💔`)
    if (prey.hp - biteAmount <= 0) {
      prey.deathReason = deathReasons.EATEN
    }
    prey.loseHp(biteAmount)

    if (hpTransfer > 0) {
      this.gainHp(hpTransfer)
      stats.hpGainedFromEating += hpTransfer
    }

    if (mineralDrop > 0) {
      world.addEnergy(dropX, dropY, mineralDrop)
    }

    this.addToLog(`🍗${ORB_ICON} ${prey.id}: –${biteAmount}❣️, +${hpTransfer}❤️, dropped ${mineralDrop}⚡️`)
  }

  private attack(x: number, y: number) {
    const target = this.host.world.otherOccupantAt(x, y, this)
    if (!target) {
      this.addToLog(`No one is there`)
      return
    }

    this.host.emit({ type: 'attack', orbId: this.id, fromX: this.x, fromY: this.y, toX: target.x, toY: target.y })

    const intendedAttack = Math.round(this.hp * this.host.settings.bitePercentOfAttackerHp)
    const attackAmount = Math.min(intendedAttack, target.hp)

    target.addToLog(` ${this.name}💥 > me, –${attackAmount}❣️`)
    if (target.hp - attackAmount <= 0) {
      target.deathReason = deathReasons.KILLED
    }
    target.loseHp(attackAmount)

    this.addToLog(`💥 ${target.id}: –${attackAmount}❣️`)
  }

  /** The free orthogonal neighbour a child would be born into, if there is one. */
  findBirthCell(): [ number, number ] | null {
    const { world } = this.host
    const neighbors = [
      [this.x - 1, this.y], [this.x + 1, this.y],
      [this.x, this.y - 1], [this.x, this.y + 1]
    ]
    for (const [nx, ny] of neighbors) {
      if (world.contains(nx, ny) && !world.isOccupied(nx, ny)) {
        return [ nx, ny ]
      }
    }
    return null
  }

  birthCost(): BirthCost {
    const childHp = Math.ceil(this.hp * this.genes.offspring_investment)
    const tax = Math.ceil(this.hp * (this.host.settings.birthTaxPercent / 100))
    const totalCost = childHp + tax
    const costFraction = totalCost / Math.max(this.hp, 1)
    return { childHp, tax, totalCost, costFraction }
  }

  /** Healthy enough, off cooldown, and able to pay for a child that starts with at least 1 hp. */
  canGiveBirth(): boolean {
    const hpNorm = clamp(this.hp / Math.max(this.genes.hp_healthy_norm, 1), 0, 1)
    const { childHp, totalCost } = this.birthCost()
    return (
      hpNorm >= this.genes.min_hp_to_divide &&
      this.reproductionCooldownRemaining <= 0 &&
      this.hp - totalCost > 0 &&
      childHp > 0
    )
  }

  private divide() {
    const cell = this.findBirthCell()
    if (!cell) {
      this.addToLog('No space to divide')
      return
    }
    if (!this.canGiveBirth()) {
      this.addToLog(`I cannot give birth right now`)
      return
    }

    const [ x, y ] = cell
    const { childHp, totalCost } = this.birthCost()
    const child = this.host.spawnChild(this, x, y, childHp)
    this.host.emit({ type: 'birth', orbId: this.id, fromX: this.x, fromY: this.y, toX: x, toY: y })

    this.loseHp(totalCost)
    this.reproductionCooldownRemaining = Math.max(0, Math.round(this.genes.reproduction_cooldown))

    this.addToLog(`👋${ORB_ICON} ${child.name} ${childHp}❤️ (${child.x},${child.y})`)

    this.children += 1
    this.host.stats.births += 1
  }

  private consumeEnergy() {
    const { settings, world, stats } = this.host
    if (!world.takeEnergy(this.x, this.y, 1)) {
      this.addToLog(`No energy here`)
      return
    }
    stats.consumedEnergy += 1

    const gain = settings.hpGainByEnergyConsumption
    this.addToLog(`+${gain}❤️`)
    this.gainHp(gain)
    stats.hpGainedFromConsumingEnergy += gain

    this.host.emit({ type: 'consume', orbId: this.id })
  }

  // -- helpers --

  private gainHp(amount: number) {
    this.hp += amount
    this.addToLog(`${this.hp}❤️`)
  }

  private loseHp(amount: number) {
    this.hp -= amount
    this.addToLog(`${this.hp}❤️`)
    if (this.hp <= 0) {
      this.die()
    }
  }

  private die() {
    if (!this.alive) {
      return
    }
    this.alive = false

    const { settings, world } = this.host
    world.addEnergy(this.x, this.y, settings.energyCreatedOnDeath)
    if (!this.deathReason) {
      this.deathReason = deathReasons.NO_HP
    }

    this.addToLog('☠️')
    this.host.retire(this)
  }

  private addToLog(entry: string) {
    if (!this.log[this.log.length - 1]) {
      this.log.push([])
    }
    const cleaned = entry.replace(/>/g, '').trim()
    if (cleaned.length > 0) {
      this.log[this.log.length - 1].push(cleaned)
    }
  }
}
