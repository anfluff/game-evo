import type { SimEvent } from '../game/events'
import type { Orb } from '../game/orb'
import type { Simulation } from '../game/simulation'
import { orbColor } from './orbColor'

export const CELL_SIZE = 48
export const CELL_GAP = 4
const STRIDE = CELL_SIZE + CELL_GAP
const ORB_RADIUS = 18

/** Extra world drawn around the viewport so scrolling never reveals a blank edge. */
const OVERSCAN = STRIDE * 2

const MOVE_MS = 150
const GLOW_MS = 300
const BEAM_MS = 260
const GLOW_SPREAD = 24

const CELL_COLOR = '#333'
const ENERGY_ALPHA = [ 0, 0.05, 0.1, 0.2, 0.3, 0.4 ]
const SELECTED_RING = 'rgba(255, 255, 255, 0.95)'
const RELATIVE_RING = 'rgba(120, 220, 140, 0.9)'

type Rgba = [ number, number, number, number ]

const GLOW_BY_EVENT: Record<SimEvent['type'], Rgba> = {
  consume: [ 255, 255, 255, 0.25 ],
  bite: [ 255, 0, 0, 0.25 ],
  attack: [ 255, 165, 0, 0.3 ],
  birth: [ 0, 255, 0, 0.25 ]
}
const HOVER_GLOW: Rgba = [ 240, 184, 0, 1 ]

const BEAM_COLOR = {
  bite: '255, 0, 0',
  attack: '255, 165, 0',
  birth: '46, 204, 113'
}

type Glow = { color: Rgba; until: number }
type Beam = { type: keyof typeof BEAM_COLOR; fromX: number; fromY: number; toX: number; toY: number; until: number }

/** Where an orb is drawn while it glides from one cell to the next. */
type Tween = { cellX: number; cellY: number; fromPx: number; fromPy: number; px: number; py: number; start: number }

export function worldPixelSize(simulation: Simulation): { width: number; height: number } {
  const { rows, cols } = simulation.world
  return {
    width: cols * CELL_SIZE + (cols - 1) * CELL_GAP,
    height: rows * CELL_SIZE + (rows - 1) * CELL_GAP
  }
}

/**
 * Draws the world on a canvas.
 *
 * The canvas covers only the part of the world inside the browser viewport
 * and follows it as the page scrolls, so a frame costs the same whether the
 * world is 15 cells wide or 1500. Frames are drawn on demand: when the
 * simulation changes, the view moves, or an animation is still running.
 */
export class WorldRenderer {
  private readonly container: HTMLElement
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly simulation: Simulation
  private readonly fontFamily: string

  private selectedOrb: Orb | null = null
  private effectsEnabled = true

  private glows = new Map<string, Glow>()
  private beams: Beam[] = []
  private tweens = new Map<Orb, Tween>()
  private readonly colors = new WeakMap<Orb, string>()
  private readonly glowSprites = new Map<string, HTMLCanvasElement>()

