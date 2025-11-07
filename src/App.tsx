import { useEffect, useState } from 'react'
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
import { SettingsPanel, loadSettings, type Settings } from './components/SettingsPanel'
import { SavedOrbs } from './components/SavedOrbs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

/*
---- Заметки -----

теперь зрение работает здорово и появилсь реакции
но теперь кажется сомнительным само днк, как будто не должно быть в нем команд ничем не обусловленных
что думаю сделать - добавить больше огранов чувств.
и днк будет борьбой разных органов чувств за "процессорное время".
возможно даже "общее рабочее пространство" и орган принятия решения из предлагаемых разными системами

- орбы должны уметь смотреть на себя - сколько хп
- определять родство с соседями - похожи ли днк
- сами мочь определять порог деления

ну и плюс нужно вынести все захардкоженные параметры в начальные настройки
- размер поля
- начальное количество орбов
- начальное здоровье орбов
- количество энергии на поле
- порог здоровья для деления
- длина днк
- отбор

+ сохранять лог каждого раунда? чтобы посмотреть что там происходило и поисследовать орбов
+ конструктор орба

 */

// ---- SETUP -----

const settings = loadSettings()

const worldSize: number[] = settings.worldSize

const initialOrbHP: number[] = settings.initialOrbHP
const initialOrbsCount = settings.initialOrbsCount
const newGenStrongestCount = settings.newGenStrongestCount
const newGenOffspringPerParent = settings.newGenOffspringPerParent

const initialEnergyOnMap = settings.initialEnergyOnMap
const resetEnergyOnNewGenerations = settings.resetEnergyOnNewGenerations // true - сбрасывать энергию на новую генерацию, false - сохранять

const splitHPThreshold = settings.splitHPThreshold // ??
const hpGainByEnergyConsumption = settings.hpGainByEnergyConsumption
const energyCreatedOnDeath = settings.energyCreatedOnDeath

const dnaLength = settings.dnaLength
const reactionsLength = settings.reactionsLength // Number of signal categories used by reactions (columns)
const reactionDirectionsLength = settings.reactionDirectionsLength // Number of directions that a signal can come from (rows)

const idLength = settings.idLength
const initialTurnDuration = settings.initialTurnDuration

const cellSize = 48
const cellGap = 4
const orbSize = 36

// ---- CLASSES -----

const orbCommands = {
  WATCH_LEFT: 1,
  WATCH_RIGHT: 2,
  WATCH_TOP: 3,
  WATCH_BOTTOM: 4,

  STAY_IDLE: 5,
  MOVE_RIGHT: 6,
  MOVE_LEFT: 7,
  MOVE_UP: 8,
  MOVE_DOWN: 9,

  BITE_LEFT: 10,
  BITE_RIGHT: 11,
  BITE_UP: 12,
  BITE_DOWN: 13,

  CONSUME_ENERGY: 14,

  GIVE_BIRTH_LEFT: 15,
  GIVE_BIRTH_RIGHT: 16,
  GIVE_BIRTH_UP: 17,
  GIVE_BIRTH_DOWN: 18
}

