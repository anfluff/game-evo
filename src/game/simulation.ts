import type { SimEvent } from './events'
import { SPAWN_ARCHETYPES, DEFAULT_GENES, mutateGenes, type Genes } from './genes'
import { randomInt } from './math'
import { Orb, type OrbHost } from './orb'
import type { Settings } from './settings'
import { createGenerationStats, type GenerationStats } from './stats'
import { World } from './world'

/** Orders orbs by reproductive success: more children first, then longer life. */
function bySuccess(a: Orb, b: Orb): number {
  return b.children - a.children || b.age - a.age
}

/**
 * The whole game state and its rules of progression.
 *
 * The world is persistent: orbs are born and die turn after turn and nothing
 * resets while anyone is alive. A generation is a stretch of that history
 * with its own statistics. It closes after `generationLengthTurns`, or when
 * the last orb dies, and only then is the world reseeded from the most
 * successful orbs of the generation.
 *
 * It knows nothing about rendering. The UI reads its fields, calls `step`,
 * `advanceGeneration` or `reset`, and learns about changes through
 * `subscribe` (state changed) and `onEvent` (something worth animating).
 */
export class Simulation implements OrbHost {
  readonly settings: Settings
  readonly world: World<Orb>

  /** Living orbs, in the order they act. */
  orbs: Orb[] = []
  /** Turns played in the current generation. */
  turn = 0
  /** Index of the current generation, starting at 0. */
  generation = 0
  /** Counters per generation; the last entry is the one in progress. */
  generationStats: GenerationStats[] = []
  /** The most successful orbs of each finished generation. They parent the next one if the world has to be reseeded. */
  strongestPerGeneration: Orb[][] = []
  debugOrbId: string | null = null

  /** The most successful orbs that died in the current generation, best first. */
  private fallen: Orb[] = []
  /** Fraction of an energy unit owed to the world by the rain. */
  private rainDebt = 0
  private archetypeCursor = 0
  private version = 0
  private readonly listeners = new Set<() => void>()
  private readonly eventListeners = new Set<(event: SimEvent) => void>()

  constructor(settings: Settings) {
    this.settings = settings
    this.world = new World<Orb>(settings.worldSize[0], settings.worldSize[1])
    this.seedFirstGeneration()
  }

  get stats(): GenerationStats {
    return this.generationStats[this.generation]
  }

  // ---- progression ----

  /** Plays one turn: energy rains on the world, then every orb acts once. */
  step() {
    const { energyRainPer1000Cells, energyCellCap, generationLengthTurns } = this.settings
    this.rainDebt += (this.world.rows * this.world.cols * energyRainPer1000Cells) / 1000
    const drops = Math.floor(this.rainDebt)
    this.rainDebt -= drops
    this.world.rainEnergy(drops, energyCellCap)

    // The list only grows during the turn: the dead stay in place until the
    // sweep below, so nobody is skipped, and orbs born this turn act in it too.
    const orbs = this.orbs
    for (let i = 0; i < orbs.length; i++) {
      orbs[i].act()
    }
    this.orbs = orbs.filter(orb => orb.alive)

    this.turn += 1
    const stats = this.stats
    stats.turns = this.turn
    stats.populationSum += this.orbs.length
    for (const orb of this.orbs) {
      if (orb.age > stats.highestAge) {
        stats.highestAge = orb.age
      }
    }

    if (generationLengthTurns > 0 && this.turn >= generationLengthTurns && this.orbs.length > 0) {
      this.closeGeneration()
    }
    this.notify()
  }

  /** Reseeds the world: closes the current generation and breeds a fresh population from its most successful orbs. */
  advanceGeneration() {
    const { settings, world } = this
    const parents = this.closeGeneration()
    // A generation that died out soon after it opened has few orbs to offer; earlier ones fill the gap.
    for (let g = this.generation - 2; g >= 0 && parents.length < settings.newGenStrongestCount; g--) {
      for (const orb of this.strongestPerGeneration[g] ?? []) {
        if (parents.length < settings.newGenStrongestCount && !parents.some(parent => parent.id === orb.id)) {
          parents.push(orb)
        }
      }
    }
    this.clearOrbs()

    for (const parent of parents) {
      for (let i = 0; i < settings.newGenOffspringPerParent; i++) {
        const [ x, y ] = world.randomEmptyCell()
        const hp = randomInt(settings.initialOrbHP[0], settings.initialOrbHP[1])
        this.spawnChild(parent, x, y, hp)
      }
    }

    if (settings.resetEnergyOnNewGenerations) {
      this.reseedEnergy()
    }
    this.stats.energyStart = world.totalEnergy()
    this.notify()
  }