  private pointer: { x: number; y: number } | null = null
  /** False while the world is scrolled out of the viewport and nothing is drawn. */
  private onScreen = true
  private frame: number | null = null
  private readonly cleanups: Array<() => void> = []

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    simulation: Simulation,
    options: { selectedOrb: Orb | null; effectsEnabled: boolean }
  ) {
    this.container = container
    this.canvas = canvas
    this.simulation = simulation
    this.selectedOrb = options.selectedOrb
    this.effectsEnabled = options.effectsEnabled
    this.ctx = canvas.getContext('2d')!
    this.fontFamily = getComputedStyle(container).fontFamily || 'sans-serif'

    const listen = <K extends keyof WindowEventMap>(
      target: Window | HTMLElement,
      type: K,
      handler: (event: WindowEventMap[K]) => void,
      options?: AddEventListenerOptions
    ) => {
      target.addEventListener(type, handler as EventListener, options)
      this.cleanups.push(() => target.removeEventListener(type, handler as EventListener, options))
    }

    this.cleanups.push(simulation.subscribe(this.invalidate))
    this.cleanups.push(simulation.onEvent(this.handleEvent))
    // Capture phase: scrolling of any ancestor moves the world on screen.
    listen(window, 'scroll', this.invalidate, { capture: true, passive: true })
    listen(window, 'resize', this.invalidate)
    listen(container, 'mousemove', event => {
      this.pointer = { x: event.clientX, y: event.clientY }
      this.invalidate()
    })
    listen(container, 'mouseleave', () => {
      this.pointer = null
      this.invalidate()
    })

    this.invalidate()
  }

  destroy() {
    for (const cleanup of this.cleanups) {
      cleanup()
    }
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame)
      this.frame = null
    }
  }

  setSelectedOrb(orb: Orb | null) {
    this.selectedOrb = orb
    this.invalidate()
  }

  setEffectsEnabled(enabled: boolean) {
    this.effectsEnabled = enabled
    if (!enabled) {
      this.glows.clear()
      this.beams = []
    }
    this.invalidate()
  }

  /** The orb under a point given in viewport coordinates, as mouse events report them. */
  orbAt(clientX: number, clientY: number): Orb | null {
    const rect = this.container.getBoundingClientRect()
    const wx = clientX - rect.left
    const wy = clientY - rect.top
    const cellX = Math.floor(wx / STRIDE)
    const cellY = Math.floor(wy / STRIDE)
    const dx = wx - (cellX * STRIDE + CELL_SIZE / 2)
    const dy = wy - (cellY * STRIDE + CELL_SIZE / 2)
    if (dx * dx + dy * dy > ORB_RADIUS * ORB_RADIUS) {
      return null
    }
    const occupants = this.simulation.world.occupantsAt(cellX, cellY)
    return occupants.length > 0 ? occupants[occupants.length - 1] : null
  }

  private readonly invalidate = () => {
    if (this.frame === null) {
      this.frame = requestAnimationFrame(this.draw)
    }
  }

  private readonly handleEvent = (event: SimEvent) => {
    // Effects are cleared as frames are drawn. Without frames they would only pile up.
    if (!this.effectsEnabled || !this.onScreen || document.hidden) {
      return
    }
    const now = performance.now()
    this.glows.set(event.orbId, { color: GLOW_BY_EVENT[event.type], until: now + GLOW_MS })
    if (event.type !== 'consume') {
      this.beams.push({
        type: event.type,
        fromX: event.fromX,
        fromY: event.fromY,
        toX: event.toX,
        toY: event.toY,
        until: now + BEAM_MS
      })
    }
  }

  // ---- drawing ----

  private readonly draw = (now: number) => {
    this.frame = null
    const { container, canvas, ctx, simulation } = this
    const { world } = simulation
    const size = worldPixelSize(simulation)

    const rect = container.getBoundingClientRect()
    this.onScreen =
      rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth
    if (!this.onScreen) {
      // The scroll listener brings the next frame.
      this.glows.clear()
      this.beams = []
      return
    }

    // Fit the canvas to the viewport (plus overscan) and slide it to the visible part of the world.
    const viewWidth = Math.min(size.width, Math.ceil(window.innerWidth) + OVERSCAN * 2)
    const viewHeight = Math.min(size.height, Math.ceil(window.innerHeight) + OVERSCAN * 2)
    const viewLeft = Math.round(Math.min(Math.max(-rect.left - OVERSCAN, 0), size.width - viewWidth))
    const viewTop = Math.round(Math.min(Math.max(-rect.top - OVERSCAN, 0), size.height - viewHeight))
    const dpr = window.devicePixelRatio || 1
    const pixelWidth = Math.round(viewWidth * dpr)
    const pixelHeight = Math.round(viewHeight * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      canvas.style.width = `${viewWidth}px`
      canvas.style.height = `${viewHeight}px`
    }
    canvas.style.transform = `translate(${viewLeft}px, ${viewTop}px)`

    ctx.setTransform(dpr, 0, 0, dpr, -viewLeft * dpr, -viewTop * dpr)
    ctx.clearRect(viewLeft, viewTop, viewWidth, viewHeight)

    const firstCol = Math.max(0, Math.floor(viewLeft / STRIDE))
    const lastCol = Math.min(world.cols - 1, Math.floor((viewLeft + viewWidth) / STRIDE))
    const firstRow = Math.max(0, Math.floor(viewTop / STRIDE))
    const lastRow = Math.min(world.rows - 1, Math.floor((viewTop + viewHeight) / STRIDE))

    this.drawCells(firstCol, lastCol, firstRow, lastRow)
    this.drawEnergy(firstCol, lastCol, firstRow, lastRow)
    const moving = this.drawOrbs(firstCol, lastCol, firstRow, lastRow, now)
    const beaming = this.drawBeams(now)

    if (moving || beaming || this.glows.size > 0) {
      this.invalidate()
    }
  }

  private drawCells(firstCol: number, lastCol: number, firstRow: number, lastRow: number) {
    const { ctx } = this
    ctx.beginPath()
    for (let y = firstRow; y <= lastRow; y++) {
      for (let x = firstCol; x <= lastCol; x++) {
        ctx.roundRect(x * STRIDE, y * STRIDE, CELL_SIZE, CELL_SIZE, 2)
      }
    }
    ctx.fillStyle = CELL_COLOR
    ctx.fill()
  }

  private drawEnergy(firstCol: number, lastCol: number, firstRow: number, lastRow: number) {
    const { ctx } = this
    const { energy } = this.simulation.world

    // One path per brightness level, so the whole layer takes five fills.
    const tiles: Path2D[] = ENERGY_ALPHA.map(() => new Path2D())
    for (let y = firstRow; y <= lastRow; y++) {
      const row = energy[y]
      for (let x = firstCol; x <= lastCol; x++) {
        if (row[x] > 0) {
          tiles[Math.min(row[x], 5)].roundRect(x * STRIDE + 2, y * STRIDE + 2, 40, 40, 4)
        }
      }
    }
    for (let level = 1; level < tiles.length; level++) {
      ctx.fillStyle = `rgba(255, 255, 200, ${ENERGY_ALPHA[level]})`
      ctx.fill(tiles[level])
    }

    ctx.font = `600 10px ${this.fontFamily}`
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (let y = firstRow; y <= lastRow; y++) {
      const row = energy[y]
      for (let x = firstCol; x <= lastCol; x++) {
        if (row[x] > 0) {
          ctx.fillText(String(row[x]), x * STRIDE + 6, y * STRIDE + 7)
        }
      }
    }
  }

  /** Draws the orbs in view. Returns true while any of them is still gliding to its cell. */
  private drawOrbs(firstCol: number, lastCol: number, firstRow: number, lastRow: number, now: number): boolean {
    const { ctx, selectedOrb, effectsEnabled } = this
    const { world } = this.simulation

    // Collect the orbs in view and advance their glide. One cell of margin
    // keeps an orb visible while it steps out of the drawn area.
    const visible: Orb[] = []
    const tweens = new Map<Orb, Tween>()
    let moving = false
    for (let y = Math.max(0, firstRow - 1); y <= Math.min(world.rows - 1, lastRow + 1); y++) {
      for (let x = Math.max(0, firstCol - 1); x <= Math.min(world.cols - 1, lastCol + 1); x++) {
        for (const orb of world.occupantsAt(x, y)) {
          const targetPx = x * STRIDE + CELL_SIZE / 2
          const targetPy = y * STRIDE + CELL_SIZE / 2
          let tween = this.tweens.get(orb)
          if (!tween) {
            tween = { cellX: x, cellY: y, fromPx: targetPx, fromPy: targetPy, px: targetPx, py: targetPy, start: -Infinity }
          } else if (tween.cellX !== x || tween.cellY !== y) {
            tween.cellX = x
            tween.cellY = y
            tween.fromPx = tween.px
            tween.fromPy = tween.py
            tween.start = now
          }
          const progress = effectsEnabled ? Math.min(1, (now - tween.start) / MOVE_MS) : 1
          if (progress < 1) {
            const eased = 1 - Math.pow(1 - progress, 3)
            tween.px = tween.fromPx + (targetPx - tween.fromPx) * eased
            tween.py = tween.fromPy + (targetPy - tween.fromPy) * eased
            moving = true
          } else {
            tween.px = targetPx
            tween.py = targetPy
          }
          tweens.set(orb, tween)
          visible.push(orb)
        }
      }
    }
    this.tweens = tweens

    const hovered = this.pointer ? this.orbAt(this.pointer.x, this.pointer.y) : null
    this.container.style.cursor = hovered ? 'pointer' : ''

    // Glows sit behind the orbs.
    for (const [ orbId, glow ] of this.glows) {
      if (glow.until <= now) {
        this.glows.delete(orbId)
      }
    }
    if (effectsEnabled) {
      for (const orb of visible) {
        const color = orb === hovered ? HOVER_GLOW : this.glows.get(orb.id)?.color
        if (color) {
          const tween = tweens.get(orb)!
          const sprite = this.glowSprite(color)
          const half = ORB_RADIUS + GLOW_SPREAD
          ctx.drawImage(sprite, tween.px - half, tween.py - half, half * 2, half * 2)
        }
      }
    }

    // Bodies.
    for (const orb of visible) {
      const tween = tweens.get(orb)!
      let color = this.colors.get(orb)
      if (!color) {
        color = orbColor(orb.genes)
        this.colors.set(orb, color)
      }
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(tween.px, tween.py, ORB_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }

    // Rings around the selected orb and its relatives.
    if (selectedOrb) {
      ctx.lineWidth = 3
      for (const orb of visible) {
        const isSelected = orb === selectedOrb
        if (!isSelected && !(selectedOrb.kinshipTo(orb) > 0)) {
          continue
        }
        const tween = tweens.get(orb)!
        ctx.strokeStyle = isSelected ? SELECTED_RING : RELATIVE_RING
        ctx.beginPath()
        ctx.arc(tween.px, tween.py, ORB_RADIUS + 3.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Hp in the middle.
    ctx.font = `16px ${this.fontFamily}`
    ctx.fillStyle = '#000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const orb of visible) {
      const tween = tweens.get(orb)!
      ctx.fillText(String(orb.hp), tween.px, tween.py + 1)
    }

    // Age badge at the top right.
    ctx.beginPath()
    for (const orb of visible) {
      const tween = tweens.get(orb)!
      ctx.moveTo(tween.px + 14 + 8, tween.py - 14)
      ctx.arc(tween.px + 14, tween.py - 14, 8, 0, Math.PI * 2)
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.stroke()

    ctx.font = `700 9px ${this.fontFamily}`
    ctx.fillStyle = '#111'
    for (const orb of visible) {
      const tween = tweens.get(orb)!
      ctx.fillText(String(orb.age), tween.px + 14, tween.py - 13.5)
    }

    return moving
  }

  /** Draws the arrows of recent bites, attacks and births. Returns true while any is still showing. */
  private drawBeams(now: number): boolean {
    const { ctx } = this
    this.beams = this.beams.filter(beam => beam.until > now)
    if (this.beams.length === 0) {
      return false
    }

    ctx.lineCap = 'round'
    for (const beam of this.beams) {
      const fromPx = beam.fromX * STRIDE + CELL_SIZE / 2
      const fromPy = beam.fromY * STRIDE + CELL_SIZE / 2
      const toPx = beam.toX * STRIDE + CELL_SIZE / 2
      const toPy = beam.toY * STRIDE + CELL_SIZE / 2
      const length = Math.hypot(toPx - fromPx, toPy - fromPy) || 1
      const ux = (toPx - fromPx) / length
      const uy = (toPy - fromPy) / length
      const rgb = BEAM_COLOR[beam.type]

      // A wide faint stroke under the line stands in for a blur.
      ctx.strokeStyle = `rgba(${rgb}, 0.22)`
      ctx.lineWidth = 12
      ctx.beginPath()
      ctx.moveTo(fromPx, fromPy)
      ctx.lineTo(toPx, toPy)
      ctx.stroke()

      ctx.strokeStyle = `rgba(${rgb}, 0.85)`
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(fromPx, fromPy)
      ctx.lineTo(toPx, toPy)
      ctx.stroke()

      // Arrowhead just past the target's centre.
      ctx.fillStyle = `rgba(${rgb}, 0.85)`
      ctx.beginPath()
      ctx.moveTo(toPx + ux * 7, toPy + uy * 7)
      ctx.lineTo(toPx - ux - uy * 6, toPy - uy + ux * 6)
      ctx.lineTo(toPx - ux + uy * 6, toPy - uy - ux * 6)
      ctx.closePath()
      ctx.fill()
    }
    ctx.lineCap = 'butt'
    return true
  }

  /** A soft halo, rendered once per colour and reused as an image. */
  private glowSprite(color: Rgba): HTMLCanvasElement {
    const key = color.join(',')
    let sprite = this.glowSprites.get(key)
    if (!sprite) {
      const [ r, g, b, alpha ] = color
      const half = ORB_RADIUS + GLOW_SPREAD
      const scale = Math.ceil(window.devicePixelRatio || 1)
      sprite = document.createElement('canvas')
      sprite.width = half * 2 * scale
      sprite.height = half * 2 * scale
      const ctx = sprite.getContext('2d')!
      ctx.scale(scale, scale)
      const gradient = ctx.createRadialGradient(half, half, ORB_RADIUS - 2, half, half, half)
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`)
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, half * 2, half * 2)
      this.glowSprites.set(key, sprite)
    }
    return sprite
  }
}
