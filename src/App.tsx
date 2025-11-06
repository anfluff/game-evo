import { useEffect, useState } from 'react'
import './styles/App.css'

// ---- SETUP -----

const worldSize: number[] = [ 15, 15 ]

const initialOrbsCount = 30 // должно быть четным
const initialOrbHP = [8, 16]
const splitHP = 6
const dnaLength = 36

const idLength = 6
const initialTurnDuration = 100
const worldIterationsLimit = 100

// ---- CLASSES -----

const orbCommands = {
  MOVE_RIGHT: 1,
  MOVE_LEFT: 2,
  MOVE_UP: 3,
  MOVE_DOWN: 4,
  // STAY_IDLE: 5,
  GENERATE_HEALTH: 5,
  BITE_LEFT: 6,
  BITE_RIGHT: 7,
  BITE_UP: 8,
  BITE_DOWN: 9,
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

  constructor(x: number, y: number, hp: number, dna: number[]) {
    this.x = x
    this.y = y
    this.hp = hp
    this.dna = dna
    this.id = getRandomId(idLength)
    this.addToLog(`I was born with ${hp} hp`)
  }

  act () {
    if (this.hp <= 0) {
      return
    }

    this.executeCommand(this.dna[this.dnaPointer])
    this.moveDnaPointer(1)
    this.age += 1
  }

  executeCommand (id: number) {
    orbCommandsStats[id]++

    switch (id) {
      case orbCommands.MOVE_RIGHT:
        this.move(this.x + 1, this.y)
        this.addToLog(`I went right`)
        this.loseHp(1)
        break
      case orbCommands.MOVE_LEFT:
        this.move(this.x - 1, this.y)
        this.addToLog(`I went left`)
        this.loseHp(1)
        break
      case orbCommands.MOVE_UP:
        this.move(this.x, this.y + 1)
        this.addToLog(`I went up`)
        this.loseHp(1)
        break
      case orbCommands.MOVE_DOWN:
        this.move(this.x, this.y - 1)
        this.addToLog(`I went down`)
        this.loseHp(1)
        break
      case orbCommands.GENERATE_HEALTH:
        this.addToLog(`I generated health`)
        // this.hp += 1
        break
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
      this.loseHp(this.hp)
      return
    }

    const occupants = getCellOrbs(x, y)
    if (occupants.length > 0) {
      this.addToLog(`I tried to step into occupied cell`)
      return
    }

    this.x = x
    this.y = y
  }

  bite (x:number, y:number) {
    let cellOrbs = getCellOrbs(x, y, this.id)
    if (cellOrbs.length === 0) {
      this.addToLog(`I missed my bite`)
      this.loseHp(1)
      return
    }

    const prey = cellOrbs[getRandomMinMax(0, cellOrbs.length - 1)]
    this.eat(prey)
  }

  eat (prey: Orb) {
    if (prey instanceof Orb) {
      this.hp += prey.hp
      this.addToLog(`I ate Orb ${prey.id} and got ${prey.hp}hp`)

      prey.addToLog(`I was eaten by ${this.id}`)
      prey.loseHp(prey.hp)

      orbsEaten += 1
    }
  }

  watch (x:number, y:number) {
    if (
      x < 0 || x >= worldSize[0] ||
      y < 0 || y >= worldSize[1]
    ) {
      this.moveDnaPointer(1)
    } else {
      const cellOrbs = getCellOrbs(x, y)
      if (cellOrbs.length === 0) {
        this.moveDnaPointer(2)
      } else if (cellOrbs.length === 1) {
        this.moveDnaPointer(3)
      } else {
        this.moveDnaPointer(4)
      }
    }
    this.loseHp(1)
    if (this.hp > 0) {
      this.executeCommand(this.dna[this.dnaPointer])
    }
  }

  giveBirth (x:number, y:number) {
    if (!withinWorldBoundaries(x, y)) {
      this.addToLog(`I tried to give birth out of the world`)
      this.loseHp(1)
      return
    }

    const occupants = getCellOrbs(x, y)
    if (occupants.length > 0) {
      this.addToLog(`I tried to give birth into occupied cell`)
      this.loseHp(1)
      return
    }

    if (this.hp >= splitHP) {
      const child = spawnOrb(x, y, Math.ceil(this.hp / 2), this.dna)
      this.loseHp(Math.floor(this.hp / 2))
      this.addToLog(`It spawned ${child.id}`)
    } else {
      this.loseHp(1)
      this.addToLog(`I did not have enough hp`)
    }
  }

  // -- helpers --

  moveDnaPointer (value:number) {
    this.dnaPointer += value
    if (this.dnaPointer >= this.dna.length) {
      this.dnaPointer = 0
    }
  }

  loseHp (amount: number) {
    this.hp -= amount
    if (this.hp <= 0) {
      this.die()
    }
  }

  die () {
    this.addToLog(`I died at age of ${this.age}`)
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
      return item === orbCommands.GENERATE_HEALTH
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

let orbs: Orb[] = []
let lastTurnDeadOrbs: Orb[] = []

function generateWorld (worldIteration:number = 0) {
  if (worldIteration >= worldIterationsLimit) {
    const orbCommandKeys = Object.fromEntries(Object.entries(orbCommands).map(a => a.reverse()))
    for (const [key, value] of Object.entries(orbCommandsStats)) {
      console.log(orbCommandKeys[key] + ': ' + value)
    }

    console.log('orbsEaten: ' + orbsEaten)

    console.log(orbs)

    return
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
  } else {
    // первая генерация
    orbs = []
    for (let i = 0; i < initialOrbsCount; i++) {
      const [x, y] = getRandomEmptyCell()
      const hp = getRandomMinMax(initialOrbHP[0], initialOrbHP[1])
      spawnOrb(x, y, hp)
    }
  }
}

function generateMap () {
  world = []
  for (let rowIndex = 0; rowIndex < worldSize[0]; rowIndex++) {
    world.push(Array(worldSize[1]).fill(0))
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
      index %2 === 0 ||
      index %3 === 0
    ) {
      return orbCommands.GENERATE_HEALTH
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

// -------------

generateWorld()

function App() {
  const [turn, setTurn] = useState(0)
  const [worldNum, setWorldNum] = useState(0)
  const [turnDuration, setTurnDuration] = useState(initialTurnDuration)
  const [selectedOrb, setSelectedOrb] = useState<Orb | null>(null)

  const aliveOrbsCount: number = orbs.filter(orb => orb.hp > 0).length

  function triggerTurn () {
    setTurn(turn => turn + 1)
    makeTurn(turn)
  }

  function trackWorldStats () {
    if (turn > maxTurns) {
      maxTurns = turn
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (aliveOrbsCount > 0) {
        triggerTurn()
      } else {
        if (turn === 0) {
          return
        }
        setWorldNum(val => val + 1)
        trackWorldStats()
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
    turnDuration
  ])

  useEffect(() => {
    setSelectedOrb(null)
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
          maxTurns: {maxTurns}
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
            disabled={turn === 0}
            onClick={() => setTurnDuration(99999999)}
          >
            ⏸️
          </button>
        </div>
      </div>

      <div
        key={turn}
        className="world"
      >
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
          className="grid orbs"
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
                {
                  orbs
                    .filter(orb => orb.x === colIndex && orb.y === rowIndex)
                    .map((orb, index) => (
                      <div
                        key={index}
                        id={`orb-${orb.id}`}
                        className="orb"
                        style={{ backgroundColor: `rgb(${orb.getColor().reds}, ${orb.getColor().greens}, 0)` }}
                        onClick={() => showOrbStory(orb)}
                      >
                        {orb.hp}
                      </div>
                    ))
                }
              </div>
            ))
          ))}
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
