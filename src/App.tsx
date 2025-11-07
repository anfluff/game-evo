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
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

// ---- Заметки -----
// 1. зрение имеет "встроенную память", но этот последовательный сдвиг в зависимости от реакции сам себе мешает
//    (если есть реакционные сдвиги на 1,2,3,4, то это мешает формированию последовательного поведения в 1-2-3-4)
// 2. если как то это поправить, то можно зрение начать расширять - добавить реактуию на родство и тд

// ---- SETUP -----

const worldSize: number[] = [ 15, 15 ]

const initialOrbsCount = 30 // должно быть четным
const initialOrbHP = [8, 16]

const initialEnergyOnMap = 100
const resetEnergyOnNewGenerations = false // true - сбрасывать энергию на новую генерацию, false - сохранять

const splitHP = 6
const dnaLength = 36

const idLength = 6
const initialTurnDuration = 100
// Visual constants for layout and transitions
const cellSize = 48
const cellGap = 4
const orbSize = 36

// ---- CLASSES -----

const orbCommands = {
  STAY_IDLE: 1,
  MOVE_RIGHT: 2,
  MOVE_LEFT: 3,
  MOVE_UP: 4,
  MOVE_DOWN: 5,
  BITE_LEFT: 6,
  BITE_RIGHT: 7,
  BITE_UP: 8,
  BITE_DOWN: 9,
  CONSUME_ENERGY: 10,
  WATCH_LEFT: 11,
  WATCH_RIGHT: 12,
  WATCH_TOP: 13,
  WATCH_BOTTOM: 14,
  WATCH_UNDERNEATH: 15,
  GIVE_BIRTH_LEFT: 16,
  GIVE_BIRTH_RIGHT: 17,
  GIVE_BIRTH_UP: 18,
  GIVE_BIRTH_DOWN: 19
}

class Orb {
  id: string
  age: number = 0

  x: number
  y: number
  hp: number

  dna: number[]
  dnaPointer: number = 0

  log: string[] = []
  deathReason: DeathReason | null = null
  preventAgingThisTurn: boolean = false
  glow: string = ''

  constructor(x: number, y: number, hp: number, dna: number[]) {
    this.x = x
    this.y = y
    this.hp = hp
    this.dna = dna
    this.id = getRandomId(idLength)
    this.addToLog(`I was born with ${hp} hp`)
  }