const orbCommandsInfo: Record<number, { icon: string; label: string }> = {
  [orbCommands.WATCH_LEFT]: {
    icon: '👁️⬅️',
    label: 'Watch Left'
  },
  [orbCommands.WATCH_RIGHT]: {
    icon: '👁️️➡️',
    label: 'Watch Right'
  },
  [orbCommands.WATCH_TOP]: {
    icon: '👁️️⬆️',
    label: 'Watch Top'
  },
  [orbCommands.WATCH_BOTTOM]: {
    icon: '👁️️⬇️',
    label: 'Watch Bottom'
  },
  [orbCommands.STAY_IDLE]: {
    icon: '💤',
    label: 'Stay Idle'
  },
  [orbCommands.MOVE_RIGHT]: {
    icon: '🦶➡️',
    label: 'Move Right'
  },
  [orbCommands.MOVE_LEFT]: {
    icon: '🦶⬅️',
    label: 'Move Left'
  },
  [orbCommands.MOVE_UP]: {
    icon: '🦶⬆️',
    label: 'Move Up'
  },
  [orbCommands.MOVE_DOWN]: {
    icon: '🦶⬇️',
    label: 'Move Down'
  },
  [orbCommands.BITE_LEFT]: {
    icon: '💥⬅️',
    label: 'Bite Left'
  },
  [orbCommands.BITE_RIGHT]: {
    icon: '💥➡️',
    label: 'Bite Right'
  },
  [orbCommands.BITE_UP]: {
    icon: '💥⬆️',
    label: 'Bite Up'
  },
  [orbCommands.BITE_DOWN]: {
    icon: '💥⬇️',
    label: 'Bite Down'
  },
  [orbCommands.CONSUME_ENERGY]: {
    icon: '⚡️',
    label: 'Consume Energy'
  },
  [orbCommands.GIVE_BIRTH_LEFT]: {
    icon: '👶⬅️',
    label: 'Give Birth Left'
  },
  [orbCommands.GIVE_BIRTH_RIGHT]: {
    icon: '👶➡️',
    label: 'Give Birth Right'
  },
  [orbCommands.GIVE_BIRTH_UP]: {
    icon: '👶⬆️',
    label: 'Give Birth Up'
  },
  [orbCommands.GIVE_BIRTH_DOWN]: {
    icon: '👶⬇️',
    label: 'Give Birth Down'
  }
}

// Direction indices for reaction matrix rows
const reactionDirections = {
  LEFT: 0,
  RIGHT: 1,
  TOP: 2,
  BOTTOM: 3
} as const

class Orb {
  id: string
  name: string
  age: number = 0

  x: number
  y: number
  hp: number

  dna: number[]
  dnaPointer: number = 0
  reactions: number[][]

  log: string[][] = []
  deathReason: DeathReason | null = null
  preventAgingThisTurn: boolean = false
  glow: string = ''

  constructor(x: number, y: number, hp: number, dna: number[], reactions: number[][], parentName?: string) {
    this.x = x
    this.y = y
    this.hp = hp
    this.dna = dna
    this.reactions = reactions
    this.id = getRandomId(idLength)
    this.name = dnaToName(dna) + (parentName ? ` child of ${parentName}` : '')
    this.addToLog(`I was born with ❤️${hp}hp`)
  }

  triggerGlow(className: 'glow-white' | 'glow-red' | 'glow-green') {
    this.glow = className
    // request immediate re-render so UI reflects glow state even when paused
    forceRerender?.()
    setTimeout(() => {
      if (this.glow === className) {
        this.glow = ''
        // request re-render to clear the glow in UI
        forceRerender?.()
      }
    }, 1000)
  }

  act() {
    if (this.hp <= 0) {
      return
    }

    // Reset aging prevention flag for this turn
    this.preventAgingThisTurn = false

    // Start a new log block for this turn
    this.log.push([])

    this.executeCommand(this.dna[this.dnaPointer])
    // Apply unified aging once per act if not prevented by action
    if (!this.preventAgingThisTurn) {
      this.addToLog(`> I aged and lost 1 hp`)
      this.loseHp(1)
    }
    this.moveDnaPointer(1)
    this.age += 1
  }

  executeCommand(id: number) {
    this.addToLog(`I decided to ${orbCommandsInfo[id]?.icon ?? 'do ???'}`)
    switch (id) {
      case orbCommands.MOVE_RIGHT:
        this.move(this.x + 1, this.y)
        break
      case orbCommands.MOVE_LEFT:
        this.move(this.x - 1, this.y)
        break
      case orbCommands.MOVE_UP:
        this.move(this.x, this.y + 1)
        break
      case orbCommands.MOVE_DOWN:
        this.move(this.x, this.y - 1)
        break
      case orbCommands.CONSUME_ENERGY: {
        this.consumeEnergy()
        break
      }
      case orbCommands.BITE_LEFT: {
        this.bite(this.x - 1, this.y)
      }
        break
      case orbCommands.BITE_RIGHT: {
        this.bite(this.x + 1, this.y)
      }
        break
      case orbCommands.BITE_UP: {
        this.bite(this.x, this.y + 1)
      }
        break
      case orbCommands.BITE_DOWN: {
        this.bite(this.x, this.y - 1)
        break
      }
      case orbCommands.WATCH_RIGHT:
        this.watch(this.x + 1, this.y)
        break
      case orbCommands.WATCH_LEFT:
        this.watch(this.x - 1, this.y)
        break
      case orbCommands.WATCH_TOP:
        this.watch(this.x, this.y + 1)
        break
      case orbCommands.WATCH_BOTTOM:
        this.watch(this.x, this.y - 1)
        break
      case orbCommands.GIVE_BIRTH_LEFT:
        this.giveBirth(this.x - 1, this.y)
        break
      case orbCommands.GIVE_BIRTH_RIGHT:
        this.giveBirth(this.x + 1, this.y)
        break
      case orbCommands.GIVE_BIRTH_UP:
        this.giveBirth(this.x, this.y + 1)
        break
      case orbCommands.GIVE_BIRTH_DOWN:
        this.giveBirth(this.x, this.y - 1)
        break
    }
  }

