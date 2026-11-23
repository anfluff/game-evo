export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Random integer in [min, max], both inclusive. */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomHexId(length: number): string {
  let str = ''
  for (let i = 0; i < length; i++) {
    str += (Math.random() * 16 | 0).toString(16)
  }
  return str
}