  triggerGlow (className: 'glow-white' | 'glow-red' | 'glow-green') {
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

  act () {
    if (this.hp <= 0) {
      return
    }

    // Reset aging prevention flag for this turn
    this.preventAgingThisTurn = false

    this.executeCommand(this.dna[this.dnaPointer])
    // Apply unified aging once per act if not prevented by action
    if (!this.preventAgingThisTurn) {
      this.addToLog(`> I aged and lost 1 hp`)
      this.loseHp(1)
    }
    this.moveDnaPointer(1)
    this.age += 1
  }

  executeCommand (id: number) {
    orbCommandsStats[id]++

    switch (id) {
      case orbCommands.MOVE_RIGHT:
        this.addToLog(`I decided to move right`)
        this.move(this.x + 1, this.y)
        this.addToLog(`> I went right`)
        break
      case orbCommands.MOVE_LEFT:
        this.addToLog(`I decided to move left >`)
        this.move(this.x - 1, this.y)
        this.addToLog(`> I went left`)
        break
      case orbCommands.MOVE_UP:
        this.addToLog(`I decided to move up >`)
        this.move(this.x, this.y + 1)
        this.addToLog(`> I went up`)
        break
      case orbCommands.MOVE_DOWN:
        this.addToLog(`I decided to move down >`)
        this.move(this.x, this.y - 1)
        this.addToLog(`> I went down`)
        break
      case orbCommands.CONSUME_ENERGY: {
        this.addToLog(`I try to consume energy >`)
        this.consumeEnergy()
        break
      }
      case orbCommands.BITE_LEFT: {
        this.addToLog(`I bite left >`)
        this.bite(this.x - 1, this.y)
      }
        break
      case orbCommands.BITE_RIGHT: {
        this.addToLog(`I bite right >`)
        this.bite(this.x + 1, this.y)
      }
        break
      case orbCommands.BITE_UP: {
        this.addToLog(`I bite up >`)
        this.bite(this.x, this.y + 1)
      }
        break
      case orbCommands.BITE_DOWN: {
        this.addToLog(`I bite down >`)
        this.bite(this.x, this.y - 1)
        break
      }
      case orbCommands.WATCH_RIGHT:
        this.addToLog(`I watch right >`)
        this.watch(this.x + 1, this.y)
        break
      case orbCommands.WATCH_LEFT:
        this.addToLog(`I watch left >`)
        this.watch(this.x -1, this.y)
        break
      case orbCommands.WATCH_TOP:
        this.addToLog(`I watch top >`)
        this.watch(this.x, this.y + 1)
        break
      case orbCommands.WATCH_BOTTOM:
        this.addToLog(`I watch bottom >`)
        this.watch(this.x, this.y - 1)
        break
      case orbCommands.WATCH_UNDERNEATH:
        this.addToLog(`I watch underneath >`)
        this.watch(this.x, this.y)
        break
      case orbCommands.GIVE_BIRTH_LEFT:
        this.addToLog(`I try to give birth left >`)
        this.giveBirth(this.x - 1, this.y)
        break
      case orbCommands.GIVE_BIRTH_RIGHT:
        this.addToLog(`I try to give birth right >`)
        this.giveBirth(this.x + 1, this.y)
        break
      case orbCommands.GIVE_BIRTH_UP:
        this.addToLog(`I try to give birth up >`)
        this.giveBirth(this.x, this.y + 1)
        break
      case orbCommands.GIVE_BIRTH_DOWN:
        this.addToLog(`I try to give birth down >`)
        this.giveBirth(this.x, this.y - 1)
        break
    }
  }

  // -- commands --

  move (x:number, y:number) {
    if (!withinWorldBoundaries(x, y)) {
      this.addToLog(`> I jump out of the world`)
      this.deathReason = deathReasons.OUT_OF_WORLD
      this.loseHp(this.hp)
      return
    }

    const occupants = getCellOrbs(x, y)
    if (occupants.length > 0) {
      this.addToLog(`> I tried to step into occupied cell, but failed`)
      return
    }

    this.x = x
    this.y = y
  }

  bite (x:number, y:number) {
    this.triggerGlow('glow-red')

    let cellOrbs = getCellOrbs(x, y, this.id)
    if (cellOrbs.length === 0) {
      this.addToLog(`> I missed my bite`)
      return
    }

    // Prefer only smaller prey; otherwise fail
    const smallerPrey = cellOrbs.filter(o => o.hp < this.hp)
    if (smallerPrey.length === 0) {
      this.addToLog(`> No smaller prey to eat`)
      return
    }

    const prey = smallerPrey[getRandomMinMax(0, smallerPrey.length - 1)]
    this.eat(prey)
  }

  eat (prey: Orb) {
    if (prey instanceof Orb) {
      // Only eat prey strictly smaller by current hp
      if (prey.hp >= this.hp) {
        this.addToLog(`> I failed to eat ${prey.id} (prey not smaller)`)
        return
      }

      // Gain full health from prey (all of its current hp)
      const hpGain = prey.hp
      this.hp += hpGain
      this.addToLog(`> I ate Orb ${prey.id} and got ${hpGain}hp`)

      // Eating prevents aging for this turn
      this.preventAgingThisTurn = true

      prey.addToLog(`I was eaten by ${this.id}`)
      prey.deathReason = deathReasons.EATEN
      prey.loseHp(prey.hp)

      orbsEaten += 1
    }
  }

  watch (x:number, y:number) {
    if (!withinWorldBoundaries(x, y)) {
      this.addToLog('> I looked out of the world >')
      this.moveDnaPointer(1)
    } else {
      const cellOrbs = getCellOrbs(x, y)
      if (cellOrbs.length > 0) {
        this.addToLog('> I saw an orb >')
        if (cellOrbs.some(o => o.hp < this.hp)) {
          this.addToLog('> smaller than me >')
          this.moveDnaPointer(3)
        } else {
          this.addToLog('> bigger than me >')
          this.moveDnaPointer(4)
        }
      } else {
        this.addToLog('> I saw nothing >')
        this.moveDnaPointer(2)
      }
    }

    this.addToLog('> and performed a follow-up action:')
    this.executeCommand(this.dna[this.dnaPointer])
  }

  giveBirth (x:number, y:number) {
    if (!withinWorldBoundaries(x, y)) {
      this.addToLog(`> I tried to give birth out of the world`)
      return
    }

    const occupants = getCellOrbs(x, y)
    if (occupants.length > 0) {
      this.addToLog(`> I tried to give birth into occupied cell`)
      return
    }

    if (this.hp >= splitHP) {
      const child = spawnOrb(x, y, Math.ceil(this.hp / 2), this.dna)
      this.loseHp(Math.floor(this.hp / 2))
      this.addToLog(`> It spawned ${child.id}`)
    } else {
      this.addToLog(`> I did not have enough hp`)
    }
  }

  consumeEnergy () {
    const energyHere = getWorldEnergy(this.y, this.x)
    if (energyHere > 0) {
      consumeWorldEnergy(this.y, this.x, 1)
      this.addToLog(`> I consumed energy`)
      this.gainHp(1)
      this.preventAgingThisTurn = true
      this.triggerGlow('glow-green')
    } else {
      this.addToLog(`> No energy here (${energyHere})`)
    }
  }

  // -- helpers --

  moveDnaPointer (value:number) {
    this.dnaPointer += value
    if (this.dnaPointer >= this.dna.length) {
      this.dnaPointer = 0
    }
  }

  gainHp (amount: number) {
    this.hp += amount
    this.addToLog(`> (${this.hp})`)
  }

  loseHp (amount: number) {
    this.hp -= amount
    this.addToLog(`> (${this.hp})`)
    if (this.hp <= 0) {
      if (withinWorldBoundaries(this.x, this.y)) {
        this.layDownEnergy(1)
      }
      if (!this.deathReason) {
        this.deathReason = deathReasons.NO_HP
      }
      this.die()
    }
  }

  layDownEnergy (value: number) {
    if (value <= 0) {
      return
    }
    addWorldEnergy(this.y, this.x, value)
  }

  die () {
    this.addToLog(`I died at age of ${this.age}`)
    registerDeath(this.deathReason ?? deathReasons.NO_HP, this.age)
    lastTurnDeadOrbs.push(this)

    removeWorldObject(this)
  }

  addToLog (entry: string) {
    if (
      this.log[this.log.length - 1] &&
      this.log[this.log.length - 1].slice(-1) === '>'
    ) {
      this.log[this.log.length - 1] += ` ${entry}`
      return
    }

    if (
      this.log[this.log.length - 1] &&
      entry.slice(0, 1) === '>'
    ) {
      this.log[this.log.length - 1] += ` ${entry}`
      return
    }

    this.log.push(entry)
  }

  getColor () {
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

function generateWorld (worldIteration:number = 0) {
  if (deathStatsPerGeneration.length === 0) {
    startNewGeneration()
  }

  generateMap()

  if (worldIteration > 1) {
    // последующие геренации
    const strongestOrbs = lastTurnDeadOrbs
      .sort((a, b) => b.age - a.age)
      .slice(0, initialOrbsCount / 2)

    orbs = []
    lastTurnDeadOrbs = []

    // каждый орб дает двух потомков
    for (const strongestOrb of strongestOrbs) {
      for (let i = 0; i < initialOrbsCount / strongestOrbs.length; i++) {
        const [x, y] = getRandomEmptyCell()
        const hp = getRandomMinMax(initialOrbHP[0], initialOrbHP[1])
        spawnOrb(x, y, hp, strongestOrb.dna)
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
      const [x, y] = getRandomEmptyCell()
      const hp = getRandomMinMax(initialOrbHP[0], initialOrbHP[1])
      spawnOrb(x, y, hp)
    }

    // заполняем мир пурвой энергией
    reseedRandomEnergy()
  }
}

function reseedRandomEnergy () {
  worldEnergy = []
  for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
    worldEnergy.push(Array(worldSize[1]).fill(0))
  }
  distributeEnergyOnMap(initialEnergyOnMap)
}

function generateMap () {
  world = []
  for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
    world.push(Array(worldSize[1]).fill(0))
  }
}

function distributeEnergyOnMap (total: number) {
  if (!total || total <= 0) return
  for (let i = 0; i < total; i++) {
    const rowIndex = getRandomMinMax(0, worldSize[0] - 1)
    const colIndex = getRandomMinMax(0, worldSize[1] - 1)
    addWorldEnergy(rowIndex, colIndex, 1)
  }
}

function spawnOrb (x:number, y:number, hp:number, ancestorDNA: number[] = []) {
  const dna = ancestorDNA.length
    ? getMutatedDNA(ancestorDNA)
    : getRandomDNA()

  const orb = new Orb(x, y, hp, dna)
  orbs.push(orb)

  return orb
}

function makeTurn (_turnNum: number) {
  for (const orb of orbs) {
    if (orb.hp > 0) {
      orb.act()
    } else {

    }
  }
}

// ----- HELPERS -----

function withinWorldBoundaries (x: number, y: number) {
  return x >= 0 &&
    x < worldSize[0] &&
    y >= 0 &&
    y < worldSize[1]
}

// Energy helpers
function getWorldEnergy (rowIndex: number, colIndex: number): number {
  if (!withinWorldBoundaries(colIndex, rowIndex)) return 0
  return worldEnergy[rowIndex]?.[colIndex] ?? 0
}

function addWorldEnergy (rowIndex: number, colIndex: number, amount: number = 1): number {
  if (!withinWorldBoundaries(colIndex, rowIndex)) return 0
  if (!worldEnergy[rowIndex]) {
    worldEnergy[rowIndex] = Array(worldSize[1]).fill(0)
  }
  const current = worldEnergy[rowIndex][colIndex] ?? 0
  const next = current + Math.max(0, amount)
  worldEnergy[rowIndex][colIndex] = next
  return next
}

function consumeWorldEnergy (rowIndex: number, colIndex: number, amount: number = 1): boolean {
  if (!withinWorldBoundaries(colIndex, rowIndex)) return false
  const current = getWorldEnergy(rowIndex, colIndex)
  const need = Math.max(0, amount)
  if (current >= need) {
    worldEnergy[rowIndex][colIndex] = current - need
    return true
  }
  return false
}

function getRandomMinMax (min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Returns coordinates of a random empty cell to ensure single occupancy
function getRandomEmptyCell (): [number, number] {
  // Try up to 1000 random picks to find an empty cell
  for (let i = 0; i < 1000; i++) {
    const x = getRandomMinMax(0, worldSize[0] - 1)
    const y = getRandomMinMax(0, worldSize[1] - 1)
    if (getCellOrbs(x, y).length === 0) {
      return [x, y]
    }
  }
  // Fallback: return any random cell (unlikely to be needed)
  return [getRandomMinMax(0, worldSize[0] - 1), getRandomMinMax(0, worldSize[1] - 1)]
}

function getCellOrbs (x:number, y:number, excludeId:string|null= null) {
  let o =  orbs.filter(orb => orb.x === x && orb.y === y)
  if (excludeId) {
    o = o.filter(item => item.id !== excludeId)
  }
  return o
}

function removeWorldObject (obj: Orb) {
  if (obj instanceof Orb) {
    for (let i = 0; i < orbs.length; i++) {
      if (orbs[i].id === obj.id) {
        orbs.splice(i, 1)
        return
      }
    }
  }
}

function getRandomId (length:number) {
  let str = ''
  for (let i = 0; i <length; i++) {
    str += (Math.random() * 16 | 0).toString(16)
  }
  return str
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

function getRandomOrbCommand () {
  // Choose from existing command IDs to avoid selecting removed IDs
  const values = Object.values(orbCommands)
  const idx = getRandomMinMax(0, values.length - 1)
  return values[idx]
}

function getMutatedDNA (ancestorDNA: number[]) {
  const newDNA = [ ...ancestorDNA ]
  
  const randomIndex = getRandomMinMax(0, newDNA.length - 1)
  newDNA[randomIndex] = getRandomOrbCommand()
  
  return newDNA
}

// ---- STATS -----

let maxTurns = 0
let orbsEaten = 0
let orbCommandsStats = Object.fromEntries(
  Object.values(orbCommands).map(key => ([key, 0]))
)

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
}

let currentGeneration = 0
let deathStatsPerGeneration: GenerationStats[] = []
// Global re-render hook used by non-React objects (like Orb) to refresh UI
let forceRerender: (() => void) | null = null

function startNewGeneration () {
  currentGeneration += 1
  deathStatsPerGeneration[currentGeneration - 1] = {
    reasons: {
      eaten: 0,
      out_of_world: 0,
      no_hp: 0
    },
    turns: 0,
    highestAge: 0
  }
}

function registerDeath (reason: DeathReason, age: number) {
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

// -------------

generateWorld()

function App() {
  const [turn, setTurn] = useState(0)
  const [worldNum, setWorldNum] = useState(0)
  const [turnDuration, setTurnDuration] = useState(initialTurnDuration)
  const [selectedOrb, setSelectedOrb] = useState<Orb | null>(null)
  const [paused, setPaused] = useState(false)
  const [activeGenTab, setActiveGenTab] = useState(0)

  const aliveOrbsCount: number = orbs.filter(orb => orb.hp > 0).length

  function triggerTurn () {
    setTurn(turn => turn + 1)
    makeTurn(turn)
  }

  function trackWorldStats () {
    if (turn > maxTurns) {
      maxTurns = turn
    }
    if (deathStatsPerGeneration.length > 0 && currentGeneration > 0) {
      // Record turns count for the generation that just ended
      deathStatsPerGeneration[currentGeneration - 1].turns = turn
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
        console.log(`>> all dead on turn: ${turn}`)
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

  function showOrbStory (orb: Orb) {
    setSelectedOrb(orb)
  }

  return (
    <>
      <div className="actions-bar">
        <span>
          world: {worldNum}
        </span>

        <span>
          alive: {aliveOrbsCount}
        </span>

        <span>
          turn: {turn}
        </span>

        <button
          disabled={turn === 0}
          onClick={() => {
            setWorldNum(0)
            setTurn(0)
            generateWorld()
          }}
        >
          reset
        </button>

        <button
          disabled={turn === 0}
          onClick={() => {
            generateWorld()
            setTurn(0)
          }}
        >
          next
        </button>

        <div>
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
            Step
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
                    <div className="energy-indicator">
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
                highestAge: 0
              }
              return (
                <ul>
                  <li>turns: {stats.turns}</li>
                  <li>highest_age: {stats.highestAge}</li>
                  <li>eaten: {stats.reasons.eaten}</li>
                  <li>out_of_world: {stats.reasons.out_of_world}</li>
                  <li>no_hp: {stats.reasons.no_hp}</li>
                </ul>
              )
            })()}
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
              return <Line data={data} options={options} />
            })()}
          </div>
          
        </div>
      </div>

      {selectedOrb && (
        <div className="orb-story">
          <button onClick={() => setSelectedOrb(null)}>⤫</button>
          <div>{selectedOrb.id}</div>
          <div>{selectedOrb.dna.join('-')}</div>
          <ol>
            {selectedOrb.log.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

export default App