  // -- commands --

  move(x: number, y: number) {
    if (!withinWorldBoundaries(x, y)) {
      this.addToLog(`I jump out of the world`)
      this.deathReason = deathReasons.OUT_OF_WORLD
      this.loseHp(this.hp)
      return
    }

    const occupants = getCellOrbs(x, y)
    if (occupants.length > 0) {
      this.addToLog(`It is occupied`)
      return
    }

    this.x = x
    this.y = y

    this.addToLog(`It worked`)
  }

  bite(x: number, y: number) {
    this.triggerGlow('glow-red')

    let cellOrbs = getCellOrbs(x, y, this.id)
    if (cellOrbs.length === 0) {
      this.addToLog(`No one is there`)
      return
    }

    this.eat(cellOrbs[0])
  }

  eat(prey: Orb) {
    if (prey instanceof Orb) {
      const canEat = prey.hp < this.hp / 2
      if (!canEat) {
        this.addToLog(`I failed to eat ${prey.id} (prey not smaller)`)
        return
      }

      // Gain full health from prey (all of its current hp)
      const hpGain = prey.hp
      this.hp += hpGain
      registerHpGainedFromEating(hpGain)
      this.addToLog(`I ate Orb ${prey.id} and got ${hpGain}hp`)

      // Eating prevents aging for this turn
      this.preventAgingThisTurn = true

      prey.addToLog(`I was eaten by ${this.id}`)
      prey.deathReason = deathReasons.EATEN
      prey.loseHp(prey.hp)
    }
  }

  watch(x: number, y: number) {
    // Determine direction of the watched cell relative to current orb
    const dx = x - this.x
    const dy = y - this.y
    let dirIndex: number | null = null
    if (dx === -1 && dy === 0) {
      dirIndex = reactionDirections.LEFT
    }
    if (dx === 1 && dy === 0) {
      dirIndex = reactionDirections.RIGHT
    }
    if (dx === 0 && dy === 1) {
      dirIndex = reactionDirections.TOP
    }
    if (dx === 0 && dy === -1) {
      dirIndex = reactionDirections.BOTTOM
    }

    let signalIndex

    if (!withinWorldBoundaries(x, y)) {
      this.addToLog('I looked out of the world')
      signalIndex = 0
    } else {
      const cellOrbs = getCellOrbs(x, y)
      if (cellOrbs.length === 0) {
        if (getCellEnergy(y, x) > 0) {
          this.addToLog('I saw energy')
          signalIndex = 1
        } else {
          this.addToLog('I saw nothing')
          signalIndex = 2
        }
      } else {
        this.addToLog('I saw an orb')
        if (cellOrbs.some(o => o.hp < this.hp)) {
          this.addToLog('smaller than me')
          signalIndex = 3
        } else {
          this.addToLog('bigger than me')
          signalIndex = 4
        }
      }
    }

    this.addToLog('and performed a reaction:')

    // If direction cannot be determined (shouldn't happen in normal usage), fallback to appropriate watch row
    const safeDirIndex = dirIndex ?? reactionDirections.LEFT
    const reactionCommandId = this.reactions[safeDirIndex]?.[signalIndex]
    if (reactionCommandId === undefined) {
      this.addToLog('no reaction configured')
      return
    }
    // Guard against recursive watch → watch chains
    if (
      reactionCommandId === orbCommands.WATCH_LEFT ||
      reactionCommandId === orbCommands.WATCH_RIGHT ||
      reactionCommandId === orbCommands.WATCH_TOP ||
      reactionCommandId === orbCommands.WATCH_BOTTOM
    ) {
      this.addToLog('ignored recursive watch reaction')
      return
    }
    this.executeCommand(reactionCommandId)
  }