  /** Files the statistics of the current generation and opens the next. The world is left as it is. */
  private closeGeneration(): Orb[] {
    const strongest = this.pickStrongest([ ...this.fallen, ...this.orbs ])
    this.strongestPerGeneration[this.generation] = strongest

    this.generation += 1
    this.generationStats.push(createGenerationStats())
    this.stats.energyStart = this.world.totalEnergy()
    this.fallen = []
    this.turn = 0
    return strongest
  }

  /** Chooses the orb whose decisions are explained in the console, or none. */
  setDebugOrb(id: string | null) {
    this.debugOrbId = id
  }

  /** Throws away all history and starts over from generation 0. */
  reset() {
    this.generation = 0
    this.turn = 0
    this.strongestPerGeneration = []
    this.debugOrbId = null
    this.seedFirstGeneration()
    this.notify()
  }

  private seedFirstGeneration() {
    const { settings, world } = this
    this.generationStats = [ createGenerationStats() ]
    this.clearOrbs()
    this.archetypeCursor = 0

    for (let i = 0; i < settings.initialOrbsCount; i++) {
      const [ x, y ] = world.randomEmptyCell()
      const hp = randomInt(settings.initialOrbHP[0], settings.initialOrbHP[1])
      this.addOrb(new Orb(this, x, y, hp, this.nextArchetypeGenes()))
    }

    this.reseedEnergy()
    this.stats.energyStart = world.totalEnergy()
  }

  /** The first generation cycles through the predefined characters. */
  private nextArchetypeGenes(): Genes {
    const template = SPAWN_ARCHETYPES[this.archetypeCursor % SPAWN_ARCHETYPES.length] ?? DEFAULT_GENES
    this.archetypeCursor += 1
    return { ...template }
  }

  /** The orbs with the most children, the older first among equals, one per id, dead or alive. */
  private pickStrongest(candidates: Orb[]): Orb[] {
    const sorted = candidates.sort(bySuccess)
    const strongest: Orb[] = []
    const seen = new Set<string>()
    for (const orb of sorted) {
      if (seen.has(orb.id)) {
        continue
      }
      seen.add(orb.id)
      strongest.push(orb)
      if (strongest.length >= this.settings.newGenStrongestCount) {
        break
      }
    }
    return strongest
  }

  private clearOrbs() {
    this.orbs = []
    this.fallen = []
    this.rainDebt = 0
    this.world.clearOccupants()
  }

  private reseedEnergy() {
    this.world.resetEnergy()
    this.world.scatterEnergy(this.settings.initialEnergyOnMap)
  }

  private addOrb(orb: Orb) {
    this.orbs.push(orb)
    this.world.place(orb)
  }

  // ---- OrbHost ----

  spawnChild(parent: Orb, x: number, y: number, hp: number): Orb {
    const genes = mutateGenes(parent.genes, this.settings.kinshipMaxDepth)
    const child = new Orb(this, x, y, hp, genes, parent)
    this.addOrb(child)
    return child
  }

  retire(orb: Orb) {
    const stats = this.stats
    stats.reasons[orb.deathReason ?? 'no_hp'] += 1
    if (orb.age > stats.highestAge) {
      stats.highestAge = orb.age
    }
    // Only the best of the dead can ever parent a reseed, so the rest are not kept.
    this.fallen.push(orb)
    this.fallen.sort(bySuccess)
    this.fallen.length = Math.min(this.fallen.length, this.settings.newGenStrongestCount)
    this.world.remove(orb)
  }

  emit(event: SimEvent) {
    for (const listener of this.eventListeners) {
      listener(event)
    }
  }

  // ---- observation ----

  /** Calls `listener` after every change of state. Returns the unsubscribe function. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Increases with every change of state. */
  readonly getVersion = (): number => this.version

  /** Calls `listener` for every event of a turn, as it happens. Returns the unsubscribe function. */
  onEvent(listener: (event: SimEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  private notify() {
    this.version += 1
    for (const listener of this.listeners) {
      listener()
    }
  }
}
