import { randomInt } from './math'

/** Anything that occupies a cell. The world keeps `x`/`y` in sync with its index. */
export interface Placeable {
  x: number
  y: number
}

const NO_OCCUPANTS: readonly never[] = []

/**
 * The grid: energy per cell and an index of who stands where.
 * Every coordinate pair is (x = column, y = row).
 */
export class World<T extends Placeable> {
  readonly rows: number
  readonly cols: number
  /** Energy per cell, addressed as `energy[y][x]`. */
  energy: number[][] = []
  private occupants: T[][] = []

  constructor(rows: number, cols: number) {
    this.rows = rows
    this.cols = cols
    this.resetEnergy()
    this.clearOccupants()
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows
  }

  // ---- occupants ----

  /** Occupants of a cell in arrival order. Empty for cells outside the world. */
  occupantsAt(x: number, y: number): readonly T[] {
    if (!this.contains(x, y)) {
      return NO_OCCUPANTS
    }
    return this.occupants[y * this.cols + x]
  }

  isOccupied(x: number, y: number): boolean {
    return this.occupantsAt(x, y).length > 0
  }

  /** First occupant of a cell that is not `self`. */
  otherOccupantAt(x: number, y: number, self: T): T | null {
    for (const occupant of this.occupantsAt(x, y)) {
      if (occupant !== self) {
        return occupant
      }
    }
    return null
  }

  place(item: T) {
    if (this.contains(item.x, item.y)) {
      this.occupants[item.y * this.cols + item.x].push(item)
    }
  }

  remove(item: T) {
    if (!this.contains(item.x, item.y)) {
      return
    }
    const cell = this.occupants[item.y * this.cols + item.x]
    const index = cell.indexOf(item)
    if (index >= 0) {
      cell.splice(index, 1)
    }
  }

  /** The only way a placed item may change position. */
  relocate(item: T, x: number, y: number) {
    this.remove(item)
    item.x = x
    item.y = y
    this.place(item)
  }

  clearOccupants() {
    this.occupants = Array.from({ length: this.rows * this.cols }, () => [])
  }

  /** A random unoccupied cell, or any random cell if none turns up in 1000 tries. */
  randomEmptyCell(): [ number, number ] {
    for (let i = 0; i < 1000; i++) {
      const x = randomInt(0, this.cols - 1)
      const y = randomInt(0, this.rows - 1)
      if (!this.isOccupied(x, y)) {
        return [ x, y ]
      }
    }
    return [ randomInt(0, this.cols - 1), randomInt(0, this.rows - 1) ]
  }

  // ---- energy ----

  energyAt(x: number, y: number): number {
    return this.contains(x, y) ? this.energy[y][x] : 0
  }

  addEnergy(x: number, y: number, amount: number = 1) {
    if (this.contains(x, y)) {
      this.energy[y][x] += Math.max(0, amount)
    }
  }

  /** Removes `amount` from a cell if it holds at least that much. */
  takeEnergy(x: number, y: number, amount: number = 1): boolean {
    const need = Math.max(0, amount)
    if (!this.contains(x, y) || this.energy[y][x] < need) {
      return false
    }
    this.energy[y][x] -= need
    return true
  }

  totalEnergy(): number {
    let sum = 0
    for (const row of this.energy) {
      for (const value of row) {
        sum += value
      }
    }
    return sum
  }

  resetEnergy() {
    this.energy = Array.from({ length: this.rows }, () => Array<number>(this.cols).fill(0))
  }

  /** Drops `total` single units of energy on random cells. */
  scatterEnergy(total: number) {
    for (let i = 0; i < total; i++) {
      const y = randomInt(0, this.rows - 1)
      const x = randomInt(0, this.cols - 1)
      this.addEnergy(x, y, 1)
    }
  }

  /**
   * Drops `count` single units of energy on random cells. A unit that lands
   * on a cell already holding `cap` or more is lost, so a full world stops filling.
   */
  rainEnergy(count: number, cap: number) {
    for (let i = 0; i < count; i++) {
      const y = randomInt(0, this.rows - 1)
      const x = randomInt(0, this.cols - 1)
      if (this.energy[y][x] < cap) {
        this.energy[y][x] += 1
      }
    }
  }
}