  giveBirth(x: number, y: number) {
    if (!withinWorldBoundaries(x, y)) {
      this.addToLog(`I tried to give birth out of the world`)
      return
    }

    const occupants = getCellOrbs(x, y)
    if (occupants.length > 0) {
      this.addToLog(`I tried to give birth into occupied cell`)
      return
    }

    if (this.hp >= splitHPThreshold) {
      this.triggerGlow('glow-green')
      const child = spawnOrb(x, y, Math.ceil(this.hp / 2), this.dna, this.reactions, this.name)
      this.loseHp(Math.floor(this.hp / 2))
      this.addToLog(`It spawned ${child.name}`)
      registerBirth()
    } else {
      this.addToLog(`I did not have enough hp`)
    }
  }

  consumeEnergy() {
    const energyHere = getCellEnergy(this.y, this.x)
    if (energyHere > 0) {
      consumeCellEnergy(this.y, this.x, 1)
      registerEnergyConsumed(1)
      this.addToLog(`It worked`)
      this.gainHp(hpGainByEnergyConsumption)
      this.preventAgingThisTurn = true
      this.triggerGlow('glow-white')
    } else {
      this.addToLog(`No energy here`)
    }
  }

  // -- helpers --

  moveDnaPointer(value: number) {
    this.dnaPointer += value
    if (this.dnaPointer >= this.dna.length) {
      this.dnaPointer = 0
    }
  }

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
    const greens = this.dna.reduce((sum, item) => {
      return item === orbCommands.CONSUME_ENERGY
        ? sum + item
        : sum
    }, 0)

    const reds = this.dna.reduce((sum, item) => {
      return [
        orbCommands.BITE_LEFT,
        orbCommands.BITE_RIGHT,
        orbCommands.BITE_UP,
        orbCommands.BITE_DOWN
      ].includes(item)
        ? sum + item
        : sum
    }, 0)

    return {
      reds,
      greens
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

  if (worldIteration > 1) {
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
        spawnOrb(x, y, hp, strongestOrb.dna, strongestOrb.reactions)
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
  ancestorDNA: number[] = [],
  ancestorReactions: number[][] = [],
  parentName?: string
): Orb {
  const dna = ancestorDNA.length
    ? getMutatedDNA(ancestorDNA)
    : getRandomDNA()

  const reactions = ancestorReactions.length
    ? getMutatedReactions(ancestorReactions)
    : getRandomReactions()

  const orb = new Orb(x, y, hp, dna, reactions, parentName)
  orbs.push(orb)

  return orb
}

function makeTurn(_turnNum: number) {
  for (const orb of orbs) {
    if (orb.hp > 0) {
      orb.act()
    } else {

    }
  }
}

// ----- HELPERS -----

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
  if (obj instanceof Orb) {
    for (let i = 0; i < orbs.length; i++) {
      if (orbs[i].id === obj.id) {
        orbs.splice(i, 1)
        return
      }
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

// Generate a readable, deterministic name from DNA numbers
function dnaToName(dna: number[], maxLen: number = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const letters: string[] = []
  for (let i = 0; i < dna.length && letters.length < maxLen; i++) {
    const n = dna[i]
    letters.push(alphabet[n % 26])
  }
  const base = letters.join('') || 'orb'
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function getRandomDNA() {
  // return [ ...Array(dnaLength) ].map(() => getRandomOrbCommand())
  return [ ...Array(dnaLength) ].map((_value, index) => {
    if (
      index % 3 === 0
    ) {
      return orbCommands.CONSUME_ENERGY
    } else {
      return getRandomOrbCommand()
    }
  })
}

function getRandomOrbCommand() {
  // Choose from existing command IDs to avoid selecting removed IDs
  const values = Object.values(orbCommands)
  const idx = getRandomMinMax(0, values.length - 1)
  return values[idx]
}

// Return a random command ID excluding any listed in `excludeIds`
function getRandomOrbCommandExclude(excludeIds: number[] = []) {
  const values = Object.values(orbCommands)
  const allowed = values.filter(id => !excludeIds.includes(id))
  if (allowed.length === 0) {
    // Fallback to a safe no-op if everything was excluded
    return orbCommands.STAY_IDLE
  }
  const idx = getRandomMinMax(0, allowed.length - 1)
  return allowed[idx]
}

function getMutatedDNA(ancestorDNA: number[]) {
  const newDNA = [ ...ancestorDNA ]

  const randomIndex = getRandomMinMax(0, newDNA.length - 1)
  newDNA[randomIndex] = getRandomOrbCommand()

  return newDNA
}

function getMutatedReactions(ancestorReactions: number[][]) {
  // Deep copy matrix
  const newReactions = ancestorReactions.map(row => [ ...row ])

  // Pick a random cell to mutate
  const dirIndex = getRandomMinMax(0, reactionDirectionsLength - 1)
  const signalIndex = getRandomMinMax(0, reactionsLength - 1)

  const exclude = [
    orbCommands.WATCH_LEFT,
    orbCommands.WATCH_RIGHT,
    orbCommands.WATCH_TOP,
    orbCommands.WATCH_BOTTOM
  ]
  newReactions[dirIndex][signalIndex] = getRandomOrbCommandExclude(exclude)

  return newReactions
}

function getRandomReactions() {
  const exclude = [
    orbCommands.WATCH_LEFT,
    orbCommands.WATCH_RIGHT,
    orbCommands.WATCH_TOP,
    orbCommands.WATCH_BOTTOM
  ]
  // Build a matrix: rows = directions, cols = signal categories
  return Array.from({ length: reactionDirectionsLength }, () => (
    Array.from({ length: reactionsLength }, () => getRandomOrbCommandExclude(exclude))
  ))
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
}

let currentGeneration = 0
let deathStatsPerGeneration: GenerationStats[] = []
// Global re-render hook used by non-React objects (like Orb) to refresh UI
let forceRerender: (() => void) | null = null
// Strongest (oldest) orbs saved per generation for later viewing
let strongestOrbsPerGeneration: Orb[][] = []

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
    hpGainedFromEating: 0
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

// -------------

generateWorld()

function App() {
  const [ turn, setTurn ] = useState(0)
  const [ worldNum, setWorldNum ] = useState(0)
  const [ turnDuration, setTurnDuration ] = useState(initialTurnDuration)
  const [ selectedOrb, setSelectedOrb ] = useState<Orb | null>(null)
  const [ paused, setPaused ] = useState(false)
  const [ activeGenTab, setActiveGenTab ] = useState(0)
  const [ showSettings, setShowSettings ] = useState(false)
  const [ draftSettings, setDraftSettings ] = useState<Settings>(settings)

  // ---- Orb Generator state ----
  type SavedOrb = {
    id: string
    name: string
    dna: number[]
    reactions: number[][]
  }

  const SAVED_ORBS_KEY = 'saved_orbs_v1'

  function normalizeDna(dna: number[], len: number = dnaLength): number[] {
    const base = Array.from({ length: len }, (_v, i) => dna[i] ?? orbCommands.STAY_IDLE)
    return base.slice(0, len)
  }

  function normalizeReactions(reactions: number[][]): number[][] {
    const rows = reactionDirectionsLength
    const cols = reactionsLength
    const out: number[][] = []
    for (let r = 0; r < rows; r++) {
      const row = reactions[r] ?? []
      const normRow = Array.from({ length: cols }, (_v, i) => row[i] ?? orbCommands.STAY_IDLE).slice(0, cols)
      out.push(normRow)
    }
    return out
  }

  function getColorFromDNA(dna: number[]) {
    const greens = dna.reduce((sum, item) => item === orbCommands.CONSUME_ENERGY ? sum + item : sum, 0)
    const reds = dna.reduce((sum, item) => ([ orbCommands.BITE_LEFT, orbCommands.BITE_RIGHT, orbCommands.BITE_UP, orbCommands.BITE_DOWN ].includes(item) ? sum + item : sum), 0)
    return { reds, greens }
  }

  const [ savedOrbs, setSavedOrbs ] = useState<SavedOrb[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_ORBS_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map((o: any) => ({
        id: String(o.id ?? getRandomId(idLength)),
        name: String(o.name ?? dnaToName(normalizeDna(Array.isArray(o.dna) ? o.dna : []))),
        dna: normalizeDna(Array.isArray(o.dna) ? o.dna : []),
        reactions: normalizeReactions(Array.isArray(o.reactions) ? o.reactions : [])
      })) as SavedOrb[]
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_ORBS_KEY, JSON.stringify(savedOrbs))
    } catch {}
  }, [ savedOrbs ])

  const [ showOrbGenerator, setShowOrbGenerator ] = useState(false)
  const [ editingOrbId, setEditingOrbId ] = useState<string | null>(null)
  const [ genDNA, setGenDNA ] = useState<number[]>(normalizeDna(getRandomDNA()))
  const [ genReactions, setGenReactions ] = useState<number[][]>(normalizeReactions(getRandomReactions()))
  const [ genHP, setGenHP ] = useState<number>(getRandomMinMax(initialOrbHP[0], initialOrbHP[1]))

  function openOrbGenerator(existing?: SavedOrb) {
    setPaused(true)
    if (existing) {
      setEditingOrbId(existing.id)
      setGenDNA(normalizeDna(existing.dna))
      setGenReactions(normalizeReactions(existing.reactions))
      setGenHP(getRandomMinMax(initialOrbHP[0], initialOrbHP[1]))
    } else {
      setEditingOrbId(null)
      setGenDNA(normalizeDna(getRandomDNA()))
      setGenReactions(normalizeReactions(getRandomReactions()))
      setGenHP(getRandomMinMax(initialOrbHP[0], initialOrbHP[1]))
    }
    setShowOrbGenerator(true)
  }

  function saveGeneratedOrb() {
    const dnaNorm = normalizeDna(genDNA)
    const reactNorm = normalizeReactions(genReactions)
    const name = dnaToName(dnaNorm)
    if (editingOrbId) {
      setSavedOrbs(prev => prev.map(o => o.id === editingOrbId ? { ...o, name, dna: dnaNorm, reactions: reactNorm } : o))
    } else {
      const id = getRandomId(idLength)
      setSavedOrbs(prev => [ ...prev, { id, name, dna: dnaNorm, reactions: reactNorm } ])
    }
    setShowOrbGenerator(false)
    setEditingOrbId(null)
  }

  function spawnFromConfig(dna: number[], reactions: number[][], hp: number) {
    const [ x, y ] = getRandomEmptyCell()
    spawnOrb(x, y, hp, dna, reactions)
    setSelectedOrb(null)
    forceRerender?.()
  }

  const aliveOrbsCount: number = orbs.filter(orb => orb.hp > 0).length

  function triggerTurn() {
    setTurn(turn => turn + 1)
    makeTurn(turn)
  }

  function trackWorldStats() {
    if (deathStatsPerGeneration.length > 0 && currentGeneration > 0) {
      // Record turns count for the generation that just ended
      deathStatsPerGeneration[currentGeneration - 1].turns = turn

      // Save strongest (oldest) orbs for the generation that just ended.
      // Ensure uniqueness by ID to avoid duplicate React keys.
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
        setWorldNum(val => val + 1)
        trackWorldStats()
        startNewGeneration()
        generateWorld(worldNum)
        setTurn(0)
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
    setSelectedOrb(orb)
  }

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
              setWorldNum(0)
              setTurn(0)
              generateWorld()
            }}
          >
            ↪️Restart
          </button>

          <div>
            <button
              disabled={turn === 0}
              onClick={() => setTurnDuration(1)}
            >
              1
            </button>
            <button
              disabled={turn === 0}
              onClick={() => setTurnDuration(10)}
            >
              10
            </button>
            <button
              disabled={turn === 0}
              onClick={() => setTurnDuration(100)}
            >
              100
            </button>
            <button
              disabled={turn === 0}
              onClick={() => setTurnDuration(500)}
            >
              500
            </button>
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
              generateWorld()
              setTurn(0)
            }}
          >
            ⏭️ New Gen
          </button>
          <button
            onClick={() => {
              setPaused(true)
              setShowSettings(true)
            }}
            title="Open settings"
          >
            ⚙️
          </button>
          <button
            onClick={() => openOrbGenerator()}
            title="Generate orb"
          >
            🔮 Generate Orb
          </button>
        </div>
      </div>

      <div className="content">
        <div className="world">
          <div
            className="grid field"
            style={{
              gridTemplateRows: `repeat(${worldSize[0]}, 48px)`,
              gridTemplateColumns: `repeat(${worldSize[1]}, 48px)`
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
            className="orbs-layer"
            style={{
              width: `${worldSize[1] * cellSize + (worldSize[1] - 1) * cellGap}px`,
              height: `${worldSize[0] * cellSize + (worldSize[0] - 1) * cellGap}px`
            }}
          >
            {orbs.filter(o => o.hp > 0).map((orb) => {
              const left = orb.x * (cellSize + cellGap) + (cellSize - orbSize) / 2
              const top = orb.y * (cellSize + cellGap) + (cellSize - orbSize) / 2
              return (
                <div
                  key={orb.id}
                  id={`orb-${orb.id}`}
                  className={`orb ${orb.glow}`}
                  style={{
                    backgroundColor: `rgb(${orb.getColor().reds}, ${orb.getColor().greens}, 0)`,
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
              gridTemplateColumns: `repeat(${worldSize[1]}, 48px)`
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

        <div className="right-panel">
          <div className="gen-tabs">
            {deathStatsPerGeneration.map((_stats, idx) => (
              <button
                key={`gen-tab-${idx}`}
                className={activeGenTab === idx ? 'active' : ''}
                onClick={() => setActiveGenTab(idx)}
              >
                {idx + 1}
              </button>
            ))}
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
                hpGainedFromEating: 0
              }
              return (
                <ul>
                  <li>turns: {stats.turns}</li>
                  <li>highest_age: {stats.highestAge}</li>
                  <li>energy_start: {stats.energyStart}</li>
                  <li>births: {stats.births}</li>
                  <li>consumed_energy: {stats.consumedEnergy}</li>
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
                          style={{ backgroundColor: `rgb(${color.reds}, ${color.greens}, 0)` }}
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

        </div>
      </div>

      {selectedOrb && (
        <div className="orb-story">
          <div className="orb-story__header">
            <div>{selectedOrb.name}</div>
            <button onClick={() => setSelectedOrb(null)}>⤫</button>
          </div>
          <div className="commands-section">
            <div className="commands-title">Reactions Matrix</div>
            <div className="reactions-matrix">
              {(() => {
                const directionLabels = [ 'Left', 'Right', 'Top', 'Bottom' ]
                const signalLabels = [
                  'Out of world',
                  'Energy',
                  'Empty',
                  'Smaller orb',
                  'Bigger orb'
                ]
                return (
                  <>
                    {/* Header row aligned to the same grid columns */}
                    <div className="reactions-row-title">Signals</div>
                    {signalLabels.map((label, idx) => (
                      <div key={`sig-${idx}`} className="signal-label" title={label}>
                        {label}
                      </div>
                    ))}

                    {/* Direction rows: label + 5 cells */}
                    {selectedOrb.reactions.map((row, dirIndex) => (
                      <>
                        <div key={`dir-${dirIndex}`} className="reactions-row-title">
                          {directionLabels[dirIndex]}
                        </div>
                        {row.map((id, colIndex) => {
                          const info = orbCommandsInfo[id]
                          const title = `${signalLabels[colIndex]} → ${info?.label ?? id}`
                          return (
                            <div
                              key={`r-cell-${dirIndex}-${colIndex}`}
                              className="command-icon"
                              title={title}
                            >
                              {info?.icon ?? '❔'}
                            </div>
                          )
                        })}
                      </>
                    ))}
                  </>
                )
              })()}
            </div>
          </div>

          <div className="commands-section">
            <div className="commands-title">DNA</div>
            <div className="commands-list">
              {selectedOrb.dna.map((id, index) => {
                const info = orbCommandsInfo[id]
                return (
                  <div
                    key={`dna-${index}`}
                    className="command-icon"
                    title={info?.label ?? String(id)}
                  >
                    {info?.icon ?? '❔'}
                  </div>
                )
              })}
            </div>
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
                    className="log-block"
                  >
                    {turnIndex}
                  </div>
                  {turnItems.map((entry, entryIndex) => (
                    <div
                      key={`log-${turnIndex}-${entryIndex}`}
                      className="command-icon log-block"
                    >
                      {entry}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom panels: Saved Orbs in a dedicated section */}
      <div className="bottom-panels">
        <SavedOrbs
          title="Saved Orbs"
          savedOrbs={savedOrbs}
          getColorFromDNA={getColorFromDNA}
          onSpawn={(o) => spawnFromConfig(o.dna, o.reactions, getRandomMinMax(initialOrbHP[0], initialOrbHP[1]))}
          onEdit={(o) => openOrbGenerator(o)}
          onDelete={(id) => setSavedOrbs(prev => prev.filter(x => x.id !== id))}
        />
      </div>

      {showOrbGenerator && (
        <div className="orb-generator-panel">
          <div className="orb-generator-header">
            <div>{editingOrbId ? 'Edit Orb' : 'Orb Generator'}</div>
            <button onClick={() => { setShowOrbGenerator(false); setEditingOrbId(null) }}>⤫</button>
          </div>
          <div className="orb-generator-content">
            <div className="settings-row">
              <label>Spawn HP</label>
              <input className="settings-input" type="number" min={1} value={genHP}
                     onChange={(e) => setGenHP(Math.max(1, Number(e.target.value)))} />
            </div>

            <div className="generator-section-title">DNA</div>
            <div className="dna-editor">
              {genDNA.map((val, idx) => (
                <select key={`dna-edit-${idx}`} className="settings-input" value={val}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setGenDNA(cur => {
                            const next = [ ...cur ]
                            next[idx] = v
                            return next
                          })
                        }}
                >
                  {Object.entries(orbCommandsInfo).map(([ idStr, info ]) => {
                    const id = Number(idStr)
                    return <option key={`dna-opt-${idx}-${id}`} value={id}>{info.icon} {info.label}</option>
                  })}
                </select>
              ))}
            </div>

            <div className="generator-section-title">Reactions</div>
            {(() => {
              const directionLabels = [ 'Left', 'Right', 'Top', 'Bottom' ]
              const signalLabels = [ 'Out of world', 'Energy', 'Empty', 'Smaller orb', 'Bigger orb' ]
              return (
                <div className="reaction-editor">
                  <div className="sig-label">Signals</div>
                  {signalLabels.map((label, idx) => (
                    <div key={`gen-sig-${idx}`} className="sig-label">{label}</div>
                  ))}

                  {genReactions.map((row, dirIndex) => (
                    <>
                      <div key={`gen-dir-${dirIndex}`} className="dir-label">{directionLabels[dirIndex]}</div>
                      {row.map((cell, colIndex) => (
                        <select key={`gen-r-cell-${dirIndex}-${colIndex}`} className="settings-input" value={cell}
                                onChange={(e) => {
                                  const id = Number(e.target.value)
                                  setGenReactions(cur => cur.map((r, rIdx) => rIdx !== dirIndex ? r : r.map((c, cIdx) => cIdx !== colIndex ? c : id)))
                                }}
                        >
                          {Object.entries(orbCommandsInfo).map(([ idStr, info ]) => {
                            const id = Number(idStr)
                            return <option key={`gen-r-opt-${dirIndex}-${colIndex}-${id}`} value={id}>{info.icon} {info.label}</option>
                          })}
                        </select>
                      ))}
                    </>
                  ))}
                </div>
              )
            })()}

            <div className="settings-actions">
              <button onClick={() => saveGeneratedOrb()} title="Save orb">💾 Save</button>
              <button onClick={() => { spawnFromConfig(normalizeDna(genDNA), normalizeReactions(genReactions), genHP); setShowOrbGenerator(false); setEditingOrbId(null) }} title="Spawn orb">🪄 Spawn</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          draftSettings={draftSettings}
          setDraftSettings={setDraftSettings}
          onClose={() => setShowSettings(false)}
          savedOrbs={savedOrbs}
          getColorFromDNA={getColorFromDNA}
          onSpawn={(o) => spawnFromConfig(o.dna, o.reactions, getRandomMinMax(initialOrbHP[0], initialOrbHP[1]))}
          onEdit={(o) => openOrbGenerator(o)}
          onDelete={(id) => setSavedOrbs(prev => prev.filter(x => x.id !== id))}
        />
      )}
    </>
  )
}

export default App
